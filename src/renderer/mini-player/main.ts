import type { TrackState } from '@shared/types';

declare global {
  interface Window {
    miniPlayerApi: {
      onState: (cb: (s: { track: TrackState | null; positionMs: number }) => void) => void;
      command: (cmd: 'play-pause' | 'next' | 'prev' | 'volume', value?: number) => void;
    };
  }
}

const $art = document.getElementById('art') as HTMLImageElement;
const $title = document.querySelector('#title span') as HTMLElement;
const $artist = document.querySelector('#artist span') as HTMLElement;
const $bar = document.getElementById('bar')!;
const $playpause = document.getElementById('playpause')!;
document.getElementById('prev')!.addEventListener('click', () => window.miniPlayerApi.command('prev'));
document.getElementById('next')!.addEventListener('click', () => window.miniPlayerApi.command('next'));
$playpause.addEventListener('click', () => window.miniPlayerApi.command('play-pause'));
document.getElementById('close')!.addEventListener('click', () => window.close());

let lastTrack: TrackState | null = null;
let lastPositionMs = 0;
let lastTickWallClockMs = Date.now();

window.miniPlayerApi.onState((s) => {
  lastTrack = s.track;
  lastPositionMs = s.positionMs;
  lastTickWallClockMs = Date.now();
  render();
});

function setScrollText(el: HTMLElement, text: string): void {
  if (el.textContent === text) return;
  el.textContent = text;
  el.classList.remove('scroll');
  const container = el.parentElement!;
  requestAnimationFrame(() => {
    if (container.scrollWidth > container.clientWidth) {
      container.style.setProperty('--mx', `-${container.scrollWidth - container.clientWidth}px`);
      el.classList.add('scroll');
    }
  });
}

function render() {
  if (!lastTrack) {
    setScrollText($title, 'No track playing');
    setScrollText($artist, '');
    $bar.style.width = '0%';
    $playpause.textContent = '▶';
    $art.removeAttribute('src');
    return;
  }

  setScrollText($title, lastTrack.title ?? 'Unknown');
  setScrollText($artist, lastTrack.artist ?? '');
  $playpause.textContent = lastTrack.isPlaying ? '⏸' : '▶';

  if (lastTrack.artworkUrl && $art.src !== lastTrack.artworkUrl) {
    $art.src = lastTrack.artworkUrl;
  }

  const dur = lastTrack.durationMs ?? 0;
  const elapsed = lastTrack.isPlaying ? Date.now() - lastTickWallClockMs : 0;
  const pos = lastPositionMs + elapsed;
  const pct = dur > 0 ? Math.min(100, (pos / dur) * 100) : 0;
  $bar.style.width = `${pct}%`;
}

setInterval(render, 250);
