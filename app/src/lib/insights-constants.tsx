/**
 * Shared constants and components for insight display
 * Eliminates duplication across InsightsHub, InsightDetail, InsightDrawer
 */
import { cn } from './cn'

// ─── SPICED dimension definitions (with motivo keys for drawer) ──────────────

export const SPICED_DIMS_FULL = [
  { key: 'abertura_e_alinhamento_pp', label: 'Abertura & Alinhamento', motivoKey: 'motivo_abertura_e_alinhamento' },
  { key: 'situation_pp', label: 'Situation', motivoKey: 'motivo_situation' },
  { key: 'pain_pp', label: 'Pain', motivoKey: 'motivo_pain' },
  { key: 'impact_pp', label: 'Impact', motivoKey: 'motivo_impact' },
  { key: 'critical_event_emotion_pp', label: 'Critical Event + Emoção', motivoKey: 'motivo_critical_event_emotion' },
  { key: 'delivery_pp', label: 'Delivery', motivoKey: 'motivo_delivery' },
  { key: 'conducao_fechamento_pp', label: 'Condução ao Fechamento', motivoKey: 'motivo_conducao_fechamento' },
  { key: 'objecoes_pp', label: 'Objeções', motivoKey: 'motivo_objecoes' },
] as const

// ─── Framework dimension map ─────────────────────────────────────────────────

export const FRAMEWORK_DIMS = {
  spiced: [
    { key: 'spiced_situation', label: 'Situation', legacyKey: 'situation_pp' },
    { key: 'spiced_pain', label: 'Pain', legacyKey: 'pain_pp' },
    { key: 'spiced_impact', label: 'Impact', legacyKey: 'impact_pp' },
    { key: 'spiced_critical_event', label: 'Critical Event', legacyKey: 'critical_event_emotion_pp' },
    { key: 'spiced_decision', label: 'Decision', legacyKey: 'conducao_fechamento_pp' },
  ],
  spin: [
    { key: 'spin_situation', label: 'Situation', legacyKey: 'situation_pp' },
    { key: 'spin_problem', label: 'Problem', legacyKey: 'pain_pp' },
    { key: 'spin_implication', label: 'Implication', legacyKey: 'impact_pp' },
    { key: 'spin_need_payoff', label: 'Need Payoff', legacyKey: 'delivery_pp' },
  ],
  challenger: [
    { key: 'challenger_teach', label: 'Teach', legacyKey: 'abertura_e_alinhamento_pp' },
    { key: 'challenger_tailor', label: 'Tailor', legacyKey: 'situation_pp' },
    { key: 'challenger_take_control', label: 'Take Control', legacyKey: 'conducao_fechamento_pp' },
  ],
} as const

// ─── Shared ppBar component ─────────────────────────────────────────────────

export function ppBar(value: number | null, size: 'sm' | 'md' = 'sm') {
  if (value == null) return <span className="text-text-tertiary text-xs">—</span>
  const pct = Math.round(value * 100)
  const color = pct >= 70 ? 'bg-signal-green' : pct >= 40 ? 'bg-signal-amber' : 'bg-signal-red'
  const textColor = pct >= 70 ? 'text-signal-green' : pct >= 40 ? 'text-signal-amber' : 'text-signal-red'
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className={cn('flex-1 bg-bg-elevated rounded-full overflow-hidden', size === 'md' ? 'h-2' : 'h-1.5')}>
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn('text-xs font-bold tabular-nums w-8 text-right', textColor)}>{pct}%</span>
    </div>
  )
}

// ─── Score / Temp badge helpers ──────────────────────────────────────────────

export function scoreBadge(score: number | null) {
  if (score == null) return null
  const cls = score >= 70 ? 'bg-signal-green/15 text-signal-green' :
              score >= 40 ? 'bg-signal-amber/15 text-signal-amber' :
              'bg-signal-red/15 text-signal-red'
  return <span className={cn('px-2 py-0.5 rounded-lg text-xs font-bold tabular-nums', cls)}>{score}</span>
}

export function tempBadge(temp: string | null) {
  if (!temp) return null
  const cls = temp === 'QUENTE' ? 'bg-signal-red/10 text-signal-red' :
              temp === 'MORNO' ? 'bg-signal-amber/10 text-signal-amber' :
              'bg-signal-blue/10 text-signal-blue'
  return <span className={cn('px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wide', cls)}>{temp}</span>
}
