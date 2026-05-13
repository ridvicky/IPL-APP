/**
 * Static comment bank — shown when LLM is unavailable or rate-limited.
 * Each franchise has comments per scenario: bidding, passing, winning, losing.
 * Randomly sampled so the same line doesn't repeat every time.
 */

export type CommentScenario = 'bid' | 'pass' | 'win' | 'lose' | 'rtm' | 'overbid'

const bank: Record<string, Record<CommentScenario, string[]>> = {
  CSK: {
    bid: [
      'CSK always backs experience. This is a calculated call.',
      'Dhoni\'s philosophy — back the right player at the right price.',
      'Chennai knows value when they see it. Paddle up.',
      'We\'ve done our homework. This player fits our system.',
      'Whistle Podu! CSK wants this one.',
    ],
    pass: [
      'Not at that price. CSK keeps its powder dry.',
      'There will be better value later. We\'re patient.',
      'We have faith in our retained core. No need to overpay.',
      'CSK doesn\'t panic. We step back when the price doesn\'t make sense.',
      'Thala\'s taught us — don\'t force it. Pass.',
    ],
    win: [
      'Excellent. Another experienced head in the CSK dressing room.',
      'That is exactly the kind of player our system rewards.',
      'Whistle Podu! Welcome to yellow.',
      'CSK is built on trust and experience. This signing continues that tradition.',
      'A calm, calculated acquisition. Dhoni would approve.',
    ],
    lose: [
      'They wanted it more tonight. CSK has other plans.',
      'Good luck to them. We back our retained core.',
      'No regrets. The price went beyond our value assessment.',
      'There are other players on our list. CSK moves on calmly.',
      'Sometimes you step aside. That\'s smart cricket.',
    ],
    rtm: [
      'This is our player. We know exactly what he brings. RTM.',
      'CSK never forgets its own. We\'re bringing him back.',
      'Right To Match. Simple as that.',
      'He wore yellow. He\'ll wear it again.',
    ],
    overbid: [
      'We stretched a little but this player is worth every rupee.',
      'The price went higher than planned, but so be it.',
      'Sometimes you have to go the extra mile for the right player.',
    ],
  },

  MI: {
    bid: [
      'Mumbai wants this one. Paltan needs quality.',
      'MI targets are researched deeply. This bid is backed by data.',
      'Five titles. We know what winning looks like. Paddle up.',
      'This is a future MI star. We move early.',
      'The Paltan spirit demands the best. Bidding.',
    ],
    pass: [
      'Not for MI at this valuation. We have depth.',
      'Our analysis says step back. We trust the process.',
      'MI has enough options here. No need to overspend.',
      'Patience wins auctions. We\'ll find our target.',
      'Not the right fit for our current squad structure.',
    ],
    win: [
      'Welcome to the Paltan! Another MI warrior in the squad.',
      'MI always gets its man when it matters.',
      'Five titles built on these kinds of smart buys.',
      'Excellent. This player will thrive in the MI system.',
      'The blue jersey suits you. Paltan Zindabad!',
    ],
    lose: [
      'Their loss is not our gain here — we stay disciplined.',
      'MI has a deep enough squad. We let this one go.',
      'No regrets. Our squad depth is our strength.',
      'We\'ll find what we need further in the auction.',
      'Data said step back. We listen to the data.',
    ],
    rtm: [
      'MI doesn\'t let its players go that easily. RTM.',
      'Paltan family. We\'re matching that bid.',
      'Once a Mumbai Indian, always a Mumbai Indian. RTM.',
      'This is too important to let walk away.',
    ],
    overbid: [
      'We pushed the boat out, but MI investments always pay off.',
      'This player\'s ceiling justifies the price.',
      'The Ambani backing means we can back our targets properly.',
    ],
  },

  RCB: {
    bid: [
      'Ee sala cup namde! RCB bids for glory.',
      'This is the year. We need players who believe it too.',
      'RCB fans deserve the best. We\'re bidding.',
      'The RCB brand attracts stars — this player fits the vision.',
      'Bengaluru is watching. Paddle up.',
    ],
    pass: [
      'Not at this price. Even RCB has limits... sometimes.',
      'We\'ll find our match elsewhere in the auction.',
      'The analytics team says step back. Reluctantly, we agree.',
      'RCB fans understand — we must be strategic.',
      'Painful, but the squad balance requires restraint.',
    ],
    win: [
      'Ee sala cup namde! Welcome to the RCB family!',
      'Bengaluru is going to love this signing!',
      'This is how you build a championship squad!',
      'Another warrior for the red and gold army!',
      'The M. Chinnaswamy Stadium will roar for this player!',
    ],
    lose: [
      'We wanted that one. But RCB never gives up on the dream.',
      'The fans will understand. There are more players to come.',
      'We competed hard. Sometimes it just doesn\'t go your way.',
      'RCB regroups. Always. Ee sala cup namde is still alive.',
      'On to the next. The vision remains.',
    ],
    rtm: [
      'RCB never abandons its own. RTM, without hesitation.',
      'This player is part of the Bengaluru story. We match.',
      'Red and gold runs in your blood now. RTM.',
      'We brought them here. We\'re keeping them here.',
    ],
    overbid: [
      'Perhaps we got a little carried away — but that\'s RCB!',
      'The heart said yes before the head could object.',
      'Worth every rupee for the Bengaluru fans.',
    ],
  },

  KKR: {
    bid: [
      'KKR sees potential here that others have missed.',
      'Korbo Lorbo Jeetbo Re! KKR enters the bid.',
      'Two titles built on smart buys like this one.',
      'Shah Rukh Khan\'s instinct says yes. We bid.',
      'This player fits the KKR system perfectly.',
    ],
    pass: [
      'The price exceeds our internal valuation. KKR passes.',
      'We\'ve set our limit and we respect it.',
      'There are other undervalued players ahead. Trust the process.',
      'KKR discipline wins auctions as much as bids do.',
      'Our analytics team has spoken. We step back.',
    ],
    win: [
      'Korbo Lorbo Jeetbo Re! Excellent acquisition for KKR.',
      'SRK knew it. We all knew it. Welcome to the Knight Riders.',
      'This is exactly the kind of buy that wins titles.',
      'The Eden Gardens faithful will love this one.',
      'Another Knight Rider joins the purple army!',
    ],
    lose: [
      'They overpaid. KKR respects its limits. No regrets.',
      'We backed our analysis. Someone else blinked first.',
      'Eden Gardens will find someone to cheer for. Plenty more to bid.',
      'KKR moves on. The best value picks are still to come.',
      'Smart teams know when to walk away.',
    ],
    rtm: [
      'A Knight Rider stays a Knight Rider. RTM.',
      'We developed this talent. We\'re keeping it.',
      'Eden Gardens doesn\'t forget its own. RTM exercise.',
      'KKR matches the bid. Simple.',
    ],
    overbid: [
      'We went a touch over plan, but the talent justifies it.',
      'SRK got excited. Understandable. Worth it.',
      'An investment in quality. KKR can make this work.',
    ],
  },

  DC: {
    bid: [
      'Delhi Capitals bids — thorough analysis supports this.',
      'This player fits our system. We move.',
      'DC is building something special. This name belongs.',
      'Consistent performers are what DC values. Bidding.',
      'The capital has spoken. Paddle up.',
    ],
    pass: [
      'Not the right value equation for DC right now.',
      'Our squad has depth here already. We step back.',
      'DC always plays the long game. Patience.',
      'The price doesn\'t match our assessment. Pass.',
      'Delhi Capitals is disciplined. We don\'t chase prices.',
    ],
    win: [
      'Excellent. DC strengthens the squad methodically.',
      'This is how Delhi builds — smart, consistent, patient.',
      'Welcome to the Capitals family. This was a targeted buy.',
      'Another quality addition to the DC squad.',
      'Delhi Capital will roar for this one.',
    ],
    lose: [
      'DC had its price. Someone went beyond it. No regrets.',
      'Our squad is deep enough. We move forward calmly.',
      'The next player on our list might be a better fit anyway.',
      'Delhi Capitals stays calm under pressure. Always.',
      'We\'ll find our answer elsewhere in this auction.',
    ],
    rtm: [
      'DC developed this player. We\'re not giving them up.',
      'Right To Match. Our player stays in Delhi.',
      'This talent was nurtured here. RTM is the right call.',
      'The blue and navy jersey is home for this player.',
    ],
    overbid: [
      'We went slightly above plan, but this player is worth it.',
      'Delhi Capitals makes calculated exceptions for the right talent.',
      'A premium paid for a genuine squad gap. Justified.',
    ],
  },

  RR: {
    bid: [
      'Rajasthan sees value others have overlooked. Classic RR.',
      'Shane Warne would have loved this player. We bid.',
      'RR auctions are built on exactly these kinds of smart picks.',
      'The moneyball approach says yes. Paddle up.',
      'Rajasthan Royals — original IPL champions — bids.',
    ],
    pass: [
      'The price has moved past good value. RR knows when to stop.',
      'We trust our process. This isn\'t the right price.',
      'There are diamonds ahead that others won\'t see. We wait.',
      'RR discipline is our greatest strength. We pass.',
      'Every rupee is precious. This one costs too many of them.',
    ],
    win: [
      'The Warne formula lives on — find what others missed.',
      'Rajasthan Royals doing what they do best. Brilliant buy.',
      'Smart cricket. Value cricket. RR cricket.',
      'The pink jersey gains another warrior today.',
      'Shane would have approved. Welcome to Rajasthan.',
    ],
    lose: [
      'They paid over the odds. RR never does that. We move on.',
      'Our system identifies the next opportunity automatically.',
      'Rajasthan doesn\'t mourn what it doesn\'t win. Onward.',
      'The best value in this auction is still ahead. Trust us.',
      'We set our price and we honour it. No shame in losing this one.',
    ],
    rtm: [
      'Rajasthan Royals don\'t let their finds go easily. RTM.',
      'We spotted this talent. We\'re keeping it.',
      'Right To Match — and the price is still good value for us.',
      'This player thrived in our system. They\'ll thrive again.',
    ],
    overbid: [
      'We stepped slightly above plan for a genuinely special talent.',
      'Even the best value teams occasionally find a player worth a premium.',
      'Rare exception for a rare player. RR accepts this.',
    ],
  },

  SRH: {
    bid: [
      'Sunrisers Hyderabad bids hard for this one.',
      'Kavya Maran\'s SRH doesn\'t hesitate on quality. Paddle up.',
      'Record-breaking cricket needs record-breaking players.',
      'SRH plays fast. We also bid fast. Going in.',
      'This player has the aggression the Sunrisers demand.',
    ],
    pass: [
      'We\'ve found our limit. SRH steps back.',
      'Our retained core already covers this gap.',
      'The price moved too far. Hyderabad shows restraint.',
      'SRH is aggressive but not reckless. We pass.',
      'The squad is balanced enough without this one.',
    ],
    win: [
      'Hyderabad erupts! Another Sunriser joins the squad!',
      'Kavya Maran approves. What a signing for SRH.',
      'This is how you build a team to break records.',
      'The orange army grows stronger today.',
      'Rise — another Sunriser has arrived!',
    ],
    lose: [
      'SRH bid hard. The other team wanted it more. Fair enough.',
      'We live to fight another bid. Sunrisers stay aggressive.',
      'Our retained players cover this ground. No panic.',
      'Hyderabad has other targets. This doesn\'t define our auction.',
      'We pushed hard. No regrets.',
    ],
    rtm: [
      'SRH matches without hesitation. This player is orange through and through.',
      'Rise and RTM. Sunrisers keep their own.',
      'We invested in this player. We\'re reclaiming them.',
      'Kavya says yes. RTM.',
    ],
    overbid: [
      'SRH went big but this player changes games. Worth it.',
      'Aggressive cricket needs aggressive investment.',
      'Kavya Maran green-lit this. We back our instincts.',
    ],
  },

  PBKS: {
    bid: [
      'Preity Zinta loves this player. Punjab Kings bids!',
      'Sher-E-Punjab roars — PBKS enters the auction for this one.',
      'Punjab Kings is building a winner this year. We have the purse!',
      'This player has the energy Punjab deserves. Bidding.',
      'PBKS has the money this year. No holding back.',
    ],
    pass: [
      'Even PBKS has moments of discipline. Reluctantly, we pass.',
      'The squad balance says step back. Hard to do, but right.',
      'We have targets further in the auction. Saving the purse.',
      'Punjab Kings pauses. Just this once.',
      'Our team needs balance, not just star power. Pass.',
    ],
    win: [
      'Sher-E-Punjab! What a signing for Punjab Kings!',
      'Preity Zinta is thrilled! Welcome to the PBKS family!',
      'This is THE year. This signing proves it.',
      'Punjab Kings finally gets their man. Long overdue!',
      'The Punjab crowd will love this. Absolutely love it.',
    ],
    lose: [
      'It hurts when Punjab Kings loses a target. It really does.',
      'We bid, we competed, they went higher. PBKS moves forward.',
      'The Punjab dream is alive. One player doesn\'t define the auction.',
      'We\'ll find our spine further in the auction. Still confident.',
      'PBKS has more to spend. The right player is coming.',
    ],
    rtm: [
      'Punjab doesn\'t let its stars go easily. RTM!',
      'PBKS goes heart-first. RTM — obviously.',
      'This player belongs in Punjab colours. We match.',
      'Preity Zinta says bring them back. RTM.',
    ],
    overbid: [
      'We may have gone a bit over! But that\'s Punjab spirit!',
      'The heart overruled the spreadsheet again. Typical PBKS!',
      'Worth every rupee. Punjab fans deserve nothing less.',
    ],
  },

  GT: {
    bid: [
      'Gujarat Titans has done its analysis. We bid with conviction.',
      'Aava De! Gujarat enters the auction for this player.',
      'GT builds on balance. This player adds exactly what we need.',
      'Two finals in two years tells you GT knows what it\'s doing.',
      'Gujarat Titans — precise, patient, purposeful. We bid.',
    ],
    pass: [
      'GT\'s squad structure doesn\'t require this. We step back.',
      'The price exceeds our ceiling. No emotional override here.',
      'Balance is the GT way. This bid would disrupt it.',
      'Gujarat Titans waits for a better opportunity. Always one ahead.',
      'Our retained core covers this gap adequately. Pass.',
    ],
    win: [
      'Aava De! Another Gujarat Titan joins the squad.',
      'This is exactly the profile GT was looking to add.',
      'Two finals bred the habit of good selection. Another example.',
      'Welcome to the Titans. The squad is stronger today.',
      'GT does it again — smart, targeted, decisive.',
    ],
    lose: [
      'GT set its number and honoured it. No overpay. No regret.',
      'Our retained core means we don\'t need to panic. Moving on.',
      'Aava De for the next opportunity. GT stays patient.',
      'Someone paid more than we valued them. We\'re comfortable with that.',
      'The GT process continues. Another opportunity is loading.',
    ],
    rtm: [
      'Gujarat Titans built this player. GT brings them back. RTM.',
      'The blue jersey is home. RTM exercise.',
      'We don\'t let investments walk away. Match.',
      'Aava De — this Titan stays a Titan.',
    ],
    overbid: [
      'A slight premium for a player who fits the system perfectly.',
      'GT rarely does this, but the profile was too good to let go.',
      'Calculated exception. The squad balance demanded it.',
    ],
  },

  LSG: {
    bid: [
      'Lucknow Super Giants commits to this player. We bid.',
      'LSG\'s research is thorough. This decision is backed by data.',
      'The Super Giants need quality — and quality has a price.',
      'Lucknow is serious this year. Paddle up.',
      'LSG moves with intent. This is a targeted buy.',
    ],
    pass: [
      'Lucknow knows its limits. This one goes too high.',
      'LSG squad depth says we don\'t need this at this price.',
      'The Super Giants respect the process. We step back.',
      'There are better targets ahead. LSG waits.',
      'Not the right value for our current squad needs. Pass.',
    ],
    win: [
      'Super Giants! Excellent acquisition for Lucknow.',
      'LSG strengthens with purpose. This was exactly our target.',
      'Lucknow gets its man. The squad grows better.',
      'UP cricket pride grows with this signing.',
      'Welcome to Lucknow. The Super Giants are serious.',
    ],
    lose: [
      'LSG competed fairly. They valued them more. We move forward.',
      'Our squad has the depth to absorb this. No panic.',
      'Lucknow always has a Plan B. On to the next one.',
      'The Super Giants don\'t overpay. That\'s a principle, not a defeat.',
      'We respect the other team\'s decision. LSG moves on calmly.',
    ],
    rtm: [
      'LSG invested in this player. We exercise RTM.',
      'Lucknow doesn\'t forget its Super Giants. RTM.',
      'Right To Match — and we do. Confidently.',
      'This player grew with LSG. They stay with LSG.',
    ],
    overbid: [
      'LSG stretched its budget slightly — but the profile demanded it.',
      'A calculated premium for a targeted squad need.',
      'Sanjiv Goenka approved this one. Justified.',
    ],
  },
}

/**
 * Returns a random comment for a franchise in a given scenario.
 * Always returns a string — never throws, never returns undefined.
 */
export function getFallbackComment(teamId: string, scenario: CommentScenario): string {
  const teamBank = bank[teamId]
  if (!teamBank) return `${teamId} makes their move.`
  const lines = teamBank[scenario]
  if (!lines || lines.length === 0) return `${teamId} makes their move.`
  return lines[Math.floor(Math.random() * lines.length)]
}
