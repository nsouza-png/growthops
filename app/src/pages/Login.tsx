import { useState } from 'react'
import { Zap, UserPlus, LogIn, KeyRound } from 'lucide-react'
import { supabase } from '../lib/supabase'

const GOOGLE_ICON = (
  <svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
)

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'login' | 'magic' | 'signup' | 'forgot'>('login')
  const [sent, setSent] = useState(false)
  const [signupDone, setSignupDone] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (mode === 'signup') {
      if (password.length < 6) {
        setError('A senha precisa ter pelo menos 6 caracteres.')
        setLoading(false)
        return
      }
      if (password !== confirmPassword) {
        setError('As senhas não coincidem.')
        setLoading(false)
        return
      }
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName.trim() },
          emailRedirectTo: window.location.origin + '/#/performance',
        },
      })
      if (signUpError) {
        setError(signUpError.message)
        setLoading(false)
        return
      }
      // Create user_roles entry so the onboarding flow triggers
      if (data.user) {
        await supabase
          .from('user_roles').upsert({
            user_id: data.user.id,
            email,
            role: 'executivo',
            onboarding_completed: false,
          }, { onConflict: 'user_id' })
      }
      setSignupDone(true)
      setLoading(false)
      return
    }

    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname,
      })
      if (error) setError(error.message)
      else setResetSent(true)
      setLoading(false)
      return
    }

    if (mode === 'magic') {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin + '/#/performance',
        },
      })
      if (error) setError(error.message)
      else setSent(true)
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    }
    setLoading(false)
  }

  function switchMode(newMode: 'login' | 'magic' | 'signup' | 'forgot') {
    setMode(newMode)
    setError(null)
    setConfirmPassword('')
    setFullName('')
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname,
      },
    })
    if (error) {
      setError(error.message)
      setGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-g4-red flex items-center justify-center mb-4">
            <Zap size={22} className="text-white" fill="white" />
          </div>
          <h1 className="text-xl font-bold text-text-primary">Growth Ops Revenue</h1>
          <p className="text-sm text-text-tertiary mt-1">Inteligência comercial do G4</p>
        </div>

        {resetSent ? (
          <div className="card text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-signal-blue/15 flex items-center justify-center mx-auto">
              <KeyRound size={20} className="text-signal-blue" />
            </div>
            <h2 className="text-base font-semibold">Email enviado!</h2>
            <p className="text-sm text-text-secondary">
              Verifique seu email <strong>{email}</strong> e clique no link para redefinir sua senha.
            </p>
            <button
              onClick={() => { setResetSent(false); switchMode('login') }}
              className="text-xs text-signal-blue hover:underline mt-2"
            >
              Voltar para login
            </button>
          </div>
        ) : signupDone ? (
          <div className="card text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-signal-green/15 flex items-center justify-center mx-auto">
              <UserPlus size={20} className="text-signal-green" />
            </div>
            <h2 className="text-base font-semibold">Conta criada!</h2>
            <p className="text-sm text-text-secondary">
              Verifique seu email <strong>{email}</strong> para confirmar a conta.
            </p>
            <button
              onClick={() => { setSignupDone(false); switchMode('login') }}
              className="text-xs text-signal-blue hover:underline mt-2"
            >
              Voltar para login
            </button>
          </div>
        ) : sent ? (
          <div className="card text-center">
            <div className="text-2xl mb-3">📬</div>
            <h2 className="text-base font-semibold mb-1">Link enviado</h2>
            <p className="text-sm text-text-secondary">
              Verifique seu email <strong>{email}</strong> e clique no link para entrar.
            </p>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="card space-y-4">
            {/* Mode tabs */}
            <div className="flex bg-bg-card2 rounded-xl p-1 gap-1">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${mode === 'login' ? 'bg-g4-red text-white shadow-sm' : 'text-text-tertiary hover:text-text-primary'
                  }`}
              >
                <LogIn size={12} /> Entrar
              </button>
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${mode === 'signup' ? 'bg-g4-red text-white shadow-sm' : 'text-text-tertiary hover:text-text-primary'
                  }`}
              >
                <UserPlus size={12} /> Criar conta
              </button>
            </div>

            {/* Google OAuth */}
            {mode !== 'forgot' && (
              <>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={googleLoading}
                  className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl border border-border bg-bg-card2 text-sm font-medium text-text-primary hover:bg-bg-base transition-colors"
                >
                  {GOOGLE_ICON}
                  {googleLoading ? 'Conectando...' : 'Continuar com Google'}
                </button>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-text-tertiary">ou</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              </>
            )}

            {mode === 'signup' && (
              <div>
                <label className="section-eyebrow mb-2 block">Nome completo</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="João Silva"
                  required
                  className="w-full bg-bg-card2 border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-mid transition-colors"
                />
              </div>
            )}

            <div>
              <label className="section-eyebrow mb-2 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@g4educacao.com"
                required
                className="w-full bg-bg-card2 border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-mid transition-colors"
              />
            </div>

            {mode !== 'magic' && mode !== 'forgot' && (
              <div>
                <label className="section-eyebrow mb-2 block">Senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full bg-bg-card2 border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-mid transition-colors"
                />
              </div>
            )}

            {mode === 'forgot' && (
              <p className="text-xs text-text-secondary leading-relaxed">
                Informe seu email acima e enviaremos um link para redefinir sua senha.
              </p>
            )}

            {mode === 'signup' && (
              <div>
                <label className="section-eyebrow mb-2 block">Confirmar senha</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full bg-bg-card2 border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-mid transition-colors"
                />
              </div>
            )}

            {error && (
              <p className="text-xs text-signal-red bg-signal-red/10 border border-signal-red/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-3"
            >
              {loading
                ? (mode === 'signup' ? 'Criando conta...' : mode === 'forgot' ? 'Enviando...' : 'Entrando...')
                : mode === 'signup'
                  ? 'Criar conta'
                  : mode === 'forgot'
                    ? 'Enviar link de recuperação'
                    : mode === 'magic'
                      ? 'Enviar link mágico'
                      : 'Entrar'
              }
            </button>

            {mode === 'login' && (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="w-full text-center text-xs text-signal-blue hover:underline transition-colors py-1"
                >
                  Esqueci minha senha
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('magic')}
                  className="w-full text-center text-xs text-text-tertiary hover:text-text-secondary transition-colors py-1"
                >
                  Entrar com link mágico (sem senha)
                </button>
              </div>
            )}

            {mode === 'magic' && (
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="w-full text-center text-xs text-text-tertiary hover:text-text-secondary transition-colors py-1"
              >
                Entrar com senha
              </button>
            )}

            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="w-full text-center text-xs text-text-tertiary hover:text-text-secondary transition-colors py-1"
              >
                Voltar para login
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
