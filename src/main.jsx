import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { installAuthGuards } from './lib/auth.js'

installAuthGuards()

// After a deploy, hashed chunks change. A tab with an old JS bundle will 404
// lazy routes (e.g. Dashboard-*.js). Reload once to pick up the new index.
const CHUNK_RELOAD_KEY = 'str_chunk_reload'
function reloadOnceForStaleChunk() {
  try {
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
      sessionStorage.removeItem(CHUNK_RELOAD_KEY)
      return
    }
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
  } catch {
    /* private mode */
  }
  window.location.reload()
}

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  reloadOnceForStaleChunk()
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
