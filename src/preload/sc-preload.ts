import { contextBridge, ipcRenderer } from 'electron';
import { CHANNELS } from '@shared/channels';
import { scrapeTrack, scrapePlayState, scrapePosition, healthCheck } from './scraper';

// Inject into main world before SC's scripts so we can track AudioContext gain nodes.
// The script tag executes synchronously in page context at preload time.
const gainPatch = document.createElement('script');
gainPatch.textContent = `(function(){
  var orig = AudioContext.prototype.createGain;
  AudioContext.prototype.createGain = function() {
    var node = orig.call(this);
    (window.__sdGainNodes = window.__sdGainNodes || []).push(node);
    return node;
  };
})();`;
(document.head || document.documentElement).appendChild(gainPatch);
gainPatch.remove();

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

contextBridge.exposeInMainWorld('scBridge', {
  healthCheck
});

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  startObserving();
} else {
  document.addEventListener('DOMContentLoaded', startObserving);
}
