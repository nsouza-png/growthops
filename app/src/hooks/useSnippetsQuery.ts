/**
 * useSnippetsQuery - hook otimizado com React Query
 * Cache inteligente para snippets com prefetching e invalidação
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

type Snippet = Database['public']['Tables']['snippets']['Row']

// Query keys for cache management
export const snippetsKeys = {
  all: ['snippets'] as const,
  lists: () => [...snippetsKeys.all, 'list'] as const,
  list: (filters: { tag?: string; assignedTo?: string; limit?: number }) =>
    [...snippetsKeys.lists(), filters] as const,
  details: () => [...snippetsKeys.all, 'detail'] as const,
  detail: (id: string) => [...snippetsKeys.details(), id] as const,
  assignments: () => [...snippetsKeys.all, 'assignments'] as const,
  assignment: (snippetId: string) => [...snippetsKeys.assignments(), snippetId] as const,
}

// Fetch snippets with filters
async function fetchSnippets(filters: { tag?: string; assignedTo?: string; limit?: number }): Promise<Snippet[]> {
  // TODO: add deal fields to GP.calls or keep on public.calls
  // Using gp_snippets but keeping calls!inner join on public.calls because deal_id doesn't exist in gp_calls
  let query = supabase
    
    .from('snippets')
    .select(`
      *,
      calls!inner (
        deal_id,
        closer_email,
        lead
      )
    `)
    .order('created_at', { ascending: false })

  if (filters.tag) {
    query = query.eq('tag', filters.tag)
  }

  if (filters.assignedTo) {
    query = query.eq('assigned_to', filters.assignedTo)
  }

  if (filters.limit) {
    query = query.limit(filters.limit)
  }

  const { data, error } = await query

  if (error) throw error
  return (data || []) as unknown as Snippet[]
}

// Hook for fetching snippets with cache
export function useSnippetsQuery(filters: { tag?: string; assignedTo?: string; limit?: number } = {}) {
  return useQuery({
    queryKey: snippetsKeys.list(filters),
    queryFn: () => fetchSnippets(filters),
    staleTime: 3 * 60 * 1000, // 3 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    placeholderData: (prev: Snippet[] | undefined) => prev,
    // Enable background refetch every 5 minutes
    refetchInterval: 5 * 60 * 1000,
  })
}

// Hook for fetching a single snippet
export function useSnippetQuery(id: string) {
  return useQuery({
    queryKey: snippetsKeys.detail(id),
    queryFn: async () => {
      // TODO: add deal fields to GP.calls or keep on public.calls
      // Using gp_snippets but keeping calls!inner join on public.calls because deal_id doesn't exist in gp_calls
      const { data, error } = await supabase
        
        .from('snippets')
        .select(`
          *,
          calls!inner (
            deal_id,
            closer_email,
            lead
          )
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      return data as Snippet
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  })
}

// Hook for creating snippets
export function useCreateSnippet() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (snippet: Omit<Snippet, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        
        .from('snippets')
        .insert(snippet)
        .select()
        .single()

      if (error) throw error
      return data as Snippet
    },
    onSuccess: (newSnippet) => {
      // Add to cache
      queryClient.setQueryData(
        snippetsKeys.detail(newSnippet.id),
        newSnippet
      )

      // Invalidate list queries
      queryClient.invalidateQueries({ queryKey: snippetsKeys.lists() })
    },
    onError: (error) => {
      console.error('Failed to create snippet:', error)
    }
  })
}

// Hook for updating snippet assignments
export function useAssignSnippet() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      snippetId,
      assignedTo,
      note
    }: {
      snippetId: string;
      assignedTo: string;
      note?: string
    }) => {
      const { data, error } = await supabase
        
        .from('snippet_assignments')
        .upsert({
          snippet_id: snippetId,
          assigned_to: assignedTo,
          note: note || null,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      // Invalidate snippet detail
      queryClient.invalidateQueries({
        queryKey: snippetsKeys.detail(variables.snippetId)
      })

      // Invalidate list queries
      queryClient.invalidateQueries({ queryKey: snippetsKeys.lists() })

      // Invalidate assignments
      queryClient.invalidateQueries({
        queryKey: snippetsKeys.assignments()
      })
    },
  })
}

// Hook for snippet views tracking
export function useTrackSnippetView() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      snippetId,
      watchTimeSeconds,
      completed
    }: {
      snippetId: string;
      watchTimeSeconds: number;
      completed: boolean
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        
        .from('snippet_views')
        .upsert({
          snippet_id: snippetId,
          user_id: user.id,
          watch_time_seconds: watchTimeSeconds,
          completed,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      // Invalidate snippet detail to update view status
      queryClient.invalidateQueries({
        queryKey: snippetsKeys.detail(variables.snippetId)
      })
    },
  })
}

// Hook for prefetching snippets
export function usePrefetchSnippets() {
  const queryClient = useQueryClient()

  return (filters: { tag?: string; assignedTo?: string; limit?: number }) => {
    queryClient.prefetchQuery({
      queryKey: snippetsKeys.list(filters),
      queryFn: () => fetchSnippets(filters),
      staleTime: 3 * 60 * 1000,
    })
  }
}

// Hook for invalidating snippets cache
export function useInvalidateSnippets() {
  const queryClient = useQueryClient()

  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: snippetsKeys.lists() }),
    invalidateList: (filters: { tag?: string; assignedTo?: string; limit?: number }) =>
      queryClient.invalidateQueries({ queryKey: snippetsKeys.list(filters) }),
    invalidateDetail: (id: string) =>
      queryClient.invalidateQueries({ queryKey: snippetsKeys.detail(id) }),
    prefetch: usePrefetchSnippets(),
  }
}
