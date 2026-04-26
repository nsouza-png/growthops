import { cn } from '../../lib/cn'

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded-lg bg-white/[0.06]', className)} />
  )
}

export function InsightsHubSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-bg-card border border-border rounded-xl p-4 flex items-center gap-4">
          <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-72" />
          </div>
          <div className="flex gap-6">
            {Array.from({ length: 4 }).map((_, j) => (
              <Skeleton key={j} className="h-3 w-14" />
            ))}
          </div>
          <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
        </div>
      ))}
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-bg-card border border-border rounded-xl p-5 space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-3 bg-bg-card border border-border rounded-xl p-5">
          <Skeleton className="h-3 w-32 mb-4" />
          <Skeleton className="h-48 w-full" />
        </div>
        <div className="col-span-2 bg-bg-card border border-border rounded-xl p-5 space-y-3">
          <Skeleton className="h-3 w-24 mb-4" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="w-8 h-8 rounded-full" />
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="w-10 h-10 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function CallHubSkeleton() {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-4 px-4 py-2 mb-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-full" />
        ))}
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="bg-bg-card border border-border rounded-xl px-4 py-3 grid grid-cols-7 gap-4 items-center">
          <Skeleton className="h-3 w-full col-span-2" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="w-8 h-8 rounded-full mx-auto" />
        </div>
      ))}
    </div>
  )
}

export { Skeleton }
