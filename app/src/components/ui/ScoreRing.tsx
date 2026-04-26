import { cn } from '../../lib/cn'

interface Props {
  score: number | null
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  isSimulation?: boolean
}

function scoreColor(score: number | null) {
  if (score === null) return { ring: 'text-text-tertiary', bg: 'bg-bg-elevated' }
  if (score >= 8) return { ring: 'text-signal-green', bg: 'bg-signal-green/10' }
  if (score >= 6) return { ring: 'text-signal-blue', bg: 'bg-signal-blue/10' }
  if (score >= 4) return { ring: 'text-signal-amber', bg: 'bg-signal-amber/10' }
  return { ring: 'text-signal-red', bg: 'bg-signal-red/10' }
}

const sizes = {
  sm: { outer: 'w-8 h-8 text-xs', stroke: 24, r: 10 },
  md: { outer: 'w-12 h-12 text-sm', stroke: 32, r: 14 },
  lg: { outer: 'w-16 h-16 text-base', stroke: 48, r: 20 },
}

export default function ScoreRing({ score, size = 'md', showLabel, isSimulation }: Props) {
  const { ring, bg } = scoreColor(score)
  const { outer, stroke, r } = sizes[size]
  const circumference = 2 * Math.PI * r
  const progress = score !== null ? ((score / 10) * circumference) : 0

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={cn('relative flex items-center justify-center rounded-full', bg, outer)}>
        <svg className="absolute inset-0 -rotate-90" width="100%" height="100%" viewBox={`0 0 ${stroke} ${stroke}`}>
          <circle
            cx={stroke / 2} cy={stroke / 2} r={r}
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2"
          />
          <circle
            cx={stroke / 2} cy={stroke / 2} r={r}
            fill="none"
            className={ring}
            stroke="currentColor" strokeWidth="2"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={`${circumference - progress}`}
            strokeLinecap="round"
          />
        </svg>
        <span className={cn('relative font-bold tabular-nums', ring)}>
          {score !== null ? score.toFixed(1) : '—'}
        </span>
      </div>
      {showLabel && isSimulation && (
        <span className="text-[9px] font-bold uppercase tracking-widest text-signal-amber/70">SIM</span>
      )}
    </div>
  )
}
