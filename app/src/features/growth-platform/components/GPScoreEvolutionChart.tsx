import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { buildScoreEvolution, formatCallDate } from '../utils/formatters'
import type { GrowthPlatformCall } from '../types'

interface GPScoreEvolutionChartProps {
  calls: GrowthPlatformCall[]
  showSpin?: boolean
  showChallenger?: boolean
  height?: number
}

interface TooltipProps {
  active?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[]
  label?: string
}

function ChartTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-card2 border border-border rounded-xl p-3 text-xs space-y-1 shadow-lg">
      <p className="text-text-tertiary mb-1">{label ? formatCallDate(label) : ''}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: {p.value != null ? Number(p.value).toFixed(1) : '–'}
        </p>
      ))}
    </div>
  )
}

export function GPScoreEvolutionChart({
  calls,
  showSpin = false,
  showChallenger = false,
  height = 240,
}: GPScoreEvolutionChartProps) {
  const data = buildScoreEvolution(calls)

  if (data.length === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-text-tertiary text-sm">
        Sem dados de evolução disponíveis.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={d => {
            const dt = new Date(d)
            return `${dt.getDate()}/${dt.getMonth() + 1}`
          }}
          tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<ChartTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', paddingTop: 8 }}
        />
        <Line
          type="monotone"
          dataKey="spiced"
          name="SPICED"
          stroke="#B9915B"
          strokeWidth={2}
          dot={{ r: 3, fill: '#B9915B' }}
          connectNulls
        />
        {showSpin && (
          <Line
            type="monotone"
            dataKey="spin"
            name="SPIN"
            stroke="#3B82F6"
            strokeWidth={1.5}
            dot={false}
            connectNulls
          />
        )}
        {showChallenger && (
          <Line
            type="monotone"
            dataKey="challenger"
            name="Challenger"
            stroke="#10B981"
            strokeWidth={1.5}
            dot={false}
            connectNulls
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}
