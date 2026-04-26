// ── GPGameFilmSection — Curated call library for squad learning ───────────────
// Surfaces the top-performing and bottom-performing calls so coordinators
// can run "game film" sessions with the squad.

import { Trophy, AlertTriangle, Clock, Brain } from 'lucide-react'
import { cn } from '../../../lib/cn'
import {
  formatCallDate, formatScore, formatDuration, SPICED_DIMENSION_LABELS,
} from '../utils/formatters'
import type { GrowthPlatformCall } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getScore(call: GrowthPlatformCall): number | null {
  const fs = call.framework_scores
  if (!fs) return null
  return fs.spiced_pct ?? (fs.spiced_total != null ? fs.spiced_total * 10 : null)
}

function topWeakDim(call: GrowthPlatformCall): string | null {
  const fs = call.framework_scores
  if (!fs) return null
  const dims: { key: string; val: number | null | undefined }[] = [
    { key: 'situation',      val: fs.spiced_situation_score },
    { key: 'pain',           val: fs.spiced_pain_score },
    { key: 'impact',         val: fs.spiced_impact_score },
    { key: 'critical_event', val: fs.spiced_critical_event_score },
    { key: 'decision',       val: fs.spiced_decision_score },
    { key: 'delivery',       val: fs.spiced_delivery_score },
  ]
  const ranked = dims
    .filter(d => d.val != null)
    .sort((a, b) => (a.val as number) - (b.val as number))
  return ranked[0] ? (SPICED_DIMENSION_LABELS[ranked[0].key] ?? ranked[0].key) : null
}

// ── Call Card ─────────────────────────────────────────────────────────────────

interface CallCardProps {
  call: GrowthPlatformCall
  rank: number
  variant: 'top' | 'bottom'
}

function CallCard({ call, rank, variant }: CallCardProps) {
  const score = getScore(call)
  const weakDim = topWeakDim(call)
  const isTop = variant === 'top'

  return (
    <div className={cn(
      'bg-bg-card2 border rounded-xl p-4 space-y-3',
      isTop ? 'border-signal-green/25' : 'border-signal-red/25',
    )}>
      {/* Rank + date */}
      <div className="flex items-center justify-between">
        <span className={cn(
          'text-[10px] font-bold px-2 py-0.5 rounded-full',
          isTop
            ? 'bg-signal-green/10 text-signal-green'
            : 'bg-signal-red/10 text-signal-red',
        )}>
          #{rank}
        </span>
        <span className="text-[10px] text-text-tertiary">
          {formatCallDate(call.call_date)}
        </span>
      </div>

      {/* Seller + prospect */}
      <div>
        <p className="text-sm font-semibold text-text-primary truncate">
          {call.seller_name ?? call.seller_email.split('@')[0]}
        </p>
        <p className="text-xs text-text-tertiary truncate">
          {call.prospect_name ?? call.prospect_company ?? 'Prospect não identificado'}
        </p>
      </div>

      {/* Score + duration */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Brain size={12} className={isTop ? 'text-signal-green' : 'text-signal-red'} />
          <span className={cn(
            'text-sm font-bold',
            isTop ? 'text-signal-green' : 'text-signal-red',
          )}>
            {score != null ? `${formatScore(score, 0)}%` : '–'}
          </span>
        </div>
        {call.duration_min != null && (
          <div className="flex items-center gap-1.5">
            <Clock size={12} className="text-text-tertiary" />
            <span className="text-xs text-text-tertiary">
              {formatDuration(call.duration_min)}
            </span>
          </div>
        )}
      </div>

      {/* Learning point */}
      {isTop ? (
        <div className="flex items-start gap-2 p-2 bg-signal-green/5 rounded-lg">
          <Trophy size={11} className="text-signal-green mt-0.5 shrink-0" />
          <p className="text-[11px] text-text-secondary leading-relaxed">
            {call.framework_scores?.top_strength
              ?? 'Benchmark de excelência para o squad.'}
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-2 p-2 bg-signal-red/5 rounded-lg">
          <AlertTriangle size={11} className="text-signal-amber mt-0.5 shrink-0" />
          <p className="text-[11px] text-text-secondary leading-relaxed">
            {weakDim
              ? `Dimensão crítica: ${weakDim}. Use como exemplo de melhoria.`
              : call.framework_scores?.priority_coaching
                ?? 'Revisar para identificar padrões de melhoria.'}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

interface GPGameFilmSectionProps {
  calls: GrowthPlatformCall[]
  topN?: number
  bottomN?: number
}

export function GPGameFilmSection({ calls, topN = 3, bottomN = 3 }: GPGameFilmSectionProps) {
  const scored = calls
    .filter(c => getScore(c) != null)
    .sort((a, b) => (getScore(b) ?? 0) - (getScore(a) ?? 0))

  const topCalls = scored.slice(0, topN)
  const bottomCalls = scored.slice(-bottomN).reverse()

  if (scored.length === 0) {
    return (
      <div className="text-center py-8 text-text-tertiary text-sm">
        Sem calls com score disponível para game film.
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Top performers */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Trophy size={13} className="text-signal-green" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
            Top Calls — Benchmark
          </span>
          <span className="ml-auto text-[10px] text-text-tertiary">
            use como referência positiva
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {topCalls.map((call, i) => (
            <CallCard key={call.id} call={call} rank={i + 1} variant="top" />
          ))}
        </div>
      </div>

      {/* Bottom calls (learning opportunities) */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={13} className="text-signal-amber" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
            Calls para Revisão — Oportunidade de Aprendizado
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {bottomCalls.map((call, i) => (
            <CallCard key={call.id} call={call} rank={i + 1} variant="bottom" />
          ))}
        </div>
      </div>
    </div>
  )
}
