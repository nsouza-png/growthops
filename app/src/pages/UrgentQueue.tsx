import { useState, useEffect } from 'react'
import { AlertTriangle, Clock, DollarSign, Brain, ArrowRight, Info, Phone } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/cn'
import { EmptyState } from '../components/ui/EmptyState'
import ScoreRing from '../components/ui/ScoreRing'

// ─── Types ───────────────────────────────────────────────────────────────────

interface UrgentCall {
  call_id: string
  lead: string | null
  closer_email: string | null
  squad: string | null
  deal_acv: number | null
  deal_stage: string | null
  deal_status: string | null
  happened_at: string | null
  temperatura_identificada: string | null
  spiced_total: number | null
  spiced_pain: number | null
  spiced_critical_event: number | null
  priority_score: number
  priority_level: string
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useUrgentCalls(level?: string) {
  const [calls, setCalls] = useState<UrgentCall[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let q = supabase
      .from('urgent_calls').select('*')
    if (level) q = q.eq('priority_level', level)
    q.limit(50).then(({ data, error: err }) => {
      if (err) setError(err.message)
      setCalls((data ?? []) as unknown as UrgentCall[])
      setLoading(false)
    })
  }, [level])

  return { calls, loading, error }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function priorityBadge(level: string) {
  if (level === 'critico') return 'bg-signal-red/15 text-signal-red border border-signal-red/20'
  if (level === 'atencao') return 'bg-signal-amber/15 text-signal-amber border border-signal-amber/20'
  return 'bg-bg-elevated text-text-tertiary border border-border'
}

function priorityLabel(level: string) {
  if (level === 'critico') return 'P1 · Crítico'
  if (level === 'atencao') return 'P2 · Atenção'
  return 'OK'
}

function timeAgo(iso: string | null) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d atrás`
  if (h > 0) return `${h}h atrás`
  return 'Agora'
}

interface CallCardProps {
  call: UrgentCall
  onClick: () => void
}

function CallCard({ call, onClick }: CallCardProps) {
  const scoreVal = call.spiced_total ?? 0
  const acv = call.deal_acv != null
    ? call.deal_acv.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
    : null

  return (
    <div
      onClick={onClick}
      className={cn(
        'relative bg-bg-card border rounded-2xl p-5 cursor-pointer hover:bg-bg-card2 transition-colors group',
        call.priority_level === 'critico' ? 'border-signal-red/20' : 'border-signal-amber/20',
      )}
    >
      {/* Left accent bar */}
      <div className={cn(
        'absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl',
        call.priority_level === 'critico' ? 'bg-signal-red' : 'bg-signal-amber',
      )} />

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded', priorityBadge(call.priority_level))}>
              {priorityLabel(call.priority_level)}
            </span>
            {call.squad && (
              <span className="text-[10px] font-medium bg-bg-elevated text-text-tertiary px-2 py-0.5 rounded uppercase tracking-wider">
                {call.squad}
              </span>
            )}
          </div>
          <h3 className="text-sm font-bold text-text-primary mb-1 truncate">
            {call.lead ?? 'Lead sem nome'}
          </h3>
          <div className="flex items-center gap-3 text-xs text-text-tertiary flex-wrap">
            {call.closer_email && (
              <span>Rep: {call.closer_email.split('@')[0].replace(/[._]/g, ' ')}</span>
            )}
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {timeAgo(call.happened_at)}
            </span>
            {call.deal_stage && <span>{call.deal_stage}</span>}
          </div>
        </div>

        <div className="flex items-start gap-4 shrink-0">
          <div className="text-right">
            {acv && (
              <div className="flex items-center gap-1 text-signal-green text-xs font-bold mb-1">
                <DollarSign size={10} />
                {acv}
              </div>
            )}
            <div className="text-[10px] text-text-tertiary">ACV</div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <ScoreRing score={scoreVal * 10} size="sm" />
            <div className="text-[10px] text-text-tertiary">SPICED</div>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/30">
        <div className="flex items-center gap-3">
          {call.spiced_pain != null && (
            <div className="flex items-center gap-1.5">
              <div className="text-[10px] text-text-tertiary">Dor:</div>
              <div className={cn('text-[10px] font-bold',
                call.spiced_pain >= 7 ? 'text-signal-green' :
                  call.spiced_pain >= 4 ? 'text-signal-amber' : 'text-signal-red')}>
                {call.spiced_pain.toFixed(1)}
              </div>
            </div>
          )}
          {call.spiced_critical_event != null && (
            <div className="flex items-center gap-1.5">
              <div className="text-[10px] text-text-tertiary">Evento:</div>
              <div className={cn('text-[10px] font-bold',
                call.spiced_critical_event >= 7 ? 'text-signal-green' :
                  call.spiced_critical_event >= 4 ? 'text-signal-amber' : 'text-signal-red')}>
                {call.spiced_critical_event.toFixed(1)}
              </div>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Brain size={10} className="text-text-tertiary" />
            <span className="text-[10px] text-text-tertiary">Score: {call.priority_score}</span>
          </div>
        </div>
        <ArrowRight size={13} className="text-text-tertiary group-hover:text-text-primary transition-colors" />
      </div>
    </div>
  )
}

// ─── Section ─────────────────────────────────────────────────────────────────

interface SectionProps {
  title: string
  count: number
  calls: UrgentCall[]
  level: string
  onCallClick: (id: string) => void
}

function Section({ title, count, calls, level, onCallClick }: SectionProps) {
  const filtered = calls.filter(c => c.priority_level === level)

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <div className={cn('w-2 h-2 rounded-full',
          level === 'critico' ? 'bg-signal-red animate-pulse' : 'bg-signal-amber')} />
        <h2 className="text-base font-bold text-text-primary uppercase tracking-wider">{title}</h2>
        {filtered.length > 0 && (
          <span className={cn('text-[10px] font-bold px-2.5 py-0.5 rounded-full border',
            level === 'critico'
              ? 'bg-signal-red/10 text-signal-red border-signal-red/20'
              : 'bg-signal-amber/10 text-signal-amber border-signal-amber/20')}>
            {count} {count === 1 ? 'Ação Necessária' : 'Ações Necessárias'}
          </span>
        )}
      </div>
      {filtered.length === 0 ? (
        <div className="py-6 px-4 bg-bg-card border border-border rounded-2xl text-center">
          <p className="text-sm text-text-tertiary">
            Nenhuma call {level === 'critico' ? 'crítica' : 'em atenção'} no momento.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filtered.map(c => (
            <CallCard key={c.call_id} call={c} onClick={() => onCallClick(c.call_id)} />
          ))}
        </div>
      )}
    </section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UrgentQueue() {
  const navigate = useNavigate()
  const { calls, loading } = useUrgentCalls()

  const critico = calls.filter(c => c.priority_level === 'critico')
  const atencao = calls.filter(c => c.priority_level === 'atencao')

  return (
    <div className="p-6 space-y-8 max-w-7xl">
      {/* Header */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-1">
          Tático
        </p>
        <h1 className="text-2xl font-bold">Onde você pode perder dinheiro agora</h1>
        <p className="text-sm text-text-tertiary mt-0.5">
          Fila priorizada de deals que exigem ação imediata.
        </p>
      </div>

      {/* Info banner */}
      <div className="bg-bg-card border border-signal-amber/20 rounded-xl p-4 flex items-start gap-3">
        <Info size={14} className="text-signal-amber mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-text-primary mb-0.5">Entenda o Priority Score</p>
          <p className="text-xs text-text-tertiary leading-relaxed">
            O score é calculado combinando o ACV do deal (até 40 pts) com o inverso do score SPICED
            (score baixo = urgência alta, até 60 pts).{' '}
            <span className="text-signal-amber font-medium">Calls CRÍTICAS (P1) têm SPICED abaixo de 4.</span>
            {' '}Calls em ATENÇÃO (P2) têm SPICED entre 4 e 6.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-bg-card border border-border rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : calls.length === 0 ? (
        <EmptyState
          icon={Phone}
          title="Fila vazia"
          description="Não há calls com baixo score SPICED nos últimos 45 dias. Continue analisando calls para popular a fila."
        />
      ) : (
        <div className="space-y-10">
          <Section
            title="CRÍTICO"
            count={critico.length}
            calls={calls}
            level="critico"
            onCallClick={id => navigate(`/calls/${id}`)}
          />
          <Section
            title="ATENÇÃO"
            count={atencao.length}
            calls={calls}
            level="atencao"
            onCallClick={id => navigate(`/calls/${id}`)}
          />
        </div>
      )}
    </div>
  )
}
