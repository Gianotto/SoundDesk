import { contextBridge, ipcRenderer } from 'electron';
import { CHANNELS } from '@shared/channels';
import { SELECTORS, resolve } from './selectors';
import { scrapeTrack, scrapePlayState, scrapePosition, healthCheck } from './scraper';

const SEEK_THRESHOLD_MS = 1500;
const SEEK_POLL_INTERVAL_MS = 1000;

let lastTrackId: string | null = null;
let lastPlayState: 'playing' | 'paused' | 'unknown' = 'unknown';
let lastSentPositionMs = 0;
let lastSentWallClockMs = Date.now();

function emitTrack(): void {
  const t = scrapeTrack();
  if (!t) return;

  const ps = t.isPlaying ? 'playing' : 'paused';
  const trackChanged = t.trackId !== lastTrackId;
  const playStateChanged = ps !== lastPlayState;

  if (trackChanged) {
    lastTrackId = t.trackId;
    ipcRenderer.send(CHANNELS.TRACK_CHANGE, { ...t, positionWallClockMs: Date.now() });
  }

  if (playStateChanged) {
    lastPlayState = ps;
    ipcRenderer.send(CHANNELS.PLAY_STATE_CHANGE, {
      isPlaying: t.isPlaying,
      positionMs: t.positionMs,
      positionWallClockMs: Date.now()
    });
  }

  lastSentPositionMs = t.positionMs;
  lastSentWallClockMs = Date.now();
}

function emitSeekIfJumped(): void {
  const actual = scrapePosition();
  if (actual == null) return;
  const elapsed = lastPlayState === 'playing' ? Date.now() - lastSentWallClockMs : 0;
  const predicted = lastSentPositionMs + elapsed;
  if (Math.abs(actual - predicted) > SEEK_THRESHOLD_MS) {
    lastSentPositionMs = actual;
    lastSentWallClockMs = Date.now();
    ipcRenderer.send(CHANNELS.SEEK_DETECTED, {
      positionMs: actual,
      positionWallClockMs: lastSentWallClockMs
    });
  }
}

function emitHealth(): void {
  ipcRenderer.send(CHANNELS.SCRAPER_HEALTH, healthCheck());
}

function startObserving(): void {
  const observer = new MutationObserver(() => emitTrack());
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class', 'aria-label', 'title']
  });

  setInterval(emitSeekIfJumped, SEEK_POLL_INTERVAL_MS);
  emitTrack();
  emitHealth();
  setTimeout(emitHealth, 5000);
}

function click(selectorKey: keyof typeof SELECTORS): void {
  const el = resolve(SELECTORS[selectorKey]) as HTMLElement | null;
  el?.click();
}

contextBridge.exposeInMainWorld('scBridge', {
  healthCheck
});

ipcRenderer.on(CHANNELS.CONTROL_PLAY, () => click('playPauseButton'));
ipcRenderer.on(CHANNELS.CONTROL_PAUSE, () => click('playPauseButton'));
ipcRenderer.on(CHANNELS.CONTROL_NEXT, () => click('nextButton'));
ipcRenderer.on(CHANNELS.CONTROL_PREV, () => click('prevButton'));

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  startObserving();
} else {
  document.addEventListener('DOMContentLoaded', startObserving);
}
