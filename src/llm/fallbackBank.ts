/**
 * Static fallback comment bank — used when LLM is unavailable or rate-limited.
 * One pool per franchise per scenario. Picked randomly so it never feels robotic.
 */

type Scenario = 'bidding_interested' | 'bidding_aggressive' | 'bidding_cautious' | 'passing' | 'sold_win' | 'sold_lost' | 'rtm_yes' | 'rtm_no'

const BANK: Record<string, Record<Scenario, string[]>> = {
  CSK: {
    bidding_interested: [
      "Dhoni's kind of player — calm head, big heart.",
      "This one fits our system perfectly.",
      "Chennai will embrace this player.",
      "We've been tracking him all season.",
      "Experience like this doesn't come cheap.",
    ],
    bidding_aggressive: [
      "Don't test us — we want this player.",
      "CSK doesn't lose targets. Raise it.",
      "This is non-negotiable for us.",
      "We'll go to the wall for him.",
      "Chennai needs this. Simple.",
    ],
    bidding_cautious: [
      "Let's see where this goes…",
      "We're watching closely.",
      "Interesting. We'll hold for now.",
      "Not our highest priority today.",
      "Patience is a CSK virtue.",
    ],
    passing: [
      "Not the profile we need right now.",
      "Let someone else take the risk.",
      "We'll pass. There's better value ahead.",
      "Doesn't fit the Chennai way.",
      "We have that role covered.",
    ],
    sold_win: [
      "Whistle Podu! Welcome to Chennai!",
      "Another piece of the puzzle in yellow.",
      "Dhoni will get the best out of him.",
      "Thala approved. Done deal.",
      "CSK continues to build smart.",
    ],
    sold_lost: [
      "They paid too much. We'll recover.",
      "Not at that price. No regrets.",
      "Good luck to them. We move on.",
      "Our time will come.",
      "The auction is long. Stay patient.",
    ],
    rtm_yes: [
      "He's a CSK man. Always was.",
      "We never let family go easily.",
      "Welcome back to Chennai, son.",
      "RTM. No hesitation whatsoever.",
      "That's our player. Matched.",
    ],
    rtm_no: [
      "The price is too steep for us today.",
      "We'll let him go. With respect.",
      "Not at that valuation. Move on.",
      "Our purse has bigger plans.",
      "Best of luck to him.",
    ],
  },

  MI: {
    bidding_interested: [
      "Mumbai identifies talent before anyone else.",
      "He fits the MI mould exactly.",
      "We've done our homework on this one.",
      "This is a five-year investment for us.",
      "Mumbai needs match-winners. He qualifies.",
    ],
    bidding_aggressive: [
      "Mumbai doesn't flinch. Keep going.",
      "Five titles. We know how to buy.",
      "This is a must-have. Period.",
      "Paltan needs this player. No ceiling.",
      "MI plays to win. Always.",
    ],
    bidding_cautious: [
      "We're evaluating. Don't rush us.",
      "Interesting profile. Let it breathe.",
      "Mumbai doesn't overpay. Watching.",
      "We have options. No panic.",
      "Let the price settle first.",
    ],
    passing: [
      "Not our gap to fill today.",
      "Mumbai passes. Better opportunities ahead.",
      "We'll leave this one for the room.",
      "Numbers don't add up for us.",
      "Our squad needs something else.",
    ],
    sold_win: [
      "Mumbai Paltan grows stronger!",
      "Another quality addition to the squad.",
      "The MI system will develop him further.",
      "Blue and gold gets brighter today.",
      "Champions keep on building.",
    ],
    sold_lost: [
      "Too rich. They'll regret it.",
      "We play the long game. No panic.",
      "Mumbai recovers. Always.",
      "That's their money. Not ours to waste.",
      "Next player. Stay focused.",
    ],
    rtm_yes: [
      "Once MI, always MI.",
      "We protect our own. RTM exercised.",
      "No debate. He comes home.",
      "Mumbai doesn't let go of winners.",
      "Welcome back to Wankhede.",
    ],
    rtm_no: [
      "Not worth straining the purse.",
      "We have a plan. This doesn't fit it.",
      "Good player, wrong price.",
      "Mumbai moves forward.",
      "Let him go. We rebuild smarter.",
    ],
  },

  RCB: {
    bidding_interested: [
      "Bangalore needs stars. He is one.",
      "Virat would back this call.",
      "Ee sala cup namde — starting with him.",
      "Royal Challengers don't do half measures.",
      "The fans deserve this player.",
    ],
    bidding_aggressive: [
      "We're not letting Bangalore down again!",
      "Raise it! RCB plays for the Cup!",
      "No ceiling when we want someone.",
      "Bangalore is all-in. Every time.",
      "This is our year. Back it up!",
    ],
    bidding_cautious: [
      "Let's not get carried away…",
      "The head says wait. The heart says bid.",
      "Hmm. We'll see where this settles.",
      "RCB is interested. Not desperate.",
      "We have purse to deploy smartly.",
    ],
    passing: [
      "Not the RCB profile. We'll wait.",
      "Bangalore has bigger targets today.",
      "We'll pass. Our eye is elsewhere.",
      "This one isn't the answer.",
      "Not the right fit for the red army.",
    ],
    sold_win: [
      "Ee sala cup namde! He's ours!",
      "Red and gold, baby! Welcome!",
      "Bangalore has its match-winner!",
      "The RCB faithful will love this.",
      "One step closer to glory!",
    ],
    sold_lost: [
      "Story of our lives. We move.",
      "Someone always outbids us. Fine.",
      "RCB keeps the faith. Always.",
      "The Cup hunt continues.",
      "We'll find our answer elsewhere.",
    ],
    rtm_yes: [
      "A Bangalore legend returns!",
      "We don't abandon our heroes.",
      "RTM. Bangalore never forgets.",
      "He bleeds red and gold. Matched.",
      "Welcome back to the RCB family.",
    ],
    rtm_no: [
      "The bid went too high for us.",
      "Even RCB has limits. Today.",
      "We'll honour his legacy elsewhere.",
      "Go well, champion. Go well.",
      "Budget demands it. With heavy heart.",
    ],
  },

  KKR: {
    bidding_interested: [
      "Knight Riders identify value others miss.",
      "Shreyas would love this addition.",
      "Purple and gold has a plan for him.",
      "KKR builds squads, not collections.",
      "Eden Gardens is calling this player.",
    ],
    bidding_aggressive: [
      "KKR doesn't leave empty-handed.",
      "Two-time champions don't lose targets.",
      "Korbo Lorbo Jeetbo — we take him.",
      "Eden Gardens deserves this player.",
      "Knight Riders are serious. Very serious.",
    ],
    bidding_cautious: [
      "KKR is patient. The price isn't right yet.",
      "Let it breathe. We'll move at the right moment.",
      "Purple has options. We watch.",
      "Not our moment. Yet.",
      "Strategic patience is KKR's weapon.",
    ],
    passing: [
      "Not the KKR template. Pass.",
      "We build differently. Not for us.",
      "Eden Gardens has other priorities.",
      "This profile doesn't excite us.",
      "KKR exits the bidding. Strategically.",
    ],
    sold_win: [
      "Korbo Lorbo Jeetbo! He's a Knight!",
      "Eden roars for this signing!",
      "KKR strengthens the fort!",
      "Purple and gold gets stronger today.",
      "Champions know how to shop.",
    ],
    sold_lost: [
      "They wanted him more. Respect.",
      "Our strategy remains intact.",
      "KKR doesn't chase. We plan.",
      "The auction continues. Stay calm.",
      "There are better options ahead.",
    ],
    rtm_yes: [
      "A Knight never leaves the fort.",
      "RTM. Eden Garden's favourite son.",
      "We reclaim our own. Simple.",
      "Purple loyalty has no price ceiling.",
      "Welcome back, champion.",
    ],
    rtm_no: [
      "The economics don't support it today.",
      "We wish him well. Really.",
      "KKR builds the future. Not the past.",
      "Move forward. Always forward.",
      "Our plan works without him.",
    ],
  },

  DC: {
    bidding_interested: [
      "Delhi Capitals plays bold, thinks smart.",
      "This player fits our attacking blueprint.",
      "The capital deserves quality. He delivers.",
      "DC's data team flagged him weeks ago.",
      "Young, hungry, Delhi-ready.",
    ],
    bidding_aggressive: [
      "Delhi is going all in on this one.",
      "Capitals don't back down from value.",
      "We want this player. Simple.",
      "DC commits when they believe. We believe.",
      "The capital city demands this signing.",
    ],
    bidding_cautious: [
      "Interesting. Delhi watches carefully.",
      "The numbers are close. Let's see.",
      "DC has options. Not desperate.",
      "We hold the purse with discipline.",
      "Let it run a little longer.",
    ],
    passing: [
      "Not the Delhi profile today.",
      "DC moves on to bigger targets.",
      "The fit isn't right. We pass.",
      "Our squad gaps lie elsewhere.",
      "Capitals concede this one.",
    ],
    sold_win: [
      "Delhi Capitals gets stronger!",
      "A brilliant addition to the squad.",
      "The capital city celebrates!",
      "DC builds another chapter!",
      "Bold, smart, and now ours.",
    ],
    sold_lost: [
      "Outbid but never outthought.",
      "Delhi has a plan. Still.",
      "We'll find our answer. Always do.",
      "The auction is long. We're fine.",
      "Next. DC keeps moving.",
    ],
    rtm_yes: [
      "Capitals protect their investments.",
      "RTM. Delhi keeps its own.",
      "He belongs in blue and red. Matched.",
      "We don't let talent walk away easily.",
      "Welcome back to the capital.",
    ],
    rtm_no: [
      "The price crossed our comfort zone.",
      "DC looks ahead, not back.",
      "We let him go with good wishes.",
      "Our purse builds a different future.",
      "Smart decision. Difficult, but smart.",
    ],
  },

  RR: {
    bidding_interested: [
      "Rajasthan Royals: value over vanity.",
      "This player is undervalued. We see it.",
      "Moneyball is alive in Jaipur.",
      "The pink army identifies talent early.",
      "Sanju would love this signing.",
    ],
    bidding_aggressive: [
      "When Royals see value, they act.",
      "Rajasthan is going for it. Hard.",
      "The pink army wants this player.",
      "We've done the analysis. We commit.",
      "Value found. We don't hesitate.",
    ],
    bidding_cautious: [
      "Let's see if it's truly worth it.",
      "Royals don't overpay. Watching.",
      "The data is mixed. We're careful.",
      "RR holds. For now.",
      "Patience is our greatest weapon.",
    ],
    passing: [
      "The value isn't there. We pass.",
      "Rajasthan plays the long game.",
      "Not the RR formula. Move on.",
      "Our analysts say no. We listen.",
      "Better value is coming. We trust that.",
    ],
    sold_win: [
      "Value identified. Value captured!",
      "The pink army grows smarter!",
      "Rajasthan wins this battle of wits.",
      "Sanju will get the best from him.",
      "Classic Royals — smart over flashy.",
    ],
    sold_lost: [
      "They overpaid. Our formula survives.",
      "RR discipline preserved.",
      "The numbers didn't justify it. Good call.",
      "Jaipur moves on — calculated as always.",
      "Our war chest remains healthy.",
    ],
    rtm_yes: [
      "Royals value loyalty above all.",
      "He's our player. We match.",
      "The pink army takes care of its own.",
      "RTM exercised. Welcome back.",
      "Jaipur never abandons its heroes.",
    ],
    rtm_no: [
      "Even loyalty has a price ceiling.",
      "The RR model demands discipline here.",
      "We honour him by being smart.",
      "Our future is built differently.",
      "A tough but correct decision.",
    ],
  },

  SRH: {
    bidding_interested: [
      "Sunrisers chase pace and aggression.",
      "Orange Army has a plan for this player.",
      "Hyderabad wants match-winners. He is one.",
      "SRH knows fast bowling. We know this man.",
      "The sunrise shines on this signing.",
    ],
    bidding_aggressive: [
      "Sunrisers attack. Always.",
      "Orange Army wants blood — and this player.",
      "We go hard or go home. Going hard.",
      "Hyderabad commits. No retreat.",
      "SRH takes what it wants. And we want him.",
    ],
    bidding_cautious: [
      "Sunrisers weighs the option carefully.",
      "We want him. But at our price.",
      "Orange Army watches. Calculating.",
      "Not yet. Let it climb a little.",
      "SRH is in. Not all-in. Yet.",
    ],
    passing: [
      "Doesn't fit the SRH attack.",
      "Not the Sunrisers template. Pass.",
      "Orange Army has better targets ahead.",
      "The role doesn't match our gaps.",
      "Hyderabad steps back from this one.",
    ],
    sold_win: [
      "Rise, Sunrisers! He's ours!",
      "Orange Army roars in Hyderabad!",
      "SRH adds another weapon!",
      "The attack just got more dangerous!",
      "Hyderabad builds a champion squad!",
    ],
    sold_lost: [
      "They can have him at that price.",
      "SRH keeps the purse, keeps the plan.",
      "Orange Army adapts. Always.",
      "We'll find the pace we need.",
      "No drama. We move forward.",
    ],
    rtm_yes: [
      "He flies the orange flag. Matched.",
      "SRH keeps its own. Always.",
      "RTM. The sunrise never abandons its stars.",
      "Once a Sunriser, always a Sunriser.",
      "Welcome back to Hyderabad.",
    ],
    rtm_no: [
      "The price doesn't make sense today.",
      "Hyderabad looks forward, not back.",
      "We let him go — with respect.",
      "Our squad plan doesn't need this.",
      "Orange Army chooses wisdom over sentiment.",
    ],
  },

  PBKS: {
    bidding_interested: [
      "Punjab Kings has the purse and the intent.",
      "Shubman knows what we need — this player.",
      "Lions of Punjab don't miss quality.",
      "PBKS is building something special.",
      "The red lions want him in their den.",
    ],
    bidding_aggressive: [
      "Punjab is going to the wall on this.",
      "Kings don't flinch. We keep raising.",
      "PBKS has the purse. We'll use it.",
      "Lions of Punjab roar! We want him!",
      "No hesitation. Keep going.",
    ],
    bidding_cautious: [
      "Interesting. PBKS considers carefully.",
      "We have the purse. Question is the fit.",
      "Let the price move. We watch.",
      "Punjab Kings is interested but patient.",
      "Not yet. We hold.",
    ],
    passing: [
      "Not the Punjab Kings priority today.",
      "PBKS passes. Bigger fish to fry.",
      "Our squad needs something different.",
      "The profile doesn't match our gaps.",
      "Lions of Punjab conserve for better targets.",
    ],
    sold_win: [
      "Sher Punjab! He's ours!",
      "Kings claim another jewel!",
      "Punjab Kings gets stronger today!",
      "The red lions welcome a champion!",
      "This is the PBKS era!",
    ],
    sold_lost: [
      "They paid over the odds. We're fine.",
      "Punjab Kings keeps the war chest intact.",
      "No regrets. We know our plan.",
      "Lions hunt when the time is right.",
      "The auction is long. We're patient.",
    ],
    rtm_yes: [
      "A King never leaves his kingdom.",
      "RTM. Punjab reclaims its own.",
      "Once a Punjab King, always royalty.",
      "The red lions protect their pride.",
      "Welcome back to Mohali.",
    ],
    rtm_no: [
      "The price is beyond reason today.",
      "PBKS builds its future differently.",
      "We salute him — but the maths says no.",
      "Lions pick their battles wisely.",
      "We move on. Stronger for it.",
    ],
  },

  GT: {
    bidding_interested: [
      "Gujarat Titans builds on merit alone.",
      "Shubman and Hardik knew — this is quality.",
      "Titans identify character over hype.",
      "Ahmedabad wants winners. He qualifies.",
      "GT's philosophy fits this player perfectly.",
    ],
    bidding_aggressive: [
      "Titans don't lose players they target.",
      "Gujarat commits when it believes. We believe.",
      "Ahmedabad has spoken. We want him.",
      "GT goes for the jugular when ready.",
      "Champions know how to acquire champions.",
    ],
    bidding_cautious: [
      "Titans assess. Never rush.",
      "Gujarat Titans is methodical. Always.",
      "Let the room decide first. We'll move.",
      "Our data team is still running numbers.",
      "Patience built two titles. It works.",
    ],
    passing: [
      "Doesn't fit the Titans blueprint.",
      "Gujarat has better allocation targets.",
      "Not the GT formula. We pass.",
      "Ahmedabad builds differently.",
      "Titans concede this one — strategically.",
    ],
    sold_win: [
      "Jai Gujarat! Another Titan rises!",
      "Ahmedabad gets what it came for!",
      "The Titans machine grows stronger!",
      "Quality added. Championship mentality.",
      "Gujarat builds a dynasty, player by player.",
    ],
    sold_lost: [
      "Let them have it. Our plan adapts.",
      "GT has contingencies. Always.",
      "Titans lose this battle, not the war.",
      "Ahmedabad stays calm. As always.",
      "The bigger picture is still intact.",
    ],
    rtm_yes: [
      "Once a Titan, always a Titan.",
      "GT protects its investments. RTM.",
      "He built this franchise. We return the favour.",
      "Ahmedabad never abandons its own.",
      "RTM exercised. Welcome back.",
    ],
    rtm_no: [
      "The economics don't support it.",
      "Titans think long-term. This is long-term.",
      "We honour his service — differently.",
      "GT builds forward. Always forward.",
      "A hard choice. The right choice.",
    ],
  },

  LSG: {
    bidding_interested: [
      "Lucknow Super Giants targets the overlooked.",
      "KL Rahul knows quality when he sees it.",
      "Super Giants builds without ego.",
      "Lucknow is young, hungry, ambitious — like him.",
      "LSG's process identified this player early.",
    ],
    bidding_aggressive: [
      "Super Giants don't back down from targets.",
      "Lucknow is all-in. Right now.",
      "LSG found its player. We're not stopping.",
      "The Super Giants have spoken. Raise it.",
      "KL Rahul wants him. That's enough.",
    ],
    bidding_cautious: [
      "LSG monitors the room carefully.",
      "Lucknow is interested. Cautiously.",
      "Super Giants weighs every rupee.",
      "We'll enter when the moment is right.",
      "Not there yet. Almost.",
    ],
    passing: [
      "Not the LSG profile today.",
      "Lucknow Super Giants passes — strategically.",
      "Our squad gap is different.",
      "Super Giants has other plans for the purse.",
      "We move on. Eyes forward.",
    ],
    sold_win: [
      "Lucknow roars! Super Giants sign him!",
      "LSG adds another quality piece!",
      "The Super Giants rise higher!",
      "KL Rahul will maximise this player.",
      "Lucknow has its man!",
    ],
    sold_lost: [
      "Too expensive. Our plan survives.",
      "LSG keeps discipline. Always.",
      "The Super Giants adapt and move on.",
      "Lucknow is patient. The auction continues.",
      "We'll find our answer elsewhere.",
    ],
    rtm_yes: [
      "LSG stands by its players.",
      "RTM. Super Giants protect their assets.",
      "Once a Super Giant, always family.",
      "Lucknow never lets go easily.",
      "He's ours. Welcome back.",
    ],
    rtm_no: [
      "The valuation doesn't work for us.",
      "LSG looks forward. Always forward.",
      "We respect him — but the maths wins.",
      "Super Giants moves on with grace.",
      "Our future is built on different foundations.",
    ],
  },
}

/** Pick a random comment from the bank for a given team and scenario */
export function getFallbackComment(teamId: string, scenario: Scenario): string {
  const pool = BANK[teamId]?.[scenario]
  if (!pool || pool.length === 0) return `${teamId} is watching closely...`
  return pool[Math.floor(Math.random() * pool.length)]
}

/** Map interest level + style to scenario key for bidding comments */
export function biddingScenario(interestLevel: number, isAggressive: boolean): Scenario {
  if (interestLevel >= 75) return isAggressive ? 'bidding_aggressive' : 'bidding_interested'
  if (interestLevel >= 40) return 'bidding_cautious'
  return 'passing'
}
