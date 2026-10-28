import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Lee VITE_SERVER_URL del .env de la raíz del monorepo.
  envDir: '..',
  server: { port: 5173 },
});
