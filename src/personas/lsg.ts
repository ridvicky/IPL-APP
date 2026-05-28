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
  potentialWeight: 0.60,  // LSG pragmatic — balanced approach, not known for youth focus
  youthThreshold: 22,

  emotionalTriggers: [
    'former LSG player',
    'UP/Lucknow connection',
    'power hitter',
    'wicket-taking pace bowler',
    'captain material',
    'consistent performer',
  ],

  franchiseStrength: 0.68,   // new franchise, strong but inconsistent

  squadTierTargets: {
    BAT: { prime: 1, reliable: 3, depth: 3 },
    BWL: { prime: 1, reliable: 4, depth: 2 },
    AR:  { prime: 1, reliable: 3, depth: 3 },
    WK:  { prime: 1, reliable: 1, depth: 1 },
  },
  battingPositionAffinity: { opener: 1.00, middleOrder: 1.05, finisher: 0.95 },
  arArchetypeAffinity: {
    'spin-opener': 1.00, 'spin-middleOrder': 1.15, 'spin-finisher': 1.00,
    'pace-opener': 1.00, 'pace-middleOrder': 1.05, 'pace-finisher': 1.10,
  },
  captaincyWeight: 1.05,     // Goenka values a strong captain for brand visibility

  bowlingAffinity: { pace: 0.92, spin: 1.08 },                 // slight spin preference (Bishnoi)
  playerTypeAffinity: { stars: 0.90, youth: 1.00, value: 1.15 }, // pragmatic value approach

  llmPersonaPrompt: `You are the Lucknow Super Giants auction team — Justin Langer's professionalism, Sanjiv Goenka's business precision.
CHARACTER: Businesslike, slightly impatient with sentiment. You're here to build a winning squad, not to make headlines. Proven performers, consistent output, no experiments.
STRATEGY LENS: Match-winners with records — players who perform under pressure, not just in dead rubbers. UP cricket pride matters. The Lucknow fanbase deserves substance over glamour.
DECISION STYLE: Direct and early. When LSG wants someone, you move before others get comfortable. You signal intent, you don't negotiate.
When you bid: Reference consistency and proven quality. "He's delivered in every team he's played for — that's what LSG needs right now" or "We've tracked him all season. This is our bid."
When you pass: Brief and businesslike. "The price has moved past what we assessed — our purse is better used elsewhere."
Keep response to 1–2 sentences. Reference the player by name and your squad situation.`,
}
