import { useParams } from 'react-router-dom'

export default function InsightDetail() {
  const { insightId } = useParams()

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Insight Detail</h1>
      <p className="text-sm text-text-tertiary mt-2">
        Insight selecionado: {insightId ?? '—'}
      </p>
    </div>
  )
}
