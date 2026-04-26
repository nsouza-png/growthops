import { useState } from 'react'
import { BookOpen, Target, ChevronRight, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { GrowthPlatformCloserPDI, GPPDIPriority } from '../types'
import { GPPDIGenerationModal } from './GPPDIGenerationModal'

interface GPPDICardProps {
  pdi: GrowthPlatformCloserPDI | null | undefined
  email?: string
  lastCallId?: string
}

export function GPPDICard({ pdi, email, lastCallId }: GPPDICardProps) {
  const navigate = useNavigate()
  const [showModal, setShowModal] = useState(false)

  if (!pdi) {
    return (
      <>
        <div className="bg-bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen size={13} className="text-text-tertiary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
              PDI Ativo
            </span>
          </div>
          <p className="text-text-tertiary text-sm mb-4">Nenhum PDI gerado ainda.</p>
          {lastCallId && email && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 w-full justify-center px-3 py-2 rounded-xl text-xs font-semibold bg-[#B9915B] text-white hover:bg-[#B9915B]/90 transition-all"
            >
              <Sparkles size={12} />
              Gerar PDI
            </button>
          )}
        </div>
        {showModal && lastCallId && email && (
          <GPPDIGenerationModal
            callId={lastCallId}
            sellerEmail={email}
            onClose={() => setShowModal(false)}
          />
        )}
      </>
    )
  }

  const { pdi_content } = pdi

  // Handle both old format (string[]) and new format (GPPDIPriority[])
  const priorities = (pdi_content.priorities ?? []).slice(0, 3)
  const focusAreas = pdi_content.focus_areas?.slice(0, 3) ?? []

  function priorityLabel(p: GPPDIPriority | string): string {
    if (typeof p === 'string') return p
    return p.area
  }

  return (
    <>
      <div className="bg-bg-card border border-border/50 border-l-2 border-l-[#B9915B] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target size={13} className="text-[#B9915B]" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
              PDI — {pdi.period ?? 'Período atual'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {lastCallId && email && (
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-1 text-xs text-text-tertiary hover:text-[#B9915B] transition-colors"
              >
                <Sparkles size={11} /> Atualizar
              </button>
            )}
            <button
              onClick={() => navigate(email ? `/pdi/${email}` : '/pdi')}
              className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-primary transition-colors"
            >
              Ver completo <ChevronRight size={12} />
            </button>
          </div>
        </div>

        {focusAreas.length > 0 && (
          <div>
            <p className="text-[10px] text-text-tertiary uppercase tracking-widest mb-2">Focos</p>
            <div className="flex flex-wrap gap-1.5">
              {focusAreas.map((area, i) => (
                <span
                  key={i}
                  className="text-xs px-2.5 py-1 rounded-full bg-[#B9915B]/10 border border-[#B9915B]/30 text-[#B9915B] font-medium"
                >
                  {area}
                </span>
              ))}
            </div>
          </div>
        )}

        {priorities.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] text-text-tertiary uppercase tracking-widest">Prioridades</p>
            {priorities.map((p, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-[10px] font-bold text-text-tertiary mt-0.5 w-4 shrink-0">{i + 1}.</span>
                <p className="text-xs text-text-secondary leading-relaxed">{priorityLabel(p as GPPDIPriority | string)}</p>
              </div>
            ))}
          </div>
        )}

        {pdi_content.timeline && (
          <p className="text-xs text-text-tertiary border-t border-border/50 pt-3">
            Timeline: {pdi_content.timeline}
          </p>
        )}
      </div>

      {showModal && lastCallId && email && (
        <GPPDIGenerationModal
          callId={lastCallId}
          sellerEmail={email}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
