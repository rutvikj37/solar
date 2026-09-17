import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const COOP_HEADER = 'same-origin-allow-popups'

/** Ensure dist/_headers includes COOP for nginx/Netlify static deploys. */
function ensureCoopHeadersInDist() {
  return {
    name: 'ensure-coop-headers',
    closeBundle() {
      const distDir = path.join(__dirname, 'dist')
      const headersPath = path.join(distDir, '_headers')
      const line = `  Cross-Origin-Opener-Policy: ${COOP_HEADER}`
      if (fs.existsSync(headersPath)) {
        const content = fs.readFileSync(headersPath, 'utf8')
        if (!content.includes(COOP_HEADER)) {
          fs.appendFileSync(headersPath, `\n/*\n${line}\n`)
          console.log('[build] Appended COOP header to dist/_headers')
        }
        return
      }
      fs.mkdirSync(distDir, { recursive: true })
      fs.writeFileSync(headersPath, `/*\n${line}\n`)
      console.log('[build] Wrote dist/_headers with COOP header')
    },
  }
}

const securityHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-XSS-Protection': '0',
  // Firebase Auth (redirect return from accounts.google.com). Do not use same-origin.
  'Cross-Origin-Opener-Policy': COOP_HEADER,
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=*, usb=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://maps.gstatic.com https://www.gstatic.com https://apis.google.com https://js.stripe.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.ggpht.com https://*.googleusercontent.com https://*.openstreetmap.org",
    "connect-src 'self' http://127.0.0.1:* http://localhost:* https://localhost:* ws://localhost:* wss://localhost:* https://*.googleapis.com https://places.googleapis.com https://*.firebaseio.com https://*.firebase.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://nominatim.openstreetmap.org https://api.stripe.com",
    "frame-src 'self' https://accounts.google.com https://*.firebaseapp.com https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), ensureCoopHeadersInDist()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    headers: securityHeaders,
  },
  preview: {
    headers: securityHeaders,
  },
})
