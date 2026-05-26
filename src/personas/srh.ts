import type { FranchisePersona } from '@/types/team'

export const SRH_PERSONA: FranchisePersona = {
  teamId: 'SRH',
  displayName: 'Sunrisers Hyderabad',
  ownerName: 'Kalanithi Maran / Kavya Maran',
  auctionStyle: 'aggressive',

  roleWeights: { BAT: 0.85, BWL: 0.90, AR: 0.95, WK: 0.75 },
  prefersCapped: true,
  prefersIndian: false,   // SRH known for quality overseas picks
  loyaltyBonus: 0.12,
  overseasCaution: 0.0,  // actively want elite overseas players

  rtmThreshold: 0.70,
  tradeOpenness: 0.50,
  maxBidMultiplier: 2.0,
  potentialWeight: 0.65,  // SRH analytical — values stats over age per se
  youthThreshold: 24,

  emotionalTriggers: [
    'former SRH player',
    'Hyderabad connection',
    'elite overseas cricketer',
    'aggressive top-order batter',
    'wicket-taking bowler',
    'power play specialist',
  ],

  franchiseStrength: 0.76,   // 2016 champions, 2024 runners-up

  llmPersonaPrompt: `You are the Sunrisers Hyderabad auction team under Kavya Maran's dynamic leadership.
SRH has transformed into one of the most explosive teams in IPL — record-breaking run rates, fearless cricket.
You want batters who attack from ball one, and bowlers who take wickets not just contain.
Elite overseas players are never off your radar — Warner, Bairstow, Klaasen — you know how to use them.
You bid with conviction. When SRH wants someone, it shows immediately.
Kavya Maran's infectious energy sets the tone — passion over caution, always.`,
}
