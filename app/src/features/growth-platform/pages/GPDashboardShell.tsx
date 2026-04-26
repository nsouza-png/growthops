// ── GPDashboardShell — Role-based routing for GP dashboards ──────────────────
// Routes to the correct dashboard by GP role.
// Must be rendered inside an existing GrowthPlatformProvider (e.g. PerformancePage).

import { useGrowthPlatformContext } from '../contexts/GrowthPlatformContext'
import { GPExecutiveDashboard } from './GPExecutiveDashboard'
import { GPCoordinatorDashboard } from './GPCoordinatorDashboard'
import { GPManagerDashboard } from './GPManagerDashboard'

/**
 * GPDashboardShell routes to the correct dashboard by GP role.
 * Expects to be rendered inside a GrowthPlatformProvider — does NOT mount one itself.
 */
export function GPDashboardShell() {
  const { role, profileLoading, profileError } = useGrowthPlatformContext()

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
          <div className="h-64 bg-bg-elevated rounded-2xl" />
        </div>
      </div>
    )
  }

  if (profileError || !role) {
    // User not in GrowthPlatform.profiles — render nothing (caller shows fallback)
    return null
  }

  if (role === 'executivo') return <GPExecutiveDashboard />
  if (role === 'coordenador') return <GPCoordinatorDashboard />

  // gerente | diretor | sales_ops | admin
  return <GPManagerDashboard />
}

/**
 * Hook for PerformancePage to check whether GP is available.
 * Must be called inside GrowthPlatformProvider — use GPDashboardShell instead
 * if you need the full shell with auto-routing.
 */
export { useGrowthPlatformContext }
