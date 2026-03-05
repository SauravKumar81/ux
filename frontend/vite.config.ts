import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    // Pre-bundle heavy deps so they don't block initial render
    optimizeDeps: {
      include: ['motion/react', 'lucide-react', 'lodash.debounce'],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // React + motion in one chunk
            vendor: ['react', 'react-dom', 'motion/react'],
            // Three.js in its own chunk (used by shader background)
            three: ['three'],
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
