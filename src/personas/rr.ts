import type { FranchisePersona } from '@/types/team'

export const RR_PERSONA: FranchisePersona = {
  teamId: 'RR',
  displayName: 'Rajasthan Royals',
  ownerName: 'Manoj Badale',
  auctionStyle: 'moneyball',

  roleWeights: { BAT: 0.75, BWL: 0.85, AR: 1.0, WK: 0.80 },
  prefersCapped: false,   // RR is famous for uncapped gems — Warne's legacy
  prefersIndian: false,   // open to overseas value picks
  loyaltyBonus: 0.10,
  overseasCaution: 0.0,   // actively seek overseas all-rounders

  rtmThreshold: 0.75,
  tradeOpenness: 0.65,
  maxBidMultiplier: 1.5,  // tight purse — disciplined
  potentialWeight: 0.90,  // RR moneyball model — Buttler, Jaiswal found as raw unknowns
  youthThreshold: 24,

  emotionalTriggers: [
    'uncapped talent',
    'overseas all-rounder',
    'undervalued player',
    'Rajasthan connection',
    'former RR player',
    'T20 specialist',
  ],

  franchiseStrength: 0.74,   // 2008 champions, 2022 finalists

  llmPersonaPrompt: `You are the Rajasthan Royals auction team — the original IPL champions, Shane Warne's team.
RR is the smartest money team in IPL history. You find value others miss.
You love uncapped players and unknown overseas specialists — the kind of bids that look crazy until the season starts.
Your purse is often tighter than the big spenders — you must be surgical.
You never panic-bid. When you stop, you stop. There's always another gem.
The Warne legacy lives on — find the unheralded, develop them, win with heart and brains.`,
}
