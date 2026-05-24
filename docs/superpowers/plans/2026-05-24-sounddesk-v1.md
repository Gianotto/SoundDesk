# SoundDesk v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship v1 of SoundDesk — a cross-platform (Windows + Linux) Electron desktop wrapper around soundcloud.com with media keys, system tray, native notifications, a floating mini-player, customizable global shortcuts, and auto-update.

**Architecture:** Electron main + renderer. Main window hosts a BrowserView pointing at `https://soundcloud.com`. A preload script (the only file aware of SC's DOM) observes the page via `MutationObserver` and exposes a typed bridge over IPC. All OS integrations (SMTC, MPRIS, notifications, tray, mini-player) subscribe to that single event stream. Position is predicted locally to avoid high-frequency IPC.

**Tech Stack:** Electron (current stable), TypeScript, Vite + electron-vite, electron-builder, electron-store, electron-updater, mpris-service (Linux), node-windows-media-control or equivalent SMTC binding (Windows — verify at task time), Vitest, Playwright.

**Important verification note (from project README rule #6):** Several APIs in this plan are subject to upstream change — particularly SC's DOM, the SMTC Node binding ecosystem, and electron-vite config schema. Tasks that depend on these explicitly call out the verification step.

**Spec:** [docs/superpowers/specs/2026-05-24-sounddesk-design.md](../specs/2026-05-24-sounddesk-design.md)

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `electron.vite.config.ts`, `.gitignore`, `.editorconfig`, `src/main/`, `src/renderer/`, `src/preload/`, `src/shared/`, `resources/`

- [ ] **Step 1: Initialize package.json**

Create `package.json`:

```json
{
  "name": "sounddesk",
  "version": "0.1.0",
  "description": "Sound Desk for SoundCloud — desktop app for Windows and Linux",
  "main": "out/main/index.js",
  "author": "gianotto",
  "license": "MIT",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "build:win": "npm run build && electron-builder --win",
    "build:linux": "npm run build && electron-builder --linux",
    "typecheck": "tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.node.json",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "electron": "latest",
    "electron-builder": "latest",
    "electron-vite": "latest",
    "vite": "latest",
    "typescript": "latest",
    "@types/node": "latest",
    "vitest": "latest"
  },
  "dependencies": {
    "electron-store": "latest",
    "electron-updater": "latest"
  }
}
```

After creating, pin exact versions:

```bash
npm install
```

Then run `npm pkg get devDependencies dependencies` and replace the `"latest"` entries in `package.json` with the resolved exact versions before committing. **Verify against current docs** that each package is still the recommended option.

- [ ] **Step 2: Create TypeScript configs**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "jsx": "preserve",
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["src/shared/*"],
      "@main/*": ["src/main/*"],
      "@renderer/*": ["src/renderer/*"],
      "@preload/*": ["src/preload/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

Create `tsconfig.node.json` for build tooling:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["electron.vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 3: Create electron-vite config**

Create `electron.vite.config.ts`:

```ts
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { resolve } from 'node:path';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@main': resolve('src/main')
      }
    },
    build: {
      rollupOptions: {
        input: { index: resolve('src/main/index.ts') }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: { '@shared': resolve('src/shared') }
    },
    build: {
      rollupOptions: {
        input: {
          'sc-preload': resolve('src/preload/sc-preload.ts'),
          'mini-player-preload': resolve('src/preload/mini-player-preload.ts')
        }
      }
    }
  },
  renderer: {
    resolve: {
      alias: { '@shared': resolve('src/shared') }
    },
    build: {
      rollupOptions: {
        input: {
          'mini-player': resolve('src/renderer/mini-player/index.html')
        }
      }
    }
  }
});
```

**Verify against current electron-vite docs** that this config shape is current — the schema has changed between minor versions.

- [ ] **Step 4: Create .gitignore and dir skeleton**

Create `.gitignore`:

```
node_modules/
out/
dist/
.vite/
*.log
.DS_Store
.env
.env.*
!.env.example
release/
```

Create empty directories with placeholder `.gitkeep` files:

```bash
mkdir -p src/main/app src/main/windows src/main/tray src/main/media src/main/integrations src/main/update src/main/config
mkdir -p src/preload
mkdir -p src/renderer/mini-player
mkdir -p src/shared
mkdir -p resources
mkdir -p tests/unit
touch src/main/.gitkeep src/preload/.gitkeep src/renderer/.gitkeep src/shared/.gitkeep resources/.gitkeep tests/unit/.gitkeep
```

- [ ] **Step 5: Commit scaffold**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.node.json electron.vite.config.ts .gitignore src/ resources/ tests/
git commit -m "config: bootstrap Electron + TypeScript + Vite scaffolding"
```

---

## Task 2: Shared types and IPC channel constants

**Files:**
- Create: `src/shared/types.ts`, `src/shared/channels.ts`

This is the contract between processes. Establish it first so every later task imports stable types.

- [ ] **Step 1: Define types**

Create `src/shared/types.ts`:

```ts
export type PlayState = 'playing' | 'paused' | 'unknown';

export interface TrackState {
  title: string | null;
  artist: string | null;
  artworkUrl: string | null;
  durationMs: number | null;
  positionMs: number;        // last known position from DOM
  positionWallClockMs: number; // Date.now() when positionMs was sampled
  isPlaying: boolean;
  trackId: string;           // stable id derived from title+artist+duration
}

export interface ShortcutBinding {
  action: 'play-pause' | 'next' | 'prev' | 'mini-player-toggle';
  accelerator: string;       // Electron accelerator e.g. "CommandOrControl+Alt+P"
}

export interface ShortcutConfig {
  bindings: ShortcutBinding[];
}

export interface ScraperHealth {
  ok: boolean;
  missingSelectors: string[];
}
```

- [ ] **Step 2: Define IPC channels**

Create `src/shared/channels.ts`:

```ts
export const CHANNELS = {
  // scraper → main (events from preload)
  TRACK_CHANGE: 'sd:track-change',
  PLAY_STATE_CHANGE: 'sd:play-state-change',
  SEEK_DETECTED: 'sd:seek-detected',
  SCRAPER_HEALTH: 'sd:scraper-health',

  // main → preload (transport commands)
  CONTROL_PLAY: 'sd:control:play',
  CONTROL_PAUSE: 'sd:control:pause',
  CONTROL_NEXT: 'sd:control:next',
  CONTROL_PREV: 'sd:control:prev',

  // main → mini-player renderer
  MINI_PLAYER_STATE: 'sd:mini-player:state',

  // mini-player renderer → main
  MINI_PLAYER_COMMAND: 'sd:mini-player:command'
} as const;

export type ChannelName = (typeof CHANNELS)[keyof typeof CHANNELS];
```

- [ ] **Step 3: Verify types compile**

```bash
npm run typecheck
```

Expected: exit code 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/shared/
git commit -m "feat: add shared types and IPC channel constants"
```

---

## Task 3: Logger

**Files:**
- Create: `src/main/logger.ts`, `tests/unit/logger.test.ts`

Tiny rotating file logger. Used by every other module. Keep dependencies zero (Node built-ins only).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/logger.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test
```

Expected: FAIL — cannot resolve `../../src/main/logger`.

- [ ] **Step 3: Implement logger**

Create `src/main/logger.ts`:

```ts
import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { join } from 'node:path';

type Level = 'INFO' | 'WARN' | 'ERROR';

export interface LoggerOptions {
  dir: string;
  maxBytes?: number; // default 1 MB
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
```

- [ ] **Step 4: Run tests, verify pass**

```bash
npm run test
```

Expected: 2 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/main/logger.ts tests/unit/logger.test.ts
git commit -m "feat: add rotating file logger"
```

---

## Task 4: Config store

**Files:**
- Create: `src/main/config/store.ts`, `tests/unit/config-store.test.ts`

Typed wrapper over `electron-store`. Keeps shortcut config and prefs.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/config-store.test.ts`:

```ts
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
```

- [ ] **Step 2: Verify test fails**

```bash
npm run test
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement store**

Create `src/main/config/store.ts`:

```ts
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
```

- [ ] **Step 4: Verify tests pass**

```bash
npm run test
```

Expected: all tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/main/config/ tests/unit/config-store.test.ts
git commit -m "feat: add typed config store"
```

---

## Task 5: App bootstrap with main window and BrowserView

**Files:**
- Create: `src/main/index.ts`, `src/main/app/bootstrap.ts`, `src/main/windows/main-window.ts`

This task gets the app *launching* with soundcloud.com visible. No scraping yet.

- [ ] **Step 1: Implement main-window**

Create `src/main/windows/main-window.ts`:

```ts
import { BrowserWindow, BrowserView, app } from 'electron';
import { join } from 'node:path';

const SC_URL = 'https://soundcloud.com';

export interface MainWindowHandles {
  window: BrowserWindow;
  view: BrowserView;
}

export function createMainWindow(): MainWindowHandles {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'SoundDesk',
    autoHideMenuBar: true,
    backgroundColor: '#1a1a1a',
    show: false
  });

  const view = new BrowserView({
    webPreferences: {
      preload: join(__dirname, '../preload/sc-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      partition: 'persist:soundcloud'
    }
  });

  window.setBrowserView(view);
  applyViewBounds(window, view);
  window.on('resize', () => applyViewBounds(window, view));

  view.webContents.loadURL(SC_URL);

  window.once('ready-to-show', () => window.show());
  return { window, view };
}

function applyViewBounds(win: BrowserWindow, view: BrowserView): void {
  const [width, height] = win.getContentSize();
  view.setBounds({ x: 0, y: 0, width, height });
  view.setAutoResize({ width: true, height: true });
}
```

- [ ] **Step 2: Implement bootstrap**

Create `src/main/app/bootstrap.ts`:

```ts
import { app } from 'electron';
import { createMainWindow } from '@main/windows/main-window';
import { createLogger } from '@main/logger';
import { join } from 'node:path';

export async function start(): Promise<void> {
  const logger = createLogger({ dir: join(app.getPath('userData'), 'logs') });
  logger.info('app starting', { version: app.getVersion() });

  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    logger.info('another instance is running; exiting');
    app.quit();
    return;
  }

  await app.whenReady();
  const { window } = createMainWindow();

  app.on('second-instance', () => {
    if (window.isMinimized()) window.restore();
    window.focus();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
```

- [ ] **Step 3: Implement entry**

Create `src/main/index.ts`:

```ts
import { start } from '@main/app/bootstrap';

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
```

- [ ] **Step 4: Run the app**

```bash
npm run dev
```

Expected: A window opens, soundcloud.com loads inside. Window resizes correctly. Closing the window quits the app.

If the BrowserView doesn't size correctly: confirm the preload path resolves — at this point the preload file doesn't exist yet, but BrowserView will still load (the preload is optional). Electron may log a warning about a missing preload; that's expected until Task 6.

- [ ] **Step 5: Commit**

```bash
git add src/main/
git commit -m "feat: launch main window with embedded soundcloud.com"
```

---

## Task 6: Preload selectors table (placeholders + verification step)

**Files:**
- Create: `src/preload/selectors.ts`

**Critical:** the selector values below are *placeholders* — they need to be verified against the live soundcloud.com page. Step 2 is the verification, and is non-optional.

- [ ] **Step 1: Create the selectors table with placeholders**

Create `src/preload/selectors.ts`:

```ts
/**
 * Single source of truth for SoundCloud DOM selectors.
 * When SC ships a frontend change, edit only this file.
 *
 * Each entry may have a primary selector and ordered fallbacks
 * (tried in order until one resolves).
 */
export interface SelectorSpec {
  primary: string;
  fallbacks?: string[];
}

export interface SelectorTable {
  /** Track title text element on the global player bar */
  trackTitle: SelectorSpec;
  /** Track artist text element on the global player bar */
  trackArtist: SelectorSpec;
  /** Artwork <span> with background-image style on the global player bar */
  trackArtwork: SelectorSpec;
  /** Play / pause toggle button on the global player bar */
  playPauseButton: SelectorSpec;
  /** "Skip to next track" button on the global player bar */
  nextButton: SelectorSpec;
  /** "Skip to previous track" button on the global player bar */
  prevButton: SelectorSpec;
  /** Progress bar input element (timeline scrubber) */
  progressBar: SelectorSpec;
  /** Element whose aria-valuenow / textContent reports total duration in seconds or formatted time */
  duration: SelectorSpec;
  /** Element reporting current position */
  position: SelectorSpec;
}

// PLACEHOLDERS — must be verified against live soundcloud.com before relying on them.
export const SELECTORS: SelectorTable = {
  trackTitle: {
    primary: '.playbackSoundBadge__titleLink span:nth-of-type(2)',
    fallbacks: ['.playbackSoundBadge__title']
  },
  trackArtist: {
    primary: '.playbackSoundBadge__lightLink',
    fallbacks: ['.playbackSoundBadge__avatar a']
  },
  trackArtwork: {
    primary: '.playbackSoundBadge .image__full',
    fallbacks: ['.playbackSoundBadge span.sc-artwork']
  },
  playPauseButton: {
    primary: '.playControl',
    fallbacks: ['.playControls__play']
  },
  nextButton: {
    primary: '.skipControl__next',
    fallbacks: ['.playControls__next']
  },
  prevButton: {
    primary: '.skipControl__previous',
    fallbacks: ['.playControls__prev']
  },
  progressBar: {
    primary: '.playbackTimeline__progressWrapper',
    fallbacks: []
  },
  duration: {
    primary: '.playbackTimeline__duration span[aria-hidden="false"]',
    fallbacks: ['.playbackTimeline__duration']
  },
  position: {
    primary: '.playbackTimeline__timePassed span[aria-hidden="false"]',
    fallbacks: ['.playbackTimeline__timePassed']
  }
};

export function resolve(spec: SelectorSpec, root: ParentNode = document): Element | null {
  const candidates = [spec.primary, ...(spec.fallbacks ?? [])];
  for (const sel of candidates) {
    const el = root.querySelector(sel);
    if (el) return el;
  }
  return null;
}
```

- [ ] **Step 2: Verify selectors against the live site (MANDATORY)**

Run the app:

```bash
npm run dev
```

In the SoundCloud BrowserView, log in, play any track, then **right-click → Inspect** to open dev tools on the BrowserView. In the dev tools console, for each entry in the selector table, run:

```js
document.querySelectorAll('<the selector>')
```

For each selector that returns zero elements: find the correct selector by inspecting the rendered DOM, update `src/preload/selectors.ts`, and re-test. Aim for selectors that target stable class names or `data-*` attributes; avoid deep tag-position selectors.

Do not proceed past this step until **every** selector in the table resolves to exactly the right element on the live page. The rest of the app depends on this.

- [ ] **Step 3: Commit verified selectors**

```bash
git add src/preload/selectors.ts
git commit -m "feat: add selector table verified against live soundcloud.com"
```

---

## Task 7: Preload scraper + context bridge

**Files:**
- Create: `src/preload/sc-preload.ts`, `src/preload/scraper.ts`

The scraper observes DOM changes and forwards typed events to main. It also exposes transport commands that simulate clicks on the SC buttons.

- [ ] **Step 1: Implement scrape primitives**

Create `src/preload/scraper.ts`:

```ts
import { SELECTORS, resolve } from './selectors';
import type { TrackState, PlayState, ScraperHealth } from '@shared/types';

export function scrapeTrack(): Omit<TrackState, 'positionWallClockMs'> | null {
  const titleEl = resolve(SELECTORS.trackTitle);
  const artistEl = resolve(SELECTORS.trackArtist);
  if (!titleEl) return null;

  const title = titleEl.textContent?.trim() ?? null;
  const artist = artistEl?.textContent?.trim() ?? null;
  const artworkUrl = extractArtwork();
  const durationMs = parseTimeMs(resolve(SELECTORS.duration)?.textContent);
  const positionMs = parseTimeMs(resolve(SELECTORS.position)?.textContent) ?? 0;
  const isPlaying = scrapePlayState() === 'playing';

  return {
    title,
    artist,
    artworkUrl,
    durationMs,
    positionMs,
    isPlaying,
    trackId: makeTrackId(title, artist, durationMs)
  };
}

export function scrapePlayState(): PlayState {
  const btn = resolve(SELECTORS.playPauseButton);
  if (!btn) return 'unknown';
  // SC toggles a "playing" class on the control when audio is active.
  // Verify the exact class during Task 6 selector pass; adjust here if needed.
  const cls = btn.className || '';
  if (/\bplaying\b/.test(cls)) return 'playing';
  return 'paused';
}

export function scrapePosition(): number | null {
  return parseTimeMs(resolve(SELECTORS.position)?.textContent);
}

export function healthCheck(): ScraperHealth {
  const missing: string[] = [];
  for (const [name, spec] of Object.entries(SELECTORS) as [string, typeof SELECTORS[keyof typeof SELECTORS]][]) {
    if (!resolve(spec)) missing.push(name);
  }
  return { ok: missing.length === 0, missingSelectors: missing };
}

function extractArtwork(): string | null {
  const el = resolve(SELECTORS.trackArtwork) as HTMLElement | null;
  if (!el) return null;
  const bg = el.style.backgroundImage || '';
  const m = bg.match(/url\(["']?(.+?)["']?\)/);
  return m?.[1] ?? null;
}

function parseTimeMs(text: string | null | undefined): number | null {
  if (!text) return null;
  // Accept "1:23", "12:34", "1:02:03"
  const parts = text.trim().split(':').map(Number);
  if (parts.some(Number.isNaN)) return null;
  let s = 0;
  for (const p of parts) s = s * 60 + p;
  return s * 1000;
}

function makeTrackId(title: string | null, artist: string | null, duration: number | null): string {
  return `${title ?? '?'}::${artist ?? '?'}::${duration ?? 0}`;
}
```

- [ ] **Step 2: Implement the preload bridge**

Create `src/preload/sc-preload.ts`:

```ts
import { contextBridge, ipcRenderer } from 'electron';
import { CHANNELS } from '@shared/channels';
import { SELECTORS, resolve } from './selectors';
import { scrapeTrack, scrapePlayState, scrapePosition, healthCheck } from './scraper';

const SEEK_THRESHOLD_MS = 1500;
const SEEK_POLL_INTERVAL_MS = 1000;

let lastTrackId: string | null = null;
let lastPlayState: 'playing' | 'paused' | 'unknown' = 'unknown';
let lastSentPositionMs = 0;
let lastSentWallClockMs = Date.now();

function emitTrack(): void {
  const t = scrapeTrack();
  if (!t) return;
  if (t.trackId === lastTrackId && (t.isPlaying ? 'playing' : 'paused') === lastPlayState) return;

  if (t.trackId !== lastTrackId) {
    lastTrackId = t.trackId;
    ipcRenderer.send(CHANNELS.TRACK_CHANGE, { ...t, positionWallClockMs: Date.now() });
  }
  const ps = t.isPlaying ? 'playing' : 'paused';
  if (ps !== lastPlayState) {
    lastPlayState = ps;
    ipcRenderer.send(CHANNELS.PLAY_STATE_CHANGE, { isPlaying: t.isPlaying, positionMs: t.positionMs, positionWallClockMs: Date.now() });
  }
  lastSentPositionMs = t.positionMs;
  lastSentWallClockMs = Date.now();
}

function emitSeekIfJumped(): void {
  const actual = scrapePosition();
  if (actual == null) return;
  const elapsed = lastPlayState === 'playing' ? Date.now() - lastSentWallClockMs : 0;
  const predicted = lastSentPositionMs + elapsed;
  if (Math.abs(actual - predicted) > SEEK_THRESHOLD_MS) {
    lastSentPositionMs = actual;
    lastSentWallClockMs = Date.now();
    ipcRenderer.send(CHANNELS.SEEK_DETECTED, { positionMs: actual, positionWallClockMs: lastSentWallClockMs });
  }
}

function emitHealth(): void {
  ipcRenderer.send(CHANNELS.SCRAPER_HEALTH, healthCheck());
}

function startObserving(): void {
  const observer = new MutationObserver(() => emitTrack());
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'aria-label', 'title'] });

  setInterval(emitSeekIfJumped, SEEK_POLL_INTERVAL_MS);
  emitTrack();
  emitHealth();
  setTimeout(emitHealth, 5000); // re-check once DOM has settled
}

function click(selectorKey: keyof typeof SELECTORS): void {
  const el = resolve(SELECTORS[selectorKey]) as HTMLElement | null;
  el?.click();
}

contextBridge.exposeInMainWorld('scBridge', {
  // exposed for debugging / future renderer use; main controls go through IPC below
  healthCheck
});

ipcRenderer.on(CHANNELS.CONTROL_PLAY, () => click('playPauseButton'));
ipcRenderer.on(CHANNELS.CONTROL_PAUSE, () => click('playPauseButton'));
ipcRenderer.on(CHANNELS.CONTROL_NEXT, () => click('nextButton'));
ipcRenderer.on(CHANNELS.CONTROL_PREV, () => click('prevButton'));

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  startObserving();
} else {
  document.addEventListener('DOMContentLoaded', startObserving);
}
```

> **Note on play/pause semantics.** The SC play button is a toggle, so both CONTROL_PLAY and CONTROL_PAUSE click the same button. The main process is responsible for not sending CONTROL_PLAY when already playing. The next/prev buttons are non-toggling.

- [ ] **Step 3: Run app, verify scraper fires**

```bash
npm run dev
```

In the main process console (DevTools on the outer window, or a launching shell), you should see IPC events `sd:track-change` / `sd:play-state-change` arrive when you start a track in the BrowserView. Use a quick `ipcMain.on(CHANNELS.TRACK_CHANGE, (_, t) => console.log('TRACK', t))` in `bootstrap.ts` temporarily to log — remove before commit.

- [ ] **Step 4: Commit**

```bash
git add src/preload/sc-preload.ts src/preload/scraper.ts
git commit -m "feat: add preload scraper with MutationObserver and seek polling"
```

---

## Task 8: scraper-bridge module

**Files:**
- Create: `src/main/media/scraper-bridge.ts`, `tests/unit/scraper-bridge.test.ts`

A typed event emitter that wraps IPC. Everything in the main process subscribes here — not directly to `ipcMain`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/scraper-bridge.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { CHANNELS } from '../../src/shared/channels';
import { createScraperBridge } from '../../src/main/media/scraper-bridge';

class FakeIpcMain extends EventEmitter {
  on(ch: string, h: (...args: unknown[]) => void) { return super.on(ch, h); }
  // Helper for the test:
  fire(ch: string, payload: unknown) { this.emit(ch, {}, payload); }
}

describe('scraper-bridge', () => {
  it('routes TRACK_CHANGE IPC to trackChange listeners', () => {
    const ipc = new FakeIpcMain();
    const bridge = createScraperBridge(ipc as unknown as Electron.IpcMain);
    const cb = vi.fn();
    bridge.on('trackChange', cb);

    const payload = { title: 'A', artist: 'B', artworkUrl: null, durationMs: 1000, positionMs: 0, positionWallClockMs: 1, isPlaying: true, trackId: 't1' };
    ipc.fire(CHANNELS.TRACK_CHANGE, payload);

    expect(cb).toHaveBeenCalledWith(payload);
  });

  it('routes PLAY_STATE_CHANGE and SEEK_DETECTED', () => {
    const ipc = new FakeIpcMain();
    const bridge = createScraperBridge(ipc as unknown as Electron.IpcMain);
    const onPlay = vi.fn();
    const onSeek = vi.fn();
    bridge.on('playStateChange', onPlay);
    bridge.on('seek', onSeek);

    ipc.fire(CHANNELS.PLAY_STATE_CHANGE, { isPlaying: false, positionMs: 100, positionWallClockMs: 2 });
    ipc.fire(CHANNELS.SEEK_DETECTED, { positionMs: 500, positionWallClockMs: 3 });

    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(onSeek).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Verify test fails**

```bash
npm run test
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement scraper-bridge**

Create `src/main/media/scraper-bridge.ts`:

```ts
import { EventEmitter } from 'node:events';
import type { IpcMain } from 'electron';
import { CHANNELS } from '@shared/channels';
import type { TrackState, ScraperHealth } from '@shared/types';

export type PlayStateUpdate = { isPlaying: boolean; positionMs: number; positionWallClockMs: number };
export type SeekUpdate = { positionMs: number; positionWallClockMs: number };

interface Events {
  trackChange: (t: TrackState) => void;
  playStateChange: (u: PlayStateUpdate) => void;
  seek: (u: SeekUpdate) => void;
  health: (h: ScraperHealth) => void;
}

export interface ScraperBridge {
  on<E extends keyof Events>(event: E, listener: Events[E]): void;
  off<E extends keyof Events>(event: E, listener: Events[E]): void;
}

export function createScraperBridge(ipc: IpcMain): ScraperBridge {
  const emitter = new EventEmitter();

  ipc.on(CHANNELS.TRACK_CHANGE, (_e, payload: TrackState) => emitter.emit('trackChange', payload));
  ipc.on(CHANNELS.PLAY_STATE_CHANGE, (_e, payload: PlayStateUpdate) => emitter.emit('playStateChange', payload));
  ipc.on(CHANNELS.SEEK_DETECTED, (_e, payload: SeekUpdate) => emitter.emit('seek', payload));
  ipc.on(CHANNELS.SCRAPER_HEALTH, (_e, payload: ScraperHealth) => emitter.emit('health', payload));

  return {
    on: (ev, fn) => { emitter.on(ev, fn as (...args: unknown[]) => void); },
    off: (ev, fn) => { emitter.off(ev, fn as (...args: unknown[]) => void); }
  };
}
```

- [ ] **Step 4: Verify tests pass**

```bash
npm run test
```

- [ ] **Step 5: Commit**

```bash
git add src/main/media/scraper-bridge.ts tests/unit/scraper-bridge.test.ts
git commit -m "feat: add typed scraper-bridge event router"
```

---

## Task 9: Local clock for position prediction

**Files:**
- Create: `src/main/media/local-clock.ts`, `tests/unit/local-clock.test.ts`

Pure logic; high TDD value.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/local-clock.test.ts`:

```ts
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
```

- [ ] **Step 2: Verify it fails**

```bash
npm run test
```

- [ ] **Step 3: Implement**

Create `src/main/media/local-clock.ts`:

```ts
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

  const freezeBaseToNow = () => {
    basePositionMs = computeNow();
    baseWallClockMs = Date.now();
  };

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
        // resume from current predicted position
        baseWallClockMs = Date.now();
        // basePositionMs unchanged
      } else {
        // freeze at current predicted position
        freezeBaseToNow();
      }
      isPlaying = next;
    },
    now: computeNow
  };
}
```

- [ ] **Step 4: Verify tests pass**

```bash
npm run test
```

- [ ] **Step 5: Commit**

```bash
git add src/main/media/local-clock.ts tests/unit/local-clock.test.ts
git commit -m "feat: add local clock for position prediction"
```

---

## Task 10: Transport controls module

**Files:**
- Create: `src/main/media/controls.ts`

Sends transport commands to the SoundCloud preload over IPC. Tracks current play state to avoid sending CONTROL_PLAY when already playing (since SC's button is a toggle).

- [ ] **Step 1: Implement controls**

Create `src/main/media/controls.ts`:

```ts
import type { WebContents } from 'electron';
import { CHANNELS } from '@shared/channels';

export interface Controls {
  play(): void;
  pause(): void;
  togglePlayPause(): void;
  next(): void;
  prev(): void;
  setKnownPlaying(isPlaying: boolean): void;
}

export function createControls(getTargetWebContents: () => WebContents | null): Controls {
  let knownPlaying = false;
  const send = (ch: string) => getTargetWebContents()?.send(ch);

  return {
    play() {
      if (knownPlaying) return; // already playing; SC button is a toggle
      send(CHANNELS.CONTROL_PLAY);
      knownPlaying = true;
    },
    pause() {
      if (!knownPlaying) return;
      send(CHANNELS.CONTROL_PAUSE);
      knownPlaying = false;
    },
    togglePlayPause() {
      send(CHANNELS.CONTROL_PLAY); // same button either way
      knownPlaying = !knownPlaying;
    },
    next() { send(CHANNELS.CONTROL_NEXT); },
    prev() { send(CHANNELS.CONTROL_PREV); },
    setKnownPlaying(v) { knownPlaying = v; }
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/main/media/controls.ts
git commit -m "feat: add transport controls module"
```

---

## Task 11: Wire scraper-bridge + local-clock + controls into bootstrap

**Files:**
- Modify: `src/main/app/bootstrap.ts`

Glue task. After this, the spine is alive and the rest of the integrations subscribe to it.

- [ ] **Step 1: Update bootstrap**

Replace the contents of `src/main/app/bootstrap.ts`:

```ts
import { app, ipcMain } from 'electron';
import { createMainWindow, type MainWindowHandles } from '@main/windows/main-window';
import { createLogger } from '@main/logger';
import { createConfigStore } from '@main/config/store';
import { createScraperBridge } from '@main/media/scraper-bridge';
import { createLocalClock } from '@main/media/local-clock';
import { createControls } from '@main/media/controls';
import { join } from 'node:path';
import type { TrackState } from '@shared/types';

export interface AppContext {
  handles: MainWindowHandles;
  logger: ReturnType<typeof createLogger>;
  config: ReturnType<typeof createConfigStore>;
  bridge: ReturnType<typeof createScraperBridge>;
  clock: ReturnType<typeof createLocalClock>;
  controls: ReturnType<typeof createControls>;
  currentTrack: { value: TrackState | null };
}

export async function start(): Promise<AppContext | undefined> {
  const logger = createLogger({ dir: join(app.getPath('userData'), 'logs') });
  logger.info('app starting', { version: app.getVersion() });

  if (!app.requestSingleInstanceLock()) {
    logger.info('another instance already running');
    app.quit();
    return;
  }

  await app.whenReady();

  const config = createConfigStore();
  const handles = createMainWindow();
  const bridge = createScraperBridge(ipcMain);
  const clock = createLocalClock();
  const controls = createControls(() => handles.view.webContents);
  const currentTrack = { value: null as TrackState | null };

  bridge.on('trackChange', (t) => {
    logger.info('track change', { title: t.title, artist: t.artist });
    currentTrack.value = t;
    clock.sync({ positionMs: t.positionMs, wallClockMs: t.positionWallClockMs, isPlaying: t.isPlaying });
    controls.setKnownPlaying(t.isPlaying);
  });

  bridge.on('playStateChange', (u) => {
    clock.sync({ positionMs: u.positionMs, wallClockMs: u.positionWallClockMs, isPlaying: u.isPlaying });
    controls.setKnownPlaying(u.isPlaying);
    if (currentTrack.value) currentTrack.value = { ...currentTrack.value, isPlaying: u.isPlaying, positionMs: u.positionMs, positionWallClockMs: u.positionWallClockMs };
  });

  bridge.on('seek', (u) => {
    clock.sync({ positionMs: u.positionMs, wallClockMs: u.positionWallClockMs, isPlaying: clock.now() !== u.positionMs });
    if (currentTrack.value) currentTrack.value = { ...currentTrack.value, positionMs: u.positionMs, positionWallClockMs: u.positionWallClockMs };
  });

  bridge.on('health', (h) => {
    if (!h.ok) logger.warn('scraper health degraded', h);
  });

  app.on('second-instance', () => {
    if (handles.window.isMinimized()) handles.window.restore();
    handles.window.focus();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  return { handles, logger, config, bridge, clock, controls, currentTrack };
}
```

- [ ] **Step 2: Run and verify**

```bash
npm run dev
```

Play a track in SC, watch the userData log file (path printed by `logger.info`). You should see `track change` and `play state` entries.

- [ ] **Step 3: Commit**

```bash
git add src/main/app/bootstrap.ts
git commit -m "feat: wire scraper-bridge, clock, and controls into bootstrap"
```

---

## Task 12: Global media keys

**Files:**
- Create: `src/main/media/media-keys.ts`
- Modify: `src/main/app/bootstrap.ts`

Use `globalShortcut` to bind MediaPlayPause / MediaNextTrack / MediaPreviousTrack to controls.

- [ ] **Step 1: Implement media-keys**

Create `src/main/media/media-keys.ts`:

```ts
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
```

- [ ] **Step 2: Wire into bootstrap**

Append before the `return` in `start()` of `src/main/app/bootstrap.ts`:

```ts
import { createMediaKeys } from '@main/media/media-keys';
// ...
const mediaKeys = createMediaKeys(controls, logger);
mediaKeys.register();
app.on('will-quit', () => mediaKeys.unregister());
```

Add `mediaKeys` to the returned `AppContext`.

- [ ] **Step 3: Manual test**

```bash
npm run dev
```

With a track playing in SC, press your keyboard's play/pause key. Track should pause. Press next/prev keys. Test passes when keys produce the expected effect.

- [ ] **Step 4: Commit**

```bash
git add src/main/media/media-keys.ts src/main/app/bootstrap.ts
git commit -m "feat: bind global media keys to playback controls"
```

---

## Task 13: System tray + minimize-to-tray

**Files:**
- Create: `src/main/tray/tray-manager.ts`, `resources/tray-icon.png`
- Modify: `src/main/app/bootstrap.ts`, `src/main/windows/main-window.ts`

- [ ] **Step 1: Add tray icon asset**

Place a 32×32 (or 64×64 for HiDPI) PNG at `resources/tray-icon.png`. Use a simple monochrome glyph — Linux DE tray themes recolor it. If you don't have one yet, generate a placeholder via any image tool; the app will still run.

- [ ] **Step 2: Implement tray-manager**

Create `src/main/tray/tray-manager.ts`:

```ts
import { Tray, Menu, nativeImage, app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import type { Controls } from '@main/media/controls';

export interface TrayManager {
  init(): void;
  setPlaying(isPlaying: boolean): void;
  destroy(): void;
}

export function createTrayManager(opts: {
  window: BrowserWindow;
  controls: Controls;
  onShowMiniPlayer: () => void;
  resourcesDir: string;
}): TrayManager {
  let tray: Tray | null = null;
  let isPlaying = false;

  const buildMenu = () => Menu.buildFromTemplate([
    { label: 'Show / Hide', click: () => opts.window.isVisible() ? opts.window.hide() : opts.window.show() },
    { label: 'Mini-player', click: () => opts.onShowMiniPlayer() },
    { type: 'separator' },
    { label: isPlaying ? 'Pause' : 'Play', click: () => opts.controls.togglePlayPause() },
    { label: 'Next', click: () => opts.controls.next() },
    { label: 'Previous', click: () => opts.controls.prev() },
    { type: 'separator' },
    { label: 'Quit SoundDesk', click: () => { (app as unknown as { isQuiting: boolean }).isQuiting = true; app.quit(); } }
  ]);

  return {
    init() {
      const icon = nativeImage.createFromPath(join(opts.resourcesDir, 'tray-icon.png'));
      tray = new Tray(icon);
      tray.setToolTip('SoundDesk');
      tray.setContextMenu(buildMenu());
      tray.on('click', () => opts.window.isVisible() ? opts.window.focus() : opts.window.show());
    },
    setPlaying(v) {
      isPlaying = v;
      tray?.setContextMenu(buildMenu());
    },
    destroy() {
      tray?.destroy();
      tray = null;
    }
  };
}
```

- [ ] **Step 3: Wire minimize-to-tray on the main window**

Modify `src/main/windows/main-window.ts` — add a `close` handler:

```ts
// Inside createMainWindow, after creating `window`:
window.on('close', (e) => {
  const quitting = (app as unknown as { isQuiting?: boolean }).isQuiting;
  if (!quitting) {
    e.preventDefault();
    window.hide();
  }
});
```

- [ ] **Step 4: Wire tray into bootstrap**

Add to `src/main/app/bootstrap.ts` (imports and inside `start()` before the second-instance handler):

```ts
import { createTrayManager } from '@main/tray/tray-manager';
// ...
const tray = createTrayManager({
  window: handles.window,
  controls,
  onShowMiniPlayer: () => { /* filled in Task 15 */ },
  resourcesDir: app.isPackaged ? join(process.resourcesPath) : join(process.cwd(), 'resources')
});
tray.init();

bridge.on('playStateChange', (u) => tray.setPlaying(u.isPlaying));
bridge.on('trackChange', (t) => tray.setPlaying(t.isPlaying));
app.on('before-quit', () => { (app as unknown as { isQuiting: boolean }).isQuiting = true; });
```

Add `tray` to `AppContext`.

- [ ] **Step 5: Manual test**

```bash
npm run dev
```

- Tray icon appears in the system tray.
- Closing the window hides it (does not quit).
- Click tray icon → window reappears.
- Tray menu → Quit truly exits.

- [ ] **Step 6: Commit**

```bash
git add src/main/tray/ src/main/app/bootstrap.ts src/main/windows/main-window.ts resources/tray-icon.png
git commit -m "feat: add system tray and minimize-to-tray behavior"
```

---

## Task 14: Track-change notifications

**Files:**
- Create: `src/main/integrations/notifier.ts`
- Modify: `src/main/app/bootstrap.ts`

- [ ] **Step 1: Implement notifier**

Create `src/main/integrations/notifier.ts`:

```ts
import { Notification, nativeImage } from 'electron';
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
          silent: true,
          icon: track.artworkUrl ? nativeImage.createFromDataURL('') : undefined
          // Artwork by URL requires a download step; left as v1.1 improvement.
        });
        n.show();
      } catch (err) {
        logger.warn('notification failed', { err: (err as Error).message });
      }
    }
  };
}
```

> Note: native `Notification` accepts a local file or data URL for `icon`, not a remote URL. Downloading the artwork to a temp file before showing is an enhancement deferred to v1.1.

- [ ] **Step 2: Wire into bootstrap**

In `src/main/app/bootstrap.ts`:

```ts
import { createNotifier } from '@main/integrations/notifier';
// ...
const notifier = createNotifier(logger, () => config.getNotificationsEnabled());
bridge.on('trackChange', (t) => notifier.notify(t));
```

- [ ] **Step 3: Manual test**

Skip tracks in SC; you should see a native toast for each.

- [ ] **Step 4: Commit**

```bash
git add src/main/integrations/notifier.ts src/main/app/bootstrap.ts
git commit -m "feat: add native notifications on track change"
```

---

## Task 15: Mini-player window

**Files:**
- Create: `src/main/windows/mini-player.ts`, `src/preload/mini-player-preload.ts`, `src/renderer/mini-player/index.html`, `src/renderer/mini-player/main.ts`, `src/renderer/mini-player/style.css`
- Modify: `src/main/app/bootstrap.ts`, `src/main/tray/tray-manager.ts`

A small always-on-top window. Receives state pushes from main; sends commands back.

- [ ] **Step 1: Create renderer HTML**

Create `src/renderer/mini-player/index.html`:

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Mini Player</title>
  <link rel="stylesheet" href="./style.css" />
</head>
<body>
  <div id="root">
    <img id="art" alt="" />
    <div id="meta">
      <div id="title">No track</div>
      <div id="artist"></div>
      <div id="progress"><div id="bar"></div></div>
    </div>
    <div id="controls">
      <button id="prev" title="Previous">⏮</button>
      <button id="playpause" title="Play/Pause">▶</button>
      <button id="next" title="Next">⏭</button>
    </div>
  </div>
  <script type="module" src="./main.ts"></script>
</body>
</html>
```

- [ ] **Step 2: Renderer CSS**

Create `src/renderer/mini-player/style.css`:

```css
html, body { margin: 0; padding: 0; height: 100%; background: #1a1a1a; color: #eee; font: 12px/1.3 -apple-system, Segoe UI, Roboto, sans-serif; user-select: none; }
#root { display: grid; grid-template-columns: 64px 1fr auto; gap: 10px; align-items: center; padding: 8px; height: calc(100% - 16px); }
#art { width: 64px; height: 64px; background: #333; border-radius: 4px; object-fit: cover; }
#meta { min-width: 0; }
#title, #artist { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#title { font-weight: 600; }
#artist { color: #aaa; margin-top: 2px; }
#progress { margin-top: 6px; height: 3px; background: #333; border-radius: 2px; overflow: hidden; }
#bar { height: 100%; width: 0%; background: #f50; transition: width 200ms linear; }
#controls { display: flex; gap: 4px; }
#controls button { background: transparent; color: #eee; border: 0; font-size: 16px; cursor: pointer; padding: 4px 8px; border-radius: 4px; }
#controls button:hover { background: #2a2a2a; }
```

- [ ] **Step 3: Renderer logic**

Create `src/renderer/mini-player/main.ts`:

```ts
import type { TrackState } from '@shared/types';

declare global {
  interface Window {
    miniPlayerApi: {
      onState: (cb: (s: { track: TrackState | null; positionMs: number }) => void) => void;
      command: (cmd: 'play-pause' | 'next' | 'prev') => void;
    };
  }
}

const $art = document.getElementById('art') as HTMLImageElement;
const $title = document.getElementById('title')!;
const $artist = document.getElementById('artist')!;
const $bar = document.getElementById('bar')!;
const $playpause = document.getElementById('playpause')!;
document.getElementById('prev')!.addEventListener('click', () => window.miniPlayerApi.command('prev'));
document.getElementById('next')!.addEventListener('click', () => window.miniPlayerApi.command('next'));
$playpause.addEventListener('click', () => window.miniPlayerApi.command('play-pause'));

let lastTrack: TrackState | null = null;
let lastPositionMs = 0;
let lastTickWallClockMs = Date.now();

window.miniPlayerApi.onState((s) => {
  lastTrack = s.track;
  lastPositionMs = s.positionMs;
  lastTickWallClockMs = Date.now();
  render();
});

function render() {
  if (!lastTrack) {
    $title.textContent = 'No track playing';
    $artist.textContent = '';
    $bar.style.width = '0%';
    $playpause.textContent = '▶';
    $art.removeAttribute('src');
    return;
  }
  $title.textContent = lastTrack.title ?? 'Unknown';
  $artist.textContent = lastTrack.artist ?? '';
  $playpause.textContent = lastTrack.isPlaying ? '⏸' : '▶';
  if (lastTrack.artworkUrl) $art.src = lastTrack.artworkUrl;
  const dur = lastTrack.durationMs ?? 0;
  const elapsed = lastTrack.isPlaying ? Date.now() - lastTickWallClockMs : 0;
  const pos = lastPositionMs + elapsed;
  const pct = dur > 0 ? Math.min(100, (pos / dur) * 100) : 0;
  $bar.style.width = pct + '%';
}

setInterval(render, 250);
```

- [ ] **Step 4: Mini-player preload**

Create `src/preload/mini-player-preload.ts`:

```ts
import { contextBridge, ipcRenderer } from 'electron';
import { CHANNELS } from '@shared/channels';

contextBridge.exposeInMainWorld('miniPlayerApi', {
  onState: (cb: (s: unknown) => void) => {
    ipcRenderer.on(CHANNELS.MINI_PLAYER_STATE, (_e, payload) => cb(payload));
  },
  command: (cmd: 'play-pause' | 'next' | 'prev') => ipcRenderer.send(CHANNELS.MINI_PLAYER_COMMAND, cmd)
});
```

- [ ] **Step 5: Main-process mini-player window**

Create `src/main/windows/mini-player.ts`:

```ts
import { BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';
import type { Controls } from '@main/media/controls';
import { CHANNELS } from '@shared/channels';
import type { TrackState } from '@shared/types';

export interface MiniPlayer {
  show(): void;
  hide(): void;
  toggle(): void;
  pushState(track: TrackState | null, positionMs: number): void;
  destroy(): void;
}

export function createMiniPlayer(opts: { controls: Controls }): MiniPlayer {
  let win: BrowserWindow | null = null;

  const ensureWindow = () => {
    if (win) return win;
    win = new BrowserWindow({
      width: 380,
      height: 110,
      alwaysOnTop: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      autoHideMenuBar: true,
      frame: false,
      webPreferences: {
        preload: join(__dirname, '../preload/mini-player-preload.js'),
        contextIsolation: true
      }
    });
    win.on('closed', () => { win = null; });
    if (process.env.ELECTRON_RENDERER_URL) {
      win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/mini-player/index.html`);
    } else {
      win.loadFile(join(__dirname, '../renderer/mini-player/index.html'));
    }
    return win;
  };

  ipcMain.on(CHANNELS.MINI_PLAYER_COMMAND, (_e, cmd: 'play-pause' | 'next' | 'prev') => {
    if (cmd === 'play-pause') opts.controls.togglePlayPause();
    else if (cmd === 'next') opts.controls.next();
    else if (cmd === 'prev') opts.controls.prev();
  });

  return {
    show() { ensureWindow().show(); },
    hide() { win?.hide(); },
    toggle() {
      if (win?.isVisible()) win.hide();
      else ensureWindow().show();
    },
    pushState(track, positionMs) {
      win?.webContents.send(CHANNELS.MINI_PLAYER_STATE, { track, positionMs });
    },
    destroy() { win?.close(); win = null; }
  };
}
```

- [ ] **Step 6: Wire into bootstrap and tray**

In `src/main/app/bootstrap.ts`:

```ts
import { createMiniPlayer } from '@main/windows/mini-player';
// ...
const miniPlayer = createMiniPlayer({ controls });

// Update tray to use it:
const tray = createTrayManager({
  window: handles.window,
  controls,
  onShowMiniPlayer: () => miniPlayer.toggle(),
  resourcesDir: app.isPackaged ? join(process.resourcesPath) : join(process.cwd(), 'resources')
});

bridge.on('trackChange', (t) => {
  miniPlayer.pushState(t, t.positionMs);
});
bridge.on('playStateChange', (u) => {
  if (currentTrack.value) miniPlayer.pushState(currentTrack.value, u.positionMs);
});
bridge.on('seek', (u) => {
  if (currentTrack.value) miniPlayer.pushState(currentTrack.value, u.positionMs);
});
```

Add `miniPlayer` to `AppContext`.

- [ ] **Step 7: Manual test**

- Open mini-player from the tray menu.
- Window appears, stays on top, no taskbar entry.
- While a track plays in SC, mini-player shows artwork, title, artist, and a progress bar that advances smoothly.
- Clicking the mini-player's play/pause/next/prev buttons controls SC playback.

- [ ] **Step 8: Commit**

```bash
git add src/main/windows/mini-player.ts src/preload/mini-player-preload.ts src/renderer/mini-player/ src/main/app/bootstrap.ts
git commit -m "feat: add always-on-top mini-player window"
```

---

## Task 16: Linux MPRIS adapter

**Files:**
- Create: `src/main/media/mpris-adapter.ts`
- Modify: `src/main/app/bootstrap.ts`, `package.json`

This task only takes effect on Linux. On Windows it's a no-op.

- [ ] **Step 1: Add dependency**

```bash
npm install mpris-service
```

Verify `mpris-service` is still the maintained option for Electron at task time. If a different package is recommended, substitute and adjust the code accordingly.

- [ ] **Step 2: Implement adapter**

Create `src/main/media/mpris-adapter.ts`:

```ts
import type { TrackState } from '@shared/types';
import type { Controls } from './controls';
import type { Logger } from '@main/logger';

export interface MprisAdapter {
  update(track: TrackState, positionMs: number): void;
  shutdown(): void;
}

export function createMprisAdapter(opts: { controls: Controls; logger: Logger }): MprisAdapter | null {
  if (process.platform !== 'linux') return null;

  // Load lazily so non-Linux builds don't try to bind native deps.
  let player: unknown;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const MprisService = require('mpris-service');
    player = new MprisService({
      name: 'sounddesk',
      identity: 'SoundDesk',
      supportedInterfaces: ['player'],
      supportedMimeTypes: [],
      supportedUriSchemes: []
    });
    const p = player as {
      on: (ev: string, cb: () => void) => void;
      playbackStatus: string;
      metadata: Record<string, unknown>;
    };
    p.on('play', () => opts.controls.play());
    p.on('pause', () => opts.controls.pause());
    p.on('playpause', () => opts.controls.togglePlayPause());
    p.on('next', () => opts.controls.next());
    p.on('previous', () => opts.controls.prev());
  } catch (err) {
    opts.logger.warn('MPRIS unavailable (D-Bus missing?)', { err: (err as Error).message });
    return null;
  }

  return {
    update(track, positionMs) {
      const p = player as { playbackStatus: string; metadata: Record<string, unknown> };
      p.playbackStatus = track.isPlaying ? 'Playing' : 'Paused';
      p.metadata = {
        'mpris:trackid': '/org/mpris/MediaPlayer2/Track/1',
        'mpris:length': (track.durationMs ?? 0) * 1000, // microseconds
        'xesam:title': track.title ?? '',
        'xesam:artist': track.artist ? [track.artist] : [],
        'mpris:artUrl': track.artworkUrl ?? ''
      };
    },
    shutdown() {
      // mpris-service doesn't expose a clean dispose; rely on process exit.
    }
  };
}
```

- [ ] **Step 3: Wire into bootstrap**

In `src/main/app/bootstrap.ts`:

```ts
import { createMprisAdapter } from '@main/media/mpris-adapter';
// ...
const mpris = createMprisAdapter({ controls, logger });

bridge.on('trackChange', (t) => mpris?.update(t, t.positionMs));
bridge.on('playStateChange', () => {
  if (currentTrack.value) mpris?.update(currentTrack.value, currentTrack.value.positionMs);
});
```

- [ ] **Step 4: Manual test (Linux only)**

```bash
npm run dev
```

On a Linux desktop with `playerctl` installed:

```bash
playerctl --list-all       # should show sounddesk
playerctl --player=sounddesk metadata
playerctl --player=sounddesk play-pause
```

Verify metadata appears and `play-pause` toggles SC.

- [ ] **Step 5: Commit**

```bash
git add src/main/media/mpris-adapter.ts src/main/app/bootstrap.ts package.json package-lock.json
git commit -m "feat: add MPRIS adapter for Linux media integration"
```

---

## Task 17: Windows SMTC adapter

**Files:**
- Create: `src/main/media/smtc-adapter.ts`
- Modify: `src/main/app/bootstrap.ts`, `package.json`

**Verification required.** The Node ecosystem for SMTC has been in flux. At task time, choose **one** of these options based on what's currently maintained:

1. **`@nodert-win10-rs4/windows.media`** (NodeRT bindings) — historically the standard but maintenance is uncertain. Check.
2. **A WinRT bridge via Electron's native APIs** — Electron 28+ exposes some media-session capabilities via `webContents.session.setMediaSessionPlaybackState`-style APIs (verify against current Electron docs).
3. **Fall back to media-keys only** — accept that the rich SMTC overlay won't be present on Windows for v1, document this, and ship.

Pick the simplest working option. If 1 and 2 both fail, ship option 3 and file a follow-up.

- [ ] **Step 1: Decide on approach**

Investigate options 1 and 2 in the current docs. Write the chosen library into `package.json` and document the decision in a comment at the top of `smtc-adapter.ts`. If choosing option 3, create the file as a no-op stub and skip the rest of this task.

- [ ] **Step 2: Implement SMTC adapter (or stub)**

Create `src/main/media/smtc-adapter.ts` with shape matching `MprisAdapter` from Task 16:

```ts
import type { TrackState } from '@shared/types';
import type { Controls } from './controls';
import type { Logger } from '@main/logger';

export interface SmtcAdapter {
  update(track: TrackState, positionMs: number): void;
  shutdown(): void;
}

export function createSmtcAdapter(opts: { controls: Controls; logger: Logger }): SmtcAdapter | null {
  if (process.platform !== 'win32') return null;

  // TODO at implementation time: bind to the chosen Windows media-session API.
  // For v1 if no library is viable, return null and rely on globalShortcut for media keys.
  opts.logger.info('SMTC adapter: no-op stub (v1 fallback)');
  return null;
}
```

> The "TODO" here is intentional: it's an open technical decision flagged in the spec. If you pick a real library, replace the body with the binding logic; if you ship the stub, that's a documented v1 limitation.

- [ ] **Step 3: Wire into bootstrap symmetrically with MPRIS**

```ts
import { createSmtcAdapter } from '@main/media/smtc-adapter';
const smtc = createSmtcAdapter({ controls, logger });
bridge.on('trackChange', (t) => smtc?.update(t, t.positionMs));
```

- [ ] **Step 4: Commit**

```bash
git add src/main/media/smtc-adapter.ts src/main/app/bootstrap.ts package.json package-lock.json
git commit -m "feat: add Windows SMTC adapter scaffold (v1 stub or live binding)"
```

---

## Task 18: User-customizable global shortcuts

**Files:**
- Create: `src/main/media/shortcuts.ts`
- Modify: `src/main/app/bootstrap.ts`

`media-keys.ts` handles fixed media keys. This adds **user-configurable** shortcuts on top, read from the config store.

- [ ] **Step 1: Implement shortcuts manager**

Create `src/main/media/shortcuts.ts`:

```ts
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
      for (const b of config.bindings) {
        // Skip media keys if media-keys.ts already owns them
        if (['MediaPlayPause', 'MediaNextTrack', 'MediaPreviousTrack'].includes(b.accelerator)) continue;
        const ok = globalShortcut.register(b.accelerator, handlerFor(b.action));
        if (!ok) opts.logger.warn('shortcut conflict — not registered', { accelerator: b.accelerator, action: b.action });
        else registered.push(b.accelerator);
      }
    },
    clear
  };
}
```

- [ ] **Step 2: Wire into bootstrap**

```ts
import { createShortcutsManager } from '@main/media/shortcuts';
// ...
const shortcuts = createShortcutsManager({
  controls,
  logger,
  onMiniPlayerToggle: () => miniPlayer.toggle()
});
shortcuts.apply(config.getShortcuts());
app.on('will-quit', () => shortcuts.clear());
```

> Settings UI to edit shortcuts at runtime is intentionally out of v1 scope. Users edit the persisted config file directly (the spec allows this); a settings UI is a v1.1 follow-up.

- [ ] **Step 3: Manual test**

Edit the config file (path: `app.getPath('userData') + '/config.json'`) to add `{ "action": "mini-player-toggle", "accelerator": "CommandOrControl+Alt+M" }`. Restart app. Press the chord — mini-player toggles.

- [ ] **Step 4: Commit**

```bash
git add src/main/media/shortcuts.ts src/main/app/bootstrap.ts
git commit -m "feat: add user-customizable global shortcuts"
```

---

## Task 19: Auto-update via electron-updater

**Files:**
- Create: `src/main/update/updater.ts`
- Modify: `src/main/app/bootstrap.ts`, `package.json` (publish config)

- [ ] **Step 1: Add publish config to package.json**

Append a `build` block in `package.json`:

```json
{
  "build": {
    "appId": "com.gianotto.sounddesk",
    "productName": "SoundDesk",
    "directories": { "output": "release" },
    "files": ["out/**/*", "resources/**/*", "package.json"],
    "win": { "target": "nsis", "icon": "resources/icon.ico" },
    "linux": { "target": ["AppImage", "deb"], "icon": "resources/icon.png", "category": "AudioVideo" },
    "publish": {
      "provider": "github",
      "owner": "<your-github-username>",
      "repo": "sounddesk"
    }
  }
}
```

Replace `<your-github-username>` with the real account. Add `resources/icon.png` (512×512) and `resources/icon.ico`.

- [ ] **Step 2: Implement updater wrapper**

Create `src/main/update/updater.ts`:

```ts
import { autoUpdater } from 'electron-updater';
import type { Logger } from '@main/logger';

export interface Updater {
  checkAndPrompt(): void;
}

export function createUpdater(logger: Logger): Updater {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('error', (err) => logger.warn('update error', { err: err.message }));
  autoUpdater.on('update-available', (info) => logger.info('update available', { version: info.version }));
  autoUpdater.on('update-downloaded', (info) => logger.info('update downloaded', { version: info.version }));

  return {
    checkAndPrompt() {
      autoUpdater.checkForUpdatesAndNotify().catch((err) => logger.warn('update check failed', { err: (err as Error).message }));
    }
  };
}
```

- [ ] **Step 3: Wire into bootstrap**

```ts
import { createUpdater } from '@main/update/updater';
// ...
if (app.isPackaged) {
  const updater = createUpdater(logger);
  setTimeout(() => updater.checkAndPrompt(), 5000);
}
```

- [ ] **Step 4: Commit**

```bash
git add src/main/update/updater.ts src/main/app/bootstrap.ts package.json
git commit -m "feat: wire electron-updater against GitHub Releases"
```

---

## Task 20: Network failure overlay

**Files:**
- Modify: `src/main/windows/main-window.ts`

When the BrowserView fails to load SC (no network, DNS failure, etc.), show a retry overlay rather than a blank window.

- [ ] **Step 1: Add overlay HTML**

Create `resources/offline.html`:

```html
<!doctype html>
<html><head><meta charset="utf-8" /><title>Offline</title>
<style>
  html,body { height: 100%; margin: 0; background: #1a1a1a; color: #eee; font: 14px -apple-system, Segoe UI, Roboto, sans-serif; }
  .wrap { height: 100%; display: grid; place-items: center; text-align: center; padding: 24px; }
  button { background: #f50; color: #fff; border: 0; padding: 8px 16px; border-radius: 4px; cursor: pointer; }
</style></head>
<body><div class="wrap"><div>
  <h2>Can't reach SoundCloud</h2>
  <p>Check your internet connection.</p>
  <button onclick="location.href='https://soundcloud.com'">Retry</button>
</div></div></body></html>
```

- [ ] **Step 2: Handle did-fail-load**

In `src/main/windows/main-window.ts`, after `view.webContents.loadURL(SC_URL)`:

```ts
view.webContents.on('did-fail-load', (_e, errorCode, errorDesc, validatedURL, isMainFrame) => {
  if (!isMainFrame) return;
  const offlinePath = app.isPackaged
    ? join(process.resourcesPath, 'offline.html')
    : join(process.cwd(), 'resources', 'offline.html');
  view.webContents.loadFile(offlinePath);
});
```

- [ ] **Step 3: Manual test**

Disable network, launch the app — offline overlay appears. Re-enable network, click Retry — SC loads.

- [ ] **Step 4: Commit**

```bash
git add resources/offline.html src/main/windows/main-window.ts
git commit -m "feat: show offline overlay on BrowserView load failure"
```

---

## Task 21: Layer 2 — Playwright DOM scraper test against live soundcloud.com

**Files:**
- Create: `tests/scraper/playwright.config.ts`, `tests/scraper/selectors-live.spec.ts`, `.github/workflows/scraper-nightly.yml`
- Modify: `package.json`

This is the early-warning system for SC markup changes. It runs nightly, not on every push, because it depends on a live external site.

- [ ] **Step 1: Add Playwright**

```bash
npm install --save-dev @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Playwright config**

Create `tests/scraper/playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 }
  },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-scraper', open: 'never' }]]
});
```

- [ ] **Step 3: Live selector spec**

Create `tests/scraper/selectors-live.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { SELECTORS } from '../../src/preload/selectors';

const SC_USERNAME = process.env.SC_TEST_USERNAME;
const SC_PASSWORD = process.env.SC_TEST_PASSWORD;
// A known-stable public track URL with a long duration is fine — adjust if it goes private.
const TRACK_URL = process.env.SC_TEST_TRACK_URL ?? 'https://soundcloud.com/discover';

test.describe('SoundCloud DOM contract', () => {
  test.skip(!SC_USERNAME || !SC_PASSWORD, 'SC test credentials not configured');

  test('every selector in the table resolves on a real session', async ({ page }) => {
    await page.goto('https://soundcloud.com/signin', { waitUntil: 'domcontentloaded' });
    // The login form is itself a moving target; if this breaks, update only this block.
    await page.fill('input[type="email"]', SC_USERNAME!);
    await page.click('button[type="submit"]');
    await page.fill('input[type="password"]', SC_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');

    await page.goto(TRACK_URL, { waitUntil: 'networkidle' });
    // Trigger playback by clicking the first play button on the page.
    await page.locator('.sc-button-play, .playButton').first().click();
    await page.waitForTimeout(3000);

    const results: Record<string, boolean> = {};
    for (const [name, spec] of Object.entries(SELECTORS)) {
      const candidates = [spec.primary, ...(spec.fallbacks ?? [])];
      let found = false;
      for (const sel of candidates) {
        if (await page.locator(sel).count() > 0) { found = true; break; }
      }
      results[name] = found;
    }

    for (const [name, ok] of Object.entries(results)) {
      expect(ok, `selector "${name}" failed to resolve on live page`).toBe(true);
    }
  });
});
```

- [ ] **Step 4: Add npm scripts**

Add to `package.json` `scripts`:

```json
"test:scraper": "playwright test --config=tests/scraper/playwright.config.ts"
```

- [ ] **Step 5: Nightly workflow**

Create `.github/workflows/scraper-nightly.yml`:

```yaml
name: scraper-nightly
on:
  schedule:
    - cron: '0 5 * * *'   # 05:00 UTC daily
  workflow_dispatch:

jobs:
  scraper:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run test:scraper
        env:
          SC_TEST_USERNAME: ${{ secrets.SC_TEST_USERNAME }}
          SC_TEST_PASSWORD: ${{ secrets.SC_TEST_PASSWORD }}
          SC_TEST_TRACK_URL: ${{ secrets.SC_TEST_TRACK_URL }}
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report-scraper
          path: playwright-report-scraper/
```

> Configure `SC_TEST_USERNAME`, `SC_TEST_PASSWORD`, and `SC_TEST_TRACK_URL` in repo settings → Secrets and variables → Actions. Use a dedicated SC account, not your personal one.

- [ ] **Step 6: Commit**

```bash
git add tests/scraper/ .github/workflows/scraper-nightly.yml package.json package-lock.json
git commit -m "test: add nightly Playwright check of SC DOM selectors"
```

---

## Task 22: Layer 3 — Smoke E2E on packaged build

**Files:**
- Create: `tests/e2e/electron.spec.ts`, `tests/e2e/playwright.config.ts`
- Modify: `package.json`

Drives the actual packaged Electron app. Checks lifecycle and the parts that don't depend on live SC playback.

- [ ] **Step 1: Add Electron-Playwright integration**

The Playwright `_electron` API ships with `@playwright/test` (no extra dep), but verify it's still the recommended path at task time.

- [ ] **Step 2: E2E config**

Create `tests/e2e/playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  reporter: [['list']]
});
```

- [ ] **Step 3: Smoke test**

Create `tests/e2e/electron.spec.ts`:

```ts
import { test, expect, _electron as electron } from '@playwright/test';
import { join } from 'node:path';

test('app launches with main window', async () => {
  const app = await electron.launch({
    args: [join(__dirname, '../../out/main/index.js')],
    env: { ...process.env, NODE_ENV: 'test' }
  });
  const window = await app.firstWindow();
  await expect(window).toHaveTitle(/SoundDesk/i);
  await app.close();
});

test('config persists across launches', async () => {
  // First launch — write a non-default setting via direct file write (config dir resolved by Electron).
  // For a real test, expose a small "test bridge" in the main process under NODE_ENV=test that lets us
  // read/write config without UI. See spec § testing for trade-offs.
  // This task ships the launch + title check; the persistence assertion is a follow-up.
  test.skip(true, 'persistence assertion requires test-only IPC; deferred to v1.1');
});
```

> The persistence test requires a test-only IPC surface that doesn't exist yet. The honest move is to ship the launch check now and defer the persistence assertion (or add the test bridge module later). Don't fake it.

- [ ] **Step 4: Add npm script**

Append to `package.json` `scripts`:

```json
"test:e2e": "npm run build && playwright test --config=tests/e2e/playwright.config.ts"
```

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/ package.json package-lock.json
git commit -m "test: add Playwright Electron smoke launch test"
```

---

## Task 23: CI workflow

**Files:**
- Create: `.github/workflows/build.yml`, `vitest.config.ts`

- [ ] **Step 1: Add vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@main': resolve('src/main'),
      '@preload': resolve('src/preload'),
      '@renderer': resolve('src/renderer')
    }
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node'
  }
});
```

- [ ] **Step 2: Add GitHub Actions workflow**

Create `.github/workflows/build.yml`:

```yaml
name: build
on:
  push:
    branches: [main, master]
  pull_request:

jobs:
  test-and-build:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run test
      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
      - name: E2E smoke (Electron driver)
        run: npm run test:e2e
      - name: Build (Linux)
        if: matrix.os == 'ubuntu-latest'
        run: npm run build:linux
      - name: Build (Windows)
        if: matrix.os == 'windows-latest'
        run: npm run build:win
      - uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.os }}-release
          path: release/
```

- [ ] **Step 3: Commit**

```bash
git add .github/ vitest.config.ts
git commit -m "config: add CI workflow for tests + cross-platform builds"
```

---

## Task 24: Final smoke test on packaged build (manual)

- [ ] **Step 1: Build locally for the current platform**

```bash
npm run build:linux   # or build:win on Windows
```

Output appears under `release/`.

- [ ] **Step 2: Install and run the packaged app**

- **Linux:** `chmod +x release/SoundDesk-*.AppImage && release/SoundDesk-*.AppImage`
- **Windows:** double-click the NSIS installer, complete install, launch from Start menu.

- [ ] **Step 3: Walk through every v1 feature**

Tick each:

- [ ] App launches, soundcloud.com loads, login persists across relaunches.
- [ ] Track plays, audio is clean (no codec issues).
- [ ] Closing main window hides to tray; music keeps playing.
- [ ] Tray click restores window; tray menu Quit truly exits.
- [ ] Media keys (play/pause/next/prev) work globally.
- [ ] Notification appears on each track change.
- [ ] Mini-player opens, stays on top, controls work, progress advances.
- [ ] MPRIS responds to `playerctl` (Linux) or SMTC overlay appears (Windows, only if a real binding was wired in Task 17).
- [ ] Network disconnect shows offline overlay.
- [ ] Custom shortcut from config file fires the correct action.
- [ ] App version visible somewhere (about dialog or log) matches package.json.

Any failure here goes back to the relevant task.

- [ ] **Step 4: Tag v0.1.0 release candidate**

If everything passes:

```bash
git tag v0.1.0-rc.1
git push origin v0.1.0-rc.1
```

This is the cutover point to publish the first GitHub Release that auto-updates will pick up.

---

## Notes for future v2 work

These are deliberately out of v1 scope. Captured so they don't get lost.

- **Network casting** (Chromecast first). Brainstorm separately. Open question: intercept HLS URL vs capture audio output. See spec § Open items.
- **Discord Rich Presence.** Add `integrations/discord-rpc.ts` that subscribes to `trackChange`. Should be ~half a day's work once v1 is shipped.
- **Settings UI.** A small renderer in the main window for editing shortcuts, toggling notifications, etc., rather than hand-editing the config JSON.
- **Notification artwork.** Download `track.artworkUrl` to a temp file before showing native notifications.
- **Sleep timer, gapless queueing, equalizer.** Anything that requires more than remote-controlling SC's existing player is real product work, not wrapper work.
