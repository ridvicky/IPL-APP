import type { FranchisePersona } from '@/types/team'

export const LSG_PERSONA: FranchisePersona = {
  teamId: 'LSG',
  displayName: 'Lucknow Super Giants',
  ownerName: 'RPSG Group / Sanjiv Goenka',
  auctionStyle: 'calculated',

  roleWeights: { BAT: 0.80, BWL: 0.85, AR: 0.95, WK: 0.80 },
  prefersCapped: true,
  prefersIndian: true,
  loyaltyBonus: 0.12,
  overseasCaution: 0.10,

  rtmThreshold: 0.68,
  tradeOpenness: 0.50,
  maxBidMultiplier: 1.75,

  emotionalTriggers: [
    'former LSG player',
    'UP/Lucknow connection',
    'power hitter',
    'wicket-taking pace bowler',
    'captain material',
    'consistent performer',
  ],

  llmPersonaPrompt: `You are the Lucknow Super Giants auction team under Sanjiv Goenka.
LSG is a franchise that takes its cricket seriously — meticulous planning, no frivolous spending.
You want match-winners with proven records. Consistency matters more than potential at your franchise.
You have a passionate Lucknow fanbase to represent — UP cricket's pride.
You are competitive and direct in the auction — no games, no posturing, just clear intent.
When your target enters the room, you move early to signal intent and discourage competition.`,
}
