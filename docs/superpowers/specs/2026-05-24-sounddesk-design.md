# SoundDesk — Design

**Date:** 2026-05-24
**Status:** Draft for review

## Purpose

SoundDesk is a cross-platform desktop app (Windows + Linux) that wraps
soundcloud.com in a native shell, adding OS-level integrations that the
browser cannot provide on its own (media keys, system tray, native
notifications, a floating mini-player, custom global shortcuts, and
auto-update).

SoundCloud has no public streaming API, so the app uses the live website
inside an embedded webview. Track metadata and transport state are
derived by observing the SoundCloud DOM from a preload script.

## Scope

### v1 — In scope

- Embedded soundcloud.com inside a native window
- Session persistence (stay logged in across launches)
- Media keys (play / pause / next / previous): MPRIS on Linux, SMTC on Windows
- System tray icon + minimize-to-tray (music keeps playing in the tray)
- OS notifications on track change
- Mini-player: always-on-top floating window with artwork + transport
- User-customizable global keyboard shortcuts
- Auto-update via GitHub Releases (`electron-updater`)
- Packaging: Windows NSIS installer; Linux AppImage + `.deb`

### v2 — Deferred

- **Network casting** (cast currently playing audio to LAN devices).
  Starting with Chromecast (Google Cast). DLNA/UPnP and Sonos to follow
  if demand exists.
- **Discord Rich Presence** (show current track on Discord profile).

### Out of scope (for now)

- AirPlay client support from Electron on Windows/Linux — current
  library landscape is fragile.
- Track downloads (against SoundCloud ToS for free accounts).
- Public telemetry / analytics.

## Technology choices

| Layer | Choice | Reason |
|---|---|---|
| Runtime | **Electron** (latest stable) | Bundles Chromium, so audio codec support (HLS/AAC/MP3) is identical on every Linux distro. Tauri's WebKitGTK has known codec gaps that vary by distro — unacceptable for a music app. Mature libraries for every v1 integration. |
| Language | **TypeScript** | Catches IPC contract bugs across main/renderer boundary. |
| Build | **Vite + electron-vite** | Fast HMR for renderer; cohesive dev experience. |
| Packaging | **electron-builder** | Multi-target packaging (NSIS, AppImage, deb) in one config. |
| Settings | **electron-store** | Battle-tested JSON store with schema validation. |
| Updater | **electron-updater** | Standard pairing with electron-builder; works with GitHub Releases. |

> **Verification note:** at scaffold time, pin Electron to the current
> stable line and verify each native integration library is still
> maintained. The README's "do not invent function names" rule applies
> — confirm APIs against current docs before coding.

## Architecture

### Process layout

```
main process (Node)                renderer (Chromium)
─────────────────────              ─────────────────────
window + tray manager      ←IPC→   BrowserView hosting
media-key bindings                 soundcloud.com
SMTC/MPRIS adapter                 + preload script that
notifier                           scrapes track metadata
electron-updater                   from the DOM via
config store                       MutationObserver

                                   mini-player window
                                   (separate BrowserWindow,
                                    own renderer)
```

### Module breakdown

All paths are under `src/`. Each module has one purpose and a small public surface.

**Main process — `src/main/`**

| Module | Purpose | Public surface |
|---|---|---|
| `app/bootstrap.ts` | App lifecycle, single-instance lock, window creation | `start()` |
| `windows/main-window.ts` | Main BrowserWindow + embedded BrowserView for SC | `create()`, `getWebContents()` |
| `windows/mini-player.ts` | Always-on-top floating window | `show()`, `hide()`, `toggle()`, `updateTrack(t)` |
| `tray/tray-manager.ts` | System tray icon + context menu | `init()`, `setPlaying(b)` |
| `media/scraper-bridge.ts` | Receives DOM events from preload, emits typed events | `on('trackChange' \| 'playStateChange' \| 'seek', cb)` |
| `media/local-clock.ts` | Locally predicts current playback position between syncs | `start(syncPoint)`, `pause()`, `resync(pos)`, `now()` |
| `media/controls.ts` | Sends transport commands back to renderer | `play()`, `pause()`, `next()`, `prev()` |
| `media/smtc-mpris.ts` | OS media session adapter (SMTC on Windows, MPRIS on Linux) | `update(trackState)` |
| `media/media-keys.ts` | Global media key registration via `globalShortcut` | `register()`, `unregister()` |
| `media/shortcuts.ts` | User-customizable global shortcuts | `apply(config)` |
| `integrations/notifier.ts` | OS toast on track change | `notify(track)` |
| `update/updater.ts` | electron-updater wrapper, checks GitHub Releases | `checkAndPrompt()` |
| `config/store.ts` | Persistent settings (shortcuts, prefs) via electron-store | typed get/set |
| `logger.ts` | File-rotating logger (~1 MB cap) | `info`, `warn`, `error` |

**Renderer — `src/renderer/`**

- `preload/sc-preload.ts` — injected into the SoundCloud BrowserView. Watches DOM via `MutationObserver`, exposes a `window.scBridge` to read/write playback state via `contextBridge`. **This is the only file that knows SoundCloud's DOM structure.**
- `preload/selectors.ts` — single table of all DOM selectors used by the scraper, each with optional fallback selectors.
- `mini-player/` — small Vite app for the mini-player UI (artwork, title, artist, transport).

**Shared — `src/shared/`**

- `types.ts` — `TrackState`, `PlayState`, `ShortcutConfig`, IPC channel constants. Single source of truth for the cross-process contract.

### Why this shape

- The DOM scraper is one file plus a selectors table. When SoundCloud changes their markup, you edit one place and ship a patch.
- Every OS integration (`smtc-mpris`, `notifier`, mini-player) subscribes to the same `scraper-bridge` event stream — no duplicated scraping logic.
- Mini-player is a separate window, not an in-page overlay — simpler, and behaves correctly with the OS window manager.

## Data flow

The whole app revolves around one event stream: "what is the SoundCloud
player doing right now?"

```
SoundCloud DOM (inside BrowserView)
        │  MutationObserver in preload watches:
        │  - title / artist / artwork elements (track change)
        │  - play/pause button state (play-state change)
        │  - progress bar value (low-rate, for seek detection only)
        ▼
preload's window.scBridge ──ipcRenderer──► main process
        ▲                                           │
        │ ipcRenderer.invoke('control:play|pause|…')│ scraper-bridge emits typed events
        │ (transport commands flow back)            ▼
        │                                  ┌────────┴────────┐
        │                                  ▼        ▼        ▼
        │                          smtc-mpris  notifier  mini-player
        │                          (OS media)  (toast)   (window)
        │                                  ▲
        │                                  │ user clicks mini-player play
        └──────────────────────────────────┘ controls.play() → IPC → preload simulates click on SC play button
```

**Two channels:**

- **Up (reactive):** preload observes DOM → typed events → all consumers update.
- **Down (commands):** media-key press / mini-player button / SMTC-MPRIS press → `controls.play()` → IPC → preload simulates a click on the corresponding button in the SC DOM. The app never reimplements playback — it remote-controls SoundCloud's own player.

### Position tracking via local clock

To avoid high-frequency IPC for progress updates, position is predicted
locally by the main process:

- On **track change**: preload scrapes once → `{ title, artist, artwork, durationMs, initialPositionMs, isPlaying }` → main process records `syncPoint = (positionMs, wallClockMs)` and starts a local clock.
- Mini-player and any UI tick from the local clock at 60 FPS — no IPC for the tick.
- Main re-syncs only on three events:
  1. **Play / pause toggle** — detected from DOM button state change.
  2. **Track change** — detected from title/artist DOM change.
  3. **Seek detected** — preload polls progress bar at ~1 Hz solely to detect *jumps* (|actual − predicted| > 1.5 s). On a jump, send a re-sync. No high-frequency progress streaming.

**Known imperfections (acceptable):**

- **Buffering stalls.** SC's player clock pauses to buffer mid-track but our local clock keeps ticking. UI shows a slightly-ahead position until the next seek-poll catches it (≤ 1 s).
- **HLS duration drift.** `audio.duration` can be approximate at the start of playback; re-read duration on first progress poll to catch any correction.

## Error handling

Three categories. Each degrades gracefully rather than crashing the app.

### A. SoundCloud DOM changes (the existential risk)

SoundCloud can ship a frontend update any day that breaks our scrapers.

- **Single selectors table** — `preload/selectors.ts`. No selector strings scattered through code. Updating selectors is a one-file PR.
- **Resilient lookups** — each entry holds a primary selector plus ordered fallbacks. Minor markup tweaks don't always require a release.
- **Health check** — on launch and after navigation, the preload verifies critical selectors resolve. If any fail, it sends `scraper:degraded` to main, which:
  - Shows an in-app banner: "Some features may not work — SoundCloud appears to have updated."
  - Disables features that depend on missing data (e.g. if title selector fails, suppress notifications but keep playback working).
  - Logs which selectors failed (locally — no telemetry by default).
- **No throws in the scrape path** — scraper functions return `null` on miss. Consumers handle `null` gracefully.

### B. Network / SoundCloud reachability

- BrowserView `did-fail-load` shows an in-app "Can't reach SoundCloud — Retry" overlay; never a blank window.
- No background polling of soundcloud.com when offline. Pause auto-update checks too.
- electron-updater failures are non-fatal — log and silently retry next launch.

### C. Native integration failures

- **MPRIS (Linux):** if D-Bus is unavailable, log and skip. Media keys still work via `globalShortcut`.
- **SMTC (Windows):** requires Windows 10+. If unavailable, fall back to `globalShortcut` only.
- **Global shortcuts:** if registration fails (already bound by another app), surface the conflict in settings — don't silently swallow.
- **Notifications:** if denied or unavailable, silently skip — no retry loop.
- **Mini-player:** separate window, isolated crash impact. On failure, log and let the user re-open it from the tray.

### Cross-cutting

- Central `logger.ts` (file rotation, ~1 MB cap, accessible via "Open log folder" in tray menu).
- Single-instance lock — second launch focuses the existing window.

## Testing strategy

Three layers. Each catches a specific class of failure. Not aiming for
100% coverage — aiming to catch the failure modes that actually matter
for this app.

### Layer 1 — Unit tests (Vitest)

Pure logic, no Electron or DOM dependency. Run on every save. Target
suite time: under 2 s.

- `media/scraper-bridge.ts` — given a sequence of synthetic DOM events, does it emit the right typed events?
- `media/local-clock.ts` — pause-while-ticking, seek-detection threshold, end-of-track.
- `config/store.ts` — schema validation, migration between settings versions.
- IPC channel discriminators in `shared/types.ts`.

### Layer 2 — DOM scraper tests (Playwright, against live soundcloud.com)

The single most important test category, because the scraper is the
project's biggest risk. Run nightly and before every release — **not**
on every commit (slow, depends on a live external site).

- Launch a real Chromium with the preload injected.
- Navigate to soundcloud.com, log in with a test account (credentials in CI secrets), play a known track.
- Assert: title selector resolves, artist resolves, artwork URL non-empty, play button toggles, progress bar reads a sensible number.
- On failure, the build flags the release as risky — release decision is manual (ship degraded-mode or hold).

This is the early-warning system for SoundCloud markup changes.

### Layer 3 — Smoke E2E (Playwright Electron driver, packaged build)

A handful of tests against the actual packaged app, per platform.

- App launches; main window opens; BrowserView loads.
- Tray icon appears; minimize-to-tray hides the window; tray click restores.
- Mini-player opens, shows placeholder when no track, closes cleanly.
- Settings persist across restart (write a shortcut, relaunch, verify).
- Auto-update hits the configured feed (network mocked).

We do not E2E-test live SC playback at this layer — that's Layer 2.

### What we deliberately do not test

- MPRIS / SMTC actual OS-level integration — no clean CI assertion for "Windows received our metadata". Manual per-release on each platform.
- v2 features (Discord RPC, network casting).

### CI matrix

| Suite | Frequency | Platforms |
|---|---|---|
| Layer 1 | every push | Windows, Linux |
| Layer 3 | every push | Windows, Linux |
| Layer 2 | nightly + pre-release | Linux only (sufficient) |

## Open items for v2

Recorded here so they don't get lost; not to be designed in this spec.

- **Network casting (Chromecast first).** Two candidate approaches:
  (a) intercept the HLS stream URL from the BrowserView's network and
  hand it to the cast device, or (b) capture audio output from the
  BrowserView and re-stream it. Both have non-trivial risks (signed
  short-lived URLs; cross-platform loopback capture). To be brainstormed
  separately as a v2 spec.
- **Discord Rich Presence.** Straightforward once the scraper-bridge
  event stream is stable — add an `integrations/discord-rpc.ts` module
  that subscribes to track-change events.
