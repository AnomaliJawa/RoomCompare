import { defineConfig } from 'vitest/config';

/** Tests only: the app has no build step. jsdom has no IndexedDB, so db.js resolves null here. */
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
    restoreMocks: true,
  },
});
