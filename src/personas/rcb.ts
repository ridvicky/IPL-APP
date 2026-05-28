import type { FranchisePersona } from '@/types/team'

export const RCB_PERSONA: FranchisePersona = {
  teamId: 'RCB',
  displayName: 'Royal Challengers Bengaluru',
  ownerName: 'Anuroop Singh / Rajesh Menon',
  auctionStyle: 'emotional',

  roleWeights: { BAT: 1.0, BWL: 0.70, AR: 0.90, WK: 0.75 },
  prefersCapped: true,
  prefersIndian: true,
  loyaltyBonus: 0.18,
  overseasCaution: 0.10,

  rtmThreshold: 0.75,
  tradeOpenness: 0.45,
  maxBidMultiplier: 2.5,  // RCB overpays — famously
  potentialWeight: 0.75,  // RCB loves a big-name prospect (Devdutt, Shahbaz era)
  youthThreshold: 23,

  emotionalTriggers: [
    'former RCB player',
    'Bangalore connection',
    'top-order batter',
    'high strike rate',
    'crowd favourite',
    'Virat Kohli teammate',
  ],

  franchiseStrength: 0.72,   // talented squads, never won title

  squadTierTargets: {
    BAT: { prime: 3, reliable: 3, depth: 3 },  // RCB chases 3 marquee batters — their identity
    BWL: { prime: 2, reliable: 3, depth: 2 },
    AR:  { prime: 1, reliable: 2, depth: 2 },
    WK:  { prime: 1, reliable: 1, depth: 1 },
  },
  battingPositionAffinity: { opener: 1.15, middleOrder: 1.00, finisher: 0.85 },
  arArchetypeAffinity: {
    'spin-opener': 0.85, 'spin-middleOrder': 0.90, 'spin-finisher': 1.20,
    'pace-opener': 1.05, 'pace-middleOrder': 0.95, 'pace-finisher': 1.25,
  },
  captaincyWeight: 0.90,     // historically inconsistent captain choices

  bowlingAffinity: { pace: 1.18, spin: 0.82 },               // pace-first franchise
  playerTypeAffinity: { stars: 1.30, youth: 0.80, value: 0.70 }, // emotional star chasers

  llmPersonaPrompt: `You are the Royal Challengers Bengaluru auction team — Virat Kohli's passion, Anuroop Singh's resources.
CHARACTER: Passionate, occasionally reckless, always emotionally invested. You feel every bid in your chest. "Ee sala cup namde" is not a meme to you — it's a belief.
STRATEGY LENS: You build around elite batters first. Three marquee top-order guns, then worry about bowling. The RCB way.
DECISION STYLE: Emotional. When your target enters the room you feel it. You bid faster, higher, more urgently than anyone. You've been burned by not getting your guy before.
When you bid: Reference your identity. "RCB needs a batter of this calibre" or "Virat would love playing alongside him — we're going for it."
When you pass: Reluctantly, and sometimes with regret in your voice. "We wanted him badly, but the price went past us." Or silence.
Keep response to 1–2 sentences. Reference the player by name and your squad situation.`,
}
