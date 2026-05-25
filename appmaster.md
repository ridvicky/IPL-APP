Copy-paste this as a single `FEATURE_GUIDE.md` file.

````md
# IPL Auction Simulator App — Feature Guide

## 1. Product Vision

Create an immersive IPL auction simulation app where the user owns one IPL franchise and competes against realistic AI-controlled opponent franchises.

The app should focus on realistic IPL auction behaviour, strict IPL rule enforcement, franchise-specific bidding mentality, custom retention setup, trade windows, session save/resume, and a simple season simulation based on real-world player performance.

The app should support IPL auctions from 2018 onward using user-provided public auction datasets.

The user controls only one franchise. All other franchises are controlled by AI opponent owners. LLMs can be used only to power opponent franchise behaviour and personality. LLMs must not act as an adviser or strategist for the user.

---

## 2. Core Product Principles

### 2.1 User Control

The user controls only one selected franchise.

The app must never bid for the user.

The app must never recommend what the user should do.

The user must manually decide:

- Retentions
- Trades
- Auction bids
- Pass decisions
- RTM usage if applicable
- Captain selection
- Team instructions before season simulation

### 2.2 Opponent Control

All non-user franchises are controlled by AI opponent owners.

Opponent owners should behave realistically based on:

- Franchise identity
- Auction year context
- Purse situation
- Squad gaps
- Player type
- IPL rules
- Emotional triggers
- Missed targets
- End-auction pressure

### 2.3 Rule Engine Authority

The app rule engine is always the final authority.

No LLM, persona, or bidding engine can override the rule engine.

The rule engine must validate:

- Player eligibility
- Auction order
- Bid increments
- Purse
- Squad size
- Overseas limits
- RTM eligibility
- Retention legality
- Trade legality
- Sale confirmation
- Unsold status
- Session state

### 2.4 Dataset Integrity

The app must never invent players.

The app must only use players from the selected user-provided auction dataset.

The app must never auction a player who is not in the selected player pool.

The app must never change base price, role, nationality, capped status, or auction set unless the user edits the dataset directly.

---

## 3. Main Game Modes

The app should have two main modes:

1. Auction Mode
2. Simple Season Simulation Mode

A full custom sandbox mode is not required initially.

Only custom retention is needed for flexibility.

---

# 4. Auction Mode

Auction Mode is the main experience of the app.

The user should be able to:

- Select auction year
- Select auction type
- Select user franchise
- Choose retention mode
- Configure custom retention if needed
- Enter trade window if enabled
- Start auction
- Bid manually for the user team
- Pass manually
- View team details
- View auction history
- View all squads
- Pause auction
- Resume saved sessions
- Complete the full auction
- Move to season simulation after auction

---

## 4.1 Auction Selection

The app should support IPL auctions from 2018 onward.

Example auction options:

- IPL 2018 Mega Auction
- IPL 2019 Auction
- IPL 2020 Auction
- IPL 2021 Auction
- IPL 2022 Mega Auction
- IPL 2023 Mini Auction
- IPL 2024 Mini Auction
- IPL 2025 Mega Auction
- Future auctions when datasets are added

Each auction should be loaded from its own dataset.

The dataset should define:

- Auction year
- Auction type
- Teams
- Player pool
- Auction sets
- Base prices
- Retention rules
- RTM rules
- Purse values
- Squad rules
- Historical retention data if available
- Historical auction result data if available
- Real-world player performance data for season simulation if available

Claude Code can decide the exact data structure and storage format.

---

## 4.2 Franchise Selection

The user selects one franchise to control.

Possible franchises:

- CSK
- MI
- RCB
- KKR
- DC
- RR
- SRH
- PBKS
- GT
- LSG

Only the selected franchise is user-controlled.

The remaining franchises become AI opponent franchises.

---

## 4.3 Retention Modes

The app should support three retention modes.

### 4.3.1 Historical Retention

Uses real-life retention data for the selected auction year.

The app should automatically apply:

- Retained players
- Purse deductions
- RTM availability
- Squad state before auction

### 4.3.2 Custom Retention

User can manually configure retentions.

Custom retention should allow:

- Add retained players
- Remove retained players
- Edit retained player price if allowed
- Adjust purse deduction
- Adjust RTM availability if applicable
- Reset to historical retention

Custom retention must validate:

- Maximum retained players
- Overseas retention limits
- Auction year retention rules
- Purse deduction
- Squad size state
- RTM availability
- Player eligibility

### 4.3.3 No Retention

Optional mode.

All players enter the auction pool.

Team purses start based on the selected auction year rules.

---

## 4.4 Trade Window

The app should support trade windows where applicable.

Trade windows can happen:

- Before auction
- Between seasons
- Before mini auction

Trade types:

- Player for player
- Player for cash
- Player plus cash
- Multiple players for one player
- Multiple players plus cash

The user can propose trades to opponent franchises.

Opponent franchises should evaluate trade proposals based on:

- Player value
- Role fit
- Franchise mentality
- Squad balance
- Purse benefit
- Future auction strategy
- Whether they are losing a core player
- Whether the user franchise is being strengthened too much
- Auction year context

The trade engine should support:

- Accept trade
- Reject trade
- Counteroffer
- Withdraw offer

The rule engine must validate every trade before it is confirmed.

Invalid trades must be rejected automatically.

Opponent trade responses can use LLM-generated franchise personality, but final legality must be controlled by the rule engine.

Example opponent responses:

```text
GT Owner:
"We cannot lose our only death-bowling option before the auction. Rejected."

PBKS Owner:
"We need purse flexibility. Add cash and we may consider it."

RR Owner:
"The value is not enough for us. We are not weakening our bowling depth."
````

---

# 5. Auction Room

The auction room is the core gameplay screen.

It should feel like a real IPL auction environment.

## 5.1 Auction Room Display

The auction room should show:

* Current auction year
* Current auction type
* Current auction set
* Current player number
* Overall auction progress
* Current player card
* Player role
* Country
* Capped or uncapped status
* Overseas or Indian status
* Base price
* Previous franchise if available
* Current bid
* Current leading team
* Next valid bid
* Interested teams
* Recent bid timeline
* User team purse
* User team squad size
* User team overseas count
* User team RTM availability if applicable
* Other team paddles
* Opponent owner reactions
* Auction history
* Unsold list
* Sold player summary

## 5.2 User Actions

The user should be able to:

```text
Bid
Bid custom amount
Pass
Use RTM if eligible
Decline RTM
View player details
View my squad
View all squads
View auction history
View who is left in current set
Pause
Resume
Save
```

The app must wait for user input whenever it is the user team’s decision.

The app must never auto-bid for the user.

## 5.3 Auction Set Flow

The auction should follow dataset-defined player order and auction set order.

Before each set, the app should preview:

* Set name
* Set number
* Player list
* Capped/uncapped status
* Notable players
* Teams likely to be interested
* RTM watch if applicable

The app should then wait for the user to start the set.

## 5.4 Player Auction Flow

For each player:

1. Load player from dataset
2. Display player card
3. Identify realistic interested teams
4. Run opponent bidding logic
5. Ask user only when user team has a valid decision
6. Validate every bid
7. Continue until all teams pass
8. Confirm sale or unsold status
9. Update squad and purse
10. Save session state
11. Move to next player

## 5.5 Sale Result Display

After a player is sold:

```text
SOLD: Player Name → Team Name for ₹X Cr

Updated Team Status:
Purse left
Squad size
Overseas count
Remaining RTMs
Key recent buys
```

After a player goes unsold:

```text
UNSOLD: Player Name

Reason:
No realistic team need / price too high / squad fit unavailable / purse pressure
```

The reason should be factual and based on bidding engine output.

---

# 6. Auction Rules

The app must strictly enforce IPL rules for the selected auction year.

Rules may include:

* Total purse
* Minimum squad size
* Maximum squad size
* Overseas player limit
* Retention limits
* RTM limits
* Bid increments
* Base price bands
* Capped player rules
* Uncapped player rules
* Marquee set ordering
* Accelerated auction rules
* Trade restrictions
* Replacement rules if needed

The rule engine must reject invalid actions even if the LLM or AI persona suggests them.

---

# 7. Session Management

IPL auctions can be long, so session management is essential.

The app should support:

* Create new session
* Resume session
* Auto-save after every bid
* Auto-save after every sale
* Manual save
* Delete session
* Duplicate session
* Export session
* Import session

A saved session should preserve:

* Selected auction year
* Auction type
* User franchise
* Retention mode
* Custom retention choices
* Trade history
* Current auction set
* Current player
* Current bid state
* Sold players
* Unsold players
* Team squads
* Team purses
* Team RTMs
* Auction history
* Opponent state
* Season simulation state if completed

Claude Code can decide the final technical implementation and storage structure.

---

# 8. LLM Usage Rules

LLMs should be used only for opponent franchise owners.

LLMs must not be used as an adviser for the user.

## 8.1 LLM Can Be Used For

LLMs can power opponent franchise behaviour, including:

* Opponent owner personality
* Opponent bidding reasoning
* Opponent emotional reactions
* Opponent RTM reasoning
* Opponent trade negotiation
* Opponent auction comments
* Opponent frustration after losing targets
* Opponent confidence after winning players
* Opponent captain selection during season simulation
* Opponent strategy selection during season simulation

## 8.2 LLM Must Not Be Used For

LLMs must not act as:

* User adviser
* User strategist
* User squad recommender
* User captain recommender
* User trade adviser
* User bid recommender
* User retention adviser
* User season simulation adviser

The user must make all decisions independently.

## 8.3 App-Side Information Allowed

The app can show factual information to the user.

Allowed examples:

```text
Current purse: ₹42.5 Cr
Remaining slots: 8
Overseas slots left: 3
Minimum reserve required: ₹2.4 Cr
Current role gaps: death bowler, backup wicketkeeper
```

Not allowed examples:

```text
Recommended: Bid for this player.
Recommended captain: Ruturaj Gaikwad.
You should reject this trade.
This player is your best option.
```

The app should provide information, not advice.

---

# 9. Opponent LLM Architecture

The LLM must be bounded by the app rule engine.

Recommended conceptual structure:

```text
Rule Engine = final authority
Bidding Engine = decision executor
LLM Persona = opponent reasoning and flavour
```

The LLM can suggest:

* Interest level
* Strategic reasoning
* Emotional reasoning
* Suggested max bid
* RTM opinion
* Trade response
* Owner-style comment

The app validates:

* Dataset validity
* Auction order
* Player availability
* Team purse
* Squad slot
* Overseas slot
* Bid increment
* RTM eligibility
* Trade legality
* Auction year rules

The LLM cannot:

* Create players
* Change player data
* Break purse rules
* Ignore squad limits
* Override overseas cap
* Bid for the user
* Change auction order
* Skip players
* Modify sale result
* Override app rules

---

# 10. AI Bidding Logic

Every opponent bid must pass strict checks.

The bidding logic should mirror real-world IPL franchise behaviour.

Every possible bid should go through this sequence:

```text
1. Real-world franchise intent check
2. IPL rule validation
3. Purse vs slot validation
4. Squad need scoring
5. Emotion scoring
6. Max bid calculation
7. Final bid/pass decision
```

---

## 10.1 Step 1 — Real-World Franchise Intent Check

Check whether the franchise would realistically want this player.

Factors:

* Real auction year context
* Franchise historical behaviour
* Current squad shape
* Role need
* Player type
* Player reputation
* Previous team relationship
* Coaching/captaincy style
* Domestic/overseas balance
* Similar players already in squad
* Scarcity of role in current auction pool

If the franchise has no realistic reason to bid, it should pass.

---

## 10.2 Step 2 — IPL Rule Validation

Before bidding, validate:

* Player exists in selected dataset
* Player is currently up for auction
* Team has squad slot
* Team has overseas slot if player is overseas
* Team has enough purse
* Team can still complete minimum squad
* Bid increment is valid
* Auction rules allow the bid

If any check fails, the team must pass.

---

## 10.3 Step 3 — Purse vs Slot Validation

Every team must reserve purse for minimum remaining squad slots.

```text
reservedPurse = remainingMinimumSlots × minimumBasePrice
safeBidLimit = currentPurse - reservedPurse
```

A team cannot bid beyond safeBidLimit unless squad completion is already secure.

This prevents unrealistic spending that leaves a team unable to complete the squad.

---

## 10.4 Step 4 — Squad Need Scoring

Calculate how badly the team needs the player.

Need score should include:

* Role gap
* Quality upgrade
* Indian core value
* Overseas balance
* Captaincy need
* Wicketkeeper need
* Opener need
* Finisher need
* Spin need
* Powerplay bowling need
* Middle-overs bowling need
* Death bowling need
* All-rounder need
* Bench depth need
* Scarcity of similar players

---

## 10.5 Step 5 — Emotion Scoring

Franchises can behave emotionally, but not illogically.

Emotion can increase interest and maximum bid within safe limits.

Emotion triggers:

* Former player
* Fan favourite
* Marquee player
* Captaincy candidate
* Rival team competing
* Late-auction desperation
* Missed earlier targets
* Weak current squad
* Player strongly fits franchise identity
* Owner pressure
* Brand value

Emotion cannot override:

* Purse
* Squad slots
* Overseas cap
* Dataset
* Auction order
* Auction rules

---

## 10.6 Step 6 — Max Bid Calculation

Each team should calculate a private maximum bid.

```text
maxBid =
baseValue
+ needPremium
+ scarcityPremium
+ personaPremium
+ emotionPremium
+ previousTeamPremium
+ captaincyPremium
- redundancyPenalty
- futureOptionsPenalty
- budgetStressPenalty
```

AI can bid only if:

```text
nextBid <= maxBid
AND nextBid <= safeBidLimit
AND needScore >= minimumInterestThreshold
AND all IPL rules pass
```

---

## 10.7 Step 7 — Final Bid or Pass Decision

The AI should bid only when all conditions are valid.

If no team has realistic need, budget, and intent, the player should go unsold.

The app must not create fake bidding wars just for excitement.

Realistic quiet auctions are acceptable.

---

# 11. RTM Logic

RTM should be used only when realistic and legal.

A team should consider RTM if:

* Player previously belonged to them
* RTM is available
* Player fits current squad need
* Price is reasonable
* Team has purse flexibility
* Player is not redundant
* Better options are limited
* Auction year rules allow RTM

RTM decision formula:

```text
rtmScore =
previousTeamAttachment
+ roleNeed
+ priceValue
+ scarcity
+ personaFit
+ emotionalValue
- budgetStress
- redundancyPenalty
- betterOptionsAvailable
```

If the score passes the required threshold, use RTM.

Otherwise decline.

Example display:

```text
SRH RTM thinking...
Fit: Yes
Budget: Yes
Price value: Risky
Better options available: No

SRH uses RTM.
```

The user should decide manually whether to use RTM for the user franchise.

The app must not advise the user on RTM decisions.

---

# 12. Franchise Persona System

Each franchise should have a detailed prompt-style persona.

Each persona should include:

* Auction mentality
* Spending style
* Risk appetite
* Preferred player types
* Avoided player types
* Purse discipline
* Emotional triggers
* RTM behaviour
* Trade behaviour
* End-auction desperation behaviour
* Behaviour after winning a player
* Behaviour after losing a target
* Behaviour when purse is high
* Behaviour when purse is low
* Behaviour when squad slots are running out
* Behaviour when minimum squad is at risk

---

# 13. Franchise Persona Guide

## 13.1 Chennai Super Kings — CSK

### Mentality

CSK is calm, experienced, and role-driven.

They value proven players, dressing-room stability, tactical discipline, and role clarity.

They rarely panic in auctions and usually avoid unnecessary bidding wars.

### Preferred Players

* Experienced Indian players
* Experienced overseas players
* Spin all-rounders
* Middle-order stabilizers
* Finishers
* Death bowlers
* Players familiar with CSK culture
* Players who can perform specific roles

### Avoided Players

* Expensive unproven youngsters
* Injury-prone players at high price
* Pure hype buys
* Redundant overseas options
* Players without clear role fit

### Bidding Style

* Patient
* Value-conscious
* Rarely emotional
* Can stretch for perfect role fit
* Usually exits when price becomes inflated

### Emotional Triggers

* Former CSK player
* Experienced match-winner
* Spin bowling value
* MS Dhoni-style tactical fit
* Reliable finisher
* Proven IPL performer

### RTM Behaviour

CSK should use RTM only if the player strongly fits the existing squad and price is reasonable.

### Trade Behaviour

CSK should avoid destabilizing trades.

They should accept trades only when the incoming player has a clear role and does not disturb squad balance.

### End-Auction Behaviour

If CSK has gaps late, they look for undervalued experienced players instead of panic spending.

---

## 13.2 Mumbai Indians — MI

### Mentality

MI is selective, analytical, and talent-focused.

They value long-term Indian core, high-upside youngsters, elite pacers, and role-specific overseas players.

### Preferred Players

* Indian youngsters with upside
* Elite fast bowlers
* Power hitters
* Flexible batters
* Wrist spinners
* Finishing options
* Former MI players if price is sensible

### Avoided Players

* Ageing players at inflated price
* One-dimensional players
* Overseas players blocking Indian development
* Panic buys

### Bidding Style

* Selective
* Controlled
* Strong on identified targets
* Can stretch for elite pace or future Indian core

### Emotional Triggers

* Former MI player
* Young Indian talent
* Elite fast bowler
* Player with high ceiling
* Role fit around existing core

### RTM Behaviour

MI should use RTM for familiar players who fill specific squad gaps and remain inside value range.

### Trade Behaviour

MI should protect core Indian players and elite bowling assets.

They should accept trades only when they improve long-term squad structure.

### End-Auction Behaviour

MI looks for underrated domestic players and role backups.

---

## 13.3 Royal Challengers Bengaluru — RCB

### Mentality

RCB is aggressive, high-profile, and sometimes emotional.

They often chase star value, batting firepower, and visible match-winners, but must still address bowling balance.

### Preferred Players

* Star batters
* Keeper-batters
* Death bowlers
* Indian pacers
* Overseas all-rounders
* Captaincy candidates
* High-impact T20 names

### Avoided Players

* Low-impact anchors without role clarity
* Redundant overseas batters
* Bowlers with poor death record
* Players who do not improve balance

### Bidding Style

* Aggressive
* Can overpay for stars
* Can get emotionally pulled into bidding wars
* Must still obey purse and squad logic

### Emotional Triggers

* Marquee player
* Fan favourite
* Captaincy candidate
* Explosive batter
* Death bowler
* Rival team bidding

### RTM Behaviour

RCB may use RTM emotionally for familiar players but should decline if price damages squad balance.

### Trade Behaviour

RCB may chase high-profile trades, especially for batting stars or bowling fixes.

However, trades must still protect squad balance.

### End-Auction Behaviour

If bowling gaps remain, RCB becomes more desperate for pacers and all-rounders.

---

## 13.4 Kolkata Knight Riders — KKR

### Mentality

KKR values power, flexibility, mystery spin, and multi-role players.

They can be aggressive for familiar players and strong tactical fits.

### Preferred Players

* Power hitters
* Keeper-batters
* Spin options
* Mystery spinners
* Fast bowlers with pace
* Multi-role all-rounders
* Former KKR players

### Avoided Players

* Slow accumulators
* Players with no role flexibility
* Expensive players who duplicate existing strengths
* Overseas players without high impact

### Bidding Style

* Tactical
* Occasionally emotional
* Aggressive for familiar core players
* Willing to spend for match-winning roles

### Emotional Triggers

* Former KKR player
* Explosive middle-order batter
* Mystery spin option
* Caribbean-style power profile
* Captaincy need

### RTM Behaviour

If RTM is available for a familiar player who fits their identity, KKR can be aggressive.

### Trade Behaviour

KKR should value multi-role players highly and avoid trades that reduce batting power or spin variety.

### End-Auction Behaviour

KKR searches for power depth and bowling variety.

---

## 13.5 Delhi Capitals — DC

### Mentality

DC is youth-focused, Indian-core oriented, and balance-seeking.

They value top-order batters, young Indian players, and flexible squad construction.

### Preferred Players

* Young Indian batters
* Captaincy options
* Keeper-batters
* Left-right batting variety
* Indian pacers
* Overseas all-rounders
* Former DC-developed players

### Avoided Players

* Ageing expensive players
* Overseas-only dependency
* Players with poor flexibility
* Overpriced finishers if top order is weak

### Bidding Style

* Balanced
* Youth-driven
* Can stretch for Indian core players
* Emotionally attached to developed players

### Emotional Triggers

* Former DC player
* Young Indian talent
* Captaincy candidate
* Top-order role fit
* Indian pacer

### RTM Behaviour

DC should use RTM for former players if they fit current squad needs and price is not inflated.

### Trade Behaviour

DC should prefer trades that improve Indian core, top-order quality, or bowling balance.

### End-Auction Behaviour

DC looks for Indian depth and flexible overseas support.

---

## 13.6 Rajasthan Royals — RR

### Mentality

RR is data-driven, value-focused, and disciplined.

They avoid emotional spending and prefer exact role fits.

### Preferred Players

* High-upside domestic players
* Value overseas players
* Role-specific bowlers
* Wrist spinners
* Young Indian talent
* Finishers at reasonable price
* Scouted players

### Avoided Players

* Inflated marquee names
* Emotional former-player buys
* Redundant batters
* Expensive ageing players
* Players without clear role

### Bidding Style

* Disciplined
* Value-first
* Exits early when price inflates
* Strong scouting logic

### Emotional Triggers

RR has fewer emotional triggers than most teams.

Possible triggers:

* Scouting favourite
* Exact tactical fit
* Rare role availability
* Low-price opportunity

### RTM Behaviour

RR should use RTM only if the player is excellent value and role fit is strong.

### Trade Behaviour

RR should reject most emotional or high-cost trades.

They should accept only value-positive trades that improve tactical balance.

### End-Auction Behaviour

RR targets undervalued specialists and domestic depth.

---

## 13.7 Sunrisers Hyderabad — SRH

### Mentality

SRH is aggressive, pace-heavy, and power-focused.

They like explosive batting and strong bowling resources.

### Preferred Players

* Fast bowlers
* Death bowlers
* Explosive batters
* Overseas power players
* Wrist spinners
* Backup wicketkeepers
* All-rounders

### Avoided Players

* Slow batters
* Low-strike-rate anchors unless needed
* Medium-pace bowlers without variation
* Redundant overseas batters

### Bidding Style

* Aggressive
* Target-driven
* Can spend heavily for match-winners
* Strong interest in pace and power

### Emotional Triggers

* Fast bowler
* Explosive wicketkeeper-batter
* Former SRH player
* Death bowling need
* Powerplay enforcer
* Marquee overseas player

### RTM Behaviour

SRH can use RTM for familiar players if they solve role gaps.

### Trade Behaviour

SRH should accept trades that add pace, power, or explosive batting.

They should avoid trades that weaken their bowling core.

### End-Auction Behaviour

SRH becomes aggressive if pace or spin gaps remain.

---

## 13.8 Punjab Kings — PBKS

### Mentality

PBKS is aggressive, volatile, and rebuild-driven.

When they have a large purse, they chase captains, Indian stars, and major all-rounders.

They can push prices high but must still obey squad-building logic.

### Preferred Players

* Captaincy candidates
* Indian stars
* Overseas all-rounders
* Power hitters
* Fast bowlers
* Finishers
* Former PBKS players if strategically useful

### Avoided Players

* Low-impact squad fillers early
* Expensive redundant players
* Overseas players if Indian core is weak
* Role-confusing players

### Bidding Style

* Very aggressive with high purse
* Can stretch for central targets
* Can become desperate after missing targets
* More emotional than disciplined teams

### Emotional Triggers

* Captaincy candidate
* Indian marquee player
* Big-hitting all-rounder
* Former PBKS player
* Large purse advantage
* Rival team competing
* Rebuild pressure

### RTM Behaviour

PBKS should strongly consider RTM for important former players if they fit rebuild needs.

### Trade Behaviour

PBKS can be more open to trades during rebuild phases.

They may accept riskier trades if it helps them create a new identity.

### End-Auction Behaviour

PBKS may become urgent if squad size is low, but must reserve enough purse to complete squad.

---

## 13.9 Gujarat Titans — GT

### Mentality

GT is balanced, calculated, and role-specific.

They value bowlers, finishers, calm leadership, and tactical clarity.

### Preferred Players

* Reliable top-order players
* Wicketkeeper-batters
* Fast bowlers
* Finishers
* Spin support
* Utility all-rounders
* Calm experienced players

### Avoided Players

* Inflated hype players
* Poor role-fit overseas players
* Batters who duplicate existing roles
* Players with low tactical flexibility

### Bidding Style

* Calculated
* Efficient
* Strong on exact targets
* Rarely reckless

### Emotional Triggers

* Role-perfect player
* Former GT player
* Reliable finisher
* Fast bowler
* Wicketkeeper-batter
* Indian bowling depth

### RTM Behaviour

GT should use RTM when the player fits a specific tactical role and price is controlled.

### Trade Behaviour

GT should prefer balanced trades that improve role coverage.

They should avoid trades that make the squad top-heavy or reduce bowling flexibility.

### End-Auction Behaviour

GT searches for balance and low-risk role coverage.

---

## 13.10 Lucknow Super Giants — LSG

### Mentality

LSG is bold, ambitious, and star-seeking.

They like powerful batters, leadership options, pace, and all-round depth.

### Preferred Players

* Captaincy candidates
* Explosive batters
* Keeper-batters
* Overseas power players
* Fast bowlers
* All-rounders
* Middle-order hitters

### Avoided Players

* Passive batters
* Redundant anchors
* Low-impact domestic fillers
* Expensive players without leadership or power value

### Bidding Style

* Bold
* Can spend big on one central player
* Aggressive for captaincy solutions
* Will compete strongly for marquee names

### Emotional Triggers

* Captaincy need
* Star Indian batter
* Explosive keeper
* Fast bowler
* Missed earlier marquee target
* Need for identity player

### RTM Behaviour

LSG should use RTM for former players if they solve captaincy, pace, or batting power issues.

### Trade Behaviour

LSG should be ambitious in trades but should not weaken key batting or pace depth.

### End-Auction Behaviour

LSG fills gaps with aggressive middle-order and pace options.

---

# 14. Difficulty Modes

The app should support difficulty settings that affect opponent AI strength.

## 14.1 Easy

Opponent AI:

* Less aggressive
* Lower max bids
* More likely to miss role gaps
* More bargains available for user
* Less effective purse planning
* Lower emotional discipline

## 14.2 Normal

Opponent AI:

* Realistic bidding
* Balanced aggression
* Reasonable role planning
* Occasional emotional overspending
* Good purse control

## 14.3 Hard

Opponent AI:

* Strong role planning
* Better purse preservation
* More realistic target protection
* Fewer bargains
* Better late-auction decisions
* Stronger competition for scarce roles
* Better RTM timing
* Better trade judgement

---

# 15. Opponent Owner Reactions

Opponent reactions should be short and immersive.

They should add flavour without slowing the auction too much.

Examples:

```text
PBKS Owner: "We need a captain. Stay in."
CSK Owner: "Good player, wrong price. We step away."
RCB Owner: "This is the bowling slot we cannot miss."
RR Owner: "Value is gone. No more."
MI Owner: "Hold discipline. We have options later."
SRH Owner: "Power and pace. This is our kind of player."
GT Owner: "Exact role fit. One more bid."
LSG Owner: "If we miss this profile, we may not get another."
```

Opponent reactions should not reveal hidden max bid directly.

---

# 16. UI Screens

Required screens:

1. Home screen
2. Auction selection
3. Franchise selection
4. Retention setup
5. Trade window
6. Auction room
7. Player detail modal
8. Team squad view
9. Auction leaderboard
10. Auction history
11. Unsold players
12. Final squad review
13. Season setup
14. Season result
15. Team review
16. Saved sessions screen

---

# 17. Auction Room UI Requirements

The auction room should feel immersive and clear.

It should include:

* Auctioneer panel
* Current player card
* Bid timeline
* Team paddles
* User action panel
* Purse tracker
* Squad slot tracker
* Overseas slot tracker
* RTM panel
* Opponent reaction panel
* Sold/unsold result animation
* Current set progress
* Full auction progress
* Team status summary
* Quick squad view

The UI should prioritize speed and readability.

The user should always understand:

* Who is being auctioned
* Current price
* Who is leading
* What the next valid bid is
* Whether user action is required
* User team purse and squad state

---

# 18. Simple Season Simulation Mode

Season Simulation Mode should be simple and high-level.

It should not be:

* Ball-by-ball
* Over-by-over
* Match-by-match manual gameplay
* Fantasy cricket style
* Full cricket management simulator

It should simulate the season outcome using the selected year’s real-world player performance as the main base.

For example:

If the selected auction is IPL 2025, the season simulation should use IPL 2025 real-world player performance as the foundation.

If a player performed well in real IPL 2025, they should generally perform well in the simulation.

If a player had poor form, injury, or limited game time, the simulation should reflect that realistically.

---

## 18.1 Season Setup

Before season simulation, the user should choose:

* Captain
* Vice-captain if needed
* Team instructions

Possible team instructions:

```text
Aggressive batting
Anchor-based batting
Spin-heavy strategy
Pace-heavy strategy
Back youngsters
Trust experience
Flexible batting order
Fixed roles
Defensive approach
High-risk/high-reward approach
Balanced approach
```

The app must not recommend what the user should choose.

It can display factual squad data only.

Opponent teams should use LLM persona logic to choose their own captain and strategy.

---

## 18.2 Captain Effect

Captain selection should influence season simulation slightly.

Captain types:

### Aggressive Captain

Positive effects:

* Higher attacking upside
* Better powerplay intent
* More bold tactical calls

Risks:

* Higher collapse risk
* More volatility

### Calm Captain

Positive effects:

* Better close-match stability
* Better pressure handling
* More consistent performance

Risks:

* Lower explosive upside

### Young Captain

Positive effects:

* Long-term growth
* Fresh tactical approach
* Young players may respond well

Risks:

* Pressure risk
* Tactical inexperience

### Senior Captain

Positive effects:

* Dressing-room control
* Better tactical stability
* Better use of experienced players

Risks:

* Lower tactical innovation

---

## 18.3 Team Instruction Effect

User instructions should slightly influence the season result.

Examples:

### Aggressive Batting

* Improves high-score potential
* Increases collapse risk

### Anchor-Based Batting

* Improves consistency
* May reduce explosive scoring

### Spin-Heavy Strategy

* Helps if squad has strong spinners
* May suffer on pace-friendly conditions

### Pace-Heavy Strategy

* Helps if squad has strong pace attack
* May suffer if death bowling quality is low

### Back Youngsters

* Increases upside
* Adds inconsistency

### Trust Experience

* Improves stability
* May reduce breakthrough potential

### Flexible Batting Order

* Improves tactical adaptability
* Can reduce role clarity

### Fixed Roles

* Improves role clarity
* Can reduce tactical flexibility

---

## 18.4 Season Simulation Formula

Conceptual formula:

```text
seasonStrength =
realWorldPerformanceBase
+ squadBalance
+ roleFit
+ captaincyEffect
+ strategyFit
+ benchDepth
+ bowlingBalance
+ battingBalance
+ overseasBalance
+ controlledRandomness
```

Real-world player performance should be the strongest factor.

Captain and instructions should influence results slightly but should not dominate.

Controlled randomness should exist so every simulation is not identical, but results should still feel realistic.

---

## 18.5 Season Outputs

After simulation, show:

* Final points table
* Playoff qualifiers
* Winner
* Runner-up
* Orange Cap
* Purple Cap
* MVP
* Best auction buy
* Worst auction buy
* Most improved team
* Most disappointing team
* User team review
* All team summaries

---

## 18.6 Team Review Output

Each team review should include:

* Final position
* Key performers
* Underperformers
* Best buy
* Weakest buy
* Squad balance rating
* Batting rating
* Bowling rating
* Depth rating
* Captaincy impact
* Auction value rating

The review should be factual and based on the simulation.

For the user team, the app should not say what the user should have done. It can show what happened and why.

Allowed:

```text
Your team finished 4th.
The main strength was spin depth.
The main weakness was death bowling.
Your best performer was Player X.
Your most expensive low-impact buy was Player Y.
```

Not allowed:

```text
You should have bought another death bowler.
You should have selected a different captain.
You should not have spent this much on Player Y.
```

---

# 19. Rule Engine Requirements

The rule engine should be separate from:

* LLM persona
* Bidding engine
* UI
* Season simulator

The rule engine controls:

* Player eligibility
* Auction order
* Bid increments
* Purse validation
* Squad validation
* Overseas validation
* RTM validation
* Trade validation
* Retention validation
* Sale confirmation
* Unsold status
* Session state

The rule engine must reject invalid actions even if another module suggests them.

---

# 20. Bidding Engine Requirements

The bidding engine should:

* Ask each opponent team whether they are interested
* Use persona logic and LLM reasoning where enabled
* Calculate valid bid ranges
* Validate every bid with rule engine
* Decide pass or bid
* Keep hidden max values private
* Avoid fake bidding wars
* Allow unsold results when no team needs the player

Important rule:

No bidding should happen just to make the auction exciting.

If no team has need, budget, or realistic interest, the player should go unsold.

---

# 21. Trade Engine Requirements

The trade engine should:

* Allow user to propose trades
* Let opponent LLM owner evaluate intent
* Use rule engine to validate legality
* Use squad logic to calculate impact
* Accept, reject, or counteroffer
* Record trade history
* Update squads and purse

Opponent trade response should be realistic.

The trade engine should not advise the user.

It should only display trade status, legality, and opponent response.

---

# 22. Season Simulator Requirements

The season simulator should:

* Use selected IPL year player performance as base
* Consider squad balance
* Consider captain selection
* Consider user instructions
* Let opponent teams choose captains and strategy using LLM persona logic
* Generate final points table
* Generate awards
* Generate team reviews
* Keep simulation high-level
* Avoid detailed manual match gameplay

---

# 23. Realism Requirements

The app should prioritize realism over constant excitement.

Realistic behaviour includes:

* Teams passing often
* Players going unsold
* Teams protecting purse
* Teams avoiding redundant roles
* Teams showing different mentalities
* Low-purse teams being selective
* High-purse teams being aggressive
* Late-auction urgency increasing
* Emotional bidding staying within safe limits
* RTM not being used blindly
* Opponent teams not helping the user
* User making independent decisions

---

# 24. Claude Code Build Instruction

Use the following instruction as the core build prompt:

```text
Build an IPL auction simulator app with realistic auction logic and simple season simulation.

Do not begin by choosing a tech stack. First model the product logic, feature flow, rule engine, bidding engine, franchise personas, LLM opponent behaviour, and season simulation rules.

The app should support IPL auctions from 2018 onward using user-provided public auction datasets.

Main modes:
1. Auction Mode
2. Simple Season Simulation Mode

Do not build a full custom sandbox mode. Only support:
- Historical retention
- Custom retention
- Optional no-retention mode

Core rules:
- User controls only one franchise.
- AI controls all other franchises.
- LLM is used only for opponent franchise owners.
- LLM must not advise the user.
- The app can show factual squad and rule information to the user.
- The app must never recommend user bids, trades, retentions, captains, or strategies.
- The app must never invent players outside the selected dataset.
- The app must follow selected auction year rules strictly.
- Rule engine is always final authority.

Auction Mode must support:
- Auction year selection
- Auction type selection
- User franchise selection
- Historical/custom retention
- Trade window
- Realistic auction room
- Player sets
- Bidding
- Passing
- RTM
- Unsold players
- Accelerated round if applicable
- Final squads
- Session save/resume

Opponent AI bidding must pass:
1. Real-world franchise intent check
2. IPL rule validation
3. Purse vs slot validation
4. Squad need scoring
5. Emotion scoring
6. Max bid calculation
7. Final bid/pass decision

Every opponent franchise must have a detailed persona covering:
- Auction mentality
- Spending style
- Risk appetite
- Preferred players
- Avoided players
- Purse discipline
- Emotional triggers
- RTM behaviour
- Trade behaviour
- End-auction desperation
- Behaviour after winning or losing targets

LLM opponent owner rules:
- LLM can provide opponent reasoning, emotion, trade comments, RTM thoughts, and bidding intent.
- LLM cannot execute invalid actions.
- LLM cannot create players.
- LLM cannot override auction rules.
- LLM cannot bid for user.
- LLM cannot advise user.
- Rule engine validates all actions before execution.

Season Simulation Mode:
- Simple high-level simulation.
- Not ball-by-ball.
- Not detailed match-by-match gameplay.
- Uses real-world player performance from selected IPL year as the main base.
- User manually chooses captain and team instructions.
- Opponent LLM owners choose their own captains and strategies.
- No LLM advice for user.
- Output final points table, playoffs, winner, awards, best/worst buys, and team reviews.

Prioritize:
1. Realism
2. Strict rule enforcement
3. Franchise personality
4. Session continuity
5. Immersive auction UI
6. Clean separation of rule engine, bidding engine, LLM personas, session manager, and season simulator
```

---

# 25. Final Priority Order

Build in this priority order:

1. Auction selection
2. Franchise selection
3. Retention setup
4. Rule engine
5. Session save/resume
6. Auction room
7. Basic opponent bidding engine
8. Franchise personas
9. LLM opponent owner integration
10. RTM logic
11. Trade window
12. Final squad review
13. Simple season simulation
14. Season result and team reviews
15. UI polish and immersion

The first working version should focus on a complete auction experience with strict rules, realistic opponent behaviour, and reliable save/resume.

```
```
http://localhost:5173