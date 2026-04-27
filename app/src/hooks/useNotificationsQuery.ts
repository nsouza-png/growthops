/**
 * useNotificationsQuery - hook otimizado com React Query
 * Substitui useNotifications com cache inteligente e debounce
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useState, useEffect, useRef } from 'react'

export interface Notification {
  id: string
  user_email: string
  type: 'feedback' | 'assignment' | 'critical_call'
  title: string
  body: string | null
  related_id: string | null
  read: boolean
  created_at: string
  call_id?: string | null
  snippet_id?: string | null
}

// Query keys for cache management
export const notificationsKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationsKeys.all, 'list'] as const,
  list: (userEmail: string) => [...notificationsKeys.lists(), userEmail] as const,
  details: () => [...notificationsKeys.all, 'detail'] as const,
  detail: (id: string) => [...notificationsKeys.details(), id] as const,
  unreadCount: (userEmail: string) => [...notificationsKeys.all, 'unreadCount', userEmail] as const,
}

// Fetch notifications with debounce
async function fetchNotifications(userEmail: string): Promise<Notification[]> {
  const { data, error } = await supabase
    
    .from('notifications')
    .select('*')
    .eq('user_email', userEmail)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) throw error

  // DB contract: kind/is_read/user_email. UI contract: type/read.
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

  return mapped
}

// Hook for fetching notifications with cache and debounce
export function useNotificationsQuery() {
  const [debouncedUserEmail, setDebouncedUserEmail] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Get current user
  const authQuery = useQuery({
    queryKey: ['auth-user'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser()
      return { user: data.user }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
  const user = authQuery.data?.user

  // Debounce user email changes
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    const userEmail = user?.email?.toLowerCase().trim()
    if (userEmail) {
      debounceRef.current = setTimeout(() => {
        setDebouncedUserEmail(userEmail)
      }, 300) // 300ms debounce
    } else {
      setDebouncedUserEmail(null)
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [user?.email])

  const result = useQuery({
    queryKey: notificationsKeys.list(debouncedUserEmail || ''),
    queryFn: () => fetchNotifications(debouncedUserEmail || ''),
    enabled: !!debouncedUserEmail,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    // Enable real-time updates via subscription
    refetchInterval: 30 * 1000, // 30 seconds
  })

  // Calculate unread count
  const unreadCount = (result.data as Notification[] | undefined)?.filter((n: Notification) => !n.read).length || 0

  // Separate query for unread count (more efficient for updates)
  const unreadCountQuery = useQuery({
    queryKey: notificationsKeys.unreadCount(debouncedUserEmail || ''),
    queryFn: async () => {
      if (!debouncedUserEmail) return 0

      const { data } = await supabase
        
        .from('notifications')
        .select('id')
        .eq('user_email', debouncedUserEmail)
        .eq('is_read', false)

      return data?.length || 0
    },
    enabled: !!debouncedUserEmail,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 15 * 1000, // 15 seconds
  })

  return {
    ...result,
    unreadCount: unreadCountQuery.data || unreadCount,
    isLoading: result.isLoading || unreadCountQuery.isLoading,
  }
}

// Hook for marking notifications as read
export function useMarkNotificationRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ notificationId, read = true }: { notificationId: string; read?: boolean }) => {
      const { data, error } = await supabase
        
        .from('notifications')
        .update({ is_read: read })
        .eq('id', notificationId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (updatedNotification) => {
      // Update the cached notification
      queryClient.setQueryData(
        notificationsKeys.detail(updatedNotification.id),
        updatedNotification
      )

      // Invalidate unread count
      queryClient.invalidateQueries({
        queryKey: notificationsKeys.unreadCount(
          updatedNotification.user_email
        )
      })

      // Update the notification in the list
      queryClient.setQueriesData(
        { queryKey: notificationsKeys.lists() },
        (oldData: Notification[] | undefined) => {
          if (!oldData) return oldData
          return oldData.map(n =>
            n.id === updatedNotification.id
              ? { ...n, read: Boolean(updatedNotification.is_read) }
              : n
          )
        }
      )
    },
  })
}

// Hook for marking all notifications as read
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userEmail: string) => {
      const { data, error } = await supabase
        
        .from('notifications')
        .update({ is_read: true })
        .eq('user_email', userEmail)
        .eq('is_read', false)

      if (error) throw error
      return data
    },
    onSuccess: (_, userEmail) => {
      // Invalidate unread count
      queryClient.invalidateQueries({
        queryKey: notificationsKeys.unreadCount(userEmail)
      })

      // Update all notifications in cache
      queryClient.setQueriesData(
        { queryKey: notificationsKeys.lists() },
        (oldData: Notification[] | undefined) => {
          if (!oldData) return oldData
          return oldData.map(n =>
            n.user_email === userEmail ? { ...n, read: true } : n
          )
        }
      )
    },
  })
}

// Hook for prefetching notifications
export function usePrefetchNotifications() {
  const queryClient = useQueryClient()

  return (userEmail: string) => {
    queryClient.prefetchQuery({
      queryKey: notificationsKeys.list(userEmail),
      queryFn: () => fetchNotifications(userEmail),
      staleTime: 2 * 60 * 1000,
    })
  }
}
