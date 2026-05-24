import { globalShortcut } from 'electron';
import type { Controls } from './controls';
import type { Logger } from '@main/logger';

export interface MediaKeys {
  register(): void;
  unregister(): void;
}

export function createMediaKeys(controls: Controls, logger: Logger): MediaKeys {
  const bindings: Array<[string, () => void]> = [
    ['MediaPlayPause', () => controls.togglePlayPause()],
    ['MediaNextTrack', () => controls.next()],
    ['MediaPreviousTrack', () => controls.prev()]
  ];

  return {
    register() {
      for (const [accelerator, handler] of bindings) {
        const ok = globalShortcut.register(accelerator, handler);
        if (!ok) logger.warn('failed to register media key', { accelerator });
      }
    },
    unregister() {
      globalShortcut.unregisterAll();
    }
  };
}
