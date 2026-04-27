import { useMemo } from 'react'
import { TrendingUp, TrendingDown, BarChart2, Users, AlertTriangle, RefreshCcw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useUnifiedCalls } from '../hooks/useUnifiedCalls'
import { EmptyState } from '../components/ui/EmptyState'
import ScoreRing from '../components/ui/ScoreRing'
import { cn } from '../lib/cn'

function MetricCard({
  label,
  value,
  sub,
  trend,
}: {
  label: string
  value: string | number
  sub?: string
  trend?: 'up' | 'down' | 'neutral'
}) {
  return (
    <div className="card flex flex-col gap-1">
      <span className="section-eyebrow">{label}</span>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-text-primary">{value}</span>
        {trend === 'up' && <TrendingUp size={14} className="text-signal-green mb-1" />}
        {trend === 'down' && <TrendingDown size={14} className="text-signal-red mb-1" />}
      </div>
      {sub && <span className="text-xs text-text-tertiary">{sub}</span>}
    </div>
  )
}

export default function InsightsHub() {
  const navigate = useNavigate()
  const { rows, loading, error, retry } = useUnifiedCalls({ limit: 500, daysAgo: 30 })

  const stats = useMemo(() => {
    if (!rows.length) return null

    const scores = rows
      .map(r => r.spiced_total != null ? r.spiced_total * 10 : r.score_geral)
      .filter((s): s is number => s != null)

    const avgScore = scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0

    const critical = rows.filter(r => {
      const s = r.spiced_total != null ? r.spiced_total * 10 : r.score_geral
      return s != null && s < 40
    }).length

    const closerSet = new Set(rows.map(r => r.closer_email ?? r.vendedor).filter(Boolean))

    // Top closers by avg score
    const closerMap = new Map<string, number[]>()
    rows.forEach(r => {
      const key = r.closer_email ?? r.vendedor
      const s = r.spiced_total != null ? r.spiced_total * 10 : r.score_geral
      if (key && s != null) {
        closerMap.set(key, [...(closerMap.get(key) ?? []), s])
      }
    })

    const topClosers = [...closerMap.entries()]
      .filter(([, scores]) => scores.length >= 2)
      .map(([name, scores]) => ({
        name,
        avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
        count: scores.length,
      }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5)

    // Worst dimension (SPICED breakdown)
    const dims: Array<{ key: keyof typeof rows[0]; label: string }> = [
      { key: 'spiced_situation', label: 'Situation' },
      { key: 'spiced_pain', label: 'Pain' },
      { key: 'spiced_impact', label: 'Impact' },
      { key: 'spiced_critical_event', label: 'Critical Event' },
      { key: 'spiced_decision', label: 'Decision' },
    ]

    const dimAvgs = dims.map(({ key, label }) => {
      const vals = rows
        .map(r => r[key] as number | null)
        .filter((v): v is number => v != null)
      return {
        label,
        avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null,
      }
    }).filter(d => d.avg !== null) as { label: string; avg: number }[]

    dimAvgs.sort((a, b) => a.avg - b.avg)

    return { avgScore, critical, total: rows.length, closers: closerSet.size, topClosers, dimAvgs }
  }, [rows])

  if (error) {
    return (
      <div className="p-6 space-y-4 max-w-4xl">
        <div>
          <p className="section-eyebrow">Insights</p>
          <h1 className="text-2xl font-bold">Hub de Inteligência</h1>
        </div>
        <div className="p-4 rounded-xl border border-signal-red/30 bg-signal-red/5 text-sm text-signal-red flex items-center justify-between">
          <span><AlertTriangle size={13} className="inline mr-2" />{error}</span>
          <button onClick={retry} className="flex items-center gap-1 text-xs underline underline-offset-2">
            <RefreshCcw size={12} /> Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-end justify-between">
        <div>
          <p className="section-eyebrow">Insights</p>
          <h1 className="text-2xl font-bold">Hub de Inteligência</h1>
          <p className="text-xs text-text-tertiary mt-1">Últimos 30 dias · {loading ? '—' : `${stats?.total ?? 0} calls`}</p>
        </div>
        <button onClick={retry} className="btn-ghost">
          <RefreshCcw size={14} /> Atualizar
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-bg-card border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !stats || stats.total === 0 ? (
        <EmptyState
          icon={BarChart2}
          title="Sem dados de insights"
          description="Nenhuma call processada nos últimos 30 dias. Faça upload de calls e rode o pipeline para popular os insights."
          action={{ label: 'Ir para Operations', onClick: () => navigate('/operations') }}
        />
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Score médio" value={stats.avgScore} sub="SPICED × 10" />
            <MetricCard label="Total de calls" value={stats.total} sub="últimos 30 dias" />
            <MetricCard label="Closers ativos" value={stats.closers} sub="com ao menos 1 call" />
            <MetricCard
              label="Calls críticas"
              value={stats.critical}
              sub="score < 40"
              trend={stats.critical > 5 ? 'down' : 'neutral'}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top performers */}
            <div className="card space-y-3">
              <div className="flex items-center gap-2">
                <Users size={14} className="text-text-tertiary" />
                <span className="text-sm font-semibold">Top Performers</span>
                <span className="text-xs text-text-tertiary">(mín. 2 calls)</span>
              </div>
              {stats.topClosers.length === 0 ? (
                <p className="text-xs text-text-tertiary">Dados insuficientes para ranking.</p>
              ) : (
                <div className="space-y-2">
                  {stats.topClosers.map((c, i) => (
                    <div key={c.name} className="flex items-center gap-3">
                      <span className="text-xs text-text-tertiary w-4 shrink-0">{i + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">
                          {c.name.includes('@') ? c.name.split('@')[0].replace(/[._]/g, ' ') : c.name}
                        </p>
                        <p className="text-[10px] text-text-tertiary">{c.count} calls</p>
                      </div>
                      <ScoreRing score={c.avg} size="sm" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SPICED dimensions */}
            <div className="card space-y-3">
              <div className="flex items-center gap-2">
                <BarChart2 size={14} className="text-text-tertiary" />
                <span className="text-sm font-semibold">Dimensões SPICED</span>
                <span className="text-xs text-text-tertiary">média do time</span>
              </div>
              {stats.dimAvgs.length === 0 ? (
                <p className="text-xs text-text-tertiary">Sem scores SPICED disponíveis.</p>
              ) : (
                <div className="space-y-2.5">
                  {stats.dimAvgs.map(d => {
                    const pct = Math.round((d.avg / 10) * 100)
                    const color =
                      d.avg >= 7 ? 'bg-signal-green' :
                      d.avg >= 4 ? 'bg-signal-amber' :
                      'bg-signal-red'
                    return (
                      <div key={d.label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className={cn('font-medium', d.avg < 4 ? 'text-signal-red' : 'text-text-secondary')}>
                            {d.label}
                          </span>
                          <span className="text-text-tertiary">{d.avg.toFixed(1)}</span>
                        </div>
                        <div className="w-full h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                          <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
