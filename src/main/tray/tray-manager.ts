import { Tray, Menu, nativeImage, app, BrowserWindow, type NativeImage } from 'electron';
import { join } from 'node:path';
import type { Controls } from '@main/media/controls';

export interface TrayManager {
  init(): void;
  setPlaying(isPlaying: boolean): void;
  destroy(): void;
}

export function createTrayManager(opts: {
  window: BrowserWindow;
  controls: Controls;
  onShowMiniPlayer: () => void;
  onOpenScDevTools?: () => void;
  resourcesDir: string;
}): TrayManager {
  let tray: Tray | null = null;
  let isPlaying = false;

  const buildMenu = () => Menu.buildFromTemplate([
    { label: 'Show / Hide', click: () => opts.window.isVisible() ? opts.window.hide() : opts.window.show() },
    { label: 'Mini-player', click: () => opts.onShowMiniPlayer() },
    { type: 'separator' },
    { label: isPlaying ? 'Pause' : 'Play', click: () => opts.controls.togglePlayPause() },
    { label: 'Next', click: () => opts.controls.next() },
    { label: 'Previous', click: () => opts.controls.prev() },
    { type: 'separator' },
    ...(opts.onOpenScDevTools ? [{ label: 'Open SC DevTools', click: opts.onOpenScDevTools }] : []),
    {
      label: 'Quit SoundDesk',
      click: () => {
        (app as unknown as { isQuiting: boolean }).isQuiting = true;
        app.quit();
      }
    }
  ]);

  return {
    init() {
      const raw = nativeImage.createFromPath(join(opts.resourcesDir, 'tray-icon.png'));
      const icon: NativeImage = raw.isEmpty() ? nativeImage.createEmpty() : raw.resize({ width: 16, height: 16 });
      tray = new Tray(icon);
      tray.setToolTip('SoundDesk');
      tray.setContextMenu(buildMenu());
      tray.on('click', () => opts.window.isVisible() ? opts.window.focus() : opts.window.show());
    },
    setPlaying(v) {
      isPlaying = v;
      tray?.setContextMenu(buildMenu());
    },
    destroy() {
      tray?.destroy();
      tray = null;
    }
  };
}
