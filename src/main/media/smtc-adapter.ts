/**
 * Windows System Media Transport Controls adapter.
 *
 * v1 ships as a no-op stub. The main reason: the Node WinRT binding ecosystem
 * (@nodert-win10-rs4/windows.media) requires native compilation against specific
 * Electron ABI versions and its maintenance status is uncertain as of 2026.
 * Media keys still work via globalShortcut (Task 12), so playback control is
 * functional. The rich SMTC overlay (taskbar thumbnail controls, lock screen) is
 * a v1.1 follow-up once a reliable binding is confirmed.
 */
import type { TrackState } from '@shared/types';
import type { Controls } from './controls';
import type { Logger } from '@main/logger';

export interface SmtcAdapter {
  update(track: TrackState, positionMs: number): void;
  shutdown(): void;
}

export function createSmtcAdapter(opts: { controls: Controls; logger: Logger }): SmtcAdapter | null {
  if (process.platform !== 'win32') return null;

  opts.logger.info('SMTC adapter: no-op stub (v1 — media keys active via globalShortcut)');
  return null;
}
