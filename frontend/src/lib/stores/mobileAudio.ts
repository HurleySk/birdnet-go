/**
 * Mobile Audio Store
 *
 * Manages audio playback state for mobile UI.
 * Only one detection can play at a time.
 */

import { writable, get } from 'svelte/store';
import { getLogger } from '$lib/utils/logger';

const logger = getLogger('mobile-audio');

// Currently playing detection ID (null = nothing selected)
export const currentlyPlayingId = writable<number | null>(null);

// Whether audio is actively playing (not paused)
export const isPlaying = writable<boolean>(false);

// Audio element reference (managed by MobileAudioPlayer component)
let audioElement: HTMLAudioElement | null = null;

/**
 * Register the audio element for central control
 */
export function registerAudioElement(element: HTMLAudioElement | null) {
  audioElement = element;
}

/**
 * Start playing a detection's audio
 * @param id - Detection ID to play
 */
export function playDetection(id: number) {
  const current = get(currentlyPlayingId);

  // If same detection, toggle pause/play
  if (current === id && audioElement) {
    if (audioElement.paused) {
      audioElement.play().catch(err => {
        logger.error('Failed to resume playback', err);
      });
      isPlaying.set(true);
    } else {
      audioElement.pause();
      isPlaying.set(false);
    }
    return;
  }

  // Different detection - stop current and start new
  logger.debug('Playing detection', { id });
  currentlyPlayingId.set(id);
  isPlaying.set(true);
}

/**
 * Stop all playback
 */
export function stopPlayback() {
  logger.debug('Stopping playback');
  if (audioElement) {
    audioElement.pause();
    audioElement.currentTime = 0;
  }
  currentlyPlayingId.set(null);
  isPlaying.set(false);
}

/**
 * Check if a specific detection is currently playing
 */
export function isDetectionPlaying(id: number): boolean {
  return get(currentlyPlayingId) === id;
}
