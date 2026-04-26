import { useState, useEffect } from 'react'
import { MessageSquare, Clock, Send, X, Check, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/cn'
import type { Database } from '../types/database'

interface CallFeedbackModalProps {
  callId: string
  callTitle?: string
  onClose: () => void
  onFeedbackAdded?: () => void
}

type CallFeedback = Database['public']['Tables']['call_feedback']['Row']

const FEEDBACK_TYPES = [
  { value: 'comment', label: 'Comentário', color: 'bg-signal-amber/15 text-signal-amber border-signal-amber/20' },
  { value: 'coaching', label: 'Coaching', color: 'bg-signal-blue/15 text-signal-blue border-signal-blue/20' },
  { value: 'praise', label: 'Positivo', color: 'bg-signal-green/15 text-signal-green border-signal-green/20' },
] as const

export default function CallFeedbackModal({
  callId,
  callTitle,
  onClose,
  onFeedbackAdded
}: CallFeedbackModalProps) {
  const [feedbacks, setFeedbacks] = useState<CallFeedback[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    type: 'coaching' as const,
    text: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Load existing feedbacks
  useEffect(() => {
    async function loadFeedbacks() {
      try {
        const { data, error } = await supabase
          
          .from('call_feedback')
          .select('id, text, type, author_email, created_at, call_id')
          .eq('call_id', callId)
          .order('created_at', { ascending: false })

        if (!error && data) {
          setFeedbacks(data as CallFeedback[])
        }
      } catch (err) {
        console.error('Error loading feedbacks:', err)
      } finally {
        setLoading(false)
      }
    }

    if (callId) {
      loadFeedbacks()
    }
  }, [callId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.text.trim()) {
      setError('O comentário é obrigatório')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('Usuário não autenticado')
      }

      const { error: insertError } = await supabase
        
        .from('call_feedback')
        .insert({
          call_id: callId,
          author_email: user.email ?? 'unknown',
          text: formData.text.trim(),
          type: formData.type,
        } as any)

      if (insertError) {
        throw insertError
      }

      // Reset form
      setFormData({
        type: 'coaching',
        text: '',
      })
      setShowForm(false)
      setSuccess(true)

      // Reload feedbacks
      const { data } = await supabase
        
        .from('call_feedback')
        .select('id, text, type, author_email, created_at, call_id')
        .eq('call_id', callId)
        .order('created_at', { ascending: false })

      if (data) {
        setFeedbacks(data as CallFeedback[])
      }

      onFeedbackAdded?.()

      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      console.error('Error saving feedback:', err)
      setError(err instanceof Error ? err.message : 'Erro ao salvar feedback')
    } finally {
      setSaving(false)
    }
  }

  const getFeedbackTypeConfig = (type: string) => {
    return FEEDBACK_TYPES.find(f => f.value === type) || FEEDBACK_TYPES[2]
  }

  const formatTimestamp = (seconds: number | null) => {
    if (seconds === null) return 'Geral'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
              <MessageSquare size={18} />
              Feedback da Call
            </h2>
            {callTitle && (
              <p className="text-sm text-text-secondary mt-1">{callTitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Success Message */}
          {success && (
            <div className="mb-4 p-3 bg-signal-green/10 border border-signal-green/20 rounded-xl flex items-center gap-2">
              <Check size={16} className="text-signal-green" />
              <span className="text-sm text-signal-green">Feedback adicionado com sucesso!</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-signal-red/10 border border-signal-red/20 rounded-xl flex items-center gap-2">
              <AlertCircle size={16} className="text-signal-red" />
              <span className="text-sm text-signal-red">{error}</span>
            </div>
          )}

          {/* Add Feedback Form */}
          {showForm ? (
            <form onSubmit={handleSubmit} className="mb-6 p-4 bg-bg-elevated rounded-xl border border-border">
              <h3 className="text-sm font-semibold text-text-primary mb-4">Adicionar Feedback</h3>

              {/* Feedback Type */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-text-secondary mb-2">Tipo de Feedback</label>
                <div className="grid grid-cols-2 gap-2">
                  {FEEDBACK_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, type: t.value as any }))}
                      className={cn(
                        "px-3 py-2 rounded-lg border text-xs font-medium transition-colors",
                        formData.type === t.value
                          ? t.color
                          : "bg-bg-card border-border text-text-secondary hover:bg-bg-elevated"
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Comment */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-text-secondary mb-2">
                  Comentário *
                </label>
                <textarea
                  rows={3}
                  placeholder="Digite seu feedback..."
                  value={formData.text}
                  onChange={(e) => setFormData(prev => ({ ...prev, text: e.target.value }))}
                  className="w-full bg-bg-card border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-mid resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 border border-border rounded-lg text-sm text-text-secondary hover:bg-bg-elevated transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-signal-blue text-white rounded-lg text-sm font-medium hover:bg-signal-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Salvando...' : 'Adicionar Feedback'}
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="w-full mb-6 px-4 py-3 bg-signal-blue text-white rounded-lg text-sm font-medium hover:bg-signal-blue/90 transition-colors flex items-center justify-center gap-2"
            >
              <Send size={16} />
              Adicionar Feedback
            </button>
          )}

          {/* Existing Feedbacks */}
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">
              Feedbacks Existentes ({feedbacks.length})
            </h3>

            {loading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-signal-blue"></div>
                <p className="text-xs text-text-tertiary mt-2">Carregando feedbacks...</p>
              </div>
            ) : feedbacks.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare size={24} className="text-text-tertiary mx-auto mb-2" />
                <p className="text-sm text-text-secondary">Nenhum feedback ainda</p>
                <p className="text-xs text-text-tertiary mt-1">Seja o primeiro a adicionar!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {feedbacks.map((feedback) => {
                  const typeConfig = getFeedbackTypeConfig(feedback.type || '')
                  return (
                    <div key={feedback.id} className="p-3 bg-bg-elevated rounded-xl border border-border">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "px-2 py-1 rounded-md text-xs font-medium border",
                            typeConfig.color
                          )}>
                            {typeConfig.label}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-text-secondary leading-relaxed">
                        {feedback.text}
                      </p>
                      <p className="text-xs text-text-tertiary mt-2">
                        {new Date(feedback.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
