import { test, expect, _electron as electron } from '@playwright/test';
import { join } from 'node:path';

test('app launches with main window titled SoundDesk', async () => {
  const electronApp = await electron.launch({
    args: [join(__dirname, '../../out/main/index.js')],
    env: { ...process.env, NODE_ENV: 'test' }
  });
  await electronApp.firstWindow();
  // BrowserWindow has no URL — only the embedded BrowserView loads SoundCloud,
  // so firstWindow() returns the BrowserView page (SoundCloud title).
  // Read the native window title directly from the main process instead.
  const title = await electronApp.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.getTitle() ?? ''
  );
  expect(title).toBe('SoundDesk');
  await electronApp.close();
});

test.skip('config persists across launches (requires test-only IPC bridge — deferred to v1.1)', async () => {
  // A persistence assertion requires a test-only IPC surface not yet implemented.
});
