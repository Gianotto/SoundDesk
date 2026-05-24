import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createConfigStore, DEFAULT_SHORTCUTS } from '../../src/main/config/store';

describe('config store', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'sd-cfg-')); });

  it('returns defaults on a fresh store', () => {
    const store = createConfigStore({ cwd: dir });
    expect(store.getShortcuts()).toEqual(DEFAULT_SHORTCUTS);
  });

  it('persists updates across instances', () => {
    const a = createConfigStore({ cwd: dir });
    a.setShortcuts({ bindings: [{ action: 'play-pause', accelerator: 'F12' }] });
    const b = createConfigStore({ cwd: dir });
    expect(b.getShortcuts().bindings[0]?.accelerator).toBe('F12');
  });
});
