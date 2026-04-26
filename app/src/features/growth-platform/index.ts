// ── growth-platform barrel export ────────────────────────────────────────────

// Types
export type {
  GPRole,
  GPProcessingStatus,
  GPFollowupChannel,
  GPDealRisk,
  GPScoreBand,
  GrowthPlatformProfile,
  GrowthPlatformCall,
  GrowthPlatformFrameworkScores,
  GrowthPlatformBehaviorSignals,
  GrowthPlatformBusinessAnalysis,
  GrowthPlatformCallFollowup,
  GrowthPlatformCloserPDI,
  GrowthPlatformPipelineEvent,
  GPCallFilters,
  GPSquadMemberStats,
  GPFrameworkTotals,
  GPBehaviorSignal,
  GPNextAction,
  GPPDIContent,
} from './types'

export { GP_ROLE_LABELS, gpCanViewSquad, gpCanViewAll, gpCanManage } from './types'

// DB types (only needed when creating typed supabase queries directly)
export type {
  GrowthPlatformDatabase,
  GPProfile,
  GPCall,
  GPFrameworkScores,
  GPBehaviorSignals,
  GPBusinessAnalysis,
  GPCallFollowup,
  GPCloserPDI,
  GPPipelineEvent,
} from './types/database'

// Services
export { GrowthPlatformAPI } from './services/api'

// Hooks
export { useGrowthPlatform } from './hooks/useGrowthPlatform'
export {
  useGrowthPlatformCalls,
  useGrowthPlatformCall,
  useRecentGPCalls,
} from './hooks/useGrowthPlatformCalls'
export { useFrameworkAnalytics } from './hooks/useFrameworkAnalytics'
export { useRealtimeUpdates } from './hooks/useRealtimeUpdates'
export { useSquadAnalytics } from './hooks/useSquadAnalytics'

// Context
export { GrowthPlatformProvider, useGrowthPlatformContext } from './contexts/GrowthPlatformContext'

// Utils
export {
  formatScore,
  formatScorePct,
  scoreToband,
  BAND_COLORS,
  BAND_BG_COLORS,
  isTalkRatioHealthy,
  formatTalkRatio,
  formatCallDate,
  formatRelativeDate,
  formatDuration,
  formatARR,
  SEGMENT_LABELS,
  SPICED_DIMENSION_LABELS,
  avgSpiced,
  avgSpicedPct,
  avgTalkRatio,
  buildScoreEvolution,
  type GPScorePoint,
} from './utils/formatters'
