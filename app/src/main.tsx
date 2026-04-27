import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { RoleProvider } from './contexts/RoleContext'
import { supabase } from './lib/supabase'
import { initMonitoring } from './lib/monitoring'

initMonitoring()

// Aplica dark mode antes de qualquer render
;(function applyInitialTheme() {
  const stored = localStorage.getItem('g4_dark_mode')
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = stored !== null ? stored === 'true' : prefersDark
  document.documentElement.classList.toggle('dark', isDark)
})()

// Intercepta auth callbacks do Supabase antes do React montar.
// Dois formatos possíveis:
//   1. Implicit flow: #access_token=...&refresh_token=...&type=recovery
//   2. PKCE flow (OAuth): ?code=...  (Google OAuth, magic link, etc.)
// O HashRouter usa # para rotas, então detectSessionInUrl está off — tratamos manualmente.
async function interceptAuthCallback(): Promise<void> {
  try {
    // ── PKCE flow: Supabase OAuth retorna ?code= na query string ──
    const url = new URL(window.location.href)
    const code = url.searchParams.get('code')
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        console.error('[auth] exchangeCodeForSession:', error.message)
        window.history.replaceState(null, '', url.pathname + '#/login')
        return
      }
      window.history.replaceState(null, '', url.pathname + '#/performance')
      return
    }

    // ── Implicit flow: tokens no hash fragment ──
    const hash = window.location.hash
    if (!hash.includes('access_token=')) return

    const params = new URLSearchParams(hash.replace(/^#/, ''))
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const type = params.get('type')

    if (!accessToken || !refreshToken) return

    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
    if (error) {
      console.error('[auth] setSession:', error.message)
      window.location.hash = '#/login'
      return
    }

    if (type === 'recovery') {
      window.location.hash = '#/reset-password'
    } else {
      window.location.hash = '#/performance'
    }
  } catch (e) {
    console.error('[auth] interceptAuthCallback:', e)
    window.location.hash = '#/login'
  }
}

// Bootstrap: interceptar auth callback (se houver), depois montar React
interceptAuthCallback().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <HashRouter>
        <RoleProvider>
          <App />
        </RoleProvider>
      </HashRouter>
    </StrictMode>,
  )
})
