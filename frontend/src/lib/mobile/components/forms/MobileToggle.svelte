<script lang="ts">
  /* eslint-disable no-unused-vars -- $bindable() props are used in template bind: directives */
  interface Props {
    id?: string;
    label: string;
    checked: boolean;
    disabled?: boolean;
    helpText?: string;
    helpTextHtml?: boolean;
    onchange?: (checked: boolean) => void;
  }

  let {
    id = crypto.randomUUID(),
    label,
    checked = $bindable(),
    disabled = false,
    helpText,
    helpTextHtml = false,
    onchange,
  }: Props = $props();

  function handleChange() {
    // Note: checked is already updated by bind:checked before this runs
    onchange?.(checked);
  }
</script>

<div class="form-control w-full">
  <label class="label cursor-pointer justify-between py-4" for={id}>
    <div class="flex flex-col gap-1 mr-4">
      <span class="label-text font-medium">{label}</span>
      {#if helpText}
        <span class="label-text-alt text-base-content/60">
          {#if helpTextHtml}
            {@html helpText}
          {:else}
            {helpText}
          {/if}
        </span>
      {/if}
    </div>
    <div class="shrink-0">
      <input
        {id}
        type="checkbox"
        class="toggle toggle-primary"
        bind:checked
        {disabled}
        onchange={handleChange}
      />
    </div>
  </label>
</div>
