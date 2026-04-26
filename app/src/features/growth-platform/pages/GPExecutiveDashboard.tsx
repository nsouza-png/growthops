// ── GPExecutiveDashboard — Personal performance view for closers (executivos) ──
// Uses GrowthPlatform schema directly.
// Receives profile from GrowthPlatformContext (mounted by GPDashboardShell).

import { useState } from 'react'
import { Phone, Brain, Mic, BookOpen, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useGrowthPlatformContext } from '../contexts/GrowthPlatformContext'
import { useGrowthPlatformCalls } from '../hooks/useGrowthPlatformCalls'
import { useFrameworkAnalytics } from '../hooks/useFrameworkAnalytics'
import { GrowthPlatformAPI } from '../services/api'
import { useQuery } from '@tanstack/react-query'
import { GPKPICard } from '../components/GPKPICard'
import { GPScoreEvolutionChart } from '../components/GPScoreEvolutionChart'
import { GPFrameworkDistribution } from '../components/GPFrameworkDistribution'
import { GPRecentCallsTable } from '../components/GPRecentCallsTable'
import { GPPDICard } from '../components/GPPDICard'
import { GPTalkRatioCard } from '../components/GPTalkRatioCard'
import { DashboardSkeleton } from '../../../components/ui/SkeletonLoader'
import { cn } from '../../../lib/cn'
import {
  formatScore, formatScorePct, avgTalkRatio, avgSpicedPct,
} from '../utils/formatters'

type Timeframe = '7d' | '30d' | '90d'

const TIMEFRAMES: { label: string; value: Timeframe }[] = [
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
  { label: '90d', value: '90d' },
]

export function GPExecutiveDashboard() {
  const { profile } = useGrowthPlatformContext()
  const [timeframe, setTimeframe] = useState<Timeframe>('30d')

  const { data: calls = [], isLoading: callsLoading } = useGrowthPlatformCalls({
    profile,
    enabled: !!profile,
  })

  const { data: analytics, isLoading: analyticsLoading } = useFrameworkAnalytics({
    profile,
    timeframe,
    enabled: !!profile,
  })

  const { data: latestPDI } = useQuery({
    queryKey: ['gp-pdi', profile?.email],
    queryFn: () => GrowthPlatformAPI.getLatestPDI(profile!.email),
    enabled: !!profile?.email,
  })

  if (callsLoading || analyticsLoading) {
    return (
      <div className="p-6 max-w-7xl">
        <DashboardSkeleton />
      </div>
    )
  }

  const totalCalls = calls.length
  const avgScore = avgSpicedPct(calls)
  const avgTalk = avgTalkRatio(calls)

  // Trend: compare last 7 days vs prior 7 days
  const now = new Date()
  const sevenAgo = new Date(now.getTime() - 7 * 86400000)
  const fourteenAgo = new Date(now.getTime() - 14 * 86400000)
  const recentAvg = avgSpicedPct(calls.filter(c => c.call_date && new Date(c.call_date) >= sevenAgo))
  const priorAvg = avgSpicedPct(
    calls.filter(c => c.call_date &&
      new Date(c.call_date) >= fourteenAgo &&
      new Date(c.call_date) < sevenAgo),
  )
  const trend = recentAvg != null && priorAvg != null
    ? recentAvg - priorAvg
    : null

  const displayName = profile?.name ?? profile?.email?.split('@')[0] ?? 'Executivo'

  return (
    <div className="p-6 space-y-6 max-w-7xl">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-1">
            GrowthPlatform · Executivo
          </p>
          <h1 className="text-2xl font-bold text-text-primary">{displayName}</h1>
          <p className="text-sm text-text-tertiary mt-0.5">
            {profile?.cargo} {profile?.squad ? `· Squad ${profile.squad}` : ''}
          </p>
        </div>

        {/* Timeframe selector */}
        <div className="flex gap-1 bg-bg-card border border-border rounded-xl p-1">
          {TIMEFRAMES.map(tf => (
            <button
              key={tf.value}
              onClick={() => setTimeframe(tf.value)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                timeframe === tf.value
                  ? 'bg-g4-red text-white'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI Row ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <GPKPICard
          label="Calls Analisadas"
          value={totalCalls}
          sub={`Últimos ${timeframe}`}
          icon={<Phone size={16} className="text-text-tertiary" />}
        />
        <GPKPICard
          label="Score SPICED Médio"
          value={avgScore != null ? `${formatScorePct(avgScore)}` : '–'}
          sub={
            trend != null
              ? `${trend >= 0 ? '+' : ''}${trend.toFixed(1)}% vs semana anterior`
              : 'Score médio das calls'
          }
          subPositive={trend != null ? trend >= 0 : null}
          icon={<Brain size={16} className="text-signal-blue" />}
          highlight
        />
        <GPKPICard
          label="Talk Ratio Médio"
          value={avgTalk != null ? `${Math.round(avgTalk)}%` : '–'}
          sub={
            avgTalk != null
              ? avgTalk < 60 ? 'Proporção saudável' : 'Acima do recomendado'
              : 'Seller / Cliente'
          }
          subPositive={avgTalk != null ? avgTalk < 60 : null}
          icon={<Mic size={16} className="text-text-tertiary" />}
        />
        <GPKPICard
          label="Trend (7d)"
          value={
            trend != null
              ? `${trend >= 0 ? '+' : ''}${formatScore(trend)}pts`
              : '–'
          }
          sub={trend != null ? (trend >= 0 ? 'Em evolução' : 'Queda detectada') : 'Dados insuficientes'}
          subPositive={trend != null ? trend >= 0 : null}
          icon={
            trend == null ? <Minus size={16} className="text-text-tertiary" /> :
            trend >= 0    ? <TrendingUp size={16} className="text-signal-green" /> :
                            <TrendingDown size={16} className="text-signal-red" />
          }
        />
      </div>

      {/* ── Charts Row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Score Evolution */}
        <div className="bg-bg-card border border-border rounded-2xl p-5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-4">
            Evolução SPICED
          </div>
          <GPScoreEvolutionChart
            calls={calls}
            showSpin
            showChallenger
            height={230}
          />
        </div>

        {/* Framework Distribution Radar */}
        <div className="bg-bg-card border border-border rounded-2xl p-5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-4">
            Distribuição SPICED — Dimensões
          </div>
          {analytics ? (
            <GPFrameworkDistribution
              spicedByDimension={analytics.spicedByDimension}
              height={230}
            />
          ) : (
            <div className="h-[230px] flex items-center justify-center text-text-tertiary text-sm">
              Carregando…
            </div>
          )}
        </div>
      </div>

      {/* ── Talk Ratio + Weak Dimensions + Deal Risk ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Talk Ratio */}
        <GPTalkRatioCard
          sellerPct={avgTalk}
          sellerName={displayName.split(' ')[0]}
        />

        {/* Weak Dimensions */}
        <div className="bg-bg-card border border-border rounded-2xl p-5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-3">
            Dimensões a Melhorar
          </div>
          {analytics?.topWeakDimensions && analytics.topWeakDimensions.length > 0 ? (
            <div className="space-y-2">
              {analytics.topWeakDimensions.map((dim, i) => (
                <div key={dim} className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-text-tertiary w-4">{i + 1}</span>
                  <div className="flex-1 text-sm text-text-secondary capitalize">{dim}</div>
                  <span className="text-[10px] text-signal-amber">foco</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-text-tertiary text-sm">Sem dados suficientes.</p>
          )}
        </div>

        {/* Deal Risk Breakdown */}
        <div className="bg-bg-card border border-border rounded-2xl p-5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-3">
            Deal Risk — Distribuição
          </div>
          {analytics ? (
            <div className="space-y-3">
              {[
                { label: 'Baixo', count: analytics.dealRiskBreakdown.baixo, color: 'bg-signal-green' },
                { label: 'Médio', count: analytics.dealRiskBreakdown.medio, color: 'bg-signal-amber' },
                { label: 'Alto',  count: analytics.dealRiskBreakdown.alto,  color: 'bg-signal-red'   },
              ].map(item => {
                const total = analytics.dealRiskBreakdown.baixo +
                              analytics.dealRiskBreakdown.medio +
                              analytics.dealRiskBreakdown.alto
                const pct = total > 0 ? (item.count / total) * 100 : 0
                return (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-text-secondary">{item.label}</span>
                      <span className="text-text-tertiary">{item.count}</span>
                    </div>
                    <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', item.color)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-text-tertiary text-sm">Carregando…</p>
          )}
        </div>
      </div>

      {/* ── Recent Calls + PDI ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Recent Calls Table */}
        <div className="lg:col-span-2 bg-bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
              Últimas Calls Analisadas
            </span>
            <span className="text-xs text-text-tertiary">{totalCalls} total</span>
          </div>
          <GPRecentCallsTable calls={calls} maxRows={8} />
        </div>

        {/* PDI Card */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen size={13} className="text-text-tertiary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
              PDI
            </span>
          </div>
          <GPPDICard pdi={latestPDI} email={profile?.email} lastCallId={calls[0]?.id} />

          {/* Top Strengths */}
          {analytics?.topStrengths && analytics.topStrengths.length > 0 && (
            <div className="bg-bg-card border border-border rounded-2xl p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-2">
                Pontos Fortes
              </div>
              <div className="space-y-1">
                {analytics.topStrengths.map((str, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-signal-green text-xs">✓</span>
                    <span className="text-xs text-text-secondary">{str}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
