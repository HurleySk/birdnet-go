<script lang="ts">
  import { t } from '$lib/i18n';
  import { systemIcons } from '$lib/utils/icons';
  import SettingsNavCard from '../../components/settings/SettingsNavCard.svelte';

  interface Props {
    onNavigate?: (_section: string) => void;
  }

  let { onNavigate }: Props = $props();

  const settingsSections = [
    {
      id: 'main',
      title: t('settings.sections.node'),
      description: t('settings.mobile.main.description'),
      iconHtml: systemIcons.home,
      iconClassName: 'bg-primary/20 text-primary',
    },
    {
      id: 'userinterface',
      title: t('settings.sections.userinterface'),
      description: t('settings.mobile.ui.description'),
      iconHtml: systemIcons.sunIcon,
      iconClassName: 'bg-secondary/20 text-secondary',
    },
    {
      id: 'audio',
      title: t('settings.sections.audio'),
      description: t('settings.mobile.audio.description'),
      iconHtml: systemIcons.settingsGear,
      iconClassName: 'bg-accent/20 text-accent',
    },
    {
      id: 'detectionfilters',
      title: t('settings.sections.filters'),
      description: t('settings.mobile.filters.description'),
      iconHtml: systemIcons.list,
      iconClassName: 'bg-info/20 text-info',
    },
    {
      id: 'integrations',
      title: t('settings.sections.integration'),
      description: t('settings.mobile.integrations.description'),
      iconHtml: systemIcons.globe,
      iconClassName: 'bg-success/20 text-success',
    },
    {
      id: 'security',
      title: t('settings.sections.security'),
      description: t('settings.mobile.security.description'),
      iconHtml: systemIcons.shield,
      iconClassName: 'bg-warning/20 text-warning',
    },
    {
      id: 'species',
      title: t('settings.sections.species'),
      description: t('settings.mobile.species.description'),
      iconHtml: systemIcons.bird,
      iconClassName: 'bg-error/20 text-error',
    },
    {
      id: 'notifications',
      title: t('settings.sections.notifications'),
      description: t('settings.mobile.notifications.description'),
      iconHtml: systemIcons.bell,
      iconClassName: 'bg-primary/20 text-primary',
    },
    {
      id: 'support',
      title: t('settings.sections.support'),
      description: t('settings.mobile.support.description'),
      iconHtml: systemIcons.help,
      iconClassName: 'bg-neutral/20 text-neutral',
    },
  ];

  function handleNavigate(sectionId: string) {
    onNavigate?.(sectionId);
  }
</script>

<div class="flex flex-col gap-2 p-4">
  {#each settingsSections as section (section.id)}
    <SettingsNavCard
      title={section.title}
      description={section.description}
      iconHtml={section.iconHtml}
      iconClassName={section.iconClassName}
      onClick={() => handleNavigate(section.id)}
    />
  {/each}
</div>
