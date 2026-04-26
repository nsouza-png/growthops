import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useDealContext } from './useDealContext'

// Mock do módulo supabase — factory sem referências externas (hoisting-safe)
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

// Import do mock após registrar o vi.mock
import { supabase } from '../../../lib/supabase'

// Helper para construir o chain Supabase com resultado customizável
function buildChain(result: { data: unknown; error: unknown }) {
  const limit = vi.fn().mockResolvedValue(result)
  const order = vi.fn().mockReturnValue({ limit })
  const not = vi.fn().mockReturnValue({ order })
  const eq = vi.fn().mockReturnValue({ not })
  const select = vi.fn().mockReturnValue({ eq })
  return { from: vi.fn().mockReturnValue({ select }), select, eq, not, order, limit }
}

// Fixture: call row com scores
const mockCallWithScores = {
  id: 'call-abc',
  deal_id: 'deal-123',
  lead_perfil: 'Decisor',
  lead_segmento: 'Saúde',
  lead_faixa: 'Acima de 1MM',
  deal_acv: 85000,
  produto_oferecido: 'G4 PRO',
  deal_stage: 'Proposta',
  closer_email: 'closer@g4.com',
  happened_at: '2026-04-01T10:00:00Z',
  scores: {
    id: 'score-1',
    call_id: 'call-abc',
    spiced_situation: 4,
    spiced_pain: 5,
    spiced_impact: 3,
    spiced_critical_event: 2,
    spiced_decision: 3,
    spiced_total: 17,
  },
}

// Fixture: call sem scores
const mockCallWithoutScores = {
  ...mockCallWithScores,
  scores: null,
}

describe('useDealContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Caso 1: dealId undefined → retorna context null sem chamar Supabase', () => {
    const { result } = renderHook(() => useDealContext(undefined))

    expect(result.current.context).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('Caso 2: dealId fornecido → dispara query com filtro correto', async () => {
    const chain = buildChain({ data: [mockCallWithScores], error: null })
    vi.mocked(supabase.from).mockImplementation(chain.from)

    renderHook(() => useDealContext('deal-123'))

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('calls')
      expect(chain.eq).toHaveBeenCalledWith('deal_id', 'deal-123')
    })
  })

  it('Caso 3: resposta com scores → mapeia DealContext corretamente', async () => {
    const chain = buildChain({ data: [mockCallWithScores], error: null })
    vi.mocked(supabase.from).mockImplementation(chain.from)

    const { result } = renderHook(() => useDealContext('deal-123'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    const ctx = result.current.context
    expect(ctx).not.toBeNull()
    expect(ctx?.dealId).toBe('deal-123')
    expect(ctx?.leadPerfil).toBe('Decisor')
    expect(ctx?.leadSegmento).toBe('Saúde')
    expect(ctx?.leadFaixa).toBe('Acima de 1MM')
    expect(ctx?.dealAcv).toBe(85000)
    expect(ctx?.produtoOferecido).toBe('G4 PRO')
    expect(ctx?.dealStage).toBe('Proposta')
    expect(ctx?.closerEmail).toBe('closer@g4.com')
    expect(ctx?.historicalSpiced?.situation).toBe(4)
    expect(ctx?.historicalSpiced?.pain).toBe(5)
    expect(ctx?.historicalSpiced?.impact).toBe(3)
    expect(ctx?.historicalSpiced?.criticalEvent).toBe(2)
    expect(ctx?.historicalSpiced?.decision).toBe(3)
  })

  it('Caso 4: call sem scores → historicalSpiced é null', async () => {
    const chain = buildChain({ data: [mockCallWithoutScores], error: null })
    vi.mocked(supabase.from).mockImplementation(chain.from)

    const { result } = renderHook(() => useDealContext('deal-456'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.context?.historicalSpiced).toBeNull()
  })

  it('Caso 5: Supabase retorna erro → error com mensagem, context null', async () => {
    const chain = buildChain({ data: null, error: { message: 'connection refused' } })
    vi.mocked(supabase.from).mockImplementation(chain.from)

    const { result } = renderHook(() => useDealContext('deal-999'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.context).toBeNull()
    expect(result.current.error).toBe('connection refused')
  })

  it('Caso 6: dealId muda → re-executa a query', async () => {
    const chain = buildChain({ data: [mockCallWithScores], error: null })
    vi.mocked(supabase.from).mockImplementation(chain.from)

    const { result, rerender } = renderHook(
      ({ dealId }: { dealId: string | undefined }) => useDealContext(dealId),
      { initialProps: { dealId: 'deal-111' as string | undefined } }
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    const callCountAfterFirst = vi.mocked(supabase.from).mock.calls.length

    rerender({ dealId: 'deal-222' })

    await waitFor(() => {
      expect(vi.mocked(supabase.from).mock.calls.length).toBeGreaterThan(callCountAfterFirst)
    })

    expect(chain.eq).toHaveBeenLastCalledWith('deal_id', 'deal-222')
  })
})
