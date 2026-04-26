import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { SpicedJson, SpinJson, ChallengerJson, BehaviorSignalsJson, ConsolidatedJson } from '../types/database'

export interface StudyCall {
  id: string
  title: string
  happenedAt: string
  closerEmail: string
  spicedTotal: number | null
  spicedS: number | null
  spicedP: number | null
  spicedI: number | null
  spicedC: number | null
  spicedD: number | null
  // Calculated
  weakestDimension: string | null
  studyPlan: StudyExercise[]
  // Rich analysis (from JSONB columns — null when not yet populated)
  coaching: CoachingData | null
  sellerProfile: string | null
  dealRisk: string | null
  topStrength: string | null
  topGap: string | null
}

export interface CoachingData {
  /** Primary dimension to focus on */
  focusDimension: string
  recommendation: string
  techniqueSuggested: string
  exampleQuestion: string
  /** Top missed SPIN questions */
  topMissedQuestions: string[]
  /** Deal next steps from SPICED */
  dealNextSteps: string[]
}

export interface StudyExercise {
  dimension: string
  score: number
  title: string
  description: string
  actionItems: string[]
  tag: 'critico' | 'melhorar' | 'manter'
  /** Key excerpt from the actual call (from spiced_json) */
  keyExcerpt?: string | null
  /** Gaps identified for this dimension */
  gaps?: string[]
}

const DIMENSION_LABELS: Record<string, string> = {
  S: 'Situation',
  P: 'Pain',
  I: 'Impact',
  C: 'Critical Event',
  D: 'Decision',
}

// ── Fallback templates (used when JSON is not yet populated) ──────────────────

const STUDY_TEMPLATES: Record<string, { title: string; description: string; actions: string[] }> = {
  S: {
    title: 'Qualificação de Situação',
    description: 'Você não mapeou suficientemente o contexto atual do cliente. Entender a situação é base para tudo.',
    actions: [
      'Prepare 3 perguntas abertas sobre o cenário atual antes de cada call',
      'Use a técnica "Como está hoje X?" para mapear processos existentes',
      'Documente métricas atuais do cliente antes de entrar em soluções',
    ],
  },
  P: {
    title: 'Identificação de Dor',
    description: 'A dor do cliente não ficou clara o suficiente. Sem dor bem definida, não há urgência de compra.',
    actions: [
      'Pergunte "O que acontece se isso não for resolvido?" em cada call',
      'Aprofunde com "Há quanto tempo isso impacta vocês?" para evidenciar custo da inação',
      'Escute os pontos de frustração e reflita de volta: "Então o principal problema é X?"',
    ],
  },
  I: {
    title: 'Amplificação de Impacto',
    description: 'O impacto financeiro/estratégico não foi quantificado. O cliente precisa ver o custo real do problema.',
    actions: [
      'Peça números: "Quanto isso custa por mês em horas/receita perdida?"',
      'Calcule ROI junto com o cliente durante a call',
      'Conecte a dor a um objetivo de negócio maior: "Isso impede vocês de atingir X?"',
    ],
  },
  C: {
    title: 'Evento Crítico / Urgência',
    description: 'Não ficou claro por que o cliente precisa agir AGORA. Sem senso de urgência, deals não fecham.',
    actions: [
      'Pergunte "Existe algum prazo, meta ou evento que torna isso urgente?"',
      'Identifique datas-chave: lançamentos, avaliações, renovações',
      'Conecte a solução ao evento: "Se fecharmos em X, vocês conseguem Y antes de Z"',
    ],
  },
  D: {
    title: 'Mapeamento de Decisão',
    description: 'O processo de decisão e os stakeholders não foram mapeados. Você pode estar falando com a pessoa errada.',
    actions: [
      'Pergunte "Além de você, quem mais precisa estar alinhado para essa decisão?"',
      'Entenda o processo: "Como vocês normalmente tomam esse tipo de decisão?"',
      'Mapeie objeções antecipadas: "O que poderia impedir isso de avançar?"',
    ],
  },
}

// ── Map SPICED dimension key to spiced_json.scores key ────────────────────────

const DIM_TO_SPICED_KEY: Record<string, string> = {
  S: 'situation',
  P: 'pain',
  I: 'impact',
  C: 'critical_event',
  D: 'decision',
}

function buildStudyPlan(
  scores: { S: number | null; P: number | null; I: number | null; C: number | null; D: number | null },
  spicedJson: SpicedJson | null,
): StudyExercise[] {
  const dims = ['S', 'P', 'I', 'C', 'D'] as const

  return dims
    .filter(d => scores[d] != null)
    .sort((a, b) => (scores[a] ?? 10) - (scores[b] ?? 10))
    .map(dim => {
      const score = scores[dim] ?? 0
      const tag: StudyExercise['tag'] = score < 5 ? 'critico' : score < 7.5 ? 'melhorar' : 'manter'
      const tmpl = STUDY_TEMPLATES[dim]

      // Use rich JSON data when available
      const spicedKey = DIM_TO_SPICED_KEY[dim]
      const detail = spicedJson?.scores?.[spicedKey]

      const description = detail?.justification ?? tmpl.description
      const gaps = detail?.gaps ?? []
      const keyExcerpt = detail?.key_excerpt ?? null

      // Action items: prefer gaps as actionable items, fall back to template
      const actionItems = gaps.length > 0
        ? gaps.slice(0, 3).map((g: string) => `Trabalhar: ${g}`)
        : tmpl.actions

      return {
        dimension: DIMENSION_LABELS[dim],
        score,
        title: tmpl.title,
        description,
        actionItems,
        tag,
        keyExcerpt,
        gaps,
      }
    })
}

function getWeakest(scores: { S: number | null; P: number | null; I: number | null; C: number | null; D: number | null }): string | null {
  const dims = ['S', 'P', 'I', 'C', 'D'] as const
  let min: string | null = null
  let minVal = Infinity
  for (const d of dims) {
    const v = scores[d]
    if (v != null && v < minVal) { minVal = v; min = DIMENSION_LABELS[d] }
  }
  return min
}

function extractCoaching(
  spicedJson: SpicedJson | null,
  spinJson: SpinJson | null,
): CoachingData | null {
  if (!spicedJson && !spinJson) return null

  const spicedCoach = spicedJson?.coaching_recommendation
  const spinCoach = spinJson?.coaching_priority

  // Prefer SPICED coaching as primary (it's the main framework)
  if (!spicedCoach && !spinCoach) return null

  return {
    focusDimension: spicedCoach?.dimension_focus ?? spinCoach?.weakest_category ?? '—',
    recommendation: spicedCoach?.recommendation ?? spinCoach?.recommendation ?? '',
    techniqueSuggested: spicedCoach?.technique_suggested ?? spinCoach?.technique_suggested ?? '',
    exampleQuestion: spicedCoach?.example_question ?? spinCoach?.example_question ?? '',
    topMissedQuestions: spinJson?.top_missed_questions ?? [],
    dealNextSteps: spicedJson?.deal_next_steps ?? [],
  }
}

export function usePDIStudyCalls(closerEmailParam?: string) {
  const { user } = useAuth()
  const [calls, setCalls] = useState<StudyCall[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const closerEmail = closerEmailParam || user?.email || ''

  useEffect(() => {
    if (!closerEmail) { setLoading(false); return }

    async function load() {
      setLoading(true)
      setError(null)
      try {
        // Query 1: buscar calls do vendedor
        const { data: callsData, error: callsErr } = await supabase
          .from('calls')
          .select('id, call_date, seller_email, prospect_name')
          .eq('seller_email', closerEmail)
          .order('call_date', { ascending: false })
          .limit(20)

        if (callsErr) throw callsErr

        const ids = (callsData ?? []).map((c: Record<string, unknown>) => c.id as string)

        // Query 2: buscar scores das calls encontradas
        const callIdToScores: Record<string, Record<string, unknown>> = {}
        if (ids.length > 0) {
          const { data: scoresData, error: scoresErr } = await supabase
            .from('framework_scores')
            .select('call_id, spiced_total, spiced_situation, spiced_pain, spiced_impact, spiced_critical_event, spiced_decision')
            .in('call_id', ids)

          if (scoresErr) throw scoresErr

          for (const row of (scoresData ?? [])) {
            callIdToScores[(row as Record<string, unknown>).call_id as string] = row as Record<string, unknown>
          }
        }

        // Unir e descartar calls sem scores
        const result = ((callsData ?? []) as Record<string, unknown>[])
          .map((row): StudyCall | null => {
            const s = callIdToScores[row.id as string] ?? null
            if (!s) return null

            const rawScores = {
              S: s.spiced_situation as number | null,
              P: s.spiced_pain as number | null,
              I: s.spiced_impact as number | null,
              C: s.spiced_critical_event as number | null,
              D: s.spiced_decision as number | null,
            }

            return {
              id: row.id as string,
              title: (row.prospect_name as string) || 'Call sem título',
              happenedAt: row.call_date as string,
              closerEmail: row.seller_email as string,
              spicedTotal: s.spiced_total as number | null,
              spicedS: rawScores.S,
              spicedP: rawScores.P,
              spicedI: rawScores.I,
              spicedC: rawScores.C,
              spicedD: rawScores.D,
              weakestDimension: getWeakest(rawScores),
              studyPlan: buildStudyPlan(rawScores, null),
              coaching: extractCoaching(null, null),
              sellerProfile: null,
              dealRisk: null,
              topStrength: null,
              topGap: null,
            }
          })
          .filter((r): r is StudyCall => r !== null)

        setCalls(result)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao carregar sessões')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [closerEmail])

  return { calls, loading, error }
}
