// ── GPManagerDashboard — Strategic view for gerentes / diretores ─────────────

import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from 'recharts'
import { Phone, Brain, AlertTriangle, TrendingUp, Users, DollarSign, BarChart2, Target } from 'lucide-react'
import { useGrowthPlatformContext } from '../contexts/GrowthPlatformContext'
import { useGrowthPlatformCalls } from '../hooks/useGrowthPlatformCalls'
import { useFrameworkAnalytics } from '../hooks/useFrameworkAnalytics'
import { GrowthPlatformAPI } from '../services/api'
import { useQuery } from '@tanstack/react-query'
import { GPKPICard } from '../components/GPKPICard'
import { GPScoreEvolutionChart } from '../components/GPScoreEvolutionChart'
import { GPFrameworkDistribution } from '../components/GPFrameworkDistribution'
import { GPRecentCallsTable } from '../components/GPRecentCallsTable'
import { GPROICoaching } from '../components/GPROICoaching'
import { GPForecasting } from '../components/GPForecasting'
import { DashboardSkeleton } from '../../../components/ui/SkeletonLoader'
import { cn } from '../../../lib/cn'
import {
  formatScore, formatScorePct, formatARR, avgSpicedPct, avgTalkRatio,
} from '../utils/formatters'
import type { GrowthPlatformCall } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupBySquad(calls: GrowthPlatformCall[], profiles: Awaited<ReturnType<typeof GrowthPlatformAPI.getAllActiveProfiles>>) {
  const emailToSquad: Record<string, string> = {}
  for (const p of profiles) {
    if (p.squad) emailToSquad[p.email] = p.squad
  }

  const squadMap: Record<string, { scores: number[]; arr: number[]; callCount: number }> = {}
  for (const call of calls) {
    const squad = emailToSquad[call.seller_email] ?? 'Sem Squad'
    if (!squadMap[squad]) squadMap[squad] = { scores: [], arr: [], callCount: 0 }
    squadMap[squad].callCount++
    const score = call.framework_scores?.spiced_total
    if (score != null) squadMap[squad].scores.push(score)
    const arr = call.business_analysis?.estimated_arr
    if (arr != null) squadMap[squad].arr.push(arr)
  }

  return Object.entries(squadMap).map(([squad, { scores, arr, callCount }]) => ({
    squad,
    avgScore: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
    totalArr: arr.reduce((a, b) => a + b, 0),
    callCount,
  }))
}

function riskCalls(calls: GrowthPlatformCall[]) {
  return calls.filter(c => {
    const risk = c.framework_scores?.deal_risk?.toLowerCase() ?? ''
    return risk === 'alto'
  }).slice(0, 10)
}

function SquadTooltip({ active, payload, label }: { active?: boolean; payload?: { color: string; name: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-card2 border border-border rounded-xl p-3 text-xs space-y-1 shadow-lg">
      <p className="font-semibold text-text-primary mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</span>
        </p>
      ))}
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'squads' | 'roi-coaching' | 'forecasting' | 'risk'

export function GPManagerDashboard() {
  const { profile } = useGrowthPlatformContext()
  const [tab, setTab] = useState<Tab>('overview')

  const { data: calls = [], isLoading: callsLoading } = useGrowthPlatformCalls({
    profile,
    enabled: !!profile,
  })

  const { data: analytics, isLoading: analyticsLoading } = useFrameworkAnalytics({
    profile,
    timeframe: '30d',
    enabled: !!profile,
  })

  const { data: allProfiles = [] } = useQuery({
    queryKey: ['gp-all-profiles'],
    queryFn: () => GrowthPlatformAPI.getAllActiveProfiles(),
    staleTime: 10 * 60 * 1000,
  })

  if (callsLoading || analyticsLoading) {
    return (
      <div className="p-6 max-w-7xl">
        <DashboardSkeleton />
      </div>
    )
  }

  const totalCalls = calls.length
  const totalARR = calls.reduce((sum, c) => sum + (c.business_analysis?.estimated_arr ?? 0), 0)
  const avgScore = avgSpicedPct(calls)
  const avgTalk = avgTalkRatio(calls)
  const riskCount = calls.filter(c => c.framework_scores?.deal_risk?.toLowerCase() === 'alto').length
  // allProfiles already filters is_active=true; count only executivos
  const activeProfiles = allProfiles.filter(p => p.role === 'executivo').length
  const squadData = groupBySquad(calls, allProfiles)
  const atRiskCalls = riskCalls(calls)

  const TABS: { label: string; value: Tab; icon?: React.ReactNode }[] = [
    { label: 'Visão Geral',   value: 'overview' },
    { label: 'Squads',        value: 'squads' },
    { label: 'ROI Coaching',  value: 'roi-coaching',  icon: <BarChart2 size={11} /> },
    { label: 'Forecasting',   value: 'forecasting',   icon: <Target size={11} /> },
    { label: 'Risk Deals',    value: 'risk' },
  ]

  return (
    <div className="p-6 space-y-6 max-w-7xl">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-1">
            GrowthPlatform · {profile?.role === 'diretor' ? 'Diretor' : 'Gerente'}
          </p>
          <h1 className="text-2xl font-bold text-text-primary">Visão Estratégica</h1>
          <p className="text-sm text-text-tertiary mt-0.5">
            {profile?.name} · Todos os squads
          </p>
        </div>
        <div className="flex flex-wrap gap-1 bg-bg-card border border-border rounded-xl p-1">
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
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <GPKPICard
          label="Calls Totais"
          value={totalCalls}
          sub="Histórico completo"
          icon={<Phone size={15} className="text-text-tertiary" />}
        />
        <GPKPICard
          label="Score Global"
          value={avgScore != null ? formatScorePct(avgScore) : '–'}
          sub="SPICED % médio"
          icon={<Brain size={15} className="text-signal-blue" />}
          highlight
        />
        <GPKPICard
          label="ARR em Pipeline"
          value={formatARR(totalARR || null)}
          sub="Calls com ARR estimado"
          icon={<DollarSign size={15} className="text-signal-amber" />}
        />
        <GPKPICard
          label="Executivos Ativos"
          value={activeProfiles}
          sub={`${allProfiles.length} total na equipe`}
          icon={<Users size={15} className="text-signal-green" />}
        />
        <GPKPICard
          label="Risk Deals"
          value={riskCount}
          sub={riskCount > 0 ? 'Deals com risco alto' : 'Nenhum risco alto'}
          subPositive={riskCount === 0}
          icon={<AlertTriangle size={15} className={riskCount > 0 ? 'text-signal-red' : 'text-signal-green'} />}
        />
        <GPKPICard
          label="Talk Ratio Médio"
          value={avgTalk != null ? `${Math.round(avgTalk)}%` : '–'}
          sub={avgTalk != null ? (avgTalk < 60 ? 'Saudável' : 'Atenção') : ''}
          subPositive={avgTalk != null ? avgTalk < 60 : null}
          icon={<TrendingUp size={15} className="text-text-tertiary" />}
        />
      </div>

      {/* ── Tab: Overview ───────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-bg-card border border-border rounded-2xl p-5">
              <div className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-4">
                Evolução SPICED — Global (30d)
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

          <div className="bg-bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
                Calls Recentes — Todos os Squads
              </span>
              <span className="text-xs text-text-tertiary">{totalCalls} total</span>
            </div>
            <GPRecentCallsTable calls={calls} maxRows={10} showSeller />
          </div>
        </>
      )}

      {/* ── Tab: Squads ─────────────────────────────────────────────────────── */}
      {tab === 'squads' && (
        <>
          <div className="bg-bg-card border border-border rounded-2xl p-5">
            <div className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-4">
              Comparativo de Squads — Score Médio SPICED
            </div>
            {squadData.length === 0 ? (
              <div className="h-[240px] flex items-center justify-center text-text-tertiary text-sm">
                Sem dados de squad disponíveis.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={squadData}
                  margin={{ top: 24, right: 16, bottom: 0, left: -16 }}
                  barCategoryGap="35%"
                >
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis
                    dataKey="squad"
                    tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<SquadTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="avgScore" name="Score Médio" fill="#B9915B" radius={[6, 6, 0, 0]}>
                    <LabelList
                      dataKey="avgScore"
                      position="top"
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(v: any) => Number(v).toFixed(1)}
                      style={{ fill: 'rgba(255,255,255,0.45)', fontSize: 10 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-bg-card border border-border rounded-2xl p-5">
            <div className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-4">
              Breakdown por Squad
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {['Squad', 'Calls', 'Score Médio', 'ARR Total'].map(h => (
                      <th key={h} className="text-left text-[10px] font-bold uppercase tracking-widest text-text-tertiary py-2 pr-4">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {squadData.sort((a, b) => b.avgScore - a.avgScore).map(row => (
                    <tr key={row.squad} className="border-b border-border/50">
                      <td className="py-3 pr-4 font-medium text-text-primary">{row.squad}</td>
                      <td className="py-3 pr-4 text-text-secondary">{row.callCount}</td>
                      <td className="py-3 pr-4">
                        <span className={cn(
                          'font-bold',
                          row.avgScore >= 70 ? 'text-signal-green' :
                          row.avgScore >= 40 ? 'text-signal-amber' : 'text-signal-red',
                        )}>
                          {formatScore(row.avgScore)}
                        </span>
                      </td>
                      <td className="py-3 text-text-secondary">{formatARR(row.totalArr || null)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Tab: ROI Coaching ───────────────────────────────────────────────── */}
      {tab === 'roi-coaching' && (
        <div className="space-y-5">
          <div className="bg-bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 size={13} className="text-signal-blue" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
                Evolução Individual — Score SPICED % por Executivo
              </span>
            </div>
            <p className="text-xs text-text-tertiary mb-5">
              Cada linha representa um executivo. Linhas subindo = impacto positivo do coaching.
            </p>
            <GPROICoaching calls={calls} height={320} />
          </div>

          {/* Per-member summary */}
          {allProfiles.filter(p => p.is_active && p.role === 'executivo').length > 0 && (
            <div className="bg-bg-card border border-border rounded-2xl p-5">
              <div className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-4">
                Resumo por Executivo — Período Completo
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {['Executivo', 'Squad', 'Calls', 'Score Médio'].map(h => (
                        <th key={h} className="text-left text-[10px] font-bold uppercase tracking-widest text-text-tertiary py-2 pr-4">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allProfiles
                      .filter(p => p.is_active && p.role === 'executivo')
                      .map(p => {
                        const memberCalls = calls.filter(c => c.seller_email === p.email)
                        const scores = memberCalls
                          .map(c => c.framework_scores?.spiced_pct ?? (c.framework_scores?.spiced_total != null ? c.framework_scores.spiced_total * 10 : null))
                          .filter((v): v is number => v != null)
                        const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null
                        return (
                          <tr key={p.id} className="border-b border-border/50">
                            <td className="py-3 pr-4 font-medium text-text-primary capitalize">
                              {p.name ?? p.email.split('@')[0]}
                            </td>
                            <td className="py-3 pr-4 text-text-secondary">{p.squad ?? '–'}</td>
                            <td className="py-3 pr-4 text-text-secondary">{memberCalls.length}</td>
                            <td className="py-3">
                              <span className={cn(
                                'font-bold',
                                avg == null ? 'text-text-tertiary' :
                                avg >= 70   ? 'text-signal-green' :
                                avg >= 40   ? 'text-signal-amber' : 'text-signal-red',
                              )}>
                                {avg != null ? formatScorePct(avg) : '–'}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Forecasting ────────────────────────────────────────────────── */}
      {tab === 'forecasting' && (
        <div className="space-y-5">
          <div className="bg-bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <Target size={13} className="text-[#B9915B]" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
                Projeção de Score — Próximas 4 Semanas
              </span>
            </div>
            <p className="text-xs text-text-tertiary mb-5">
              Regressão linear sobre médias semanais. Linha sólida = histórico real · tracejada = projeção · área = intervalo de confiança.
            </p>
            <GPForecasting calls={calls} height={300} />
          </div>

          {/* Squad-level forecasts */}
          {squadData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {squadData.slice(0, 4).map(sq => {
                const squadCalls = calls.filter(c => {
                  const profile = allProfiles.find(p => p.email === c.seller_email)
                  return profile?.squad === sq.squad
                })
                return (
                  <div key={sq.squad} className="bg-bg-card border border-border rounded-2xl p-5">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-3">
                      Squad {sq.squad} — Projeção
                    </div>
                    <GPForecasting calls={squadCalls} height={200} />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Risk Deals ─────────────────────────────────────────────────── */}
      {tab === 'risk' && (
        <div className="bg-bg-card border border-signal-red/30 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={13} className="text-signal-red" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
              Deals com Risco Alto — Ação Imediata
            </span>
            <span className="ml-auto text-xs text-signal-red font-semibold">{riskCount} deals</span>
          </div>

          {atRiskCalls.length === 0 ? (
            <p className="text-text-tertiary text-sm">Nenhum deal com risco alto no momento.</p>
          ) : (
            <GPRecentCallsTable calls={atRiskCalls} maxRows={10} showSeller />
          )}
        </div>
      )}
    </div>
  )
}
