import { TrendingDown, AlertTriangle, Target } from 'lucide-react'
import { cn } from '../lib/cn'

interface HeadlineInsightProps {
  headline: string
  impact: string
  where: string
  who: string
  severity: 'critical' | 'warning' | 'positive'
}

const SEVERITY_CONFIG = {
  critical: {
    icon: AlertTriangle,
    gradient: 'from-signal-red/8 to-signal-red/3',
    border: 'border-signal-red/30',
    accent: 'text-signal-red',
    iconBg: 'bg-signal-red/15',
  },
  warning: {
    icon: TrendingDown,
    gradient: 'from-signal-amber/8 to-signal-amber/3',
    border: 'border-signal-amber/30',
    accent: 'text-signal-amber',
    iconBg: 'bg-signal-amber/15',
  },
  positive: {
    icon: Target,
    gradient: 'from-signal-green/8 to-signal-green/3',
    border: 'border-signal-green/30',
    accent: 'text-signal-green',
    iconBg: 'bg-signal-green/15',
  },
}

export function HeadlineInsight({ headline, impact, where, who, severity }: HeadlineInsightProps) {
  const c = SEVERITY_CONFIG[severity]
  const Icon = c.icon

  return (
    <div className={cn(
      'rounded-2xl border p-5 bg-gradient-to-br',
      c.gradient, c.border,
    )}>
      <div className="flex items-start gap-4">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', c.iconBg)}>
          <Icon size={20} className={c.accent} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-1">
            Principal insight
          </p>
          <h2 className={cn('text-base font-bold leading-snug', c.accent)}>
            {headline}
          </h2>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-text-tertiary mb-0.5">Impacto</p>
              <p className="text-xs font-semibold text-text-primary">{impact}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-text-tertiary mb-0.5">Onde</p>
              <p className="text-xs font-semibold text-text-primary">{where}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-text-tertiary mb-0.5">Quem</p>
              <p className="text-xs font-semibold text-text-primary">{who}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Build headline from aggregated insight stats */
export function buildHeadlineFromStats(stats: {
  avg: number | null
  hot: number
  warm: number
  cold: number
  total: number
  dimAvgs: Array<{ label: string; avg: number | null }>
}): HeadlineInsightProps | null {
  if (!stats.avg || stats.total === 0) return null

  // Find weakest dimension
  const validDims = stats.dimAvgs.filter(d => d.avg != null) as Array<{ label: string; avg: number }>
  if (validDims.length === 0) return null

  const weakest = validDims.reduce((a, b) => (a.avg < b.avg ? a : b))
  const coldPct = stats.total > 0 ? Math.round((stats.cold / stats.total) * 100) : 0
  const warmPct = stats.total > 0 ? Math.round((stats.warm / stats.total) * 100) : 0

  // Determine severity
  const severity: HeadlineInsightProps['severity'] =
    stats.avg < 45 || coldPct > 40 ? 'critical'
    : stats.avg < 65 || coldPct > 25 ? 'warning'
    : 'positive'

  if (severity === 'critical') {
    return {
      severity,
      headline: `Time esta perdendo deals por falta de "${weakest.label}"`,
      impact: `Score medio ${(stats.avg / 10).toFixed(1)}/10 — abaixo do limiar`,
      where: `Dimensao mais fraca: ${weakest.label} (${(weakest.avg * 10).toFixed(0)}%)`,
      who: `${coldPct}% das calls sao frias — ${stats.cold} de ${stats.total}`,
    }
  }

  if (severity === 'warning') {
    return {
      severity,
      headline: `Oportunidade: reforcar "${weakest.label}" pode destravar pipeline`,
      impact: `Score medio ${(stats.avg / 10).toFixed(1)}/10 — espaco para subir`,
      where: `Gap principal: ${weakest.label} (${(weakest.avg * 10).toFixed(0)}%)`,
      who: `${warmPct + coldPct}% das calls com espaco de melhoria`,
    }
  }

  return {
    severity,
    headline: 'Pipeline saudavel — manter ritmo e replicar boas praticas',
    impact: `Score medio ${(stats.avg / 10).toFixed(1)}/10`,
    where: `Todas as dimensoes acima de 60%`,
    who: `${stats.hot} calls quentes de ${stats.total}`,
  }
}
