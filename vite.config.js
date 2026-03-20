import { defineConfig } from 'vite';

export default defineConfig({
  // 現在只有一個 index.html 進入點，不需要額外設定 rollupOptions
  build: {
    outDir: 'dist',
  },
});