<script lang="ts">
  import { onMount } from 'svelte';
  import { getLogger } from '$lib/utils/logger';
  import { t } from '$lib/i18n';
  import { getLocalDateString } from '$lib/utils/date';
  import { fetchWithCSRF } from '$lib/utils/api';
  import DashboardSummaryCard from './DashboardSummaryCard.svelte';
  import DetectionRow from '../../components/detection/DetectionRow.svelte';
  import MobileAudioPlayer from '../../components/audio/MobileAudioPlayer.svelte';
  import { currentlyPlayingId, isPlaying, playDetection } from '$lib/stores/mobileAudio';

  const logger = getLogger('mobile-dashboard');

  // Minimal detection interface - matches what DetectionRow expects
  interface DashboardDetection {
    id: number;
    commonName: string;
    scientificName: string;
    confidence: number;
    date: string;
    time: string;
    verified?: 'correct' | 'false_positive' | 'unverified';
  }

  interface SummaryData {
    totalDetections: number;
    uniqueSpecies: number;
    topSpecies: string | null;
  }

  interface DetectionsResponse {
    data: Array<{
      id: number;
      commonName: string;
      scientificName: string;
      confidence: number;
      date: string;
      time: string;
      verified?: string;
    }>;
    total: number;
  }

  // Page size for infinite scroll
  const PAGE_SIZE = 20;

  // Summary state
  let summaryLoading = $state(true);
  let summaryError = $state<string | null>(null);
  let summary = $state<SummaryData | null>(null);

  // Detections state for infinite scroll
  let detections = $state<DashboardDetection[]>([]);
  let totalDetections = $state(0);
  let detectionsLoading = $state(true);
  let loadingMore = $state(false);
  let detectionsError = $state<string | null>(null);
  let hasMore = $derived(detections.length < totalDetections);

  // UI state
  let expandedId = $state<number | null>(null);
  let sentinelRef = $state<HTMLDivElement | null>(null);

  // Get today's date for filtering
  const today = getLocalDateString();

  async function loadSummary() {
    try {
      summaryError = null;
      summaryLoading = true;

      const response = await fetch(`/api/v2/analytics/species/daily?date=${today}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch summary: ${response.statusText}`);
      }
      const data = await response.json();

      // Calculate summary stats from daily summary
      const total = data.reduce(
        (sum: number, species: { count: number }) => sum + species.count,
        0
      );
      const uniqueCount = data.length;
      const topSpeciesName = data.length > 0 ? data[0].common_name : null;

      summary = {
        totalDetections: total,
        uniqueSpecies: uniqueCount,
        topSpecies: topSpeciesName,
      };
    } catch (err) {
      logger.error('Failed to load summary', err);
      summaryError = err instanceof Error ? err.message : 'Failed to load summary';
    } finally {
      summaryLoading = false;
    }
  }

  async function loadDetections(append = false) {
    if (loadingMore) return;

    try {
      if (append) {
        loadingMore = true;
      } else {
        detectionsError = null;
        detectionsLoading = true;
        detections = [];
      }

      const offset = append ? detections.length : 0;
      const params = new URLSearchParams({
        start_date: today,
        end_date: today,
        numResults: PAGE_SIZE.toString(),
        offset: offset.toString(),
      });

      const response = await fetch(`/api/v2/detections?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch detections: ${response.statusText}`);
      }

      const result: DetectionsResponse = await response.json();

      // Transform API response to our interface
      const newDetections: DashboardDetection[] = result.data.map(d => ({
        id: d.id,
        commonName: d.commonName,
        scientificName: d.scientificName,
        confidence: d.confidence,
        date: d.date,
        time: d.time,
        verified: d.verified as DashboardDetection['verified'],
      }));

      if (append) {
        detections = [...detections, ...newDetections];
      } else {
        detections = newDetections;
      }
      totalDetections = result.total;
    } catch (err) {
      logger.error('Failed to load detections', err);
      detectionsError = err instanceof Error ? err.message : 'Failed to load detections';
    } finally {
      detectionsLoading = false;
      loadingMore = false;
    }
  }

  function loadMore() {
    if (hasMore && !loadingMore) {
      loadDetections(true);
    }
  }

  function toggleExpanded(id: number) {
    expandedId = expandedId === id ? null : id;
  }

  function handlePlay(detection: DashboardDetection) {
    playDetection(detection.id);
  }

  async function handleVerify(detection: DashboardDetection) {
    try {
      await fetchWithCSRF(`/api/v2/detections/${detection.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verified: 'correct' }),
      });
      // Update detection in place
      detections = detections.map(d =>
        d.id === detection.id ? { ...d, verified: 'correct' as const } : d
      );
      logger.info('Detection verified', { id: detection.id });
    } catch (err) {
      logger.error('Failed to verify detection', err);
    }
  }

  async function handleDismiss(detection: DashboardDetection) {
    try {
      await fetchWithCSRF(`/api/v2/detections/${detection.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verified: 'false_positive' }),
      });
      // Update detection in place
      detections = detections.map(d =>
        d.id === detection.id ? { ...d, verified: 'false_positive' as const } : d
      );
      logger.info('Detection dismissed', { id: detection.id });
    } catch (err) {
      logger.error('Failed to dismiss detection', err);
    }
  }

  // Set up IntersectionObserver for infinite scroll
  $effect(() => {
    if (!sentinelRef) return;

    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        if (entry.isIntersecting && hasMore && !loadingMore && !detectionsLoading) {
          loadMore();
        }
      },
      {
        rootMargin: '100px', // Start loading 100px before sentinel is visible
      }
    );

    observer.observe(sentinelRef);

    return () => {
      observer.disconnect();
    };
  });

  onMount(() => {
    // Load summary and first page of detections in parallel
    loadSummary();
    loadDetections();
  });
</script>

<div class="flex flex-col gap-4 p-4 pb-24">
  <!-- Summary Section -->
  {#if summaryLoading}
    <div class="card bg-base-100 shadow-sm animate-pulse">
      <div class="card-body p-4">
        <div class="h-20 bg-base-200 rounded"></div>
      </div>
    </div>
  {:else if summaryError}
    <div class="alert alert-error">
      <span>{summaryError}</span>
      <button class="btn btn-sm" onclick={loadSummary}>{t('common.ui.retry')}</button>
    </div>
  {:else if summary}
    <DashboardSummaryCard
      totalDetections={summary.totalDetections}
      uniqueSpecies={summary.uniqueSpecies}
      topSpecies={summary.topSpecies}
    />
  {/if}

  <!-- Today's Detections Section -->
  <div class="card bg-base-100 shadow-sm">
    <div class="card-body p-4">
      <!-- Section Header -->
      <div class="flex items-center justify-between mb-2">
        <h2 class="card-title text-base flex items-center gap-2">
          {t('dashboard.todaysDetections.title')}
          {#if totalDetections > 0}
            <span class="badge badge-primary badge-sm font-medium">
              {totalDetections}
            </span>
          {/if}
        </h2>
      </div>

      <!-- Detections List -->
      {#if detectionsLoading && detections.length === 0}
        <div class="flex flex-col gap-3 py-4">
          {#each [1, 2, 3] as _i}
            <div class="flex items-center gap-3 animate-pulse">
              <div class="w-12 h-12 bg-base-200 rounded-lg"></div>
              <div class="flex-1">
                <div class="h-4 bg-base-200 rounded w-3/4 mb-2"></div>
                <div class="h-3 bg-base-200 rounded w-1/4"></div>
              </div>
            </div>
          {/each}
        </div>
      {:else if detectionsError}
        <div class="alert alert-error">
          <span>{detectionsError}</span>
          <button class="btn btn-sm" onclick={() => loadDetections()}>{t('common.ui.retry')}</button
          >
        </div>
      {:else}
        <div class="divide-y divide-base-200 -mx-4">
          {#each detections as detection (detection.id)}
            <DetectionRow
              {detection}
              expanded={expandedId === detection.id}
              isPlaying={$currentlyPlayingId === detection.id && $isPlaying}
              onToggle={() => toggleExpanded(detection.id)}
              onPlay={() => handlePlay(detection)}
              onVerify={() => handleVerify(detection)}
              onDismiss={() => handleDismiss(detection)}
            />
          {/each}

          {#if detections.length === 0 && !detectionsLoading}
            <div class="text-center py-12 text-base-content/60">
              <div class="text-4xl mb-2">🐦</div>
              <p>{t('dashboard.todaysDetections.noDetections')}</p>
              <p class="text-sm mt-1">{t('dashboard.todaysDetections.checkBackLater')}</p>
            </div>
          {/if}
        </div>

        <!-- Infinite scroll sentinel and loading indicator -->
        {#if detections.length > 0}
          <div bind:this={sentinelRef} class="flex justify-center py-4">
            {#if loadingMore}
              <span class="loading loading-spinner loading-sm text-primary"></span>
            {:else if !hasMore}
              <p class="text-sm text-base-content/50">
                {t('dashboard.todaysDetections.allLoaded')}
              </p>
            {/if}
          </div>
        {/if}
      {/if}
    </div>
  </div>

  <!-- Hidden audio player - manages playback -->
  <MobileAudioPlayer />
</div>
