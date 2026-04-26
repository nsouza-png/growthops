/**
 * useSnippetTracking - hook para tracking de visualização de snippets
 * Implementa completed=true e watch_time_seconds corretamente
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

interface SnippetTrackingOptions {
  snippetId: string
  startTime?: number
  endTime?: number
  onTrackingComplete?: (data: { watchTimeSeconds: number; completed: boolean }) => void
}

export function useSnippetTracking({
  snippetId,
  startTime,
  endTime,
  onTrackingComplete
}: SnippetTrackingOptions) {
  const [isTracking, setIsTracking] = useState(false)
  const [watchTimeSeconds, setWatchTimeSeconds] = useState(0)
  const [completed, setCompleted] = useState(false)
  const trackingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)
  const totalWatchTimeRef = useRef<number>(0)
  const hasCompletedRef = useRef<boolean>(false)

  const startTracking = useCallback(() => {
    if (isTracking || !snippetId) return

    setIsTracking(true)
    startTimeRef.current = Date.now()
    totalWatchTimeRef.current = 0
    hasCompletedRef.current = false

    // Track watch time every second
    trackingIntervalRef.current = setInterval(() => {
      const currentTime = Date.now()
      const sessionTime = (currentTime - startTimeRef.current) / 1000
      totalWatchTimeRef.current = sessionTime
      setWatchTimeSeconds(Math.floor(sessionTime))

      // Check if user watched 80% of the snippet duration
      if (startTime && endTime) {
        const snippetDuration = endTime - startTime
        const watchedPercentage = sessionTime / snippetDuration

        if (watchedPercentage >= 0.8 && !hasCompletedRef.current) {
          hasCompletedRef.current = true
          setCompleted(true)

          // Mark as completed in database
          markAsCompleted()
        }
      }
    }, 1000)
  }, [isTracking, snippetId, startTime, endTime])

  const stopTracking = useCallback(async () => {
    if (!isTracking) return

    setIsTracking(false)

    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current)
      trackingIntervalRef.current = null
    }

    // Update final watch time
    const finalWatchTime = totalWatchTimeRef.current
    setWatchTimeSeconds(Math.floor(finalWatchTime))

    // Update database with final tracking data
    await updateTrackingData(finalWatchTime, completed)

    onTrackingComplete?.({
      watchTimeSeconds: Math.floor(finalWatchTime),
      completed
    })
  }, [isTracking, completed, onTrackingComplete])

  const markAsCompleted = useCallback(async () => {
    if (!snippetId) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Upsert snippet view with completed=true
      await supabase
        
        .from('snippet_views')
        .upsert({
          snippet_id: snippetId,
          user_id: user.id,
          viewed_by_email: user.email ?? null,
          watch_time_seconds: Math.floor(totalWatchTimeRef.current),
          completed: true,
          viewed_at: new Date().toISOString()
        } as Database['public']['Tables']['snippet_views']['Insert'], {
          onConflict: 'snippet_id,user_id'
        })
    } catch (error) {
      console.error('Error marking snippet as completed:', error)
    }
  }, [snippetId])

  const updateTrackingData = useCallback(async (watchTime: number, isCompleted: boolean) => {
    if (!snippetId) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Upsert snippet view with current tracking data
      await supabase
        
        .from('snippet_views')
        .upsert({
          snippet_id: snippetId,
          user_id: user.id,
          viewed_by_email: user.email ?? null,
          watch_time_seconds: Math.floor(watchTime),
          completed: isCompleted,
          viewed_at: new Date().toISOString()
        } as Database['public']['Tables']['snippet_views']['Insert'], {
          onConflict: 'snippet_id,user_id'
        })
    } catch (error) {
      console.error('Error updating snippet tracking data:', error)
    }
  }, [snippetId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current)
      }
    }
  }, [])

  // Auto-stop tracking when component unmounts
  useEffect(() => {
    return () => {
      if (isTracking) {
        stopTracking()
      }
    }
  }, [isTracking, stopTracking])

  return {
    isTracking,
    watchTimeSeconds,
    completed,
    startTracking,
    stopTracking,
    markAsCompleted: markAsCompleted
  }
}

// Hook para verificar se um snippet já foi visualizado
export function useSnippetViewStatus(snippetId: string) {
  const [viewStatus, setViewStatus] = useState<{
    watched: boolean
    watchTimeSeconds: number
    completed: boolean
    viewedAt: string | null
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchViewStatus() {
      if (!snippetId) {
        setLoading(false)
        return
      }

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setLoading(false)
          return
        }

        const { data, error } = await supabase
          
          .from('snippet_views')
          .select('watch_time_seconds, completed, viewed_at')
          .eq('snippet_id', snippetId)
          .eq('user_id', user.id)
          .maybeSingle()
          .returns<Database['public']['Tables']['snippet_views']['Row'] | null>()

        if (!error && data) {
          setViewStatus({
            watched: true,
            watchTimeSeconds: data.watch_time_seconds || 0,
            completed: data.completed || false,
            viewedAt: data.viewed_at ?? null
          })
        } else {
          setViewStatus({
            watched: false,
            watchTimeSeconds: 0,
            completed: false,
            viewedAt: null
          })
        }
      } catch (error) {
        console.error('Error fetching snippet view status:', error)
        setViewStatus(null)
      } finally {
        setLoading(false)
      }
    }

    fetchViewStatus()
  }, [snippetId])

  return { viewStatus, loading }
}
