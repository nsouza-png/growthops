/**
 * useGlobalSearch - hook para busca global across calls, snippets e feedback
 * Implementa busca textual com filtros avançados e destaque de termos
 */
import { useState, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useRole } from '../contexts/RoleContext'
import type { Database } from '../types/database'

export interface SearchResult {
  id: string
  type: 'call' | 'snippet' | 'feedback'
  title: string
  content: string
  metadata: {
    callId?: string
    snippetId?: string
    feedbackId?: string
    vendedor?: string | null
    lead?: string | null
    data?: string | null
    score?: number | null
    created_at: string
  }
  highlights: string[]
}

export interface SearchFilters {
  type?: 'all' | 'call' | 'snippet' | 'feedback'
  vendedor?: string
  daysAgo?: number
  scoreMin?: number
  scoreMax?: number
}

export function useGlobalSearch() {
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalFound, setTotalFound] = useState(0)
  const { viewedRole, simulatedCloser } = useRole()

  const search = useCallback(async (query: string, filters: SearchFilters = {}) => {
    if (!query.trim()) {
      setResults([])
      setTotalFound(0)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const searchResults: SearchResult[] = []
      const searchTerm = query.trim().toLowerCase()

      // Search in calls/insights
      if (filters.type === 'all' || filters.type === 'call') {
        let callQuery = supabase

          .from('unified_calls')
          .select('id, vendedor, lead, sort_date, score_geral, resumo, deal_id')
          .or(`resumo.ilike.%${searchTerm}%,lead.ilike.%${searchTerm}%,vendedor.ilike.%${searchTerm}%`)
          .limit(50)

        // Apply role-based filter
        if (viewedRole === 'executivo' && simulatedCloser) {
          callQuery = callQuery.eq('closer_email', simulatedCloser)
        }

        // Apply filters
        if (filters.vendedor) {
          callQuery = callQuery.ilike('vendedor', `%${filters.vendedor}%`)
        }
        if (filters.scoreMin) {
          callQuery = callQuery.gte('score_geral', filters.scoreMin / 10)
        }
        if (filters.scoreMax) {
          callQuery = callQuery.lte('score_geral', filters.scoreMax / 10)
        }
        if (filters.daysAgo) {
          const cutoffDate = new Date()
          cutoffDate.setDate(cutoffDate.getDate() - filters.daysAgo)
          callQuery = callQuery.gte('sort_date', cutoffDate.toISOString())
        }

        const { data: callsData } = await callQuery

        if (callsData) {
          callsData.forEach((call: any) => {
            const highlights = extractHighlights(call, searchTerm)
            searchResults.push({
              id: `call-${call.id}`,
              type: 'call',
              title: `${call.vendedor} - ${call.lead}`,
              content: call.resumo || '',
              metadata: {
                callId: call.id,
                vendedor: call.vendedor,
                lead: call.lead,
                data: call.sort_date,
                score: call.score_geral != null ? call.score_geral * 10 : null,
                created_at: call.sort_date || new Date().toISOString()
              },
              highlights
            })
          })
        }
      }

      // Search in snippets
      if (filters.type === 'all' || filters.type === 'snippet') {
        let snippetQuery = supabase
          
          .from('snippets')
          .select('id, text, tag, call_id, created_by, created_at')
          .or(`text.ilike.%${searchTerm}%,tag.ilike.%${searchTerm}%`)
          .limit(50)

        if (filters.vendedor) {
          snippetQuery = snippetQuery.ilike('created_by', `%${filters.vendedor}%`)
        }
        if (filters.daysAgo) {
          const cutoffDate = new Date()
          cutoffDate.setDate(cutoffDate.getDate() - filters.daysAgo)
          snippetQuery = snippetQuery.gte('created_at', cutoffDate.toISOString())
        }

        const { data: snippetsData } = await snippetQuery

        if (snippetsData) {
          snippetsData.forEach((snippet: any) => {
            const highlights = extractHighlights(snippet, searchTerm)
            searchResults.push({
              id: `snippet-${snippet.id}`,
              type: 'snippet',
              title: snippet.tag || 'Snippet',
              content: snippet.text || '',
              metadata: {
                snippetId: snippet.id,
                callId: snippet.call_id,
                created_at: snippet.created_at
              },
              highlights
            })
          })
        }
      }

      // Search in feedback
      if (filters.type === 'all' || filters.type === 'feedback') {
        let feedbackQuery = supabase
          
          .from('call_feedback')
          .select('id, text, type, call_id, created_at, author_email')
          .or(`text.ilike.%${searchTerm}%`)
          .limit(50)

        if (filters.vendedor) {
          feedbackQuery = feedbackQuery.ilike('author_email', `%${filters.vendedor}%`)
        }
        if (filters.daysAgo) {
          const cutoffDate = new Date()
          cutoffDate.setDate(cutoffDate.getDate() - filters.daysAgo)
          feedbackQuery = feedbackQuery.gte('created_at', cutoffDate.toISOString())
        }

        const { data: feedbackData } = await feedbackQuery

        if (feedbackData) {
          feedbackData.forEach((feedback: any) => {
            const highlights = extractHighlights(feedback, searchTerm)
            searchResults.push({
              id: `feedback-${feedback.id}`,
              type: 'feedback',
              title: `Feedback - ${feedback.type}`,
              content: feedback.text,
              metadata: {
                feedbackId: feedback.id,
                callId: feedback.call_id,
                created_at: feedback.created_at
              },
              highlights
            })
          })
        }
      }

      // Sort by relevance (more highlights = more relevant) and date
      searchResults.sort((a, b) => {
        const scoreDiff = b.highlights.length - a.highlights.length
        if (scoreDiff !== 0) return scoreDiff

        // If same relevance, sort by date (newer first)
        return new Date(b.metadata.created_at).getTime() - new Date(a.metadata.created_at).getTime()
      })

      setResults(searchResults)
      setTotalFound(searchResults.length)
    } catch (err) {
      console.error('Search error:', err)
      setError(err instanceof Error ? err.message : 'Erro na busca')
      setResults([])
      setTotalFound(0)
    } finally {
      setLoading(false)
    }
  }, [viewedRole, simulatedCloser])

  const extractHighlights = (obj: any, searchTerm: string): string[] => {
    const highlights: string[] = []
    const term = searchTerm.toLowerCase()

    Object.values(obj).forEach(value => {
      if (typeof value === 'string' && value.toLowerCase().includes(term)) {
        // Extract snippet around the match
        const index = value.toLowerCase().indexOf(term)
        const start = Math.max(0, index - 50)
        const end = Math.min(value.length, index + searchTerm.length + 50)
        const snippet = value.substring(start, end)
        if (snippet && !highlights.includes(snippet)) {
          highlights.push(snippet)
        }
      }
    })

    return highlights
  }

  const clearResults = useCallback(() => {
    setResults([])
    setTotalFound(0)
    setError(null)
  }, [])

  return {
    results,
    loading,
    error,
    totalFound,
    search,
    clearResults
  }
}
