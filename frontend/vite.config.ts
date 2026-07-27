import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Use 127.0.0.1, not "localhost": Node 18+ resolves "localhost" to IPv6 (::1)
  // first, and `uvicorn ... --reload` binds IPv4 (127.0.0.1) only — so a
  // "localhost" target can miss the backend (or hit a different server that
  // happens to own ::1:8000) and 404 every route.
  const backendUrl = env.VITE_API_BACKEND_URL || 'http://127.0.0.1:8000';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 3504,
      host: true,
      proxy: {
        // Proxy /api/* -> backend in dev so the frontend can call a relative
        // VITE_API_BASE_URL=/api/v1 with zero CORS configuration needed.
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('recharts') || id.includes('d3-')) return 'charts';
            if (id.includes('@radix-ui')) return 'radix';
            if (id.includes('@tanstack')) return 'query';
            if (id.includes('framer-motion')) return 'motion';
            return 'vendor';
          },
        },
      },
    },
  };
});
