import type { WebContents } from 'electron';
import { CHANNELS } from '@shared/channels';

export interface Controls {
  play(): void;
  pause(): void;
  togglePlayPause(): void;
  next(): void;
  prev(): void;
  setKnownPlaying(isPlaying: boolean): void;
}

export function createControls(getTargetWebContents: () => WebContents | null): Controls {
  let knownPlaying = false;
  const send = (ch: string) => getTargetWebContents()?.send(ch);

  return {
    play() {
      if (knownPlaying) return;
      send(CHANNELS.CONTROL_PLAY);
      knownPlaying = true;
    },
    pause() {
      if (!knownPlaying) return;
      send(CHANNELS.CONTROL_PAUSE);
      knownPlaying = false;
    },
    togglePlayPause() {
      send(CHANNELS.CONTROL_PLAY);
      knownPlaying = !knownPlaying;
    },
    next() { send(CHANNELS.CONTROL_NEXT); },
    prev() { send(CHANNELS.CONTROL_PREV); },
    setKnownPlaying(v) { knownPlaying = v; }
  };
}
