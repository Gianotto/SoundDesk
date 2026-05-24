import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLocalClock } from '../../src/main/media/local-clock';

describe('local-clock', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(1_000_000)); });
  afterEach(() => { vi.useRealTimers(); });

  it('starts at the sync point and advances while playing', () => {
    const clock = createLocalClock();
    clock.sync({ positionMs: 5000, wallClockMs: Date.now(), isPlaying: true });
    vi.advanceTimersByTime(2000);
    expect(clock.now()).toBe(7000);
  });

  it('does not advance while paused', () => {
    const clock = createLocalClock();
    clock.sync({ positionMs: 5000, wallClockMs: Date.now(), isPlaying: false });
    vi.advanceTimersByTime(2000);
    expect(clock.now()).toBe(5000);
  });

  it('re-sync resets the basis', () => {
    const clock = createLocalClock();
    clock.sync({ positionMs: 5000, wallClockMs: Date.now(), isPlaying: true });
    vi.advanceTimersByTime(1000);
    clock.sync({ positionMs: 30000, wallClockMs: Date.now(), isPlaying: true });
    vi.advanceTimersByTime(500);
    expect(clock.now()).toBe(30500);
  });

  it('switching from playing to paused freezes at predicted value', () => {
    const clock = createLocalClock();
    clock.sync({ positionMs: 0, wallClockMs: Date.now(), isPlaying: true });
    vi.advanceTimersByTime(3000);
    clock.setPlaying(false);
    vi.advanceTimersByTime(10000);
    expect(clock.now()).toBe(3000);
  });
});
