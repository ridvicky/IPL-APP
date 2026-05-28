import type { FranchisePersona } from '@/types/team'

export const KKR_PERSONA: FranchisePersona = {
  teamId: 'KKR',
  displayName: 'Kolkata Knight Riders',
  ownerName: 'Shah Rukh Khan / Jay Mehta',
  auctionStyle: 'analytical',

  roleWeights: { BAT: 0.80, BWL: 0.85, AR: 1.0, WK: 0.75 },
  prefersCapped: false,   // KKR excels at finding value uncapped players
  prefersIndian: true,
  loyaltyBonus: 0.12,
  overseasCaution: 0.10,

  rtmThreshold: 0.65,
  tradeOpenness: 0.60,
  maxBidMultiplier: 1.6,  // disciplined — rarely goes crazy
  potentialWeight: 0.80,  // KKR academy known for turning uncapped talent into stars (Narine, Rinku)
  youthThreshold: 24,

  emotionalTriggers: [
    'former KKR player',
    'Kolkata connection',
    'mystery spinner',
    'T20 specialist',
    'uncapped hidden gem',
    'power hitter',
  ],

  franchiseStrength: 0.82,   // 3 IPL titles including 2024

  squadTierTargets: {
    BAT: { prime: 1, reliable: 3, depth: 3 },
    BWL: { prime: 1, reliable: 3, depth: 2 },
    AR:  { prime: 2, reliable: 3, depth: 3 },  // Narine/Russell all-rounder franchise identity
    WK:  { prime: 1, reliable: 1, depth: 1 },
  },
  battingPositionAffinity: { opener: 0.90, middleOrder: 1.10, finisher: 1.00 },
  arArchetypeAffinity: {
    'spin-opener': 1.35, 'spin-middleOrder': 1.05, 'spin-finisher': 0.90,
    'pace-opener': 1.15, 'pace-middleOrder': 0.90, 'pace-finisher': 1.30,
  },
  captaincyWeight: 1.00,     // SRK demands star power — captain helps

  bowlingAffinity: { pace: 0.85, spin: 1.15 },                // Narine/Chakravarthy spin identity
  playerTypeAffinity: { stars: 0.90, youth: 1.10, value: 1.10 }, // analytical value + youth

  llmPersonaPrompt: `You are the Kolkata Knight Riders auction team — Chandrakant Pandit's discipline, Shah Rukh Khan's star aura.
CHARACTER: Analytically sharp but occasionally theatrical when SRK energy takes over. You know the data, but you also know what Kolkata wants to see.
STRATEGY LENS: All-rounders first — Narine and Russell built this franchise. Mystery spinners, power-hitting ARs, and undervalued gems are your currency. You rarely chase marquee names unless they genuinely fit.
DECISION STYLE: Methodical with a flair for the dramatic reveal. You let other teams fight early, then step in decisively at the right moment.
When you bid: Reference the player's T20 skills or squad fit. "He's exactly the mystery spinner profile we've been looking for" or "That's the kind of power-hitting all-rounder who wins us finals."
When you pass: Controlled and firm. "The number went past our ceiling — KKR doesn't overpay." Sometimes SRK overrules you — note that tension.
Keep response to 1–2 sentences. Reference the player by name and your squad situation.`,
}
