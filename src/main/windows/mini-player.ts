import { BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';
import type { Controls } from '@main/media/controls';
import { CHANNELS } from '@shared/channels';
import type { TrackState } from '@shared/types';

export interface MiniPlayer {
  show(): void;
  hide(): void;
  toggle(): void;
  pushState(track: TrackState | null, positionMs: number): void;
  destroy(): void;
}

export function createMiniPlayer(opts: { controls: Controls }): MiniPlayer {
  let win: BrowserWindow | null = null;

  const ensureWindow = () => {
    if (win) return win;
    win = new BrowserWindow({
      width: 380,
      height: 110,
      alwaysOnTop: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      autoHideMenuBar: true,
      frame: false,
      webPreferences: {
        preload: join(__dirname, '../preload/mini-player-preload.js'),
        contextIsolation: true
      }
    });
    win.on('closed', () => { win = null; });
    if (process.env['ELECTRON_RENDERER_URL']) {
      win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/mini-player/index.html`);
    } else {
      win.loadFile(join(__dirname, '../renderer/mini-player/index.html'));
    }
    return win;
  };

  ipcMain.on(CHANNELS.MINI_PLAYER_COMMAND, (_e, cmd: 'play-pause' | 'next' | 'prev') => {
    if (cmd === 'play-pause') opts.controls.togglePlayPause();
    else if (cmd === 'next') opts.controls.next();
    else if (cmd === 'prev') opts.controls.prev();
  });

  return {
    show() { ensureWindow().show(); },
    hide() { win?.hide(); },
    toggle() {
      if (win?.isVisible()) win.hide();
      else ensureWindow().show();
    },
    pushState(track, positionMs) {
      win?.webContents.send(CHANNELS.MINI_PLAYER_STATE, { track, positionMs });
    },
    destroy() { win?.close(); win = null; }
  };
}
