import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const here = (path) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  root: here('client'),
  plugins: [react(), tailwindcss()],
  build: {
    outDir: here('dist'),
    emptyOutDir: true,
  },
  server: {
    // The dev server is reachable from a phone on the network, so it serves the app's own files only.
    fs: { allow: [here('client'), here('shared'), here('node_modules')] },
  },
  test: {
    root: here('.'),
    restoreMocks: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'client',
          environment: 'jsdom',
          include: ['tests/client/**/*.test.{js,jsx}'],
          setupFiles: ['tests/client/setup.js'],
        },
      },
      {
        extends: true,
        test: {
          name: 'server',
          environment: 'node',
          include: ['tests/server/**/*.test.js'],
          execArgv: ['--disable-warning=ExperimentalWarning'],
        },
      },
    ],
  },
});
