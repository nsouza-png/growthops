import { useEffect, useState } from 'react'
import type { Role } from '../types/database'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useRole() {
  const { user, loading: authLoading } = useAuth()
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setRole(null)
      setLoading(false)
      return
    }

    supabase
      
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        setRole((data?.role as Role) ?? 'executivo')
        setLoading(false)
      })
  }, [user, authLoading])

  return { role, loading }
}
