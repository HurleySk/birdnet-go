<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Chart from 'chart.js/auto';
  import { getChartTheme } from '$lib/utils/chartHelpers';

  interface DailyData {
    date: string;
    count: number;
  }

  interface Props {
    data: DailyData[];
    isLoading?: boolean;
  }

  let { data = [], isLoading = false }: Props = $props();

  // svelte-ignore non_reactive_update
  let canvasElement: HTMLCanvasElement;
  let chart: Chart | null = null;
  let mounted = $state(false);

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
  }

  function formatFullDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  function getGradient(
    ctx: globalThis.CanvasRenderingContext2D,
    chartArea: { top: number; bottom: number }
  ) {
    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    // Forest-inspired gradient: deep teal fading to soft mint
    gradient.addColorStop(0, 'rgba(20, 184, 166, 0.85)'); // Teal
    gradient.addColorStop(0.5, 'rgba(52, 211, 153, 0.65)'); // Emerald
    gradient.addColorStop(1, 'rgba(167, 243, 208, 0.4)'); // Mint
    return gradient;
  }

  function createChart() {
    if (!canvasElement || !data.length) return;

    const theme = getChartTheme();
    const ctx = canvasElement.getContext('2d');
    if (!ctx) return;

    // Sort by date and take last 7 days
    const sortedData = [...data].sort((a, b) => a.date.localeCompare(b.date)).slice(-7);

    const labels = sortedData.map(d => formatDate(d.date));
    const counts = sortedData.map(d => d.count);
    const fullDates = sortedData.map(d => formatFullDate(d.date));

    // Find peak day for highlight
    const maxCount = Math.max(...counts);
    const peakIndex = counts.indexOf(maxCount);

    chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            data: counts,
            backgroundColor: function (context) {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return 'rgba(20, 184, 166, 0.7)';

              // Highlight peak day with deeper color
              if (context.dataIndex === peakIndex && maxCount > 0) {
                const peakGradient = ctx.createLinearGradient(
                  0,
                  chartArea.top,
                  0,
                  chartArea.bottom
                );
                peakGradient.addColorStop(0, 'rgba(13, 148, 136, 0.95)');
                peakGradient.addColorStop(1, 'rgba(20, 184, 166, 0.7)');
                return peakGradient;
              }
              return getGradient(ctx, chartArea);
            },
            borderRadius: 6,
            borderSkipped: false,
            barPercentage: 0.7,
            categoryPercentage: 0.8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 600,
          easing: 'easeOutQuart',
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            ...theme.tooltip,
            callbacks: {
              title: items => {
                return fullDates[items[0].dataIndex];
              },
              label: context => {
                const count = context.parsed.y;
                const label = count === 1 ? 'detection' : 'detections';
                return `${count} ${label}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: {
              display: false,
            },
            ticks: {
              color: theme.color.text,
              font: {
                size: 11,
                weight: 500,
              },
            },
            border: {
              display: false,
            },
          },
          y: {
            display: false,
            beginAtZero: true,
            grid: {
              display: false,
            },
          },
        },
      },
    });
  }

  function updateChart() {
    if (!chart || !data.length) return;

    const sortedData = [...data].sort((a, b) => a.date.localeCompare(b.date)).slice(-7);

    chart.data.labels = sortedData.map(d => formatDate(d.date));
    chart.data.datasets[0].data = sortedData.map(d => d.count);
    chart.update('none');
  }

  function destroyChart() {
    if (chart) {
      chart.destroy();
      chart = null;
    }
  }

  onMount(() => {
    mounted = true;
    if (data.length > 0) {
      createChart();
    }
  });

  onDestroy(() => {
    destroyChart();
  });

  // React to data changes
  $effect(() => {
    if (!mounted) return;

    const currentData = data;
    void currentData.length;

    if (chart) {
      updateChart();
    } else if (currentData.length > 0) {
      createChart();
    }
  });
</script>

<div class="mobile-daily-chart">
  {#if isLoading}
    <div class="chart-skeleton">
      <div class="skeleton-bars">
        {#each Array(7) as _, i}
          <div
            class="skeleton-bar"
            style:height="{30 + Math.random() * 50}%"
            style:animation-delay="{i * 80}ms"
          ></div>
        {/each}
      </div>
    </div>
  {:else if data.length === 0}
    <div class="empty-state">
      <span class="empty-text">No daily data available</span>
    </div>
  {:else}
    <canvas bind:this={canvasElement}></canvas>
  {/if}
</div>

<style>
  .mobile-daily-chart {
    width: 100%;
    height: 192px;
    position: relative;
  }

  canvas {
    width: 100% !important;
    height: 100% !important;
  }

  .chart-skeleton {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: flex-end;
    padding: 0 1rem;
  }

  .skeleton-bars {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    width: 100%;
    height: 100%;
  }

  .skeleton-bar {
    flex: 1;
    background: linear-gradient(180deg, oklch(var(--b3)) 0%, oklch(var(--b2)) 100%);
    border-radius: 6px;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.4;
    }

    50% {
      opacity: 0.7;
    }
  }

  .empty-state {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .empty-text {
    color: oklch(var(--bc) / 0.4);
    font-size: 0.875rem;
  }
</style>
