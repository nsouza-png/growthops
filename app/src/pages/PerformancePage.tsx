import {
  GrowthPlatformProvider,
  useGrowthPlatformContext,
} from '../features/growth-platform/contexts/GrowthPlatformContext'
import { GPDashboardShell } from '../features/growth-platform/pages/GPDashboardShell'

/**
 * Performance — MECE Grupo 1: apenas dashboards GrowthPlatform (schema GrowthPlatform).
 */
export default function PerformancePage() {
  return (
    <GrowthPlatformProvider>
      <PerformancePageContent />
    </GrowthPlatformProvider>
  )
}

function NoGrowthPlatformProfile() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="card space-y-4">
        <h1 className="text-lg font-semibold text-text-primary">Performance indisponível</h1>
        <p className="text-sm text-text-secondary leading-relaxed">
          Não encontramos um perfil em <strong>GrowthPlatform.profiles</strong> para esta conta. Um
          administrador precisa criar ou vincular o perfil no banco atual, ou você pode estar no
          projeto Supabase errado.
        </p>
      </div>
    </div>
  )
}

function PerformancePageContent() {
  const { role: gpRole, profileLoading } = useGrowthPlatformContext()

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

  if (gpRole) {
    return (
      <div className="relative">
        <GPDashboardShell />
      </div>
    )
  }

  return <NoGrowthPlatformProfile />
}
