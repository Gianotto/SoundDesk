import type { TrackState } from '@shared/types';

declare global {
  interface Window {
    miniPlayerApi: {
      onState: (cb: (s: { track: TrackState | null; positionMs: number }) => void) => void;
      command: (cmd: 'play-pause' | 'next' | 'prev') => void;
    };
  }
}

const $art = document.getElementById('art') as HTMLImageElement;
const $title = document.getElementById('title')!;
const $artist = document.getElementById('artist')!;
const $bar = document.getElementById('bar')!;
const $playpause = document.getElementById('playpause')!;

document.getElementById('prev')!.addEventListener('click', () => window.miniPlayerApi.command('prev'));
document.getElementById('next')!.addEventListener('click', () => window.miniPlayerApi.command('next'));
$playpause.addEventListener('click', () => window.miniPlayerApi.command('play-pause'));

let lastTrack: TrackState | null = null;
let lastPositionMs = 0;
let lastTickWallClockMs = Date.now();

window.miniPlayerApi.onState((s) => {
  lastTrack = s.track;
  lastPositionMs = s.positionMs;
  lastTickWallClockMs = Date.now();
  render();
});

function render() {
  if (!lastTrack) {
    $title.textContent = 'No track playing';
    $artist.textContent = '';
    $bar.style.width = '0%';
    $playpause.textContent = '▶';
    $art.removeAttribute('src');
    return;
  }
  $title.textContent = lastTrack.title ?? 'Unknown';
  $artist.textContent = lastTrack.artist ?? '';
  $playpause.textContent = lastTrack.isPlaying ? '⏸' : '▶';
  if (lastTrack.artworkUrl) $art.src = lastTrack.artworkUrl;
  const dur = lastTrack.durationMs ?? 0;
  const elapsed = lastTrack.isPlaying ? Date.now() - lastTickWallClockMs : 0;
  const pos = lastPositionMs + elapsed;
  const pct = dur > 0 ? Math.min(100, (pos / dur) * 100) : 0;
  $bar.style.width = pct + '%';
}

setInterval(render, 250);
