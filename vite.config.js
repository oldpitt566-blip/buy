import { defineConfig } from 'vite';

export default defineConfig({
  // 修正：使用小寫 plugins，並給它一個空陣列
  plugins: [], 
  
  build: {
    outDir: 'dist',
  },
});