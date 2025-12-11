<!--
  Mobile Filter Settings Page Component

  Purpose: Mobile version of filtering settings for BirdNET-Go including privacy
  filters and false positive prevention (dog bark filter) with species-specific rules.

  Features:
  - Privacy filter configuration with confidence threshold
  - False positive prevention (dog bark filter) with species management
  - Dynamic species list with add/remove functionality
  - Confidence threshold and retention time settings
  - Mobile-optimized 44px touch targets

  @component
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '$lib/i18n';
  import {
    settingsStore,
    settingsActions,
    privacyFilterSettings,
    dogBarkFilterSettings,
    realtimeSettings,
    isLoading,
  } from '$lib/stores/settings';
  import {
    MobileNumberInput,
    MobileSlider,
    MobileToggle,
    MobileTextInput,
  } from '../../../components/forms';
  import { api, ApiError } from '$lib/utils/api';
  import { loggers } from '$lib/utils/logger';
  import { Trash2 } from '@lucide/svelte';

  const logger = loggers.settings;

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
      const privacyBase = $privacyFilterSettings ?? {
        enabled: false,
        confidence: 0.5,
        debug: false,
      };

      const dogBarkBase = $dogBarkFilterSettings ?? {
        enabled: false,
        confidence: 0.5,
        remember: 30,
        debug: false,
        species: [],
      };

      return {
        privacy: privacyBase,
        dogBark: {
          ...dogBarkBase,
          species: dogBarkBase.species ?? [],
        },
      };
    })()
  );

  // Species management state
  interface ApiState<T> {
    loading: boolean;
    error: string | null;
    data: T;
  }

  interface SpeciesListResponse {
    species?: Array<{ label: string }>;
  }

  let speciesListState = $state<ApiState<string[]>>({
    loading: true,
    error: null,
    data: [],
  });

  let newSpecies = $state('');
  let showSpeciesInput = $state(false);

  // Load species list
  $effect(() => {
    loadSpeciesList();
  });

  async function loadSpeciesList() {
    speciesListState.loading = true;
    speciesListState.error = null;

    try {
      const data = await api.get<SpeciesListResponse>('/api/v2/range/species/list');
      if (data?.species && Array.isArray(data.species)) {
        speciesListState.data = data.species.map((species: { label: string }) => species.label);
      } else {
        speciesListState.data = [];
      }
    } catch (error) {
      if (error instanceof ApiError) {
        logger.warn('Failed to load species list for filtering', error, {
          component: 'MobileFilterSettingsPage',
          action: 'loadSpeciesList',
        });
      }
      speciesListState.error = t('settings.filters.errors.speciesLoadFailed');
      speciesListState.data = [];
    } finally {
      speciesListState.loading = false;
    }
  }

  // Privacy filter update handlers - all trigger debounced auto-save
  function updatePrivacyEnabled(enabled: boolean) {
    settingsActions.updateSection('realtime', {
      ...$realtimeSettings,
      privacyFilter: { ...settings.privacy, enabled },
    });
    debouncedSave();
  }

  function updatePrivacyConfidence(confidence: number) {
    settingsActions.updateSection('realtime', {
      ...$realtimeSettings,
      privacyFilter: { ...settings.privacy, confidence },
    });
    debouncedSave();
  }

  // Dog bark filter update handlers
  function updateDogBarkEnabled(enabled: boolean) {
    settingsActions.updateSection('realtime', {
      ...$realtimeSettings,
      dogBarkFilter: { ...settings.dogBark, enabled },
    });
    debouncedSave();
  }

  function updateDogBarkConfidence(confidence: number) {
    settingsActions.updateSection('realtime', {
      ...$realtimeSettings,
      dogBarkFilter: { ...settings.dogBark, confidence },
    });
    debouncedSave();
  }

  function updateDogBarkRemember(remember: number) {
    settingsActions.updateSection('realtime', {
      ...$realtimeSettings,
      dogBarkFilter: { ...settings.dogBark, remember },
    });
    debouncedSave();
  }

  // Species management functions
  function handleAddSpeciesClick() {
    showSpeciesInput = true;
  }

  function addSpecies() {
    if (!newSpecies.trim()) return;

    const trimmedSpecies = newSpecies.trim();
    if (settings.dogBark.species.includes(trimmedSpecies)) {
      newSpecies = '';
      return;
    }

    const updatedSpecies = [...settings.dogBark.species, trimmedSpecies];
    settingsActions.updateSection('realtime', {
      ...$realtimeSettings,
      dogBarkFilter: { ...settings.dogBark, species: updatedSpecies },
    });

    newSpecies = '';
    showSpeciesInput = false;
    debouncedSave();
  }

  function removeSpecies(index: number) {
    const updatedSpecies = settings.dogBark.species.filter((_: string, i: number) => i !== index);
    settingsActions.updateSection('realtime', {
      ...$realtimeSettings,
      dogBarkFilter: { ...settings.dogBark, species: updatedSpecies },
    });
    debouncedSave();
  }

  function cancelAddSpecies() {
    newSpecies = '';
    showSpeciesInput = false;
  }

  // Filtered species list for autocomplete
  let filteredSpecies = $derived(
    newSpecies
      ? speciesListState.data.filter(s => s.toLowerCase().includes(newSpecies.toLowerCase()))
      : speciesListState.data
  );
</script>

{#if $isLoading}
  <div class="flex items-center justify-center p-8">
    <span class="loading loading-spinner loading-lg text-primary"></span>
  </div>
{:else}
<div class="flex flex-col gap-6 p-4 pb-24 overflow-x-hidden">
  <!-- Privacy Filter -->
  <div class="space-y-4">
    <h2 class="text-lg font-semibold">{t('settings.filters.privacyFiltering.title')}</h2>
    <p class="text-sm text-base-content/60">
      {t('settings.filters.privacyFiltering.description')}
    </p>
    <MobileToggle
      label={t('settings.filters.privacyFiltering.enable')}
      checked={settings.privacy.enabled}
      disabled={store.isLoading || store.isSaving}
      onchange={updatePrivacyEnabled}
    />
    {#if settings.privacy.enabled}
      <MobileSlider
        label={t('settings.filters.privacyFiltering.confidenceLabel')}
        value={settings.privacy.confidence}
        min={0}
        max={1}
        step={0.01}
        helpText={t('settings.filters.privacyFiltering.confidenceHelp')}
        disabled={!settings.privacy.enabled || store.isLoading || store.isSaving}
        onUpdate={updatePrivacyConfidence}
      />
    {/if}
  </div>

  <!-- Dog Bark Filter -->
  <div class="space-y-4">
    <h2 class="text-lg font-semibold">{t('settings.filters.falsePositivePrevention.title')}</h2>
    <p class="text-sm text-base-content/60">
      {t('settings.filters.falsePositivePrevention.description')}
    </p>
    <MobileToggle
      label={t('settings.filters.falsePositivePrevention.enableDogBark')}
      checked={settings.dogBark.enabled}
      disabled={store.isLoading || store.isSaving}
      onchange={updateDogBarkEnabled}
    />
    {#if settings.dogBark.enabled}
      <MobileSlider
        label={t('settings.filters.falsePositivePrevention.confidenceLabel')}
        value={settings.dogBark.confidence}
        min={0}
        max={1}
        step={0.01}
        helpText={t('settings.filters.falsePositivePrevention.confidenceHelp')}
        disabled={!settings.dogBark.enabled || store.isLoading || store.isSaving}
        onUpdate={updateDogBarkConfidence}
      />
      <MobileNumberInput
        label={t('settings.filters.falsePositivePrevention.expireTimeLabel')}
        value={settings.dogBark.remember}
        min={0}
        step={1}
        suffix=" min"
        helpText={t('settings.filters.falsePositivePrevention.expireTimeHelp')}
        disabled={!settings.dogBark.enabled || store.isLoading || store.isSaving}
        onUpdate={updateDogBarkRemember}
      />

      <!-- Dog Bark Species List -->
      <div class="space-y-3">
        <h3 class="text-sm font-medium">{t('settings.filters.dogBarkSpeciesList')}</h3>

        <!-- Species List -->
        {#if settings.dogBark.species.length > 0}
          <div class="space-y-2">
            {#each settings.dogBark.species as species, index (species)}
              <div
                class="flex items-center justify-between p-3 bg-base-200 rounded-lg min-h-[44px]"
              >
                <span class="text-sm flex-1">{species}</span>
                <button
                  type="button"
                  class="btn btn-ghost btn-sm btn-square min-h-[44px] min-w-[44px]"
                  onclick={() => removeSpecies(index)}
                  disabled={!settings.dogBark.enabled || store.isLoading || store.isSaving}
                  aria-label={t('common.aria.removeSpecies')}
                >
                  <Trash2 class="size-5" />
                </button>
              </div>
            {/each}
          </div>
        {/if}

        <!-- Add Species Button / Input -->
        {#if !showSpeciesInput}
          <button
            type="button"
            class="btn btn-outline w-full h-12"
            onclick={handleAddSpeciesClick}
            disabled={!settings.dogBark.enabled || store.isLoading || store.isSaving}
          >
            {t('settings.filters.falsePositivePrevention.addSpeciesButton')}
          </button>
        {:else}
          <div class="space-y-2">
            <MobileTextInput
              label={t('settings.filters.falsePositivePrevention.addDogBarkSpeciesLabel')}
              value={newSpecies}
              placeholder={t('settings.filters.typeSpeciesName')}
              helpText={t('settings.filters.falsePositivePrevention.addDogBarkSpeciesHelp')}
              disabled={!settings.dogBark.enabled ||
                store.isLoading ||
                store.isSaving ||
                speciesListState.loading}
              onchange={v => (newSpecies = v)}
            />

            <!-- Species suggestions -->
            {#if newSpecies && filteredSpecies.length > 0}
              <div class="bg-base-200 rounded-lg max-h-48 overflow-y-auto">
                {#each filteredSpecies.slice(0, 5) as species (species)}
                  <button
                    type="button"
                    class="w-full text-left px-4 py-3 hover:bg-base-300 transition-colors min-h-[44px]"
                    onclick={() => {
                      newSpecies = species;
                      addSpecies();
                    }}
                  >
                    {species}
                  </button>
                {/each}
              </div>
            {/if}

            <div class="flex gap-2">
              <button
                type="button"
                class="btn btn-primary flex-1 h-12"
                onclick={addSpecies}
                disabled={!newSpecies.trim() ||
                  !settings.dogBark.enabled ||
                  store.isLoading ||
                  store.isSaving}
              >
                {t('common.actions.add')}
              </button>
              <button
                type="button"
                class="btn btn-ghost flex-1 h-12"
                onclick={cancelAddSpecies}
                disabled={store.isLoading || store.isSaving}
              >
                {t('common.actions.cancel')}
              </button>
            </div>
          </div>
        {/if}
      </div>
    {/if}
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
