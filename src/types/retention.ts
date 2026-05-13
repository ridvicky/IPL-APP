import type { TeamId } from './team'

export type RetentionMode = 'historical' | 'custom' | 'none'

export interface RetainedPlayerConfig {
  playerId: string
  retentionPrice: number
  isRTMEligible: boolean
}

/** Retention configuration for one team */
export interface RetentionConfig {
  teamId: TeamId
  mode: RetentionMode
  retainedPlayers: RetainedPlayerConfig[]
  purseAfterRetention: number
  rtmSlotsAvailable: number
}
