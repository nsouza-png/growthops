import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink, AlertTriangle, MessageCircle } from 'lucide-react'
import { cn } from '../../../lib/cn'
import { formatCallDate, formatDuration, formatScore } from '../utils/formatters'
import type { GrowthPlatformCall } from '../types'
import { GPFollowUpModal } from './GPFollowUpModal'

interface GPRecentCallsTableProps {
  calls: GrowthPlatformCall[]
  maxRows?: number
  showSeller?: boolean
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-text-tertiary text-xs">–</span>
  const color =
    score >= 70 ? 'text-signal-green' :
    score >= 40 ? 'text-signal-amber' :
    'text-signal-red'
  return <span className={cn('text-sm font-bold tabular-nums', color)}>{formatScore(score)}</span>
}

function RiskBadge({ risk }: { risk: string | null }) {
  if (!risk) return null
  const normalized = risk.toLowerCase()
  const cls =
    normalized === 'alto'  ? 'bg-red-500/10 text-red-400 border-red-500/30' :
    normalized === 'medio' || normalized === 'médio' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' :
    'bg-green-500/10 text-green-400 border-green-500/30'
  const label = normalized === 'alto' ? 'Alto' : normalized.includes('dio') ? 'Médio' : 'Baixo'
  return (
    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', cls)}>
      {label}
    </span>
  )
}

export function GPRecentCallsTable({ calls, maxRows = 10, showSeller = false }: GPRecentCallsTableProps) {
  const navigate = useNavigate()
  const [followUpCall, setFollowUpCall] = useState<GrowthPlatformCall | null>(null)
  const rows = calls.slice(0, maxRows)

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-text-tertiary text-sm">
        Nenhuma call processada ainda.
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-[10px] font-bold uppercase tracking-widest text-text-tertiary py-2 pr-4">
                Data
              </th>
              {showSeller && (
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-text-tertiary py-2 pr-4">
                  Seller
                </th>
              )}
              <th className="text-left text-[10px] font-bold uppercase tracking-widest text-text-tertiary py-2 pr-4">
                Prospect
              </th>
              <th className="text-center text-[10px] font-bold uppercase tracking-widest text-text-tertiary py-2 pr-4">
                SPICED
              </th>
              <th className="text-center text-[10px] font-bold uppercase tracking-widest text-text-tertiary py-2 pr-4">
                Talk Ratio
              </th>
              <th className="text-center text-[10px] font-bold uppercase tracking-widest text-text-tertiary py-2 pr-4">
                Risk
              </th>
              <th className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary py-2 pr-4">
                Duração
              </th>
              <th className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary py-2">
                {/* actions */}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(call => {
              const scores = call.framework_scores
              const behavior = call.behavior_signals
              const business = call.business_analysis
              const hasAnalysis = !!scores
              const hasRedFlags = scores?.spiced_red_flags && scores.spiced_red_flags.length > 0

              return (
                <tr
                  key={call.id}
                  className="border-b border-border/50 hover:bg-bg-elevated/50 transition-colors"
                >
                  <td className="py-3 pr-4 cursor-pointer" onClick={() => navigate(`/calls/${call.id}`)}>
                    <span className="text-text-secondary text-xs">{formatCallDate(call.call_date)}</span>
                  </td>
                  {showSeller && (
                    <td className="py-3 pr-4 cursor-pointer" onClick={() => navigate(`/calls/${call.id}`)}>
                      <span className="text-text-secondary text-xs truncate max-w-[120px] block">
                        {call.seller_name}
                      </span>
                    </td>
                  )}
                  <td className="py-3 pr-4 cursor-pointer" onClick={() => navigate(`/calls/${call.id}`)}>
                    <div className="flex items-center gap-1.5">
                      {hasRedFlags && <AlertTriangle size={11} className="text-signal-amber shrink-0" />}
                      <div>
                        <div className="text-text-primary font-medium truncate max-w-[160px]">
                          {call.prospect_name ?? '–'}
                        </div>
                        {call.prospect_company && (
                          <div className="text-text-tertiary text-xs truncate max-w-[160px]">
                            {call.prospect_company}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-center cursor-pointer" onClick={() => navigate(`/calls/${call.id}`)}>
                    {hasAnalysis ? (
                      <ScoreBadge score={scores?.spiced_total ?? null} />
                    ) : (
                      <span className="text-text-tertiary text-xs">sem análise</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-center cursor-pointer" onClick={() => navigate(`/calls/${call.id}`)}>
                    {behavior?.talk_ratio_seller_pct != null ? (
                      <span className={cn(
                        'text-xs tabular-nums font-medium',
                        behavior.talk_ratio_seller_pct > 65 ? 'text-signal-amber' : 'text-signal-green',
                      )}>
                        {Math.round(behavior.talk_ratio_seller_pct)}%
                      </span>
                    ) : (
                      <span className="text-text-tertiary text-xs">–</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-center cursor-pointer" onClick={() => navigate(`/calls/${call.id}`)}>
                    <RiskBadge risk={business?.deal_stage ?? scores?.deal_risk ?? null} />
                  </td>
                  <td className="py-3 pr-4 cursor-pointer" onClick={() => navigate(`/calls/${call.id}`)}>
                    <span className="text-text-tertiary text-xs">
                      {formatDuration(call.duration_min)}
                    </span>
                  </td>
                  <td className="py-3">
                    <button
                      onClick={e => { e.stopPropagation(); setFollowUpCall(call) }}
                      title="Gerar follow-up WhatsApp"
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-signal-green border border-signal-green/30 bg-signal-green/5 hover:bg-signal-green/15 transition-all"
                    >
                      <MessageCircle size={11} />
                      WA
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {calls.length > maxRows && (
          <div className="flex items-center gap-1 mt-3 text-xs text-text-tertiary">
            <ExternalLink size={11} />
            <span>+{calls.length - maxRows} calls adicionais em Calls Hub</span>
          </div>
        )}
      </div>

      {followUpCall && (
        <GPFollowUpModal
          call={followUpCall}
          onClose={() => setFollowUpCall(null)}
        />
      )}
    </>
  )
}
