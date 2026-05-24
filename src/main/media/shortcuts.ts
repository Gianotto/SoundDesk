import { globalShortcut } from 'electron';
import type { ShortcutConfig, ShortcutBinding } from '@shared/types';
import type { Controls } from './controls';
import type { Logger } from '@main/logger';

export interface ShortcutsManager {
  apply(config: ShortcutConfig): void;
  clear(): void;
}

export function createShortcutsManager(opts: {
  controls: Controls;
  logger: Logger;
  onMiniPlayerToggle: () => void;
}): ShortcutsManager {
  const registered: string[] = [];

  const handlerFor = (action: ShortcutBinding['action']): (() => void) => {
    switch (action) {
      case 'play-pause': return () => opts.controls.togglePlayPause();
      case 'next': return () => opts.controls.next();
      case 'prev': return () => opts.controls.prev();
      case 'mini-player-toggle': return () => opts.onMiniPlayerToggle();
    }
  };

  const clear = () => {
    for (const acc of registered) globalShortcut.unregister(acc);
    registered.length = 0;
  };

  return {
    apply(config) {
      clear();
      const mediaKeyNames = ['MediaPlayPause', 'MediaNextTrack', 'MediaPreviousTrack'];
      for (const b of config.bindings) {
        if (mediaKeyNames.includes(b.accelerator)) continue;
        const ok = globalShortcut.register(b.accelerator, handlerFor(b.action));
        if (!ok) opts.logger.warn('shortcut conflict — not registered', { accelerator: b.accelerator, action: b.action });
        else registered.push(b.accelerator);
      }
    },
    clear
  };
}
