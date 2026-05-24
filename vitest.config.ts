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
