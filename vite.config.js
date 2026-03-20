import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // 補上這一行，讓 Wrangler 能夠正確識別並配置
  plugins: [], 
  
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        history: resolve(__dirname, 'history.html'),
      },
    },
  },
});