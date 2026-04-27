import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useRole } from '../contexts/RoleContext'

function RouteSpinner() {
  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-g4-red border-t-transparent animate-spin" />
    </div>
  )
}

/** Apenas `realRole === 'admin'` — não depende de viewedRole (simulação). */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useRole()
  if (loading) return <RouteSpinner />
  if (!isAdmin) return <Navigate to="/performance" replace />
  return <>{children}</>
}

/** Admin ou coordenador real (bloqueia executivo mesmo com URL direta). */
export function RequireAdminOrCoordinator({ children }: { children: ReactNode }) {
  const { isAdmin, realRole, loading } = useRole()
  if (loading) return <RouteSpinner />
  if (isAdmin || realRole === 'coordenador') return <>{children}</>
  return <Navigate to="/performance" replace />
}

/** Bloqueia executivo; permite admin e coordenador. */
export function RequireCoordOrAdmin({ children }: { children: ReactNode }) {
  const { realRole, loading } = useRole()
  if (loading) return <RouteSpinner />
  if (realRole === 'admin' || realRole === 'coordenador') return <>{children}</>
  return <Navigate to="/performance" replace />
}
