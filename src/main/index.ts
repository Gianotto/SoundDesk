import { app } from 'electron';
import { start } from '@main/app/bootstrap';

// Must be called before app.whenReady() for Windows taskbar icon to work
if (process.platform === 'win32') {
  app.setAppUserModelId('com.sounddesk.app');
}

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
