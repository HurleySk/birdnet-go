<!--
  Mobile Security Settings Page Component

  Purpose: Configure authentication and access control settings for mobile including
  HTTPS/TLS, basic authentication, OAuth2 providers, and subnet bypass.

  Features:
  - Server host configuration
  - Automatic TLS via Let's Encrypt
  - Basic authentication with password
  - OAuth2 (Google and GitHub) with user restrictions
  - Subnet-based authentication bypass

  Mobile optimizations:
  - 44px minimum touch targets
  - Sticky save button at bottom
  - Single column layout
  - Collapsible OAuth sections
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '$lib/i18n';
  import {
    settingsStore,
    settingsActions,
    securitySettings,
    isLoading,
  } from '$lib/stores/settings';
  import MobileTextInput from '../../../components/forms/MobileTextInput.svelte';
  import MobileToggle from '../../../components/forms/MobileToggle.svelte';
  import { Shield, AlertTriangle } from '@lucide/svelte';

  // Reactive settings with proper defaults
  let settings = $derived({
    host: $securitySettings?.host ?? '',
    autoTls: $securitySettings?.autoTls ?? false,
    basicAuth: {
      enabled: $securitySettings?.basicAuth?.enabled ?? false,
      username: $securitySettings?.basicAuth?.username ?? '',
      password: $securitySettings?.basicAuth?.password ?? '',
    },
    googleAuth: {
      enabled: $securitySettings?.googleAuth?.enabled ?? false,
      clientId: $securitySettings?.googleAuth?.clientId ?? '',
      clientSecret: $securitySettings?.googleAuth?.clientSecret ?? '',
      userId: $securitySettings?.googleAuth?.userId ?? '',
    },
    githubAuth: {
      enabled: $securitySettings?.githubAuth?.enabled ?? false,
      clientId: $securitySettings?.githubAuth?.clientId ?? '',
      clientSecret: $securitySettings?.githubAuth?.clientSecret ?? '',
      userId: $securitySettings?.githubAuth?.userId ?? '',
    },
    allowSubnetBypass: {
      enabled: $securitySettings?.allowSubnetBypass?.enabled ?? false,
      subnet: $securitySettings?.allowSubnetBypass?.subnet ?? '',
    },
  });

  let store = $derived($settingsStore);

  // === AUTH SETTINGS: Manual save with validation ===
  // Track original auth settings for change detection
  let originalAuthSettings = $state<string>('');
  let authSaveStatus = $state<'idle' | 'saving' | 'saved'>('idle');

  // Capture original auth settings on load
  $effect(() => {
    if (!$isLoading && $securitySettings && !originalAuthSettings) {
      originalAuthSettings = JSON.stringify({
        basicAuth: $securitySettings.basicAuth,
        googleAuth: $securitySettings.googleAuth,
        githubAuth: $securitySettings.githubAuth,
        allowSubnetBypass: $securitySettings.allowSubnetBypass,
      });
    }
  });

  // Detect auth changes
  let hasAuthChanges = $derived.by(() => {
    if (!originalAuthSettings) return false;
    const current = JSON.stringify({
      basicAuth: settings.basicAuth,
      googleAuth: settings.googleAuth,
      githubAuth: settings.githubAuth,
      allowSubnetBypass: settings.allowSubnetBypass,
    });
    return current !== originalAuthSettings;
  });

  // Validation logic for required fields
  let validationErrors = $derived.by(() => {
    const errors: string[] = [];

    if (settings.basicAuth?.enabled && !settings.basicAuth.password?.trim()) {
      errors.push(t('settings.security.validation.passwordRequired'));
    }

    if (settings.googleAuth?.enabled) {
      if (!settings.googleAuth.clientId?.trim()) {
        errors.push(t('settings.security.validation.googleClientIdRequired'));
      }
      if (!settings.googleAuth.clientSecret?.trim()) {
        errors.push(t('settings.security.validation.googleClientSecretRequired'));
      }
    }

    if (settings.githubAuth?.enabled) {
      if (!settings.githubAuth.clientId?.trim()) {
        errors.push(t('settings.security.validation.githubClientIdRequired'));
      }
      if (!settings.githubAuth.clientSecret?.trim()) {
        errors.push(t('settings.security.validation.githubClientSecretRequired'));
      }
    }

    if (settings.allowSubnetBypass?.enabled && !settings.allowSubnetBypass.subnet?.trim()) {
      errors.push(t('settings.security.validation.subnetRequired'));
    }

    return errors;
  });

  let canSaveAuth = $derived(hasAuthChanges && validationErrors.length === 0);

  // Manual save for auth settings
  async function saveAuthSettings() {
    if (!canSaveAuth) return;

    authSaveStatus = 'saving';
    await settingsActions.saveSettings();

    // Update original to match current (reset change detection)
    originalAuthSettings = JSON.stringify({
      basicAuth: settings.basicAuth,
      googleAuth: settings.googleAuth,
      githubAuth: settings.githubAuth,
      allowSubnetBypass: settings.allowSubnetBypass,
    });

    authSaveStatus = 'saved';
    setTimeout(() => {
      authSaveStatus = 'idle';
    }, 2000);
  }

  // === SERVER CONFIG: Keep auto-save for non-auth settings ===
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  let serverSaveStatus = $state<'idle' | 'pending' | 'saving' | 'saved'>('idle');

  function debouncedSaveServer() {
    if (saveTimeout) clearTimeout(saveTimeout);
    serverSaveStatus = 'pending';
    saveTimeout = setTimeout(async () => {
      serverSaveStatus = 'saving';
      await settingsActions.saveSettings();
      serverSaveStatus = 'saved';
      setTimeout(() => {
        serverSaveStatus = 'idle';
      }, 1500);
    }, 800);
  }

  // Load settings on mount
  onMount(() => {
    settingsActions.loadSettings();
  });

  // Generate redirect URIs dynamically
  let currentHost = $derived(
    typeof window !== 'undefined'
      ? window.location.origin
      : settings?.host
        ? `https://${settings.host}`
        : 'https://your-domain.com'
  );

  let googleRedirectURI = $derived(`${currentHost}/auth/google/callback`);
  let githubRedirectURI = $derived(`${currentHost}/auth/github/callback`);

  // === SERVER CONFIG: Auto-save (less risky) ===
  function updateAutoTLSEnabled(enabled: boolean) {
    settingsActions.updateSection('security', {
      ...settings,
      autoTls: enabled,
    });
    debouncedSaveServer();
  }

  function updateAutoTLSHost(host: string) {
    settingsActions.updateSection('security', {
      ...settings,
      host: host,
    });
    debouncedSaveServer();
  }

  // === AUTH SETTINGS: No auto-save (manual save required) ===
  function updateBasicAuthEnabled(enabled: boolean) {
    settingsActions.updateSection('security', {
      ...settings,
      basicAuth: { ...settings.basicAuth, enabled },
    });
  }

  function updateBasicAuthPassword(password: string) {
    settingsActions.updateSection('security', {
      ...settings,
      basicAuth: { ...settings.basicAuth, password },
    });
  }

  function updateGoogleAuthEnabled(enabled: boolean) {
    settingsActions.updateSection('security', {
      ...settings,
      googleAuth: { ...settings.googleAuth, enabled },
    });
  }

  function updateGoogleClientId(clientId: string) {
    settingsActions.updateSection('security', {
      ...settings,
      googleAuth: { ...settings.googleAuth, clientId },
    });
  }

  function updateGoogleClientSecret(clientSecret: string) {
    settingsActions.updateSection('security', {
      ...settings,
      googleAuth: { ...settings.googleAuth, clientSecret },
    });
  }

  function updateGoogleUserId(userId: string) {
    settingsActions.updateSection('security', {
      ...settings,
      googleAuth: { ...settings.googleAuth, userId },
    });
  }

  function updateGithubAuthEnabled(enabled: boolean) {
    settingsActions.updateSection('security', {
      ...settings,
      githubAuth: { ...settings.githubAuth, enabled },
    });
  }

  function updateGithubClientId(clientId: string) {
    settingsActions.updateSection('security', {
      ...settings,
      githubAuth: { ...settings.githubAuth, clientId },
    });
  }

  function updateGithubClientSecret(clientSecret: string) {
    settingsActions.updateSection('security', {
      ...settings,
      githubAuth: { ...settings.githubAuth, clientSecret },
    });
  }

  function updateGithubUserId(userId: string) {
    settingsActions.updateSection('security', {
      ...settings,
      githubAuth: { ...settings.githubAuth, userId },
    });
  }

  function updateSubnetBypassEnabled(enabled: boolean) {
    settingsActions.updateSection('security', {
      ...settings,
      allowSubnetBypass: { ...settings.allowSubnetBypass, enabled },
    });
  }

  function updateSubnetBypassSubnet(subnet: string) {
    settingsActions.updateSection('security', {
      ...settings,
      allowSubnetBypass: { ...settings.allowSubnetBypass, subnet },
    });
  }
</script>

{#if $isLoading}
  <div class="flex items-center justify-center p-8">
    <span class="loading loading-spinner loading-lg text-primary"></span>
  </div>
{:else}
  <div class="flex flex-col gap-6 p-4 pb-24 overflow-x-hidden">
    <!-- Server Configuration -->
    <div class="space-y-4">
      <h2 class="text-lg font-semibold">{t('settings.security.serverConfiguration.title')}</h2>

      <MobileTextInput
        label={t('settings.security.hostLabel')}
        value={settings.host}
        placeholder={t('settings.security.placeholders.host')}
        disabled={store.isLoading || store.isSaving}
        onchange={updateAutoTLSHost}
      />

      <div class="divider my-2"></div>

      <h3 class="font-medium">{t('settings.security.httpsSettingsTitle')}</h3>

      <MobileToggle
        label={t('settings.security.serverConfiguration.autoTlsLabel')}
        checked={settings.autoTls}
        disabled={store.isLoading || store.isSaving}
        onchange={updateAutoTLSEnabled}
      />

      <div class="alert alert-info text-sm">
        <div>
          <p class="font-semibold">
            {t('settings.security.serverConfiguration.autoTlsRequirements.title')}
          </p>
          <ul class="list-disc list-inside mt-1 text-xs">
            <li>{t('settings.security.serverConfiguration.autoTlsRequirements.domainRequired')}</li>
            <li>{t('settings.security.serverConfiguration.autoTlsRequirements.domainPointing')}</li>
            <li>
              {t('settings.security.serverConfiguration.autoTlsRequirements.portsAccessible')}
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Basic Authentication -->
    <div class="space-y-4">
      <h2 class="text-lg font-semibold">{t('settings.security.basicAuthentication.title')}</h2>

      <MobileToggle
        label={t('settings.security.basicAuthentication.enableLabel')}
        checked={settings.basicAuth.enabled}
        disabled={store.isLoading || store.isSaving}
        onchange={updateBasicAuthEnabled}
      />

      <MobileTextInput
        label={t('settings.security.basicAuthentication.passwordLabel')}
        value={settings.basicAuth.password}
        type="password"
        helpText={t('settings.security.basicAuthentication.passwordHelpText')}
        disabled={!settings.basicAuth?.enabled || store.isLoading || store.isSaving}
        onchange={updateBasicAuthPassword}
      />
    </div>

    <!-- Google OAuth -->
    <div class="space-y-4">
      <h2 class="text-lg font-semibold flex items-center gap-2">
        <svg class="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        {t('settings.security.oauth.google.title')}
      </h2>

      <MobileToggle
        label={t('settings.security.oauth.google.enableLabel')}
        checked={settings.googleAuth.enabled}
        disabled={store.isLoading || store.isSaving}
        onchange={updateGoogleAuthEnabled}
      />

      {#if settings.googleAuth?.enabled}
        <div class="bg-base-200 p-3 rounded-lg text-sm">
          <p class="font-medium mb-1">{t('settings.security.oauth.google.redirectUriTitle')}</p>
          <code class="text-xs bg-base-300 px-2 py-1 rounded break-all">{googleRedirectURI}</code>
        </div>

        <MobileTextInput
          label={t('settings.security.oauth.google.clientIdLabel')}
          value={settings.googleAuth.clientId}
          type="password"
          helpText={t('settings.security.oauth.google.clientIdHelpText')}
          disabled={store.isLoading || store.isSaving}
          onchange={updateGoogleClientId}
        />

        <MobileTextInput
          label={t('settings.security.oauth.google.clientSecretLabel')}
          value={settings.googleAuth.clientSecret}
          type="password"
          helpText={t('settings.security.oauth.google.clientSecretHelpText')}
          disabled={store.isLoading || store.isSaving}
          onchange={updateGoogleClientSecret}
        />

        <MobileTextInput
          label={t('settings.security.oauth.google.userIdLabel')}
          value={settings.googleAuth.userId}
          placeholder={t('settings.security.placeholders.allowedUsers')}
          disabled={store.isLoading || store.isSaving}
          onchange={updateGoogleUserId}
        />
      {/if}
    </div>

    <!-- GitHub OAuth -->
    <div class="space-y-4">
      <h2 class="text-lg font-semibold flex items-center gap-2">
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path
            d="M12 0C5.374 0 0 5.373 0 12 0 17.302 3.438 21.8 8.207 23.387c.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"
          />
        </svg>
        {t('settings.security.oauth.github.title')}
      </h2>

      <MobileToggle
        label={t('settings.security.oauth.github.enableLabel')}
        checked={settings.githubAuth.enabled}
        disabled={store.isLoading || store.isSaving}
        onchange={updateGithubAuthEnabled}
      />

      {#if settings.githubAuth?.enabled}
        <div class="bg-base-200 p-3 rounded-lg text-sm">
          <p class="font-medium mb-1">{t('settings.security.oauth.github.redirectUriTitle')}</p>
          <code class="text-xs bg-base-300 px-2 py-1 rounded break-all">{githubRedirectURI}</code>
        </div>

        <MobileTextInput
          label={t('settings.security.oauth.github.clientIdLabel')}
          value={settings.githubAuth.clientId}
          type="password"
          helpText={t('settings.security.oauth.github.clientIdHelpText')}
          disabled={store.isLoading || store.isSaving}
          onchange={updateGithubClientId}
        />

        <MobileTextInput
          label={t('settings.security.oauth.github.clientSecretLabel')}
          value={settings.githubAuth.clientSecret}
          type="password"
          helpText={t('settings.security.oauth.github.clientSecretHelpText')}
          disabled={store.isLoading || store.isSaving}
          onchange={updateGithubClientSecret}
        />

        <MobileTextInput
          label={t('settings.security.oauth.github.userIdLabel')}
          value={settings.githubAuth.userId}
          placeholder={t('settings.security.placeholders.allowedUsers')}
          disabled={store.isLoading || store.isSaving}
          onchange={updateGithubUserId}
        />
      {/if}
    </div>

    <!-- Subnet Bypass -->
    <div class="space-y-4">
      <h2 class="text-lg font-semibold">{t('settings.security.bypassAuthentication.title')}</h2>

      <MobileToggle
        label={t('settings.security.allowSubnetBypassLabel')}
        checked={settings.allowSubnetBypass.enabled}
        disabled={store.isLoading || store.isSaving}
        onchange={updateSubnetBypassEnabled}
      />

      <MobileTextInput
        label={t('settings.security.allowedSubnetsLabel')}
        value={settings.allowSubnetBypass.subnet}
        placeholder={t('settings.security.placeholders.subnet')}
        helpText={t('settings.security.allowedSubnetsHelp')}
        disabled={!settings.allowSubnetBypass?.enabled || store.isLoading || store.isSaving}
        onchange={updateSubnetBypassSubnet}
      />

      {#if settings.allowSubnetBypass?.enabled}
        <div class="alert alert-warning text-sm">
          <div>
            <p class="font-semibold">{t('settings.security.securityWarningTitle')}</p>
            <p class="text-xs mt-1">{t('settings.security.subnetWarningText')}</p>
          </div>
        </div>
      {/if}
    </div>
  </div>

  <!-- Server config auto-save status indicator -->
  {#if serverSaveStatus !== 'idle'}
    <div
      class="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 transition-all duration-300 opacity-100"
    >
      <div
        class="px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium"
        class:bg-base-200={serverSaveStatus === 'pending'}
        class:bg-primary={serverSaveStatus === 'saving'}
        class:text-primary-content={serverSaveStatus === 'saving'}
        class:bg-success={serverSaveStatus === 'saved'}
        class:text-success-content={serverSaveStatus === 'saved'}
      >
        {#if serverSaveStatus === 'pending'}
          <span class="w-2 h-2 rounded-full bg-base-content/50 animate-pulse"></span>
          <span>{t('settings.actions.unsavedChanges')}</span>
        {:else if serverSaveStatus === 'saving'}
          <span class="loading loading-spinner loading-xs"></span>
          <span>{t('settings.actions.saving')}</span>
        {:else if serverSaveStatus === 'saved'}
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span>{t('settings.actions.saved')}</span>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Auth Settings Manual Save Bar -->
  {#if hasAuthChanges || authSaveStatus !== 'idle'}
    <div
      class="fixed bottom-16 left-0 right-0 z-50 px-4 pb-4 animate-in slide-in-from-bottom duration-300"
    >
      <div class="bg-base-200 border border-base-300 rounded-xl shadow-xl overflow-hidden">
        <!-- Validation errors -->
        {#if validationErrors.length > 0}
          <div class="bg-warning/10 border-b border-warning/20 px-4 py-3">
            <div class="flex items-start gap-2 text-warning">
              <AlertTriangle class="w-4 h-4 mt-0.5 shrink-0" />
              <div class="text-sm space-y-0.5">
                {#each validationErrors as error}
                  <p>{error}</p>
                {/each}
              </div>
            </div>
          </div>
        {/if}

        <!-- Save button area -->
        <div class="p-4">
          {#if authSaveStatus === 'saved'}
            <div class="flex items-center justify-center gap-2 text-success py-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span class="font-medium">{t('settings.actions.saved')}</span>
            </div>
          {:else}
            <button
              class="w-full btn h-12 gap-2 font-semibold transition-all duration-200"
              class:btn-primary={canSaveAuth}
              class:btn-disabled={!canSaveAuth}
              disabled={!canSaveAuth || authSaveStatus === 'saving'}
              onclick={saveAuthSettings}
            >
              {#if authSaveStatus === 'saving'}
                <span class="loading loading-spinner loading-sm"></span>
                <span>{t('settings.actions.saving')}</span>
              {:else}
                <Shield class="w-5 h-5" />
                <span>{t('settings.security.saveAuthSettings')}</span>
              {/if}
            </button>
          {/if}
        </div>
      </div>
    </div>
  {/if}
{/if}
