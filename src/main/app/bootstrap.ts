import { app } from 'electron';
import { createMainWindow } from '@main/windows/main-window';
import { createLogger } from '@main/logger';
import { join } from 'node:path';

export async function start(): Promise<void> {
  const logger = createLogger({ dir: join(app.getPath('userData'), 'logs') });
  logger.info('app starting', { version: app.getVersion() });

  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    logger.info('another instance is running; exiting');
    app.quit();
    return;
  }

  await app.whenReady();
  const { window } = createMainWindow();

  app.on('second-instance', () => {
    if (window.isMinimized()) window.restore();
    window.focus();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
