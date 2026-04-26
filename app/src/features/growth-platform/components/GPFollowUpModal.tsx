// ── GPFollowUpModal — Generate + persist WhatsApp followup for a GP call ─────
import { useState } from 'react'
import { X, MessageCircle, Loader2, Copy, Check } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { GrowthPlatformAPI } from '../services/api'
import type { GrowthPlatformCall } from '../types'
import { cn } from '../../../lib/cn'

interface GPFollowUpModalProps {
  call: GrowthPlatformCall
  onClose: () => void
}

export function GPFollowUpModal({ call, onClose }: GPFollowUpModalProps) {
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [tone, setTone] = useState<string | null>(null)
  const [cta, setCta] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const result = await GrowthPlatformAPI.generateWhatsAppFollowup(call.id)
      setMessage(result.message)
      setTone(result.tone)
      setCta(result.cta)
      // Invalidate followups cache for this call
      queryClient.invalidateQueries({ queryKey: ['gp-followups', call.id] })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  async function copyToClipboard() {
    if (!message) return
    await navigator.clipboard.writeText(message)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const prospectLabel = [call.prospect_name, call.prospect_company].filter(Boolean).join(' · ')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <MessageCircle size={16} className="text-signal-green" />
            <span className="font-semibold text-text-primary text-sm">Follow-up WhatsApp</span>
          </div>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Prospect context */}
        <div className="px-5 pt-4">
          <p className="text-xs text-text-tertiary">
            Call com <span className="text-text-secondary font-medium">{prospectLabel || '–'}</span>
            {call.call_date && (
              <span> · {new Date(call.call_date).toLocaleDateString('pt-BR')}</span>
            )}
          </p>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {!message && !loading && (
            <p className="text-sm text-text-secondary">
              Gera uma mensagem de follow-up personalizada com base na análise da call. Salvo automaticamente no histórico.
            </p>
          )}

          {loading && (
            <div className="flex items-center gap-3 py-6 justify-center">
              <Loader2 size={18} className="animate-spin text-signal-green" />
              <span className="text-sm text-text-secondary">Gerando mensagem…</span>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {message && (
            <div className="space-y-3">
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={6}
                className="w-full bg-bg-elevated border border-border rounded-xl px-4 py-3 text-sm text-text-primary resize-none focus:outline-none focus:border-signal-green/50"
              />
              <div className="flex items-center gap-3 text-xs text-text-tertiary">
                {tone && <span className="capitalize bg-bg-elevated px-2 py-0.5 rounded-full border border-border">{tone}</span>}
                {cta && <span className="text-text-secondary">CTA: {cta}</span>}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 px-5 pb-5">
          <button
            onClick={onClose}
            className="text-sm text-text-tertiary hover:text-text-primary transition-colors"
          >
            Fechar
          </button>
          <div className="flex gap-2">
            {message && (
              <button
                onClick={copyToClipboard}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all',
                  copied
                    ? 'bg-signal-green/10 border-signal-green/30 text-signal-green'
                    : 'bg-bg-elevated border-border text-text-secondary hover:text-text-primary',
                )}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            )}
            <button
              onClick={generate}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-signal-green text-white hover:bg-signal-green/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <MessageCircle size={12} />}
              {message ? 'Regerar' : 'Gerar Follow-up'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
