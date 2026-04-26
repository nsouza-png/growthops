// ── GPPDIGenerationModal — Generate + persist PDI for a seller ───────────────
import { useState } from 'react'
import { X, BookOpen, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { GrowthPlatformAPI } from '../services/api'
import type { GPPDIContent, GPPDIPriority } from '../types'
import { cn } from '../../../lib/cn'

interface GPPDIGenerationModalProps {
  callId: string
  sellerEmail: string
  onClose: () => void
}

function isPriorityObject(p: unknown): p is GPPDIPriority {
  return typeof p === 'object' && p !== null && 'area' in p
}

function PDIPriorityItem({ priority, index }: { priority: GPPDIPriority | string; index: number }) {
  const [open, setOpen] = useState(index === 0)

  if (!isPriorityObject(priority)) {
    return (
      <div className="flex gap-2 text-sm text-text-secondary">
        <span className="text-text-tertiary font-bold w-4 shrink-0">{index + 1}.</span>
        <span>{String(priority)}</span>
      </div>
    )
  }

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-bg-elevated hover:bg-bg-card transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-text-tertiary w-4">{index + 1}</span>
          <span className="text-sm font-medium text-text-primary">{priority.area}</span>
        </div>
        {open ? <ChevronUp size={13} className="text-text-tertiary" /> : <ChevronDown size={13} className="text-text-tertiary" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 space-y-3 bg-bg-card">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-text-tertiary uppercase tracking-widest text-[10px] mb-1">Nível Atual</p>
              <p className="text-text-secondary">{priority.current_level}</p>
            </div>
            <div>
              <p className="text-text-tertiary uppercase tracking-widest text-[10px] mb-1">Meta</p>
              <p className="text-text-secondary">{priority.target_level}</p>
            </div>
          </div>
          {priority.exercises?.length > 0 && (
            <div>
              <p className="text-text-tertiary uppercase tracking-widest text-[10px] mb-1.5">Exercícios</p>
              <ul className="space-y-1">
                {priority.exercises.map((ex, i) => (
                  <li key={i} className="text-xs text-text-secondary flex gap-2">
                    <span className="text-signal-blue">•</span>{ex}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[10px] text-text-tertiary">
            Timeline: {priority.timeline_weeks} semanas
          </p>
        </div>
      )}
    </div>
  )
}

export function GPPDIGenerationModal({ callId, sellerEmail, onClose }: GPPDIGenerationModalProps) {
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [pdi, setPdi] = useState<GPPDIContent | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const result = await GrowthPlatformAPI.generatePDI(callId)
      setPdi(result.pdi)
      // Invalidate PDI queries so dashboard refreshes
      queryClient.invalidateQueries({ queryKey: ['gp-pdi', sellerEmail] })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-[#B9915B]" />
            <span className="font-semibold text-text-primary text-sm">Gerar PDI</span>
          </div>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!pdi && !loading && (
            <p className="text-sm text-text-secondary">
              Gera um Plano de Desenvolvimento Individual personalizado com base nos scores SPICED, Challenger, SPIN e comportamentais da última call. Salvo automaticamente.
            </p>
          )}

          {loading && (
            <div className="flex flex-col items-center gap-3 py-10 justify-center">
              <Loader2 size={22} className="animate-spin text-[#B9915B]" />
              <span className="text-sm text-text-secondary">Gerando PDI com IA…</span>
              <span className="text-xs text-text-tertiary">Isso pode levar alguns segundos</span>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {pdi && (
            <div className="space-y-4">
              {/* Summary */}
              {pdi.summary && (
                <div className="bg-[#B9915B]/5 border border-[#B9915B]/20 rounded-xl p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#B9915B] mb-1.5">Diagnóstico</p>
                  <p className="text-sm text-text-secondary leading-relaxed">{pdi.summary}</p>
                </div>
              )}

              {/* Priorities */}
              {pdi.priorities && pdi.priorities.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Prioridades de Desenvolvimento</p>
                  {pdi.priorities.map((p, i) => (
                    <PDIPriorityItem key={i} priority={p} index={i} />
                  ))}
                </div>
              )}

              {/* Quick Wins */}
              {pdi.quick_wins && pdi.quick_wins.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-2">Quick Wins</p>
                  <ul className="space-y-1.5">
                    {pdi.quick_wins.map((win, i) => (
                      <li key={i} className="flex gap-2 text-xs text-text-secondary">
                        <span className="text-signal-green">✓</span>{win}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* KPI Targets */}
              {pdi.kpi_targets && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-2">Metas KPI</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Talk Ratio', value: `≤${pdi.kpi_targets.talk_ratio_target}%` },
                      { label: 'SPICED', value: `${pdi.kpi_targets.spiced_target_pct}%` },
                      { label: 'Comportamental', value: `${pdi.kpi_targets.unified_behavior_target}pts` },
                    ].map(kpi => (
                      <div key={kpi.label} className="bg-bg-elevated border border-border rounded-xl p-3 text-center">
                        <p className="text-lg font-bold text-text-primary">{kpi.value}</p>
                        <p className="text-[10px] text-text-tertiary mt-0.5">{kpi.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {pdi.coaching_cadence && (
                <p className="text-xs text-text-tertiary">
                  Cadência de coaching sugerida: <span className="text-text-secondary capitalize">{pdi.coaching_cadence}</span>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-border shrink-0">
          <button
            onClick={onClose}
            className="text-sm text-text-tertiary hover:text-text-primary transition-colors"
          >
            {pdi ? 'Fechar' : 'Cancelar'}
          </button>
          <button
            onClick={generate}
            disabled={loading}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all',
              'bg-[#B9915B] text-white hover:bg-[#B9915B]/90 disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <BookOpen size={12} />}
            {pdi ? 'Regerar PDI' : 'Gerar PDI'}
          </button>
        </div>
      </div>
    </div>
  )
}
