<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '$lib/i18n';

  let csrfToken = $derived(
    (document.querySelector('meta[name="csrf-token"]') as HTMLElement)?.getAttribute('content') ||
      ''
  );

  let templateConfig = $state<{
    title: string;
    message: string;
  } | null>(null);
  let loadingTemplate = $state(false);
  let savingTemplate = $state(false);
  let templateStatusMessage = $state('');
  let templateStatusType = $state<'info' | 'success' | 'error'>('info');

  let editedTitle = $state('');
  let editedMessage = $state('');

  let hasUnsavedChanges = $derived(
    templateConfig !== null &&
      (editedTitle !== templateConfig.title || editedMessage !== templateConfig.message)
  );

  let generating = $state(false);
  let statusMessage = $state('');
  let statusType = $state<'info' | 'success' | 'error'>('info');

  const defaultTemplate = {
    title: 'New Species: {{.CommonName}}',
    message:
      '{{.ImageURL}}\n\nFirst detection of {{.CommonName}} ({{.ScientificName}}) with {{.ConfidencePercent}}% confidence at {{.DetectionTime}}.\n\n{{.DetectionURL}}',
  };

  async function loadTemplateConfig() {
    loadingTemplate = true;
    try {
      const response = await fetch('/api/v2/settings/notification');
      if (response.ok) {
        const data = await response.json();
        if (data.templates?.newSpecies) {
          templateConfig = {
            title: data.templates.newSpecies.title ?? defaultTemplate.title,
            message: data.templates.newSpecies.message ?? defaultTemplate.message,
          };
          editedTitle = templateConfig.title;
          editedMessage = templateConfig.message;
        } else {
          templateConfig = { ...defaultTemplate };
          editedTitle = templateConfig.title;
          editedMessage = templateConfig.message;
        }
      }
    } catch {
      templateConfig = { ...defaultTemplate };
      editedTitle = templateConfig.title;
      editedMessage = templateConfig.message;
    } finally {
      loadingTemplate = false;
    }
  }

  async function saveTemplateConfig() {
    savingTemplate = true;
    templateStatusMessage = '';

    try {
      const headers = new Headers({
        'Content-Type': 'application/json',
      });

      if (csrfToken) {
        headers.set('X-CSRF-Token', csrfToken);
      }

      const response = await fetch('/api/v2/settings/notification', {
        method: 'PATCH',
        headers,
        credentials: 'same-origin',
        body: JSON.stringify({
          templates: {
            newSpecies: {
              title: editedTitle,
              message: editedMessage,
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save: ${response.status} ${response.statusText}`);
      }

      if (templateConfig) {
        templateConfig.title = editedTitle;
        templateConfig.message = editedMessage;
      }

      templateStatusMessage = t('settings.notifications.templates.saveSuccess');
      templateStatusType = 'success';

      setTimeout(() => {
        templateStatusMessage = '';
      }, 3000);
    } catch (error) {
      templateStatusMessage = t('settings.notifications.templates.saveError', {
        message: (error as Error).message,
      });
      templateStatusType = 'error';

      setTimeout(() => {
        templateStatusMessage = '';
      }, 5000);
    } finally {
      savingTemplate = false;
    }
  }

  function resetTemplates() {
    const confirmReset = window.confirm(t('settings.notifications.templates.resetConfirm'));
    if (!confirmReset) {
      return;
    }

    editedTitle = defaultTemplate.title;
    editedMessage = defaultTemplate.message;
  }

  async function sendTestNewSpeciesNotification() {
    // Check for unsaved changes
    if (hasUnsavedChanges) {
      const confirmTest = window.confirm(
        t('settings.notifications.templates.unsavedChangesWarning')
      );
      if (!confirmTest) {
        return;
      }
    }

    generating = true;
    statusMessage = '';
    statusType = 'info';

    updateStatus(t('settings.notifications.testNotification.statusMessages.sending'), 'info');

    try {
      const headers = new Headers({
        'Content-Type': 'application/json',
      });

      if (csrfToken) {
        headers.set('X-CSRF-Token', csrfToken);
      }

      const response = await fetch('/api/v2/notifications/test/new-species', {
        method: 'POST',
        headers,
        credentials: 'same-origin',
      });

      if (!response.ok) {
        if (response.status === 503) {
          throw new Error(
            t('settings.notifications.testNotification.statusMessages.serviceUnavailable')
          );
        }
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      generating = false;

      updateStatus(
        t('settings.notifications.testNotification.statusMessages.success', {
          species: data.title || 'Northern Cardinal',
        }),
        'success'
      );

      setTimeout(() => {
        statusMessage = '';
        statusType = 'info';
      }, 5000);
    } catch (error) {
      generating = false;
      updateStatus(
        t('settings.notifications.testNotification.statusMessages.error', {
          message: (error as Error).message,
        }),
        'error'
      );

      setTimeout(() => {
        statusMessage = '';
        statusType = 'info';
      }, 10000);
    }
  }

  function updateStatus(message: string, type: 'info' | 'success' | 'error') {
    statusMessage = message;
    statusType = type;
  }

  onMount(() => {
    loadTemplateConfig();
  });
</script>

<div class="flex flex-col gap-6 p-4 pb-24">
  <!-- Templates Section -->
  <div class="space-y-4">
    <h2 class="text-lg font-semibold">{t('settings.notifications.templates.title')}</h2>
    <p class="text-sm text-base-content/70">
      {t('settings.notifications.templates.description')}
    </p>

    {#if loadingTemplate}
      <div class="flex justify-center py-8">
        <span class="loading loading-spinner loading-md"></span>
      </div>
    {:else if templateConfig}
      <div class="space-y-4">
        <!-- Title Input -->
        <div class="form-control w-full">
          <label class="label" for="template-title">
            <span class="label-text font-medium"
              >{t('settings.notifications.templates.titleLabel')}</span
            >
          </label>
          <input
            id="template-title"
            type="text"
            bind:value={editedTitle}
            class="input input-bordered w-full h-12 font-mono text-sm"
            placeholder={t('settings.notifications.templates.titlePlaceholder')}
          />
        </div>

        <!-- Message Textarea -->
        <div class="form-control w-full">
          <label class="label" for="template-message">
            <span class="label-text font-medium"
              >{t('settings.notifications.templates.messageLabel')}</span
            >
          </label>
          <textarea
            id="template-message"
            bind:value={editedMessage}
            class="textarea textarea-bordered w-full font-mono text-sm"
            rows="8"
            placeholder={t('settings.notifications.templates.messagePlaceholder')}
          ></textarea>
        </div>

        <!-- Template Status Messages -->
        {#if templateStatusMessage}
          <div
            class="alert text-sm"
            class:alert-success={templateStatusType === 'success'}
            class:alert-error={templateStatusType === 'error'}
            role="alert"
            aria-live="assertive"
          >
            <span>{templateStatusMessage}</span>
          </div>
        {/if}

        <!-- Test Status Messages -->
        {#if statusMessage}
          <div
            class="alert text-sm"
            class:alert-info={statusType === 'info'}
            class:alert-success={statusType === 'success'}
            class:alert-error={statusType === 'error'}
            role="status"
            aria-live="polite"
          >
            <span>{statusMessage}</span>
          </div>
        {/if}

        <!-- Action Buttons -->
        <div class="flex flex-col gap-2">
          <button
            onclick={sendTestNewSpeciesNotification}
            disabled={generating || savingTemplate}
            class="btn btn-secondary w-full h-12"
            title={hasUnsavedChanges
              ? t('settings.notifications.templates.testWithUnsavedChanges')
              : t('settings.notifications.templates.testNormal')}
          >
            {#if generating}
              <span class="loading loading-spinner loading-sm"></span>
              <span>{t('settings.notifications.templates.sendingButton')}</span>
            {:else}
              <span>{t('settings.notifications.templates.testButton')}</span>
            {/if}
          </button>

          <div class="flex gap-2">
            <button
              onclick={resetTemplates}
              class="btn btn-ghost flex-1 h-12"
              disabled={savingTemplate || generating}
            >
              {t('settings.notifications.templates.resetButton')}
            </button>
            <button
              onclick={saveTemplateConfig}
              class="btn flex-1 h-12"
              class:btn-primary={hasUnsavedChanges}
              class:btn-ghost={!hasUnsavedChanges}
              disabled={savingTemplate || generating || !hasUnsavedChanges}
            >
              {#if savingTemplate}
                <span class="loading loading-spinner loading-sm"></span>
                <span>{t('settings.notifications.templates.savingButton')}</span>
              {:else}
                <span
                  >{hasUnsavedChanges
                    ? t('settings.notifications.templates.saveButtonUnsaved')
                    : t('settings.notifications.templates.saveButton')}</span
                >
              {/if}
            </button>
          </div>
        </div>
      </div>

      <!-- Available Variables -->
      <div class="collapse collapse-arrow bg-base-200">
        <input type="checkbox" />
        <div class="collapse-title text-sm font-medium">
          {t('settings.notifications.templates.availableVariables')}
        </div>
        <div class="collapse-content">
          <p class="text-xs text-base-content/70 mb-3">
            {t('settings.notifications.templates.variablesDescription')}
            <code class="bg-base-300 px-1 rounded-sm">&#123;&#123;.VariableName&#125;&#125;</code>
          </p>

          <div class="space-y-2 text-xs">
            <div class="flex flex-col gap-1">
              <code class="font-mono text-primary">&#123;&#123;.CommonName&#125;&#125;</code>
              <span class="text-base-content/70 text-xs"
                >Bird common name (e.g., "Northern Cardinal")</span
              >
            </div>
            <div class="flex flex-col gap-1">
              <code class="font-mono text-primary">&#123;&#123;.ScientificName&#125;&#125;</code>
              <span class="text-base-content/70 text-xs"
                >Scientific name (e.g., "Cardinalis cardinalis")</span
              >
            </div>
            <div class="flex flex-col gap-1">
              <code class="font-mono text-primary">&#123;&#123;.Confidence&#125;&#125;</code>
              <span class="text-base-content/70 text-xs">Confidence value (0.0 to 1.0)</span>
            </div>
            <div class="flex flex-col gap-1">
              <code class="font-mono text-primary">&#123;&#123;.ConfidencePercent&#125;&#125;</code>
              <span class="text-base-content/70 text-xs">Confidence as percentage (e.g., "99")</span
              >
            </div>
            <div class="flex flex-col gap-1">
              <code class="font-mono text-primary">&#123;&#123;.DetectionTime&#125;&#125;</code>
              <span class="text-base-content/70 text-xs">Time of detection (e.g., "14:30:45")</span>
            </div>
            <div class="flex flex-col gap-1">
              <code class="font-mono text-primary">&#123;&#123;.DetectionDate&#125;&#125;</code>
              <span class="text-base-content/70 text-xs"
                >Date of detection (e.g., "2024-10-05")</span
              >
            </div>
            <div class="flex flex-col gap-1">
              <code class="font-mono text-primary">&#123;&#123;.Location&#125;&#125;</code>
              <span class="text-base-content/70 text-xs"
                >Formatted coordinates (e.g., "42.360100, -71.058900")</span
              >
            </div>
            <div class="flex flex-col gap-1">
              <code class="font-mono text-primary">&#123;&#123;.DetectionURL&#125;&#125;</code>
              <span class="text-base-content/70 text-xs">Full URL to detection in UI</span>
            </div>
            <div class="flex flex-col gap-1">
              <code class="font-mono text-primary">&#123;&#123;.ImageURL&#125;&#125;</code>
              <span class="text-base-content/70 text-xs">Link to species image</span>
            </div>
          </div>

          <!-- Privacy Note -->
          <div class="alert alert-info text-xs mt-4">
            <div class="flex flex-col gap-1">
              <span class="font-medium">{t('settings.notifications.privacy.title')}</span>
              <span>{t('settings.notifications.privacy.description')}</span>
              <span>{t('settings.notifications.privacy.recommendation')}</span>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Push Notifications Section (Coming Soon) -->
  <div class="space-y-4">
    <h2 class="text-lg font-semibold">{t('settings.notifications.push.title')}</h2>
    <div class="text-center py-8 text-base-content/60">
      <p class="text-sm">{t('settings.notifications.push.comingSoon')}</p>
      <p class="text-xs mt-2">{t('settings.notifications.push.comingSoonDescription')}</p>
    </div>
  </div>
</div>
