import Store from 'electron-store';
import type { ShortcutConfig } from '@shared/types';

export const DEFAULT_SHORTCUTS: ShortcutConfig = {
  bindings: [
    { action: 'play-pause', accelerator: 'MediaPlayPause' },
    { action: 'next', accelerator: 'MediaNextTrack' },
    { action: 'prev', accelerator: 'MediaPreviousTrack' },
    { action: 'mini-player-toggle', accelerator: 'CommandOrControl+Alt+M' }
  ]
};

interface Schema {
  shortcuts: ShortcutConfig;
  minimizeToTray: boolean;
  notificationsEnabled: boolean;
}

const DEFAULTS: Schema = {
  shortcuts: DEFAULT_SHORTCUTS,
  minimizeToTray: true,
  notificationsEnabled: true
};

export interface ConfigStore {
  getShortcuts(): ShortcutConfig;
  setShortcuts(c: ShortcutConfig): void;
  getMinimizeToTray(): boolean;
  setMinimizeToTray(v: boolean): void;
  getNotificationsEnabled(): boolean;
  setNotificationsEnabled(v: boolean): void;
}

export function createConfigStore(opts?: { cwd?: string }): ConfigStore {
  const store = new Store<Schema>({ defaults: DEFAULTS, cwd: opts?.cwd });
  return {
    getShortcuts: () => store.get('shortcuts'),
    setShortcuts: (c) => store.set('shortcuts', c),
    getMinimizeToTray: () => store.get('minimizeToTray'),
    setMinimizeToTray: (v) => store.set('minimizeToTray', v),
    getNotificationsEnabled: () => store.get('notificationsEnabled'),
    setNotificationsEnabled: (v) => store.set('notificationsEnabled', v)
  };
}
