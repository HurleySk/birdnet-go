<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Chart from 'chart.js/auto';
  import { getChartTheme } from '$lib/utils/chartHelpers';

  interface HourlyData {
    hour: number;
    count: number;
  }

  interface Props {
    data: HourlyData[];
    isLoading?: boolean;
  }

  let { data = [], isLoading = false }: Props = $props();

  // svelte-ignore non_reactive_update
  let canvasElement: HTMLCanvasElement;
  let chart: Chart | null = null;
  let mounted = $state(false);

  function formatHour(hour: number): string {
    if (hour === 0) return '12am';
    if (hour === 12) return '12pm';
    return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
  }

  function getGradient(
    ctx: globalThis.CanvasRenderingContext2D,
    chartArea: { top: number; bottom: number }
  ) {
    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    // Dawn-inspired gradient: warm amber fading to soft peach
    gradient.addColorStop(0, 'rgba(251, 146, 60, 0.85)'); // Warm amber
    gradient.addColorStop(0.5, 'rgba(251, 191, 36, 0.65)'); // Golden
    gradient.addColorStop(1, 'rgba(254, 215, 170, 0.4)'); // Soft peach
    return gradient;
  }

  function createChart() {
    if (!canvasElement || !data.length) return;

    const theme = getChartTheme();
    const ctx = canvasElement.getContext('2d');
    if (!ctx) return;

    // Ensure all 24 hours are represented
    const hourlyMap = new Map(data.map(d => [d.hour, d.count]));
    const labels = Array.from({ length: 24 }, (_, i) => i);
    const counts = labels.map(h => hourlyMap.get(h) ?? 0);

    // Find peak hour for highlight
    const maxCount = Math.max(...counts);
    const peakHour = counts.indexOf(maxCount);

    chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.map(h => formatHour(h)),
        datasets: [
          {
            data: counts,
            backgroundColor: function (context) {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return 'rgba(251, 146, 60, 0.7)';

              // Highlight peak hour with full opacity
              if (context.dataIndex === peakHour && maxCount > 0) {
                const peakGradient = ctx.createLinearGradient(
                  0,
                  chartArea.top,
                  0,
                  chartArea.bottom
                );
                peakGradient.addColorStop(0, 'rgba(234, 88, 12, 0.95)');
                peakGradient.addColorStop(1, 'rgba(251, 146, 60, 0.7)');
                return peakGradient;
              }
              return getGradient(ctx, chartArea);
            },
            borderRadius: 4,
            borderSkipped: false,
            barPercentage: 0.85,
            categoryPercentage: 0.9,
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
                const hour = labels[items[0].dataIndex];
                return formatHour(hour);
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
                size: 10,
              },
              maxRotation: 0,
              callback: function (_, index) {
                // Show only key hours: 12am, 6am, 12pm, 6pm
                if (index === 0 || index === 6 || index === 12 || index === 18) {
                  return formatHour(index);
                }
                return '';
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

    const hourlyMap = new Map(data.map(d => [d.hour, d.count]));
    const counts = Array.from({ length: 24 }, (_, i) => hourlyMap.get(i) ?? 0);

    chart.data.datasets[0].data = counts;
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

<div class="mobile-hourly-chart">
  {#if isLoading}
    <div class="chart-skeleton">
      <div class="skeleton-bars">
        {#each Array(12) as _, i}
          <div
            class="skeleton-bar"
            style:height="{20 + Math.random() * 60}%"
            style:animation-delay="{i * 50}ms"
          ></div>
        {/each}
      </div>
    </div>
  {:else if data.length === 0}
    <div class="empty-state">
      <span class="empty-text">No hourly data available</span>
    </div>
  {:else}
    <canvas bind:this={canvasElement}></canvas>
  {/if}
</div>

<style>
  .mobile-hourly-chart {
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
    padding: 0 0.5rem;
  }

  .skeleton-bars {
    display: flex;
    align-items: flex-end;
    gap: 4px;
    width: 100%;
    height: 100%;
  }

  .skeleton-bar {
    flex: 1;
    background: linear-gradient(180deg, oklch(var(--b3)) 0%, oklch(var(--b2)) 100%);
    border-radius: 4px;
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
