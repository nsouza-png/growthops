import { cn } from '../../../lib/cn'
import type { SpicedScores } from '../types/live-call.types'

// ---------------------------------------------------------------------------
// SpicedScoreBarProps
// ---------------------------------------------------------------------------

export interface SpicedScoreBarProps {
  scores: SpicedScores
  activeDimension: 'situation' | 'pain' | 'impact' | 'critical_event' | 'decision' | 'delivery' | null
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIMENSIONS = [
  'situation',
  'pain',
  'impact',
  'critical_event',
  'decision',
  'delivery',
] as const

const DIMENSION_LABELS: Record<typeof DIMENSIONS[number], string> = {
  situation:      'Situação',
  pain:           'Dor',
  impact:         'Impacto',
  critical_event: 'Evento Crítico',
  decision:       'Decisão',
  delivery:       'Entrega',
}

// Single letter identifiers (SPICED order)
const DIMENSION_LETTERS: Record<typeof DIMENSIONS[number], string> = {
  situation:      'S',
  pain:           'P',
  impact:         'I',
  critical_event: 'C',
  decision:       'D',
  delivery:       'E',
}

// ---------------------------------------------------------------------------
// SpicedScoreBar
// ---------------------------------------------------------------------------

export function SpicedScoreBar({ scores, activeDimension }: SpicedScoreBarProps) {
  return (
    <div className="card-sm space-y-3">
      <p className="section-eyebrow">SPICED</p>

      {DIMENSIONS.map((dim) => {
        const score = scores[dim]
        const percentage = (score.score / score.max) * 100
        const isActive = activeDimension === dim

        return (
          <div
            key={dim}
            data-active={isActive}
            className={cn(
              'flex items-center gap-3',
              isActive && 'ring-1 ring-g4-red/40 rounded-lg px-2 py-1 -mx-2'
            )}
          >
            {/* Letra */}
            <span className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold bg-signal-blue/20 text-signal-blue flex-shrink-0">
              {DIMENSION_LETTERS[dim]}
            </span>

            {/* Label */}
            <span
              className={cn(
                'w-28 text-sm flex-shrink-0',
                isActive ? 'text-text-primary font-semibold' : 'text-text-secondary'
              )}
            >
              {DIMENSION_LABELS[dim]}
            </span>

            {/* Track + Fill */}
            <div className="flex-1 h-2 rounded-full bg-bg-elevated overflow-hidden">
              <div
                data-testid="bar-fill"
                className="h-full rounded-full bg-g4-red transition-all duration-500"
                style={{ width: `${percentage}%` }}
              />
            </div>

            {/* Score numérico */}
            <span
              className={cn(
                'w-8 text-right text-xs font-mono',
                isActive ? 'text-text-primary' : 'text-text-tertiary'
              )}
            >
              {score.score}/{score.max}
            </span>
          </div>
        )
      })}
    </div>
  )
}
