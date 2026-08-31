import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // Mesma origem no dev: o cookie httpOnly do refresh token funciona
      // sem configuracao extra de CORS/SameSite.
      '/api': {
        // Alvo configuravel para dar conta de rodar uma segunda instancia ao
        // lado da que ja estiver de pe (revisar um layout contra outro banco,
        // por exemplo). Sem a variavel, nada muda.
        target: process.env.API_PROXY_TARGET ?? 'http://localhost:3333',
        changeOrigin: true,
      },
    },
  },
});
