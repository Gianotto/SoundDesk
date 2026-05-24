/**
 * Single source of truth for SoundCloud DOM selectors.
 * When SC ships a frontend change, edit only this file.
 *
 * Each entry has a primary selector and optional ordered fallbacks
 * tried in order until one resolves.
 *
 * IMPORTANT: These selectors must be verified against the live
 * soundcloud.com page before relying on them. See Task 6 in the
 * implementation plan for the verification procedure.
 */
export interface SelectorSpec {
  primary: string;
  fallbacks?: string[];
}

export interface SelectorTable {
  trackTitle: SelectorSpec;
  trackArtist: SelectorSpec;
  trackArtwork: SelectorSpec;
  playPauseButton: SelectorSpec;
  nextButton: SelectorSpec;
  prevButton: SelectorSpec;
  progressBar: SelectorSpec;
  duration: SelectorSpec;
  position: SelectorSpec;
}

export const SELECTORS: SelectorTable = {
  trackTitle: {
    primary: '.playbackSoundBadge__titleLink span:nth-of-type(2)',
    fallbacks: ['.playbackSoundBadge__title']
  },
  trackArtist: {
    primary: '.playbackSoundBadge__lightLink',
    fallbacks: ['.playbackSoundBadge__avatar a']
  },
  trackArtwork: {
    primary: '.playbackSoundBadge .image__full',
    fallbacks: ['.playbackSoundBadge span.sc-artwork']
  },
  playPauseButton: {
    primary: '.playControl',
    fallbacks: [
      '.playControls__play',
      'button[aria-label="Play"], button[aria-label="Pause"]'
    ]
  },
  nextButton: {
    primary: '.skipControl__next',
    fallbacks: [
      '.playControls__next',
      'button[aria-label="Next"]'
    ]
  },
  prevButton: {
    primary: '.skipControl__previous',
    fallbacks: [
      '.playControls__prev',
      'button[aria-label="Previous"]'
    ]
  },
  progressBar: {
    primary: '.playbackTimeline__progressWrapper',
    fallbacks: []
  },
  duration: {
    primary: '.playbackTimeline__duration span[aria-hidden="false"]',
    fallbacks: ['.playbackTimeline__duration']
  },
  position: {
    primary: '.playbackTimeline__timePassed span[aria-hidden="false"]',
    fallbacks: ['.playbackTimeline__timePassed']
  }
};

export function resolve(spec: SelectorSpec, root: ParentNode = document): Element | null {
  const candidates = [spec.primary, ...(spec.fallbacks ?? [])];
  for (const sel of candidates) {
    const el = root.querySelector(sel);
    if (el) return el;
  }
  return null;
}
