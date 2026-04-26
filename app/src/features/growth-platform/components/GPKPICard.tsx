import { cn } from '../../../lib/cn'
import type { ReactNode } from 'react'

interface GPKPICardProps {
  label: string
  value: string | number
  sub?: string
  subPositive?: boolean | null
  icon?: ReactNode
  className?: string
  highlight?: boolean   // G4 brand accent border
}

export function GPKPICard({ label, value, sub, subPositive, icon, className, highlight }: GPKPICardProps) {
  return (
    <div className={cn(
      'bg-bg-card border rounded-2xl p-5 flex flex-col gap-3',
      highlight ? 'border-g4-red/40' : 'border-border',
      className,
    )}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">{label}</span>
        {icon && <span className="text-text-tertiary">{icon}</span>}
      </div>
      <div className="text-3xl font-bold text-text-primary leading-none">{value}</div>
      {sub && (
        <div className={cn(
          'text-xs font-medium',
          subPositive === true  && 'text-signal-green',
          subPositive === false && 'text-signal-red',
          subPositive == null   && 'text-text-tertiary',
        )}>
          {sub}
        </div>
      )}
    </div>
  )
}
