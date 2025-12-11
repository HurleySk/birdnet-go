<!--
  Mobile Species Settings Page Component

  Purpose: Configure species-specific settings for mobile including always include/exclude
  lists and custom configurations with thresholds and intervals.

  Features:
  - Always include species list management
  - Always exclude species list management
  - Custom species configurations
  - Add/remove species with simple interface

  Mobile optimizations:
  - 44px minimum touch targets
  - Sticky save button at bottom
  - Single column layout
  - Simplified species configuration (no inline actions editor)
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '$lib/i18n';
  import {
    settingsStore,
    settingsActions,
    speciesSettings,
    realtimeSettings,
    isLoading,
  } from '$lib/stores/settings';
  import type { SpeciesConfig, SpeciesSettings } from '$lib/stores/settings';
  import MobileTextInput from '../../../components/forms/MobileTextInput.svelte';
  import MobileNumberInput from '../../../components/forms/MobileNumberInput.svelte';
  import MobileSlider from '../../../components/forms/MobileSlider.svelte';
  import { toastActions } from '$lib/stores/toast';

  // Helper function to check if a value is a plain object
  function isPlainObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  // Reactive settings with proper defaults
  let settings = $derived(
    (() => {
      const base = $speciesSettings ?? {
        include: [] as string[],
        exclude: [] as string[],
        config: {} as Record<string, SpeciesConfig>,
      };

      return {
        include: base.include ?? [],
        exclude: base.exclude ?? [],
        config: isPlainObject(base.config) ? base.config : {},
      } as SpeciesSettings;
    })()
  );

  let store = $derived($settingsStore);

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

  onMount(() => {
    settingsActions.loadSettings();
  });

  // Input values
  let includeInputValue = $state('');
  let excludeInputValue = $state('');
  let configInputValue = $state('');
  let newThreshold = $state(0.5);
  let newInterval = $state(0);

  // Species management functions
  function addIncludeSpecies() {
    const species = includeInputValue.trim();
    if (!species || settings.include.includes(species)) {
      if (settings.include.includes(species)) {
        toastActions.warning('Species is already in the list');
      }
      return;
    }

    const updatedSpecies = [...settings.include, species];
    settingsActions.updateSection('realtime', {
      ...$realtimeSettings,
      species: {
        ...settings,
        include: updatedSpecies,
      },
    });
    includeInputValue = '';
    debouncedSave();
  }

  function removeIncludeSpecies(species: string) {
    const updatedSpecies = settings.include.filter(s => s !== species);
    settingsActions.updateSection('realtime', {
      ...$realtimeSettings,
      species: {
        ...settings,
        include: updatedSpecies,
      },
    });
    debouncedSave();
  }

  function addExcludeSpecies() {
    const species = excludeInputValue.trim();
    if (!species || settings.exclude.includes(species)) {
      if (settings.exclude.includes(species)) {
        toastActions.warning('Species is already in the list');
      }
      return;
    }

    const updatedSpecies = [...settings.exclude, species];
    settingsActions.updateSection('realtime', {
      ...$realtimeSettings,
      species: {
        ...settings,
        exclude: updatedSpecies,
      },
    });
    excludeInputValue = '';
    debouncedSave();
  }

  function removeExcludeSpecies(species: string) {
    const updatedSpecies = settings.exclude.filter(s => s !== species);
    settingsActions.updateSection('realtime', {
      ...$realtimeSettings,
      species: {
        ...settings,
        exclude: updatedSpecies,
      },
    });
    debouncedSave();
  }

  function removeConfig(species: string) {
    const newConfig = Object.fromEntries(
      Object.entries(settings.config).filter(([key]) => key !== species)
    );
    settingsActions.updateSection('realtime', {
      ...$realtimeSettings,
      species: {
        ...settings,
        config: newConfig,
      },
    });
    debouncedSave();
  }

  async function addConfig() {
    const species = configInputValue.trim();
    if (!species) {
      toastActions.error('Please enter a species name');
      return;
    }

    const threshold = Number(newThreshold);
    if (threshold < 0 || threshold > 1) {
      toastActions.error('Threshold must be between 0 and 1');
      return;
    }

    const interval = Number(newInterval) || 0;

    let updatedConfig = { ...settings.config };

    // Check if species already exists
    if (species in updatedConfig) {
      toastActions.error(
        `Species "${species}" already has a configuration. Remove it first to add a new one.`
      );
      return;
    }

    // eslint-disable-next-line security/detect-object-injection -- species is controlled component state
    updatedConfig[species] = {
      threshold,
      interval,
      actions: [],
    };

    try {
      settingsActions.updateSection('realtime', {
        ...$realtimeSettings,
        species: {
          ...settings,
          config: updatedConfig,
        },
      });

      await settingsActions.saveSettings();

      toastActions.success(`Added configuration for "${species}"`);

      // Reset form
      configInputValue = '';
      newThreshold = 0.5;
      newInterval = 0;
    } catch {
      toastActions.error(`Failed to save configuration for "${species}". Please try again.`);
    }
  }

</script>

{#if $isLoading}
  <div class="flex items-center justify-center p-8">
    <span class="loading loading-spinner loading-lg text-primary"></span>
  </div>
{:else}
<div class="flex flex-col gap-6 p-4 pb-24 overflow-x-hidden">
  <!-- Always Include Species -->
  <div class="space-y-4">
    <div>
      <h2 class="text-lg font-semibold">{t('settings.species.alwaysInclude.title')}</h2>
      <p class="text-sm text-base-content/60 mt-1">
        {t('settings.species.alwaysInclude.description')}
      </p>
    </div>

    <!-- Species list -->
    <div class="space-y-2">
      {#each settings.include as species (species)}
        <div class="flex items-center justify-between p-3 rounded-lg bg-base-200">
          <span class="text-sm">{species}</span>
          <button
            type="button"
            class="btn btn-ghost btn-sm text-error"
            onclick={() => removeIncludeSpecies(species)}
            disabled={store.isLoading || store.isSaving}
            aria-label="Remove {species}"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      {/each}

      {#if settings.include.length === 0}
        <div class="text-sm text-base-content/60 italic p-3 text-center">
          {t('settings.species.alwaysInclude.noSpeciesMessage')}
        </div>
      {/if}
    </div>

    <!-- Add species input -->
    <div class="flex gap-2">
      <div class="flex-1">
        <MobileTextInput
          label={t('settings.species.addSpeciesToIncludeLabel')}
          bind:value={includeInputValue}
          placeholder={t('settings.species.addSpeciesToInclude')}
          disabled={store.isLoading || store.isSaving}
        />
      </div>
      <button
        type="button"
        class="btn btn-primary self-end h-12 px-6"
        onclick={addIncludeSpecies}
        disabled={!includeInputValue.trim() || store.isLoading || store.isSaving}
      >
        {t('settings.species.customConfiguration.labels.addButton')}
      </button>
    </div>
  </div>

  <!-- Always Exclude Species -->
  <div class="space-y-4">
    <div>
      <h2 class="text-lg font-semibold">{t('settings.species.alwaysExclude.title')}</h2>
      <p class="text-sm text-base-content/60 mt-1">
        {t('settings.species.alwaysExclude.description')}
      </p>
    </div>

    <!-- Species list -->
    <div class="space-y-2">
      {#each settings.exclude as species (species)}
        <div class="flex items-center justify-between p-3 rounded-lg bg-base-200">
          <span class="text-sm">{species}</span>
          <button
            type="button"
            class="btn btn-ghost btn-sm text-error"
            onclick={() => removeExcludeSpecies(species)}
            disabled={store.isLoading || store.isSaving}
            aria-label="Remove {species}"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      {/each}

      {#if settings.exclude.length === 0}
        <div class="text-sm text-base-content/60 italic p-3 text-center">
          {t('settings.species.alwaysExclude.noSpeciesMessage')}
        </div>
      {/if}
    </div>

    <!-- Add species input -->
    <div class="flex gap-2">
      <div class="flex-1">
        <MobileTextInput
          label={t('settings.species.addSpeciesToExcludeLabel')}
          bind:value={excludeInputValue}
          placeholder={t('settings.species.addSpeciesToExclude')}
          disabled={store.isLoading || store.isSaving}
        />
      </div>
      <button
        type="button"
        class="btn btn-primary self-end h-12 px-6"
        onclick={addExcludeSpecies}
        disabled={!excludeInputValue.trim() || store.isLoading || store.isSaving}
      >
        {t('settings.species.customConfiguration.labels.addButton')}
      </button>
    </div>
  </div>

  <!-- Custom Configuration -->
  <div class="space-y-4">
    <div>
      <h2 class="text-lg font-semibold">{t('settings.species.customConfiguration.title')}</h2>
      <p class="text-sm text-base-content/60 mt-1">
        {t('settings.species.customConfiguration.description')}
      </p>
    </div>

    <!-- Existing configurations -->
    <div class="space-y-2">
      {#each Object.entries(settings.config) as [species, config] (species)}
        <div class="p-3 rounded-lg bg-base-200 space-y-2">
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <p class="font-medium">{species}</p>
              <div class="text-xs text-base-content/60 mt-1 space-y-1">
                <p>
                  {t('settings.species.customConfiguration.list.threshold')}:
                  <span class="font-mono">{(config.threshold ?? 0).toFixed(2)}</span>
                </p>
                <p>
                  {t('settings.species.customConfiguration.list.interval')}:
                  <span class="font-mono">
                    {config.interval > 0
                      ? `${config.interval}s`
                      : t('settings.species.customConfiguration.list.intervalNone')}
                  </span>
                </p>
              </div>
            </div>
            <button
              type="button"
              class="btn btn-ghost btn-sm text-error"
              onclick={() => removeConfig(species)}
              disabled={store.isLoading || store.isSaving}
              aria-label="Remove {species}"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        </div>
      {/each}

      {#if Object.keys(settings.config).length === 0}
        <div class="text-sm text-base-content/60 italic p-3 text-center">
          {t('settings.species.customConfiguration.emptyState.description')}
        </div>
      {/if}
    </div>

    <!-- Add configuration form -->
    <div class="card bg-base-100 border border-base-300">
      <div class="card-body p-4 space-y-4">
        <h3 class="font-medium">{t('settings.species.customConfiguration.newConfiguration')}</h3>

        <MobileTextInput
          label={t('settings.species.customConfiguration.columnHeaders.species')}
          bind:value={configInputValue}
          placeholder={t('settings.species.customConfiguration.searchPlaceholder')}
          disabled={store.isLoading || store.isSaving}
        />

        <MobileSlider
          label={t('settings.species.customConfiguration.labels.threshold')}
          bind:value={newThreshold}
          min={0}
          max={1}
          step={0.01}
          disabled={store.isLoading || store.isSaving}
          onUpdate={value => (newThreshold = value)}
        />

        <MobileNumberInput
          label={t('settings.species.customConfiguration.labels.intervalSeconds')}
          bind:value={newInterval}
          min={0}
          max={3600}
          disabled={store.isLoading || store.isSaving}
          onUpdate={value => (newInterval = value)}
        />

        <button
          type="button"
          class="btn btn-primary w-full h-12"
          onclick={addConfig}
          disabled={!configInputValue.trim() ||
            newThreshold < 0 ||
            newThreshold > 1 ||
            store.isLoading ||
            store.isSaving}
        >
          {#if store.isSaving}
            <span class="loading loading-spinner loading-sm"></span>
          {/if}
          {t('settings.species.customConfiguration.labels.addButton')}
        </button>
      </div>
    </div>
  </div>
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
