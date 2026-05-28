import type { FranchisePersona } from '@/types/team'

export const SRH_PERSONA: FranchisePersona = {
  teamId: 'SRH',
  displayName: 'Sunrisers Hyderabad',
  ownerName: 'Kalanithi Maran / Kavya Maran',
  auctionStyle: 'aggressive',

  roleWeights: { BAT: 0.85, BWL: 0.90, AR: 0.95, WK: 0.75 },
  prefersCapped: true,
  prefersIndian: false,   // SRH known for quality overseas picks
  loyaltyBonus: 0.12,
  overseasCaution: 0.0,  // actively want elite overseas players

  rtmThreshold: 0.70,
  tradeOpenness: 0.50,
  maxBidMultiplier: 2.0,
  potentialWeight: 0.65,  // SRH analytical — values stats over age per se
  youthThreshold: 24,

  emotionalTriggers: [
    'former SRH player',
    'Hyderabad connection',
    'elite overseas cricketer',
    'aggressive top-order batter',
    'wicket-taking bowler',
    'power play specialist',
  ],

  franchiseStrength: 0.76,   // 2016 champions, 2024 runners-up

  squadTierTargets: {
    BAT: { prime: 3, reliable: 4, depth: 2 },  // explosive openers-first identity (Head/Gill/Abhishek)
    BWL: { prime: 2, reliable: 3, depth: 1 },  // elite pace — Cummins tier
    AR:  { prime: 1, reliable: 3, depth: 2 },
    WK:  { prime: 1, reliable: 1, depth: 1 },
  },
  battingPositionAffinity: { opener: 1.20, middleOrder: 0.85, finisher: 0.95 },
  arArchetypeAffinity: {
    'spin-opener': 0.90, 'spin-middleOrder': 0.90, 'spin-finisher': 1.00,
    'pace-opener': 1.20, 'pace-middleOrder': 1.05, 'pace-finisher': 1.30,
  },
  captaincyWeight: 1.10,     // Kavya Maran wants a strong visible captain

  bowlingAffinity: { pace: 1.18, spin: 0.82 },                 // Cummins/Bumrah-type pace identity
  playerTypeAffinity: { stars: 1.15, youth: 1.05, value: 0.90 }, // aggressive stars + some youth

  llmPersonaPrompt: `You are the Sunrisers Hyderabad auction team — Daniel Vettori's precision, Kavya Maran's intensity.
CHARACTER: Intense, direct, no patience for caution. SRH plays to attack and you build to attack. You know what explosive cricket looks like and you pay for it.
STRATEGY LENS: Aggressive top-order batters who go from ball one — the Travis Head and Abhishek Sharma type. Elite pace bowlers who take wickets, not just contain. Overseas quality is never off the table.
DECISION STYLE: You signal your intent early. When SRH wants someone, the room knows it. You don't play games — you bid and you mean it.
When you bid: Reference the attacking identity. "He bats exactly the way SRH plays — we need that opener's mentality" or "That's a wicket-taking pacer — exactly what we were looking for."
When you pass: Still with conviction. "He doesn't fit our attacking template at that price — we'll look elsewhere."
Keep response to 1–2 sentences. Reference the player by name and your squad situation.`,
}
