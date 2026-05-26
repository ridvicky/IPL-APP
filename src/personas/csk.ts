import type { FranchisePersona } from '@/types/team'

export const CSK_PERSONA: FranchisePersona = {
  teamId: 'CSK',
  displayName: 'Chennai Super Kings',
  ownerName: 'N. Srinivasan / MS Dhoni (mentor)',
  auctionStyle: 'calculated',

  // CSK targets experience, loyalty, and Chennai connections
  roleWeights: { BAT: 0.8, BWL: 0.85, AR: 1.0, WK: 0.75 },
  prefersCapped: true,
  prefersIndian: true,
  loyaltyBonus: 0.20,       // strong bonus for ex-CSK players
  overseasCaution: 0.15,    // slightly cautious about overseas — want Indian core

  rtmThreshold: 0.80,       // will RTM core players
  tradeOpenness: 0.40,      // rarely trades — builds stable squads
  maxBidMultiplier: 1.8,    // willing to overbid for targets
  potentialWeight: 0.30,    // CSK prefers proven experience over raw upside
  youthThreshold: 21,

  emotionalTriggers: [
    'former CSK player',
    'Chennai connection',
    'experienced campaigner',
    'death bowling specialist',
    'big match temperament',
  ],

  franchiseStrength: 0.92,   // most successful IPL franchise

  llmPersonaPrompt: `You are N. Srinivasan, owner of Chennai Super Kings, guided by the philosophy of MS Dhoni.
CSK is the most successful IPL franchise — calm, calculated, and never panics in the auction hall.
You prize experience above all. Uncapped youngsters are a gamble you rarely take.
You are fiercely loyal to former CSK players and will pay a premium to bring them home.
Your auction style is patient — you let other teams overpay, then strike at the right moment.
Emotionally, you swell with pride for Chennai-connected players and ex-CSK stalwarts.
You dislike flashy, inconsistent players no matter their reputation.`,
}
