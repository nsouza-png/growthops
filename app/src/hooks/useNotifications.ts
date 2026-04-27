import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

export interface Notification {
  id: string
  user_email: string
  type: 'feedback' | 'assignment' | 'critical_call'
  title: string
  body: string | null
  related_id: string | null
  read: boolean
  created_at: string
  // Convenience aliases used in NotificationBell
  call_id?: string | null
  snippet_id?: string | null
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)

  // Debounce refs
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastFetchTimeRef = useRef<number>(0)

  const fetchNotifications = useCallback(async (force = false) => {
    const now = Date.now()

    // Debounce: if last fetch was less than 300ms ago, wait
    if (!force && now - lastFetchTimeRef.current < 300) {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current)
      }
      fetchTimeoutRef.current = setTimeout(() => fetchNotifications(true), 300)
      return
    }

    lastFetchTimeRef.current = now

    const { data: { user } } = await supabase.auth.getUser()
    const userEmail = user?.email?.toLowerCase().trim()
    if (!user || !userEmail) {
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      
      .from('notifications')
      .select('*')
      .eq('user_email', userEmail)
      .order('created_at', { ascending: false })
      .limit(20)

    if (!error && data) {
      // DB contract uses kind/is_read/user_email; UI expects type/read/related_id.
      const mapped: Notification[] = (data as Array<Record<string, unknown>>).map((row) => {
        const type = (row.kind as Notification['type']) || 'feedback'
        const relatedId = (row as { related_id?: string | null }).related_id ?? null
        return {
          id: String(row.id),
          user_email: String(row.user_email ?? ''),
          type,
          title: String(row.title ?? ''),
          body: (row.body as string | null) ?? null,
          related_id: relatedId,
          read: Boolean(row.is_read),
          created_at: String(row.created_at ?? new Date().toISOString()),
          call_id: type === 'feedback' || type === 'critical_call' ? relatedId : null,
          snippet_id: type === 'assignment' ? relatedId : null,
        }
      })
      setNotifications(mapped)
      setUnreadCount(mapped.filter(n => !n.read).length)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  useEffect(() => {
    let cleanup: (() => void) | undefined

    supabase.auth.getUser().then(({ data: { user } }) => {
      const userEmail = user?.email?.toLowerCase().trim()
      if (!user || !userEmail) return

      const channel = supabase
        .channel('notifications-realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'GrowthPlatform',
            table: 'notifications',
            filter: `user_email=eq.${userEmail}`,
          },
          () => {
            fetchNotifications()
          },
        )
        .subscribe((status, err) => {
          if (err) console.error('Realtime channel error:', err)
        })

      cleanup = () => {
        if (channel) {
          supabase.removeChannel(channel)
        }
      }
    })

    return () => {
      if (cleanup) cleanup()
    }
  }, [fetchNotifications])

  const markRead = useCallback(async (id: string) => {
    await supabase
      
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)

    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n),
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
  }, [])

  const markAllRead = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const userEmail = user?.email?.toLowerCase().trim()
    if (!user || !userEmail) return

    await supabase
      
      .from('notifications')
      .update({ is_read: true })
      .eq('user_email', userEmail)
      .eq('is_read', false)

    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }, [])

  return { notifications, unreadCount, loading, markRead, markAllRead }
}
