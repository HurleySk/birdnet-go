<script lang="ts">
  /* eslint-disable no-unused-vars -- $bindable() props are used in template bind: directives */
  interface Props {
    id?: string;
    label: string;
    value: string;
    placeholder?: string;
    type?: 'text' | 'email' | 'url' | 'password';
    disabled?: boolean;
    error?: string;
    helpText?: string;
    onchange?: (value: string) => void;
  }

  let {
    id = crypto.randomUUID(),
    label,
    value = $bindable(),
    placeholder = '',
    type = 'text',
    disabled = false,
    error,
    helpText,
    onchange,
  }: Props = $props();

  function handleChange(e: Event) {
    const target = e.target as HTMLInputElement;
    value = target.value;
    onchange?.(value);
  }
</script>

<div class="form-control w-full">
  <label class="label" for={id}>
    <span class="label-text font-medium">{label}</span>
  </label>
  <input
    {id}
    {type}
    bind:value
    {placeholder}
    {disabled}
    class="input input-bordered w-full h-12"
    class:input-error={error}
    onchange={handleChange}
  />
  {#if helpText && !error}
    <div class="label">
      <span class="label-text-alt text-base-content/60">{helpText}</span>
    </div>
  {/if}
  {#if error}
    <div class="label">
      <span class="label-text-alt text-error">{error}</span>
    </div>
  {/if}
</div>
