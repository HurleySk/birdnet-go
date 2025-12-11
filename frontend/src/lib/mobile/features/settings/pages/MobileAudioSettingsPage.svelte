<!--
  Mobile Audio Settings Page Component

  Purpose: Mobile version of audio configuration settings for BirdNET-Go including
  audio capture, RTSP streams, audio processing, clip recording, and retention policies.

  Features:
  - Audio capture source selection (sound card/RTSP)
  - Audio filters and equalizer configuration
  - Sound level monitoring setup
  - Audio export format and path settings
  - Audio clip retention policies
  - Mobile-optimized 44px touch targets

  @component
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '$lib/i18n';
  import { getLocale } from '$lib/i18n';
  import {
    settingsStore,
    settingsActions,
    audioSettings,
    rtspSettings,
    isLoading,
  } from '$lib/stores/settings';
  import {
    MobileTextInput,
    MobileNumberInput,
    MobileSlider,
    MobileSelect,
    MobileToggle,
  } from '../../../components/forms';
  import { loggers } from '$lib/utils/logger';
  import { getBitrateConfig, formatBitrate, parseNumericBitrate } from '$lib/utils/audioValidation';

  const logger = loggers.audio;

  // Auto-save state
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  let saveStatus = $state<'idle' | 'pending' | 'saving' | 'saved'>('idle');

  function debouncedSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveStatus = 'pending';
    saveTimeout = setTimeout(async () => {
      saveStatus = 'saving';
      await settingsActions.saveSettings();
      saveStatus = 'saved';
      setTimeout(() => {
        saveStatus = 'idle';
      }, 1500);
    }, 800);
  }

  // Load settings on mount to ensure data is available before saving
  onMount(() => {
    settingsActions.loadSettings();
  });

  let store = $derived($settingsStore);

  // Reactive settings with proper defaults
  let settings = $derived(
    (() => {
      const audioBase = $audioSettings ?? {
        source: '',
        soundLevel: {
          enabled: false,
          interval: 60,
        },
        equalizer: {
          enabled: false,
          filters: [],
        },
        export: {
          enabled: false,
          path: 'clips/',
          type: 'wav' as const,
          bitrate: '96k',
          retention: {
            policy: 'none',
            maxAge: '7d',
            maxUsage: '80%',
            minClips: 10,
            keepSpectrograms: false,
          },
          length: 15,
          preCapture: 3,
          gain: 0,
          normalization: {
            enabled: false,
            targetLUFS: -23.0,
            loudnessRange: 7.0,
            truePeak: -2.0,
          },
        },
      };

      const rtspBase = $rtspSettings ?? {
        transport: 'tcp',
        urls: [],
      };

      return {
        audio: {
          ...audioBase,
          equalizer: {
            enabled: audioBase.equalizer?.enabled ?? false,
            filters: audioBase.equalizer?.filters ?? [],
          },
        },
        rtsp: {
          transport: rtspBase.transport || 'tcp',
          urls: rtspBase.urls ?? [],
        },
      };
    })()
  );

  // Localized options - memoized to prevent unnecessary recomputations
  const exportFormatOptions = $derived.by(() => {
    getLocale();
    return [
      { value: 'wav', label: t('settings.audio.formats.wav') },
      { value: 'flac', label: t('settings.audio.formats.flac') },
      { value: 'aac', label: t('settings.audio.formats.aac') },
      { value: 'opus', label: t('settings.audio.formats.opus') },
      { value: 'mp3', label: t('settings.audio.formats.mp3') },
    ];
  });

  const retentionPolicyOptions = $derived.by(() => {
    getLocale();
    return [
      { value: 'none', label: t('settings.audio.audioClipRetention.policies.none') },
      { value: 'age', label: t('settings.audio.audioClipRetention.policies.age') },
      { value: 'usage', label: t('settings.audio.audioClipRetention.policies.usage') },
    ];
  });

  const maxUsageOptions = [
    { value: '70%', label: '70%' },
    { value: '75%', label: '75%' },
    { value: '80%', label: '80%' },
    { value: '85%', label: '85%' },
    { value: '90%', label: '90%' },
    { value: '95%', label: '95%' },
  ];

  const transportOptions = [
    { value: 'tcp', label: 'TCP' },
    { value: 'udp', label: 'UDP' },
  ];

  // Attenuation options for audio filters (passes → dB)
  const attenuationOptions = [
    { value: '0', label: t('settings.audio.audioFilters.attenuationLevels.0db') },
    { value: '1', label: t('settings.audio.audioFilters.attenuationLevels.12db') },
    { value: '2', label: t('settings.audio.audioFilters.attenuationLevels.24db') },
    { value: '3', label: t('settings.audio.audioFilters.attenuationLevels.36db') },
    { value: '4', label: t('settings.audio.audioFilters.attenuationLevels.48db') },
  ];

  // Filter type interface
  interface FilterParameter {
    Name: string;
    Label: string;
    Type: string;
    Unit?: string;
    Min: number;
    Max: number;
    Default: number;
  }

  interface FilterTypeConfig {
    Parameters: FilterParameter[];
  }

  interface Filter {
    id: string;
    type: 'highpass' | 'lowpass' | 'bandpass' | 'bandstop';
    frequency: number;
    q?: number;
    gain?: number;
    passes?: number;
  }

  // Fallback filter config (same as desktop)
  const FALLBACK_EQ_FILTER_CONFIG: Record<string, FilterTypeConfig> = {
    LowPass: {
      Parameters: [
        { Name: 'Frequency', Label: 'Cutoff Frequency', Type: 'number', Unit: 'Hz', Min: 20, Max: 20000, Default: 15000 },
        { Name: 'Passes', Label: 'Attenuation', Type: 'number', Min: 1, Max: 4, Default: 1 },
      ],
    },
    HighPass: {
      Parameters: [
        { Name: 'Frequency', Label: 'Cutoff Frequency', Type: 'number', Unit: 'Hz', Min: 20, Max: 20000, Default: 100 },
        { Name: 'Passes', Label: 'Attenuation', Type: 'number', Min: 1, Max: 4, Default: 1 },
      ],
    },
  };

  // Filter config state
  let eqFilterConfig = $state<Record<string, FilterTypeConfig>>({});
  let loadingFilterConfig = $state(false);

  // New filter form state
  let newFilterType = $state('');
  let newFilterFrequency = $state(0);
  let newFilterPasses = $state(1);

  // Filter type options derived from config
  let filterTypeOptions = $derived([
    { value: '', label: t('settings.audio.audioFilters.selectFilterType') },
    ...Object.keys(eqFilterConfig).map(type => ({ value: type, label: type })),
  ]);

  // Load filter config when equalizer is enabled
  $effect(() => {
    if (settings.audio.equalizer.enabled && Object.keys(eqFilterConfig).length === 0) {
      loadFilterConfig();
    }
  });

  async function loadFilterConfig() {
    loadingFilterConfig = true;
    try {
      const response = await fetch('/api/v2/system/audio/equalizer/config', {
        headers: { 'X-CSRF-Token': csrfToken },
      });
      if (!response.ok) {
        throw new Error(`Failed to load filter config: ${response.status}`);
      }
      const data = await response.json();
      eqFilterConfig = data ?? FALLBACK_EQ_FILTER_CONFIG;

      // Set default frequency based on first filter type if empty
      if (Object.keys(eqFilterConfig).length > 0) {
        const firstType = Object.keys(eqFilterConfig)[0];
        const config = eqFilterConfig[firstType];
        const freqParam = config?.Parameters?.find((p: FilterParameter) => p.Name === 'Frequency');
        if (freqParam) {
          newFilterFrequency = freqParam.Default;
        }
      }
    } catch (error) {
      logger.error('Error fetching filter config:', error);
      eqFilterConfig = FALLBACK_EQ_FILTER_CONFIG;
    } finally {
      loadingFilterConfig = false;
    }
  }

  // Handle filter type change - set default values
  function handleFilterTypeChange(type: string) {
    newFilterType = type;
    if (type && eqFilterConfig[type]) {
      const config = eqFilterConfig[type];
      const freqParam = config.Parameters?.find((p: FilterParameter) => p.Name === 'Frequency');
      const passesParam = config.Parameters?.find((p: FilterParameter) => p.Name === 'Passes');
      newFilterFrequency = freqParam?.Default ?? 1000;
      newFilterPasses = passesParam?.Default ?? 1;
    }
  }

  // Add a new filter
  function addFilter() {
    if (!newFilterType) return;

    // Convert PascalCase API type (HighPass, LowPass) to lowercase store type
    const filterType = newFilterType.toLowerCase() as Filter['type'];

    const newFilter: Filter = {
      id: crypto.randomUUID(),
      type: filterType,
      frequency: newFilterFrequency,
      passes: newFilterPasses,
    };

    const updatedFilters = [...(settings.audio.equalizer.filters ?? []), newFilter];
    settingsActions.updateSection('realtime', {
      audio: {
        ...settings.audio,
        equalizer: {
          ...settings.audio.equalizer,
          filters: updatedFilters,
        },
      },
    });

    // Reset form
    newFilterType = '';
    newFilterFrequency = 0;
    newFilterPasses = 1;
    debouncedSave();
  }

  // Remove a filter at index
  function removeFilter(index: number) {
    const updatedFilters = settings.audio.equalizer.filters?.filter((_, i) => i !== index) ?? [];
    settingsActions.updateSection('realtime', {
      audio: {
        ...settings.audio,
        equalizer: {
          ...settings.audio.equalizer,
          filters: updatedFilters,
        },
      },
    });
    debouncedSave();
  }

  // Update a filter parameter
  function updateFilter(index: number, key: string, value: number) {
    const updatedFilters = settings.audio.equalizer.filters?.map((filter, i) => {
      if (i === index) {
        return { ...filter, [key]: value };
      }
      return filter;
    }) ?? [];
    settingsActions.updateSection('realtime', {
      audio: {
        ...settings.audio,
        equalizer: {
          ...settings.audio.equalizer,
          filters: updatedFilters,
        },
      },
    });
    debouncedSave();
  }

  // Bitrate configuration based on format
  let bitrateConfig = $derived(getBitrateConfig(settings.audio.export.type));
  let numericBitrate = $derived(parseNumericBitrate(settings.audio.export.bitrate));

  // Retention settings with proper structure
  let retentionSettings = $derived({
    policy: settings.audio.export?.retention?.policy ?? 'none',
    maxAge: settings.audio.export?.retention?.maxAge ?? '7d',
    maxUsage: settings.audio.export?.retention?.maxUsage ?? '80%',
    minClips: settings.audio.export?.retention?.minClips ?? 10,
    keepSpectrograms: settings.audio.export?.retention?.keepSpectrograms ?? false,
  });

  // Audio devices state
  let audioDevices = $state<Array<{ Index: number; Name: string }>>([]);
  let audioDevicesLoading = $state(true);

  // CSRF token
  let csrfToken = $derived(
    (document.querySelector('meta[name="csrf-token"]') as HTMLElement)?.getAttribute('content') ||
      ''
  );

  // Load audio devices
  $effect(() => {
    loadAudioDevices();
  });

  async function loadAudioDevices() {
    audioDevicesLoading = true;
    try {
      const response = await fetch('/api/v1/settings/audio/get', {
        headers: { 'X-CSRF-Token': csrfToken },
      });
      if (!response.ok) {
        throw new Error(`Failed to load audio devices: ${response.status}`);
      }
      const data = await response.json();
      audioDevices = data ?? [];
    } catch (error) {
      logger.error('Error fetching audio devices:', error);
      audioDevices = [];
    } finally {
      audioDevicesLoading = false;
    }
  }

  // Update handlers - all trigger debounced auto-save
  function updateAudioSource(source: string) {
    settingsActions.updateSection('realtime', {
      audio: { ...settings.audio, source },
    });
    debouncedSave();
  }

  function updateRTSPTransport(transport: string) {
    settingsActions.updateSection('realtime', {
      rtsp: { ...settings.rtsp, transport },
    });
    debouncedSave();
  }

  function updateEqualizerEnabled(enabled: boolean) {
    settingsActions.updateSection('realtime', {
      audio: {
        ...settings.audio,
        equalizer: { ...settings.audio.equalizer, enabled },
      },
    });
    debouncedSave();
  }

  function updateSoundLevelEnabled(enabled: boolean) {
    settingsActions.updateSection('realtime', {
      audio: {
        ...settings.audio,
        soundLevel: { ...settings.audio.soundLevel, enabled },
      },
    });
    debouncedSave();
  }

  function updateSoundLevelInterval(interval: number) {
    settingsActions.updateSection('realtime', {
      audio: {
        ...settings.audio,
        soundLevel: { ...settings.audio.soundLevel, interval },
      },
    });
    debouncedSave();
  }

  function updateNormalizationEnabled(enabled: boolean) {
    settingsActions.updateSection('realtime', {
      audio: {
        ...settings.audio,
        export: {
          ...settings.audio.export,
          normalization: { ...settings.audio.export.normalization, enabled },
        },
      },
    });
    debouncedSave();
  }

  function updateNormalizationTargetLUFS(targetLUFS: number) {
    settingsActions.updateSection('realtime', {
      audio: {
        ...settings.audio,
        export: {
          ...settings.audio.export,
          normalization: { ...settings.audio.export.normalization, targetLUFS },
        },
      },
    });
    debouncedSave();
  }

  function updateNormalizationLoudnessRange(loudnessRange: number) {
    settingsActions.updateSection('realtime', {
      audio: {
        ...settings.audio,
        export: {
          ...settings.audio.export,
          normalization: { ...settings.audio.export.normalization, loudnessRange },
        },
      },
    });
    debouncedSave();
  }

  function updateNormalizationTruePeak(truePeak: number) {
    settingsActions.updateSection('realtime', {
      audio: {
        ...settings.audio,
        export: {
          ...settings.audio.export,
          normalization: { ...settings.audio.export.normalization, truePeak },
        },
      },
    });
    debouncedSave();
  }

  function updateExportEnabled(enabled: boolean) {
    settingsActions.updateSection('realtime', {
      audio: { ...settings.audio, export: { ...settings.audio.export, enabled } },
    });
    debouncedSave();
  }

  function updateExportLength(length: number) {
    const maxPreCapture = Math.floor(length / 2);
    if (settings.audio.export.preCapture > maxPreCapture) {
      settingsActions.updateSection('realtime', {
        audio: {
          ...settings.audio,
          export: { ...settings.audio.export, length, preCapture: maxPreCapture },
        },
      });
    } else {
      settingsActions.updateSection('realtime', {
        audio: { ...settings.audio, export: { ...settings.audio.export, length } },
      });
    }
    debouncedSave();
  }

  function updateExportPreCapture(preCapture: number) {
    settingsActions.updateSection('realtime', {
      audio: { ...settings.audio, export: { ...settings.audio.export, preCapture } },
    });
    debouncedSave();
  }

  function updateExportGain(gain: number) {
    settingsActions.updateSection('realtime', {
      audio: { ...settings.audio, export: { ...settings.audio.export, gain } },
    });
    debouncedSave();
  }

  function updateExportPath(path: string) {
    settingsActions.updateSection('realtime', {
      audio: { ...settings.audio, export: { ...settings.audio.export, path } },
    });
    debouncedSave();
  }

  function updateExportFormat(type: string) {
    settingsActions.updateSection('realtime', {
      audio: {
        ...settings.audio,
        export: { ...settings.audio.export, type: type as 'wav' | 'mp3' | 'flac' | 'aac' | 'opus' },
      },
    });
    debouncedSave();
  }

  function updateExportBitrate(bitrate: number) {
    const formattedBitrate = formatBitrate(bitrate);
    settingsActions.updateSection('realtime', {
      audio: {
        ...settings.audio,
        export: { ...settings.audio.export, bitrate: formattedBitrate },
      },
    });
    debouncedSave();
  }

  function updateRetentionPolicy(policy: string) {
    settingsActions.updateSection('realtime', {
      audio: {
        ...settings.audio,
        export: {
          ...settings.audio.export,
          retention: { ...retentionSettings, policy },
        },
      },
    });
    debouncedSave();
  }

  function updateRetentionMaxAge(maxAge: string) {
    settingsActions.updateSection('realtime', {
      audio: {
        ...settings.audio,
        export: {
          ...settings.audio.export,
          retention: { ...retentionSettings, maxAge },
        },
      },
    });
    debouncedSave();
  }

  function updateRetentionMaxUsage(maxUsage: string) {
    settingsActions.updateSection('realtime', {
      audio: {
        ...settings.audio,
        export: {
          ...settings.audio.export,
          retention: { ...retentionSettings, maxUsage },
        },
      },
    });
    debouncedSave();
  }

  function updateRetentionMinClips(minClips: number) {
    settingsActions.updateSection('realtime', {
      audio: {
        ...settings.audio,
        export: {
          ...settings.audio.export,
          retention: { ...retentionSettings, minClips },
        },
      },
    });
    debouncedSave();
  }

  function updateRetentionKeepSpectrograms(keepSpectrograms: boolean) {
    settingsActions.updateSection('realtime', {
      audio: {
        ...settings.audio,
        export: {
          ...settings.audio.export,
          retention: { ...retentionSettings, keepSpectrograms },
        },
      },
    });
    debouncedSave();
  }
</script>

{#if $isLoading}
  <div class="flex items-center justify-center p-8">
    <span class="loading loading-spinner loading-lg text-primary"></span>
  </div>
{:else}
<div class="flex flex-col gap-6 p-4 pb-24 overflow-x-hidden">
  <!-- Audio Capture -->
  <div class="space-y-4">
    <h2 class="text-lg font-semibold">{t('settings.audio.audioCapture.title')}</h2>
    {#if audioDevicesLoading}
      <div class="flex items-center justify-center py-8">
        <span class="loading loading-spinner loading-md"></span>
      </div>
    {:else}
      <MobileSelect
        label={t('settings.audio.audioCapture.audioSourceLabel')}
        value={settings.audio.source}
        options={[
          { value: '', label: t('settings.audio.audioCapture.noSoundCardCapture') },
          ...audioDevices.map(d => ({ value: d.Name, label: d.Name })),
        ]}
        helpText={t('settings.audio.audioCapture.audioSourceHelp')}
        disabled={store.isLoading || store.isSaving}
        onchange={updateAudioSource}
      />
    {/if}
  </div>

  <!-- RTSP Streams -->
  <div class="space-y-4">
    <h2 class="text-lg font-semibold">{t('settings.audio.rtspStreams.title')}</h2>
    <MobileSelect
      label={t('settings.audio.audioCapture.rtspTransportLabel')}
      value={settings.rtsp.transport}
      options={transportOptions}
      helpText={t('settings.audio.audioCapture.rtspTransportHelp')}
      disabled={store.isLoading || store.isSaving}
      onchange={updateRTSPTransport}
    />
    <p class="text-sm text-base-content/60">
      {t('settings.audio.rtspStreams.description')}
    </p>
  </div>

  <!-- Audio Filters -->
  <div class="space-y-4">
    <h2 class="text-lg font-semibold">{t('settings.audio.audioFilters.title')}</h2>
    <MobileToggle
      label={t('settings.audio.audioFilters.enableEqualizer')}
      checked={settings.audio.equalizer.enabled}
      helpText={t('settings.audio.audioFilters.enableEqualizerHelp')}
      disabled={store.isLoading || store.isSaving}
      onchange={updateEqualizerEnabled}
    />

    {#if settings.audio.equalizer.enabled}
      <!-- Loading state -->
      {#if loadingFilterConfig}
        <div class="flex justify-center p-4">
          <span class="loading loading-spinner loading-sm"></span>
        </div>
      {:else}
        <!-- Existing Filters List -->
        {#if settings.audio.equalizer.filters && settings.audio.equalizer.filters.length > 0}
          <div class="space-y-3">
            {#each settings.audio.equalizer.filters as filter, index (filter.id ?? index)}
              <div class="rounded-lg bg-base-200 overflow-hidden">
                <!-- Color-coded left border: warm for highpass, cool for lowpass -->
                <div
                  class="flex border-l-4 p-4"
                  class:border-amber-500={filter.type === 'highpass'}
                  class:border-sky-500={filter.type === 'lowpass'}
                >
                  <div class="flex-1 space-y-3">
                    <!-- Header with type badge and delete -->
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-semibold uppercase tracking-wide opacity-70">
                        {filter.type}
                      </span>
                      <button
                        type="button"
                        class="btn btn-ghost btn-xs text-error"
                        onclick={() => removeFilter(index)}
                        disabled={store.isLoading || store.isSaving}
                        aria-label={t('settings.audio.audioFilters.remove')}
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                    <!-- Frequency - prominent display -->
                    <MobileNumberInput
                      label={t('settings.audio.audioFilters.cutoffFrequency')}
                      value={filter.frequency}
                      min={20}
                      max={20000}
                      step={10}
                      suffix=" Hz"
                      disabled={store.isLoading || store.isSaving}
                      onUpdate={v => updateFilter(index, 'frequency', v)}
                    />
                    <!-- Attenuation selector -->
                    <MobileSelect
                      label={t('settings.audio.audioFilters.attenuation')}
                      value={String(filter.passes ?? 1)}
                      options={attenuationOptions}
                      disabled={store.isLoading || store.isSaving}
                      onchange={v => updateFilter(index, 'passes', parseInt(v))}
                    />
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <!-- Empty state -->
          <div class="text-center py-6 text-base-content/50">
            <p class="text-sm">{t('settings.audio.audioFilters.emptyState.title')}</p>
            <p class="text-xs mt-1">{t('settings.audio.audioFilters.emptyState.description')}</p>
          </div>
        {/if}

        <!-- Add New Filter Section -->
        <div class="card bg-base-100 border border-base-300 mt-4">
          <div class="card-body p-4 space-y-4">
            <h3 class="font-medium text-sm">
              {t('settings.audio.audioFilters.newFilterType')}
            </h3>
            <MobileSelect
              label={t('settings.audio.audioFilters.filterType')}
              value={newFilterType}
              options={filterTypeOptions}
              disabled={store.isLoading || store.isSaving}
              onchange={handleFilterTypeChange}
            />
            {#if newFilterType}
              <MobileNumberInput
                label={t('settings.audio.audioFilters.cutoffFrequency')}
                value={newFilterFrequency}
                min={20}
                max={20000}
                step={10}
                suffix=" Hz"
                helpText={t('settings.audio.audioFilters.cutoffFrequencyHelp')}
                disabled={store.isLoading || store.isSaving}
                onUpdate={v => (newFilterFrequency = v)}
              />
              <MobileSelect
                label={t('settings.audio.audioFilters.attenuation')}
                value={String(newFilterPasses)}
                options={attenuationOptions}
                disabled={store.isLoading || store.isSaving}
                onchange={v => (newFilterPasses = parseInt(v))}
              />
              <button
                type="button"
                class="btn btn-primary w-full h-12"
                onclick={addFilter}
                disabled={!newFilterType || store.isLoading || store.isSaving}
              >
                {t('settings.audio.audioFilters.addFilter')}
              </button>
            {/if}
          </div>
        </div>
      {/if}
    {/if}
  </div>

  <!-- Sound Level Monitoring -->
  <div class="space-y-4">
    <h2 class="text-lg font-semibold">{t('settings.audio.soundLevelMonitoring.title')}</h2>
    <MobileToggle
      label={t('settings.audio.soundLevelMonitoring.enable')}
      checked={settings.audio.soundLevel.enabled}
      helpText={t('settings.audio.soundLevelMonitoring.enableHelp')}
      disabled={store.isLoading || store.isSaving}
      onchange={updateSoundLevelEnabled}
    />
    {#if settings.audio.soundLevel.enabled}
      <MobileNumberInput
        label={t('settings.audio.soundLevelMonitoring.intervalLabel')}
        value={settings.audio.soundLevel.interval}
        min={5}
        max={300}
        step={1}
        suffix="s"
        helpText={t('settings.audio.soundLevelMonitoring.intervalHelp')}
        disabled={!settings.audio.soundLevel.enabled || store.isLoading || store.isSaving}
        onUpdate={updateSoundLevelInterval}
      />
    {/if}
  </div>

  <!-- Audio Normalization -->
  <div class="space-y-4">
    <h2 class="text-lg font-semibold">{t('settings.audio.audioNormalization.title')}</h2>
    <MobileToggle
      label={t('settings.audio.audioNormalization.enable')}
      checked={settings.audio.export.normalization.enabled}
      helpText={t('settings.audio.audioNormalization.enableHelp')}
      disabled={!settings.audio.export.enabled || store.isLoading || store.isSaving}
      onchange={updateNormalizationEnabled}
    />
    {#if settings.audio.export.normalization.enabled && settings.audio.export.enabled}
      <MobileSlider
        label={t('settings.audio.audioNormalization.targetLUFSLabel')}
        value={settings.audio.export.normalization.targetLUFS}
        min={-40}
        max={-10}
        step={0.5}
        suffix=" LUFS"
        helpText={t('settings.audio.audioNormalization.targetLUFSHelp')}
        disabled={!settings.audio.export.normalization.enabled || store.isLoading || store.isSaving}
        onUpdate={updateNormalizationTargetLUFS}
      />
      <MobileSlider
        label={t('settings.audio.audioNormalization.loudnessRangeLabel')}
        value={settings.audio.export.normalization.loudnessRange}
        min={0}
        max={20}
        step={0.5}
        suffix=" LU"
        helpText={t('settings.audio.audioNormalization.loudnessRangeHelp')}
        disabled={!settings.audio.export.normalization.enabled || store.isLoading || store.isSaving}
        onUpdate={updateNormalizationLoudnessRange}
      />
      <MobileSlider
        label={t('settings.audio.audioNormalization.truePeakLabel')}
        value={settings.audio.export.normalization.truePeak}
        min={-10}
        max={0}
        step={0.1}
        suffix=" dBTP"
        helpText={t('settings.audio.audioNormalization.truePeakHelp')}
        disabled={!settings.audio.export.normalization.enabled || store.isLoading || store.isSaving}
        onUpdate={updateNormalizationTruePeak}
      />
    {/if}
  </div>

  <!-- Clip Recording -->
  <div class="space-y-4">
    <h2 class="text-lg font-semibold">{t('settings.audio.clipRecording.title')}</h2>
    <MobileToggle
      label={t('settings.audio.clipRecording.enable')}
      checked={settings.audio.export.enabled}
      helpText={t('settings.audio.clipRecording.enableHelp')}
      disabled={store.isLoading || store.isSaving}
      onchange={updateExportEnabled}
    />
    {#if settings.audio.export.enabled}
      <MobileSlider
        label={t('settings.audio.clipRecording.lengthLabel')}
        value={settings.audio.export.length}
        min={10}
        max={60}
        step={1}
        suffix="s"
        helpText={t('settings.audio.clipRecording.lengthHelp')}
        disabled={!settings.audio.export.enabled || store.isLoading || store.isSaving}
        onUpdate={updateExportLength}
      />
      <MobileSlider
        label={t('settings.audio.clipRecording.preCaptureLabel')}
        value={settings.audio.export.preCapture}
        min={0}
        max={Math.floor(settings.audio.export.length / 2)}
        step={1}
        suffix="s"
        helpText={t('settings.audio.clipRecording.preCaptureHelp', {
          max: Math.floor(settings.audio.export.length / 2),
        })}
        disabled={!settings.audio.export.enabled || store.isLoading || store.isSaving}
        onUpdate={updateExportPreCapture}
      />
      <MobileSlider
        label={t('settings.audio.clipRecording.gainLabel')}
        value={settings.audio.export.gain}
        min={0}
        max={20}
        step={1}
        suffix=" dB"
        helpText={t('settings.audio.clipRecording.gainHelp')}
        disabled={!settings.audio.export.enabled || store.isLoading || store.isSaving}
        onUpdate={updateExportGain}
      />
    {/if}
  </div>

  <!-- File Settings -->
  {#if settings.audio.export.enabled}
    <div class="space-y-4">
      <h2 class="text-lg font-semibold">{t('settings.audio.fileSettings.title')}</h2>
      <MobileTextInput
        label={t('settings.audio.fileSettings.pathLabel')}
        value={settings.audio.export.path}
        placeholder="clips/"
        helpText={t('settings.audio.fileSettings.pathHelp')}
        disabled={!settings.audio.export.enabled || store.isLoading || store.isSaving}
        onchange={updateExportPath}
      />
      <MobileSelect
        label={t('settings.audio.fileSettings.typeLabel')}
        value={settings.audio.export.type}
        options={exportFormatOptions}
        helpText={t('settings.audio.fileSettings.typeHelp')}
        disabled={!settings.audio.export.enabled || store.isLoading || store.isSaving}
        onchange={updateExportFormat}
      />
      {#if bitrateConfig}
        <MobileSlider
          label={t('settings.audio.fileSettings.bitrateLabel')}
          value={numericBitrate}
          min={bitrateConfig.min}
          max={bitrateConfig.max}
          step={bitrateConfig.step}
          suffix="k"
          helpText={t('settings.audio.fileSettings.bitrateHelp', {
            min: bitrateConfig.min,
            max: bitrateConfig.max,
          })}
          disabled={!settings.audio.export.enabled || store.isLoading || store.isSaving}
          onUpdate={updateExportBitrate}
        />
      {/if}
    </div>
  {/if}

  <!-- Retention Policy -->
  {#if settings.audio.export.enabled}
    <div class="space-y-4">
      <h2 class="text-lg font-semibold">{t('settings.audio.audioClipRetention.title')}</h2>
      <MobileSelect
        label={t('settings.audio.audioClipRetention.policyLabel')}
        value={retentionSettings.policy}
        options={retentionPolicyOptions}
        helpText={t('settings.audio.audioClipRetention.policyHelp')}
        disabled={store.isLoading || store.isSaving}
        onchange={updateRetentionPolicy}
      />
      {#if retentionSettings.policy === 'age'}
        <MobileTextInput
          label={t('settings.audio.audioClipRetention.maxAgeLabel')}
          value={retentionSettings.maxAge}
          placeholder="7d"
          helpText={t('settings.audio.audioClipRetention.maxAgeHelp')}
          disabled={store.isLoading || store.isSaving}
          onchange={updateRetentionMaxAge}
        />
      {/if}
      {#if retentionSettings.policy === 'usage'}
        <MobileSelect
          label={t('settings.audio.audioClipRetention.maxUsageLabel')}
          value={retentionSettings.maxUsage}
          options={maxUsageOptions}
          helpText={t('settings.audio.audioClipRetention.maxUsageHelp')}
          disabled={store.isLoading || store.isSaving}
          onchange={updateRetentionMaxUsage}
        />
      {/if}
      {#if retentionSettings.policy !== 'none'}
        <MobileNumberInput
          label={t('settings.audio.audioClipRetention.minClipsLabel')}
          value={retentionSettings.minClips}
          min={0}
          step={1}
          helpText={t('settings.audio.audioClipRetention.minClipsHelp')}
          disabled={store.isLoading || store.isSaving}
          onUpdate={updateRetentionMinClips}
        />
        <MobileToggle
          label={t('settings.audio.audioClipRetention.keepSpectrograms')}
          checked={retentionSettings.keepSpectrograms}
          helpText={t('settings.audio.audioClipRetention.keepSpectrogramsHelp')}
          disabled={store.isLoading || store.isSaving}
          onchange={updateRetentionKeepSpectrograms}
        />
      {/if}
    </div>
  {/if}

</div>
{/if}

<!-- Auto-save status indicator -->
{#if saveStatus !== 'idle'}
  <div class="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 opacity-100">
    <div
      class="px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium"
      class:bg-base-200={saveStatus === 'pending'}
      class:bg-primary={saveStatus === 'saving'}
      class:text-primary-content={saveStatus === 'saving'}
      class:bg-success={saveStatus === 'saved'}
      class:text-success-content={saveStatus === 'saved'}
    >
      {#if saveStatus === 'pending'}
        <span class="w-2 h-2 rounded-full bg-base-content/50 animate-pulse"></span>
        <span>{t('settings.actions.unsavedChanges')}</span>
      {:else if saveStatus === 'saving'}
        <span class="loading loading-spinner loading-xs"></span>
        <span>{t('settings.actions.saving')}</span>
      {:else if saveStatus === 'saved'}
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        <span>{t('settings.actions.saved')}</span>
      {/if}
    </div>
  </div>
{/if}
