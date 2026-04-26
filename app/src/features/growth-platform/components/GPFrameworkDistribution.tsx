import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts'
import { SPICED_DIMENSION_LABELS } from '../utils/formatters'

interface GPFrameworkDistributionProps {
  spicedByDimension: {
    situation: number | null
    pain: number | null
    impact: number | null
    critical_event: number | null
    decision: number | null
    delivery: number | null
  }
  height?: number
}

interface TooltipProps {
  active?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[]
}

function RadarTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="bg-bg-card2 border border-border rounded-xl px-3 py-2 text-xs shadow-lg">
      <p className="text-text-secondary">{p.payload.dim}</p>
      <p className="text-[#B9915B] font-bold">{Number(p.value).toFixed(1)}</p>
    </div>
  )
}

export function GPFrameworkDistribution({ spicedByDimension, height = 220 }: GPFrameworkDistributionProps) {
  const data = [
    { dim: SPICED_DIMENSION_LABELS['situation'],      score: spicedByDimension.situation      ?? 0 },
    { dim: SPICED_DIMENSION_LABELS['pain'],           score: spicedByDimension.pain           ?? 0 },
    { dim: SPICED_DIMENSION_LABELS['impact'],         score: spicedByDimension.impact         ?? 0 },
    { dim: SPICED_DIMENSION_LABELS['critical_event'], score: spicedByDimension.critical_event ?? 0 },
    { dim: SPICED_DIMENSION_LABELS['decision'],       score: spicedByDimension.decision       ?? 0 },
  ]

  const hasData = data.some(d => d.score > 0)

  if (!hasData) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-text-tertiary text-sm">
        Sem dados de framework disponíveis.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
        <PolarGrid stroke="rgba(255,255,255,0.06)" />
        <PolarAngleAxis
          dataKey="dim"
          tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
        />
        <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
        <Tooltip content={<RadarTooltip />} />
        <Radar
          dataKey="score"
          stroke="#B9915B"
          fill="#B9915B"
          fillOpacity={0.15}
          strokeWidth={1.5}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}
