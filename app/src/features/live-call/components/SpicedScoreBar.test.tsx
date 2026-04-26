import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SpicedScoreBar } from './SpicedScoreBar'
import type { SpicedScores } from '../types/live-call.types'

const baseScores: SpicedScores = {
  situation:      { score: 3, max: 5 },
  pain:           { score: 4, max: 5 },
  impact:         { score: 1, max: 5 },
  critical_event: { score: 0, max: 5 },
  decision:       { score: 2, max: 5 },
  delivery:       { score: 0, max: 5 },
}

describe('SpicedScoreBar', () => {
  it('Test 1: renderiza exatamente 6 barras (uma por dimensão SPICED)', () => {
    render(<SpicedScoreBar scores={baseScores} activeDimension={null} />)
    expect(screen.getByText('Situação')).toBeDefined()
    expect(screen.getByText('Dor')).toBeDefined()
    expect(screen.getByText('Impacto')).toBeDefined()
    expect(screen.getByText('Evento Crítico')).toBeDefined()
    expect(screen.getByText('Decisão')).toBeDefined()
    expect(screen.getByText('Entrega')).toBeDefined()
  })

  it('Test 2: score 3/5 gera width 60% no fill element', () => {
    const { container } = render(
      <SpicedScoreBar scores={baseScores} activeDimension={null} />
    )
    // situation score=3, max=5 → 60%
    const fills = container.querySelectorAll('[data-testid="bar-fill"]')
    const situationFill = fills[0] as HTMLElement
    expect(situationFill.style.width).toBe('60%')
  })

  it('Test 3: activeDimension="pain" → barra de Pain tem classe de destaque, demais não', () => {
    const { container } = render(
      <SpicedScoreBar scores={baseScores} activeDimension="pain" />
    )
    // Apenas a linha ativa deve ter ring-g4-red/40
    const activeRows = container.querySelectorAll('[data-active="true"]')
    expect(activeRows.length).toBe(1)
    const activeRow = activeRows[0]
    // Deve corresponder à dimensão pain
    expect(activeRow.textContent).toContain('Dor')
  })

  it('Test 4: score 0 → fill tem width 0% (não colapsa o layout)', () => {
    const { container } = render(
      <SpicedScoreBar scores={baseScores} activeDimension={null} />
    )
    // critical_event score=0 → 0% (índice 3)
    const fills = container.querySelectorAll('[data-testid="bar-fill"]')
    const criticalFill = fills[3] as HTMLElement
    expect(criticalFill.style.width).toBe('0%')
    // O elemento deve existir (não colapsa)
    expect(criticalFill).not.toBeNull()
  })

  it('Test 5: score 5/5 → fill tem width 100%', () => {
    const fullScores: SpicedScores = {
      ...baseScores,
      pain: { score: 5, max: 5 },
    }
    const { container } = render(
      <SpicedScoreBar scores={fullScores} activeDimension={null} />
    )
    // pain score=5, max=5 → 100% (índice 1)
    const fills = container.querySelectorAll('[data-testid="bar-fill"]')
    const painFill = fills[1] as HTMLElement
    expect(painFill.style.width).toBe('100%')
  })
})
