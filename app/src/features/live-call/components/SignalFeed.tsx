// SignalFeed.tsx
// Feed de sinais comportamentais detectados por framework de vendas.
// Inclui painel de red flags quando presentes.

import { cn } from '../../../lib/cn'
import type { Signal, RedFlag } from '../types/live-call.types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FRAMEWORK_COLORS: Record<string, string> = {
  SPICED:     'bg-blue-900/50 text-blue-300 border-blue-800',
  CHALLENGER: 'bg-amber-900/50 text-amber-300 border-amber-800',
  SPIN:       'bg-purple-900/50 text-purple-300 border-purple-800',
  CROSS:      'bg-gray-800 text-gray-400 border-gray-700',
}

const POLARITY_COLORS: Record<string, string> = {
  POSITIVE: 'text-green-400',
  NEGATIVE: 'text-red-400',
  NEUTRAL:  'text-gray-400',
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SignalFeedProps {
  signals: Signal[]
  redFlags: RedFlag[]
}

// ---------------------------------------------------------------------------
// SignalFeed
// ---------------------------------------------------------------------------

export function SignalFeed({ signals, redFlags }: SignalFeedProps) {
  // Exibir os 8 sinais mais recentes em ordem cronológica reversa
  const recentSignals = [...signals].reverse().slice(0, 8)

  return (
    <div className="space-y-3">
      {/* Red Flags — exibidos apenas quando presentes */}
      {redFlags.length > 0 && (
        <div className="card-sm border border-red-900/50 bg-red-900/10">
          <h3 className="text-xs font-medium text-red-400 uppercase tracking-wider mb-2">
            Red Flags ({redFlags.length})
          </h3>
          <div className="space-y-1">
            {redFlags.slice(-3).map((flag, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span
                  className={cn(
                    'text-xs px-1.5 py-0.5 rounded font-medium shrink-0',
                    flag.severity === 'critical'
                      ? 'bg-red-900 text-red-300'
                      : 'bg-yellow-900/50 text-yellow-400'
                  )}
                >
                  {flag.severity === 'critical' ? 'CRITICO' : 'ALERTA'}
                </span>
                <span className="text-gray-300">{flag.flag}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sinais detectados */}
      <div className="card-sm">
        <h3 className="section-eyebrow mb-2">Sinais Detectados</h3>
        {recentSignals.length === 0 ? (
          <p className="text-gray-600 text-sm">Aguardando análise...</p>
        ) : (
          <div className="space-y-2">
            {recentSignals.map((signal) => (
              <div key={signal.signal_id} className="flex items-start gap-2 text-sm">
                <span
                  className={cn(
                    'text-xs px-1.5 py-0.5 rounded border shrink-0',
                    FRAMEWORK_COLORS[signal.framework] ?? FRAMEWORK_COLORS.CROSS
                  )}
                >
                  {signal.framework}
                </span>
                <div className="flex-1 min-w-0">
                  <span className={cn('font-medium', POLARITY_COLORS[signal.polarity])}>
                    {signal.dimension}
                  </span>
                  <p className="text-gray-400 text-xs truncate">{signal.excerpt}</p>
                </div>
                {/* Intensidade visual: pontos de 1 a 3 */}
                <div className="flex gap-0.5 shrink-0">
                  {Array.from({ length: signal.intensity }).map((_, i) => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
