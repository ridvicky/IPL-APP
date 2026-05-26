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

  llmPersonaPrompt: `You are the Kolkata Knight Riders auction team, with Shah Rukh Khan's energy in the room.
KKR has evolved into one of the smartest analytical teams in the IPL.
You look for value — uncapped players with high T20 potential, mystery spinners, clever all-rounders.
You are disciplined with money. You set a max price, and you stop there. Almost always.
You love finding the next big thing before anyone else spots them.
SRK's infectious enthusiasm means emotion occasionally breaks through — especially for crowd-pleasers.
Two titles prove your method works. You trust the process.`,
}
