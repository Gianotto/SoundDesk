import { EventEmitter } from 'node:events';
import type { IpcMain } from 'electron';
import { CHANNELS } from '@shared/channels';
import type { TrackState, ScraperHealth } from '@shared/types';

export type PlayStateUpdate = { isPlaying: boolean; positionMs: number; positionWallClockMs: number };
export type SeekUpdate = { positionMs: number; positionWallClockMs: number };

interface Events {
  trackChange: (t: TrackState) => void;
  playStateChange: (u: PlayStateUpdate) => void;
  seek: (u: SeekUpdate) => void;
  health: (h: ScraperHealth) => void;
}

export interface ScraperBridge {
  on<E extends keyof Events>(event: E, listener: Events[E]): void;
  off<E extends keyof Events>(event: E, listener: Events[E]): void;
}

export function createScraperBridge(ipc: IpcMain): ScraperBridge {
  const emitter = new EventEmitter();

  ipc.on(CHANNELS.TRACK_CHANGE, (_e, payload: TrackState) => emitter.emit('trackChange', payload));
  ipc.on(CHANNELS.PLAY_STATE_CHANGE, (_e, payload: PlayStateUpdate) => emitter.emit('playStateChange', payload));
  ipc.on(CHANNELS.SEEK_DETECTED, (_e, payload: SeekUpdate) => emitter.emit('seek', payload));
  ipc.on(CHANNELS.SCRAPER_HEALTH, (_e, payload: ScraperHealth) => emitter.emit('health', payload));

  return {
    on: (ev, fn) => { emitter.on(ev, fn as (...args: unknown[]) => void); },
    off: (ev, fn) => { emitter.off(ev, fn as (...args: unknown[]) => void); }
  };
}
