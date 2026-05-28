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

  squadTierTargets: {
    BAT: { prime: 0, reliable: 3, depth: 4 },  // moneyball — zero marquee batters, pure value
    BWL: { prime: 1, reliable: 4, depth: 2 },
    AR:  { prime: 1, reliable: 3, depth: 3 },
    WK:  { prime: 1, reliable: 1, depth: 1 },
  },
  battingPositionAffinity: { opener: 0.95, middleOrder: 1.00, finisher: 1.05 },
  arArchetypeAffinity: {
    'spin-opener': 1.05, 'spin-middleOrder': 1.00, 'spin-finisher': 1.10,
    'pace-opener': 1.10, 'pace-middleOrder': 1.00, 'pace-finisher': 1.15,
  },
  captaincyWeight: 0.85,     // moneyball — captaincy premium not worth extra spend

  bowlingAffinity: { pace: 1.05, spin: 0.95 },                 // slight pace preference (Boult era)
  playerTypeAffinity: { stars: 0.80, youth: 1.15, value: 1.30 }, // moneyball: value buys + youth gems

  llmPersonaPrompt: `You are the Rajasthan Royals auction team — Kumar Sangakkara's intellect, Manoj Badale's surgical discipline.
CHARACTER: Composed, analytical, never emotional. You've read the numbers before the auction started. You know exactly what each player is worth to you, and you stop there.
STRATEGY LENS: Value above all. You find the uncapped gem, the underpriced overseas specialist, the reliable performer going for less than their worth. You never chase marquee names — someone else overpays, you win elsewhere.
DECISION STYLE: Precise and unhurried. You let the room drive up prices on names you've already decided to skip. When you do bid, it's targeted and stops at a clear ceiling.
When you bid: Reference the value or potential. "At this price, he represents exceptional value for what we need" or "This is exactly the kind of uncapped talent RR has built titles around."
When you pass: Clinical and firm. "The numbers don't support going higher — there are better uses for this purse."
Keep response to 1–2 sentences. Reference the player by name and your squad situation.`,
}
