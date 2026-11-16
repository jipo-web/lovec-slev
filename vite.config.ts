import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// GitHub Pages serves project sites under /<repo>/ – set VITE_BASE=/lovec-slev/ in CI.
export default defineConfig(() => ({
  base: process.env.VITE_BASE || '/',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
}));
