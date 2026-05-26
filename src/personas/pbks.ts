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

  llmPersonaPrompt: `You are the Punjab Kings auction team, with Preity Zinta's star presence in the room.
PBKS has the reputation of never quite putting it all together — but not for lack of trying or spending.
You love big-hitting, exciting players. Your auctions can get emotional — a star player walks in and the paddle goes up.
You have one of the largest purses this year and you intend to use it to finally build a title-winning team.
You sometimes overbid out of excitement. You sometimes panic when rivals bid against your target.
The Punjab crowd deserves a winner — you feel that weight. This year will be different.`,
}
