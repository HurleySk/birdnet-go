<!--
  Mobile Support Settings Page Component

  Purpose: Support dump generation and diagnostic features for mobile.

  Features:
  - Support dump generation with customizable options
  - Upload to Sentry or download locally
  - User message inclusion for context
  - GitHub issue number requirement for uploads

  Mobile optimizations:
  - 44px minimum touch targets
  - Simplified options layout
  - Progress indication during generation
  - Clear status messages
-->
<script lang="ts">
  import { t } from '$lib/i18n';
  import { loggers } from '$lib/utils/logger';
  import MobileTextInput from '../../../components/forms/MobileTextInput.svelte';
  import MobileToggle from '../../../components/forms/MobileToggle.svelte';

  const logger = loggers.settings;

  // CSRF token
  let csrfToken = $derived(
    (document.querySelector('meta[name="csrf-token"]') as HTMLElement)?.getAttribute('content') ||
      ''
  );

  // Support dump generation state
  let generating = $state(false);
  let statusMessage = $state('');
  let statusType = $state<'info' | 'success' | 'error'>('info');
  let progressPercent = $state(0);

  // Support dump options
  let supportDump = $state({
    includeLogs: true,
    includeConfig: true,
    includeSystemInfo: true,
    githubIssueNumber: '',
    userMessage: '',
    uploadToSentry: true,
  });

  // System ID API state
  interface ApiState<T> {
    loading: boolean;
    error: string | null;
    data: T;
  }

  let systemIdState = $state<ApiState<string>>({
    loading: true,
    error: null,
    data: '',
  });

  let systemId = $derived(systemIdState.data || '');

  // Load system ID
  $effect(() => {
    loadSystemId();
  });

  async function loadSystemId() {
    systemIdState.loading = true;
    systemIdState.error = null;

    try {
      const headers = new Headers();
      if (csrfToken) {
        headers.set('X-CSRF-Token', csrfToken);
      }

      const response = await fetch('/api/v2/settings/systemid', {
        headers,
        credentials: 'same-origin',
      });

      if (!response.ok) {
        throw new Error(`Failed to load system ID: ${response.status}`);
      }

      const data = await response.json();
      systemIdState.data = data.systemID || '';
    } catch (error) {
      logger.error('Failed to fetch system ID:', error);
      systemIdState.error = t('settings.support.systemId.errorLoading');
      systemIdState.data = t('settings.support.systemId.errorLoading');
    } finally {
      systemIdState.loading = false;
    }
  }

  // Support dump generation
  async function generateSupportDump() {
    // Validate GitHub issue number if uploading
    if (supportDump.uploadToSentry && !supportDump.githubIssueNumber) {
      updateStatus(
        t('settings.support.supportReport.statusMessages.githubIssueRequired'),
        'error',
        0
      );
      return;
    }

    generating = true;
    statusMessage = '';
    statusType = 'info';
    progressPercent = 0;

    updateStatus(t('settings.support.supportReport.statusMessages.preparing'), 'info', 10);

    try {
      const headers = new Headers({
        'Content-Type': 'application/json',
      });

      if (csrfToken) {
        headers.set('X-CSRF-Token', csrfToken);
      }

      const response = await fetch('/api/v2/support/generate', {
        method: 'POST',
        headers,
        credentials: 'same-origin',
        body: JSON.stringify({
          include_logs: supportDump.includeLogs,
          include_config: supportDump.includeConfig,
          include_system_info: supportDump.includeSystemInfo,
          github_issue_number: supportDump.githubIssueNumber
            ? supportDump.githubIssueNumber.replace('#', '')
            : '',
          user_message: supportDump.userMessage,
          upload_to_sentry: supportDump.uploadToSentry,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      generating = false;

      if (data.success) {
        if (supportDump.uploadToSentry && data.uploaded_at) {
          if (data.dump_id) {
            updateStatus(
              t('settings.support.supportReport.statusMessages.uploadSuccessWithId', {
                dumpId: data.dump_id,
              }),
              'success',
              100
            );
          } else {
            updateStatus(
              t('settings.support.supportReport.statusMessages.uploadSuccess'),
              'success',
              100
            );
          }
        } else if (data.download_url) {
          updateStatus(
            t('settings.support.supportReport.statusMessages.downloadSuccess'),
            'success',
            100
          );
          setTimeout(() => {
            window.location.href = data.download_url;
          }, 500);
        } else {
          updateStatus(
            t('settings.support.supportReport.statusMessages.generateSuccess'),
            'success',
            100
          );
        }

        // Clear status after 10 seconds
        setTimeout(() => {
          statusMessage = '';
          statusType = 'info';
          progressPercent = 0;
        }, 10000);
      } else {
        updateStatus(
          t('settings.support.supportReport.statusMessages.generateFailed', {
            message: data.message || 'Unknown error',
          }),
          'error',
          0
        );
      }
    } catch (error) {
      generating = false;
      updateStatus(
        t('settings.support.supportReport.statusMessages.error', {
          message: (error as Error).message,
        }),
        'error',
        0
      );
    }
  }

  function updateStatus(message: string, type: 'info' | 'success' | 'error', percent: number) {
    statusMessage = message;
    statusType = type;
    progressPercent = percent;

    // Simulate progress for long operations
    if (type === 'info' && percent < 90) {
      setTimeout(() => {
        if (generating && progressPercent < 90) {
          progressPercent = Math.min(progressPercent + 10, 90);
        }
      }, 1000);
    }
  }

  // Derived state for generate button
  let generateButtonDisabled = $derived(
    generating ||
      (!supportDump.includeLogs && !supportDump.includeConfig && !supportDump.includeSystemInfo) ||
      (supportDump.uploadToSentry && !supportDump.githubIssueNumber)
  );
</script>

<div class="flex flex-col gap-6 p-4 pb-24">
  <!-- Support & Diagnostics -->
  <div class="space-y-4">
    <div>
      <h2 class="text-lg font-semibold">{t('settings.support.sections.diagnostics.title')}</h2>
      <p class="text-sm text-base-content/60 mt-1">
        {@html t('settings.support.supportReport.description.intro')}
      </p>
    </div>

    <!-- GitHub Required Alert -->
    <div class="alert alert-warning text-sm">
      <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <div>
        <p class="font-semibold">
          {t('settings.support.supportReport.githubRequired.title')}
        </p>
        <p class="text-xs mt-1">
          {@html t('settings.support.supportReport.githubRequired.description')}
        </p>
      </div>
    </div>

    <!-- What's Included -->
    <div class="bg-base-200 rounded-lg p-3">
      <h3 class="font-semibold text-sm mb-2">
        {t('settings.support.supportReport.whatsIncluded.title')}
      </h3>
      <ul class="text-xs space-y-1">
        <li class="flex items-center gap-2">
          <svg class="w-4 h-4 text-success shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clip-rule="evenodd"
            />
          </svg>
          <span>{@html t('settings.support.supportReport.whatsIncluded.applicationLogs')}</span>
        </li>
        <li class="flex items-center gap-2">
          <svg class="w-4 h-4 text-success shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clip-rule="evenodd"
            />
          </svg>
          <span>{@html t('settings.support.supportReport.whatsIncluded.configuration')}</span>
        </li>
        <li class="flex items-center gap-2">
          <svg class="w-4 h-4 text-success shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clip-rule="evenodd"
            />
          </svg>
          <span>{@html t('settings.support.supportReport.whatsIncluded.systemInfo')}</span>
        </li>
        <li class="flex items-center gap-2">
          <svg class="w-4 h-4 text-error shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clip-rule="evenodd"
            />
          </svg>
          <span>{@html t('settings.support.supportReport.whatsIncluded.notIncluded')}</span>
        </li>
      </ul>
    </div>

    <!-- Options -->
    <MobileToggle
      label={t('settings.support.diagnostics.includeRecentLogs')}
      bind:checked={supportDump.includeLogs}
      disabled={generating}
    />

    <MobileToggle
      label={t('settings.support.diagnostics.includeConfiguration')}
      bind:checked={supportDump.includeConfig}
      disabled={generating}
    />

    <MobileToggle
      label={t('settings.support.diagnostics.includeSystemInfo')}
      bind:checked={supportDump.includeSystemInfo}
      disabled={generating}
    />

    <MobileToggle
      label={t('settings.support.supportReport.uploadOption.labelWithRequirement')}
      bind:checked={supportDump.uploadToSentry}
      disabled={generating}
    />

    <!-- GitHub Issue Number (Required for Upload) -->
    {#if supportDump.uploadToSentry}
      <MobileTextInput
        label={t('settings.support.supportReport.githubIssue.label')}
        bind:value={supportDump.githubIssueNumber}
        placeholder={t('settings.support.supportReport.githubIssue.placeholder')}
        helpText={t('settings.support.supportReport.githubIssue.helper')}
        disabled={generating}
        error={supportDump.uploadToSentry && !supportDump.githubIssueNumber
          ? t('settings.support.supportReport.statusMessages.githubIssueRequired')
          : undefined}
      />
    {/if}

    <!-- User Message -->
    <div class="form-control w-full">
      <label class="label" for="userMessage">
        <span class="label-text font-medium">
          {t('settings.support.supportReport.userMessage.labelOptional')}
        </span>
      </label>
      <textarea
        id="userMessage"
        bind:value={supportDump.userMessage}
        class="textarea textarea-bordered w-full min-h-24"
        placeholder={t('settings.support.supportReport.userMessage.placeholderOptional')}
        rows="4"
        disabled={generating}
      ></textarea>
      <div class="label">
        <span class="label-text-alt text-base-content/60">
          {t('settings.support.supportReport.userMessage.systemIdNote', { systemId })}
        </span>
      </div>
    </div>

    <!-- Status Message -->
    {#if statusMessage}
      <div
        class="alert text-sm"
        class:alert-info={statusType === 'info'}
        class:alert-success={statusType === 'success'}
        class:alert-error={statusType === 'error'}
        role="status"
        aria-live="polite"
      >
        {#if statusType === 'info'}
          <svg class="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clip-rule="evenodd"
            />
          </svg>
        {:else if statusType === 'success'}
          <svg class="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clip-rule="evenodd"
            />
          </svg>
        {:else if statusType === 'error'}
          <svg class="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clip-rule="evenodd"
            />
          </svg>
        {/if}
        <span>{statusMessage}</span>
      </div>

      <!-- Progress Bar -->
      {#if generating && progressPercent > 0}
        <div class="w-full bg-base-300 rounded-full h-2">
          <div
            class="bg-primary h-2 rounded-full transition-all duration-500"
            style:width="{progressPercent}%"
          ></div>
        </div>
      {/if}
    {/if}

    <!-- Generate Button -->
    <button
      onclick={generateSupportDump}
      disabled={generateButtonDisabled}
      class="btn btn-primary w-full h-12"
      class:btn-disabled={generateButtonDisabled}
    >
      {#if generating}
        <span class="loading loading-spinner loading-sm"></span>
      {:else}
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        <span>
          {supportDump.uploadToSentry
            ? t('settings.support.supportReport.generateButton.upload')
            : t('settings.support.supportReport.generateButton.download')}
        </span>
      {/if}
    </button>
  </div>
</div>
