<!--
  Mobile Main Settings Page Component

  Features:
  - Auto-save with 1.5s debounce (Google Docs style)
  - Floating status indicator showing save state
  - Mobile-optimized form controls
-->
<script lang="ts">
  import { t } from '$lib/i18n';
  import { onDestroy, onMount } from 'svelte';
  import { settingsActions, mainSettings, birdnetSettings, isLoading } from '$lib/stores/settings';
  import {
    MobileTextInput,
    MobileNumberInput,
    MobileSlider,
    MobileSelect,
  } from '../../../components/forms';

  // Auto-save state
  type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';
  let saveStatus = $state<SaveStatus>('idle');
  let saveTimeout: ReturnType<typeof setTimeout> | undefined;
  let statusTimeout: ReturnType<typeof setTimeout> | undefined;

  let settings = $derived({
    main: $mainSettings ?? { name: '' },
    birdnet: $birdnetSettings ?? {
      sensitivity: 1.0,
      threshold: 0.8,
      overlap: 0.0,
      locale: 'en',
      threads: 0,
    },
  });

  const localeOptions = [
    { value: 'en', label: 'English' },
    { value: 'de', label: 'Deutsch' },
    { value: 'es', label: 'Español' },
    { value: 'fr', label: 'Français' },
  ];

  // Debounced auto-save
  function scheduleAutoSave() {
    clearTimeout(saveTimeout);
    clearTimeout(statusTimeout);
    saveStatus = 'pending';

    saveTimeout = setTimeout(async () => {
      saveStatus = 'saving';
      try {
        await settingsActions.saveSettings();
        saveStatus = 'saved';
        // Hide "Saved" after 2 seconds
        statusTimeout = setTimeout(() => {
          saveStatus = 'idle';
        }, 2000);
      } catch {
        saveStatus = 'error';
      }
    }, 1500);
  }

  function updateNodeName(name: string) {
    settingsActions.updateSection('main', { name });
    scheduleAutoSave();
  }

  function updateBirdnetSetting(key: string, value: number | string) {
    settingsActions.updateSection('birdnet', { [key]: value });
    scheduleAutoSave();
  }

  // Manual retry for errors
  async function retrySave() {
    saveStatus = 'saving';
    try {
      await settingsActions.saveSettings();
      saveStatus = 'saved';
      statusTimeout = setTimeout(() => {
        saveStatus = 'idle';
      }, 2000);
    } catch {
      saveStatus = 'error';
    }
  }

  // Load settings on mount (ensures store is populated before edits)
  onMount(() => {
    settingsActions.loadSettings();
  });

  // Cleanup timeouts on unmount
  onDestroy(() => {
    clearTimeout(saveTimeout);
    clearTimeout(statusTimeout);
  });
</script>

{#if $isLoading}
  <div class="flex items-center justify-center p-8">
    <span class="loading loading-spinner loading-lg text-primary"></span>
  </div>
{:else}
  <div class="flex flex-col gap-6 p-4 pb-20">
    <!-- Node Settings -->
    <div class="space-y-4">
      <h2 class="text-lg font-semibold">{t('settings.main.sections.main.title')}</h2>
      <MobileTextInput
        label={t('settings.main.fields.nodeName.label')}
        value={settings.main.name}
        helpText={t('settings.main.fields.nodeName.helpText')}
        onchange={updateNodeName}
      />
    </div>

    <!-- BirdNET Settings -->
    <div class="space-y-4">
      <h2 class="text-lg font-semibold">{t('settings.main.sections.birdnet.title')}</h2>

      <MobileSlider
        label={t('settings.main.fields.sensitivity.label')}
        value={settings.birdnet.sensitivity}
        min={0}
        max={1.5}
        step={0.1}
        helpText={t('settings.main.fields.sensitivity.helpText')}
        onUpdate={v => updateBirdnetSetting('sensitivity', v)}
      />

      <MobileSlider
        label={t('settings.main.fields.threshold.label')}
        value={settings.birdnet.threshold}
        min={0}
        max={1}
        step={0.05}
        helpText={t('settings.main.fields.threshold.helpText')}
        onUpdate={v => updateBirdnetSetting('threshold', v)}
      />

      <MobileSlider
        label={t('settings.main.fields.overlap.label')}
        value={settings.birdnet.overlap}
        min={0}
        max={2.9}
        step={0.1}
        suffix="s"
        helpText={t('settings.main.fields.overlap.helpText')}
        onUpdate={v => updateBirdnetSetting('overlap', v)}
      />

      <MobileSelect
        label={t('settings.main.fields.locale.label')}
        value={settings.birdnet.locale}
        options={localeOptions}
        helpText={t('settings.main.fields.locale.helpText')}
        onchange={v => updateBirdnetSetting('locale', v)}
      />

      <MobileNumberInput
        label={t('settings.main.fields.tensorflowThreads.label')}
        value={settings.birdnet.threads}
        min={0}
        max={16}
        step={1}
        helpText={t('settings.main.fields.tensorflowThreads.helpText')}
        onUpdate={v => updateBirdnetSetting('threads', v)}
      />
    </div>
  </div>
{/if}

<!-- Floating auto-save status indicator -->
{#if saveStatus !== 'idle'}
  <div
    class="fixed bottom-4 left-4 right-4 flex items-center justify-center"
    role="status"
    aria-live="polite"
  >
    <div
      class="flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg backdrop-blur-sm transition-all duration-300
        {saveStatus === 'pending' ? 'bg-base-200/90 text-base-content/70' : ''}
        {saveStatus === 'saving' ? 'bg-primary/90 text-primary-content' : ''}
        {saveStatus === 'saved' ? 'bg-success/90 text-success-content' : ''}
        {saveStatus === 'error' ? 'bg-error/90 text-error-content' : ''}"
    >
      {#if saveStatus === 'pending'}
        <span class="w-2 h-2 rounded-full bg-current animate-pulse"></span>
        <span class="text-sm font-medium">{t('settings.actions.unsavedChanges')}</span>
      {:else if saveStatus === 'saving'}
        <span class="loading loading-spinner loading-xs"></span>
        <span class="text-sm font-medium">{t('settings.actions.saving')}</span>
      {:else if saveStatus === 'saved'}
        <svg
          class="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2.5"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <span class="text-sm font-medium">{t('settings.actions.saved')}</span>
      {:else if saveStatus === 'error'}
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <span class="text-sm font-medium">{t('settings.actions.saveFailed')}</span>
        <button
          class="ml-1 px-2 py-0.5 text-xs font-semibold rounded bg-error-content/20 hover:bg-error-content/30 transition-colors"
          onclick={retrySave}
        >
          Retry
        </button>
      {/if}
    </div>
  </div>
{/if}
