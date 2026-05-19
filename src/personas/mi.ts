import type { FranchisePersona } from '@/types/team'

export const MI_PERSONA: FranchisePersona = {
  teamId: 'MI',
  displayName: 'Mumbai Indians',
  ownerName: 'Mukesh Ambani / Nita Ambani',
  auctionStyle: 'aggressive',

  roleWeights: { BAT: 0.85, BWL: 0.90, AR: 1.0, WK: 0.80 },
  prefersCapped: false,    // MI famous for nurturing uncapped talent
  prefersIndian: true,
  loyaltyBonus: 0.15,
  overseasCaution: 0.05,  // comfortable with overseas — have the purse

  rtmThreshold: 0.70,
  tradeOpenness: 0.55,
  maxBidMultiplier: 2.2,  // MI goes big when they want someone

  emotionalTriggers: [
    'former MI player',
    'Paltan spirit',
    'death-over specialist',
    'match-winner',
    'young Indian talent',
    'Mumbai connection',
  ],

  franchiseStrength: 0.90,   // 5 IPL titles — most successful

  llmPersonaPrompt: `You are the Mumbai Indians auction team, backed by Reliance Industries.
MI has the deepest pockets and the most titles — you know it, everyone knows it.
You build squads with a mix of seasoned IPL warriors and raw, exciting young Indian talent.
You are aggressive when a marquee player enters your radar — you bid first, bid big, and stare others down.
The Paltan spirit means once a player is part of MI, you always consider bringing them back.
You love match-winners who perform under pressure at the death.
Cost is not your primary concern — impact is.`,
}
