<!--
  MobileSpeciesInput - Touch-optimized species search with autocomplete

  Features:
  - Autocomplete dropdown with smooth animations
  - Touch-friendly 44px+ tap targets
  - Keyboard support (Enter to add, Escape to close)
  - Accessible with proper ARIA attributes
  - Integrates with existing mobile form patterns

  @component
-->
<script lang="ts">
  import { t } from '$lib/i18n';
  import { Plus, Search, X } from '@lucide/svelte';

  interface Props {
    id?: string;
    label: string;
    value?: string;
    placeholder?: string;
    helpText?: string;
    disabled?: boolean;
    predictions?: string[];
    maxPredictions?: number;
    minCharsForPredictions?: number;
    onAdd?: (_value: string) => void;
  }

  let {
    id = crypto.randomUUID(),
    label,
    value = $bindable(''),
    placeholder = '',
    helpText,
    disabled = false,
    predictions = [],
    maxPredictions = 8,
    minCharsForPredictions = 2,
    onAdd,
  }: Props = $props();

  let showDropdown = $state(false);
  let inputElement: HTMLInputElement | undefined = $state();

  // Parse species name from database format: "Scientific Name_Common Name"
  function parseSpeciesName(raw: string): { common: string; scientific: string } {
    const parts = raw.split('_');
    if (parts.length >= 2) {
      return {
        scientific: parts[0].trim(),
        common: parts.slice(1).join('_').trim(),
      };
    }
    return { common: raw, scientific: '' };
  }

  // Filter predictions based on current input
  let filteredPredictions = $derived(
    value.length >= minCharsForPredictions && predictions.length > 0
      ? predictions
          .filter(p => p.toLowerCase().includes(value.toLowerCase()) && p !== value)
          .slice(0, maxPredictions)
      : []
  );

  // Show dropdown when there are predictions
  $effect(() => {
    showDropdown = filteredPredictions.length > 0;
  });

  function handleInput(e: Event) {
    const target = e.target as HTMLInputElement;
    value = target.value;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && value.trim()) {
      e.preventDefault();
      handleAdd();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      showDropdown = false;
      inputElement?.blur();
    }
  }

  function handleAdd() {
    if (!value.trim() || disabled) return;
    onAdd?.(value.trim());
    value = '';
    showDropdown = false;
  }

  function selectPrediction(prediction: string) {
    value = prediction;
    showDropdown = false;
    // Auto-add when selecting from dropdown
    setTimeout(() => {
      onAdd?.(prediction);
      value = '';
    }, 50);
  }

  function handleFocus() {
    if (filteredPredictions.length > 0) {
      showDropdown = true;
    }
  }

  function handleBlur(e: FocusEvent) {
    // Delay hiding to allow click on prediction
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget?.closest('.species-dropdown')) {
      setTimeout(() => {
        showDropdown = false;
      }, 150);
    }
  }

  function clearInput() {
    value = '';
    showDropdown = false;
    inputElement?.focus();
  }
</script>

<div class="form-control w-full">
  <label class="label" for={id}>
    <span class="label-text font-medium">{label}</span>
  </label>

  <div class="relative">
    <!-- Search Input with Add Button -->
    <div class="flex gap-2">
      <div class="relative flex-1">
        <!-- Search Icon -->
        <div
          class="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none"
        >
          <Search class="w-5 h-5" />
        </div>

        <input
          bind:this={inputElement}
          {id}
          type="text"
          {value}
          {placeholder}
          {disabled}
          class="input input-bordered w-full h-12 pl-10 pr-10 text-base transition-all duration-200
                 focus:ring-2 focus:ring-primary/20 focus:border-primary"
          oninput={handleInput}
          onkeydown={handleKeydown}
          onfocus={handleFocus}
          onblur={handleBlur}
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          role="combobox"
          aria-expanded={showDropdown}
          aria-haspopup="listbox"
          aria-controls="{id}-listbox"
          aria-label={label}
        />

        <!-- Clear Button -->
        {#if value && !disabled}
          <button
            type="button"
            class="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full
                   text-base-content/40 hover:text-base-content/70 hover:bg-base-200
                   transition-colors duration-150 touch-manipulation"
            onclick={clearInput}
            aria-label="Clear input"
          >
            <X class="w-4 h-4" />
          </button>
        {/if}
      </div>

      <!-- Add Button -->
      <button
        type="button"
        class="btn btn-primary h-12 min-w-[56px] gap-1 shadow-sm
               active:scale-95 transition-transform duration-100"
        onclick={handleAdd}
        disabled={disabled || !value.trim()}
        aria-label={t('common.actions.add')}
      >
        <Plus class="w-5 h-5" />
        <span class="hidden sm:inline">{t('common.actions.add')}</span>
      </button>
    </div>

    <!-- Predictions Dropdown -->
    {#if showDropdown}
      <div
        id="{id}-listbox"
        class="species-dropdown absolute left-0 right-0 top-full mt-1 z-50
               bg-base-100 border border-base-200 rounded-xl shadow-lg
               max-h-64 overflow-y-auto overscroll-contain
               animate-in fade-in slide-in-from-top-2 duration-200"
        role="listbox"
        aria-label="Species suggestions"
      >
        <div class="p-1">
          {#each filteredPredictions as prediction (prediction)}
            {@const parsed = parseSpeciesName(prediction)}
            <button
              type="button"
              class="w-full text-left px-4 py-2.5 rounded-lg min-h-[48px]
                     transition-colors duration-100
                     hover:bg-primary/10 active:bg-primary/20
                     focus:outline-none focus:bg-primary/10
                     touch-manipulation"
              onclick={() => selectPrediction(prediction)}
              role="option"
              aria-selected="false"
              tabindex="-1"
            >
              <div class="text-sm font-medium">
                {@render highlightMatch(parsed.common, value)}
              </div>
              {#if parsed.scientific}
                <div class="text-xs text-base-content/50 italic">
                  {@render highlightMatch(parsed.scientific, value)}
                </div>
              {/if}
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  {#if helpText}
    <div class="label">
      <span class="label-text-alt text-base-content/60">{helpText}</span>
    </div>
  {/if}
</div>

<!-- Highlight matching portion of text -->
{#snippet highlightMatch(text: string, query: string)}
  {@const lowerText = text.toLowerCase()}
  {@const lowerQuery = query.toLowerCase()}
  {@const matchIndex = lowerText.indexOf(lowerQuery)}
  {#if matchIndex >= 0}
    <span>{text.slice(0, matchIndex)}</span><span class="font-semibold text-primary"
      >{text.slice(matchIndex, matchIndex + query.length)}</span
    ><span>{text.slice(matchIndex + query.length)}</span>
  {:else}
    {text}
  {/if}
{/snippet}

<style>
  /* Smooth dropdown animation */
  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slide-in-from-top-2 {
    from {
      transform: translateY(-0.5rem);
    }
    to {
      transform: translateY(0);
    }
  }

  .animate-in {
    animation:
      fade-in 200ms ease-out,
      slide-in-from-top-2 200ms ease-out;
  }

  /* Custom scrollbar for dropdown */
  .species-dropdown::-webkit-scrollbar {
    width: 6px;
  }

  .species-dropdown::-webkit-scrollbar-track {
    background: transparent;
  }

  .species-dropdown::-webkit-scrollbar-thumb {
    background: hsl(var(--bc) / 0.2);
    border-radius: 3px;
  }

  .species-dropdown::-webkit-scrollbar-thumb:hover {
    background: hsl(var(--bc) / 0.3);
  }

  /* Ensure touch targets are adequate */
  .touch-manipulation {
    touch-action: manipulation;
  }
</style>
