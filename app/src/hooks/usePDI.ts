import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export interface FocusArea {
  id: string
  priority: 1 | 2 | 3
  dimension: string
  currentScore: number
  targetScore: number
  description: string
}

export interface SprintGoal {
  id: string
  goalText: string
  completed: boolean
  sprintWeek: string
}

export interface PDIData {
  closerEmail: string
  closerName: string
  currentScore: number
  squadAvgScore: number
  weeklyScores: { week: string; score: number; squadAvg: number }[]
  focusAreas: FocusArea[]
  sprintGoals: SprintGoal[]
}

export function usePDI(closerEmailParam?: string) {
  const { user } = useAuth()
  const [data, setData] = useState<PDIData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const closerEmail = closerEmailParam || user?.email || ''

  useEffect(() => {
    if (!closerEmail) {
      setLoading(false)
      return
    }

    async function load() {
      setLoading(true)
      setError(null)

      try {
        // Fetch last 8 weeks of scores for this closer vs squad avg
        const eightWeeksAgo = new Date()
        eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56)
        const sinceIso = eightWeeksAgo.toISOString()

        // Canonical schema: calls has seller_email; framework_scores links via call_id.
        const { data: callsRaw } = await supabase
          .from('calls')
          .select('id, seller_email, created_at')
          .gte('created_at', sinceIso)

        const [
          { data: frameworkScoresRaw },
          { data: focusAreasRaw },
          { data: sprintGoalsRaw },
          { data: profileRaw },
        ] = await Promise.all([
          supabase
            
            .from('framework_scores')
            .select('call_id, spiced_total, created_at')
            .in('call_id', (callsRaw ?? []).map(c => c.id)),
          supabase
            
            .from('pdi_focus_areas')
            .select('*')
            .eq('seller_email', closerEmail)
            .order('created_at', { ascending: true }),
          supabase
            
            .from('pdi_sprint_goals')
            .select('*')
            .eq('seller_email', closerEmail)
            .order('created_at', { ascending: true }),
          supabase
            
            .from('user_roles')
            .select('preferred_name, email')
            .eq('email', closerEmail)
            .maybeSingle(),
        ])

        // Build weekly buckets for the last 8 weeks
        const now = new Date()
        const weeklyMap: Record<string, { closerScores: number[]; squadScores: number[] }> = {}

        for (let i = 7; i >= 0; i--) {
          const weekStart = new Date(now)
          weekStart.setDate(now.getDate() - i * 7 - now.getDay())
          weekStart.setHours(0, 0, 0, 0)
          const key = `Sem ${8 - i}`
          weeklyMap[key] = { closerScores: [], squadScores: [] }
        }

        const weekKeys = Object.keys(weeklyMap)
        const callOwnerById = new Map((callsRaw ?? []).map(c => [String(c.id), String(c.seller_email || '').toLowerCase()]))
        const frameworkRows = (frameworkScoresRaw ?? []) as Array<{ call_id: string; spiced_total: number | null; created_at: string }>
        const closerScoresRaw = frameworkRows.filter(r => callOwnerById.get(String(r.call_id)) === closerEmail.toLowerCase())
        const squadScoresRaw = frameworkRows

        function getWeekIndex(dateStr: string): number {
          const d = new Date(dateStr)
          const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
          const weekIndex = Math.floor(diffDays / 7)
          if (weekIndex < 0 || weekIndex > 7) return -1
          return 7 - weekIndex
        }

        for (const row of (closerScoresRaw ?? []) as { spiced_total: number | null; created_at: string }[]) {
          const idx = getWeekIndex(row.created_at)
          if (idx >= 0 && idx < weekKeys.length && row.spiced_total != null) {
            weeklyMap[weekKeys[idx]].closerScores.push(row.spiced_total)
          }
        }

        for (const row of (squadScoresRaw ?? []) as { spiced_total: number | null; created_at: string }[]) {
          const idx = getWeekIndex(row.created_at)
          if (idx >= 0 && idx < weekKeys.length && row.spiced_total != null) {
            weeklyMap[weekKeys[idx]].squadScores.push(row.spiced_total)
          }
        }

        const avg = (arr: number[]) =>
          arr.length ? parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : 0

        const weeklyScores = weekKeys.map(week => ({
          week,
          score: avg(weeklyMap[week].closerScores),
          squadAvg: avg(weeklyMap[week].squadScores),
        }))

        // Current score = avg of most recent week with data, or overall avg
        const allCloserScores = (closerScoresRaw ?? []) as { spiced_total: number | null }[]
        const allSquadScores = (squadScoresRaw ?? []) as { spiced_total: number | null }[]

        const currentScore = avg(
          allCloserScores
            .map(r => r.spiced_total)
            .filter((v): v is number => v != null),
        )
        const squadAvgScore = avg(
          allSquadScores
            .map(r => r.spiced_total)
            .filter((v): v is number => v != null),
        )

        // Map focus areas
        const focusAreas: FocusArea[] = (focusAreasRaw ?? []).map(
          (r: Record<string, unknown>, idx: number) => ({
            id: r.id as string,
            priority: ((idx + 1) as 1 | 2 | 3),
            dimension: (r.area as string) ?? 'Área de foco',
            currentScore: 0,
            targetScore: 10,
            description: (r.status as string) ?? '',
          }),
        )

        // Map sprint goals — current week only
        const currentWeekStart = new Date(now)
        currentWeekStart.setDate(now.getDate() - now.getDay())
        currentWeekStart.setHours(0, 0, 0, 0)

        const sprintGoals: SprintGoal[] = (sprintGoalsRaw ?? [])
          .filter((r: Record<string, unknown>) => {
            const sprintWeek = r.sprint_week as string
            if (!sprintWeek) return true
            return sprintWeek >= currentWeekStart.toISOString().split('T')[0]
          })
          .map((r: Record<string, unknown>) => ({
            id: r.id as string,
            goalText: (r.goal as string) ?? '',
            completed: String(r.status ?? '').toLowerCase() === 'completed' || String(r.status ?? '').toLowerCase() === 'done',
            sprintWeek: (r.due_date as string) ?? '',
          }))

        const profile = profileRaw as { preferred_name?: string | null; email?: string | null } | null
        const closerName = profile?.preferred_name || closerEmail.split('@')[0]

        setData({
          closerEmail,
          closerName,
          currentScore,
          squadAvgScore,
          weeklyScores,
          focusAreas,
          sprintGoals,
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao carregar PDI')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [closerEmail])

  async function toggleGoal(goalId: string, completed: boolean) {
    await supabase
      
      .from('pdi_sprint_goals')
      .update({ status: completed ? 'completed' : 'pending' })
      .eq('id', goalId)

    setData(prev =>
      prev
        ? {
          ...prev,
          sprintGoals: prev.sprintGoals.map(g =>
            g.id === goalId ? { ...g, completed } : g,
          ),
        }
        : prev,
    )
  }

  async function addGoal(goalText: string) {
    if (!closerEmail) return
    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay())
    const sprintWeek = weekStart.toISOString().split('T')[0]

    const { data: inserted } = await supabase
      
      .from('pdi_sprint_goals')
      .insert({ seller_email: closerEmail, goal: goalText, status: 'pending', due_date: sprintWeek })
      .select()
      .single()

    if (inserted) {
      const row = inserted as Record<string, unknown>
      setData(prev =>
        prev
          ? {
            ...prev,
            sprintGoals: [
              ...prev.sprintGoals,
              {
                id: row.id as string,
                goalText: row.goal as string,
                completed: false,
                sprintWeek: (row.due_date as string) ?? sprintWeek,
              },
            ],
          }
          : prev,
      )
    }
  }

  return { data, loading, error, toggleGoal, addGoal }
}
