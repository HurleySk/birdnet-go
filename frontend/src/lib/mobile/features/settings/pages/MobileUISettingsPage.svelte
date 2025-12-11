<!--
  Mobile UI Settings Page Component

  Purpose: Configure user interface settings for mobile including language,
  dashboard display options, thumbnails, and spectrogram settings.

  Features:
  - Language selection for the user interface
  - Modern UI toggle
  - Dashboard summary limit configuration
  - Thumbnail display settings
  - Image provider selection
  - Spectrogram generation mode

  Mobile optimizations:
  - 44px minimum touch targets
  - Sticky save button at bottom
  - Single column layout
  - Clear section headers
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { t, getLocale } from '$lib/i18n';
  import { LOCALES } from '$lib/i18n/config';
  import {
    settingsStore,
    settingsActions,
    dashboardSettings,
    isLoading,
    DEFAULT_SPECTROGRAM_SETTINGS,
  } from '$lib/stores/settings';
  import type { SpectrogramPreRender } from '$lib/stores/settings';
  import { api, ApiError } from '$lib/utils/api';
  import { toastActions } from '$lib/stores/toast';
  import MobileNumberInput from '../../../components/forms/MobileNumberInput.svelte';
  import MobileSelect from '../../../components/forms/MobileSelect.svelte';
  import MobileToggle from '../../../components/forms/MobileToggle.svelte';

  // Auto-save state
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  let saveStatus = $state<'idle' | 'pending' | 'saving' | 'saved'>('idle');

  function debouncedSave() {
    // Clear any existing timeout
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveStatus = 'pending';

    // Set new timeout for 800ms debounce
    saveTimeout = setTimeout(async () => {
      saveStatus = 'saving';
      await settingsActions.saveSettings();
      saveStatus = 'saved';

      // Reset to idle after showing "saved" briefly
      setTimeout(() => {
        saveStatus = 'idle';
      }, 1500);
    }, 800);
  }

  // Load settings on mount to ensure data is available before saving
  onMount(() => {
    settingsActions.loadSettings();
  });

  // Reactive settings with proper defaults - spread $dashboardSettings first to preserve all store values
  let settings = $derived({
    dashboard: {
      ...($dashboardSettings ?? {
        thumbnails: {
          summary: true,
          recent: true,
          imageProvider: 'wikimedia',
          fallbackPolicy: 'all',
        },
        summaryLimit: 100,
        newUI: false,
      }),
      locale: $dashboardSettings?.locale ?? (getLocale() as string),
      newUI: $dashboardSettings?.newUI ?? false,
      spectrogram: $dashboardSettings?.spectrogram ?? DEFAULT_SPECTROGRAM_SETTINGS,
    },
  });

  let store = $derived($settingsStore);

  // UI locales
  const uiLocales = Object.entries(LOCALES).map(([code, info]) => ({
    value: code,
    label: `${info.flag} ${info.name}`,
  }));

  // Image provider options
  interface ApiState<T> {
    loading: boolean;
    error: string | null;
    data: T;
  }

  let providerOptions = $state<ApiState<Array<{ value: string; label: string }>>>({
    loading: true,
    error: null,
    data: [],
  });

  let multipleProvidersAvailable = $derived(providerOptions.data.length > 1);

  // Load image providers
  $effect(() => {
    loadImageProviders();
  });

  async function loadImageProviders() {
    providerOptions.loading = true;
    providerOptions.error = null;

    try {
      const providersData = await api.get<{
        providers?: Array<{ value: string; display: string }>;
      }>('/api/v2/settings/imageproviders');

      providerOptions.data = (providersData?.providers || []).map(
        (provider: { value: string; display: string }) => ({
          value: provider.value,
          label: provider.display,
        })
      );
    } catch (error) {
      if (error instanceof ApiError) {
        toastActions.warning(t('settings.main.errors.providersLoadFailed'));
      }
      providerOptions.error = t('settings.main.errors.providersLoadFailed');
      providerOptions.data = [{ value: 'wikipedia', label: 'Wikipedia' }];
    } finally {
      providerOptions.loading = false;
    }
  }

  // Update handlers - all trigger debounced auto-save
  function updateDashboardSetting(key: string, value: string | number | boolean) {
    settingsActions.updateSection('realtime', {
      dashboard: { ...settings.dashboard, [key]: value },
    });
    debouncedSave();
  }

  function updateThumbnailSetting(key: string, value: string | boolean) {
    settingsActions.updateSection('realtime', {
      dashboard: {
        ...settings.dashboard,
        thumbnails: { ...settings.dashboard.thumbnails, [key]: value },
      },
    });
    debouncedSave();
  }

  function updateSpectrogramSetting(key: keyof SpectrogramPreRender, value: boolean | string) {
    settingsActions.updateSection('realtime', {
      dashboard: {
        ...settings.dashboard,
        spectrogram: { ...settings.dashboard.spectrogram, [key]: value },
      },
    });
    debouncedSave();
  }

  function updateUILocale(locale: string) {
    settingsActions.updateSection('realtime', {
      dashboard: { ...settings.dashboard, locale },
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
    <!-- Interface Settings -->
  <div class="space-y-4">
    <h2 class="text-lg font-semibold">
      {t('settings.main.sections.userInterface.interface.title')}
    </h2>

    <MobileToggle
      label={t('settings.main.sections.userInterface.interface.newUI.label')}
      checked={settings.dashboard.newUI}
      helpText={t('settings.main.sections.userInterface.interface.newUI.helpText')}
      disabled={store.isLoading || store.isSaving}
      onchange={value => updateDashboardSetting('newUI', value)}
    />

    <MobileSelect
      label={t('settings.main.sections.userInterface.interface.locale.label')}
      value={settings.dashboard.locale}
      options={uiLocales}
      helpText={t('settings.main.sections.userInterface.interface.locale.helpText')}
      disabled={store.isLoading || store.isSaving || !settings.dashboard.newUI}
      onchange={updateUILocale}
    />
  </div>

  <!-- Display Settings -->
  <div class="space-y-4">
    <h2 class="text-lg font-semibold">
      {t('settings.main.sections.userInterface.dashboard.displaySettings.title')}
    </h2>

    <MobileNumberInput
      label={t('settings.main.sections.userInterface.dashboard.summaryLimit.label')}
      value={settings.dashboard.summaryLimit}
      min={10}
      max={1000}
      helpText={t('settings.main.sections.userInterface.dashboard.summaryLimit.helpText')}
      disabled={store.isLoading || store.isSaving}
      onUpdate={value => updateDashboardSetting('summaryLimit', value)}
    />
  </div>

  <!-- Bird Images -->
  <div class="space-y-4">
    <h2 class="text-lg font-semibold">
      {t('settings.main.sections.userInterface.dashboard.birdImages.title')}
    </h2>

    <MobileToggle
      label={t('settings.main.sections.userInterface.dashboard.thumbnails.summary.label')}
      checked={settings.dashboard.thumbnails.summary}
      helpText={t('settings.main.sections.userInterface.dashboard.thumbnails.summary.helpText')}
      disabled={store.isLoading || store.isSaving}
      onchange={value => updateThumbnailSetting('summary', value)}
    />

    <MobileToggle
      label={t('settings.main.sections.userInterface.dashboard.thumbnails.recent.label')}
      checked={settings.dashboard.thumbnails.recent}
      helpText={t('settings.main.sections.userInterface.dashboard.thumbnails.recent.helpText')}
      disabled={store.isLoading || store.isSaving}
      onchange={value => updateThumbnailSetting('recent', value)}
    />

    <MobileSelect
      label={t('settings.main.sections.userInterface.dashboard.thumbnails.imageProvider.label')}
      value={settings.dashboard.thumbnails.imageProvider}
      options={providerOptions.data}
      helpText={t(
        'settings.main.sections.userInterface.dashboard.thumbnails.imageProvider.helpText'
      )}
      disabled={store.isLoading ||
        store.isSaving ||
        !multipleProvidersAvailable ||
        providerOptions.loading}
      onchange={value => updateThumbnailSetting('imageProvider', value)}
    />

    {#if multipleProvidersAvailable}
      <MobileSelect
        label={t('settings.main.sections.userInterface.dashboard.thumbnails.fallbackPolicy.label')}
        value={settings.dashboard.thumbnails.fallbackPolicy}
        options={[
          {
            value: 'all',
            label: t(
              'settings.main.sections.userInterface.dashboard.thumbnails.fallbackPolicy.options.all'
            ),
          },
          {
            value: 'none',
            label: t(
              'settings.main.sections.userInterface.dashboard.thumbnails.fallbackPolicy.options.none'
            ),
          },
        ]}
        helpText={t(
          'settings.main.sections.userInterface.dashboard.thumbnails.fallbackPolicy.helpText'
        )}
        disabled={store.isLoading || store.isSaving}
        onchange={value => updateThumbnailSetting('fallbackPolicy', value)}
      />
    {/if}
  </div>

  <!-- Spectrogram Generation -->
  <div class="space-y-4">
    <h2 class="text-lg font-semibold">
      {t('settings.main.sections.userInterface.dashboard.spectrogramGeneration.title')}
    </h2>

    <MobileSelect
      label={t('settings.main.sections.userInterface.dashboard.spectrogram.mode.label')}
      value={settings.dashboard.spectrogram?.mode ?? 'auto'}
      options={[
        {
          value: 'auto',
          label: t('settings.main.sections.userInterface.dashboard.spectrogram.mode.auto.label'),
        },
        {
          value: 'prerender',
          label: t(
            'settings.main.sections.userInterface.dashboard.spectrogram.mode.prerender.label'
          ),
        },
        {
          value: 'user-requested',
          label: t(
            'settings.main.sections.userInterface.dashboard.spectrogram.mode.userRequested.label'
          ),
        },
      ]}
      disabled={store.isLoading || store.isSaving}
      onchange={value => updateSpectrogramSetting('mode', value)}
    />

    <!-- Mode-specific help text -->
    {#if (settings.dashboard.spectrogram?.mode ?? 'auto') === 'auto'}
      <div class="alert alert-info text-sm">
        <span>
          {t('settings.main.sections.userInterface.dashboard.spectrogram.mode.auto.helpText')}
        </span>
      </div>
    {:else if (settings.dashboard.spectrogram?.mode ?? 'auto') === 'prerender'}
      <div class="alert alert-info text-sm">
        <span>
          {t('settings.main.sections.userInterface.dashboard.spectrogram.mode.prerender.helpText')}
        </span>
      </div>
    {:else if (settings.dashboard.spectrogram?.mode ?? 'auto') === 'user-requested'}
      <div class="alert alert-info text-sm">
        <span>
          {t(
            'settings.main.sections.userInterface.dashboard.spectrogram.mode.userRequested.helpText'
          )}
        </span>
      </div>
    {/if}
  </div>
  </div>

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
{/if}
