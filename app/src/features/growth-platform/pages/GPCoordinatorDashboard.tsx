// ── GPCoordinatorDashboard — Squad performance view for coordenadores ─────────

import { useState } from 'react'
import { Users, Brain, Phone, AlertTriangle, TrendingUp, TrendingDown, Minus, Film, UserCheck } from 'lucide-react'
import { useGrowthPlatformContext } from '../contexts/GrowthPlatformContext'
import { useGrowthPlatformCalls } from '../hooks/useGrowthPlatformCalls'
import { useSquadAnalytics } from '../hooks/useSquadAnalytics'
import { useFrameworkAnalytics } from '../hooks/useFrameworkAnalytics'
import { GPKPICard } from '../components/GPKPICard'
import { GPScoreEvolutionChart } from '../components/GPScoreEvolutionChart'
import { GPFrameworkDistribution } from '../components/GPFrameworkDistribution'
import { GPRecentCallsTable } from '../components/GPRecentCallsTable'
import { GPOneOnOnePrep } from '../components/GPOneOnOnePrep'
import { GPGameFilmSection } from '../components/GPGameFilmSection'
import { DashboardSkeleton } from '../../../components/ui/SkeletonLoader'
import { cn } from '../../../lib/cn'
import {
  formatScore, formatScorePct, avgSpicedPct, avgTalkRatio,
} from '../utils/formatters'
import type { GPSquadMemberStats } from '../types'

// ── Squad Member Card ─────────────────────────────────────────────────────────

interface SquadMemberCardProps {
  stats: GPSquadMemberStats
  onOneOnOne: (stats: GPSquadMemberStats) => void
}

function SquadMemberCard({ stats, onOneOnOne }: SquadMemberCardProps) {
  const { profile, callCount, avgSpicedScore, avgTalkRatio: ratio, trend, needsCoaching } = stats
  const name = profile.name ?? profile.email.split('@')[0].replace(/[._]/g, ' ')

  const scoreColor =
    avgSpicedScore == null ? 'text-text-tertiary' :
    avgSpicedScore >= 70   ? 'text-signal-green' :
    avgSpicedScore >= 40   ? 'text-signal-amber' :
    'text-signal-red'

  return (
    <div className={cn(
      'bg-bg-card border rounded-2xl p-4 space-y-3',
      needsCoaching ? 'border-signal-amber/40' : 'border-border',
    )}>
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-primary truncate capitalize">{name}</p>
          <p className="text-xs text-text-tertiary">{profile.cargo}</p>
        </div>
        <div className="flex items-center gap-1 ml-2">
          {trend === 'up'     && <TrendingUp  size={14} className="text-signal-green" />}
          {trend === 'down'   && <TrendingDown size={14} className="text-signal-red"   />}
          {trend === 'stable' && <Minus       size={14} className="text-text-tertiary" />}
          {needsCoaching && (
            <AlertTriangle size={13} className="text-signal-amber ml-1" />
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="text-center">
          <div className={cn('text-lg font-bold', scoreColor)}>
            {avgSpicedScore != null ? formatScore(avgSpicedScore) : '–'}
          </div>
          <div className="text-[10px] text-text-tertiary">SPICED</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-text-primary">{callCount}</div>
          <div className="text-[10px] text-text-tertiary">calls</div>
        </div>
        <div className="text-center">
          <div className={cn(
            'text-lg font-bold',
            ratio == null ? 'text-text-tertiary' :
            ratio < 60    ? 'text-signal-green' : 'text-signal-amber',
          )}>
            {ratio != null ? `${Math.round(ratio)}%` : '–'}
          </div>
          <div className="text-[10px] text-text-tertiary">talk</div>
        </div>
      </div>

      {/* Score bar */}
      {avgSpicedScore != null && (
        <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full',
              avgSpicedScore >= 70 ? 'bg-signal-green' :
              avgSpicedScore >= 40 ? 'bg-signal-amber' : 'bg-signal-red',
            )}
            style={{ width: `${Math.min(avgSpicedScore, 100)}%` }}
          />
        </div>
      )}

      {/* 1-on-1 prep button */}
      <button
        onClick={() => onOneOnOne(stats)}
        className="w-full flex items-center justify-center gap-1.5 text-[10px] font-semibold text-text-tertiary hover:text-text-primary border border-border hover:border-border-hover rounded-lg py-1.5 transition-all"
      >
        <UserCheck size={11} />
        Prep 1-on-1
      </button>
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

type Tab = 'squad' | 'game-film' | 'analytics'

export function GPCoordinatorDashboard() {
  const { profile, squadEmailList } = useGrowthPlatformContext()
  const [tab, setTab] = useState<Tab>('squad')
  const [oneOnOneTarget, setOneOnOneTarget] = useState<GPSquadMemberStats | null>(null)

  const { data: calls = [], isLoading: callsLoading } = useGrowthPlatformCalls({
    profile,
    squadEmails: squadEmailList,
    enabled: !!profile,
  })

  const { data: squadData, isLoading: squadLoading } = useSquadAnalytics({
    profile,
    enabled: !!profile,
  })

  const { data: analytics, isLoading: analyticsLoading } = useFrameworkAnalytics({
    profile,
    timeframe: '30d',
    squadEmails: squadEmailList,
    enabled: !!profile,
  })

  if (callsLoading || squadLoading) {
    return (
      <div className="p-6 max-w-7xl">
        <DashboardSkeleton />
      </div>
    )
  }

  const memberStats = squadData?.memberStats ?? []
  const needsCoachingCount = memberStats.filter(s => s.needsCoaching).length
  const topPerformer = squadData?.topPerformer
  const totalCalls = calls.length
  const avgScore = avgSpicedPct(calls)
  const avgTalk = avgTalkRatio(calls)

  const TABS: { value: Tab; label: string; icon?: React.ReactNode }[] = [
    { value: 'squad',     label: 'Squad' },
    { value: 'game-film', label: 'Game Film', icon: <Film size={11} /> },
    { value: 'analytics', label: 'Analytics' },
  ]

  return (
    <div className="p-6 space-y-6 max-w-7xl">

      {/* ── 1-on-1 Modal ────────────────────────────────────────────────────── */}
      {oneOnOneTarget && (
        <GPOneOnOnePrep
          stats={oneOnOneTarget}
          recentCalls={calls}
          onClose={() => setOneOnOneTarget(null)}
        />
      )}

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-1">
            GrowthPlatform · Coordenador
          </p>
          <h1 className="text-2xl font-bold text-text-primary">
            Squad {profile?.squad ?? 'Geral'}
          </h1>
          <p className="text-sm text-text-tertiary mt-0.5">
            {profile?.name} · {memberStats.length} membros ativos
          </p>
        </div>
        <div className="flex gap-1 bg-bg-card border border-border rounded-xl p-1">
          {TABS.map(t => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all',
                tab === t.value ? 'bg-g4-red text-white' : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI Row ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <GPKPICard
          label="Calls do Squad"
          value={totalCalls}
          sub="Últimos 30 dias"
          icon={<Phone size={16} className="text-text-tertiary" />}
        />
        <GPKPICard
          label="Score Médio Squad"
          value={avgScore != null ? formatScorePct(avgScore) : '–'}
          sub="SPICED % médio"
          icon={<Brain size={16} className="text-signal-blue" />}
          highlight
        />
        <GPKPICard
          label="Membros no Squad"
          value={memberStats.length}
          sub={topPerformer ? `Top: ${topPerformer.name?.split(' ')[0]}` : 'Nenhum dado'}
          icon={<Users size={16} className="text-signal-green" />}
        />
        <GPKPICard
          label="Precisam Coaching"
          value={needsCoachingCount}
          sub={needsCoachingCount > 0 ? 'Score < 60 no período' : 'Squad ok'}
          subPositive={needsCoachingCount === 0 ? true : null}
          icon={<AlertTriangle size={16} className={needsCoachingCount > 0 ? 'text-signal-amber' : 'text-signal-green'} />}
        />
      </div>

      {/* ── Tab: Squad ──────────────────────────────────────────────────────── */}
      {tab === 'squad' && (
        <>
          {/* Squad Member Grid */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-3">
              Membros do Squad — Últimos 30 dias
            </div>
            {memberStats.length === 0 ? (
              <p className="text-text-tertiary text-sm">Nenhum membro encontrado no squad.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {memberStats
                  .sort((a, b) => (b.avgSpicedScore ?? 0) - (a.avgSpicedScore ?? 0))
                  .map(s => (
                    <SquadMemberCard
                      key={s.profile.id}
                      stats={s}
                      onOneOnOne={setOneOnOneTarget}
                    />
                  ))
                }
              </div>
            )}
          </div>

          {/* Coaching Queue */}
          {needsCoachingCount > 0 && (
            <div className="bg-bg-card border border-signal-amber/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={13} className="text-signal-amber" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
                  Fila de Coaching — Prioridade
                </span>
              </div>
              <div className="space-y-2">
                {memberStats
                  .filter(s => s.needsCoaching)
                  .sort((a, b) => (a.avgSpicedScore ?? 0) - (b.avgSpicedScore ?? 0))
                  .map((s, i) => {
                    const name = s.profile.name ?? s.profile.email.split('@')[0]
                    return (
                      <div
                        key={s.profile.id}
                        className="flex items-center gap-3 p-2.5 bg-bg-card2 rounded-xl cursor-pointer hover:bg-bg-elevated transition-colors"
                        onClick={() => setOneOnOneTarget(s)}
                      >
                        <span className="text-xs font-bold text-text-tertiary w-5 text-right">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate capitalize">{name}</p>
                          <p className="text-xs text-text-tertiary">{s.callCount} calls · {s.lastCallDate ?? 'sem data'}</p>
                        </div>
                        <span className={cn(
                          'text-sm font-bold tabular-nums',
                          (s.avgSpicedScore ?? 0) < 40 ? 'text-signal-red' : 'text-signal-amber',
                        )}>
                          {s.avgSpicedScore != null ? formatScore(s.avgSpicedScore) : '–'}
                        </span>
                        <UserCheck size={13} className="text-text-tertiary" />
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

          {/* Recent Calls */}
          <div className="bg-bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
                Calls Recentes do Squad
              </span>
              <span className="text-xs text-text-tertiary">{totalCalls} total</span>
            </div>
            <GPRecentCallsTable calls={calls} maxRows={10} showSeller />
          </div>
        </>
      )}

      {/* ── Tab: Game Film ──────────────────────────────────────────────────── */}
      {tab === 'game-film' && (
        <div className="bg-bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <Film size={13} className="text-text-tertiary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
              Game Film — Top & Bottom Calls do Squad
            </span>
            <span className="ml-auto text-xs text-text-tertiary">{totalCalls} calls analisadas</span>
          </div>
          <GPGameFilmSection calls={calls} topN={3} bottomN={3} />
        </div>
      )}

      {/* ── Tab: Analytics ──────────────────────────────────────────────────── */}
      {tab === 'analytics' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-bg-card border border-border rounded-2xl p-5">
              <div className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-4">
                Evolução SPICED — Squad (30d)
              </div>
              <GPScoreEvolutionChart calls={calls} showSpin showChallenger height={240} />
            </div>

            <div className="bg-bg-card border border-border rounded-2xl p-5">
              <div className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-4">
                Distribuição SPICED — Dimensões
              </div>
              {analytics && (
                <GPFrameworkDistribution
                  spicedByDimension={analytics.spicedByDimension}
                  height={240}
                />
              )}
            </div>
          </div>

          {/* Framework totals */}
          {analytics && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'SPICED Total Médio',     value: analytics.totals.spiced,     color: 'text-[#B9915B]' },
                { label: 'SPIN Total Médio',        value: analytics.totals.spin,       color: 'text-signal-blue' },
                { label: 'Challenger Total Médio',  value: analytics.totals.challenger, color: 'text-signal-green' },
                { label: 'Behavior Score Médio',    value: analytics.totals.behavior,   color: 'text-signal-amber' },
              ].map(item => (
                <div key={item.label} className="bg-bg-card border border-border rounded-2xl p-4">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-2">
                    {item.label}
                  </div>
                  <div className={cn('text-2xl font-bold', item.color)}>
                    {item.value != null ? formatScore(item.value) : '–'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Weak dimensions */}
          {analytics?.topWeakDimensions && analytics.topWeakDimensions.length > 0 && (
            <div className="bg-bg-card border border-border rounded-2xl p-5">
              <div className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-3">
                Dimensões Críticas do Squad — Top Focos
              </div>
              <div className="flex flex-wrap gap-2">
                {analytics.topWeakDimensions.map(dim => (
                  <span
                    key={dim}
                    className="text-xs px-3 py-1.5 rounded-full bg-signal-amber/10 border border-signal-amber/30 text-signal-amber font-medium"
                  >
                    {dim}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
