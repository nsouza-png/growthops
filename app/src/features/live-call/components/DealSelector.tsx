// DealSelector.tsx
// Dropdown para seleção de deal ativo na sessão ao vivo.
// Utiliza useCalls para listar os deals disponíveis.

import { useCalls } from '../../../hooks/useCalls'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DealSelectorProps {
  selectedDealId?: string
  onSelect: (dealId: string) => void
}

// ---------------------------------------------------------------------------
// DealSelector
// ---------------------------------------------------------------------------

export function DealSelector({ selectedDealId, onSelect }: DealSelectorProps) {
  const { calls, loading } = useCalls(50)

  return (
    <div className="space-y-1">
      <label className="text-xs text-gray-400 uppercase tracking-wider">Deal</label>
      <select
        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-g4-red focus:outline-none"
        value={selectedDealId ?? ''}
        onChange={(e) => onSelect(e.target.value)}
        disabled={loading}
      >
        <option value="">Selecionar deal...</option>
        {calls?.map((call) => (
          <option key={call.id} value={call.deal_id ?? call.id}>
            {call.lead_perfil ?? call.deal_id ?? call.id} — {call.lead_segmento ?? ''}
          </option>
        ))}
      </select>
    </div>
  )
}
