import { BrowserWindow, BrowserView, app } from 'electron';
import { join } from 'node:path';

const SC_URL = 'https://soundcloud.com';

export interface MainWindowHandles {
  window: BrowserWindow;
  view: BrowserView;
}

export function createMainWindow(): MainWindowHandles {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'SoundDesk',
    autoHideMenuBar: true,
    backgroundColor: '#1a1a1a',
    show: false
  });

  const view = new BrowserView({
    webPreferences: {
      preload: join(__dirname, '../preload/sc-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      partition: 'persist:soundcloud'
    }
  });

  window.setBrowserView(view);
  applyViewBounds(window, view);
  window.on('resize', () => applyViewBounds(window, view));

  view.webContents.loadURL(SC_URL);

  window.once('ready-to-show', () => window.show());
  return { window, view };
}

function applyViewBounds(win: BrowserWindow, view: BrowserView): void {
  const size = win.getContentSize();
  const width = size[0] ?? 1200;
  const height = size[1] ?? 800;
  view.setBounds({ x: 0, y: 0, width, height });
  view.setAutoResize({ width: true, height: true });
}
