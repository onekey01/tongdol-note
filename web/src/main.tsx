import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { 줄잇기 } from './lib/지킴줄'
import './style.css'

/*
 * 화면이 뜨자마자 서버와 줄 하나를 붙듭니다.
 * 창을 닫으면 그 줄이 끊어지고, 프로그램도 함께 꺼집니다.
 * **로그인 전에도** 붙습니다 — 로그인 화면만 띄워 놓고 닫는 경우도
 * 똑같이 꺼져야 하니까요.
 */
줄잇기()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
