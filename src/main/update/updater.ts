import { autoUpdater } from 'electron-updater';
import type { Logger } from '@main/logger';

export interface Updater {
  checkAndPrompt(): void;
}

export function createUpdater(logger: Logger): Updater {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('error', (err: Error) => logger.warn('update error', { err: err.message }));
  autoUpdater.on('update-available', (info: { version: string }) => logger.info('update available', { version: info.version }));
  autoUpdater.on('update-downloaded', (info: { version: string }) => logger.info('update downloaded', { version: info.version }));

  return {
    checkAndPrompt() {
      autoUpdater.checkForUpdatesAndNotify().catch((err: Error) => logger.warn('update check failed', { err: err.message }));
    }
  };
}
