/**
 * Centralized InsightRow type and related constants
 * This file replaces duplicate definitions across multiple components
 */

export interface InsightRow {
  id: number
  vendedor: string | null
  lead: string | null
  perfil_do_lead: string | null
  data: string | null
  score_geral: number | null
  temperatura_identificada: string | null
  resumo: string | null
  principais_acertos: string | null
  pontos_de_melhoria: string | null
  proximos_passos: string | null
  abertura_e_alinhamento: string | null
  abertura_e_alinhamento_pp: number | null
  motivo_abertura_e_alinhamento: string | null
  situation: string | null
  situation_pp: number | null
  motivo_situation: string | null
  pain: string | null
  pain_pp: number | null
  motivo_pain: string | null
  impact: string | null
  impact_pp: number | null
  motivo_impact: string | null
  critical_event_emotion: string | null
  critical_event_emotion_pp: number | null
  motivo_critical_event_emotion: string | null
  delivery: string | null
  delivery_pp: number | null
  motivo_delivery: string | null
  conducao_fechamento: string | null
  conducao_fechamento_pp: number | null
  motivo_conducao_fechamento: string | null
  objecoes: string | null
  objecoes_pp: number | null
  motivo_objecoes: string | null
  deal_id: string | null
  meetingId: string | null
  nota_conversao: number | null
  call_name: string | null
  status_do_deal: string | null
  moderada: boolean | null
  segmento_lead: string | null
  produto_oferecido: string | null
  created_at: string
  sort_date?: string | null
  spiced_total?: number | null
}

export const SPICED_DIMS = [
  { key: 'abertura_e_alinhamento_pp', label: 'Abertura' },
  { key: 'situation_pp', label: 'Situation' },
  { key: 'pain_pp', label: 'Pain' },
  { key: 'impact_pp', label: 'Impact' },
  { key: 'critical_event_emotion_pp', label: 'C+E' },
  { key: 'delivery_pp', label: 'Delivery' },
  { key: 'conducao_fechamento_pp', label: 'Fechamento' },
  { key: 'objecoes_pp', label: 'Objeções' },
] as const

export const SELECT_COLS = [
  'id', 'vendedor', 'lead', 'perfil_do_lead', 'data', 'score_geral',
  'temperatura_identificada', 'resumo', 'principais_acertos', 'pontos_de_melhoria',
  'proximos_passos', 'abertura_e_alinhamento', 'abertura_e_alinhamento_pp',
  'motivo_abertura_e_alinhamento', 'situation', 'situation_pp', 'motivo_situation',
  'pain', 'pain_pp', 'motivo_pain', 'impact', 'impact_pp', 'motivo_impact',
  'critical_event_emotion', 'critical_event_emotion_pp', 'motivo_critical_event_emotion',
  'delivery', 'delivery_pp', 'motivo_delivery', 'conducao_fechamento',
  'conducao_fechamento_pp', 'motivo_conducao_fechamento', 'objecoes', 'objecoes_pp',
  'motivo_objecoes', 'deal_id', '"meetingId"', 'nota_conversao', 'call_name',
  'status_do_deal', 'moderada', 'segmento_lead', 'produto_oferecido',
].join(',')

// Parse date from "dd/mm/yyyy hh:mm:ss" to ISO
export function parseBRDate(d: string | null): Date | null {
  if (!d) return null
  const [datePart] = d.split(' ')
  if (!datePart) return null
  const parts = datePart.split('/')
  if (parts.length !== 3) return null
  const [dd, mm, yyyy] = parts
  if (!dd || !mm || !yyyy || yyyy.length !== 4) return null
  const day = parseInt(dd, 10)
  const month = parseInt(mm, 10)
  const year = parseInt(yyyy, 10)
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  // Use setFullYear to avoid JS treating years 0-99 as 1900+year
  const date = new Date(0)
  date.setFullYear(year, month - 1, day)
  // Validate: if JS rolled the date over (e.g. Feb 29 in non-leap year → Mar 1),
  // the constructed date's components won't match the input.
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) return null
  return date
}

export interface InsightsOptions {
  limit?: number
  vendedor?: string | null   // filter by vendedor name
  daysAgo?: number | null    // filter by period
}
