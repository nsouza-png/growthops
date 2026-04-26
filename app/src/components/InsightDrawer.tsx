interface InsightDrawerProps {
  insightId: string | number | null
  onClose: () => void
}

export default function InsightDrawer({ insightId, onClose }: InsightDrawerProps) {
  if (!insightId) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-end" onClick={onClose}>
      <aside
        className="w-full max-w-md h-full bg-bg-card border-l border-border p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">Insight</h2>
        <p className="text-sm text-text-tertiary mt-2">ID: {String(insightId)}</p>
        <button className="mt-4 px-3 py-2 rounded-lg border border-border text-sm" onClick={onClose}>
          Fechar
        </button>
      </aside>
    </div>
  )
}
