import { test, expect, _electron as electron } from '@playwright/test';
import { join } from 'node:path';

test('app launches with main window titled SoundDesk', async () => {
  const app = await electron.launch({
    args: [join(__dirname, '../../out/main/index.js')],
    env: { ...process.env, NODE_ENV: 'test' }
  });
  const window = await app.firstWindow();
  await expect(window).toHaveTitle(/SoundDesk/i);
  await app.close();
});

test.skip('config persists across launches (requires test-only IPC bridge — deferred to v1.1)', async () => {
  // A persistence assertion requires a test-only IPC surface not yet implemented.
});
