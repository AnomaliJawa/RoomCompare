import { defineConfig } from 'vitest/config';

/**
 * Tests only. The application itself has no build step: index.html loads
 * src/main.js as an ES module and the browser resolves the rest, so nothing
 * here is required to run RoomCompare.
 *
 * jsdom supplies localStorage and the DOM. It has no IndexedDB, which is why
 * the media layer is exercised in a real browser rather than here; db.js
 * resolves null when the database is unreachable, so importing it is safe.
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
    restoreMocks: true,
  },
});
