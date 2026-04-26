// ── GrowthPlatform formatters & utility helpers ───────────────────────────────

import type { GrowthPlatformCall, GPScoreBand } from '../types'

// ── Score formatting ──────────────────────────────────────────────────────────

export function formatScore(score: number | null | undefined, decimals = 1): string {
  if (score == null) return '–'
  return score.toFixed(decimals)
}

export function formatScorePct(pct: number | null | undefined): string {
  if (pct == null) return '–'
  return `${Math.round(pct)}%`
}

/** Maps a 0-100 percentage score to a band label */
export function scoreToband(pct: number | null | undefined): GPScoreBand | null {
  if (pct == null) return null
  if (pct >= 80) return 'excelente'
  if (pct >= 60) return 'bom'
  if (pct >= 40) return 'regular'
  return 'fraco'
}

export const BAND_COLORS: Record<GPScoreBand, string> = {
  excelente: 'text-green-400',
  bom:       'text-blue-400',
  regular:   'text-yellow-400',
  fraco:     'text-red-400',
}

export const BAND_BG_COLORS: Record<GPScoreBand, string> = {
  excelente: 'bg-green-500/10 border-green-500/30',
  bom:       'bg-blue-500/10 border-blue-500/30',
  regular:   'bg-yellow-500/10 border-yellow-500/30',
  fraco:     'bg-red-500/10 border-red-500/30',
}

// ── Talk ratio ────────────────────────────────────────────────────────────────

/** Returns whether talk ratio is healthy (seller < 60%) */
export function isTalkRatioHealthy(sellerPct: number | null | undefined): boolean | null {
  if (sellerPct == null) return null
  return sellerPct < 60
}

export function formatTalkRatio(sellerPct: number | null | undefined): string {
  if (sellerPct == null) return '–'
  return `${Math.round(sellerPct)}% / ${Math.round(100 - sellerPct)}%`
}

// ── Date formatting ───────────────────────────────────────────────────────────

export function formatCallDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '–'
  const d = new Date(dateStr)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatRelativeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '–'
  const now = new Date()
  const d = new Date(dateStr)
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'hoje'
  if (diffDays === 1) return 'ontem'
  if (diffDays < 7) return `${diffDays}d atrás`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}sem atrás`
  return `${Math.floor(diffDays / 30)}m atrás`
}

// ── Duration ──────────────────────────────────────────────────────────────────

export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null) return '–'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0) return `${m}min`
  return `${h}h${m > 0 ? ` ${m}min` : ''}`
}

// ── Currency ──────────────────────────────────────────────────────────────────

export function formatARR(arr: number | null | undefined): string {
  if (arr == null) return '–'
  if (arr >= 1_000_000) return `R$ ${(arr / 1_000_000).toFixed(1)}M`
  if (arr >= 1_000) return `R$ ${(arr / 1_000).toFixed(0)}K`
  return `R$ ${arr.toFixed(0)}`
}

// ── Segment ───────────────────────────────────────────────────────────────────

export const SEGMENT_LABELS: Record<string, string> = {
  Enterprise:  'Enterprise',
  'Mid-Market': 'Mid-Market',
  SMB:         'SMB',
}

// ── Framework labels ──────────────────────────────────────────────────────────

export const SPICED_DIMENSION_LABELS: Record<string, string> = {
  situation:      'Situação',
  pain:           'Dor',
  impact:         'Impacto',
  critical_event: 'Evento Crítico',
  decision:       'Decisão',
  delivery:       'Entrega',
}

// ── Averages ──────────────────────────────────────────────────────────────────

export function avgSpiced(calls: GrowthPlatformCall[]): number | null {
  const scores = calls
    .map(c => c.framework_scores?.spiced_total)
    .filter((v): v is number => v !== null)
  if (scores.length === 0) return null
  return scores.reduce((a, b) => a + b, 0) / scores.length
}

export function avgSpicedPct(calls: GrowthPlatformCall[]): number | null {
  const scores = calls
    .map(c => c.framework_scores?.spiced_pct)
    .filter((v): v is number => v !== null)
  if (scores.length === 0) return null
  return scores.reduce((a, b) => a + b, 0) / scores.length
}

export function avgTalkRatio(calls: GrowthPlatformCall[]): number | null {
  const ratios = calls
    .map(c => c.behavior_signals?.talk_ratio_seller_pct)
    .filter((v): v is number => v !== null)
  if (ratios.length === 0) return null
  return ratios.reduce((a, b) => a + b, 0) / ratios.length
}

// ── Score evolution for charts ────────────────────────────────────────────────

export interface GPScorePoint {
  date: string      // ISO date
  spiced: number | null
  spin: number | null
  challenger: number | null
  behavior: number | null
}

export function buildScoreEvolution(calls: GrowthPlatformCall[]): GPScorePoint[] {
  return calls
    .filter(c => c.call_date && c.framework_scores)
    .sort((a, b) => new Date(a.call_date!).getTime() - new Date(b.call_date!).getTime())
    .map(c => {
      const fs = c.framework_scores
      // spiced_pct is 0-100 (chart domain); fall back to spiced_total*10 if pct missing
      const spiced = fs?.spiced_pct != null
        ? fs.spiced_pct
        : fs?.spiced_total != null ? fs.spiced_total * 10 : null
      // spin/challenger are 0-10; multiply by 10 to align with 0-100 domain
      const spin = fs?.spin_total_score != null ? fs.spin_total_score * 10 : null
      const challenger = fs?.challenger_total != null ? fs.challenger_total * 10 : null
      return {
        date:       c.call_date!,
        spiced,
        spin,
        challenger,
        behavior:   c.behavior_signals?.unified_score ?? null,
      }
    })
}
