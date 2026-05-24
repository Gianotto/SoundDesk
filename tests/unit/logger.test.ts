import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLogger } from '../../src/main/logger';

describe('logger', () => {
  let dir: string;

  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'sd-log-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('writes a single line per call to the active log file', () => {
    const logger = createLogger({ dir, maxBytes: 10_000 });
    logger.info('hello');
    logger.warn('world');
    const content = readFileSync(join(dir, 'sounddesk.log'), 'utf8');
    expect(content).toMatch(/INFO\s+hello/);
    expect(content).toMatch(/WARN\s+world/);
  });

  it('rotates when active file exceeds maxBytes', () => {
    const logger = createLogger({ dir, maxBytes: 100 });
    for (let i = 0; i < 50; i++) logger.info('xxxxxxxxxxxxxxxxxxxxxxxx');
    expect(existsSync(join(dir, 'sounddesk.log'))).toBe(true);
    expect(existsSync(join(dir, 'sounddesk.log.1'))).toBe(true);
    expect(statSync(join(dir, 'sounddesk.log')).size).toBeLessThan(200);
  });
});
