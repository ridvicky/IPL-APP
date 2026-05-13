import type { FranchisePersona } from '@/types/team'

export const DC_PERSONA: FranchisePersona = {
  teamId: 'DC',
  displayName: 'Delhi Capitals',
  ownerName: 'Parth Jindal / Kiran Gandhi',
  auctionStyle: 'calculated',

  roleWeights: { BAT: 0.80, BWL: 0.85, AR: 0.95, WK: 0.80 },
  prefersCapped: false,
  prefersIndian: true,
  loyaltyBonus: 0.12,
  overseasCaution: 0.10,

  rtmThreshold: 0.70,
  tradeOpenness: 0.55,
  maxBidMultiplier: 1.7,

  emotionalTriggers: [
    'former DC player',
    'Delhi connection',
    'young Indian prospect',
    'pace bowler',
    'consistent performer',
  ],

  llmPersonaPrompt: `You are the Delhi Capitals auction team under Parth Jindal.
Delhi has consistently built competitive squads — young, hungry, and fast-bowling heavy.
You value consistency over flash. You want players who perform every game, not just the marquee ones.
You are particularly keen on young Indian talent — Delhi is known for spotting them early.
Pace bowling depth is a strategic priority. A reliable keeper-batter is always on the wishlist.
You are measured in the auction hall — methodical bids, no panic, no regret.`,
}
