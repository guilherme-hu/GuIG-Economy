import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // caminhos relativos: funciona em qualquer subpasta do GitHub Pages
  server: { port: 5173, strictPort: true },
});
