import { AlertCircle } from 'lucide-react'
import { cn } from '../../../lib/cn'

interface TalkRatioGaugeProps {
  talkRatioCloser: number   // 0–100, percentual do closer
  threshold?: number        // padrão 65
}

export function TalkRatioGauge({ talkRatioCloser, threshold = 65 }: TalkRatioGaugeProps) {
  const isOver = talkRatioCloser > threshold
  const leadRatio = 100 - talkRatioCloser

  return (
    <div className="card-sm space-y-2">
      <p className="section-eyebrow">Talk Ratio</p>

      {/* Linha de percentuais */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-signal-blue shrink-0" />
          <span className={cn('uppercase tracking-wider font-semibold', isOver ? 'text-signal-red' : 'text-text-tertiary')}>
            CLOSER
          </span>
          {isOver && <AlertCircle size={12} className="text-signal-red" />}
          <span className={cn('font-bold ml-1', isOver ? 'text-signal-red' : 'text-text-primary')}>
            {talkRatioCloser.toFixed(0)}%
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-signal-green shrink-0" />
          <span className="uppercase tracking-wider font-semibold text-text-tertiary">LEAD</span>
          <span className="font-bold text-text-primary ml-1">{leadRatio.toFixed(0)}%</span>
        </div>
      </div>

      {/* Barra horizontal dupla */}
      <div className="flex rounded-full overflow-hidden h-3 gap-0.5">
        <div
          className={cn(
            'rounded-l-full transition-all duration-500',
            isOver ? 'bg-signal-red' : 'bg-signal-blue'
          )}
          style={{ width: `${talkRatioCloser}%` }}
        />
        <div className="bg-signal-green rounded-r-full flex-1" />
      </div>

      {/* Hint de threshold */}
      <p className="text-[10px] text-text-tertiary">
        Ideal: closer &lt;{threshold}% da fala
      </p>

      {/* Alerta de IA — só quando acima do threshold */}
      {isOver && (
        <div className="flex items-start gap-2 p-2.5 bg-signal-red/8 border border-signal-red/20 rounded-xl mt-1">
          <AlertCircle size={12} className="text-signal-red shrink-0 mt-0.5" />
          <p className="text-xs text-signal-red font-semibold leading-snug">
            Faca uma pergunta aberta agora
          </p>
        </div>
      )}
    </div>
  )
}
