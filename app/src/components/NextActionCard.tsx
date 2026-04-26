import { cn } from '../lib/cn'

interface NextAction {
  action: string
  timing: string
  main_argument: string
}

interface NextActionCardProps {
  nextAction: NextAction
}

function urgencyStyle(timing: string) {
  const t = timing.toLowerCase()
  if (t.includes('24h') || t.includes('imediato') || t.includes('urgente')) {
    return {
      border: 'border-signal-red/40',
      bg: 'bg-signal-red/5',
      accent: 'text-signal-red',
      icon: '⚡',
    }
  }
  if (t.includes('48h') || t.includes('2 dias')) {
    return {
      border: 'border-signal-amber/40',
      bg: 'bg-signal-amber/5',
      accent: 'text-signal-amber',
      icon: '🕐',
    }
  }
  return {
    border: 'border-signal-blue/40',
    bg: 'bg-signal-blue/5',
    accent: 'text-signal-blue',
    icon: '→',
  }
}

export function NextActionCard({ nextAction }: NextActionCardProps) {
  const style = urgencyStyle(nextAction.timing)

  return (
    <div className={cn(
      'mx-4 mt-3 mb-0 p-4 rounded-xl border-l-4 flex gap-3 items-start shrink-0',
      style.bg, style.border
    )}>
      <span className="text-base shrink-0 mt-0.5">{style.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="section-eyebrow">Proxima acao recomendada</p>
          <span className={cn(
            'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
            style.accent,
            style.border
          )}>
            {nextAction.timing}
          </span>
        </div>
        <p className={cn('text-sm font-semibold', style.accent)}>{nextAction.action}</p>
        <p className="text-xs text-text-secondary mt-1 leading-relaxed">
          {nextAction.main_argument}
        </p>
      </div>
    </div>
  )
}
