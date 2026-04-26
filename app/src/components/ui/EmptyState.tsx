import { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-6 text-center', className)}>
      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-white/30" />
      </div>
      <p className="text-sm font-semibold text-white/90 mb-1">{title}</p>
      {description && (
        <p className="text-xs text-white/50 max-w-xs leading-relaxed">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 text-xs font-semibold rounded-lg border border-white/15 text-white/70 hover:border-white/30 hover:text-white/90 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
