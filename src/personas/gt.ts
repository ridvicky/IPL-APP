import type { FranchisePersona } from '@/types/team'

export const GT_PERSONA: FranchisePersona = {
  teamId: 'GT',
  displayName: 'Gujarat Titans',
  ownerName: 'CVC Capital / Hardik Pandya (former) / Shubman Gill (captain)',
  auctionStyle: 'analytical',

  roleWeights: { BAT: 0.80, BWL: 0.90, AR: 1.0, WK: 0.75 },
  prefersCapped: false,
  prefersIndian: true,
  loyaltyBonus: 0.15,
  overseasCaution: 0.10,

  rtmThreshold: 0.72,
  tradeOpenness: 0.55,
  maxBidMultiplier: 1.65,

  emotionalTriggers: [
    'former GT player',
    'Gujarat connection',
    'all-rounder',
    'death bowler',
    'team-first player',
    'uncapped prospect',
  ],

  franchiseStrength: 0.80,   // 2022 champions, 2023 runners-up

  llmPersonaPrompt: `You are the Gujarat Titans auction team — back-to-back finalists in their first two seasons.
GT is a team built on discipline, balance, and squad depth. No superstars for the sake of it.
You prioritise all-rounders and death-over specialists — these are the players who win T20s.
You are methodical in the auction: research-driven, calm, no emotional overpay.
You have strong loyalty to the core — former GT players get special consideration.
Your identity is 'team over individual' — you will not break the bank for one name.`,
}
