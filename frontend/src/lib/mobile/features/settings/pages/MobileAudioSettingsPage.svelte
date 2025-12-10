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
  import { t } from '$lib/i18n';
  import { getLocale } from '$lib/i18n';
  import {
    settingsStore,
    settingsActions,
    audioSettings,
    rtspSettings,
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

  // Update handlers
  function updateAudioSource(source: string) {
    settingsActions.updateSection('realtime', {
      audio: { ...settings.audio, source },
    });
  }

  function updateRTSPTransport(transport: string) {
    settingsActions.updateSection('realtime', {
      rtsp: { ...settings.rtsp, transport },
    });
  }

  function updateEqualizerEnabled(enabled: boolean) {
    settingsActions.updateSection('realtime', {
      audio: {
        ...settings.audio,
        equalizer: { ...settings.audio.equalizer, enabled },
      },
    });
  }

  function updateSoundLevelEnabled(enabled: boolean) {
    settingsActions.updateSection('realtime', {
      audio: {
        ...settings.audio,
        soundLevel: { ...settings.audio.soundLevel, enabled },
      },
    });
  }

  function updateSoundLevelInterval(interval: number) {
    settingsActions.updateSection('realtime', {
      audio: {
        ...settings.audio,
        soundLevel: { ...settings.audio.soundLevel, interval },
      },
    });
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
  }

  function updateExportEnabled(enabled: boolean) {
    settingsActions.updateSection('realtime', {
      audio: { ...settings.audio, export: { ...settings.audio.export, enabled } },
    });
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
  }

  function updateExportPreCapture(preCapture: number) {
    settingsActions.updateSection('realtime', {
      audio: { ...settings.audio, export: { ...settings.audio.export, preCapture } },
    });
  }

  function updateExportGain(gain: number) {
    settingsActions.updateSection('realtime', {
      audio: { ...settings.audio, export: { ...settings.audio.export, gain } },
    });
  }

  function updateExportPath(path: string) {
    settingsActions.updateSection('realtime', {
      audio: { ...settings.audio, export: { ...settings.audio.export, path } },
    });
  }

  function updateExportFormat(type: string) {
    settingsActions.updateSection('realtime', {
      audio: {
        ...settings.audio,
        export: { ...settings.audio.export, type: type as 'wav' | 'mp3' | 'flac' | 'aac' | 'opus' },
      },
    });
  }

  function updateExportBitrate(bitrate: number) {
    const formattedBitrate = formatBitrate(bitrate);
    settingsActions.updateSection('realtime', {
      audio: {
        ...settings.audio,
        export: { ...settings.audio.export, bitrate: formattedBitrate },
      },
    });
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
  }

  async function handleSave() {
    await settingsActions.saveSettings();
  }
</script>

<div class="flex flex-col gap-6 p-4 pb-safe">
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
      label={t('settings.audio.rtspStreams.transportLabel')}
      value={settings.rtsp.transport}
      options={transportOptions}
      helpText={t('settings.audio.rtspStreams.transportHelp')}
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
      label={t('settings.audio.audioFilters.enable')}
      checked={settings.audio.equalizer.enabled}
      helpText={t('settings.audio.audioFilters.description')}
      disabled={store.isLoading || store.isSaving}
      onchange={updateEqualizerEnabled}
    />
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

  <!-- Sticky Save Button -->
  <div class="sticky bottom-0 bg-base-100 pt-4 pb-safe">
    <button
      class="btn btn-primary w-full h-12"
      onclick={handleSave}
      disabled={store.isLoading || store.isSaving}
    >
      {#if store.isSaving}
        <span class="loading loading-spinner loading-sm"></span>
      {/if}
      {t('settings.actions.save')}
    </button>
  </div>
</div>
