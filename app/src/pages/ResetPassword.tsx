import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap, KeyRound, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setDone(true)
    setTimeout(() => navigate('/performance'), 2000)
  }

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-g4-red flex items-center justify-center mb-4">
            <Zap size={22} className="text-white" fill="white" />
          </div>
          <h1 className="text-xl font-bold text-text-primary">Redefinir senha</h1>
          <p className="text-sm text-text-tertiary mt-1">Escolha sua nova senha</p>
        </div>

        {done ? (
          <div className="card text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-signal-green/15 flex items-center justify-center mx-auto">
              <Check size={20} className="text-signal-green" />
            </div>
            <h2 className="text-base font-semibold">Senha atualizada!</h2>
            <p className="text-sm text-text-secondary">Redirecionando...</p>
          </div>
        ) : (
          <form onSubmit={handleReset} className="card space-y-4">
            <div className="flex items-center gap-2 text-text-secondary mb-1">
              <KeyRound size={14} />
              <span className="text-xs font-semibold">Nova senha</span>
            </div>

            <div>
              <label className="section-eyebrow mb-2 block">Senha</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                autoFocus
                className="w-full bg-bg-card2 border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-mid transition-colors"
              />
            </div>

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
              {loading ? 'Salvando...' : 'Salvar nova senha'}
            </button>

            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full text-center text-xs text-text-tertiary hover:text-text-secondary transition-colors py-1"
            >
              Voltar para login
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
