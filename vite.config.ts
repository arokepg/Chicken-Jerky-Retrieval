import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    minify: false,  // CRITICAL: Disable minification to prevent variable mangling bugs
    sourcemap: true // Helps debugging in production
  },
  server: {
    port: 3000,
    open: true
  }
});
