import { useState, useEffect } from 'react'
import { X, Check, Copy, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/cn'

interface FollowUpModalProps {
  callId: string
  onClose: () => void
}

export function FollowUpModal({ callId, onClose }: FollowUpModalProps) {
  const [loading, setLoading] = useState(false)
  const [emailText, setEmailText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setLoading(true)
    supabase.functions.invoke('generate-followup', { body: { call_id: callId } })
      .then(({ data, error: fnError }) => {
        if (fnError || !data?.ok) {
          setError('Nao foi possivel gerar o follow-up. Tente novamente.')
        } else {
          setEmailText(data.email)
        }
      })
      .finally(() => setLoading(false))
  }, [callId])

  async function copyToClipboard() {
    if (!emailText) return
    await navigator.clipboard.writeText(emailText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold">Follow-up gerado pela IA</h2>
            <p className="text-xs text-text-tertiary mt-0.5">
              Baseado no contexto da call — edite antes de enviar
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={15} /></button>
        </div>

        {/* Body */}
        <div className="p-5">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-text-tertiary text-sm">
              <div className="w-4 h-4 rounded-full border-2 border-g4-red border-t-transparent animate-spin" />
              Gerando follow-up...
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-signal-red/8 border border-signal-red/20 rounded-xl">
              <AlertCircle size={14} className="text-signal-red shrink-0 mt-0.5" />
              <p className="text-sm text-signal-red">{error}</p>
            </div>
          )}
          {emailText && !loading && (
            <textarea
              value={emailText}
              onChange={e => setEmailText(e.target.value)}
              rows={12}
              className="w-full bg-bg-card2 border border-border rounded-xl px-3 py-2.5 text-xs font-mono text-text-primary focus:outline-none focus:border-border-mid resize-none leading-relaxed"
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-5 pt-0">
          <button
            onClick={copyToClipboard}
            disabled={!emailText || loading}
            className={cn(
              'btn-primary flex-1 justify-center disabled:opacity-50',
              copied && 'bg-signal-green border-signal-green'
            )}
          >
            {copied ? <><Check size={14} /> Copiado!</> : <><Copy size={14} /> Copiar para clipboard</>}
          </button>
          <button onClick={onClose} className="btn-ghost">Fechar</button>
        </div>
      </div>
    </div>
  )
}
