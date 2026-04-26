import { Mic } from 'lucide-react'
import { cn } from '../../../lib/cn'

interface GPTalkRatioCardProps {
  sellerPct: number | null
  sellerName?: string
}

export function GPTalkRatioCard({ sellerPct, sellerName = 'Seller' }: GPTalkRatioCardProps) {
  const clientPct = sellerPct != null ? Math.round(100 - sellerPct) : null
  const sellerRounded = sellerPct != null ? Math.round(sellerPct) : null
  const isHealthy = sellerPct != null ? sellerPct < 60 : null

  return (
    <div className="bg-bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Mic size={13} className="text-text-tertiary" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
          Talk Ratio
        </span>
        {isHealthy != null && (
          <span className={cn(
            'ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full',
            isHealthy
              ? 'bg-signal-green/10 text-signal-green'
              : 'bg-signal-amber/10 text-signal-amber',
          )}>
            {isHealthy ? 'Saudável' : 'Atenção'}
          </span>
        )}
      </div>

      {sellerPct == null ? (
        <p className="text-text-tertiary text-sm">Sem dados disponíveis.</p>
      ) : (
        <>
          {/* Visual bar */}
          <div className="space-y-2">
            <div className="h-3 bg-bg-elevated rounded-full overflow-hidden flex">
              <div
                className={cn('h-full transition-all rounded-l-full',
                  isHealthy ? 'bg-signal-green' : 'bg-signal-amber')}
                style={{ width: `${sellerRounded}%` }}
              />
              <div
                className="h-full bg-signal-blue/40 rounded-r-full"
                style={{ width: `${clientPct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-text-tertiary">
              <span>
                <span className={cn('font-bold', isHealthy ? 'text-signal-green' : 'text-signal-amber')}>
                  {sellerRounded}%
                </span>{' '}
                {sellerName}
              </span>
              <span>
                <span className="font-bold text-signal-blue">{clientPct}%</span> Cliente
              </span>
            </div>
          </div>

          <p className="text-xs text-text-tertiary">
            {isHealthy
              ? 'Proporção adequada — mais escuta do que fala.'
              : 'Seller falando mais que 60%. Foco em perguntas abertas.'}
          </p>
        </>
      )}
    </div>
  )
}
