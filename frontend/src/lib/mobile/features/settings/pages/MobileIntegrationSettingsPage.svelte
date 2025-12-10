<script lang="ts">
  import { t } from '$lib/i18n';
  import {
    settingsStore,
    settingsActions,
    integrationSettings,
    realtimeSettings,
    type MQTTSettings,
  } from '$lib/stores/settings';
  import { MobileTextInput, MobileNumberInput, MobileToggle } from '../../../components/forms';

  let store = $derived($settingsStore);

  let settings = $derived(
    $integrationSettings || {
      birdweather: {
        enabled: false,
        id: '',
        latitude: 0,
        longitude: 0,
        locationAccuracy: 1000,
        threshold: 0.7,
        debug: false,
      },
      mqtt: {
        enabled: false,
        broker: '',
        port: 1883,
        username: '',
        password: '',
        topic: 'birdnet',
        retain: false,
        tls: {
          enabled: false,
          skipVerify: false,
        },
      },
      observability: {
        prometheus: {
          enabled: false,
          port: 9090,
          path: '/metrics',
        },
      },
    }
  );

  // BirdWeather update handlers
  function updateBirdWeatherEnabled(enabled: boolean) {
    settingsActions.updateSection('realtime', {
      birdweather: { ...settings.birdweather!, enabled },
    });
  }

  function updateBirdWeatherId(id: string) {
    settingsActions.updateSection('realtime', {
      birdweather: { ...settings.birdweather!, id },
    });
  }

  function updateBirdWeatherThreshold(threshold: number) {
    settingsActions.updateSection('realtime', {
      birdweather: { ...settings.birdweather!, threshold },
    });
  }

  // MQTT update handlers
  function updateMQTTEnabled(enabled: boolean) {
    settingsActions.updateSection('realtime', {
      mqtt: { ...settings.mqtt!, enabled },
    });
  }

  function updateMQTTBroker(broker: string) {
    settingsActions.updateSection('realtime', {
      mqtt: { ...settings.mqtt!, broker },
    });
  }

  function updateMQTTTopic(topic: string) {
    settingsActions.updateSection('realtime', {
      mqtt: { ...settings.mqtt!, topic },
    });
  }

  function updateMQTTUsername(username: string) {
    settingsActions.updateSection('realtime', {
      mqtt: { ...settings.mqtt!, username },
    });
  }

  function updateMQTTPassword(password: string) {
    settingsActions.updateSection('realtime', {
      mqtt: { ...settings.mqtt!, password },
    });
  }

  function updateMQTTTLSEnabled(enabled: boolean) {
    settingsActions.updateSection('realtime', {
      mqtt: { ...settings.mqtt!, tls: { ...settings.mqtt!.tls, enabled } },
    });
  }

  function updateMQTTTLSSkipVerify(skipVerify: boolean) {
    settingsActions.updateSection('realtime', {
      mqtt: { ...settings.mqtt!, tls: { ...settings.mqtt!.tls, skipVerify } },
    });
  }

  function updateMQTTRetain(retain: boolean) {
    settingsActions.updateSection('realtime', {
      mqtt: { ...(settings.mqtt as MQTTSettings), retain },
    });
  }

  // Observability update handlers
  function updateObservabilityEnabled(enabled: boolean) {
    settingsActions.updateSection('realtime', {
      telemetry: {
        enabled,
        listen: $realtimeSettings?.telemetry?.listen || '0.0.0.0:8090',
      },
    });
  }

  function updateObservabilityListen(listen: string) {
    settingsActions.updateSection('realtime', {
      telemetry: {
        enabled: $realtimeSettings?.telemetry?.enabled || false,
        listen,
      },
    });
  }

  async function handleSave() {
    await settingsActions.saveSettings();
  }
</script>

<div class="flex flex-col gap-6 p-4 pb-24">
  <!-- BirdWeather Settings -->
  <div class="space-y-4">
    <h2 class="text-lg font-semibold">{t('settings.integration.birdweather.title')}</h2>

    <MobileToggle
      label={t('settings.integration.birdweather.enable')}
      checked={settings.birdweather!.enabled}
      disabled={store.isLoading || store.isSaving}
      onchange={updateBirdWeatherEnabled}
    />

    {#if settings.birdweather?.enabled}
      <div class="space-y-4 pl-2">
        <MobileTextInput
          label={t('settings.integration.birdweather.token.label')}
          value={settings.birdweather!.id}
          type="password"
          placeholder=""
          helpText={t('settings.integration.birdweather.token.helpText')}
          disabled={store.isLoading || store.isSaving}
          onchange={updateBirdWeatherId}
        />

        <MobileNumberInput
          label={t('settings.integration.birdweather.threshold.label')}
          value={settings.birdweather!.threshold}
          min={0}
          max={1}
          step={0.01}
          helpText={t('settings.integration.birdweather.threshold.helpText')}
          disabled={store.isLoading || store.isSaving}
          onUpdate={updateBirdWeatherThreshold}
        />
      </div>
    {/if}
  </div>

  <!-- MQTT Settings -->
  <div class="space-y-4">
    <h2 class="text-lg font-semibold">{t('settings.integration.mqtt.title')}</h2>

    <MobileToggle
      label={t('settings.integration.mqtt.enable')}
      checked={settings.mqtt!.enabled}
      disabled={store.isLoading || store.isSaving}
      onchange={updateMQTTEnabled}
    />

    {#if settings.mqtt?.enabled}
      <div class="space-y-4 pl-2">
        <MobileTextInput
          label={t('settings.integration.mqtt.broker.label')}
          value={settings.mqtt!.broker}
          placeholder={t('settings.integration.mqtt.broker.placeholder')}
          disabled={store.isLoading || store.isSaving}
          onchange={updateMQTTBroker}
        />

        <MobileTextInput
          label={t('settings.integration.mqtt.topic.label')}
          value={settings.mqtt!.topic}
          placeholder={t('settings.integration.mqtt.topic.placeholder')}
          disabled={store.isLoading || store.isSaving}
          onchange={updateMQTTTopic}
        />

        <!-- Authentication -->
        <div class="divider text-sm">{t('settings.integration.mqtt.authentication.title')}</div>

        <MobileTextInput
          label={t('settings.integration.mqtt.authentication.username.label')}
          value={settings.mqtt!.username || ''}
          placeholder=""
          disabled={store.isLoading || store.isSaving}
          onchange={updateMQTTUsername}
        />

        <MobileTextInput
          label={t('settings.integration.mqtt.authentication.password.label')}
          value={settings.mqtt!.password || ''}
          type="password"
          placeholder=""
          helpText={t('settings.integration.mqtt.authentication.password.helpText')}
          disabled={store.isLoading || store.isSaving}
          onchange={updateMQTTPassword}
        />

        <!-- Message Settings -->
        <div class="divider text-sm">{t('settings.integration.mqtt.messageSettings.title')}</div>

        <MobileToggle
          label={t('settings.integration.mqtt.messageSettings.retain.label')}
          checked={(settings.mqtt as MQTTSettings).retain ?? false}
          disabled={store.isLoading || store.isSaving}
          helpText={t('settings.integration.mqtt.messageSettings.retain.note')}
          onchange={updateMQTTRetain}
        />

        <!-- TLS/SSL Security -->
        <div class="divider text-sm">{t('settings.integration.mqtt.tls.title')}</div>

        <MobileToggle
          label={t('settings.integration.mqtt.tls.enable')}
          checked={settings.mqtt?.tls?.enabled ?? false}
          disabled={store.isLoading || store.isSaving}
          onchange={updateMQTTTLSEnabled}
        />

        {#if settings.mqtt?.tls?.enabled}
          <MobileToggle
            label={t('settings.integration.mqtt.tls.skipVerify')}
            checked={settings.mqtt?.tls?.skipVerify ?? false}
            disabled={store.isLoading || store.isSaving}
            onchange={updateMQTTTLSSkipVerify}
          />

          <div class="alert alert-info text-sm">
            <div>
              <span>{@html t('settings.integration.mqtt.tls.configNote')}</span>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Observability Settings -->
  <div class="space-y-4">
    <h2 class="text-lg font-semibold">{t('settings.integration.observability.title')}</h2>

    <MobileToggle
      label={t('settings.integration.observability.enable')}
      checked={settings.observability!.prometheus.enabled}
      disabled={store.isLoading || store.isSaving}
      onchange={updateObservabilityEnabled}
    />

    {#if settings.observability?.prometheus.enabled}
      <div class="space-y-4 pl-2">
        <MobileTextInput
          label={t('settings.integration.observability.listenAddress.label')}
          value={`0.0.0.0:${settings.observability!.prometheus.port}`}
          placeholder={t('settings.integration.observability.listenAddress.placeholder')}
          disabled={store.isLoading || store.isSaving}
          onchange={updateObservabilityListen}
        />
      </div>
    {/if}
  </div>

  <!-- Sticky Save Button -->
  <div class="fixed bottom-0 left-0 right-0 bg-base-100 p-4 border-t border-base-300 pb-safe">
    <button
      class="btn btn-primary w-full h-12"
      onclick={handleSave}
      disabled={store.isLoading || store.isSaving}
    >
      {#if store.isSaving}
        <span class="loading loading-spinner loading-sm"></span>
      {/if}
      {t('settings.actions.save')}
    </button>
  </div>
</div>
