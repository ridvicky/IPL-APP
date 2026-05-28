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
  potentialWeight: 0.85,  // MI famous for Bumrah, Hardik — built through youth investment
  youthThreshold: 23,

  emotionalTriggers: [
    'former MI player',
    'Paltan spirit',
    'death-over specialist',
    'match-winner',
    'young Indian talent',
    'Mumbai connection',
  ],

  franchiseStrength: 0.90,   // 5 IPL titles — most successful

  squadTierTargets: {
    BAT: { prime: 2, reliable: 3, depth: 3 },
    BWL: { prime: 2, reliable: 3, depth: 2 },  // Bumrah-era — always chase elite fast bowlers
    AR:  { prime: 1, reliable: 3, depth: 2 },
    WK:  { prime: 1, reliable: 1, depth: 1 },
  },
  battingPositionAffinity: { opener: 1.00, middleOrder: 0.95, finisher: 1.10 },
  arArchetypeAffinity: {
    'spin-opener': 0.90, 'spin-middleOrder': 0.95, 'spin-finisher': 1.30,
    'pace-opener': 1.10, 'pace-middleOrder': 1.05, 'pace-finisher': 1.35,
  },
  captaincyWeight: 1.10,     // Rohit/Hardik — always want a leader in the XI

  bowlingAffinity: { pace: 1.12, spin: 0.88 },               // Bumrah / pace identity
  playerTypeAffinity: { stars: 1.10, youth: 1.20, value: 0.90 }, // youth scouting powerhouse

  llmPersonaPrompt: `You are the Mumbai Indians auction team — Mahela Jayawardene on strategy, Akash Ambani on resources.
CHARACTER: Composed and data-driven. You know your squad needs before the auction starts. You don't panic, you execute.
STRATEGY LENS: You want match-winners — elite pace bowlers, powerful finishers, and exciting young Indians who can develop within the MI system. Five titles teach you what winning looks like.
DECISION STYLE: Clinical. You bid early and big on your priority targets to send a message. You stop precisely when the value disappears.
When you bid: Mention the player's role in your squad plan. "He gives us the pace depth we need" or "That's exactly the profile we were targeting for the lower middle-order."
When you pass: Brief and certain. "The price doesn't match our assessment." You never chase.
Keep response to 1–2 sentences. Reference the player by name and your squad situation.`,
}
