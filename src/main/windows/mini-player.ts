import { BrowserWindow, ipcMain, app } from 'electron';
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
  let lastState: { track: TrackState | null; positionMs: number } | null = null;

  const sendState = (w: BrowserWindow) => {
    if (lastState) w.webContents.send(CHANNELS.MINI_PLAYER_STATE, lastState);
  };

  const ensureWindow = () => {
    if (win) return win;
    const iconBase = app.isPackaged ? process.resourcesPath : join(process.cwd(), 'resources');
    const iconFile = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
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
      icon: join(iconBase, iconFile),
      webPreferences: {
        preload: join(__dirname, '../preload/mini-player-preload.js'),
        contextIsolation: true,
        sandbox: false
      }
    });
    win.on('closed', () => { win = null; });
    // push cached state once the renderer is ready
    win.webContents.once('did-finish-load', () => { if (win) sendState(win); });
    if (process.env['ELECTRON_RENDERER_URL']) {
      win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/mini-player/index.html`);
    } else {
      win.loadFile(join(__dirname, '../renderer/mini-player/index.html'));
    }
    return win;
  };

  ipcMain.on(CHANNELS.MINI_PLAYER_COMMAND, (_e, cmd: string, value?: number) => {
    if (cmd === 'play-pause') opts.controls.togglePlayPause();
    else if (cmd === 'next') opts.controls.next();
    else if (cmd === 'prev') opts.controls.prev();
    else if (cmd === 'volume' && value != null) opts.controls.setVolume(value);
  });

  return {
    show() {
      const w = ensureWindow();
      w.show();
      sendState(w);
    },
    hide() { win?.hide(); },
    toggle() {
      if (win?.isVisible()) {
        win.hide();
      } else {
        const w = ensureWindow();
        w.show();
        sendState(w);
      }
    },
    pushState(track, positionMs) {
      lastState = { track, positionMs };
      win?.webContents.send(CHANNELS.MINI_PLAYER_STATE, lastState);
    },
    destroy() { win?.close(); win = null; }
  };
}
