// ── GPROICoaching — Score improvement over time per member (coaching ROI) ─────
// Shows a line chart of each squad member's SPICED % trajectory over time,
// visualising the impact of coaching investments.

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import type { GrowthPlatformCall } from '../types'
import { formatCallDate } from '../utils/formatters'

// ── Helpers ───────────────────────────────────────────────────────────────────

const COLORS = [
  '#B9915B', '#60A5FA', '#34D399', '#F59E0B', '#A78BFA',
  '#F472B6', '#38BDF8', '#FB923C', '#4ADE80', '#E879F9',
]

function getScore(call: GrowthPlatformCall): number | null {
  const fs = call.framework_scores
  if (!fs) return null
  return fs.spiced_pct ?? (fs.spiced_total != null ? fs.spiced_total * 10 : null)
}

interface DataPoint {
  date: string
  [sellerName: string]: number | string | null
}

function buildROIData(calls: GrowthPlatformCall[]): {
  data: DataPoint[]
  sellers: { email: string; name: string }[]
} {
  const sellerMap: Map<string, { email: string; name: string }> = new Map()
  const byDate: Map<string, Map<string, number[]>> = new Map()

  for (const call of calls) {
    if (!call.call_date || getScore(call) == null) continue
    const score = getScore(call)!
    const email = call.seller_email
    const name = call.seller_name ?? email.split('@')[0]
    sellerMap.set(email, { email, name })

    if (!byDate.has(call.call_date)) byDate.set(call.call_date, new Map())
    const dateMap = byDate.get(call.call_date)!
    if (!dateMap.has(email)) dateMap.set(email, [])
    dateMap.get(email)!.push(score)
  }

  const sellers = Array.from(sellerMap.values())
  const sortedDates = Array.from(byDate.keys()).sort()

  const data: DataPoint[] = sortedDates.map(date => {
    const point: DataPoint = { date }
    const dateMap = byDate.get(date)!
    for (const { email, name } of sellers) {
      const scores = dateMap.get(email)
      point[name] = scores?.length
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null
    }
    return point
  })

  return { data, sellers }
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

function ROITooltip({ active, payload, label }: {
  active?: boolean
  payload?: { color: string; name: string; value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-card2 border border-border rounded-xl p-3 text-xs space-y-1 shadow-lg">
      <p className="font-semibold text-text-primary mb-1">{label}</p>
      {payload
        .filter(p => p.value != null)
        .sort((a, b) => b.value - a.value)
        .map((p, i) => (
          <p key={i} style={{ color: p.color }}>
            {p.name}: <span className="font-bold">{p.value}%</span>
          </p>
        ))}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

interface GPROICoachingProps {
  calls: GrowthPlatformCall[]
  height?: number
}

export function GPROICoaching({ calls, height = 280 }: GPROICoachingProps) {
  const { data, sellers } = buildROIData(calls)

  if (data.length < 2 || sellers.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-text-tertiary text-sm"
        style={{ height }}
      >
        Dados insuficientes para calcular ROI de coaching.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -20 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => formatCallDate(v).replace(/\s\d{4}$/, '')}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => `${v}%`}
        />
        <Tooltip content={<ROITooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}
          iconType="circle"
          iconSize={7}
        />
        {sellers.map(({ name }, idx) => (
          <Line
            key={name}
            type="monotone"
            dataKey={name}
            stroke={COLORS[idx % COLORS.length]}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
