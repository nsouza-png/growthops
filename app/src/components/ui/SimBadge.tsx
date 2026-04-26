import { cn } from '../../lib/cn'

export default function SimBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full',
        'text-[10px] font-bold uppercase tracking-widest',
        'bg-signal-amber/10 text-signal-amber border border-signal-amber/25',
        className,
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-signal-amber animate-pulse" />
      Simulação
    </span>
  )
}
