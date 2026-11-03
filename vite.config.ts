import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Rutas relativas: sirve igual para GitHub Pages y para el .exe (Electron carga file://).
  base: './',
  build: {
    chunkSizeWarningLimit: 4000,
    // Sin incrustar imágenes en el JS: los sprites se cargan bajo demanda.
    assetsInlineLimit: 0,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
