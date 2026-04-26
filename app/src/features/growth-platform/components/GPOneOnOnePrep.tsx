// ── GPOneOnOnePrep — 1-on-1 prep modal for coordinators ──────────────────────
// Shows a squad member's recent calls, weak SPICED dimensions, and coaching
// talking points so the coordinator can walk into 1-on-1s prepared.

import { X, Brain, Phone, AlertTriangle, ChevronRight } from 'lucide-react'
import { cn } from '../../../lib/cn'
import { formatCallDate, formatScore, formatScorePct, SPICED_DIMENSION_LABELS } from '../utils/formatters'
import type { GrowthPlatformCall, GPSquadMemberStats } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function weakDimensions(calls: GrowthPlatformCall[]): { dim: string; avg: number }[] {
  const dims = ['situation', 'pain', 'impact', 'critical_event', 'decision', 'delivery'] as const
  const totals: Record<string, number[]> = {}

  for (const call of calls) {
    const fs = call.framework_scores
    if (!fs) continue
    const values: Partial<Record<typeof dims[number], number | null>> = {
      situation:      fs.spiced_situation_score,
      pain:           fs.spiced_pain_score,
      impact:         fs.spiced_impact_score,
      critical_event: fs.spiced_critical_event_score,
      decision:       fs.spiced_decision_score,
      delivery:       fs.spiced_delivery_score,
    }
    for (const d of dims) {
      const v = values[d]
      if (v != null) {
        if (!totals[d]) totals[d] = []
        totals[d].push(v * 10) // convert 0-10 to 0-100
      }
    }
  }

  return dims
    .map(d => ({
      dim: d,
      avg: totals[d]?.length
        ? totals[d].reduce((a, b) => a + b, 0) / totals[d].length
        : 100,
    }))
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 3)
}

function coachingPoints(weakDims: { dim: string; avg: number }[]): string[] {
  const COACHING: Record<string, string> = {
    situation:      'Perguntar sobre contexto atual do negócio antes de avançar para dores.',
    pain:           'Identificar ao menos 2 dores concretas e quantificá-las com o cliente.',
    impact:         'Conectar cada dor a um impacto financeiro ou operacional mensurável.',
    critical_event: 'Explorar o que muda se o problema não for resolvido agora (urgência).',
    decision:       'Mapear todos os decisores e entender o processo de compra antes da proposta.',
    delivery:       'Apresentar evidências concretas de entrega de valor (casos, ROI histórico).',
  }
  return weakDims.map(w => COACHING[w.dim] ?? `Melhorar desempenho em ${w.dim}.`)
}

// ── Component ─────────────────────────────────────────────────────────────────

interface GPOneOnOnePrepProps {
  stats: GPSquadMemberStats
  recentCalls: GrowthPlatformCall[]
  onClose: () => void
}

export function GPOneOnOnePrep({ stats, recentCalls, onClose }: GPOneOnOnePrepProps) {
  const { profile, avgSpicedScore, callCount } = stats
  const name = profile.name ?? profile.email.split('@')[0].replace(/[._]/g, ' ')
  const last5 = recentCalls
    .filter(c => c.seller_email === profile.email)
    .sort((a, b) => new Date(b.call_date ?? 0).getTime() - new Date(a.call_date ?? 0).getTime())
    .slice(0, 5)

  const weak = weakDimensions(last5)
  const points = coachingPoints(weak)

  const scoreColor =
    avgSpicedScore == null ? 'text-text-tertiary' :
    avgSpicedScore >= 70   ? 'text-signal-green' :
    avgSpicedScore >= 40   ? 'text-signal-amber' : 'text-signal-red'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-border">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-1">
              Prep 1-on-1
            </p>
            <h2 className="text-xl font-bold text-text-primary capitalize">{name}</h2>
            <p className="text-sm text-text-tertiary mt-0.5">{profile.cargo}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-bg-elevated text-text-tertiary hover:text-text-primary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* Summary KPIs */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-bg-card2 rounded-xl p-3 text-center">
              <div className={cn('text-xl font-bold', scoreColor)}>
                {avgSpicedScore != null ? formatScorePct(avgSpicedScore) : '–'}
              </div>
              <div className="text-[10px] text-text-tertiary mt-0.5">Score Médio</div>
            </div>
            <div className="bg-bg-card2 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-text-primary">{callCount}</div>
              <div className="text-[10px] text-text-tertiary mt-0.5">Calls (30d)</div>
            </div>
            <div className="bg-bg-card2 rounded-xl p-3 text-center">
              <div className={cn(
                'text-xl font-bold',
                stats.needsCoaching ? 'text-signal-amber' : 'text-signal-green',
              )}>
                {stats.needsCoaching ? 'Atenção' : 'OK'}
              </div>
              <div className="text-[10px] text-text-tertiary mt-0.5">Status</div>
            </div>
          </div>

          {/* Weak dimensions */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Brain size={13} className="text-signal-amber" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
                Dimensões Críticas — SPICED
              </span>
            </div>
            <div className="space-y-2">
              {weak.map(w => (
                <div key={w.dim} className="flex items-center gap-3">
                  <span className="text-xs text-text-secondary w-32 capitalize">
                    {SPICED_DIMENSION_LABELS[w.dim] ?? w.dim}
                  </span>
                  <div className="flex-1 h-2 bg-bg-elevated rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        w.avg >= 60 ? 'bg-signal-green' :
                        w.avg >= 40 ? 'bg-signal-amber' : 'bg-signal-red',
                      )}
                      style={{ width: `${Math.min(w.avg, 100)}%` }}
                    />
                  </div>
                  <span className={cn(
                    'text-xs font-bold tabular-nums w-10 text-right',
                    w.avg >= 60 ? 'text-signal-green' :
                    w.avg >= 40 ? 'text-signal-amber' : 'text-signal-red',
                  )}>
                    {w.avg.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Coaching talking points */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={13} className="text-signal-amber" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
                Talking Points — Coaching
              </span>
            </div>
            <div className="space-y-2">
              {points.map((pt, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-signal-amber/5 border border-signal-amber/20 rounded-xl">
                  <span className="text-signal-amber font-bold text-xs mt-0.5">{i + 1}</span>
                  <p className="text-sm text-text-secondary leading-relaxed">{pt}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recent calls */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Phone size={13} className="text-text-tertiary" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
                Últimas 5 Calls
              </span>
            </div>
            {last5.length === 0 ? (
              <p className="text-sm text-text-tertiary">Sem calls recentes.</p>
            ) : (
              <div className="space-y-1">
                {last5.map(call => {
                  const score = call.framework_scores?.spiced_pct
                    ?? (call.framework_scores?.spiced_total != null
                      ? call.framework_scores.spiced_total * 10
                      : null)
                  return (
                    <div
                      key={call.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-bg-elevated transition-colors cursor-pointer"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text-primary truncate">
                          {call.prospect_name ?? call.prospect_company ?? 'Prospect'}
                        </p>
                        <p className="text-[10px] text-text-tertiary">
                          {formatCallDate(call.call_date)}
                        </p>
                      </div>
                      <span className={cn(
                        'text-xs font-bold tabular-nums',
                        score == null ? 'text-text-tertiary' :
                        score >= 70   ? 'text-signal-green' :
                        score >= 40   ? 'text-signal-amber' : 'text-signal-red',
                      )}>
                        {score != null ? formatScore(score, 0) : '–'}
                      </span>
                      <ChevronRight size={13} className="text-text-tertiary" />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
