export type PlayState = 'playing' | 'paused' | 'unknown';

export interface TrackState {
  title: string | null;
  artist: string | null;
  artworkUrl: string | null;
  durationMs: number | null;
  positionMs: number;
  positionWallClockMs: number;
  isPlaying: boolean;
  trackId: string;
}

export interface ShortcutBinding {
  action: 'play-pause' | 'next' | 'prev' | 'mini-player-toggle';
  accelerator: string;
}

export interface ShortcutConfig {
  bindings: ShortcutBinding[];
}

export interface ScraperHealth {
  ok: boolean;
  missingSelectors: string[];
}
