import { cn } from '../lib/cn'

interface TopicCell {
  topic: string          // nome da dimensão (ex: "Situation", "Pain")
  score: number | null   // valor 0.0–1.0 (campo _pp)
  excerpt: string | null // motivo_* — usado no tooltip
}

interface TopicHeatmapProps {
  cells: TopicCell[]
  title?: string
}

function cellColor(score: number | null): string {
  if (score == null || score < 0.4) {
    return 'bg-signal-red/20 text-signal-red border-signal-red/30'
  }
  if (score < 0.7) {
    return 'bg-signal-amber/20 text-signal-amber border-signal-amber/30'
  }
  return 'bg-signal-green/20 text-signal-green border-signal-green/30'
}

export function TopicHeatmap({ cells, title }: TopicHeatmapProps) {
  return (
    <div className="card">
      <p className="section-eyebrow mb-3">{title ?? 'Heatmap de Tópicos'}</p>
      <div className="grid grid-cols-2 gap-2">
        {cells.map(cell => (
          <div
            key={cell.topic}
            title={cell.excerpt ?? ''}
            className={cn(
              'relative p-3 rounded-xl border cursor-default transition-colors',
              cellColor(cell.score)
            )}
          >
            <p className="text-xs font-bold uppercase tracking-wider">{cell.topic}</p>
            <p className="text-lg font-bold tabular-nums mt-0.5">
              {cell.score != null ? `${Math.round(cell.score * 100)}%` : '—'}
            </p>
            {cell.excerpt && (
              <p className="text-[10px] mt-1 opacity-70 leading-relaxed line-clamp-2">
                "{cell.excerpt}"
              </p>
            )}
          </div>
        ))}
      </div>
      <p className="text-[10px] text-text-tertiary mt-2">
        Verde = pronto para next touchpoint · Amarelo = aprofundar · Vermelho = objecao/gap
      </p>
    </div>
  )
}
