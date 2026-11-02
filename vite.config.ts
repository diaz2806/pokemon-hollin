import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Rutas relativas: sirve igual para GitHub Pages y para el .exe (Electron carga file://).
  base: './',
  build: {
    chunkSizeWarningLimit: 4000,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
