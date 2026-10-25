import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Tooltips } from './app/Tooltips'

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/offline-worker.js').catch(() => {
      // Editing and the durable draft queue still work; offline page reload needs this shell.
      console.warn('Offline page reload is unavailable. Keep this tab open while disconnected.')
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Tooltips />
  </StrictMode>,
)
