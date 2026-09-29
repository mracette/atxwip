import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  worker: { format: 'es' },
  build: { chunkSizeWarningLimit: 1200 },
  // MapLibre loads its worker from a sibling file; pre-bundling moves the main module away from it.
  optimizeDeps: { exclude: ['maplibre-gl'] },
});
