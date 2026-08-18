import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/react-app/' : '/',
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: true,
    proxy: {
      '/app/api': 'http://127.0.0.1:3001',
      '/app/bootstrap': 'http://127.0.0.1:3001',
      '/login': 'http://127.0.0.1:3001',
      '/logout': 'http://127.0.0.1:3001',
      '/home': 'http://127.0.0.1:3001',
      '/monitoreos': 'http://127.0.0.1:3001',
      '/chanchitos': 'http://127.0.0.1:3001',
      '/usuarios': 'http://127.0.0.1:3001',
      '/css': 'http://127.0.0.1:3001',
      '/js': 'http://127.0.0.1:3001',
    },
  },
}));
