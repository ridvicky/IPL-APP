import type { FranchisePersona } from '@/types/team'

export const PBKS_PERSONA: FranchisePersona = {
  teamId: 'PBKS',
  displayName: 'Punjab Kings',
  ownerName: 'Preity Zinta / Ness Wadia',
  auctionStyle: 'emotional',

  roleWeights: { BAT: 0.90, BWL: 0.80, AR: 0.90, WK: 0.80 },
  prefersCapped: true,
  prefersIndian: true,
  loyaltyBonus: 0.08,     // PBKS changes squads often — lower loyalty bonus
  overseasCaution: 0.10,

  rtmThreshold: 0.60,
  tradeOpenness: 0.50,
  maxBidMultiplier: 2.3,  // PBKS often overpays — a franchise known for impulse bids
  potentialWeight: 0.55,  // PBKS chases immediate impact more than long-term potential
  youthThreshold: 22,

  emotionalTriggers: [
    'big-hitting opener',
    'Punjab connection',
    'crowd-pleasing player',
    'former PBKS player',
    'proven match-winner',
    'aggressive batter',
  ],

  franchiseStrength: 0.62,   // never won, serial underachievers

  squadTierTargets: {
    BAT: { prime: 3, reliable: 4, depth: 2 },  // big-hitting stars — always chasing Kohli/Warner type openers
    BWL: { prime: 1, reliable: 3, depth: 2 },
    AR:  { prime: 1, reliable: 2, depth: 3 },
    WK:  { prime: 1, reliable: 1, depth: 1 },
  },
  battingPositionAffinity: { opener: 1.15, middleOrder: 0.90, finisher: 0.95 },
  arArchetypeAffinity: {
    'spin-opener': 0.90, 'spin-middleOrder': 0.95, 'spin-finisher': 1.15,
    'pace-opener': 1.10, 'pace-middleOrder': 1.00, 'pace-finisher': 1.25,
  },
  captaincyWeight: 0.80,     // PBKS has rotated captains often — less attached to the concept

  bowlingAffinity: { pace: 1.10, spin: 0.90 },                 // pace preference (Rabada/Archer era)
  playerTypeAffinity: { stars: 1.25, youth: 1.15, value: 0.80 }, // emotional star chasers + some youth scouting

  llmPersonaPrompt: `You are the Punjab Kings auction team — Preity Zinta's enthusiasm, Ricky Ponting's competitive fire.
CHARACTER: Excitable, optimistic, occasionally impulsive. This is the year. Every auction feels like the year. You feel the Punjab crowd's hunger — and you want to deliver.
STRATEGY LENS: Big-hitting, exciting cricketers. Stars who make the crowd roar. You love aggressive openers and hard-hitting players who can shift momentum.
DECISION STYLE: You can get swept up. A star name walks in and the paddle goes up before you've finished thinking. You sometimes regret it. You sometimes win because of it.
When you bid: Emotional and enthusiastic. "Punjab NEEDS this player — he's exactly the match-winner we've been missing" or "Go on, go on — don't let them take him!"
When you pass: Reluctantly, often after going one bid too far and pulling back. "We wanted him but it's gone past sensible now."
Keep response to 1–2 sentences. Reference the player by name and your squad situation.`,
}
