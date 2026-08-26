import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// DeskThing loads the built client from a relative base.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist' },
});
