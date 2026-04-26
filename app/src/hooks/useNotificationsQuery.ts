/**
 * useNotificationsQuery - hook otimizado com React Query
 * Substitui useNotifications com cache inteligente e debounce
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useState, useEffect, useRef } from 'react'

export interface Notification {
  id: string
  user_id: string
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
  list: (userId: string) => [...notificationsKeys.lists(), userId] as const,
  details: () => [...notificationsKeys.all, 'detail'] as const,
  detail: (id: string) => [...notificationsKeys.details(), id] as const,
  unreadCount: (userId: string) => [...notificationsKeys.all, 'unreadCount', userId] as const,
}

// Fetch notifications with debounce
async function fetchNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) throw error

  // Map related_id to call_id/snippet_id based on type
  const mapped: Notification[] = (data as Notification[]).map((n) => ({
    ...n,
    call_id: n.type === 'feedback' || n.type === 'critical_call' ? n.related_id : null,
    snippet_id: n.type === 'assignment' ? n.related_id : null,
  }))

  return mapped
}

// Hook for fetching notifications with cache and debounce
export function useNotificationsQuery() {
  const [debouncedUserId, setDebouncedUserId] = useState<string | null>(null)
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

  // Debounce user ID changes
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (user?.id) {
      debounceRef.current = setTimeout(() => {
        setDebouncedUserId(user.id)
      }, 300) // 300ms debounce
    } else {
      setDebouncedUserId(null)
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [user?.id])

  const result = useQuery({
    queryKey: notificationsKeys.list(debouncedUserId || ''),
    queryFn: () => fetchNotifications(debouncedUserId || ''),
    enabled: !!debouncedUserId,
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
    queryKey: notificationsKeys.unreadCount(debouncedUserId || ''),
    queryFn: async () => {
      if (!debouncedUserId) return 0

      const { data } = await supabase
        
        .from('notifications')
        .select('id')
        .eq('user_id', debouncedUserId)
        .eq('read', false)

      return data?.length || 0
    },
    enabled: !!debouncedUserId,
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
        .update({ read })
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
          updatedNotification.user_id
        )
      })

      // Update the notification in the list
      queryClient.setQueriesData(
        { queryKey: notificationsKeys.lists() },
        (oldData: Notification[] | undefined) => {
          if (!oldData) return oldData
          return oldData.map(n =>
            n.id === updatedNotification.id
              ? { ...n, read: updatedNotification.read }
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
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase
        
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false)

      if (error) throw error
      return data
    },
    onSuccess: (_, userId) => {
      // Invalidate unread count
      queryClient.invalidateQueries({
        queryKey: notificationsKeys.unreadCount(userId)
      })

      // Update all notifications in cache
      queryClient.setQueriesData(
        { queryKey: notificationsKeys.lists() },
        (oldData: Notification[] | undefined) => {
          if (!oldData) return oldData
          return oldData.map(n =>
            n.user_id === userId ? { ...n, read: true } : n
          )
        }
      )
    },
  })
}

// Hook for prefetching notifications
export function usePrefetchNotifications() {
  const queryClient = useQueryClient()

  return (userId: string) => {
    queryClient.prefetchQuery({
      queryKey: notificationsKeys.list(userId),
      queryFn: () => fetchNotifications(userId),
      staleTime: 2 * 60 * 1000,
    })
  }
}
