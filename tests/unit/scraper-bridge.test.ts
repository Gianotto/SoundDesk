import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { CHANNELS } from '../../src/shared/channels';
import { createScraperBridge } from '../../src/main/media/scraper-bridge';

class FakeIpcMain extends EventEmitter {
  fire(ch: string, payload: unknown) { this.emit(ch, {}, payload); }
}

describe('scraper-bridge', () => {
  it('routes TRACK_CHANGE IPC to trackChange listeners', () => {
    const ipc = new FakeIpcMain();
    const bridge = createScraperBridge(ipc as unknown as Electron.IpcMain);
    const cb = vi.fn();
    bridge.on('trackChange', cb);

    const payload = {
      title: 'A', artist: 'B', artworkUrl: null, durationMs: 1000,
      positionMs: 0, positionWallClockMs: 1, isPlaying: true, trackId: 't1'
    };
    ipc.fire(CHANNELS.TRACK_CHANGE, payload);

    expect(cb).toHaveBeenCalledWith(payload);
  });

  it('routes PLAY_STATE_CHANGE and SEEK_DETECTED', () => {
    const ipc = new FakeIpcMain();
    const bridge = createScraperBridge(ipc as unknown as Electron.IpcMain);
    const onPlay = vi.fn();
    const onSeek = vi.fn();
    bridge.on('playStateChange', onPlay);
    bridge.on('seek', onSeek);

    ipc.fire(CHANNELS.PLAY_STATE_CHANGE, { isPlaying: false, positionMs: 100, positionWallClockMs: 2 });
    ipc.fire(CHANNELS.SEEK_DETECTED, { positionMs: 500, positionWallClockMs: 3 });

    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(onSeek).toHaveBeenCalledTimes(1);
  });
});
