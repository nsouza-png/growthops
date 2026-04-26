import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Brain, AlertTriangle, TrendingUp, CheckCircle2, ChevronDown, ChevronUp, Zap, Lightbulb, Target,
} from 'lucide-react'
import { usePDIStudyCalls, type StudyCall, type StudyExercise } from '../hooks/usePDIStudy'
import { useRole } from '../contexts/RoleContext'
import { cn } from '../lib/cn'
import { DecisionBanner } from '../components/DecisionBanner'

// ─── Score Bar ────────────────────────────────────────────────────────────────

function ScoreBar({ label, score, max = 10 }: { label: string; score: number | null; max?: number }) {
  if (score == null) return null
  const pct = Math.min(100, (score / max) * 100)
  const color = score < 5 ? 'bg-signal-red' : score < 7.5 ? 'bg-signal-amber' : 'bg-signal-green'
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider w-28 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-bg-elevated rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn(
        'text-sm font-bold w-8 text-right tabular-nums',
        score < 5 ? 'text-signal-red' : score < 7.5 ? 'text-signal-amber' : 'text-signal-green',
      )}>
        {score.toFixed(1)}
      </span>
    </div>
  )
}

// ─── Exercise Card ────────────────────────────────────────────────────────────

function ExerciseCard({ exercise, index }: { exercise: StudyExercise; index: number }) {
  const [open, setOpen] = useState(index === 0)
  const [checked, setChecked] = useState<boolean[]>(exercise.actionItems.map(() => false))

  const tagConfig = {
    critico: { label: 'Crítico', cls: 'bg-signal-red/10 text-signal-red border-signal-red/20' },
    melhorar: { label: 'Melhorar', cls: 'bg-signal-amber/10 text-signal-amber border-signal-amber/20' },
    manter: { label: 'Manter', cls: 'bg-signal-green/10 text-signal-green border-signal-green/20' },
  }
  const tag = tagConfig[exercise.tag]
  const doneCount = checked.filter(Boolean).length
  const allDone = doneCount === exercise.actionItems.length

  return (
    <div className={cn(
      'bg-bg-card border rounded-xl overflow-hidden transition-all',
      allDone ? 'border-signal-green/30' : 'border-border',
    )}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-bg-elevated/40 transition-colors"
      >
        <div className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold',
          allDone ? 'bg-signal-green/15 text-signal-green' : 'bg-bg-elevated text-text-tertiary',
        )}>
          {allDone ? <CheckCircle2 size={16} /> : index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-text-primary">{exercise.title}</span>
            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', tag.cls)}>
              {tag.label}
            </span>
            <span className="text-[10px] text-text-tertiary font-medium">{exercise.dimension}</span>
          </div>
          <div className="text-xs text-text-tertiary mt-0.5">
            Score: {exercise.score.toFixed(1)} · {doneCount}/{exercise.actionItems.length} ações concluídas
          </div>
        </div>
        {open ? <ChevronUp size={14} className="text-text-tertiary shrink-0" /> : <ChevronDown size={14} className="text-text-tertiary shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-border/50 pt-4 space-y-4">
          <p className="text-sm text-text-secondary">{exercise.description}</p>
          {exercise.keyExcerpt && (
            <div className="p-2.5 bg-bg-elevated border-l-2 border-g4-golden/40 rounded-r-lg">
              <p className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">Trecho da call</p>
              <p className="text-xs text-text-secondary italic leading-relaxed">"{exercise.keyExcerpt}"</p>
            </div>
          )}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Ações de prática</p>
            {exercise.actionItems.map((action, i) => (
              <label key={i} className="flex items-start gap-3 cursor-pointer group">
                <button
                  onClick={() => setChecked(prev => prev.map((v, idx) => idx === i ? !v : v))}
                  className={cn(
                    'mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-all',
                    checked[i]
                      ? 'bg-signal-green border-signal-green'
                      : 'border-border bg-transparent group-hover:border-signal-green/50',
                  )}
                >
                  {checked[i] && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                <span className={cn(
                  'text-sm transition-colors',
                  checked[i] ? 'text-text-tertiary line-through' : 'text-text-primary',
                )}>
                  {action}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Call List Item ───────────────────────────────────────────────────────────

function CallListItem({ call, selected, onClick }: { call: StudyCall; selected: boolean; onClick: () => void }) {
  const score = call.spicedTotal
  const color = score == null ? 'text-text-tertiary' : score < 5 ? 'text-signal-red' : score < 7.5 ? 'text-signal-amber' : 'text-signal-green'
  const date = new Date(call.happenedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-3 rounded-xl border transition-all',
        selected
          ? 'bg-g4-golden/10 border-g4-golden/30'
          : 'bg-transparent border-transparent hover:bg-bg-elevated/60 hover:border-border',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn('text-[10px] font-bold tabular-nums', color)}>
          {score != null ? score.toFixed(1) : '—'}
        </span>
        <span className="text-[10px] text-text-tertiary">{date}</span>
      </div>
      <p className="text-xs font-medium text-text-primary mt-1 line-clamp-2 leading-snug">{call.title}</p>
      {call.weakestDimension && (
        <span className="text-[10px] text-signal-amber mt-1 block">↓ {call.weakestDimension}</span>
      )}
    </button>
  )
}

// ─── Study Session View ───────────────────────────────────────────────────────

function StudySessionView({ call }: { call: StudyCall }) {
  const criticalCount = call.studyPlan.filter(e => e.tag === 'critico').length
  const date = new Date(call.happenedAt).toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })

  // Sort exercises: critico first, then melhorar, then manter
  const sortedPlan = [...call.studyPlan].sort((a, b) => {
    const order = { critico: 0, melhorar: 1, manter: 2 }
    return (order[a.tag] ?? 1) - (order[b.tag] ?? 1)
  })

  // Decision banner for top gap
  const bannerSeverity = call.spicedTotal == null ? null
    : call.spicedTotal < 5 ? 'critical' as const
    : call.spicedTotal < 7.5 ? 'warning' as const
    : 'positive' as const

  return (
    <div className="space-y-5">
      {/* Decision Banner — principal gap */}
      {bannerSeverity && call.topGap && (
        <DecisionBanner
          severity={bannerSeverity}
          status={bannerSeverity === 'critical' ? 'Intervencao necessaria'
            : bannerSeverity === 'warning' ? 'Oportunidade de melhoria'
            : 'Em bom caminho'}
          reason={call.topGap}
          action={criticalCount > 0
            ? `Focar nos ${criticalCount} exercicio${criticalCount > 1 ? 's' : ''} critico${criticalCount > 1 ? 's' : ''} abaixo`
            : 'Manter ritmo e praticar pontos de melhoria'}
          impact={call.spicedTotal != null ? `Score ${call.spicedTotal.toFixed(1)}/10` : undefined}
        />
      )}

      {/* Header — compactado */}
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-g4-golden mb-1">Plano de Recuperacao</p>
            <h2 className="text-base font-bold text-text-primary leading-snug">{call.title}</h2>
            <p className="text-xs text-text-tertiary mt-1 capitalize">{date}</p>
          </div>
          <div className="shrink-0 text-right">
            <div className={cn(
              'text-3xl font-bold tabular-nums',
              call.spicedTotal == null ? 'text-text-tertiary'
                : call.spicedTotal < 5 ? 'text-signal-red'
                : call.spicedTotal < 7.5 ? 'text-signal-amber'
                : 'text-signal-green',
            )}>
              {call.spicedTotal?.toFixed(1) ?? '—'}
            </div>
            <div className="text-[10px] text-text-tertiary font-bold uppercase tracking-wider">SPICED Total</div>
          </div>
        </div>

        {/* Score breakdown — compact inline */}
        {call.spicedTotal != null && (
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            {[
              { label: 'S', score: call.spicedS },
              { label: 'P', score: call.spicedP },
              { label: 'I', score: call.spicedI },
              { label: 'C', score: call.spicedC },
              { label: 'D', score: call.spicedD },
            ].map(d => (
              <div key={d.label} className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-text-tertiary">{d.label}</span>
                <div className="w-16 h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full',
                      d.score == null ? 'bg-text-tertiary' : d.score < 5 ? 'bg-signal-red' : d.score < 7.5 ? 'bg-signal-amber' : 'bg-signal-green'
                    )}
                    style={{ width: `${Math.min(100, ((d.score ?? 0) / 10) * 100)}%` }}
                  />
                </div>
                <span className={cn('text-[10px] font-bold tabular-nums',
                  d.score == null ? 'text-text-tertiary' : d.score < 5 ? 'text-signal-red' : d.score < 7.5 ? 'text-signal-amber' : 'text-signal-green'
                )}>
                  {d.score?.toFixed(1) ?? '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Coaching card — compact with collapsible details */}
      {call.coaching && (
        <div className="bg-g4-golden/8 border border-g4-golden/20 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Lightbulb size={14} className="text-g4-golden shrink-0" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-g4-golden">
              Coaching IA — {call.coaching.focusDimension}
            </p>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">{call.coaching.recommendation}</p>
          <div className="p-3 bg-bg-card border border-border rounded-lg">
            <p className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">Pergunta modelo</p>
            <p className="text-xs text-text-primary italic">"{call.coaching.exampleQuestion}"</p>
          </div>
          {call.coaching.topMissedQuestions.length > 0 && (
            <details className="group">
              <summary className="flex items-center gap-2 cursor-pointer list-none text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
                Perguntas que faltaram ({call.coaching.topMissedQuestions.length})
                <ChevronDown size={10} className="ml-auto group-open:rotate-180 transition-transform" />
              </summary>
              <div className="space-y-1.5 mt-2">
                {call.coaching.topMissedQuestions.slice(0, 3).map((q, i) => (
                  <div key={i} className="flex gap-2 p-2 bg-signal-blue/5 border border-signal-blue/15 rounded-lg">
                    <span className="text-signal-blue text-xs font-bold shrink-0">?</span>
                    <p className="text-xs text-text-secondary italic leading-relaxed">"{q}"</p>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Top gap / strength */}
      {(call.topGap || call.topStrength) && (
        <div className="space-y-2">
          {call.topGap && (
            <div className="flex gap-3 p-3 bg-signal-red/5 border border-signal-red/15 rounded-xl">
              <Target size={13} className="text-signal-red shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-signal-red mb-1">Principal gap</p>
                <p className="text-xs text-text-secondary leading-relaxed">{call.topGap}</p>
              </div>
            </div>
          )}
          {call.topStrength && (
            <div className="flex gap-3 p-3 bg-signal-green/5 border border-signal-green/15 rounded-xl">
              <CheckCircle2 size={13} className="text-signal-green shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-signal-green mb-1">Principal acerto</p>
                <p className="text-xs text-text-secondary leading-relaxed">{call.topStrength}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Study plan — sorted: critico > melhorar > manter */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Brain size={14} className="text-g4-golden" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
            Plano de Recuperacao — {sortedPlan.length} exercicio{sortedPlan.length !== 1 ? 's' : ''}
          </p>
        </div>
        {sortedPlan.map((exercise, i) => (
          <ExerciseCard key={exercise.dimension} exercise={exercise} index={i} />
        ))}
      </div>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-16">
      <div className="w-14 h-14 rounded-full bg-bg-elevated flex items-center justify-center">
        <Zap size={24} className="text-text-tertiary" />
      </div>
      <div>
        <h3 className="text-text-primary font-semibold">Nenhuma sessão disponível</h3>
        <p className="text-text-secondary text-sm mt-1 max-w-xs">
          Suas calls precisam ter score SPICED para gerar sessões de estudo.
        </p>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PDIStudySession() {
  const { closerEmail: paramEmail } = useParams<{ closerEmail?: string }>()
  const { isAdmin, viewedRole, simulatedCloser } = useRole()
  const navigate = useNavigate()

  const effectiveEmail = paramEmail || (isAdmin && simulatedCloser ? simulatedCloser : undefined)
  const { calls, loading, error } = usePDIStudyCalls(effectiveEmail)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedCall = calls.find(c => c.id === selectedId) ?? calls[0] ?? null

  // Auto-select first call
  if (!selectedId && calls.length > 0 && !loading) {
    setSelectedId(calls[0].id)
  }

  const isCoordOrAdmin = isAdmin || viewedRole === 'coordenador'

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: call list */}
      <aside className="w-64 shrink-0 border-r border-border flex flex-col overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-1.5 text-[10px] text-text-tertiary mb-2">
            <button onClick={() => navigate('/insights')} className="hover:text-text-primary transition-colors">Radar</button>
            <span>/</span>
            <button onClick={() => navigate('/pdi')} className="hover:text-text-primary transition-colors">Coaching</button>
            <span>/</span>
            <span className="text-text-secondary font-semibold">Plano</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/pdi')}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-text-tertiary hover:bg-bg-elevated hover:text-text-primary transition-all"
            >
              <ArrowLeft size={14} />
            </button>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Coaching</p>
              <p className="text-xs font-semibold text-text-primary">Planos de recuperacao</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-bg-elevated rounded-xl animate-pulse" />
            ))
          ) : calls.length === 0 ? (
            <p className="text-xs text-text-tertiary p-3">Nenhuma call com score disponível.</p>
          ) : (
            calls.map(call => (
              <CallListItem
                key={call.id}
                call={call}
                selected={selectedCall?.id === call.id}
                onClick={() => setSelectedId(call.id)}
              />
            ))
          )}
        </div>
      </aside>

      {/* Right: study session */}
      <main className="flex-1 overflow-y-auto p-6">
        {error ? (
          <div className="text-signal-red text-sm">{error}</div>
        ) : loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-bg-elevated rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !selectedCall ? (
          <EmptyState />
        ) : (
          <div className="max-w-2xl">
            <StudySessionView call={selectedCall} />

            {isCoordOrAdmin && (
              <div className="mt-4 flex items-center gap-2 p-3 bg-bg-elevated rounded-xl border border-border">
                <TrendingUp size={13} className="text-g4-golden shrink-0" />
                <p className="text-xs text-text-secondary">
                  Visão de gestor: acompanhe o progresso do closer nesta call.
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
