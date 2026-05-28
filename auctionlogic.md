# GPL Auction Simulator — Bidding Logic & Engine Rules

This document describes how the auction engine works end-to-end: how AI franchise owners decide to bid, what limits them, how the auction state machine progresses, and how all the tuning knobs interact.

---

## Table of Contents

1. [Auction Structure](#1-auction-structure)
2. [State Machine — Phase Flow](#2-state-machine--phase-flow)
3. [The 7-Step AI Bidding Pipeline](#3-the-7-step-ai-bidding-pipeline)
4. [Step 1 — Static Interest Score](#4-step-1--static-interest-score)
5. [Step 2 — Rule Engine Validation](#5-step-2--rule-engine-validation)
6. [Step 3 — Safe Bid Limit (Purse Pacing)](#6-step-3--safe-bid-limit-purse-pacing)
7. [Step 4 — Need Score](#7-step-4--need-score)
8. [Step 5 — Emotion Score & Momentum](#8-step-5--emotion-score--momentum)
9. [Step 6 — Max Bid Calculation](#9-step-6--max-bid-calculation)
10. [Step 7 — Final Decision (Bid or Pass)](#10-step-7--final-decision-bid-or-pass)
11. [RTM (Right To Match)](#11-rtm-right-to-match)
12. [Franchise Personas](#12-franchise-personas)
13. [Auction Pacing — Purse & Squad Floors](#13-auction-pacing--purse--squad-floors)
14. [Session Unpredictability](#14-session-unpredictability)
15. [Simulation Mode](#15-simulation-mode)
16. [Key Constants Quick Reference](#16-key-constants-quick-reference)

---

## 1. Auction Structure

The auction runs in numbered **sets**. Each set is a named batch of players (e.g. "Marquee 1", "Fast Bowlers Set 1", "Uncapped Players Set 2"). Sets are defined in `ipl2025.json → auctionSets[]`.

### Typical Set Order (IPL 2025 dataset)

| Sets | Content | Set Index (0-based) |
|---|---|---|
| Marquee 1–2 | Elite stars (₹2 Cr+ base), 12 players each | 0–1 |
| Batter, Fast, Spin, AR, WK sets | Role-specific groups, multiple sets each | 2–15 |
| Uncapped sets | Indian uncapped players, ₹0.2–₹0.5 Cr base | 16–19 |
| Accelerated round | User nominates ≤5 players + AI nominates rest → pool re-auctioned at 50% base price | 20–21 |
| Re-auction | Unsold players re-listed at 50% base price | Final |

Within each set, players are **shuffled randomly** at set-start and the order is stored in `gameState.setPlayerOrder`. This means the same player can appear at different positions in different playthroughs.

---

## 2. State Machine — Phase Flow

The game advances through these phases:

```
set-preview → bidding → [sale-confirmed | unsold-confirmed] → [rtm-decision] → set-complete → ...
                                                                              → auction-complete
```

| Phase | What happens |
|---|---|
| `set-preview` | The next player in the set is loaded. `startPlayerAuction()` is called. |
| `bidding` | All teams can bid or pass. Runs until all teams except the leader have passed. |
| `sale-confirmed` | A team won the bid. Player moves to their squad, purse deducted. |
| `unsold-confirmed` | All teams passed (or only 1 bid = base price, then all others passed). Player goes to re-auction pool. |
| `rtm-decision` | The player's former team has a Right To Match opportunity. |
| `set-complete` | All players in the set are processed. |
| `auction-complete` | All sets done. Results screen. |

`advanceAuction()` in `auctionController.ts` drives transitions between phases.

---

## 3. The 7-Step AI Bidding Pipeline

Every time an AI team's turn comes during bidding, `runBiddingPipeline()` is called. It runs synchronously and returns either `{ action: 'bid', bidAmount }` or `{ action: 'pass' }`.

```
runBiddingPipeline(gameState, dataset, teamId, currentPlayer, llmResult?)
```

The pipeline has 7 steps in order. Any step can short-circuit with a `pass`.

```
Step 1: Static Interest     → Does this franchise even want this type of player?
Step 2: Rule Validation     → Is the bid legally allowed?
Step 3: Safe Bid Limit      → Does the team have enough purse headroom?
Step 4: Need Score          → How urgently does the team need this player RIGHT NOW?
Step 5: Emotion / Momentum  → Are they in a hot streak? Just lost a target? In rivalry?
Step 6: Max Bid             → What is the absolute ceiling they'd pay?
Step 7: Final Decision      → Bid the minimum valid amount, or pass?
```

**File:** `src/engine/biddingEngine.ts` → `runBiddingPipeline()`

---

## 4. Step 1 — Static Interest Score

**Function:** `computeStaticInterest(persona, teamState, player, dataset, currentSetIndex, bidState)`

This is the most important gate. If `staticInterest < passThreshold`, the team immediately passes without evaluating any other step.

### Base Score Calculation

```
base = 30 + tierBonus         (tierBonus: 0–25, log-scaled from basePrice)
     + 10 if capped international
     + 8  if basePrice ≥ ₹10 Cr (elite marquee)
     + 4  if basePrice ≥ ₹4 Cr
     × roleWeight             (persona-specific, e.g. MI gives BWL × 1.25)
```

### Role Saturation

If the team already has many players of the same role, interest is heavily reduced:

| Role count in squad | Multiplier (non-WK) | WK multiplier |
|---|---|---|
| 0–2 | 1.00 | 1.00 (0), 0.50 (1) |
| 3–4 | 0.72 | 0.08 (2+) |
| 5–6 | 0.42 | — |
| 7–8 | 0.28 | — |
| 9+  | 0.18 | — |

**Late-auction saturation relief** is applied on top — teams that are thin on players stop caring about role balance:

| Condition | Relief added |
|---|---|
| Set ≥ 20 | +0.35 |
| Set ≥ 15 | +0.20 |
| Set ≥ 10 | +0.10 |
| Slots short ≥ 15 | +0.55 |
| Slots short ≥ 10 | +0.40 |
| Slots short ≥ 5  | +0.20 |

### Post-Saturation Bonuses (immune to saturation)

| Bonus | Amount |
|---|---|
| Franchise target player (`FRANCHISE_TARGETS`) | +22 |
| Former team player (loyalty bonus) | `loyaltyBonus × 40` |
| Rivalry escalation (3+ active bidders) | +8 |
| Rivalry escalation (5+ active bidders) | +8 more |
| Rivalry escalation (7+ active bidders) | +6 more |
| Capped player, persona prefersCapped | +5 |
| Uncapped player, persona !prefersCapped | +3 |
| Indian player, persona prefersIndian | +4 |
| Star appeal (capped, MV ≥ ₹15 Cr) | +20 |
| Star appeal (capped, MV ≥ ₹8 Cr)  | +14 |
| Star appeal (capped, MV ≥ ₹5 Cr)  | +9 |
| Star appeal (capped, MV ≥ ₹2 Cr)  | +5 |
| Uncapped prospect (MV ≥ ₹8 Cr) | +10 |
| Captaincy candidate (no captain yet) | up to +20 |

### Session Affinity

Each franchise gets a random but stable per-player affinity seeded on `SESSION_SALT + teamId + playerId`. This is a value from −9 to +12. The salt changes every app launch, so the same player generates different interest across different playthroughs.

### Stage Squad-Size Ceiling (over-acquisition penalty)

If a team already exceeds the expected squad size for the current auction stage, they lose interest in adding more:

| Stage | Max squad before penalty | Penalty |
|---|---|---|
| Marquee (set 0–2) | 7 players | −8 per extra player (max −32) |
| Role sets (set 3–9) | 12 players | −8 per extra player (max −32) |
| Mid sets (set 10–15) | 18 players | −8 per extra player (max −32) |
| Late (set 16+) | 25 (no penalty) | — |

### Uncapped Quota Nudge (set 16+)

To encourage teams to fill uncapped slots in the uncapped sets:

| Uncapped players in squad | Bonus |
|---|---|
| < 2 | +12 |
| < 5 | +10 |
| < 8 | +8 |
| < 11 | +8 |

### Pass Threshold

The threshold below which the team passes immediately:

| Condition | Threshold |
|---|---|
| Set ≥ 25 (very late) | 22 |
| Set ≥ 20 | 28 |
| Set ≥ 15 | 33 |
| Default | 40 |
| Team needs 15+ more players | −12 adjustment |

### Thin-Squad Floor

Teams that need many more players get a floor bonus added to static interest so they never completely ignore affordable players:

| Slots remaining | Extra bonus |
|---|---|
| ≥ 15 | +37 |
| ≥ 10 (set ≥ 8) | +20 |
| ≥ 5 (set ≥ 12) | +15 |

---

## 5. Step 2 — Rule Engine Validation

**Function:** `validateBid()` in `src/engine/ruleEngine.ts`

Hard rules — these cannot be overridden by any score or multiplier:

| Rule | Reason |
|---|---|
| Phase must be `bidding` | Can't bid outside bidding phase |
| Team must not have already passed | Once passed, you're out |
| Team must not already be the leader (unless RTM) | No self-outbidding |
| Bid ≥ current bid + increment | Minimum raise enforced |
| Team purse ≥ bid amount | Can't bid money you don't have |
| Purse after bid ≥ min squad reserve | Must keep enough to complete minimum squad at ₹0.20 Cr/player |
| Squad size < maximum (25) | Can't exceed squad cap |
| Overseas slots available if player is overseas | Overseas limit (8) enforced |

**Bid increments** are based on current bid amount (from dataset `bidIncrements` config):
- ₹0–₹1 Cr → ₹0.05 Cr increments  
- ₹1–₹5 Cr → ₹0.10 Cr increments
- ₹5–₹15 Cr → ₹0.25 Cr increments
- ₹15 Cr+ → ₹0.50 Cr increments

---

## 6. Step 3 — Safe Bid Limit (Purse Pacing)

**Function:** `getSafeBidLimit()` in `src/engine/ruleEngine.ts`

This is a **soft ceiling** — it limits how much of the purse an AI team will use on a single player, not just whether they can afford it. It ensures teams don't exhaust their purse early and arrive at later sets with nothing.

The safe limit = `currentPurse − totalReserved`, where `totalReserved` is the maximum of:

| Reserve type | Amount |
|---|---|
| Min squad completion | `slotsNeeded × ₹0.20 Cr` |
| Marquee reserve (if set name contains "marquee") | ₹22 Cr |
| Early-squad reserve (squad < 10) | ₹5 Cr |
| Early-squad reserve (squad < 14) | ₹8 Cr |
| Early-squad reserve (squad < 18) | ₹12 Cr |
| **Stage reserve** (set 0–2, marquee) | **₹35 Cr** |
| **Stage reserve** (set 3–9, role sets) | **₹20 Cr** |
| **Stage reserve** (set 10–15, mid) | **₹10 Cr** |
| Stage reserve (set 16+) | ₹0 |

**Critically thin override:** If a team needs 12+ more players to reach maximum squad, the marquee and early-squad reserves are dropped to 0 so they can spend freely on cheap players.

If `safeBidLimit ≤ 0` or the next valid bid exceeds it, the team **passes**.

**Pipeline-level hard cap:** After all multipliers are applied, the final bid amount is also capped at `AUCTION_HARD_CAP = ₹28 Cr`. No player can be bid above ₹28 Cr regardless of any score.

---

## 7. Step 4 — Need Score

**Function:** `computeNeedScore(persona, teamState, player, dataset, auctionLog)`

Measures how urgently the team needs this specific player right now, on a 0–100 scale.

### Role Gap Scoring

For each role slot type (prime/reliable/depth), the team gets a gap score based on how far below target they are:

| Target type | Gap | Score |
|---|---|---|
| Prime slot needed | -3 | 85 |
| Prime slot needed | -2 | 72 |
| Prime slot needed | -1 | 60 |
| Reliable slot needed | gap × factor | ~40–55 |
| Depth slot needed | gap × factor | ~20–35 |
| Fully covered | 0 | 0 |

**Squad tier targets per role** (from `squadTierTargets`):
- BAT: 4 prime / 3 reliable / 3 depth
- BWL: 4 prime / 3 reliable / 3 depth
- AR: 2 prime / 2 reliable / 1 depth
- WK: 1 prime / 1 reliable / 0 depth

### Dynamic Pivot

If the team recently passed on a player of the same role (within the last 8 auction log entries), their need score gets a `×1.18` multiplier — they're recognising they missed out and won't make the same mistake again.

### Need Score → Bid Modifier

The blended score (weighted average of need score and emotion score) influences the final bid through `needMultiplier`:

| Blended score | Multiplier |
|---|---|
| ≥ 75 | 1.10 |
| ≥ 55 | 1.05 |
| ≥ 35 | 1.00 |
| < 35 | 0.95 |

---

## 8. Step 5 — Emotion Score & Momentum

**Function:** `computeEmotionScore()` + `computeMomentumAdjustment()`

Emotion score is a 0–100 score based on recent auction events for the team.

### Emotional Targets

| Condition | Score boost |
|---|---|
| Player is RTM-eligible for this team | 80 + (prev salary / 2) |
| Player previously played for this team | 60 |
| Neither | 0 |

### Momentum Adjustment

Applied to the base emotion score based on recent auction history:

| Event | Adjustment |
|---|---|
| Team just spent ≥ ₹8 Cr in last 3 picks | −8 (cooling off) |
| Team won last 2+ contested auctions | +6 (on a roll) |
| Team lost the same role twice in a row | +10 (frustrated, determined) |
| Target player style matches team's preferred style | +5 amplifier |

### Emotional Multiplier in Pipeline

In `runBiddingPipeline`, a final `emotionalMultiplier` is applied to max bid:

| Condition | Multiplier |
|---|---|
| Truly marquee player (MV ≥ ₹18 Cr) | ×1.10 |
| RTM-eligible player | ×1.15 to ×1.25 (scales with previous salary) |
| Previous team (non-RTM loyalty) | ×1.08 |

This multiplier is applied **after** `computeMaxBid` but **before** the `AUCTION_HARD_CAP = ₹28 Cr` clamp.

---

## 9. Step 6 — Max Bid Calculation

**Function:** `computeMaxBid(persona, teamState, player, blendedScore, dataset)`

Determines the absolute ceiling this team would pay for this player.

### Market Value Anchor

The ceiling starts at market value (`player.marketValue`) scaled by the need/emotion `blendedScore`:

```
base = marketValue × needMultiplier × scarcityMult
```

### Scarcity Multiplier

Fires when multiple teams are competing hard for the same scarce asset:

| Active bidder count | Multiplier |
|---|---|
| 1–2 | 1.00 |
| 3–4 | 1.10 |
| 5 | 1.18 |
| 6 | 1.20 |
| 7+ | 1.35 |

**Taper:** When `blendedScore > 72`, the urgency is already reflected in the need score, so scarcity is tapered to avoid double-counting:

```
taper = 1 − min((blendedScore − 72) / 28, 0.70)
effectiveScarcity = 1.0 + (scarcityMult − 1.0) × taper
```

### Tier-Based Ceiling

| Player tier | Ceiling |
|---|---|
| MV ≥ ₹18 Cr (elite marquee) | MV × 1.8, capped at ₹28 Cr |
| MV ≥ ₹14 Cr (high marquee) | MV × 1.6 |
| MV ≥ ₹8 Cr (strong capped) | MV × 1.4 |
| Others | MV × 1.2 |

### Uncapped Player Ceiling

Uncapped players are valued on potential rather than market value:

| Potential score | Max bid ceiling |
|---|---|
| ≥ 9 | ₹18 Cr |
| ≥ 8 | ₹12 Cr |
| ≥ 7 | ₹7 Cr |
| ≥ 6 | ₹4 Cr |
| < 6 | ₹2 Cr |

### Star Floor

No matter how low the blended score, elite players always attract a minimum bid:

```
starFloor = marketValue × 0.45   (at minimum 45% of market value)
maxBid = max(maxBid, starFloor)
```

### Internal First-Pass Cap

`computeMaxBid` internally applies `ABSOLUTE_CAP = 28` as a first guard. The pipeline then enforces `AUCTION_HARD_CAP = 28` again after the emotional multiplier — this double-clamp ensures ₹28 Cr is truly never exceeded.

---

## 10. Step 7 — Final Decision (Bid or Pass)

After computing `maxBid`, the pipeline determines the actual bid amount:

```
finalMaxBid = min(maxBid × emotionalMultiplier, safeBidLimit, AUCTION_HARD_CAP)
```

If `nextBid > finalMaxBid` → **pass**

Otherwise, the team **bids `nextBid`** (the minimum valid amount = current bid + increment). AI teams always bid the minimum increment — they never overbid beyond what's necessary to take the lead. The ceiling only matters for pass decisions.

**One exception:** When the LLM persona layer is active (live auction for non-user teams), the LLM result can override the pass/bid decision with a specific bid amount, subject to the same ceiling clamps.

---

## 11. RTM (Right To Match)

After a player is sold, `findRTMEligibleTeam()` checks if any team has a Right To Match:

- The player must have `rtmEligibleFor` set to a specific team in the dataset
- That team must have RTM slots remaining (`rtmSlotsAvailable > rtmSlotsUsed`)
- The team must be able to afford the current sale price

**For AI teams:** The RTM decision is automatic and instant. `runRTMDecision()` evaluates whether the team wants the player at the sale price, based on need score and remaining purse. The team exercises RTM if the blended score is high enough.

**For the user team:** The game pauses at `rtm-decision` phase. The user can exercise or decline RTM.

**During simulation:** User RTM is auto-declined so simulation never breaks.

RTM price = the current winning bid. If exercised, the original winning team does not get the player.

---

## 12. Franchise Personas

Each AI team has a `FranchisePersona` object that shapes every bidding decision.

**File:** `src/engine/personaConfig.ts`

Key persona fields:

| Field | Effect |
|---|---|
| `roleWeights` | Multiplier per role (BAT/BWL/AR/WK) applied to static interest base score |
| `bowlingAffinity` | `{ pace, spin }` — multiplier for bowler type preference |
| `battingPositionAffinity` | `{ opener, middleOrder, finisher }` — batter slot preference |
| `arArchetypeAffinity` | 6 keys for all-rounder archetype fit |
| `playerTypeAffinity` | `{ stars, youth, value }` — multipliers on marquee/uncapped/bargain picks |
| `prefersCapped` | Boolean — slight preference for capped/uncapped players |
| `prefersIndian` | Boolean — slight preference for Indian players |
| `overseasCaution` | Float 0–1 — how much the team avoids overseas players |
| `loyaltyBonus` | Float — how strongly the team bids for former players |
| `captaincyWeight` | Float — how much bonus captaincy candidates get |
| `potentialWeight` | Float — how much they weight uncapped player potential |
| `youthThreshold` | Age below which a player is considered "youth" |
| `riskTolerance` | Float — willingness to bid at the top of the ceiling |

### Example Team Archetypes

| Team | Strategy |
|---|---|
| **MI** | Bowling-first (BWL ×1.25), balanced, high loyalty bonus |
| **CSK** | Experience-focused, high captaincy weight, low youth weighting |
| **RCB** | Stars-first (×1.30), low value preference (×0.70), high risk tolerance |
| **GT** | Youth-first (×1.25), high potential weight, analytical |
| **RR** | Value-hunters (×1.30), low star preference, data-driven |
| **SRH** | Pace attack focus (pace ×1.30), opener premium |
| **KKR** | Balanced, franchise targets priority, moderate risk |
| **LSG** | Budget-conscious, depth-focused, overseas caution |

---

## 13. Auction Pacing — Purse & Squad Floors

Two mechanisms enforce realistic pacing:

### Hard Floor — Purse (ruleEngine.ts)

`getSafeBidLimit` ensures each team keeps a minimum purse in reserve based on which stage the auction is in:

| Auction stage | Set index | Purse reserved |
|---|---|---|
| Marquee | 0–2 | ₹35 Cr |
| Role sets | 3–9 | ₹20 Cr |
| Mid sets | 10–15 | ₹10 Cr |
| Uncapped / Accelerated | 16+ | Only squad completion reserve |

Target squad sizes after each stage:

| Stage | Squad target |
|---|---|
| After marquee (set 2) | 3–7 players |
| After role sets (set 9) | 7–12 players |
| After mid sets (set 15) | 13–18 players |
| After uncapped / accel | 18–25 players |

### Soft Ceiling — Squad (biddingEngine.ts)

If a team exceeds the stage's maximum squad target, static interest is penalised:

```
overQuota = squad.length − stageMaxSquad
scorePenalty = min(overQuota × 8, 32)
```

This is a soft signal — it reduces interest but doesn't block bidding on a player the team genuinely needs (e.g. a franchise target or WK when they have no WK).

---

## 14. Session Unpredictability

Two mechanisms make each auction playthrough unique:

### SESSION_SALT

```ts
const SESSION_SALT = Math.floor(Math.random() * 99991).toString()
```

Generated once per app launch. Used to seed per-team per-player affinity hashes so the same player generates different interest from different teams across different sessions. Range: −9 to +12 per (team, player) pair.

### Surprise Bidder / Cold Room

Based on a deterministic hash of `(SESSION_SALT + teamId + playerId + setIndex)`:

| Roll (0–99) | Event |
|---|---|
| 0–6 (7% chance) | **Surprise bidder**: +14 to static interest — unexpected enthusiasm |
| 92–99 (4% chance, squad not thin) | **Cold room**: −10 to static interest — team passes that round |

Cold room is suppressed when a team has < 10 squad slots left, preventing it from blocking squad completion.

---

## 15. Simulation Mode

### simulateOnePlayer()

When simulating (rather than live play):
- User team is auto-passed permanently for that player
- AI teams take turns randomly from the eligible pool
- `runBiddingPipeline()` is called with `llmResult = null` (formula-only, no LLM, no delays)
- The same rule engine, safe bid limit, and all scoring functions apply — simulation is not easier or harder than live

### simulateUntil()

The core loop that drives the state machine forward. Checks a `stopCondition()` after every player. Yields to React's event loop between players so progress indicators update.

**RTM handling in simulation:** User RTM opportunities are auto-declined. AI RTM is resolved synchronously as normal.

**Stop signal:** A `shouldStop` callback can be passed from the UI. The loop checks it after every player — tapping "Stop Simulation" sets the ref and the loop exits cleanly at the next player boundary.

### simulateRemainingSet / simulateOneSet / simulateRemainingAuction

Three public functions that wrap `simulateUntil` with different stop conditions:

| Function | Stops when |
|---|---|
| `simulateRemainingSet` | Current set reaches `set-complete` |
| `simulateOneSet` | The target set (currentSetIndex + 1) reaches `set-complete` |
| `simulateRemainingAuction` | Phase becomes `auction-complete` |

---

## 16. Key Constants Quick Reference

| Constant | Value | Location |
|---|---|---|
| `AUCTION_HARD_CAP` | ₹28 Cr | `biddingEngine.ts` |
| `ABSOLUTE_CAP` (internal) | ₹28 Cr | `computeMaxBid()` |
| Minimum squad size | Dataset-defined (18) | `ipl2025.json` |
| Maximum squad size | Dataset-defined (25) | `ipl2025.json` |
| Overseas limit | Dataset-defined (8) | `ipl2025.json` |
| Pass threshold (default) | 40 | `biddingEngine.ts` |
| Surprise bidder chance | 7% | `biddingEngine.ts` |
| Cold room chance | 4% | `biddingEngine.ts` |
| Fight-or-Fold timeout | 2000 ms | `personaLayer.ts` |
| SESSION_SALT range | 0–99990 | `biddingEngine.ts` |
| Star floor | 45% of market value | `computeMaxBid()` |
| Uncapped potential ceiling | ₹4–₹18 Cr | `computeMaxBid()` |
| Re-auction base price | 50% of original | `auctionController.ts` |
| Marquee set size | 12 players | `ipl2025.json` |
| Accelerated round min picks | 2 per eligible AI team | `auctionController.ts` |

---

## File Map

| File | Responsibility |
|---|---|
| `src/engine/biddingEngine.ts` | All AI decision logic: pipeline, interest, need, emotion, max bid |
| `src/engine/ruleEngine.ts` | Hard rule validation: bid legality, purse safety, squad limits |
| `src/engine/rtmEngine.ts` | RTM eligibility detection and AI RTM decisions |
| `src/controllers/auctionController.ts` | State machine transitions, simulation loops, user actions |
| `src/engine/personaConfig.ts` | Per-franchise persona definitions |
| `src/data/datasets/ipl2025.json` | Players, sets, base prices, purses, rules config |
| `src/dataset/datasetLoader.ts` | Dataset loading, bid increment lookup, set-to-player resolution |
| `src/data/arBowlingTypes.ts` | Bowling type (pace/spin) for all-rounders (230 entries) |
| `src/llm/personaLayer.ts` | LLM integration for live auction (non-simulation) commentary |
