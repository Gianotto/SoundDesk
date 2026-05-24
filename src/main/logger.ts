import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { join } from 'node:path';

type Level = 'INFO' | 'WARN' | 'ERROR';

export interface LoggerOptions {
  dir: string;
  maxBytes?: number;
}

export interface Logger {
  info: (msg: string, meta?: unknown) => void;
  warn: (msg: string, meta?: unknown) => void;
  error: (msg: string, meta?: unknown) => void;
}

export function createLogger(opts: LoggerOptions): Logger {
  const dir = opts.dir;
  const maxBytes = opts.maxBytes ?? 1_000_000;
  const file = join(dir, 'sounddesk.log');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const write = (level: Level, msg: string, meta?: unknown) => {
    if (existsSync(file) && statSync(file).size >= maxBytes) {
      renameSync(file, file + '.1');
    }
    const ts = new Date().toISOString();
    const metaStr = meta === undefined ? '' : ' ' + safeStringify(meta);
    appendFileSync(file, `${ts} ${level} ${msg}${metaStr}\n`);
  };

  return {
    info: (m, meta) => write('INFO', m, meta),
    warn: (m, meta) => write('WARN', m, meta),
    error: (m, meta) => write('ERROR', m, meta)
  };
}

function safeStringify(v: unknown): string {
  try { return JSON.stringify(v); } catch { return String(v); }
}
