import { Tray, Menu, nativeImage, app, BrowserWindow } from 'electron';
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
      const icon = nativeImage.createFromPath(join(opts.resourcesDir, 'tray-icon.png'));
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
