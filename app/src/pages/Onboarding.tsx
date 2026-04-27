import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap, Target, Shield, TrendingUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepDots({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {([1, 2, 3] as const).map(n => (
        <div
          key={n}
          className={`rounded-full transition-all ${n === current
            ? 'w-4 h-2 bg-g4-red'
            : 'w-2 h-2 bg-white/20'
            }`}
        />
      ))}
    </div>
  )
}

// ─── Outcome card ─────────────────────────────────────────────────────────────

function OutcomeCard({ icon, title, description }: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-5 flex gap-4 items-start">
      <div className="shrink-0">{icon}</div>
      <div>
        <p className="text-base font-bold text-text-primary leading-snug">{title}</p>
        <p className="text-sm text-text-secondary mt-1 leading-relaxed">{description}</p>
      </div>
    </div>
  )
}

// ─── Step 1 — Resultados, nao features ────────────────────────────────────────

function Step1({ onNext }: { onNext: () => void }) {
  return (
    <div className="space-y-8">
      <StepDots current={1} />

      <div className="flex flex-col items-center text-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-g4-red/10 border border-g4-red/20 flex items-center justify-center">
          <Zap className="w-8 h-8 text-g4-red" />
        </div>
        <div>
          <h1 className="text-2xl font-bold leading-tight">Seu sistema de decisao de revenue</h1>
          <p className="text-text-secondary text-sm mt-2 max-w-sm">
            Pare de analisar calls. Comece a tomar decisoes que fecham deals.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <OutcomeCard
          icon={<div className="w-10 h-10 rounded-xl bg-signal-red/10 flex items-center justify-center"><Target className="w-5 h-5 text-signal-red" /></div>}
          title="Saiba exatamente onde esta perdendo receita"
          description="A IA identifica qual dimensao esta derrubando seu win rate e mostra o impacto financeiro."
        />
        <OutcomeCard
          icon={<div className="w-10 h-10 rounded-xl bg-signal-blue/10 flex items-center justify-center"><Shield className="w-5 h-5 text-signal-blue" /></div>}
          title="Receba a acao exata para cada deal em risco"
          description="Nao mais 'analise o dashboard'. Voce recebe: o que fazer, quando e por que."
        />
        <OutcomeCard
          icon={<div className="w-10 h-10 rounded-xl bg-signal-green/10 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-signal-green" /></div>}
          title="Evolua seu time com coaching automatico"
          description="Cada call gera um plano de recuperacao personalizado com exercicios praticos."
        />
      </div>

      <button onClick={onNext} className="btn-primary w-full justify-center py-3 text-base">
        Quero comecar
      </button>
    </div>
  )
}

// ─── Step 2 — Fluxo de impacto ───────────────────────────────────────────────

function Step2({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const steps = [
    {
      n: 1,
      title: 'Call acontece',
      desc: 'Voce faz a call normalmente. O tl;dv grava e transcreve automaticamente.',
    },
    {
      n: 2,
      title: 'IA identifica o risco',
      desc: 'Em segundos: score SPICED, gaps criticos, deal em risco ou saudavel.',
    },
    {
      n: 3,
      title: 'Voce recebe a acao',
      desc: 'Decisao recomendada com timing, impacto estimado e proximo passo exato.',
    },
    {
      n: 4,
      title: 'Time evolui',
      desc: 'Plano de coaching automatico transforma gaps em habilidades.',
    },
  ]

  return (
    <div className="space-y-8">
      <StepDots current={2} />

      <div>
        <h2 className="text-2xl font-bold leading-tight">Como voce vai fechar mais</h2>
        <p className="text-text-secondary text-sm mt-1">4 passos — da call ao resultado:</p>
      </div>

      <div className="space-y-3">
        {steps.map(s => (
          <div
            key={s.n}
            className="bg-bg-card border border-border rounded-xl p-4 flex items-start gap-4"
          >
            <div className="w-8 h-8 rounded-full bg-g4-red flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-white">{s.n}</span>
            </div>
            <div>
              <p className="text-sm font-bold text-text-primary">{s.title}</p>
              <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <button onClick={onNext} className="btn-primary w-full justify-center py-3">
        Entendi, vamos la
      </button>
      <button onClick={onBack} className="btn-ghost w-full justify-center text-xs py-2">
        Voltar
      </button>
    </div>
  )
}

// ─── Step 3 ───────────────────────────────────────────────────────────────────

const PRODUCTS = ['MBA G4', 'Imersoes', 'G4 Cast', 'Outros']

function Step3({
  onComplete,
  onSkip,
  initialName,
}: {
  onComplete: (name: string, product: string) => void
  onSkip: () => void
  initialName: string
}) {
  const [name, setName] = useState(initialName)
  const [product, setProduct] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (!name.trim()) return
    setSaving(true)
    await onComplete(name.trim(), product)
    setSaving(false)
  }

  return (
    <div className="space-y-8">
      <StepDots current={3} />

      <div>
        <h2 className="text-2xl font-bold leading-tight">Quase pronto</h2>
        <p className="text-text-secondary text-sm mt-1">Personalizar sua experiencia leva 10 segundos.</p>
      </div>

      <div className="bg-bg-card border border-border rounded-xl p-5 space-y-5">
        <div className="space-y-1.5">
          <label className="section-eyebrow block">Como prefere ser chamado?</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Seu nome"
            className="w-full bg-bg-elevated border border-border rounded-lg px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-g4-red focus:ring-1 focus:ring-g4-red/20 transition-all"
          />
        </div>

        <div className="space-y-1.5">
          <label className="section-eyebrow block">Produto principal</label>
          <select
            value={product}
            onChange={e => setProduct(e.target.value)}
            className="w-full bg-bg-elevated border border-border rounded-lg px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-g4-red focus:ring-1 focus:ring-g4-red/20 transition-all appearance-none"
          >
            <option value="" disabled>Selecione o produto foco</option>
            {PRODUCTS.map(p => (
              <option key={p} value={p} className="bg-bg-base">{p}</option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!name.trim() || saving}
        className="btn-primary w-full justify-center py-3 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {saving ? 'Preparando...' : 'Acessar meu sistema de revenue'}
      </button>

      <button
        onClick={onSkip}
        className="block w-full text-center text-xs text-text-tertiary hover:text-text-secondary transition-colors py-1"
      >
        Pular
      </button>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Onboarding() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const firstName = user?.email
    ? (() => {
      const local = user.email.split('@')[0] ?? ''
      const first = local.split('.')[0] ?? local
      return first.charAt(0).toUpperCase() + first.slice(1)
    })()
    : ''

  async function completeOnboarding(preferredName?: string, mainProduct?: string) {
    if (!user) return
    setSubmitError(null)
    const { error } = await supabase.rpc('complete_user_onboarding', {
      p_preferred_name: preferredName?.trim() || null,
    })
    if (error) {
      setSubmitError('Não foi possível concluir o onboarding agora. Tente novamente em alguns segundos.')
      return
    }
    navigate('/performance', { replace: true })
  }

  return (
    <div className="min-h-screen bg-bg-base flex items-start justify-center">
      <div className="w-full max-w-md mx-auto px-6 py-12">
        {step === 1 && (
          <Step1 onNext={() => setStep(2)} />
        )}
        {step === 2 && (
          <Step2
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <Step3
            initialName={firstName}
            onComplete={(name, product) => completeOnboarding(name, product)}
            onSkip={() => completeOnboarding()}
          />
        )}
        {submitError && (
          <p className="mt-4 text-xs text-signal-red bg-signal-red/10 border border-signal-red/20 rounded-lg px-3 py-2">
            {submitError}
          </p>
        )}
      </div>
    </div>
  )
}
