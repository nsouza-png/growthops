import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export type AppRole = 'admin' | 'coordenador' | 'executivo'

interface RoleContextValue {
  realRole: AppRole | null
  viewedRole: AppRole
  setViewedRole: (r: AppRole) => void
  isAdmin: boolean
  // When simulating executivo, admin can pick a specific closer email
  simulatedCloser: string | null
  setSimulatedCloser: (email: string | null) => void
  loading: boolean
}

const RoleCtx = createContext<RoleContextValue>({
  realRole: null,
  viewedRole: 'executivo',
  setViewedRole: () => { },
  isAdmin: false,
  simulatedCloser: null,
  setSimulatedCloser: () => { },
  loading: true,
})

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [realRole, setRealRole] = useState<AppRole | null>(null)
  const [viewedRole, setViewedRoleState] = useState<AppRole>(() => {
    return (localStorage.getItem('g4_viewed_role') as AppRole) ?? 'admin'
  })
  const [simulatedCloser, setSimulatedCloser] = useState<string | null>(
    () => localStorage.getItem('g4_sim_closer') ?? null,
  )
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setRealRole(null)
      setLoading(false)
      return
    }

    supabase
      
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        const role = (data?.role as AppRole) ?? 'executivo'
        setRealRole(role)
        // If not admin, force viewedRole = realRole (can't impersonate)
        if (role !== 'admin') {
          setViewedRoleState(role)
        }
        setLoading(false)
      })
  }, [user])

  function setViewedRole(r: AppRole) {
    setViewedRoleState(r)
    localStorage.setItem('g4_viewed_role', r)
    // Reset simulated closer when switching away from executivo view
    if (r !== 'executivo') {
      setSimulatedCloser(null)
      localStorage.removeItem('g4_sim_closer')
    }
  }

  function setSimulatedCloserPersist(email: string | null) {
    setSimulatedCloser(email)
    if (email) localStorage.setItem('g4_sim_closer', email)
    else localStorage.removeItem('g4_sim_closer')
  }

  return (
    <RoleCtx.Provider
      value={{
        realRole,
        viewedRole,
        setViewedRole,
        isAdmin: realRole === 'admin',
        simulatedCloser,
        setSimulatedCloser: setSimulatedCloserPersist,
        loading,
      }}
    >
      {children}
    </RoleCtx.Provider>
  )
}

export function useRole() {
  return useContext(RoleCtx)
}
