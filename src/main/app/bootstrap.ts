import { app, ipcMain } from 'electron';
import { join } from 'node:path';
import { createMainWindow, type MainWindowHandles } from '@main/windows/main-window';
import { createLogger, type Logger } from '@main/logger';
import { createConfigStore, type ConfigStore } from '@main/config/store';
import { createScraperBridge, type ScraperBridge } from '@main/media/scraper-bridge';
import { createLocalClock, type LocalClock } from '@main/media/local-clock';
import { createControls, type Controls } from '@main/media/controls';
import { createMediaKeys, type MediaKeys } from '@main/media/media-keys';
import { createTrayManager, type TrayManager } from '@main/tray/tray-manager';
import { createNotifier } from '@main/integrations/notifier';
import { createMiniPlayer, type MiniPlayer } from '@main/windows/mini-player';
import { createMprisAdapter } from '@main/media/mpris-adapter';
import { createSmtcAdapter } from '@main/media/smtc-adapter';
import { createShortcutsManager } from '@main/media/shortcuts';
import { createUpdater } from '@main/update/updater';
import type { TrackState } from '@shared/types';

export interface AppContext {
  handles: MainWindowHandles;
  logger: Logger;
  config: ConfigStore;
  bridge: ScraperBridge;
  clock: LocalClock;
  controls: Controls;
  mediaKeys: MediaKeys;
  tray: TrayManager;
  miniPlayer: MiniPlayer;
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
  const notifier = createNotifier(logger, () => config.getNotificationsEnabled());
  const miniPlayer = createMiniPlayer({ controls });

  const resourcesDir = app.isPackaged
    ? join(process.resourcesPath)
    : join(process.cwd(), 'resources');

  const tray = createTrayManager({
    window: handles.window,
    controls,
    onShowMiniPlayer: () => miniPlayer.toggle(),
    resourcesDir
  });
  tray.init();

  const mediaKeys = createMediaKeys(controls, logger);
  mediaKeys.register();

  const mpris = createMprisAdapter({ controls, logger });
  const smtc = createSmtcAdapter({ controls, logger });

  const shortcuts = createShortcutsManager({
    controls,
    logger,
    onMiniPlayerToggle: () => miniPlayer.toggle()
  });
  shortcuts.apply(config.getShortcuts());

  bridge.on('trackChange', (t) => {
    logger.info('track change', { title: t.title, artist: t.artist });
    currentTrack.value = t;
    clock.sync({ positionMs: t.positionMs, wallClockMs: t.positionWallClockMs, isPlaying: t.isPlaying });
    controls.setKnownPlaying(t.isPlaying);
    tray.setPlaying(t.isPlaying);
    notifier.notify(t);
    miniPlayer.pushState(t, t.positionMs);
    mpris?.update(t, t.positionMs);
    smtc?.update(t, t.positionMs);
  });

  bridge.on('playStateChange', (u) => {
    clock.sync({ positionMs: u.positionMs, wallClockMs: u.positionWallClockMs, isPlaying: u.isPlaying });
    controls.setKnownPlaying(u.isPlaying);
    tray.setPlaying(u.isPlaying);
    if (currentTrack.value) {
      currentTrack.value = {
        ...currentTrack.value,
        isPlaying: u.isPlaying,
        positionMs: u.positionMs,
        positionWallClockMs: u.positionWallClockMs
      };
      miniPlayer.pushState(currentTrack.value, u.positionMs);
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
      miniPlayer.pushState(currentTrack.value, u.positionMs);
    }
  });

  bridge.on('health', (h) => {
    if (!h.ok) logger.warn('scraper health degraded', h);
  });

  app.on('second-instance', () => {
    if (handles.window.isMinimized()) handles.window.restore();
    handles.window.focus();
  });

  if (app.isPackaged) {
    const updater = createUpdater(logger);
    setTimeout(() => updater.checkAndPrompt(), 5000);
  }

  app.on('before-quit', () => {
    (app as unknown as { isQuiting: boolean }).isQuiting = true;
  });

  app.on('will-quit', () => {
    mediaKeys.unregister();
    shortcuts.clear();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  return { handles, logger, config, bridge, clock, controls, mediaKeys, tray, miniPlayer, currentTrack };
}
