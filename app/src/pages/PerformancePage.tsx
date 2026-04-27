import {
  GrowthPlatformProvider,
  useGrowthPlatformContext,
} from '../features/growth-platform/contexts/GrowthPlatformContext'
import { GPDashboardShell } from '../features/growth-platform/pages/GPDashboardShell'

/**
 * Performance — MECE Grupo 1: dashboards GrowthPlatform por papel (executivo, coordenador, gerente+).
 * Todo usuário autenticado vê o dashboard; a visão muda conforme role em profiles ou user_roles.
 */
export default function PerformancePage() {
  return (
    <GrowthPlatformProvider>
      <PerformancePageContent />
    </GrowthPlatformProvider>
  )
}

function PerformancePageContent() {
  const { profileLoading } = useGrowthPlatformContext()

  if (profileLoading) {
    return (
      <div className="p-6 max-w-7xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-bg-elevated rounded" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 bg-bg-elevated rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <GPDashboardShell />
    </div>
  )
}
