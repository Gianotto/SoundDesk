import type { TrackState } from '@shared/types';
import type { Controls } from './controls';
import type { Logger } from '@main/logger';

export interface MprisAdapter {
  update(track: TrackState, positionMs: number): void;
  shutdown(): void;
}

export function createMprisAdapter(opts: { controls: Controls; logger: Logger }): MprisAdapter | null {
  if (process.platform !== 'linux') return null;

  let player: unknown;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const MprisService = require('mpris-service') as new (opts: unknown) => unknown;
    player = new MprisService({
      name: 'sounddesk',
      identity: 'SoundDesk',
      supportedInterfaces: ['player'],
      supportedMimeTypes: [],
      supportedUriSchemes: []
    });
    const p = player as {
      on: (ev: string, cb: () => void) => void;
      playbackStatus: string;
      metadata: Record<string, unknown>;
    };
    p.on('play', () => opts.controls.play());
    p.on('pause', () => opts.controls.pause());
    p.on('playpause', () => opts.controls.togglePlayPause());
    p.on('next', () => opts.controls.next());
    p.on('previous', () => opts.controls.prev());
  } catch (err) {
    opts.logger.warn('MPRIS unavailable (D-Bus missing?)', { err: (err as Error).message });
    return null;
  }

  return {
    update(track, _positionMs) {
      const p = player as { playbackStatus: string; metadata: Record<string, unknown> };
      p.playbackStatus = track.isPlaying ? 'Playing' : 'Paused';
      p.metadata = {
        'mpris:trackid': '/org/mpris/MediaPlayer2/Track/1',
        'mpris:length': (track.durationMs ?? 0) * 1000,
        'xesam:title': track.title ?? '',
        'xesam:artist': track.artist ? [track.artist] : [],
        'mpris:artUrl': track.artworkUrl ?? ''
      };
    },
    shutdown() {
      // mpris-service doesn't expose a clean dispose; rely on process exit.
    }
  };
}
