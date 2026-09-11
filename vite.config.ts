import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'web',
  plugins: [react()],
  build: {
    outDir: '../dist-web',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      // 개발 중에는 화면(5173)과 서버(5757)가 따로 돕니다.
      // /api 로 시작하는 요청만 서버로 넘깁니다.
      '/api': 'http://127.0.0.1:5757',
    },
  },
})
