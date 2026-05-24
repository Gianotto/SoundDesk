import { app, ipcMain } from 'electron';
import { join } from 'node:path';
import { createMainWindow, type MainWindowHandles } from '@main/windows/main-window';
import { createLogger, type Logger } from '@main/logger';
import { createConfigStore, type ConfigStore } from '@main/config/store';
import { createScraperBridge, type ScraperBridge } from '@main/media/scraper-bridge';
import { createLocalClock, type LocalClock } from '@main/media/local-clock';
import { createControls, type Controls } from '@main/media/controls';
import type { TrackState } from '@shared/types';

export interface AppContext {
  handles: MainWindowHandles;
  logger: Logger;
  config: ConfigStore;
  bridge: ScraperBridge;
  clock: LocalClock;
  controls: Controls;
  currentTrack: { value: TrackState | null };
}

export async function start(): Promise<AppContext | undefined> {
  const logger = createLogger({ dir: join(app.getPath('userData'), 'logs') });
  logger.info('app starting', { version: app.getVersion() });

  if (!app.requestSingleInstanceLock()) {
    logger.info('another instance already running');
    app.quit();
    return;
  }

  await app.whenReady();

  const config = createConfigStore();
  const handles = createMainWindow();
  const bridge = createScraperBridge(ipcMain);
  const clock = createLocalClock();
  const controls = createControls(() => handles.view.webContents);
  const currentTrack: { value: TrackState | null } = { value: null };

  bridge.on('trackChange', (t) => {
    logger.info('track change', { title: t.title, artist: t.artist });
    currentTrack.value = t;
    clock.sync({ positionMs: t.positionMs, wallClockMs: t.positionWallClockMs, isPlaying: t.isPlaying });
    controls.setKnownPlaying(t.isPlaying);
  });

  bridge.on('playStateChange', (u) => {
    clock.sync({ positionMs: u.positionMs, wallClockMs: u.positionWallClockMs, isPlaying: u.isPlaying });
    controls.setKnownPlaying(u.isPlaying);
    if (currentTrack.value) {
      currentTrack.value = {
        ...currentTrack.value,
        isPlaying: u.isPlaying,
        positionMs: u.positionMs,
        positionWallClockMs: u.positionWallClockMs
      };
    }
  });

  bridge.on('seek', (u) => {
    const playing = currentTrack.value?.isPlaying ?? false;
    clock.sync({ positionMs: u.positionMs, wallClockMs: u.positionWallClockMs, isPlaying: playing });
    if (currentTrack.value) {
      currentTrack.value = {
        ...currentTrack.value,
        positionMs: u.positionMs,
        positionWallClockMs: u.positionWallClockMs
      };
    }
  });

  bridge.on('health', (h) => {
    if (!h.ok) logger.warn('scraper health degraded', h);
  });

  app.on('second-instance', () => {
    if (handles.window.isMinimized()) handles.window.restore();
    handles.window.focus();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  return { handles, logger, config, bridge, clock, controls, currentTrack };
}
