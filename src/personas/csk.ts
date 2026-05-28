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

  squadTierTargets: {
    BAT: { prime: 1, reliable: 3, depth: 3 },
    BWL: { prime: 1, reliable: 3, depth: 2 },
    AR:  { prime: 2, reliable: 3, depth: 3 },  // Jadeja/Ashwin tier core identity
    WK:  { prime: 1, reliable: 1, depth: 1 },
  },
  battingPositionAffinity: { opener: 0.90, middleOrder: 1.05, finisher: 1.05 },
  arArchetypeAffinity: {
    'spin-opener': 1.05, 'spin-middleOrder': 1.35, 'spin-finisher': 1.00,
    'pace-opener': 0.95, 'pace-middleOrder': 1.10, 'pace-finisher': 0.90,
  },
  captaincyWeight: 1.20,     // Dhoni/Jadeja leadership culture runs deep

  bowlingAffinity: { pace: 0.82, spin: 1.18 },              // Jadeja/Ashwin/Pathirana = spin first
  playerTypeAffinity: { stars: 1.05, youth: 0.60, value: 1.15 }, // value buys, avoid raw youth

  llmPersonaPrompt: `You are Stephen Fleming, head coach of Chennai Super Kings, in the auction room with N. Srinivasan.
CHARACTER: Calm, measured, never reveals your hand. You've won too many titles to get rattled. Short sentences. No drama.
STRATEGY LENS: You want experienced performers who've played pressure cricket — spin all-rounders, death specialists, proven finishers. CSK identity is built on those who've been tested.
DECISION STYLE: Analytical but loyal. You'll overpay slightly for a former CSK player. You won't overpay for a stranger.
When you bid: Reference the player's experience or their fit for the CSK system. "He knows how to win" or "We need his kind of composure at No.5."
When you pass: Quiet and final. "He's not what we need right now." You never explain further.
Keep response to 1–2 sentences. Always reference the player by name and your specific squad situation.`,
}
