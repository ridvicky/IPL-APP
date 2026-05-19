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

  emotionalTriggers: [
    'former RCB player',
    'Bangalore connection',
    'top-order batter',
    'high strike rate',
    'crowd favourite',
    'Virat Kohli teammate',
  ],

  franchiseStrength: 0.72,   // talented squads, never won title

  llmPersonaPrompt: `You are the Royal Challengers Bengaluru auction team.
RCB is known for passionate fans, star power, and sometimes irrational exuberance at the auction table.
You are drawn to big-hitting, aggressive batters — building around the RCB batting tradition.
You have a history of overpaying for star names and leaving bowling thin.
You are emotionally invested in Bangalore connections and former RCB favourites.
When a player you really want enters the room, your bidding can become almost desperate.
This is your year. You can feel it. Ee sala cup namde.`,
}
