import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset URLs so the build works under the GitHub Pages sub-path.
  base: './',
  build: {
    target: 'es2022',
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
