export interface SyncPoint {
  positionMs: number;
  wallClockMs: number;
  isPlaying: boolean;
}

export interface LocalClock {
  sync(point: SyncPoint): void;
  setPlaying(isPlaying: boolean): void;
  now(): number;
}

export function createLocalClock(): LocalClock {
  let basePositionMs = 0;
  let baseWallClockMs = Date.now();
  let isPlaying = false;

  const computeNow = (): number => {
    if (!isPlaying) return basePositionMs;
    return basePositionMs + (Date.now() - baseWallClockMs);
  };

  return {
    sync(point) {
      basePositionMs = point.positionMs;
      baseWallClockMs = point.wallClockMs;
      isPlaying = point.isPlaying;
    },
    setPlaying(next) {
      if (isPlaying === next) return;
      if (next) {
        baseWallClockMs = Date.now();
      } else {
        basePositionMs = computeNow();
        baseWallClockMs = Date.now();
      }
      isPlaying = next;
    },
    now: computeNow
  };
}
