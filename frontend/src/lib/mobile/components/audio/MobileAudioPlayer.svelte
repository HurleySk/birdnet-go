<!--
  MobileAudioPlayer.svelte

  Lightweight audio player for mobile detection playback.
  Manages HTML5 audio element and syncs with mobileAudio store.

  This component is hidden - it only renders the audio element.
  UI controls are provided by parent components (e.g., DetectionRow).
-->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { getLogger } from '$lib/utils/logger';
  import { currentlyPlayingId, registerAudioElement, stopPlayback } from '$lib/stores/mobileAudio';

  const logger = getLogger('mobile-audio-player');

  interface Props {
    /** Called when playback ends naturally (not paused/stopped) */
    onPlayEnd?: () => void;
    /** Called when an error occurs */
    onError?: (_errorMsg: string) => void;
  }

  let { onPlayEnd, onError }: Props = $props();

  // Audio element reference
  let audioRef = $state<HTMLAudioElement | null>(null);

  // Playback state (intentionally unused in render - for error callbacks)
  // eslint-disable-next-line no-unused-vars
  let _isLoading = $state(false);
  // eslint-disable-next-line no-unused-vars
  let _error = $state<string | null>(null);

  // Computed audio URL based on currently playing ID
  let audioUrl = $derived(
    $currentlyPlayingId !== null ? `/api/v2/audio/${$currentlyPlayingId}` : ''
  );

  // Register audio element with store when available
  $effect(() => {
    registerAudioElement(audioRef);
  });

  // Auto-play when detection ID changes
  $effect(() => {
    if ($currentlyPlayingId !== null && audioRef) {
      _isLoading = true;
      _error = null;
      // Audio element will auto-play when src changes and loads
      audioRef.load();
    }
  });

  function handleCanPlay() {
    _isLoading = false;
    if (audioRef && $currentlyPlayingId !== null) {
      audioRef.play().catch(err => {
        logger.error('Failed to start playback', err);
        _error = 'Failed to play audio';
        onError?.('Failed to play audio');
      });
    }
  }

  function handleEnded() {
    logger.debug('Playback ended');
    stopPlayback();
    onPlayEnd?.();
  }

  function handleError() {
    const audioError = audioRef?.error;
    let errorMsg = 'Failed to load audio';

    if (audioError) {
      switch (audioError.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          errorMsg = 'Playback aborted';
          break;
        case MediaError.MEDIA_ERR_NETWORK:
          errorMsg = 'Network error';
          break;
        case MediaError.MEDIA_ERR_DECODE:
          errorMsg = 'Audio format not supported';
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMsg = 'Audio not available';
          break;
      }
    }

    logger.error('Audio error', { error: errorMsg, code: audioError?.code });
    _error = errorMsg;
    _isLoading = false;
    onError?.(errorMsg);
    stopPlayback();
  }

  onDestroy(() => {
    // Clean up audio element registration
    registerAudioElement(null);
  });
</script>

<!-- Hidden audio element - UI controls are in parent components -->
{#if $currentlyPlayingId !== null}
  <audio
    bind:this={audioRef}
    src={audioUrl}
    preload="auto"
    oncanplay={handleCanPlay}
    onended={handleEnded}
    onerror={handleError}
    class="hidden"
  ></audio>
{/if}
