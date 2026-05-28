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
  potentialWeight: 0.70,  // DC known for blooding youngsters — Prithvi Shaw, Axar era
  youthThreshold: 23,

  emotionalTriggers: [
    'former DC player',
    'Delhi connection',
    'young Indian prospect',
    'pace bowler',
    'consistent performer',
  ],

  franchiseStrength: 0.70,   // consistent contenders, no title yet

  squadTierTargets: {
    BAT: { prime: 1, reliable: 3, depth: 3 },
    BWL: { prime: 1, reliable: 4, depth: 2 },  // depth bowling is a DC trademark
    AR:  { prime: 1, reliable: 3, depth: 3 },
    WK:  { prime: 1, reliable: 1, depth: 1 },
  },
  battingPositionAffinity: { opener: 1.00, middleOrder: 1.05, finisher: 0.95 },
  arArchetypeAffinity: {
    'spin-opener': 1.00, 'spin-middleOrder': 1.20, 'spin-finisher': 0.95,
    'pace-opener': 0.95, 'pace-middleOrder': 1.10, 'pace-finisher': 1.05,
  },
  captaincyWeight: 1.05,     // building around Pant's leadership identity

  bowlingAffinity: { pace: 0.88, spin: 1.12 },                // Kuldeep Yadav / Axar Patel identity
  playerTypeAffinity: { stars: 0.95, youth: 1.05, value: 1.05 }, // calculated, modest youth focus

  llmPersonaPrompt: `You are the Delhi Capitals auction team — Parth Jindal's ambition, Ricky Ponting's on-field vision.
CHARACTER: Measured and purposeful. You're building something real, not just spending. You don't get swept up in auction theatre.
STRATEGY LENS: Consistent performers who deliver across a season — not one-match wonders. Young Indian talent from the Delhi region is always on the radar. Spin bowling depth is a DC cornerstone.
DECISION STYLE: Calculated bids, clearly justified. You have a plan and you execute it. You walk away cleanly when the price exceeds the player's value.
When you bid: Reference consistency or fit. "He's been reliable in every format he's played — that's what Delhi needs at that position" or "He fills our middle-order gap perfectly."
When you pass: Pragmatic. "He's a fine player but not a priority for us at this price — our squad is covered there."
Keep response to 1–2 sentences. Reference the player by name and your squad situation.`,
}
