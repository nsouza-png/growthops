import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Supabase client
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      eq: vi.fn(),
      ilike: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      single: vi.fn(),
      maybeSingle: vi.fn(),
    })),
    rpc: vi.fn(),
    channel: vi.fn(() => ({
      on: vi.fn(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  },
}))

// Mock RoleContext
vi.mock('../contexts/RoleContext', () => ({
  useRole: () => ({
    viewedRole: 'admin',
    realRole: 'admin',
    isAdmin: true,
    simulatedCloser: null,
  }),
}))

// Global test utilities
;(global as unknown as Record<string, unknown>).testUtils = {
  createMockInsightRow: (overrides = {}) => ({
    id: 1,
    vendedor: 'John Doe',
    lead: 'Test Lead',
    perfil_do_lead: 'Test Profile',
    data: '19/04/2026 10:00:00',
    score_geral: 75,
    temperatura_identificada: 'QUENTE',
    resumo: 'Test summary',
    principais_acertos: 'Test successes',
    pontos_de_melhoria: 'Test improvements',
    proximos_passos: 'Test next steps',
    abertura_e_alinhamento: 'Test opening',
    abertura_e_alinhamento_pp: 0.8,
    motivo_abertura_e_alinhamento: 'Test reason',
    situation: 'Test situation',
    situation_pp: 0.7,
    motivo_situation: 'Test reason',
    pain: 'Test pain',
    pain_pp: 0.9,
    motivo_pain: 'Test reason',
    impact: 'Test impact',
    impact_pp: 0.8,
    motivo_impact: 'Test reason',
    critical_event_emotion: 'Test critical event',
    critical_event_emotion_pp: 0.7,
    motivo_critical_event_emotion: 'Test reason',
    delivery: 'Test delivery',
    delivery_pp: 0.9,
    motivo_delivery: 'Test reason',
    conducao_fechamento: 'Test closing',
    conducao_fechamento_pp: 0.8,
    motivo_conducao_fechamento: 'Test reason',
    objecoes: 'Test objections',
    objecoes_pp: 0.6,
    motivo_objecoes: 'Test reason',
    deal_id: '123',
    meetingId: 'meeting-123',
    nota_conversao: 0.8,
    call_name: 'Test Call',
    status_do_deal: 'active',
    moderada: false,
    segmento_lead: 'Test Segment',
    produto_oferecido: 'Test Product',
    ...overrides,
  }),
}
