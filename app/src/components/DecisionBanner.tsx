import { AlertTriangle, ArrowRight, CheckCircle2, Shield } from 'lucide-react'
import { cn } from '../lib/cn'

type Severity = 'critical' | 'warning' | 'positive'

interface DecisionBannerProps {
  severity: Severity
  status: string
  reason: string
  action: string
  impact?: string
  /** Optional CTA button */
  cta?: { label: string; onClick: () => void }
}

const CONFIG: Record<Severity, {
  icon: typeof AlertTriangle
  border: string
  bg: string
  accent: string
  statusBg: string
}> = {
  critical: {
    icon: AlertTriangle,
    border: 'border-signal-red/50',
    bg: 'bg-signal-red/6',
    accent: 'text-signal-red',
    statusBg: 'bg-signal-red/15 text-signal-red border-signal-red/25',
  },
  warning: {
    icon: Shield,
    border: 'border-signal-amber/50',
    bg: 'bg-signal-amber/6',
    accent: 'text-signal-amber',
    statusBg: 'bg-signal-amber/15 text-signal-amber border-signal-amber/25',
  },
  positive: {
    icon: CheckCircle2,
    border: 'border-signal-green/50',
    bg: 'bg-signal-green/6',
    accent: 'text-signal-green',
    statusBg: 'bg-signal-green/15 text-signal-green border-signal-green/25',
  },
}

export function DecisionBanner({ severity, status, reason, action, impact, cta }: DecisionBannerProps) {
  const c = CONFIG[severity]
  const Icon = c.icon

  return (
    <div className={cn('mx-4 mt-3 mb-0 rounded-xl border-l-4 p-4 shrink-0', c.bg, c.border)}>
      <div className="flex items-start gap-3">
        <Icon size={18} className={cn(c.accent, 'shrink-0 mt-0.5')} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
              Decisao recomendada
            </span>
            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', c.statusBg)}>
              {status}
            </span>
          </div>
          <p className={cn('text-sm font-bold leading-snug', c.accent)}>{action}</p>
          <p className="text-xs text-text-secondary mt-1 leading-relaxed">{reason}</p>
          {impact && (
            <p className={cn('text-xs font-semibold mt-1.5', c.accent)}>{impact}</p>
          )}
          {cta && (
            <button
              onClick={cta.onClick}
              className={cn(
                'mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:brightness-110',
                c.statusBg,
              )}
            >
              {cta.label}
              <ArrowRight size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/** Derive severity + content from call analysis data */
export function buildCallDecision(richJson: any, scores: any): {
  severity: Severity
  status: string
  reason: string
  action: string
  impact?: string
} | null {
  if (!richJson && !scores) return null

  const dealRisk = richJson?.consolidated?.deal_risk
  const weakDim = richJson?.spiced?.weak_dimension
  const classification = richJson?.spiced?.classification?.result
  const nextAction = richJson?.next_action
  const crossInsight = richJson?.consolidated?.cross_framework_insight
  const spicedTotal = scores?.spiced_total

  // Critical: high risk or unqualified
  if (dealRisk === 'alto' || classification === 'nao_qualificada') {
    return {
      severity: 'critical',
      status: 'Risco alto de perda',
      reason: crossInsight
        ?? `Gap critico em ${weakDim ?? 'multiplas dimensoes'} — deal avancando sem validacao suficiente.`,
      action: nextAction?.action ?? 'Intervencao do coordenador necessaria',
      impact: nextAction?.timing
        ? `Agir em ${nextAction.timing} — impacto estimado no win rate`
        : spicedTotal != null && spicedTotal < 5
          ? `Score ${spicedTotal.toFixed(1)}/10 — abaixo do limiar de conversao`
          : undefined,
    }
  }

  // Warning: medium risk or partially qualified
  if (dealRisk === 'medio' || classification === 'parcialmente_qualificada') {
    return {
      severity: 'warning',
      status: 'Atencao — gaps identificados',
      reason: crossInsight
        ?? `Dimensao ${weakDim ?? 'a melhorar'} precisa de reforco antes do proximo passo.`,
      action: nextAction?.action ?? 'Reforcar dimensao fraca antes de avancar',
      impact: nextAction?.timing ? `Prazo recomendado: ${nextAction.timing}` : undefined,
    }
  }

  // Positive: low risk and qualified
  if (dealRisk === 'baixo' || classification === 'qualificada') {
    return {
      severity: 'positive',
      status: 'Deal saudavel',
      reason: crossInsight ?? 'Pipeline dentro dos parametros esperados.',
      action: nextAction?.action ?? 'Manter ritmo e avancar para proximo estagio',
      impact: nextAction?.timing ? `Proximo passo: ${nextAction.timing}` : undefined,
    }
  }

  // Fallback: if we have next_action but no explicit risk
  if (nextAction) {
    const fallbackSeverity: Severity = spicedTotal != null && spicedTotal < 5 ? 'critical'
      : spicedTotal != null && spicedTotal < 7 ? 'warning' : 'positive'
    return {
      severity: fallbackSeverity,
      status: fallbackSeverity === 'critical' ? 'Score abaixo do limiar'
        : fallbackSeverity === 'warning' ? 'Oportunidade de melhoria'
        : 'Em bom caminho',
      reason: nextAction.main_argument,
      action: nextAction.action,
      impact: nextAction.timing ? `Prazo: ${nextAction.timing}` : undefined,
    }
  }

  return null
}

/** Derive severity + content from insight data */
export function buildInsightDecision(insight: {
  score_geral: number | null
  temperatura_identificada: string | null
  pontos_de_melhoria: string | null
  vendedor: string | null
}): {
  severity: Severity
  status: string
  reason: string
  action: string
  impact?: string
} | null {
  const score = insight.score_geral
  if (score == null) return null

  const temp = insight.temperatura_identificada
  const melhorias = insight.pontos_de_melhoria
  const firstMelhoria = melhorias
    ? melhorias.split(/\n|•|-\s/).map(s => s.trim()).filter(Boolean)[0]
    : null

  if (score < 40 || temp === 'FRIO') {
    return {
      severity: 'critical',
      status: 'Closer precisa de intervencao',
      reason: firstMelhoria ?? 'Score critico indica gaps estruturais na abordagem.',
      action: `Coaching urgente para ${insight.vendedor ?? 'este closer'}`,
      impact: `Score ${(score / 10).toFixed(1)}/10 — risco direto no pipeline`,
    }
  }

  if (score < 65 || temp === 'MORNO') {
    return {
      severity: 'warning',
      status: 'Oportunidade de melhoria',
      reason: firstMelhoria ?? 'Dimensoes com espaco para evolucao identificadas.',
      action: `Revisar gaps com ${insight.vendedor ?? 'closer'} nesta semana`,
      impact: `Score ${(score / 10).toFixed(1)}/10 — potencial de subir com ajuste`,
    }
  }

  return {
    severity: 'positive',
    status: 'Performance solida',
    reason: firstMelhoria ?? 'Closer performando dentro dos parametros.',
    action: 'Manter ritmo e replicar boas praticas no time',
    impact: `Score ${(score / 10).toFixed(1)}/10`,
  }
}
