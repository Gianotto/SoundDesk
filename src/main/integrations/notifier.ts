import { Notification } from 'electron';
import type { TrackState } from '@shared/types';
import type { Logger } from '@main/logger';

export interface Notifier {
  notify(track: TrackState): void;
}

export function createNotifier(logger: Logger, isEnabled: () => boolean): Notifier {
  return {
    notify(track) {
      if (!isEnabled()) return;
      if (!Notification.isSupported()) {
        logger.warn('notifications not supported on this platform');
        return;
      }
      try {
        const n = new Notification({
          title: track.title ?? 'Unknown track',
          body: track.artist ?? '',
          silent: true
        });
        n.show();
      } catch (err) {
        logger.warn('notification failed', { err: (err as Error).message });
      }
    }
  };
}
