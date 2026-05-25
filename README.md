# SoundDesk

> A desktop client for SoundCloud — system tray, mini player, media keys, and more.

[![Build](https://github.com/Gianotto/SoundDesk/actions/workflows/build.yml/badge.svg)](https://github.com/Gianotto/SoundDesk/actions)
[![Release](https://img.shields.io/github/v/release/Gianotto/SoundDesk?include_prereleases)](https://github.com/Gianotto/SoundDesk/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux-blue)](#installation)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

SoundDesk wraps the full SoundCloud web experience in a native desktop shell, adding the OS integrations that the browser tab never had: global media keys, a persistent system tray, an always-on-top mini player, and automatic updates.

---

## Features

- **Full SoundCloud** — loads soundcloud.com in a persistent, sandboxed session so you stay logged in
- **System tray** — hide the main window and keep SoundDesk running in the background; play, pause, and skip from the tray menu
- **Mini player** — compact always-on-top overlay with artwork, scrolling title, progress bar, and playback controls
- **Global media keys** — play/pause, next, and previous track work from the keyboard even when SoundDesk is in the background
- **Windows media integration** — hooks into the Windows SMTC (System Media Transport Controls) so the lock screen and hardware volume keys work out of the box
- **Auto-update** — checks GitHub Releases on startup and prompts when a new version is available
- **Offline overlay** — a friendly fallback page when the network is unavailable

---

## Installation

Download the latest release from the [Releases page](https://github.com/Gianotto/SoundDesk/releases).

| Platform | File |
|----------|------|
| Windows | `SoundDesk-Setup-x.x.x.exe` (NSIS installer) |
| Linux | `SoundDesk-x.x.x.AppImage` or `sounddesk_x.x.x_amd64.deb` |

**Windows:** Run the installer and launch SoundDesk from the Start menu or taskbar.

**Linux (AppImage):** Make the file executable and run it:
```bash
chmod +x SoundDesk-*.AppImage
./SoundDesk-*.AppImage
```

**Linux (.deb):**
```bash
sudo dpkg -i sounddesk_*_amd64.deb
```

On first launch, sign in to SoundCloud as usual — your session is saved locally and persists across restarts.

---

## Development

### Prerequisites

- [Node.js](https://nodejs.org) 18+
- npm 9+

### Setup

```bash
git clone https://github.com/Gianotto/SoundDesk.git
cd sounddesk
npm install
```

### Run in dev mode

```bash
npm run dev
```

### Type-check

```bash
npm run typecheck
```

### Tests

```bash
npm test                # unit tests (Vitest)
npm run test:e2e        # end-to-end smoke tests (Playwright + Electron)
npm run test:scraper    # nightly SC DOM selector check
```

### Build a distributable

```bash
npm run build:win       # Windows NSIS installer → release/
npm run build:linux     # AppImage + .deb       → release/
```

---

## Releases

Releases are built and published automatically by GitHub Actions when a version tag is pushed. Both Windows and Linux packages are attached to each [GitHub Release](https://github.com/Gianotto/SoundDesk/releases).

### v0.1.0 — Initial release

- Full SoundCloud web experience in a native desktop shell
- System tray with playback controls
- Always-on-top mini player with scrolling track info and playback controls
- Global media keys (play/pause, next, previous)
- Windows SMTC integration (lock screen, hardware media buttons)
- Auto-updater via GitHub Releases
- Offline fallback page

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Shell | [Electron](https://electronjs.org) |
| Bundler | [electron-vite](https://electron-vite.org) |
| Language | TypeScript |
| Packaging | [electron-builder](https://www.electron.build) |
| Updates | electron-updater |
| Tests | Vitest + Playwright |

---

## License

[MIT](LICENSE) © gianotto
