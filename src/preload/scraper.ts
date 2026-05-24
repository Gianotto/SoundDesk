import { SELECTORS, resolve } from './selectors';
import type { TrackState, PlayState, ScraperHealth } from '@shared/types';

export function scrapeTrack(): Omit<TrackState, 'positionWallClockMs'> | null {
  const titleEl = resolve(SELECTORS.trackTitle);
  const artistEl = resolve(SELECTORS.trackArtist);
  if (!titleEl) return null;

  const title = titleEl.textContent?.trim() ?? null;
  const artist = artistEl?.textContent?.trim() ?? null;
  const artworkUrl = extractArtwork();
  const durationMs = parseTimeMs(resolve(SELECTORS.duration)?.textContent);
  const positionMs = parseTimeMs(resolve(SELECTORS.position)?.textContent) ?? 0;
  const isPlaying = scrapePlayState() === 'playing';

  return {
    title,
    artist,
    artworkUrl,
    durationMs,
    positionMs,
    isPlaying,
    trackId: makeTrackId(title, artist, durationMs)
  };
}

export function scrapePlayState(): PlayState {
  const btn = resolve(SELECTORS.playPauseButton);
  if (!btn) return 'unknown';
  const cls = btn.className ?? '';
  if (/\bplaying\b/.test(cls)) return 'playing';
  return 'paused';
}

export function scrapePosition(): number | null {
  return parseTimeMs(resolve(SELECTORS.position)?.textContent);
}

export function healthCheck(): ScraperHealth {
  const missing: string[] = [];
  for (const [name, spec] of Object.entries(SELECTORS) as [string, typeof SELECTORS[keyof typeof SELECTORS]][]) {
    if (!resolve(spec)) missing.push(name);
  }
  return { ok: missing.length === 0, missingSelectors: missing };
}

function extractArtwork(): string | null {
  const el = resolve(SELECTORS.trackArtwork) as HTMLElement | null;
  if (!el) return null;
  const bg = el.style.backgroundImage ?? '';
  const m = bg.match(/url\(["']?(.+?)["']?\)/);
  return m?.[1] ?? null;
}

function parseTimeMs(text: string | null | undefined): number | null {
  if (!text) return null;
  const parts = text.trim().split(':').map(Number);
  if (parts.some(Number.isNaN)) return null;
  let s = 0;
  for (const p of parts) s = s * 60 + (p ?? 0);
  return s * 1000;
}

function makeTrackId(title: string | null, artist: string | null, duration: number | null): string {
  return `${title ?? '?'}::${artist ?? '?'}::${duration ?? 0}`;
}
