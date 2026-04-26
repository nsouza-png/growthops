import { useState, useRef, useEffect } from 'react'
import { Bell, X, MessageSquare, BookOpen, AlertCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../hooks/useNotifications'
import { cn } from '../lib/cn'

const TYPE_ICON = {
  feedback: MessageSquare,
  assignment: BookOpen,
  critical_call: AlertCircle,
}

const TYPE_COLOR = {
  feedback: 'text-signal-blue',
  assignment: 'text-signal-green',
  critical_call: 'text-g4-red',
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m atrás`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h atrás`
  return `${Math.floor(h / 24)}d atrás`
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleClick(n: typeof notifications[0]) {
    setOpen(false)
    // Mark as read if unread
    if (!n.read) {
      await markRead(n.id)
    }
    if (n.call_id) navigate(`/calls/${n.call_id}`)
    else if (n.snippet_id) navigate('/pdi/library')
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        title="Notificações"
        className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center relative transition-all',
          open ? 'bg-bg-elevated text-text-primary' : 'text-text-tertiary hover:bg-bg-elevated hover:text-text-primary',
        )}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-g4-red text-white text-[9px] font-bold flex items-center justify-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-12 bottom-0 z-50 w-72 bg-bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-xs font-bold uppercase tracking-widest text-text-secondary">Notificações</span>
            <button onClick={() => setOpen(false)} className="text-text-tertiary hover:text-text-primary">
              <X size={13} />
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-border">
            {notifications.length === 0 ? (
              <div className="py-8 text-center">
                <Bell size={16} className="text-text-tertiary mx-auto mb-2" />
                <p className="text-xs text-text-tertiary">Nenhuma notificação</p>
              </div>
            ) : (
              notifications.map(n => {
                const Icon = TYPE_ICON[n.type]
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={cn(
                      'w-full text-left px-4 py-3 hover:bg-bg-elevated transition-colors flex gap-3 items-start',
                      !n.read && 'bg-bg-card2',
                    )}
                  >
                    <div className={cn('mt-0.5 shrink-0', TYPE_COLOR[n.type])}>
                      <Icon size={13} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold leading-tight mb-0.5">{n.title}</p>
                      <p className="text-xs text-text-secondary leading-snug line-clamp-2">{n.body}</p>
                      <p className="text-[10px] text-text-tertiary mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.read && (
                      <div className="w-1.5 h-1.5 rounded-full bg-g4-red mt-1 shrink-0" />
                    )}
                  </button>
                )
              })
            )}
          </div>
          {unreadCount > 0 && (
            <div className="px-4 py-3 border-t border-border">
              <button
                onClick={async () => {
                  await markAllRead()
                }}
                className="w-full text-xs text-signal-blue hover:text-signal-blue/80 transition-colors"
              >
                Marcar todas como lidas
              </button>
            </div>
          )}
          <div className="px-4 py-3 border-t border-border text-center">
            <span className="text-xs text-text-tertiary hover:text-text-primary cursor-pointer">
              Ver todas as notificações
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
