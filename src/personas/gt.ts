import type { FranchisePersona } from '@/types/team'

export const GT_PERSONA: FranchisePersona = {
  teamId: 'GT',
  displayName: 'Gujarat Titans',
  ownerName: 'CVC Capital / Hardik Pandya (former) / Shubman Gill (captain)',
  auctionStyle: 'analytical',

  roleWeights: { BAT: 0.80, BWL: 0.90, AR: 1.0, WK: 0.75 },
  prefersCapped: false,
  prefersIndian: true,
  loyaltyBonus: 0.15,
  overseasCaution: 0.10,

  rtmThreshold: 0.72,
  tradeOpenness: 0.55,
  maxBidMultiplier: 1.65,
  potentialWeight: 0.75,  // GT built a champion squad on smart youth scouting (Sai Sudharsan)
  youthThreshold: 23,

  emotionalTriggers: [
    'former GT player',
    'Gujarat connection',
    'all-rounder',
    'death bowler',
    'team-first player',
    'uncapped prospect',
  ],

  franchiseStrength: 0.80,   // 2022 champions, 2023 runners-up

  squadTierTargets: {
    BAT: { prime: 1, reliable: 3, depth: 3 },
    BWL: { prime: 1, reliable: 4, depth: 2 },
    AR:  { prime: 2, reliable: 3, depth: 2 },  // analytical team-first AR-heavy approach
    WK:  { prime: 1, reliable: 1, depth: 1 },
  },
  battingPositionAffinity: { opener: 0.90, middleOrder: 1.05, finisher: 1.05 },
  arArchetypeAffinity: {
    'spin-opener': 1.10, 'spin-middleOrder': 1.20, 'spin-finisher': 0.95,
    'pace-opener': 1.00, 'pace-middleOrder': 1.05, 'pace-finisher': 1.20,
  },
  captaincyWeight: 1.15,     // Hardik/Gill identity — captain = team identity

  bowlingAffinity: { pace: 1.02, spin: 0.98 },                 // balanced (Shami pace, Rashid spin)
  playerTypeAffinity: { stars: 0.85, youth: 1.25, value: 1.10 }, // analytical hidden gems machine

  llmPersonaPrompt: `You are the Gujarat Titans auction team — Ashish Nehra's cricketing intellect, CVC Capital's analytical rigour.
CHARACTER: Methodical, team-first, no ego. You ask one question about every player: does he make us better as a unit? Individual star power is irrelevant without squad fit.
STRATEGY LENS: All-rounders and death specialists — these win T20 trophies. Hidden gems, youth with high ceilings, players who do the ugly work. GT doesn't need names on shirts.
DECISION STYLE: Research-driven and calm. You've done your homework. You have a valuation and you stop at it — no exceptions, no emotion, no chasing.
When you bid: Reference squad balance and fit. "He gives us an extra dimension in the death overs — that's exactly what GT's system needs" or "His potential fits our development pathway perfectly."
When you pass: Clean and final. "The price exceeds what he's worth to our squad construction — we move on." No regret.
Keep response to 1–2 sentences. Reference the player by name and your squad situation.`,
}
