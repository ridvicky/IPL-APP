# IPL Auction Simulator — Bidding Engine Documentation

**Files covered:** `src/engine/biddingEngine.ts`, `src/engine/ruleEngine.ts`  
**Last reviewed:** 6th June 2026

---

## Overview

The Bidding Engine is the AI brain behind every opponent franchise decision in the auction. For each player that comes up for bid, it runs a 7-step decision pipeline for every non-user team to determine whether to bid and how high to go. It is designed for auction realism — producing realistic sold rates, bidding wars on marquee players, conservative behaviour from saturated or cash-strapped teams, and franchise-specific identity that makes each team feel distinct.

The engine operates in two phases:
- **Phase 1 (live):** Fully static — pure formula-based decisions using player data, franchise persona config, and live game state.
- **Phase 2 (planned):** LLM-assisted — an LLM result can inject personalised ceilings, jump bids, and owner commentary into the pipeline without changing the overall architecture.

---

## Architecture: The 7-Step Pipeline

Every call to `runBiddingPipeline()` executes these steps in order:

```
Player up for bid
       │
       ▼
[Re-auction override] ──► Force bid if squad < 19 and role needed
       │
       ▼
Step 1: Static Interest + Interest Override
       │ effectiveInterest < passThreshold ──► PASS (most teams exit here)
       │
       ▼
Step 2: Rule Engine gate    ── Hard rules: squad full? overseas limit? purse?
       │
       ▼
Step 3: Safe bid limit      ── Can the team afford to bid without starving future picks?
       │
       ▼
Step 4: Need score          ── How urgently does the squad need this player?
       │
       ▼
Step 5: Emotion score       ── Loyalty, rivalry, momentum, interested teams
       │
       ▼
Step 6: Max bid             ── Walk-away price (boughtPrice anchor or formula)
       │
  nextBid > maxBid ─────────► PASS
       │
       ▼
Step 7: Bid decision        ── Bid at nextBid (or LLM jump bid)
```

---

## Pre-Step: Re-Auction Override

Before the standard pipeline runs, a hard override applies during re-auction when a team has fewer than 19 players.

**Trigger:** `isReauction === true` AND `squadSize < 19`

**Logic:**
- Counts role gaps against minimums: BAT ≥ 4, BWL ≥ 4, AR ≥ 2, WK ≥ 1
- Forces a bid if the player fills a needed role OR the squad is critically thin (< 18 players)
- Bypasses all reserve checks — re-auction players cost 50% of base price, so normal reserves are too conservative
- Still respects: already passed, already leading, squad full, overseas limit, raw purse

**Why:** Without this, teams with tight purses would fail to reach the minimum squad size because reserve calculations assume full base prices.

---

## Step 1: Static Interest (`computeStaticInterest`)

**Output:** 0–100 score representing baseline franchise interest before squad-need or emotion.

**Purpose:** This is the primary filter. Most teams pass on most players here, producing realistic bid counts of 2–4 active teams per player.

### Hard Guards (instant 0)
- Player is overseas AND team has no overseas slots left
- Squad is already at maximum size (25 players)

### Base Score
Starts at **30 + tier bonus** (tier bonus = `log10(basePrice + 1) × 30`, capped at 25).

| Base Price | Tier Bonus | Starting Score |
|---|---|---|
| ₹0.20 | ~4 | ~34 |
| ₹0.50 | ~9 | ~39 |
| ₹2 Cr | ~16 | ~46 |
| ₹10 Cr+ | ~25 | ~55 |

Additional flat bonuses applied to base:
- Capped international: **+10**
- Base ≥ ₹10 Cr (elite marquee): **+8**
- Base ≥ ₹4 Cr: **+4**

### Role Weight
Each franchise has per-role weights in their persona (`roleWeights`). The score is multiplied by this weight:
- A team that doesn't value WKs sets `roleWeights.WK = 0.5`, halving their interest in all keepers

### Capped/Nationality Fit
- Capped player + team prefers capped: **+5**
- Uncapped player + team prefers uncapped: **+3**
- Indian player + team prefers Indian: **+4**
- Overseas player + team prefers overseas: **+4**
- Overseas player + team has caution: **−(overseasCaution × 10)**

### Role Saturation (biggest filter)
Reduces interest when a team already has many players in the same role. Applied as a multiplier:

| Role Count | WK multiplier | Non-WK multiplier |
|---|---|---|
| 0 | 1.00 | 1.00 |
| 1 | 0.50 | 1.00 |
| 2 | 0.08 | 1.00 |
| 3–4 | — | 0.72 |
| 5–6 | — | 0.42 |
| 7–8 | — | 0.28 |
| 9+ | — | 0.18 |

**Late-auction relief:** Saturation penalty is progressively reduced as the auction advances (sets 10→15→20) and as the team becomes thinner (5→10→15 slots short), so teams don't stall filling their roster late.

### Overseas Conservation
Teams plan their overseas slots across the whole auction, not just the current player:

| Slots left | Multiplier (normal) | Multiplier (elite overseas, MV ≥ ₹6 Cr) |
|---|---|---|
| 4+ | 1.00 | 1.00 |
| 3 | 0.80 | 0.80 |
| 2 | 0.45 | 0.62 |
| 1 | 0.25 | 0.48 |
| 0 | 0.00 | 0.00 |

### Former Player Loyalty
`player.previousTeam === persona.teamId` → **+loyaltyBonus × 40** (varies by team, typically +8 to +20)

### Session Affinity (Non-Determinism)
Each auction, each team gets a random affinity for each player seeded on `(sessionSalt + teamId + playerId)`, ranging from **−9 to +12**. This makes the same player generate different multi-team competition across different auctions.

### Rivalry / FOMO (Bidder Count)
More teams bidding validates the player's worth and triggers FOMO:
- 3+ active bidders: **+8**
- 5+ active bidders: **+8** (additional)
- 7+ active bidders: **+6** (additional)

### Franchise Targeting (`FRANCHISE_TARGETS`)
Real-world targeting data: if a team is in the player's franchise target list → **+22** (post-saturation, so it cannot be suppressed by role coverage).

### Surprise Events (per-auction, seeded)
- 7% chance: **surprise bidder** (+14) — a team outside their comfort zone bids unexpectedly
- 4% chance: **cold room** (−10) — a team passes due to internal reasons (only fires when squad is not critically thin)

### Star Appeal
| Player tier | Bonus |
|---|---|
| Capped, MV ≥ ₹15 Cr | +20 |
| Capped, MV ≥ ₹8 Cr | +14 |
| Capped, MV ≥ ₹5 Cr | +9 |
| Capped, MV ≥ ₹2 Cr | +5 |
| Capped, base ≥ ₹2 Cr | +4 |
| Uncapped, MV ≥ ₹8 Cr | +10 |
| Uncapped, MV ≥ ₹5 Cr | +6 |
| Uncapped, MV ≥ ₹3 Cr | +3 |

### All-Rounder Archetype Affinity
For AR players, the engine derives their combined archetype: `bowlingType × battingPosition` (e.g. `spin-middleOrder`, `pace-finisher`). Each franchise has per-archetype multipliers via `arArchetypeAffinity`. If archetype is unknown, falls back to generic `bowlingAffinity`.

### Bowling Type Affinity (Pure Bowlers)
`score × persona.bowlingAffinity[pace|spin]`

### Batting Position Affinity (BAT and WK)
`score × persona.battingPositionAffinity[opener|middleOrder|finisher]`

### Captaincy Premium
If the player has a captain profile (`CAPTAIN_CANDIDATES`):
- Team has no captain in squad yet: **+(captainScore / 100) × 20 × captaincyWeight**
- Team already has a captain but player scores ≥ 70: **+(captainScore / 100) × 8 × captaincyWeight**

### Player Type Affinity
Each franchise multiplies interest by type affinity:
- Capped player with MV ≥ ₹8 Cr: `× stars` (RCB 1.30, RR 0.80)
- Uncapped player with potential ≥ 7: `× youth` (GT 1.25, CSK 0.60)
- Value pick (MV / basePrice ≥ 3): `× value` (RR 1.30, RCB 0.70)

### Stage Acquisition Cap
Prevents hoarding in early sets. If a team already has more players than the stage-appropriate maximum, they take a score penalty of **−12 per player over quota**, capped at −48:
- Sets 0–2: max 7 players
- Sets 3–9: max 12 players
- Sets 10–15: max 18 players
- Sets 16+: no cap

### Uncapped Quota Nudge
After set 16, teams are nudged toward picking uncapped players based on how many they have:

| Uncapped count | Bonus |
|---|---|
| < 2 | +12 |
| 2–4 | +10 |
| 5–7 | +8 |
| 8–10 | +8 |

### Real-World Interest (`interestedTeams`)
Each player has an `interestedTeams` array populated from real IPL 2025 auction data.

**Interested team bonus (quality-gated):**

| Player quality | Base bonus | Escalation (if losing bid) |
|---|---|---|
| Elite (prospectTier=elite / pot≥8 / MV≥₹10) | +25 | +10 |
| Promising (pot≥6 / MV≥₹4) | +12 | +5 |
| Fringe | +6 | +2 |

**Non-interested penalty:**  
If the team is NOT interested AND 2+ other teams ARE interested in an elite player (prospectTier=elite / pot≥8 / MV≥₹10): **−10** (fold in star wars you didn't plan for)

### Uncapped Player Potential
For uncapped players with known `potential` and `age`:

```
potentialBonus = (potential - 1) / 9 × 40 × potentialWeight × ageMult
tierSpark      = elite: 12 × pw | promising: 6 × pw
```

Age multiplier relative to `youthThreshold`:

| Age vs threshold | Age multiplier |
|---|---|
| ≤ youthThreshold | 1.5× |
| +1–2 years | 1.2× |
| +3–4 years | 1.0× |
| +5–6 years | 0.8× |
| +7+ years | 0.6× |

---

## Step 1 (continued): effectiveInterest and Pass Gate

After `computeStaticInterest`, three additive layers build `effectiveInterest`:

### Squad-Thin Floor
Added to `effectiveInterest` based on how many roster slots remain:

| Slots remaining | Set condition | Floor added |
|---|---|---|
| 15+ | any | slotsRemaining × 2.5 |
| 10–14 | set ≥ 8 | slotsRemaining × 2.0 |
| 5–9 | set ≥ 12 | slotsRemaining × 1.5 |
| Re-auction, squad at 18 | — | +40 extra |

### Preliminary Need Bleed (Change 1A)
A lightweight role-gap signal bleeds into `effectiveInterest` before the pass check, so teams with zero players of a role get a nudge even if static interest is low:

```
prelimNeed = (roleGap / totalRoleTarget) × 60
needBleed  = min(prelimNeed × 0.15, 12)
effectiveInterest += needBleed
```

### Interest Override (primary signal)
**`interestedTeams` is the ground truth of real auction behaviour.** If a franchise is listed in the player's `interestedTeams`:

```
effectiveInterest += 50
```

This guarantees room entry past any `passThreshold` (max possible threshold is ~51 with full squad + calculated style). Squad/purse limits still apply.

**Opportunity bid (non-interested teams):** If the current bid is below 50% of `boughtPrice`, any non-interested team gets `+16` to `effectiveInterest` — they recognise the bargain.

### Pass Threshold
`effectiveInterest` is compared against a dynamic threshold driven by **squad fill %** (primary axis) and set index (secondary):

| Squad fill % | Base threshold |
|---|---|
| < 40% | 25 (thin squad — bid frequently) |
| 40–60% | 32 |
| 60–80% | 38 |
| ≥ 80% | 46 (nearly full — very selective) |

**Late urgency adjustments** (reduce threshold):
- Set ≥ 20 AND fill < 60%: **−5**
- Set ≥ 15 AND fill < 50%: **−3**

**Auction style adjustments** (added to threshold):
- calculated: +5
- analytical: +4
- moneyball: +3
- aggressive: −5
- emotional: −3

**Purse velocity fatigue (Change 8A):** If a team spent more than 1.8× their expected pace over the last 5 purchases, `passThreshold += 8`. Combined fatigue from all sources is capped at **+15**.

**Plan disruption delta (Change 10C):** If the team lost a Tier 1 `interestedTeams` target, `passThreshold −= 5` for the next 3 players.

### Role Crisis Emergency Entry (Change 1B)
If a team has **zero players of the player's role** AND it's past **set 15**, they enter the room even if `effectiveInterest < passThreshold`. Their `maxBid` is hard-capped at `basePrice × 1.5` so they enter but don't overpay.

---

## Step 2: Rule Engine Hard Gate (`validateBid`)

Pure stateless validation. Any failure → immediate PASS. Checks:
1. Phase must be `'bidding'`
2. Team has not already passed this round
3. Team is not already the leading bidder (unless RTM pending)
4. Bid amount ≥ current bid + minimum increment
5. Team has sufficient purse
6. Bidding this amount won't take purse below `getMinReservedPurse` (slotsNeeded × ₹0.20)
7. Squad has room (< 25 players)
8. If player is overseas: team has an available overseas slot

---

## Step 3: Safe Bid Limit (`getSafeBidLimit`)

Calculates the maximum a team can safely bid right now without starving future picks.

**Formula:** `safeBidLimit = effectivePurse − totalReserved`

`effectivePurse` accounts for the reservation P&L balance (Change 10B):
```
balanceEffect  = clamp(reservationBalance, -(purse × 0.20), +(purse × 0.15))
effectivePurse = currentPurse + balanceEffect − pendingReservation
```

`totalReserved` = max of:

| Reserve type | Value |
|---|---|
| Minimum squad reserve | slotsNeeded × ₹0.20 |
| Marquee set reserve | ₹22 Cr (only in marquee sets) |
| Early squad reserve | ₹5–12 Cr (scales with squad size: <10=₹5, <14=₹8, <18=₹12) |
| Stage reserve | ₹35 (sets 0–2), ₹20 (sets 3–9), ₹10 (sets 10–15), ₹6 (sets 16–19), ₹0 (sets 20+) |

When `criticallyThin` (need 12+ more players): marquee and early-squad reserves are zeroed — only stage reserve remains.

### Pending Reservation (Change 10A)
Before computing `safeBidLimit`, the engine identifies the team's top-2 `interestedTeams` targets in **future sets** (not yet sold):

```
for each top-2 future target:
  reserveCost = (boughtPrice ?? marketValue ?? basePrice × 2) × 0.85
pendingReservation = min(sum of reserveCosts, currentPurse × 0.35)
```

This is subtracted from `effectivePurse` so teams conserve purse for their planned targets. Capped at 35% of remaining purse to prevent paralysis.

**Re-auction special case:**  
During re-auction, all stage reserves are bypassed. Per-slot reserve is:
- ₹0.15 per slot if team has < 20 players AND purse/slot > ₹3
- ₹0.20 per slot otherwise

---

## Step 4: Need Score (`computeNeedScore`)

**Output:** 0–100 score representing how much the team structurally needs this player.

### Tier-Gap Calculation (3-tier system)
Each franchise has `squadTierTargets` defining how many prime/reliable/depth players they want per role. The need score is driven by the gap between target and current count:

- **WK (strict):** prime gap → 85, reliable gap → 55, depth gap → 35; saturated → 15/20/10
- **All others:** `20 + tierGapRatio × 70` (saturated=20, empty tier=90)

**AR duality:** ARs count toward:
- BAT need at 0.5× weight
- BWL need at 0.6× weight

### Dynamic Urgency from Auction Log
If the team recently passed on the same role (found in last 8 log entries), need is boosted by **×1.18** when the tier gap is active.

### Batting Position Need
For BAT, WK, and AR players with a known batting position (opener/middleOrder/finisher), checks how many of that position the team already has vs targets (3 openers, 4 middle-order, 3 finishers). Each gap adds **×(1 + gap × 0.08)** to need.

### AR Bowling Redundancy
If a team already has 3+ ARs and more than 60% of them bowl the same type as the current player, need is reduced: **×0.75**

### Squad Phase Modifier (6-tier system)
The engine classifies each player on a 6-tier scale and adjusts need based on the team's current squad-building phase:

**Player Tier 6 Classification:**

| Tier | Label | Criteria (capped) | Criteria (uncapped) |
|---|---|---|---|
| 1 | Marquee / Superstar | MV ≥ ₹14 Cr or base ≥ ₹3 Cr | — |
| 2 | Established First XI | MV ≥ ₹5 Cr or base ≥ ₹1.5 Cr | — |
| 3 | Emerging Star | — | prospectTier=elite or pot ≥ 8 |
| 4 | Role Specialist | MV ≥ ₹1.5 Cr or base ≥ ₹0.5 Cr | pot ≥ 6 or prospectTier=promising |
| 5 | Domestic Backup | base ≥ ₹0.2 Cr | pot ≥ 3 or base ≥ ₹0.3 Cr |
| 6 | Budget Filler | below Tier 5 | below Tier 5 |

**Squad Phase:** Each franchise has an `xiQualityThreshold` (number of Tier 1–3 players needed before switching phases):
- **xi_building:** Tier 1–3 players needed → Tier 5–6 players get **×0.55** need
- **backup_filling:** Tier 1–3 players depressed **×0.70**; Tier 5–6 boosted **×1.20**; uncapped players get additional **×1.15**

### Fill Ratio Urgency
As the squad fills, urgency scales up: `needScore × (1 + fillRatio × 0.25)` where fillRatio = squadSize / 25.

### Overseas Scarcity
If only 1 overseas slot remains: **×1.15** need for overseas players.

### Tight Purse Penalty
- Purse < ₹15 Cr: **×0.85**
- Purse < ₹8 Cr: **×0.70**

### Late-Auction Desperation
From set 12 onwards (or during re-auction), if squad < 23 players:  
`needScore × (1.0 + (23 - squadSize) × 0.07)`

---

## Step 5: Emotion Score (`computeEmotionScore`)

**Output:** 0–100 score capturing emotional and momentum factors.

**Baseline:** 40 (neutral)

### Plan Disruption Boost (Change 10C)
If the team lost a Tier 1 `interestedTeams` target to another franchise: **+15** for the next 3 players. They make a statement to compensate.

### Loyalty Bonuses
- Former player (`player.previousTeam === teamId`): **+25**
- RTM eligible (`player.rtmEligibleFor === teamId`): **+20**

### Franchise Interest Emotion
If team is in `player.interestedTeams`:

| Player quality | Emotion bonus |
|---|---|
| Elite (elite / pot≥8 / MV≥₹10) | +18 |
| Promising (pot≥6 / MV≥₹4) | +10 |
| Fringe | +4 |

### Auction Style Multipliers

| Style | Emotion multiplier |
|---|---|
| emotional | ×1.25 |
| aggressive | ×1.15 |
| calculated | ×0.90 |
| analytical | ×0.85 |
| moneyball | ×0.80 |

### Momentum Adjustment (`computeMomentumAdjustment`)
Looks at the last 6 auction log entries:

| Event | Score |
|---|---|
| Team just spent ≥ ₹10 Cr | −8 (cautious after big spend) |
| Team won 2 recent lots | +6 (confidence momentum) |
| Team outbid 2+ times on same role | +10 (frustrated aggression) |

Style amplifiers on momentum:
- emotional: ×1.4
- aggressive: ×1.2
- analytical: ×0.6
- moneyball: ×0.4

Momentum capped at **−15 to +20**.

---

## Step 6: Score Blending (`blendScores`)

The three scores are blended into a single `blendedScore` (0–100):

**Phase 1 (no LLM):**
```
blendedScore = staticInterest × 0.40 + needScore × 0.35 + emotionScore × 0.25
```

**Phase 2 (with LLM):**
```
blendedScore = staticInterest × 0.20 + llmInterest × 0.45 + needScore × 0.20 + emotionScore × 0.15
```

---

## Step 6: Max Bid Calculation (`computeMaxBid`)

Determines the highest price a team will pay. The primary mechanism is the **boughtPrice bid anchor** for interested teams — all other paths are fallbacks.

### Absolute Hard Cap
**₹28 Cr** — enforced after all multipliers. The real IPL record is Rishabh Pant at ₹27 Cr.

### LLM Path (Phase 2)
If `llmResult.personalCeiling > 0`, that ceiling is authoritative (with ±5% variance).

### Marquee Cooling Window (Change 8B)
Applied **first**, before any other ceiling calculation. After a team buys a player for **₹12 Cr or more**, their next 2 squad additions are capped conservatively:

```
cooledCap = max(basePrice × 1.5, boughtPrice × 0.80)   // floor: ₹4 Cr if no boughtPrice
maxBid    = min(cooledCap, safeBidLimit, ₹28 Cr)
```

This prevents a team from immediately blowing another ₹15 Cr after a marquee purchase, while ensuring the market for the next player doesn't completely die (floor at 80% of historical price or ₹4 Cr).

### boughtPrice Bid Anchor (primary mechanism for interested teams)
**This is the dominant pricing signal for any player with real auction data.**

When a player has `boughtPrice > ₹3 Cr` and the team is in `interestedTeams`:

```
targetBid = boughtPrice × random(0.80, 1.20)
maxBid    = min(targetBid, safeBidLimit, ₹28 Cr)
```

Each interested team independently samples their walk-away price from the ±20% range around the historical sold price. The `desireFraction × multiplier` reductions are **bypassed** — this is the bid target directly, not a ceiling.

**What this produces:** If Chahal sold for ₹18 Cr in real IPL 2025, and RCB, CSK, GT are his interested teams, they independently draw walk-away prices like ₹16.2 Cr, ₹19.8 Cr, ₹17.5 Cr. The auction runs as a natural bidding war until all but the highest-drawing team drops out. The sold price will settle somewhere in the ₹16–20 Cr range — realistic without being deterministic.

**Non-interested teams:** Get a snipe floor of `boughtPrice × 0.55` added to their `realisticCap`. They won't let a ₹18 Cr player go for ₹3 Cr without entering, but they won't chase the price.

### Market Value Path (secondary)
When the player has a known `marketValue > basePrice × 1.2` **and** is NOT an interested team with boughtPrice:

```
maxBid = marketValue × (blendedScore / 100) × maxBidMultiplier × randomVariance(0.90–1.10)
```

**Star floor** (prevents lowball offers on stars): when capped, MV ≥ ₹5 Cr, blendedScore ≥ 35:
```
starFloor = marketValue × 0.40 × (0.7 + maxBidMultiplier × 0.2)
maxBid = max(maxBid, min(starFloor, safeBidLimit))
```

**Scarcity inflation** (crowded bidding rooms push ceilings higher):

| Player tier | Bidders | Scarcity multiplier |
|---|---|---|
| Truly marquee (MV ≥ ₹18 Cr) | ≥ 5 | ×1.30 |
| Truly marquee | ≥ 3 | ×1.15 |
| Marquee (MV ≥ ₹14 Cr) | ≥ 5 | ×1.18 |
| Marquee | ≥ 3 | ×1.10 |
| Prime (MV ≥ ₹8 Cr) | ≥ 5 | ×1.10 |
| Prime | ≥ 3 | ×1.05 |

Scarcity is scaled by `boughtPrice / basePrice` ratio (high historical ratio = proven bidding war gets full inflation; low ratio gets 0.60×). Scarcity is tapered when blendedScore > 72.

**boughtPrice ceiling on marketValue path:** `maxBid = min(maxBid, boughtPrice × 1.20)` (1.25× if plan-disrupted).

**Target-saving (Change 10D):** If the team has a pending Tier 1 target in a future set and this player is NOT that target: `maxBid × 0.92`.

### Formula Fallback Path (no market value, not an interested team with boughtPrice)
Used for uncapped players and low-profile capped players:

| Base price range | Ceiling formula |
|---|---|
| < ₹1 Cr | min(base × 8, ₹6 Cr) |
| ₹1–2 Cr | min(base × 6, ₹10 Cr) |
| ₹2–5 Cr | min(base × 4, ₹14 Cr) |
| ₹5–10 Cr | min(base × 2.5, ₹18 Cr) |
| ≥ ₹10 Cr | min(base × 1.8, ₹24 Cr) |

**Uncapped potential override:**

| Potential | Ceiling override |
|---|---|
| 9 | ₹18 Cr |
| 8 | ₹12 Cr |
| 7 | ₹7 Cr |
| 6 | ₹4 Cr |
| 4–5 | ₹2 Cr |

Ceiling = `max(formula ceiling, potentialCeiling × potentialWeight)`

**Interest ceiling stretch** (formula path, for players WITHOUT a boughtPrice anchor):

| Player quality | Multiplier |
|---|---|
| Elite (elite / pot ≥ 8) | ×1.30 |
| Promising (pot ≥ 6) | ×1.10 |
| Fringe | ×1.00 |

**Target-saving (Change 10D):** `realisticCap × 0.92` when pending Tier 1 target exists and this is not that target.

### Per-Tier Bid Multiplier (Squad Template)
Each franchise has `tierBidMultipliers` — one multiplier per tier 1–6 — applied to the formula fallback ceiling:

Example — MI:
```
{ 1: 1.25, 2: 1.15, 3: 1.30, 4: 0.90, 5: 0.85, 6: 0.70 }
```
MI bids aggressively on Tier 1 stars (×1.25) and emerging uncapped (×1.30), conservatively on fillers (×0.70).

### Purse Budget Guard (Change 7)
Checks whether the team has over-spent their tier allocation. `startingPurse` is dynamic (from `dataset.startingPurse[teamId]` after retentions, defaulting to ₹120 Cr):

| Condition | Ceiling reduction |
|---|---|
| Tier 1–2 player AND star spend > 110% of starBudget | ×0.75 |
| Tier 3–4 player AND emerging spend > 110% of emergingBudget | ×0.85 |

### Stage-Gated Rich-Team Headroom (Change 9)
Applied after all other formula-path multipliers. A team with large remaining purse only gets a headroom bonus once they've meaningfully spent AND built their squad — prevents early-auction windfall bids.

```
headroomRatio  = currentPurse / startingPurse
squadFillRatio = squadSize / maxSquadSize

if headroomRatio > 0.70:
  headroomMult = 1.0   // still rich and early — no bonus

elif headroomRatio > 0.50 AND squadFillRatio > 0.40:
  headroomMult = 1.0 + (squadFillRatio - 0.40) × 0.10   // gentle, up to ~1.06

elif headroomRatio > 0.35 AND squadFillRatio > 0.55:
  headroomMult = 1.0 + (squadFillRatio - 0.55) × 0.15   // moderate, up to ~1.07

// Late-auction splash unlock: set 18+, >₹25 Cr left, squad < 20
if currentSetIndex ≥ 18 AND currentPurse > 25 AND squadSize < 20:
  headroomMult × 1.10
```

### Final Max Bid Formula (non-anchor path)
```
maxBid = realisticCap × (blendedScore / 100) × min(maxBidMultiplier, 1.4) × randomVariance(0.85–1.10)
maxBid = min(maxBid, safeBidLimit, ₹28 Cr)
```

---

## Step 6: Emotional Multiplier (applied to maxBid in pipeline)

After `computeMaxBid`, an emotional multiplier is applied in `runBiddingPipeline`:

| Condition | Multiplier |
|---|---|
| Former player, MV ≥ ₹18 Cr (truly marquee) | ×1.25 |
| Former player, not truly marquee | ×1.15 |
| Not former player, but MV ≥ ₹18 Cr | ×1.08 |
| Everyone else | ×1.00 |

This simulates franchises paying a premium to reclaim identity players (e.g. MI bidding extra for a Rohit-era favourite).

**Note:** For interested teams with a boughtPrice anchor, this multiplier applies on top of `targetBid`. The ₹28 Cr hard cap prevents it from exceeding reality.

---

## Step 7: Bid or Pass

Simple comparison: if `nextBid > maxBid` → PASS, else BID.

**Jump bid (Phase 2 LLM):** If LLM provides a `jumpBid` above the minimum increment but within `maxBid`, the team bids the jump amount to signal dominance.

---

## Forward Planning: Reservation System with P&L (Change 10)

### Reservation Balance (`TeamState.reservationBalance`)
Tracks a running profit/loss against each team's target-player plan:

| Outcome | Balance update |
|---|---|
| Team wins target at price P (reserved at R) | +R − P (positive = underspent, negative = overspent) |
| Team loses target to another franchise | +R (full release) |
| Target goes unsold | +R × 0.50 (partial release — may return in reauction) |

The balance feeds into `getSafeBidLimit`:
- Deficit (overpaid for a target) tightens the limit by up to 20% of purse
- Surplus (underpaid or release) loosens it by up to 15% of purse

### Plan Disruption (`TeamState.planDisruptedCountdown`)
When a Tier 1 `interestedTeams` target is won by **another** franchise, the losing team enters a disruption window lasting **3 players**:
- Emotion score: **+15** ("making a statement")
- Pass threshold: **−5** (enters rooms they'd normally skip)
- Released reservation redirects to next highest pending target (if any)

Countdown decrements via `advanceToNextPlayer` in `gameStore`.

---

## `runAllOpponentDecisions`

Runs the pipeline for all eligible opponents (excludes user's team, teams that already passed, teams currently leading). Returns decisions in **randomised order** to simulate realistic bid sequencing.

### Pre-Computation Optimisations
Performs two expensive lookups **once** before iterating teams, rather than per-team per-bid:

1. **`soldPlayerIds`** — Set of all sold player IDs (for pending reservation filtering)
2. **`pendingTier1Cache`** — Map of `teamId → boolean` for `hasPendingTier1Target`. Built by iterating all players once per bid round instead of O(players × teams) per round.

---

## LLM Integration (Phase 2)

The `LLMPersonaResult` interface slots into the pipeline without breaking Phase 1:

```ts
interface LLMPersonaResult {
  interestLevel: number       // 0–100, replaces static interest in blend
  personalCeiling: number     // authoritative max bid
  jumpBid: number | null      // bid above minimum increment to signal dominance
  emotionalTriggers: string[] // for logging
  ownerComment: string        // shown in UI
}
```

`buildLLMContext()` generates the structured prompt: squad snapshot, role counts, purse, current bid, player profile. The LLM responds with JSON that is validated and injected.

Models used via OpenRouter:
- `meta-llama/llama-3.3-70b-instruct`
- `google/gemini-2.0-flash-exp:free`

---

## Franchise Personas

Each of the 10 franchises has a `FranchisePersona` config that shapes all of the above:

| Field | Effect |
|---|---|
| `auctionStyle` | Affects passThreshold, emotion multiplier, momentum amplifiers |
| `roleWeights` | Multiplier on static interest per role |
| `prefersCapped / prefersIndian` | Small +4–5 bonuses on matching players |
| `overseasCaution` | Reduces overseas player interest |
| `loyaltyBonus` | Scales former-player loyalty bonus |
| `maxBidMultiplier` | Scales max bid ceiling (non-anchor path) |
| `potentialWeight` | Weight on uncapped player potential scoring |
| `youthThreshold` | Age below which full youth bonus applies |
| `squadTierTargets` | Target prime/reliable/depth counts per role |
| `battingPositionAffinity` | Multiplier per batting position |
| `arArchetypeAffinity` | Multiplier per AR archetype |
| `bowlingAffinity` | Multiplier for pace vs spin bowlers |
| `playerTypeAffinity.stars` | Multiplier for marquee capped stars |
| `playerTypeAffinity.youth` | Multiplier for high-potential uncapped |
| `playerTypeAffinity.value` | Multiplier for value picks (MV/base ≥ 3) |
| `captaincyWeight` | Scales captaincy premium bonus |
| `squadTemplate.xiQualityThreshold` | Tier 1–3 count needed to switch to backup-filling mode |
| `squadTemplate.tierBidMultipliers` | Per-tier bid ceiling multipliers (×0.70 to ×1.35) |
| `squadTemplate.tierPurseShare` | Fraction of starting purse allocated to stars / emerging / depth |
| `squadTemplate.roleComposition` | Minimum role counts for a balanced squad |

### Squad Templates by Team

| Team | Style | xiQualityThreshold | Star spend share | Emerging share | Depth share |
|---|---|---|---|---|---|
| MI | Aggressive, star-heavy | 10 | 58% | 28% | 14% |
| CSK | Calculated, experience | 9 | 55% | 25% | 20% |
| RCB | Emotional, batting-first | 9 | 65% | 22% | 13% |
| KKR | Analytical, AR/spin | 8 | 48% | 32% | 20% |
| RR | Moneyball, value | 7 | 40% | 38% | 22% |
| SRH | Aggressive, power/pace | 10 | 62% | 24% | 14% |
| DC | Calculated, balanced | 8 | 50% | 30% | 20% |
| PBKS | Aggressive, high-risk | 9 | 60% | 27% | 13% |
| GT | Analytical, role-specific | 8 | 45% | 35% | 20% |
| LSG | Calculated, flexible | 8 | 50% | 30% | 20% |

---

## Rule Engine

Separate stateless module (`ruleEngine.ts`) that handles all hard validation.

### `validateBid`
Checks every incoming bid for legality. Returns `{ valid: boolean, reason: string }`.

Checks (in order): phase, team exists, not already passed, not already leading, minimum bid amount, sufficient purse, purse reserve floor, squad not full, overseas slot.

### `validateRTM`
Validates an RTM exercise: RTM must be available in this auction year, team has RTM slots, phase is `rtm-decision`, player is RTM eligible for this team, team can afford the RTM price, squad not full, overseas slot if applicable.

### `validateSaleConfirmation`
Final check before recording a sale: team can afford the price, squad not full, overseas slot.

### `validateRetention`
Pre-auction retention validation: retention allowed, ≤ max retained players, ≤ max overseas retained, all players exist in dataset, no negative retention prices, total cost within starting purse.

### `validateTrade`
Trade window validation: both teams exist, phase is `trade-window`, each team owns the players they're offering, squads stay within 0–25 after trade, overseas counts don't exceed limit after trade, cash amounts are affordable.

### `getSafeBidLimit`
See Step 3 above. Also used to prevent user overbidding in the UI.

### `getMinReservedPurse`
`slotsNeeded × ₹0.20` — the absolute minimum reserve, always enforced.

---

## Player Data Fields Used by the Engine

| Field | Used for |
|---|---|
| `playerId` | Affinity seeding, target lookup |
| `name` | Log display |
| `role` | Role saturation, need gap |
| `basePrice` | Tier baseline, bid increments, formula fallback |
| `marketValue` | Max bid path (secondary), star appeal, tier classification |
| `boughtPrice` | **Primary bid anchor** for interested teams (±20% walk-away), snipe floor for others, marquee cooling floor |
| `cappedStatus` | Interest bonuses, tier classification |
| `isOverseas` | Overseas slot conservation |
| `potential` | Uncapped scoring, tier6 classification |
| `prospectTier` | Uncapped potential bonuses |
| `age` | Youth bonus scaling |
| `previousTeam` | Loyalty bonus |
| `rtmEligibleFor` | RTM emotion boost |
| `interestedTeams` | **Primary entry signal** (+50 override), emotion, bid anchor path |
| `auctionSet` | Batting position inference, pending reservation filtering |

---

## Key Constants

| Constant | Value | Purpose |
|---|---|---|
| `AUCTION_HARD_CAP` | ₹28 Cr | Maximum any team can bid |
| `REAUCTION_MIN_SQUAD` | 19 players | Force-bid trigger in re-auction |
| `MIN_BASE_PRICE` | ₹0.20 Cr | Per-slot reserve calculation |
| Starting purse | Dynamic per team | From `dataset.startingPurse[teamId]` after retentions; defaults to ₹120 Cr |
| boughtPrice anchor range | ±20% | Walk-away price = `boughtPrice × random(0.80, 1.20)` |
| Marquee cooling trigger | ₹12 Cr purchase | Caps next 2 bids, floor at `boughtPrice × 0.80` or ₹4 Cr |
| Pending reservation cap | 35% of purse | Max reservation deducted from safe bid limit |
| Velocity fatigue trigger | 1.8× expected pace | `passThreshold += 8` for 5 recent purchases |
| Combined fatigue cap | +15 | Max total passThreshold increase from all fatigue sources |
| Role minimums (re-auction) | BAT:4, BWL:4, AR:2, WK:1 | Force-bid eligibility |
| Re-auction base price | 50% of original | Applied in `startReauction()` |
