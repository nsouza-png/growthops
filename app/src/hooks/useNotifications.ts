import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

export interface Notification {
  id: string
  user_id: string
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
    if (!user) {
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (!error && data) {
      // Map related_id to call_id/snippet_id based on type
      const mapped: Notification[] = (data as Notification[]).map((n) => ({
        ...n,
        call_id: n.type === 'feedback' || n.type === 'critical_call' ? n.related_id : null,
        snippet_id: n.type === 'assignment' ? n.related_id : null,
      }))
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
      if (!user) return

      const channel = supabase
        .channel('notifications-realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'gp_notifications',
            filter: `user_id=eq.${user.id}`,
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
      .update({ read: true })
      .eq('id', id)

    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n),
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
  }, [])

  const markAllRead = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false)

    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }, [])

  return { notifications, unreadCount, loading, markRead, markAllRead }
}
