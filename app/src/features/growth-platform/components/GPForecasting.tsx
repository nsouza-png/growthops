// ── GPForecasting — Linear trend projection of SPICED scores ─────────────────
// Computes a simple linear regression on rolling weekly averages and projects
// the trajectory for the next 4 weeks, giving managers a directional forecast.

import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '../../../lib/cn'
import type { GrowthPlatformCall } from '../types'

// ── Math helpers ──────────────────────────────────────────────────────────────

function getScore(call: GrowthPlatformCall): number | null {
  const fs = call.framework_scores
  if (!fs) return null
  return fs.spiced_pct ?? (fs.spiced_total != null ? fs.spiced_total * 10 : null)
}

function isoWeek(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}

function weekLabel(weekStr: string): string {
  // weekStr: "2026-W17" → "S17/26"
  const [year, w] = weekStr.split('-W')
  return `S${w}/${String(year).slice(2)}`
}

function linearRegression(xs: number[], ys: number[]): { slope: number; intercept: number } {
  const n = xs.length
  const sumX = xs.reduce((a, b) => a + b, 0)
  const sumY = ys.reduce((a, b) => a + b, 0)
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0)
  const sumX2 = xs.reduce((a, x) => a + x * x, 0)
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n
  return { slope, intercept }
}

interface ForecastPoint {
  label: string
  actual: number | null
  forecast: number | null
  band_lo: number | null
  band_hi: number | null
}

function buildForecast(calls: GrowthPlatformCall[], forecastWeeks = 4): ForecastPoint[] {
  // Aggregate by ISO week
  const weekMap: Map<string, number[]> = new Map()
  for (const call of calls) {
    if (!call.call_date) continue
    const score = getScore(call)
    if (score == null) continue
    const wk = isoWeek(new Date(call.call_date))
    if (!weekMap.has(wk)) weekMap.set(wk, [])
    weekMap.get(wk)!.push(score)
  }

  const weeks = Array.from(weekMap.keys()).sort()
  if (weeks.length < 3) return []

  const xs = weeks.map((_, i) => i)
  const ys = weeks.map(w => {
    const scores = weekMap.get(w)!
    return scores.reduce((a, b) => a + b, 0) / scores.length
  })

  const { slope, intercept } = linearRegression(xs, ys)

  // Residual std dev for confidence band
  const residuals = ys.map((y, i) => y - (slope * i + intercept))
  const variance = residuals.reduce((a, r) => a + r * r, 0) / residuals.length
  const std = Math.sqrt(variance)

  const history: ForecastPoint[] = weeks.map((wk, i) => ({
    label:    weekLabel(wk),
    actual:   Math.round(ys[i] * 10) / 10,
    forecast: null,
    band_lo:  null,
    band_hi:  null,
  }))

  const lastIdx = weeks.length - 1
  const futurePoints: ForecastPoint[] = Array.from({ length: forecastWeeks }, (_, j) => {
    const i = lastIdx + j + 1
    const projected = Math.min(100, Math.max(0, slope * i + intercept))
    return {
      label:    `+${j + 1}w`,
      actual:   null,
      forecast: Math.round(projected * 10) / 10,
      band_lo:  Math.max(0,   Math.round((projected - std) * 10) / 10),
      band_hi:  Math.min(100, Math.round((projected + std) * 10) / 10),
    }
  })

  // Bridge: duplicate last actual into forecast at transition point
  const bridgeForecast = slope * lastIdx + intercept
  history[history.length - 1] = {
    ...history[history.length - 1],
    forecast: Math.round(bridgeForecast * 10) / 10,
    band_lo:  Math.max(0,   Math.round((bridgeForecast - std) * 10) / 10),
    band_hi:  Math.min(100, Math.round((bridgeForecast + std) * 10) / 10),
  }

  return [...history, ...futurePoints]
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

function ForecastTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-card2 border border-border rounded-xl p-3 text-xs space-y-1 shadow-lg">
      <p className="font-semibold text-text-primary mb-1">{label}</p>
      {payload.filter(p => p.value != null).map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{p.value}%</span>
        </p>
      ))}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

interface GPForecastingProps {
  calls: GrowthPlatformCall[]
  height?: number
}

export function GPForecasting({ calls, height = 260 }: GPForecastingProps) {
  const data = buildForecast(calls)

  // Compute trend direction from last vs first actual
  const actuals = data.filter(p => p.actual != null).map(p => p.actual!)
  const trendDelta = actuals.length >= 2
    ? actuals[actuals.length - 1] - actuals[0]
    : null

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-text-tertiary text-sm"
        style={{ height }}
      >
        Dados insuficientes para projeção (mínimo 3 semanas).
      </div>
    )
  }

  const trendColor = trendDelta == null ? 'text-text-tertiary' :
    trendDelta > 2 ? 'text-signal-green' :
    trendDelta < -2 ? 'text-signal-red' : 'text-signal-amber'

  const TrendIcon = trendDelta == null ? Minus :
    trendDelta > 2 ? TrendingUp : trendDelta < -2 ? TrendingDown : Minus

  return (
    <div className="space-y-3">
      {/* Trend badge */}
      <div className="flex items-center gap-2">
        <TrendIcon size={13} className={trendColor} />
        <span className={cn('text-xs font-semibold', trendColor)}>
          {trendDelta == null ? 'Sem dados'
            : trendDelta > 2 ? `+${trendDelta.toFixed(1)}% vs início do período — tendência de alta`
            : trendDelta < -2 ? `${trendDelta.toFixed(1)}% vs início do período — tendência de queda`
            : 'Estável no período'}
        </span>
        <span className="text-[10px] text-text-tertiary ml-auto">área = intervalo de confiança</span>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -20 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${v}%`}
          />
          <Tooltip content={<ForecastTooltip />} />

          {/* Reference line at 70% (performance target) */}
          <ReferenceLine
            y={70}
            stroke="rgba(52,211,153,0.3)"
            strokeDasharray="4 4"
            label={{ value: 'Meta 70%', fill: 'rgba(52,211,153,0.5)', fontSize: 9, position: 'right' }}
          />

          {/* Confidence band (area) */}
          <Area
            type="monotone"
            dataKey="band_hi"
            stroke="none"
            fill="#B9915B"
            fillOpacity={0.08}
            legendType="none"
            activeDot={false}
          />
          <Area
            type="monotone"
            dataKey="band_lo"
            stroke="none"
            fill="#1a1a1a"
            fillOpacity={1}
            legendType="none"
            activeDot={false}
          />

          {/* Actual line */}
          <Line
            type="monotone"
            dataKey="actual"
            name="Real"
            stroke="#B9915B"
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#B9915B' }}
            connectNulls={false}
          />

          {/* Forecast line */}
          <Line
            type="monotone"
            dataKey="forecast"
            name="Projeção"
            stroke="#B9915B"
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
