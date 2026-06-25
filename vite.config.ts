import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    // Relative asset paths make the same build work on GitHub Pages subpaths
    // and on Cloudflare Pages root domains.
    base: './',
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
      'process.env.VITE_AI_PROXY_URL': JSON.stringify(env.VITE_AI_PROXY_URL || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('firebase') || id.includes('@firebase')) return 'firebase';
            if (id.includes('@google/genai')) return 'ai';
            if (id.includes('leaflet') || id.includes('react-leaflet')) return 'map';
            if (id.includes('recharts') || id.includes('d3-')) return 'charts';
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) return 'react';
            if (id.includes('lucide-react')) return 'icons';
          },
        },
      },
    },
  };
});
