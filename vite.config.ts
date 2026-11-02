import { defineConfig } from 'vitest/config';

export default defineConfig({
  // GitHub Pages sirve el juego en https://diaz2806.github.io/pokemon-hollin/
  base: '/pokemon-hollin/',
  build: {
    chunkSizeWarningLimit: 4000,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
