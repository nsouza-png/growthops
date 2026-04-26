import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRole } from '../contexts/RoleContext'
import type { Call, CallAnalysis, MethodologyScores } from '../types/database'

export interface CallRow extends Call {
  analysis: CallAnalysis | null
  scores: MethodologyScores | null
}

export function useCalls(limit = 50) {
  const { viewedRole, simulatedCloser } = useRole()
  const [calls, setCalls] = useState<CallRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetch() {
      setLoading(true)
      setError(null)

      let query = supabase
        
        .from('calls')
        .select(`*, analysis:call_analysis(*), scores:framework_scores(*)`)
        .order('call_date', { ascending: false })
        .limit(limit)

      // When admin simulates executivo view, filter by the selected closer
      if (viewedRole === 'executivo' && simulatedCloser) {
        query = query.eq('seller_email', simulatedCloser)
      }

      const { data, error: err } = await query

      if (err) setError(err.message)
      else setCalls((data ?? []) as unknown as CallRow[])
      setLoading(false)
    }
    fetch()
  }, [limit, viewedRole, simulatedCloser])

  return { calls, loading, error }
}

export function useCall(callId: string | undefined) {
  const [call, setCall] = useState<CallRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!callId) return
    supabase
      
      .from('calls')
      .select(`*, analysis:call_analysis(*), scores:framework_scores(*)`)
      .eq('id', callId)
      .single()
      .then(({ data }) => {
        setCall(data as unknown as CallRow)
        setLoading(false)
      })
  }, [callId])

  return { call, loading }
}

// Fetch unique closer emails — used by admin to simulate executivo view
export function useCloserList() {
  const [closers, setClosers] = useState<string[]>([])

  useEffect(() => {
    supabase
      
      .from('calls')
      .select('seller_email')
      .not('seller_email', 'is', null)
      .order('seller_email')
      .then(({ data }) => {
        const unique = [...new Set((data ?? []).map((r: { seller_email: string | null }) => r.seller_email).filter(Boolean))] as string[]
        setClosers(unique)
      })
  }, [])

  return closers
}
