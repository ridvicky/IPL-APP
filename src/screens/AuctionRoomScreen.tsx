import { useEffect, useCallback, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { tap, action, confirm, success, warning } from '@/utils/haptics'
import { Button } from '@components/ui/Button'
import { LoadingSpinner } from '@components/ui/LoadingSpinner'
import { PlayerCard } from '@components/auction/PlayerCard'
import { BidTimeline } from '@components/auction/BidTimeline'
import { UserActionPanel } from '@components/auction/UserActionPanel'
import { TeamPaddles } from '@components/auction/TeamPaddles'
import { OpponentReactions } from '@components/auction/OpponentReactions'
import { SaleResult } from '@components/auction/SaleResult'
import { BottomNav } from '@components/ui/BottomNav'
import { TeamBadge } from '@components/ui/TeamBadge'
import { useGameStore } from '@/store/gameStore'
import { useSessionStore } from '@/store/sessionStore'
import { loadSession } from '@/session/sessionManager'
import {
  userBid, userInterruptBid, userPass, userSkipPlayer, userExerciseRTM, userDeclineRTM,
  pickAIAcceleratedPlayers, ACCELERATED_TOTAL, USER_MAX_PICKS_R1, USER_MAX_PICKS_R2,
  runOneAIDecision, isBiddingOver, resolvePlayerSale,
  startPlayerAuction, advanceAuction,
  simulateRemainingSet, simulateOneSet, simulateRemainingAuction,
} from '@/controllers/auctionController'
import { getCurrentAuctionPlayer } from '@/engine/biddingEngine'
import { getBidIncrement, getPlayersInSet, loadDataset } from '@/dataset/datasetLoader'
import { fetchAuctioneerComment, getFormContext } from '@/llm/personaLayer'
import type { AuctionDataset } from '@/types/dataset'
import type { GameState } from '@/types/game'
import type { TeamId } from '@/types/team'

const BID_TIMER_SECONDS    = 10
const BASE_AI_DELAY_MS     = 350   // scaled by speed
const BASE_CALL_MS         = 1500  // scaled by speed (was 3000)

type CallingStage = 0 | 1 | 2 | 3   // 0=none, 1=going once, 2=twice, 3=thrice→SOLD

const STAGE_TEXT = ['', 'Going once…', 'Going twice…', '🔨 SOLD!']
const STAGE_SUB  = ['', 'Any advance?', 'Last chance to bid!', '']

// ─── Mobile Owner Reactions Feed ─────────────────────────────────────────────

const TEAM_HEX: Record<string, string> = {
  CSK: '#f5a623', MI: '#005da0', RCB: '#c8102e', KKR: '#3a225d',
  DC: '#1a5276',  RR: '#ea1a8e', SRH: '#f26522', PBKS: '#d71921',
  GT: '#1d3461',  LSG: '#1abc9c',
}

const TEAM_CHIP_COLORS: Record<string, string> = {
  CSK: 'text-yellow-300 bg-yellow-400/10 border-yellow-500/30',
  MI:  'text-blue-300 bg-blue-400/10 border-blue-500/30',
  RCB: 'text-red-300 bg-red-400/10 border-red-500/30',
  KKR: 'text-purple-300 bg-purple-400/10 border-purple-500/30',
  DC:  'text-sky-300 bg-sky-400/10 border-sky-500/30',
  RR:  'text-pink-300 bg-pink-400/10 border-pink-500/30',
  SRH: 'text-orange-300 bg-orange-400/10 border-orange-500/30',
  PBKS:'text-rose-300 bg-rose-400/10 border-rose-500/30',
  GT:  'text-cyan-300 bg-cyan-400/10 border-cyan-500/30',
  LSG: 'text-teal-300 bg-teal-400/10 border-teal-500/30',
}


type OwnerSituation = 'bidding' | 'aggressive' | 'thinking' | 'passing' | 'not_my_type' | 'outbid' | 'won'

const OWNER_LINES: Record<string, Record<OwnerSituation, string[]>> = {
  CSK: {
    bidding: [
      "Thala's kind of player. Calm under pressure.",
      "Yellove this one. He fits our system.",
      "Chennai doesn't do panic buys. This is strategy.",
      "Dhoni would back this call. So do we.",
      "Every great CSK squad has a player like him.",
      "Experience isn't cheap. But it wins you trophies.",
      "The fans back home already know his name.",
      "We've tracked him all season. This is our bid.",
      "He keeps his head when it matters. CSK trait.",
      "This is the Chennai way — measured, smart, decisive.",
      "Whistle Podu territory. Let's get it done.",
      "He's got the temperament we build squads around.",
    ],
    aggressive: [
      "Don't test CSK. We finish what we start.",
      "Five finals. We know how to win auctions too.",
      "Chennai doesn't lose players it targets. Keep going.",
      "We'll go to the wall for him. Simple as that.",
      "Other teams can sit down — this one's ours.",
      "Raise it. CSK doesn't flinch at a number.",
      "Thala approved. We're not stopping here.",
      "This is non-negotiable. Keep bidding.",
    ],
    thinking: [
      "Hmm. Let the room breathe a bit…",
      "We're doing the maths. Give us a second.",
      "Fleming's on the phone. Hold tight.",
      "Patience is a CSK superpower. We're watching.",
      "Interesting. Let's see who blinks first.",
      "Not yet. Let them show us how desperate they are.",
      "We have time. CSK always has time.",
    ],
    passing: [
      "Not our gap to fill today. Let them have it.",
      "Doesn't fit the yellow army. Simple.",
      "We'll pass. There's smarter money to spend.",
      "CSK builds slow and right. This isn't right.",
      "Let someone else overpay. We'll be fine.",
      "We have that covered. Move on.",
    ],
    not_my_type: [
      "Good player. Just not a CSK player.",
      "He'd struggle in our system, honestly.",
      "Not the profile Dhoni builds around.",
      "Chennai needs temperament first. Talent second.",
      "We're not chasing hype. Definitely not this one.",
      "Wrong fit. No hard feelings.",
    ],
    outbid: [
      "Good luck. They'll need it at that price.",
      "Overpaid. We'll be proven right in May.",
      "Not at that number. No regrets.",
      "Chennai moves on. Always does.",
      "They wanted him more. Fine. We have a plan.",
      "We've lost battles before. Never wars.",
    ],
    won: [
      "Whistle Podu! Welcome to the yellow family!",
      "Thala's going to love working with him!",
      "Chennai just got better. Significantly.",
      "Another piece of the CSK puzzle. Locked in.",
      "Yellove wins again. See you at Chepauk!",
    ],
  },

  MI: {
    bidding: [
      "Mumbai identifies talent three years before anyone else does.",
      "Five titles. You think we don't know what works?",
      "This is exactly the profile we targeted in pre-auction.",
      "Impact every single game — that's the MI standard.",
      "He passes the Wankhede test. We want him.",
      "Rohit's already sent a message. We're going for this.",
      "The Paltan needs match-winners. He qualifies.",
      "MI doesn't gamble. This is calculated aggression.",
      "When we want someone, we get them. Always.",
      "Blue and gold looks good on him. Let's make it official.",
      "System player. High IQ. MI through and through.",
      "We've done homework on this one since last season.",
    ],
    aggressive: [
      "Mumbai doesn't flinch at a number. Raise it.",
      "Five titles don't come from being shy in auctions.",
      "This is a must-have. Absolutely non-negotiable.",
      "Paltan needs him. We're not leaving without him.",
      "MI plays to win every single year. Fund it.",
      "Keep going. We're not done until it's ours.",
      "Other teams can't afford to match us. We know that.",
    ],
    thinking: [
      "Jayawardene's running the numbers. One second.",
      "Interesting valuation. Let it develop.",
      "We're patient. The Paltan is always patient.",
      "MI doesn't rush bids. We move at our pace.",
      "Let the room talk first. Then we'll respond.",
      "Watching carefully. Very carefully.",
    ],
    passing: [
      "Not our gap. Someone else's problem.",
      "Mumbai passes. Bigger priorities today.",
      "Numbers don't add up for the Paltan.",
      "We have options. Don't need this one.",
      "MI moves on. No drama.",
    ],
    not_my_type: [
      "Not a Wankhede crowd pleaser, honestly.",
      "Doesn't fit our batting order structure.",
      "MI builds different. This player's different in the wrong way.",
      "Not the archetype we win titles with.",
      "Rohit wouldn't vibe with this selection.",
    ],
    outbid: [
      "They'll regret it. Mark those words.",
      "Too rich. MI keeps the war chest for what matters.",
      "We play the long game. Always have.",
      "Good luck to them. They'll need a miracle at that price.",
      "Mumbai recovers. That's what five-time champions do.",
    ],
    won: [
      "Mumbai Paltan gets stronger! Let's go!",
      "Blue and gold — couldn't be a better fit!",
      "Welcome to the most successful franchise in IPL history!",
      "Wankhede is going to go absolutely berserk for this one.",
      "MI builds dynasties. One signing at a time.",
    ],
  },

  RCB: {
    bidding: [
      "RCB needs this. The fans deserve this.",
      "Ee sala cup namde — and he's part of the plan.",
      "Bangalore bets big. Always. It's in our DNA.",
      "This is the calibre of player we've been missing.",
      "Faf would love this lad in the dressing room.",
      "Royal Challengers don't do average signings.",
      "The red army back home is screaming for this player.",
      "We go all-in every year. This bid's no different.",
      "History changes with bold decisions. Let's be bold.",
      "Bangalore + this player = dangerous. Very dangerous.",
      "Every RCB era needs its defining signings. This is one.",
      "Du Plessis is already excited. We're going.",
    ],
    aggressive: [
      "We're not letting Bangalore down AGAIN. Raise it!",
      "RCB is all-in. No ceiling when the Cup is on the line.",
      "No hesitation! Bangalore plays for glory!",
      "This is our year and he's going to be a massive part of it!",
      "We've been this close too many times. Go harder!",
      "The red army doesn't accept second place. Neither do we.",
    ],
    thinking: [
      "The heart says bid. The head is… also saying bid.",
      "Hmm. Let me convince myself this is smart. … done. Bidding.",
      "We're calculating. RCB calculates sometimes.",
      "Mike Hesson is somewhere right now looking very concerned.",
      "The purse, the fit, the dream… all pointing the same way.",
      "Virat would want him. That's usually enough for us.",
    ],
    passing: [
      "Bigger targets today. We pass.",
      "Not the RCB profile this time around.",
      "Bangalore has bigger fish to fry.",
      "We'll sit this one out. Strategically.",
      "Our cup dreams lie with a different player.",
    ],
    not_my_type: [
      "Ee sala? Not with him, honestly.",
      "Not what Bangalore's batting order needs.",
      "We need big-game players. This isn't that.",
      "RCB doesn't do conservative selections.",
      "Wrong energy for the red army.",
    ],
    outbid: [
      "Story of our lives. We move and we believe.",
      "Someone always outbids RCB. It's tradition apparently.",
      "Fine. More purse for the player we ACTUALLY want.",
      "Ee sala cup namde — just not with him. We'll find our guy.",
      "Not even bitter. The Cup hunt continues.",
      "Their auction, their overpay. We're fine.",
    ],
    won: [
      "EE SALA CUP NAMDE! He's OURS! Red army rise!",
      "BANGALORE! Your Royal Challengers just got DANGEROUS!",
      "The RCB faithful are going absolutely wild right now!",
      "Faf, Virat, Kohli — they'll love playing alongside him!",
      "One step closer. One bold signing at a time.",
    ],
  },

  KKR: {
    bidding: [
      "Korbo Lorbo Jeetbo — we start with winning this bid.",
      "Eden Gardens is calling this player's name already.",
      "KKR identifies value others can't see. That's the edge.",
      "Shreyas built this culture. He'd love this addition.",
      "Purple and gold looks great on match-winners.",
      "Knight Riders don't build collections — we build squads.",
      "Two titles. We know exactly what winning looks like.",
      "The mystery of KKR is in signings like this.",
      "Narine would appreciate having him around.",
      "Chandrakant Pandit's already planning his role.",
      "Eden roars for quality. This qualifies.",
      "KKR does its homework. The data says yes.",
    ],
    aggressive: [
      "KKR doesn't leave the auction room empty-handed.",
      "Korbo Lorbo Jeetbo — and we start RIGHT NOW.",
      "Two-time champions know how to finish bids.",
      "Purple is committed. Completely committed.",
      "Keep going. Eden deserves nothing less.",
      "We want him and we're making that very clear.",
    ],
    thinking: [
      "Interesting. Let's see where this takes us.",
      "Pandit's crunching the lineup fit. Give us a moment.",
      "The KKR analytics team is earning their salaries right now.",
      "Strategic patience. That's all this is.",
      "We watch before we pounce. That's how KKR hunts.",
    ],
    passing: [
      "Not the KKR template. We exit gracefully.",
      "Eden Gardens has other priorities today.",
      "KKR passes — strategically, always strategically.",
      "This profile doesn't build dynasties. We know what does.",
      "We move on. The right player is coming.",
    ],
    not_my_type: [
      "Doesn't fit the Eden Gardens vibe at all.",
      "KKR needs mystery and impact. This is neither.",
      "Wrong kind of dangerous for purple and gold.",
      "Not the archetypal Knight Rider. Hard pass.",
      "Pandit's shaking his head from the box.",
    ],
    outbid: [
      "They wanted him more. Respect that, actually.",
      "Our strategy remains intact. Untouched.",
      "KKR doesn't chase. We plan three moves ahead.",
      "Fine. The real target's coming up.",
      "Winning the auction means nothing. Winning matches does.",
    ],
    won: [
      "KORBO LORBO JEETBO! He's a KNIGHT RIDER!",
      "Eden Gardens is going to absolutely lose it tonight!",
      "Purple and gold just got a whole lot scarier!",
      "Pandit's already planning the batting order around him!",
      "Champions keep building. This is how it's done.",
    ],
  },

  DC: {
    bidding: [
      "Delhi plays bold. This is a bold bid.",
      "Ponting's instinct said yes. That's usually right.",
      "Capitals don't do safe — we do smart.",
      "This player fits our attacking game plan perfectly.",
      "The data team flagged him months ago. Time to act.",
      "Delhi's future is being built right now. Brick by brick.",
      "Young, hungry, Delhi-ready. What more do you want?",
      "Consistent in pressure — exactly the Delhi Capitals profile.",
      "He fills the exact gap we identified pre-auction.",
      "The capital city demands quality. He delivers it.",
      "Axar would love this combination. Let's go.",
      "DC doesn't second-guess when the profile is right.",
    ],
    aggressive: [
      "Delhi is going to the WALL on this one.",
      "Capitals commit when they believe. We believe completely.",
      "No ceiling today. He's a Delhi Capitals player.",
      "Ponting's on his feet. That means we keep going.",
      "DC doesn't apologise for wanting the best. Keep raising.",
    ],
    thinking: [
      "Ponting's watching. That's usually meaningful.",
      "Delhi thinks before Delhi bids. Still thinking.",
      "We're deliberate. Not hesitant — deliberate.",
      "Our analytics are saying three different things. Sorting it.",
      "Interesting price point. Let's see.",
    ],
    passing: [
      "Not the Delhi priority today. We move.",
      "DC has smarter uses for this budget.",
      "Capitals concede this one. Strategically.",
      "Our squad gaps lie in a different direction.",
      "Next. Delhi keeps moving forward.",
    ],
    not_my_type: [
      "Not the Delhi blueprint. Hard pass.",
      "Doesn't match what Ponting looks for in a player.",
      "DC builds with purpose. This doesn't serve the purpose.",
      "Too one-dimensional for what we need.",
      "The Capitals are building something specific. This isn't it.",
    ],
    outbid: [
      "Outbid but never outthought. That's Delhi.",
      "They paid over the odds. We'll be fine.",
      "Ponting's already moved on. So should we.",
      "DC finds answers. Different ones if needed.",
      "Next player. Delhi stays focused.",
    ],
    won: [
      "Delhi Capitals get STRONGER! That's how you build!",
      "The capital city is celebrating tonight!",
      "Ponting gave the nod — that means everything here!",
      "DC adds another quality piece to the puzzle!",
      "Bold, smart, and now OURS. Delhi winning the auction!",
    ],
  },

  RR: {
    bidding: [
      "Rajasthan sees value where others see mediocrity.",
      "Moneyball is alive and thriving in Jaipur.",
      "The analytics said bid. Sangakkara agrees. We go.",
      "Undervalued by the market. Perfectly valued by us.",
      "RR doesn't chase names. We chase impact.",
      "Pink army identifies talent early. This is early.",
      "Sanju already knows what this player brings.",
      "Value isn't always obvious. That's why we win.",
      "The data doesn't lie. This is a buy.",
      "Jaipur builds smart. This is a smart bid.",
      "Smart over flashy — that's the Royals way.",
      "We saw this coming three months ago. Finally time.",
    ],
    aggressive: [
      "When RR sees value, Rajasthan goes ALL in.",
      "The pink army is committed. Completely committed.",
      "Our analysts say go. We trust our analysts.",
      "Value identified — we protect it at any price.",
      "Sangakkara's up from his seat. That means something.",
      "RR doesn't let value walk out the door.",
    ],
    thinking: [
      "Is the premium justified? Running the numbers…",
      "Hmm. The value curve is shifting. Watching.",
      "Sangakkara looks calm. He's never actually calm.",
      "Moneyball has a formula. Checking it now.",
      "Let the room move a little more. Then we'll judge.",
    ],
    passing: [
      "The value isn't there anymore. We pass.",
      "RR discipline — when it's gone, it's gone.",
      "Rajasthan plays the long game. This isn't it.",
      "Our analysts said no. We listen to our analysts.",
      "Better value is definitely coming. We trust that.",
    ],
    not_my_type: [
      "Doesn't fit the RR value matrix. Simple.",
      "Rajasthan doesn't buy hype. This is all hype.",
      "Not the profile that wins you trophies here.",
      "Wrong player for the Jaipur formula.",
      "Our moneyball model is shaking its head.",
    ],
    outbid: [
      "They overpaid. The formula survives. We're good.",
      "RR discipline preserved. Sangakkara would agree.",
      "The numbers didn't justify it. Correct call.",
      "Good. More purse for the actual value picks.",
      "Jaipur moves on — calculated, as always.",
    ],
    won: [
      "VALUE IDENTIFIED. VALUE CAPTURED. Pink army rises!",
      "Rajasthan WINS this battle of wits! Sanju's smiling!",
      "The moneyball formula strikes again! Classic RR!",
      "Jaipur! Your Royals just signed EXACTLY who they needed!",
      "Smart over flashy. Every. Single. Time.",
    ],
  },

  SRH: {
    bidding: [
      "Sunrisers want pace, aggression, and IMPACT. He's it.",
      "Orange Army doesn't wait — we attack from the jump.",
      "Hyderabad has a vision. He fits it perfectly.",
      "Kavya said go. We go.",
      "SRH wants match-winners who change games in six balls.",
      "He attacks from ball one. That's Sunrisers cricket.",
      "The orange doesn't stand for caution. We bid.",
      "Hyderabad's been building something dangerous. He adds to it.",
      "Pat Cummins would love this teammate. Let's get it done.",
      "SRH knows fast bowling. We know this man.",
      "The sunrise is brightest when we sign players like this.",
      "Vettori's already mapping the XI around him.",
    ],
    aggressive: [
      "SUNRISERS ATTACK. Always. Non-negotiable.",
      "Orange Army wants blood — and this player. Raise it.",
      "We go hard or we go home. We're going HARD.",
      "Hyderabad commits completely. No retreat from this.",
      "SRH takes what it targets. We target him.",
      "Kavya's standing up. That's the signal. GO.",
    ],
    thinking: [
      "Vettori's calculating fit versus price. Give us a moment.",
      "Orange Army watches. And calculates. And watches more.",
      "We want him. Price is the question. Working on it.",
      "SRH is in. Just deciding HOW in we are.",
      "Let it breathe. We'll know our moment.",
    ],
    passing: [
      "Doesn't fit the SRH attack blueprint.",
      "Orange Army has better targets today.",
      "Not what Hyderabad's looking for this auction.",
      "We concede this one. Bigger fish ahead.",
      "SRH passes — the dawn rises elsewhere.",
    ],
    not_my_type: [
      "SRH needs destroyers. This is a consolidator.",
      "Doesn't have that Sunrisers aggression we need.",
      "Wrong energy for the orange army.",
      "He's good. Just not Hyderabad-good.",
      "Vettori's already looking away. That's our answer.",
    ],
    outbid: [
      "They can have him at THAT price. Absolute insanity.",
      "SRH keeps the plan. Keeps the purse. Keeps the patience.",
      "Orange Army adapts. We always find the pace we need.",
      "No drama. Hyderabad moves forward — as always.",
      "We'll find our fast bowler. This wasn't him.",
    ],
    won: [
      "RISE, SUNRISERS! He's OURS! Orange army go!",
      "Hyderabad is going to be absolutely ELECTRIC this season!",
      "Pat Cummins has a new teammate — and he's going to LOVE him!",
      "The orange army grows STRONGER! Watch out, everyone!",
      "SRH just got more dangerous. Significantly more dangerous.",
    ],
  },

  PBKS: {
    bidding: [
      "Punjab NEEDS this. Full stop.",
      "Preity's up in the box — that means we're serious.",
      "Lions of Punjab don't miss quality when they see it.",
      "Shubman would love this combination. We're going for it.",
      "PBKS has the purse and absolutely the intention.",
      "This is the player that changes everything for Punjab.",
      "Red army, red mist — we want this player badly.",
      "Kings don't settle. Not today, not ever.",
      "He's exactly the impact player Mohali screams for.",
      "Punjab has been patient long enough. This is the one.",
      "That profile — THAT is what wins you a title.",
      "Sher Punjab has spotted its prey. We pounce.",
    ],
    aggressive: [
      "PUNJAB IS GOING TO THE WALL ON THIS ONE!",
      "Kings don't flinch. We KEEP RAISING.",
      "PBKS has the purse — we're going to use every last rupee!",
      "Lions of PUNJAB ROAR! He's OURS! Keep going!",
      "Preity's screaming. That means NO ceiling today!",
      "Don't you DARE let someone else take him!",
    ],
    thinking: [
      "We want him. Question is how much we want him.",
      "Preity's got that look. Working out if this is the moment.",
      "Punjab evaluates fast. Very fast. Almost done.",
      "The fit is undeniable. The price is a conversation.",
      "Lions hunt when ready. We're almost ready.",
    ],
    passing: [
      "Not the Punjab Kings priority today. Reluctantly.",
      "PBKS passes — bigger targets to save for.",
      "Lions conserve for the right prey.",
      "Our squad needs something else more urgently.",
      "Not our moment. Our moment's coming though.",
    ],
    not_my_type: [
      "Mohali crowd won't go crazy for this one. We pass.",
      "Not a Punjab Kings player. We know our players.",
      "Wrong kind of impact for what PBKS needs.",
      "He'd be great elsewhere. Not here though.",
      "Not the match-winner Punjab's been waiting for.",
    ],
    outbid: [
      "They paid over the odds. Punjab's war chest stays healthy.",
      "No regrets — the lions know what they're saving for.",
      "PBKS moves on. Calculated, not defeated.",
      "We keep the purse for the player we ACTUALLY want.",
      "The auction is long. Punjab is PATIENT.",
    ],
    won: [
      "SHER PUNJAB! HE'S OURS! Kings CLAIM another one!",
      "Mohali is going to go ABSOLUTELY MENTAL for this player!",
      "Punjab Kings just got the match-winner they've been dreaming of!",
      "Preity's ecstatic and honestly? So is everyone in Punjab!",
      "This. Is. The. PBKS. ERA. Right here!",
    ],
  },

  GT: {
    bidding: [
      "Gujarat Titans builds on merit. He has it.",
      "Nehra's already mapped out his role in the XI.",
      "Squad balance over star power — this delivers both.",
      "Titans identify character. He has that in abundance.",
      "Two titles came from getting calls like this right.",
      "Ahmedabad wants winners, not just talent. He qualifies.",
      "GT doesn't panic-buy. This is the opposite of that.",
      "The numbers, the fit, the character — all line up.",
      "Shubman's input on this was clear. We trust him.",
      "Methodical is our brand. This is a methodical bid.",
      "Titans don't lose players they've identified. Going.",
      "Gill already texted Nehra. We know what that means.",
    ],
    aggressive: [
      "Titans don't lose players they target. We go.",
      "Gujarat commits when it believes. We believe fully.",
      "Two titles don't come from backing down. Keep bidding.",
      "GT goes for the jugular when the moment arrives.",
      "Ahmedabad has spoken. He wears Titans blue.",
      "This is when champions separate themselves. We go.",
    ],
    thinking: [
      "Nehra's calculating exactly what role he fills. Methodically.",
      "Titans assess. We never rush. Never.",
      "The data team's still running the squad-balance numbers.",
      "Patience built two titles for us. It's working.",
      "Let's see where this lands. Then we'll move.",
    ],
    passing: [
      "Doesn't fit the Titans system. Respectfully.",
      "GT has better allocation targets this auction.",
      "Ahmedabad builds differently. This isn't the build.",
      "Not the GT formula. We pass with confidence.",
      "Titans exit — strategically, always strategically.",
    ],
    not_my_type: [
      "Won't win you IPL titles. GT knows what does.",
      "Not the character archetype we build around.",
      "Nehra's already looking at the next player.",
      "GT doesn't buy names. We buy championship DNA.",
      "Wrong fit for Ahmedabad's model. No debate.",
    ],
    outbid: [
      "Let them have it. Our plan adapts flawlessly.",
      "GT has contingencies. This is just the plan activating.",
      "Titans lose this battle — the war plan remains intact.",
      "Ahmedabad stays calm. We're always calm.",
      "Two titles came from getting this part right too.",
    ],
    won: [
      "JAI GUJARAT! Another Titan RISES! The machine grows!",
      "Ahmedabad got exactly what it came for today!",
      "The Titans system just got a major upgrade!",
      "Championship mentality meets championship signing. That's GT.",
      "Nehra is VERY happy. That's when you know it's right.",
    ],
  },

  LSG: {
    bidding: [
      "Lucknow Super Giants targets the overlooked. This is that.",
      "Goenka said go. KL Rahul agrees. Good enough for us.",
      "LSG doesn't build on ego. We build on impact.",
      "Super Giants identifies value before the room wakes up.",
      "Lucknow is young, hungry, ambitious — like him.",
      "The data team pinged this one months ago. Time to act.",
      "We want consistency and he's delivered it every season.",
      "KL Rahul knows quality. He knows this is quality.",
      "Lucknow has the purse and the hunger. Let's go.",
      "LSG process identified him. The process doesn't lie.",
      "Super Giants build without ego and with absolute clarity.",
      "He's the player who makes everyone around him better.",
    ],
    aggressive: [
      "Super Giants don't back down when they've found their man.",
      "Lucknow is ALL-IN. Right now. No hesitation.",
      "LSG found its player — we're not leaving without him.",
      "The Super Giants have spoken. Keep raising it.",
      "KL Rahul wants him that badly. That's all we need to know.",
      "Goenka's committed. That means WE'RE committed.",
    ],
    thinking: [
      "KL Rahul is very quiet right now. That's interesting.",
      "LSG monitors everything before moving. Still monitoring.",
      "Super Giants weighs every single rupee. Almost done.",
      "Lucknow is deliberate. Not hesitant — deliberate.",
      "We enter when the moment is precisely right. Almost there.",
    ],
    passing: [
      "Not the LSG profile this time. We move on.",
      "Lucknow Super Giants passes — strategically.",
      "Our squad gap is in a different position.",
      "Super Giants has other plans for this money.",
      "Eyes forward. LSG always looks forward.",
    ],
    not_my_type: [
      "Doesn't match the Lucknow system at all.",
      "KL Rahul wouldn't build around this profile.",
      "Not what the Super Giants are constructing.",
      "Too inconsistent for what LSG demands.",
      "Goenka's already moved his attention elsewhere.",
    ],
    outbid: [
      "Too expensive. But the discipline was the right call.",
      "LSG keeps its cool. Always. That's the Super Giants way.",
      "We adapt and find the answer elsewhere. We always do.",
      "Lucknow is patient. The auction still has chapters left.",
      "Our process survives. The process always survives.",
    ],
    won: [
      "LUCKNOW ROARS! Super Giants add the missing piece!",
      "KL Rahul's got a new teammate and he is DELIGHTED!",
      "LSG just made a statement! Super Giants are HERE!",
      "Goenka wanted this. The fans wanted this. DONE.",
      "The Super Giants rise HIGHER! What a signing!",
    ],
  },
}

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)]
}

function getOwnerThought(
  teamId: string,
  bid: number,
  _state: GameState,
  situation: OwnerSituation = 'bidding',
): string | null {
  const bank = OWNER_LINES[teamId]
  if (!bank) return null
  const pool = bank[situation]
  if (!pool?.length) return null
  // Suppress very cheap bids for thinking/passing — too noisy
  if (bid < 3 && (situation === 'thinking' || situation === 'bidding')) return null
  return pick(pool)
}


// Dugout feed is now managed via state in AuctionRoomScreen — no standalone component needed

export function AuctionRoomScreen() {
  const navigate = useNavigate()
  const { id: sessionIdParam } = useParams<{ id?: string }>()
  const { gameState, initFromSession } = useGameStore()
  const { setActiveSession } = useSessionStore()
  const [dataset, setDataset] = useState<AuctionDataset | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [resuming, setResuming] = useState(false)
  const [aiRunning, setAiRunning] = useState(false)
  const [timeLeft, setTimeLeft] = useState(BID_TIMER_SECONDS)
  const [callingStage, setCallingStage] = useState<CallingStage>(0)

  const [menuOpen, setMenuOpen] = useState(false)
  const [quitConfirm, setQuitConfirm] = useState(false)
  const [speed, setSpeed] = useState<1 | 2 | 3>(() => (Number(localStorage.getItem('auctionSpeed')) as 1|2|3) || 1)
  const [auctioneeerLine, setAuctioneeerLine] = useState<string | null>(null)
  const [paused, setPaused] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [simProgress, setSimProgress] = useState(0)
  const [dugoutFeed, setDugoutFeed] = useState<{ teamId: TeamId; comment: string; ts: number }[]>([])

  const aiLoopRef = useRef(false)
  const simStopRef = useRef(false)
  const callingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hasAutoPassedRef = useRef(false)
  const speedRef = useRef<1|2|3>(speed)
  const commentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pausedRef = useRef(false)

  useEffect(() => {
    speedRef.current = speed
    localStorage.setItem('auctionSpeed', String(speed))
  }, [speed])

  useEffect(() => { pausedRef.current = paused }, [paused])

  const showComment = useCallback((text: string) => {
    if (commentTimerRef.current) clearTimeout(commentTimerRef.current)
    setAuctioneeerLine(text)
    commentTimerRef.current = setTimeout(() => setAuctioneeerLine(null), 6000)
  }, [])

  // ── Session resume from URL param (/session/:id) ─────────────────────────
  useEffect(() => {
    if (!sessionIdParam) return
    // If already loaded with the right session, skip
    if (gameState?.sessionId === sessionIdParam) return
    setResuming(true)
    loadSession(sessionIdParam)
      .then(session => {
        if (!session) {
          setActionError('Session not found. It may have been deleted.')
          return
        }
        initFromSession(session)
        setActiveSession(session)
      })
      .catch(e => setActionError(`Failed to load session: ${String(e)}`))
      .finally(() => setResuming(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionIdParam])

  // ── Dataset ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!gameState) return
    loadDataset(gameState.auctionYear)
      .then(setDataset)
      .catch(e => setActionError(`Failed to load dataset: ${String(e)}`))
  }, [gameState?.auctionYear])

  // ── Save on app backgrounding (covers Android abrupt kill) ───────────────
  useEffect(() => {
    const save = () => { void useGameStore.getState().saveNow() }
    document.addEventListener('visibilitychange', save)
    window.addEventListener('beforeunload', save)
    return () => {
      document.removeEventListener('visibilitychange', save)
      window.removeEventListener('beforeunload', save)
    }
  }, [])

  // ── Auto-start on set-preview ─────────────────────────────────────────────
  useEffect(() => {
    if (!dataset || !gameState) return
    if (gameState.phase === 'set-preview') {
      setCallingStage(0)
      startPlayerAuction(dataset)
    }
  }, [dataset, gameState?.phase, gameState?.currentSetIndex, gameState?.currentPlayerIndex])

  // ── Auctioneer commentary ─────────────────────────────────────────────────
  const lastPlayerIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!gameState || !dataset) return
    const player = getCurrentAuctionPlayer(gameState, dataset)
    if (!player || player.playerId === lastPlayerIdRef.current) return
    if (gameState.phase !== 'bidding') return
    lastPlayerIdRef.current = player.playerId
    setDugoutFeed([])  // reset dugout for each new player
    void fetchAuctioneerComment('intro', player).then(c => { if (c) showComment(c) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.phase, gameState?.currentPlayerIndex, gameState?.isReauction, gameState?.reauctionIndex])

  useEffect(() => {
    if (!gameState) return
    if (gameState.phase === 'sale-confirmed') {
      const last = gameState.soldPlayers[gameState.soldPlayers.length - 1]
      if (last) void fetchAuctioneerComment('sold', last, { team: last.soldTo, price: last.soldPrice }).then(c => { if (c) showComment(c) })
    } else if (gameState.phase === 'unsold-confirmed') {
      const last = gameState.unsoldPlayers[gameState.unsoldPlayers.length - 1]
      if (last) void fetchAuctioneerComment('unsold', last).then(c => { if (c) showComment(c) })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.phase])

  // ── Owner thought bubble — fires on notable AI bids with situation awareness ──
  const lastBidKeyRef = useRef<string | null>(null)
  const lastLeaderRef  = useRef<string | null>(null)
  useEffect(() => {
    if (!gameState || gameState.phase !== 'bidding') return
    const bs = gameState.currentBidState
    if (!bs || !bs.currentLeader) return
    const leader = bs.currentLeader as TeamId
    const bid    = bs.currentBid
    const key    = `${leader}-${bid}`
    if (lastBidKeyRef.current === key) return
    const prevLeader = lastLeaderRef.current
    lastBidKeyRef.current = key
    lastLeaderRef.current = leader

    // Pick situation: outbid team reacts, leader comments
    const showForTeam = (teamId: TeamId, situation: OwnerSituation) => {
      if (teamId === gameState.userFranchise) return  // never show for user
      const thought = getOwnerThought(teamId, bid, gameState, situation)
      if (!thought) return
      const entry = { teamId, comment: thought, ts: Date.now() }
      setDugoutFeed(prev => [entry, ...prev].slice(0, 4))  // keep last 4, newest on top
    }

    if (bid < 1.5) return  // below ₹1.5 Cr — too noisy

    // Outbid reaction: previous leader just lost the lead
    if (prevLeader && prevLeader !== leader && prevLeader !== gameState.userFranchise) {
      if (Math.random() < 0.55) {  // 55% chance — not every overtake needs a comment
        showForTeam(prevLeader as TeamId, 'outbid')
        return
      }
    }

    // New leader comment — pick situation based on bid size vs base price
    if (leader === gameState.userFranchise) return
    const cp = gameState.currentBidState
    const bidsCount = cp?.bids?.length ?? 0
    const situation: OwnerSituation =
      bid >= 15                ? 'aggressive'
      : bid >= 8 && bidsCount <= 2 ? 'thinking'
      : bid >= 5               ? 'bidding'
      :                          'thinking'
    showForTeam(leader, situation)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.currentBidState?.currentLeader, gameState?.currentBidState?.currentBid])

  // ── Auctioneer calling ────────────────────────────────────────────────────
  const clearCalling = () => {
    callingTimersRef.current.forEach(clearTimeout)
    callingTimersRef.current = []
  }

  const startCalling = useCallback((ds: AuctionDataset) => {
    clearCalling()
    if (pausedRef.current) return   // don't start calling while paused
    setCallingStage(1); tap()
    const callMs = Math.round(BASE_CALL_MS / speedRef.current)
    const t1 = setTimeout(() => { setCallingStage(2); tap() }, callMs)
    const t2 = setTimeout(() => setCallingStage(3), callMs * 2)
    const t3 = setTimeout(() => {
      setCallingStage(0)
      try {
        resolvePlayerSale(ds)
      } catch {
        advanceAuction(ds)
      }
    }, callMs * 3)
    callingTimersRef.current = [t1, t2, t3]
  }, [])

  const cancelCalling = () => {
    clearCalling()
    setCallingStage(0)
  }

  const togglePause = useCallback(() => {
    setPaused(prev => {
      const next = !prev
      pausedRef.current = next
      if (next) {
        // Pausing: freeze calling countdown
        clearCalling()
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      }
      return next
    })
  }, [])

  // ── Bid timer ─────────────────────────────────────────────────────────────
  const bidState = gameState?.currentBidState ?? null
  const uTeam = gameState?.userFranchise as TeamId | undefined
  const userIsLeader   = !!(uTeam && bidState?.currentLeader === uTeam)
  const userHasPassed  = !!(uTeam && bidState?.teamsPassed.includes(uTeam ?? '' as TeamId))
  const userHasSkipped = !!(uTeam && (bidState?.permanentPass ?? []).includes(uTeam ?? '' as TeamId))
  const isCalling = callingStage > 0

  // User can bid the normal panel: bidding phase, not leader, not out, not calling
  const userCanBidNormal = gameState?.phase === 'bidding'
    && !userIsLeader && !userHasPassed && !userHasSkipped && !aiRunning && !isCalling

  // User can interrupt calling: calling is active, user is not permanently skipped, not leader
  const userCanInterrupt = isCalling && !userIsLeader

  useEffect(() => {
    if (!userCanBidNormal || !dataset || paused) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      return
    }
    hasAutoPassedRef.current = false
    setTimeLeft(BID_TIMER_SECONDS)
    timerRef.current = setInterval(() => {
      if (pausedRef.current) return
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!); timerRef.current = null
          if (!hasAutoPassedRef.current) {
            hasAutoPassedRef.current = true
            userPass()
            startAILoop(dataset)
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null } }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userCanBidNormal, dataset, paused])

  // ── AI loop ───────────────────────────────────────────────────────────────
  const startAILoop = useCallback(async (ds: AuctionDataset) => {
    if (aiLoopRef.current) return
    aiLoopRef.current = true
    setAiRunning(true)

    while (true) {
      // Pause: wait in small increments until resumed
      while (pausedRef.current) {
        await new Promise(r => setTimeout(r, 100))
      }

      const state = useGameStore.getState().gameState
      if (!state || state.phase !== 'bidding') break

      const bs = state.currentBidState
      const ut = state.userFranchise as TeamId
      const uOut = (bs?.teamsPassed ?? []).includes(ut) || (bs?.permanentPass ?? []).includes(ut)
      const uLead = bs?.currentLeader === ut

      // Stop if user can participate
      if (!uOut && !uLead) break

      const result = await runOneAIDecision(ds)
      await new Promise(r => setTimeout(r, Math.round(BASE_AI_DELAY_MS / speedRef.current)))

      const fresh = useGameStore.getState().gameState
      if (!fresh || fresh.phase !== 'bidding') break

      if (isBiddingOver(ds) || result === 'none') {
        aiLoopRef.current = false
        setAiRunning(false)
        startCalling(ds)
        return
      }

      // Re-check after a bid resets teamsPassed — user might be able to participate again
      const fb = fresh.currentBidState
      const nowOut = (fb?.teamsPassed ?? []).includes(ut) || (fb?.permanentPass ?? []).includes(ut)
      if (!nowOut && fb?.currentLeader !== ut) break
    }

    if (isBiddingOver(ds)) {
      aiLoopRef.current = false
      setAiRunning(false)
      startCalling(ds)
      return
    }

    aiLoopRef.current = false
    setAiRunning(false)
  }, [startCalling])

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleBid = useCallback((amount: number) => {
    if (!dataset) return
    cancelCalling()
    setActionError(null)
    const err = userBid(dataset, amount)
    if (err) { setActionError(err); return }
    void startAILoop(dataset)
  }, [dataset, startAILoop])

  // Used by the auctioneer calling interrupt button — clears round-pass before bidding
  const handleInterruptBid = useCallback((amount: number) => {
    if (!dataset) return
    cancelCalling()
    setActionError(null)
    const err = userInterruptBid(dataset, amount)
    if (err) { setActionError(err); return }
    success()
    void startAILoop(dataset)
  }, [dataset, startAILoop])

  const handlePassBid = useCallback(() => {
    if (!dataset) return
    cancelCalling()
    const err = userPass()
    if (err) { setActionError(err); return }
    void startAILoop(dataset)
  }, [dataset, startAILoop])

  const handleSkipPlayer = useCallback(() => {
    if (!dataset) return
    cancelCalling()
    userSkipPlayer()
    void startAILoop(dataset)
  }, [dataset, startAILoop])

  const handleContinue = () => advanceAuction(dataset!)

  // ── Session resuming from URL ────────────────────────────────────────────
  if (resuming) {
    return (
      <div className="min-h-screen bg-ipl-darker flex items-center justify-center">
        <LoadingSpinner label="Resuming session..." />
      </div>
    )
  }

  // ── No game state — session lost on refresh ───────────────────────────────
  if (!gameState) {
    return (
      <div className="min-h-screen bg-ipl-dark flex flex-col items-center justify-center gap-6 p-4">
        <p className="text-gray-400 text-lg">No active auction session found.</p>
        <p className="text-gray-600 text-sm">Your session may have been lost on page refresh.</p>
        <Button variant="primary" size="lg" onClick={() => navigate('/')}>Go to Home → Resume Session</Button>
      </div>
    )
  }

  // ── Dataset loading / error ────────────────────────────────────────────────
  if (!dataset) {
    if (actionError) {
      return (
        <div className="min-h-screen bg-ipl-dark flex flex-col items-center justify-center gap-4 p-4">
          <p className="text-ipl-accent text-lg font-bold">Dataset Error</p>
          <p className="text-gray-400 text-sm text-center max-w-md">{actionError}</p>
          <Button variant="secondary" size="md" onClick={() => navigate('/')}>Back to Home</Button>
        </div>
      )
    }
    return (
      <div className="min-h-screen bg-ipl-dark flex items-center justify-center">
        <LoadingSpinner label="Loading auction room..." />
      </div>
    )
  }

  const currentPlayer = getCurrentAuctionPlayer(gameState, dataset)
  const userTeam = gameState.userFranchise as TeamId

  // ── Set complete ─────────────────────────────────────────────────────────
  if (gameState.phase === 'set-complete') {
    const completedSet = gameState.isReauction ? 'Re-auction' : (dataset.auctionSets[gameState.currentSetIndex - 1] ?? 'Previous Set')
    const nextSet = gameState.isReauction ? '' : (dataset.auctionSets[gameState.currentSetIndex] ?? '')
    const nextPlayers = nextSet ? getPlayersInSet(dataset, nextSet, gameState.releasedRetainedPlayers ?? []) : []
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
        <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
          <div className="text-6xl">✅</div>
          <div>
            <p className="text-gray-500 text-sm uppercase tracking-widest mb-1">Set Complete</p>
            <p className="text-white font-black text-2xl">{completedSet}</p>
          </div>
          {nextSet && (
            <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-5">
              <p className="text-gray-500 text-xs uppercase tracking-widest mb-2">Next Up</p>
              <p className="text-ipl-gold font-black text-xl mb-1">{nextSet}</p>
              <p className="text-gray-500 text-sm">{nextPlayers.length} players</p>
            </div>
          )}
          <div className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex justify-between text-sm">
            <span className="text-gray-500">{userTeam} purse</span>
            <span className="text-white font-bold">₹{gameState.teamStates[userTeam]?.currentPurse.toFixed(1)} Cr</span>
          </div>
          <Button variant="primary" size="lg" className="w-full" onClick={() => { action(); handleContinue() }}>
            {nextSet ? `Start ${nextSet} →` : 'Continue →'}
          </Button>
          {nextSet && dataset && (
            <button
              onClick={() => {
                action()
                setSimulating(true)
                setSimProgress(0)
                simStopRef.current = false
                void simulateOneSet(dataset, p => setSimProgress(p), () => simStopRef.current).then(() => setSimulating(false))
              }}
              className="w-full py-3 text-sm font-black text-orange-300 bg-orange-500/10 border border-orange-500/25 rounded-2xl hover:bg-orange-500/20 transition-colors"
            >
              ⏭ Simulate {nextSet} (AI buys players)
            </button>
          )}
          {dataset && (
            <button
              onClick={() => {
                confirm()
                setSimulating(true)
                setSimProgress(0)
                simStopRef.current = false
                void simulateRemainingAuction(dataset, p => setSimProgress(p), () => simStopRef.current).then(() => setSimulating(false))
              }}
              className="w-full py-3 text-sm font-black text-purple-300 bg-purple-500/10 border border-purple-500/25 rounded-2xl hover:bg-purple-500/20 transition-colors"
            >
              ⚡ Simulate Rest of Auction
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Auction complete ──────────────────────────────────────────────────────
  if (gameState.phase === 'auction-complete') {
    const unsoldCount = gameState.unsoldPlayers.length
    const roundsDone = gameState.acceleratedRoundsCompleted ?? 0
    const canAccelerate = unsoldCount > 0 && roundsDone < 2

    // After 2 accelerated rounds, skip straight to final squad review
    if (roundsDone >= 2) {
      return (
        <div className="min-h-screen bg-ipl-darker flex items-center justify-center p-4">
          <div className="text-center max-w-md animate-fade-in w-full">
            <div className="text-8xl mb-6">🏆</div>
            <p className="text-ipl-gold text-4xl font-black mb-2">Auction Complete!</p>
            <p className="text-gray-400 mb-2">{gameState.soldPlayers.length} players sold</p>
            <p className="text-gray-500 text-sm mb-8">GPL {gameState.auctionYear} · All rounds done</p>
            <div className="flex flex-col gap-3 max-w-xs mx-auto">
              <Button variant="primary" size="lg" onClick={() => navigate('/final-squad')}>
                🏏 View Squad Reports
              </Button>
              <Button variant="secondary" size="lg" onClick={() => navigate('/my-squad')}>
                My Squad
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-ipl-darker flex items-center justify-center p-4">
        <div className="text-center max-w-md animate-fade-in w-full">
          <div className="text-8xl mb-6 animate-bounce">🏆</div>
          <p className="text-ipl-gold text-4xl font-black mb-2">Auction Complete!</p>
          <p className="text-gray-400 mb-2">
            {gameState.soldPlayers.length} players sold · {unsoldCount} unsold
          </p>
          <p className="text-gray-500 text-sm mb-6">GPL {gameState.auctionYear}</p>

          {canAccelerate && (
            <div className="mb-6 bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4 text-left">
              <p className="text-amber-400 font-black text-sm mb-1">⚡ Accelerated Auction — Round {roundsDone + 1} of 2</p>
              <p className="text-amber-200/70 text-xs leading-relaxed">
                {unsoldCount} players went unsold. Pick up to {roundsDone === 0 ? USER_MAX_PICKS_R1 : USER_MAX_PICKS_R2} players you want — AI teams will nominate the rest to fill {ACCELERATED_TOTAL} slots at 50% base price.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3 max-w-xs mx-auto">
            {canAccelerate && (
              <Button variant="secondary" size="lg" onClick={() => useGameStore.getState().startAcceleratedSelection()}>
                ⚡ Start Accelerated Auction
              </Button>
            )}
            <Button variant="primary" size="lg" onClick={() => navigate('/final-squad')}>
              🏏 View Final Squads
            </Button>
            <Button variant="secondary" size="lg" onClick={() => navigate('/my-squad')}>
              My Squad
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── Accelerated auction selection ─────────────────────────────────────────
  if (gameState.phase === 'accelerated-selection') {
    return (
      <AcceleratedSelectionScreen
        dataset={dataset}
        gameState={gameState}
      />
    )
  }

  // ── Sale / unsold result ──────────────────────────────────────────────────
  if (gameState.phase === 'sale-confirmed') {
    const last = gameState.soldPlayers[gameState.soldPlayers.length - 1]
    if (last) return (
      <div className="min-h-screen bg-black/95 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <SaleResult result={{ type: 'sold', record: last }} onContinue={handleContinue} />
        </div>
      </div>
    )
  }
  if (gameState.phase === 'unsold-confirmed') {
    const last = gameState.unsoldPlayers[gameState.unsoldPlayers.length - 1]
    if (last) return (
      <div className="min-h-screen bg-black/95 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <SaleResult result={{ type: 'unsold', record: last }} onContinue={handleContinue} />
        </div>
      </div>
    )
  }

  // ── RTM ───────────────────────────────────────────────────────────────────
  if (gameState.phase === 'rtm-decision' && bidState?.rtmPending === userTeam && currentPlayer) {
    const userTs = gameState.teamStates[userTeam]
    const rtmSlotsLeft = (userTs?.rtmSlotsAvailable ?? 0) - (userTs?.rtmSlotsUsed ?? 0)
    return (
      <div className="min-h-screen bg-black/95 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-ipl-card border-2 border-ipl-gold rounded-2xl p-7 flex flex-col gap-5">
          <div className="text-center">
            <p className="text-ipl-gold text-3xl font-black mb-1">RTM Available!</p>
            <p className="text-gray-400 text-sm">Right to Match — {rtmSlotsLeft} slot{rtmSlotsLeft !== 1 ? 's' : ''} remaining</p>
          </div>
          <div className="bg-ipl-dark rounded-xl p-4 text-center">
            <p className="text-white font-black text-xl">{currentPlayer.name}</p>
            <p className="text-gray-400 text-xs mt-0.5">{currentPlayer.role} · {currentPlayer.isOverseas ? 'Overseas' : 'Indian'}</p>
            <p className="text-gray-400 text-sm mt-2">
              Going to <span className="text-white font-bold">{bidState.currentLeader}</span> for{' '}
              <span className="text-ipl-accent font-black">₹{bidState.currentBid.toFixed(2)} Cr</span>
            </p>
            <p className="text-gray-500 text-xs mt-1">Exercise RTM to match this price and reclaim your player</p>
          </div>
          <div className="flex gap-3">
            <Button variant="primary" size="lg" className="flex-1" onClick={() => { confirm(); userExerciseRTM(dataset) }}>
              Exercise RTM
            </Button>
            <Button variant="ghost" size="lg" className="flex-1" onClick={() => { action(); userDeclineRTM(dataset) }}>
              Decline
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── Main auction room ─────────────────────────────────────────────────────
  const setName = dataset.auctionSets[gameState.currentSetIndex] ?? ''
  const playersInSet = getPlayersInSet(dataset, setName, gameState.releasedRetainedPlayers ?? [])
  const progressPct = playersInSet.length > 0
    ? Math.round((gameState.currentPlayerIndex / playersInSet.length) * 100) : 0
  const timerUrgent = timeLeft <= 3
  const timerWarning = timeLeft <= 6

  // Next bid for interrupt button
  const currentBid = bidState?.currentBid ?? 0
  const interruptBid = currentPlayer
    ? (currentBid === 0 ? currentPlayer.basePrice : currentBid + getBidIncrement(dataset, currentBid))
    : 0

  // Squad composition strip for header
  const userSquad = gameState.teamStates[userTeam]?.squad ?? []
  const squadComp = { BAT: 0, BWL: 0, AR: 0, WK: 0 }
  for (const p of userSquad) squadComp[p.role] = (squadComp[p.role] ?? 0) + 1


  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col pb-16 lg:pb-0">

      {/* ── Paused overlay ────────────────────────────────────────────────── */}
      {paused && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center pointer-events-none"
             style={{ background: 'rgba(0,0,0,0.65)' }}>
          <div className="pointer-events-auto text-center">
            <div className="text-6xl mb-4">⏸</div>
            <p className="text-white font-black text-3xl mb-2">Paused</p>
            <p className="text-gray-400 text-sm mb-6">Auction is frozen — AI bids and timer are stopped</p>
            <button
              onClick={() => { action(); togglePause() }}
              className="flex items-center gap-3 px-10 py-4 bg-ipl-gold text-black font-black text-lg rounded-2xl hover:bg-yellow-400 active:scale-95 transition-all shadow-lg shadow-ipl-gold/30"
            >
              <svg width="18" height="18" viewBox="0 0 14 14" fill="currentColor">
                <polygon points="3,1 13,7 3,13" />
              </svg>
              Resume
            </button>
          </div>
        </div>
      )}

      {/* ── Auctioneer calling overlay ─────────────────────────────────────── */}
      {isCalling && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center"
             style={{ background: 'rgba(0,0,0,0.88)' }}>
          {/* Gavel animation area */}
          <div className="mb-8 text-center">
            <div className={`text-7xl mb-4 transition-all duration-500 ${callingStage === 3 ? 'animate-hammer scale-125' : 'scale-100'}`}>
              🔨
            </div>
            <div className={`px-6 py-2 rounded-xl mb-2 transition-all duration-300 ${
              callingStage === 3
                ? 'bg-ipl-gold/20 border border-ipl-gold/50'
                : 'bg-white/5 border border-white/10'
            }`}>
              <p
                key={callingStage}
                className={`font-black tracking-widest text-center transition-all duration-300 ${
                  callingStage === 3 ? 'text-5xl text-ipl-gold animate-bid-pop' :
                  callingStage === 2 ? 'text-4xl text-yellow-300' :
                  'text-3xl text-white'
                }`}
              >
                {STAGE_TEXT[callingStage]}
              </p>
            </div>
            {STAGE_SUB[callingStage] && (
              <p className="text-gray-400 text-lg mt-2">{STAGE_SUB[callingStage]}</p>
            )}
          </div>

          {/* Current price */}
          {currentPlayer && bidState?.currentLeader && (
            <div className="bg-white/5 border border-white/10 rounded-2xl px-10 py-5 text-center mb-8">
              <p className="text-gray-400 text-sm mb-1">{currentPlayer.name}</p>
              <p className="text-white font-black text-4xl">₹{bidState.currentBid.toFixed(2)} Cr</p>
              <p className="text-gray-400 text-sm mt-2">
                to <span className="text-white font-bold">{bidState.currentLeader}</span>
              </p>
            </div>
          )}

          {/* Stage dots */}
          <div className="flex gap-3 mb-8">
            {[1, 2, 3].map(s => (
              <div key={s} className={`flex items-center gap-3 transition-all duration-500 ${callingStage >= s ? '' : 'opacity-30'}`}>
                <div className={`rounded-full transition-all duration-300 ${
                  callingStage >= s
                    ? `w-4 h-4 bg-ipl-gold ${callingStage === s ? 'animate-pulse-glow' : ''}`
                    : 'w-3 h-3 bg-gray-700'
                }`} />
                {s < 3 && (
                  <div className={`h-px w-8 transition-colors duration-700 ${callingStage > s ? 'bg-ipl-gold' : 'bg-gray-700'}`} />
                )}
              </div>
            ))}
          </div>

          {/* Interrupt button — shown during going-once and going-twice only */}
          {userCanInterrupt && callingStage < 3 && currentPlayer && (
            <div className="text-center">
              <button
                onClick={() => { handleInterruptBid(interruptBid) }}
                className="bg-ipl-accent hover:bg-ipl-accent/90 text-white font-black text-xl px-10 py-5 rounded-2xl shadow-2xl shadow-ipl-accent/30 active:scale-95 transition-all animate-pulse"
              >
                ✋ BID ₹{interruptBid.toFixed(2)} Cr
              </button>
              <p className="text-gray-500 text-xs mt-3">Raise your paddle to interrupt the auctioneer</p>
            </div>
          )}

          {userIsLeader && (
            <div className="text-center">
              <p className="text-ipl-gold font-bold text-xl">
                {callingStage < 3 ? '🏏 You have the highest bid!' : '🎉 Player is yours!'}
              </p>
              <p className="text-gray-400 text-sm mt-1">
                {callingStage < 3
                  ? 'No challengers — hammer is falling...'
                  : `${currentPlayer?.name} sold to you for ₹${bidState?.currentBid?.toFixed(2)} Cr`}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Menu overlay ────────────────────────────────────────────────────── */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 flex">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70" onClick={() => { tap(); setMenuOpen(false) }} />
          {/* Drawer */}
          <div className="relative ml-auto w-72 h-full bg-[#111118] border-l border-white/10 flex flex-col shadow-2xl">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <span className="text-white font-bold">Menu</span>
              <button onClick={() => { tap(); setMenuOpen(false) }} className="text-gray-500 hover:text-white text-xl leading-none">✕</button>
            </div>

            {/* Session info */}
            <div className="px-5 py-4 border-b border-white/10">
              <p className="text-ipl-gold font-black text-sm">GPL {gameState.auctionYear} Auction</p>
              <p className="text-gray-500 text-xs mt-1">{setName} · Set {gameState.currentSetIndex + 1}/{dataset.auctionSets.length}</p>
              <p className="text-gray-600 text-xs mt-0.5">{gameState.soldPlayers.length} sold · {gameState.unsoldPlayers.length} unsold</p>
              <p className="text-gray-500 text-xs mt-0.5">
                {userTeam} — ₹{gameState.teamStates[userTeam]?.currentPurse.toFixed(1)} Cr · {gameState.teamStates[userTeam]?.squad.length} players
              </p>
            </div>

            {/* Nav links */}
            <nav className="flex flex-col py-2">
              {[
                { label: 'My Squad', path: '/my-squad', sub: `${gameState.teamStates[userTeam]?.squad.length ?? 0} players` },
                { label: 'All Squads', path: '/all-squads', sub: 'View every team' },
                { label: 'Auction History', path: '/auction-history', sub: 'Bids & sales log' },
                { label: 'Unsold Players', path: '/unsold-players', sub: `${gameState.unsoldPlayers.length} players` },
              ].map(item => (
                <button
                  key={item.path}
                  onClick={() => { tap(); setMenuOpen(false); navigate(item.path) }}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-white/5 transition-colors text-left"
                >
                  <span className="text-white text-sm font-medium">{item.label}</span>
                  <span className="text-gray-600 text-xs">{item.sub}</span>
                </button>
              ))}
            </nav>

            <div className="mt-auto flex flex-col gap-0 border-t border-white/10">
              <button
                onClick={() => { tap(); setMenuOpen(false); navigate('/') }}
                className="px-5 py-4 text-left text-gray-400 hover:text-white hover:bg-white/5 text-sm transition-colors"
              >
                ← Home <span className="text-gray-500 text-xs ml-2">Session saved</span>
              </button>
              <button
                onClick={() => { action(); setMenuOpen(false); setQuitConfirm(true) }}
                className="px-5 py-4 text-left text-red-500 hover:text-red-400 hover:bg-red-950/30 text-sm font-medium transition-colors border-t border-white/5"
              >
                Quit Auction
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Quit confirmation dialog ─────────────────────────────────────────── */}
      {quitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="w-full max-w-sm bg-[#111118] border border-white/10 rounded-2xl p-6 flex flex-col gap-5">
            <div>
              <p className="text-white font-black text-xl">Quit auction?</p>
              <p className="text-gray-400 text-sm mt-2">
                Your progress is saved. You can resume from the Home screen any time.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { tap(); setQuitConfirm(false) }}
                className="flex-1 py-3 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 text-sm font-medium transition-colors"
              >
                Keep Playing
              </button>
              <button
                onClick={() => { warning(); setQuitConfirm(false); navigate('/') }}
                className="flex-1 py-3 rounded-xl bg-red-900/60 border border-red-700/50 text-red-300 hover:bg-red-900/80 text-sm font-medium transition-colors"
              >
                Quit &amp; Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="border-b border-white/10 bg-black/60 backdrop-blur-sm px-3 py-2.5 flex items-center justify-between flex-shrink-0 z-10 safe-top">
        <div className="flex items-center gap-2 min-w-0">
          <TeamBadge teamId={userTeam} size="sm" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-ipl-accent/80 px-1.5 py-0.5 bg-ipl-accent/10 rounded">
                {gameState.isReauction ? 'RE-AUCTION' : 'SET'}
              </span>
              <p className="text-white font-black text-xs leading-tight truncate">
                {gameState.isReauction ? 'Unsold Pool' : setName}
              </p>
            </div>
            <p className="text-gray-500 text-[10px] leading-tight font-mono">
              {gameState.isReauction
                ? `LOT ${gameState.reauctionIndex + 1} of ${gameState.reauctionPool.length} · 50% base`
                : `LOT ${gameState.currentPlayerIndex + 1}/${playersInSet.length} · ${dataset.auctionSets.length - gameState.currentSetIndex - 1} sets left`
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Pause / Resume */}
          <button
            onClick={() => { action(); togglePause() }}
            className={`flex items-center justify-center w-9 h-9 rounded-lg border-2 transition-all active:scale-95 flex-shrink-0 ${
              paused
                ? 'bg-ipl-gold border-ipl-gold text-black shadow-md shadow-ipl-gold/40'
                : 'bg-white/15 border-white/30 text-white hover:bg-white/25 hover:border-white/50'
            }`}
            title={paused ? 'Resume auction' : 'Pause auction'}
          >
            {paused ? (
              /* Play triangle */
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <polygon points="3,1 13,7 3,13" />
              </svg>
            ) : (
              /* Pause bars */
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <rect x="2" y="1" width="4" height="12" rx="1"/>
                <rect x="8" y="1" width="4" height="12" rx="1"/>
              </svg>
            )}
          </button>
          {/* Speed control */}
          <div className={`flex rounded-lg overflow-hidden border border-white/10 transition-opacity ${paused ? 'opacity-40 pointer-events-none' : ''}`}>
            {([1, 2, 3] as const).map(s => (
              <button key={s} onClick={() => { tap(); setSpeed(s) }}
                className={`px-2 py-1 text-[10px] font-black transition-colors ${
                  speed === s ? 'bg-ipl-accent text-white' : 'bg-white/5 text-gray-600 hover:text-gray-300'
                }`}
              >{s}×</button>
            ))}
          </div>
          <div className="flex flex-col items-center bg-white/5 rounded-lg px-2.5 py-1">
            <span className="text-[8px] text-gray-600 font-black uppercase tracking-wider leading-none">PURSE</span>
            <span className="text-ipl-gold text-xs font-black font-mono leading-none mt-0.5">
              ₹{gameState.teamStates[userTeam]?.currentPurse.toFixed(1)}Cr
            </span>
          </div>
          {/* Skip Rest of Set */}
          {gameState.phase === 'bidding' && dataset && (
            <button
              onClick={() => {
                action()
                setSimulating(true)
                setSimProgress(0)
                cancelCalling()
                aiLoopRef.current = false
                simStopRef.current = false
                void simulateRemainingSet(dataset, p => setSimProgress(p), () => simStopRef.current).then(() => setSimulating(false))
              }}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-black text-orange-300 bg-orange-500/15 border border-orange-500/30 rounded-lg hover:bg-orange-500/25 transition-colors flex-shrink-0"
              title="Skip rest of set — AI buys remaining players"
            >
              ⏭ Skip
            </button>
          )}
          <button
            onClick={() => { tap(); setMenuOpen(true) }}
            className="flex flex-col gap-1 justify-center items-center w-9 h-9 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
            title="Menu"
          >
            <span className="w-4 h-0.5 bg-gray-400 rounded" />
            <span className="w-4 h-0.5 bg-gray-400 rounded" />
            <span className="w-4 h-0.5 bg-gray-400 rounded" />
          </button>
        </div>
      </header>

      {/* Dual-layer progress: gold = set-level, accent = player within auction */}
      <div className="relative h-[3px] bg-white/5 flex-shrink-0 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-ipl-gold/35 transition-all duration-1000"
          style={{ width: `${(gameState.currentSetIndex / dataset.auctionSets.length) * 100}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 bg-ipl-accent/80 transition-all duration-700"
          style={{ width: `${(gameState.currentSetIndex / dataset.auctionSets.length) * 100 + progressPct / dataset.auctionSets.length}%` }}
        />
      </div>

      {/* ── Main grid ────────────────────────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-0 overflow-hidden">

        {/* LEFT: Player + bid history + action */}
        <div className="lg:col-span-3 flex flex-col gap-0 border-r border-white/5 overflow-y-auto">
          <div className="p-3 sm:p-4 flex flex-col gap-3 sm:gap-4">

            {/* Mobile-only team paddles strip */}
            <div className="lg:hidden">
              <TeamPaddles
                teamStates={gameState.teamStates}
                bidState={bidState}
                userTeam={userTeam}
                maximumSquadSize={dataset.maximumSquadSize}
                nextBidAmount={interruptBid}
              />
            </div>

            {/* ── Auction Dynamics Panel — two-zone commentary ── */}
            <div className="flex flex-col gap-2">
              {/* Auctioneer zone — broadcast lower-third */}
              {auctioneeerLine && (
                <div className="relative overflow-hidden rounded-xl border border-ipl-gold/25 bg-ipl-gold/6 border-l-4 border-l-ipl-gold px-4 py-3 animate-fade-in">
                  <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-ipl-gold/60 via-ipl-gold/20 to-transparent" />
                  <div className="flex items-start gap-2.5">
                    <span className="text-sm shrink-0 mt-0.5">🎙️</span>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.25em] text-ipl-gold/50 mb-0.5">AUCTIONEER</p>
                      <p className="text-ipl-gold text-sm font-semibold italic leading-snug">{auctioneeerLine}</p>
                    </div>
                  </div>
                </div>
              )}
              {/* Franchise dugout — rolling feed of banter from the auction room */}
              {dugoutFeed.length > 0 && (
                <div className="relative overflow-hidden rounded-2xl border border-white/12 bg-black/50">
                  {/* Header bar */}
                  <div className="flex items-center gap-2 px-4 py-2 border-b border-white/8 bg-white/3">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
                    <span className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">Franchise Dugout</span>
                    <span className="ml-auto text-[9px] text-gray-600 font-bold">{dugoutFeed.length} live</span>
                  </div>
                  {/* Feed entries */}
                  <div className="divide-y divide-white/5">
                    {dugoutFeed.map((entry, i) => {
                      const chip = TEAM_CHIP_COLORS[entry.teamId] ?? 'text-gray-300 bg-gray-500/10 border-gray-500/30'
                      return (
                        <div
                          key={entry.ts}
                          className={`flex items-start gap-3 px-4 py-3 transition-all animate-fade-in ${i === 0 ? 'bg-white/5' : ''}`}
                        >
                          <span className={`text-[11px] font-black px-2 py-0.5 rounded-lg border shrink-0 mt-0.5 ${chip}`}>
                            {entry.teamId}
                          </span>
                          <p className={`text-sm leading-snug flex-1 ${i === 0 ? 'text-gray-100 font-medium' : 'text-gray-500'}`}>
                            <span className="not-italic">"</span>
                            <span className="italic">{entry.comment}</span>
                            <span className="not-italic">"</span>
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ── Live Bid Board ── */}
            {bidState && (bidState.currentBid ?? 0) > 0 && currentPlayer && (
              <div className="relative overflow-hidden rounded-2xl border border-ipl-accent/40 bg-ipl-card animate-fade-in">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-ipl-accent rounded-l-2xl" />
                {bidState.currentLeader && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: `linear-gradient(90deg, ${TEAM_HEX[bidState.currentLeader] ?? '#e94560'}22 0%, transparent 55%)` }}
                  />
                )}
                <div className="pl-4 pr-5 py-3.5 flex items-center justify-between gap-4">
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    {bidState.currentLeader
                      ? <TeamBadge teamId={bidState.currentLeader as TeamId} size="md" />
                      : <div className="w-10 h-10 rounded-full bg-ipl-border animate-pulse" />
                    }
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">LEADING</span>
                  </div>
                  <div className="flex-1 text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-ipl-accent mb-0.5">CURRENT BID</p>
                    <p
                      key={bidState.currentBid}
                      className="font-black font-mono leading-none text-white animate-bid-pop"
                      style={{ fontSize: '2.25rem' }}
                    >
                      ₹{bidState.currentBid.toFixed(2)}<span className="text-lg text-gray-400 font-semibold ml-1">Cr</span>
                    </p>
                    {currentPlayer.basePrice > 0 && (bidState.currentBid ?? 0) > 0 && (
                      <p className="text-ipl-accent/60 text-[10px] font-semibold mt-0.5">
                        {Math.round(bidState.currentBid / currentPlayer.basePrice)}× base price
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5 items-end flex-shrink-0 min-w-[72px]">
                    {[...bidState.bids].reverse().slice(1, 4).map((b, idx) => (
                      <div key={`${b.teamId}-${b.timestamp}`} className="flex items-center gap-1.5"
                           style={{ opacity: 1 - (idx + 1) * 0.28 }}>
                        <span className="text-[9px] font-black text-gray-400">{b.teamId}</span>
                        <span className="text-[10px] font-mono text-gray-600">₹{b.amount.toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Player spotlight */}
            {currentPlayer ? (
              <PlayerCard
                player={currentPlayer}
                currentBid={bidState?.currentBid}
                currentLeader={bidState?.currentLeader}
                formContext={getFormContext(currentPlayer.playerId)}
                lotNumber={gameState.isReauction ? gameState.reauctionIndex + 1 : gameState.currentPlayerIndex + 1}
                isActive={gameState.phase === 'bidding'}
              />
            ) : (
              <div className="bg-white/5 rounded-2xl flex items-center justify-center py-16">
                <p className="text-gray-500">Preparing player...</p>
              </div>
            )}

            {/* Timer strip — only when user's turn */}
            {userCanBidNormal && (
              <div className={`relative overflow-hidden flex items-center gap-4 rounded-2xl px-5 py-4 border transition-all ${
                timerUrgent
                  ? 'bg-red-950/70 border-red-600/60 shadow-lg shadow-red-900/40'
                  : timerWarning
                  ? 'bg-yellow-950/50 border-yellow-700/50 shadow-md shadow-yellow-900/20'
                  : 'bg-ipl-card border-ipl-accent/25'
              }`}>
                {timerUrgent && (
                  <div className="absolute inset-0 bg-red-600/5 animate-pulse pointer-events-none" />
                )}
                <div className="relative w-12 h-12 flex-shrink-0">
                  <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                    <circle cx="24" cy="24" r="20" fill="none" stroke="#1f2937" strokeWidth="3.5" />
                    <circle cx="24" cy="24" r="20" fill="none"
                      stroke={timerUrgent ? '#ef4444' : timerWarning ? '#eab308' : '#e8c96d'}
                      strokeWidth="3.5"
                      strokeDasharray={`${2 * Math.PI * 20}`}
                      strokeDashoffset={`${2 * Math.PI * 20 * (1 - timeLeft / BID_TIMER_SECONDS)}`}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset 1s linear' }}
                    />
                  </svg>
                  <span className={`absolute inset-0 flex items-center justify-center font-black text-sm ${
                    timerUrgent ? 'text-red-400' : timerWarning ? 'text-yellow-400' : 'text-ipl-gold'
                  }`}>{timeLeft}</span>
                </div>
                <div className="relative flex-1">
                  <p className={`font-black text-base leading-tight ${
                    timerUrgent ? 'text-red-300' : timerWarning ? 'text-yellow-300' : 'text-white'
                  }`}>
                    {timerUrgent ? '⚡ Bid NOW or you auto-pass!' : '🏏 Your turn — place a bid'}
                  </p>
                  <p className={`text-xs mt-0.5 ${timerUrgent ? 'text-red-500' : 'text-gray-600'}`}>
                    {timeLeft}s remaining
                  </p>
                </div>
              </div>
            )}

            {/* Watching states */}
            {gameState.phase === 'bidding' && !userCanBidNormal && !userIsLeader && !isCalling && (
              <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                userHasSkipped
                  ? 'bg-gray-900/30 border-gray-800/60'
                  : 'bg-white/4 border-white/8'
              }`}>
                <span className="text-xl">{userHasSkipped ? '👁' : '🤫'}</span>
                <p className={`text-sm ${userHasSkipped ? 'text-gray-500' : 'text-gray-400'}`}>
                  {userHasSkipped
                    ? 'You skipped — watching the room'
                    : 'You passed this round — watching teams battle'}
                </p>
              </div>
            )}

            {userIsLeader && gameState.phase === 'bidding' && (
              <div className="relative overflow-hidden flex items-center gap-3 rounded-2xl border bg-ipl-accent/10 border-ipl-accent/35 px-5 py-3.5">
                <div className="absolute inset-0 bg-gradient-to-r from-ipl-accent/5 to-transparent pointer-events-none" />
                <span className="text-2xl relative">🏆</span>
                <div className="relative">
                  <p className="text-ipl-accent font-black text-sm">You hold the highest bid</p>
                  <p className="text-ipl-accent/50 text-xs mt-0.5">Waiting for challengers…</p>
                </div>
              </div>
            )}

            {/* AI thinking */}
            {aiRunning && (
              <div className="flex items-center gap-3 bg-black/30 border border-white/8 rounded-2xl px-4 py-3">
                <div className="flex gap-1.5 items-center">
                  {[0, 120, 240].map(d => (
                    <span key={d} className="w-2 h-2 rounded-full bg-ipl-accent/70 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
                <span className="text-gray-500 text-sm">Franchise owners deliberating…</span>
              </div>
            )}

            {actionError && (
              <div className="bg-red-950/50 border border-red-800/50 rounded-xl px-4 py-3">
                <p className="text-red-400 text-sm">{actionError}</p>
              </div>
            )}

            {/* Action panel */}
            {gameState.phase === 'bidding' && currentPlayer && !userHasPassed && !userHasSkipped && !userIsLeader && (
              <UserActionPanel
                state={gameState}
                dataset={dataset}
                currentPlayer={currentPlayer}
                onBid={handleBid}
                onPassBid={handlePassBid}
                onSkipPlayer={handleSkipPlayer}
                disabled={aiRunning && !isCalling}
              />
            )}

            {/* Bid history */}
            {bidState && bidState.bids.length > 0 && (
              <div className="bg-white/5 border border-white/8 rounded-2xl p-4">
                <h3 className="text-gray-600 text-xs uppercase tracking-widest mb-3">
                  Bid History · {bidState.bids.length} bid{bidState.bids.length !== 1 ? 's' : ''}
                </h3>
                <BidTimeline bids={bidState.bids} />
              </div>
            )}

          </div>
        </div>

        {/* RIGHT: Team paddles + room feed (desktop only) */}
        <div className="hidden lg:flex lg:col-span-2 flex-col overflow-y-auto">
          {/* Team paddles */}
          <div className="p-4 border-b border-white/5">
            <h3 className="text-gray-600 text-xs uppercase tracking-widest mb-3">Team Paddles</h3>
            <TeamPaddles
              teamStates={gameState.teamStates}
              bidState={bidState}
              userTeam={userTeam}
              maximumSquadSize={dataset.maximumSquadSize}
              nextBidAmount={interruptBid}
            />
          </div>

          {/* Auction room log */}
          <div className="p-4 flex-1">
            <h3 className="text-gray-600 text-xs uppercase tracking-widest mb-3">Auction Room</h3>
            <OpponentReactions log={gameState.auctionLog ?? []} />
          </div>
        </div>
      </div>

      {/* Bottom nav — mobile only */}
      {!isCalling && <BottomNav active="auction" />}

      {/* Simulation overlay */}
      {simulating && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-[#111118] border border-white/10 rounded-3xl p-8 w-72 text-center">
            <div className="text-5xl mb-4 animate-pulse">⚡</div>
            <p className="text-white font-black text-xl mb-1">Simulating…</p>
            <p className="text-gray-400 text-sm mb-4">AI is buying players</p>
            <p className="text-ipl-gold font-bold text-lg mb-6">{simProgress} players processed</p>
            <button
              onClick={() => { simStopRef.current = true }}
              className="px-6 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-sm font-bold hover:bg-white/20 active:scale-95 transition-all"
            >
              Stop Simulation
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Accelerated Auction Selection Screen
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_LABEL_MAP: Record<string, string> = { BAT: 'Bat', BWL: 'Bowl', AR: 'A/R', WK: 'WK' }
const ROLE_COLOR_MAP: Record<string, string> = {
  BAT: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  BWL: 'bg-red-500/20 text-red-300 border-red-500/30',
  AR:  'bg-green-500/20 text-green-300 border-green-500/30',
  WK:  'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
}

function AcceleratedSelectionScreen({
  dataset,
  gameState,
}: {
  dataset: AuctionDataset
  gameState: GameState
}) {
  const [userPicks, setUserPicks] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<'ALL' | 'BAT' | 'BWL' | 'AR' | 'WK'>('ALL')
  const [search, setSearch] = useState('')
  const [confirming, setConfirming] = useState(false)
  const { startReauction } = useGameStore()

  const roundsDone = gameState.acceleratedRoundsCompleted ?? 0
  const maxUserPicks = roundsDone === 0 ? USER_MAX_PICKS_R1 : USER_MAX_PICKS_R2

  // Round 2+: show the full original unsold pool minus already-sold players,
  // so users can pick from everyone who went unsold in the main auction — not just
  // the small subset that survived round 1's re-auction.
  const soldIds = new Set(
    Object.values(gameState.teamStates).flatMap(ts => ts.squad.map(p => p.playerId))
  )
  const unsold = roundsDone >= 1
    ? (gameState.originalUnsoldPool ?? gameState.unsoldPlayers).filter(p => !soldIds.has(p.playerId))
    : gameState.unsoldPlayers

  const filtered = unsold
    .filter(p => filter === 'ALL' || p.role === filter)
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.basePrice - a.basePrice)

  const byRole = {
    BAT: unsold.filter(p => p.role === 'BAT').length,
    BWL: unsold.filter(p => p.role === 'BWL').length,
    AR:  unsold.filter(p => p.role === 'AR').length,
    WK:  unsold.filter(p => p.role === 'WK').length,
  }

  const togglePick = (playerId: string) => {
    setUserPicks(prev => {
      const next = new Set(prev)
      if (next.has(playerId)) {
        next.delete(playerId)
      } else if (next.size < maxUserPicks) {
        next.add(playerId)
      }
      return next
    })
  }

  const handleConfirm = () => {
    setConfirming(true)
    const userPickIds = [...userPicks]
    const aiPickIds = pickAIAcceleratedPlayers(dataset, userPickIds, roundsDone + 1)
    const allPickIds = new Set([...userPickIds, ...aiPickIds])

    const pool = unsold
      .filter(p => allPickIds.has(p.playerId))
      .map(p => ({ ...p }))

    startReauction(pool)
  }

  const aiSlots = ACCELERATED_TOTAL - userPicks.size
  const totalPool = Math.min(ACCELERATED_TOTAL, unsold.length)

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col pb-4">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/60 px-4 py-3 flex items-center gap-3 flex-shrink-0 safe-top">
        <div className="flex-1">
          <p className="text-ipl-gold font-black text-base">⚡ Accelerated Auction</p>
          <p className="text-gray-500 text-xs">Pick your nominees · AI fills the rest</p>
        </div>
        <div className="text-right">
          <p className="text-white font-black text-lg">{userPicks.size}<span className="text-gray-500 font-normal text-sm">/{maxUserPicks}</span></p>
          <p className="text-gray-500 text-xs">your picks</p>
        </div>
      </header>

      {/* Pool summary */}
      <div className="px-4 pt-3 pb-2">
        <div className="bg-ipl-card border border-ipl-border rounded-xl p-3 flex items-center justify-between">
          <div className="text-center flex-1">
            <p className="text-white font-black text-xl">{unsold.length}</p>
            <p className="text-gray-500 text-xs">Total unsold</p>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center flex-1">
            <p className="text-ipl-gold font-black text-xl">{userPicks.size}</p>
            <p className="text-gray-500 text-xs">Your picks</p>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center flex-1">
            <p className="text-blue-300 font-black text-xl">{Math.min(aiSlots, Math.max(0, unsold.length - userPicks.size))}</p>
            <p className="text-gray-500 text-xs">AI picks</p>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center flex-1">
            <p className="text-green-300 font-black text-xl">{totalPool}</p>
            <p className="text-gray-500 text-xs">Will auction</p>
          </div>
        </div>
      </div>

      {/* Role filter */}
      <div className="px-4 pb-2 grid grid-cols-4 gap-1.5">
        {(['BAT', 'BWL', 'AR', 'WK'] as const).map(role => (
          <button
            key={role}
            onClick={() => { tap(); setFilter(filter === role ? 'ALL' : role) }}
            className={[
              'rounded-lg py-1.5 text-center border text-xs font-bold transition-all',
              filter === role ? ROLE_COLOR_MAP[role] : 'bg-ipl-card border-ipl-border text-gray-500',
            ].join(' ')}
          >
            {ROLE_LABEL_MAP[role]} {byRole[role]}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-4 pb-2">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search player..."
          className="w-full bg-ipl-card border border-ipl-border rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-ipl-accent"
        />
      </div>

      {userPicks.size >= maxUserPicks && (
        <div className="mx-4 mb-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
          <p className="text-amber-300 text-xs font-semibold text-center">Max {maxUserPicks} picks reached — deselect one to change</p>
        </div>
      )}

      {/* Player list */}
      <div className="flex-1 px-4 flex flex-col gap-2 overflow-y-auto">
        {filtered.map(p => {
          const picked = userPicks.has(p.playerId)
          const disabled = !picked && userPicks.size >= maxUserPicks
          return (
            <button
              key={p.playerId}
              onClick={() => { tap(); togglePick(p.playerId) }}
              disabled={disabled}
              className={[
                'w-full rounded-xl px-4 py-3 flex items-center gap-3 border transition-all text-left',
                picked
                  ? 'bg-ipl-gold/10 border-ipl-gold'
                  : disabled
                    ? 'bg-ipl-card/40 border-ipl-border opacity-40'
                    : 'bg-ipl-card border-ipl-border active:bg-white/5',
              ].join(' ')}
            >
              <span className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xs font-black border ${ROLE_COLOR_MAP[p.role]}`}>
                {ROLE_LABEL_MAP[p.role]}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm truncate ${picked ? 'text-ipl-gold' : 'text-white'}`}>{p.name}</p>
                <p className="text-gray-500 text-xs">{p.country} · {p.cappedStatus === 'uncapped' ? 'Uncapped' : 'Capped'}{p.isOverseas ? ' · 🌍' : ''}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-gray-400 text-xs">Base</p>
                <p className="text-gray-300 text-xs font-bold">₹{p.basePrice.toFixed(2)}</p>
                <p className="text-green-400 text-xs">→ ₹{Math.max(0.2, Math.round(p.basePrice * 0.5 * 4) / 4).toFixed(2)}</p>
              </div>
              <div className="shrink-0 w-7 flex items-center justify-center">
                {picked
                  ? <span className="text-ipl-gold text-lg font-black">✓</span>
                  : <span className="w-5 h-5 rounded-full border-2 border-gray-600 block" />
                }
              </div>
            </button>
          )
        })}
      </div>

      {/* Confirm button */}
      <div className="px-4 pt-3 pb-2">
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={() => { confirm(); handleConfirm() }}
          disabled={confirming}
        >
          {confirming
            ? 'Preparing auction...'
            : `⚡ Begin Accelerated Auction (${totalPool} players)`
          }
        </Button>
        <p className="text-center text-gray-600 text-xs mt-2">
          Your {userPicks.size} pick{userPicks.size !== 1 ? 's' : ''} + AI {Math.min(aiSlots, Math.max(0, unsold.length - userPicks.size))} picks · all at 50% base price
        </p>
      </div>
    </div>
  )
}
