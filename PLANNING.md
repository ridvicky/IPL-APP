# IPL Auction Simulator — PLANNING.md

> **Status:** Pre-implementation planning document. No code has been written.
> **Source:** Derived entirely from `appmaster.md`.
> **Authority:** Rule Engine is always the final authority. LLM is opponent-only.

---

## 1. Product Understanding

The IPL Auction Simulator is a single-player strategy game where the user owns and manages one IPL franchise through a realistic auction, optional trade window, and a high-level season simulation.

The product is not a generic sports manager. It is an immersive, rules-first IPL auction experience with:

- Strict enforcement of real IPL rules for each selected auction year
- Realistic AI opponent franchise owners with distinct personalities
- LLM-powered opponent reasoning (bidding, RTM, trades, reactions) — never user advice
- Dataset-driven player pools (no invented players, ever)
- Meaningful session continuity across long auction sessions
- A simple post-auction season simulation anchored in real-world player performance data

The app supports IPL auctions from 2018 onward. Each auction year has its own dataset, rules, purse values, retention rules, and RTM rules.

---

## 2. Core App Goals

| Priority | Goal |
|----------|------|
| 1 | Strict IPL rule enforcement via an isolated Rule Engine |
| 2 | Realistic franchise-specific AI opponent behaviour |
| 3 | LLM used only for opponent personality, reasoning, and reactions |
| 4 | Complete dataset integrity — no invented players |
| 5 | Full auction lifecycle: retention → trade → auction → season sim |
| 6 | Reliable session save/resume for long auctions |
| 7 | Factual user information display — zero AI advice to the user |
| 8 | Immersive auction room UI |
| 9 | Clean module separation: Rule Engine / Bidding Engine / LLM Personas / Session Manager / Season Simulator |

---

## 3. Main User Flows

### Flow A — New Auction Session

```
Home → Select Auction Year → Select Auction Type → Select Franchise
→ Select Retention Mode → Configure Retention (if Custom)
→ Trade Window (if enabled) → Auction Room
→ [Bid / Pass / RTM / View Squad / Save]
→ Auction Complete → Final Squad Review
→ Season Setup → Season Simulation → Season Results
```

### Flow B — Resume Session

```
Home → Saved Sessions → Select Session → Resume at exact state
```

### Flow C — Trade Window Only

```
(Before auction or between seasons)
Propose Trade → Opponent evaluates → Accept / Reject / Counteroffer
→ Rule Engine validates → Trade recorded → Squads and purse updated
```

### Flow D — RTM Decision

```
Player auction ends → RTM-eligible team prompted
→ Team reviews RTM score → Uses RTM or declines
→ Rule Engine validates → Squad and purse updated
```

---

## 4. Required Modules

| Module | Responsibility |
|--------|---------------|
| **Rule Engine** | Final authority for all game rules |
| **Dataset Loader** | Loads, validates, and serves auction datasets |
| **Session Manager** | Save, resume, export, import sessions |
| **Retention Engine** | Historical / custom / no-retention logic |
| **Bidding Engine** | Orchestrates opponent bid pipeline |
| **RTM Engine** | RTM eligibility, scoring, execution |
| **Trade Engine** | Trade proposal, evaluation, counteroffer, legality |
| **LLM Persona Layer** | Opponent personality, reasoning, reactions |
| **Franchise Persona Store** | Static per-franchise traits and configurations |
| **Auction Room Controller** | Auction set flow, player queue, state machine |
| **Season Simulator** | High-level season outcome computation |
| **UI Layer** | All screens and user interaction |
| **Notification/Reaction System** | Opponent comments, result displays |

---

## 5. Recommended App Architecture

### Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | React 18 + Vite 5 (PWA via `vite-plugin-pwa`) | Web-first SPA; PWA makes it installable on desktop and mobile browsers |
| **Language** | TypeScript (strict mode) | Strong typing critical for rule engine correctness |
| **State Management** | Zustand + persist middleware | Lightweight; persist middleware auto-syncs to IndexedDB |
| **Auth** | Supabase Auth | Email/password + Google OAuth; free tier; Capacitor-compatible |
| **Database** | Supabase PostgreSQL (JSONB sessions) | Cloud-saved sessions per user account; accessible on any device |
| **Local Cache** | IndexedDB via `idb` v8 | Instant local saves; offline play; Capacitor WebView-compatible |
| **LLM** | OpenRouter API (free + paid models) | Single API key; model flexibility; cost-effective; no vendor lock-in |
| **Data Format** | JSON datasets per auction year | Human-readable, easy to validate, user-provided |
| **Styling** | Tailwind CSS v3 | Rapid, consistent styling for information-dense auction UI |
| **Mobile (Phase 4)** | Capacitor v6 → Android APK | Wraps same Vite build; zero game logic changes needed |

### OpenRouter Model Assignment

| Task | Model | Reason |
|------|-------|--------|
| Opponent bid reasoning, trade evaluation | `meta-llama/llama-3.3-70b-instruct` (free or paid) | Best reasoning quality; structured JSON output |
| Short owner reaction comments | `google/gemma-2-9b-it:free` | Fast; low token cost; good for short text |
| Rate-limit fallback | `mistralai/mistral-7b-instruct:free` | Always available as backup |

User provides their own OpenRouter API key (free account at openrouter.ai). Key stored in Supabase user profile (encrypted) or app localStorage.

### Architectural Principles

1. **Rule Engine is a pure TypeScript module** — no UI, no LLM, no async dependencies.
2. **LLM calls are isolated to the Persona Layer** — no direct LLM calls from Rule Engine, Bidding Engine, or Session Manager.
3. **LLM is a bidding INPUT layer, not the decision layer** — LLM provides interest level, suggested max bid, and emotional reasoning; Bidding Engine and Rule Engine make the final decision.
4. **All state changes go through the Session Manager** — no module updates squad/purse directly.
5. **Dataset is read-only after load** — no runtime mutation of player data.
6. **Local-first save pattern** — Zustand persist writes to IndexedDB instantly; Supabase sync runs in background asynchronously.
7. **UI is a consumer only** — it never drives game logic decisions.
8. **The app is a pure client-side SPA** — no backend server required; all logic runs in-browser; Supabase and OpenRouter called directly via fetch.

### Module Dependency Graph

```
Dataset Loader
    └─► Auction Room Controller
            ├─► Rule Engine  (pure, sync — final authority)
            ├─► Bidding Engine
            │       ├─► Rule Engine (hard validation)
            │       ├─► Franchise Persona Store (static pre-filter)
            │       └─► LLM Persona Layer (async — steps 4–6 input only)
            ├─► RTM Engine
            │       └─► Rule Engine
            ├─► Trade Engine
            │       ├─► Rule Engine
            │       └─► LLM Persona Layer
            └─► Session Manager
                    ├─► IndexedDB (instant local write)
                    └─► Supabase Sync Service (async background push)

Season Simulator
    ├─► Dataset Loader (player performance data)
    ├─► Franchise Persona Store
    ├─► LLM Persona Layer (opponent captain/strategy)
    └─► Rule Engine (season rule validation)

UI Layer
    └─► Auction Room Controller (reads Zustand state, sends user actions)

Auth Layer (Supabase Auth)
    └─► Session Manager (user_id scopes all sessions)
```

---

## 6. Rule Engine Responsibilities

The Rule Engine is a **pure, synchronous, stateless validation module**. It receives a proposed action and the current game state, and returns `{ valid: true }` or `{ valid: false, reason: string }`.

It has **zero knowledge of LLM, UI, or persona logic**.

### Complete Validation Scope

| Domain | Checks |
|--------|--------|
| **Player Eligibility** | Player exists in dataset, player is in current auction set, player has not already been sold or withdrawn |
| **Auction Order** | Current set is active, player is next in the queue, set transition rules followed |
| **Bid Increments** | Bid meets minimum increment for the current price band (per auction year rules) |
| **Purse Validation** | Bidding team has sufficient purse, reserved purse for minimum squad slots is maintained |
| **Squad Validation** | Team is within min/max squad size limits after action, action does not violate max squad cap |
| **Overseas Validation** | Overseas player does not exceed overseas slot limit, team has an open overseas slot |
| **Retention Validation** | Max retained players not exceeded, overseas retention limits respected, purse deduction correct, RTM availability correctly set |
| **RTM Validation** | Team has RTM remaining, player was previously with that team, RTM is allowed in auction year, price is valid |
| **Trade Validation** | Players exist, correct teams involved, purse transfers valid, squad limits maintained after trade, trade is within the allowed trade window |
| **Sale Confirmation** | Winning bid is valid, team can complete minimum squad after sale, purse is sufficient |
| **Unsold Status** | Player has gone through all bidding rounds with no valid bids remaining |
| **Session State** | Current state is consistent before any action is applied |

### Rule Engine Interface (Conceptual)

```typescript
interface RuleEngine {
  validateBid(state: GameState, team: TeamId, amount: number): ValidationResult;
  validateRTM(state: GameState, team: TeamId): ValidationResult;
  validateRetention(state: GameState, team: TeamId, retention: RetentionConfig): ValidationResult;
  validateTrade(state: GameState, trade: TradeProposal): ValidationResult;
  validateSaleConfirmation(state: GameState, team: TeamId, amount: number): ValidationResult;
  getBidIncrement(currentBid: number, year: AuctionYear): number;
  getMinReservedPurse(state: GameState, team: TeamId): number;
}
```

---

## 7. Auction Engine Responsibilities

The Auction Engine (Auction Room Controller) manages the full lifecycle of the auction.

| Responsibility | Detail |
|---------------|--------|
| **Set management** | Load auction sets in dataset order, preview sets before start |
| **Player queue** | Load players from dataset in defined order |
| **Interest identification** | Query Bidding Engine for which teams are realistically interested |
| **Turn management** | Determine whose turn it is (opponent vs user) |
| **User input gating** | Pause and wait when user team must make a decision |
| **Bid resolution** | Accept bids, reject invalid bids via Rule Engine |
| **Sale/Unsold resolution** | Confirm final result, update state via Session Manager |
| **State broadcasting** | Notify UI of every state change |
| **Pause/Resume support** | Snapshot state between every player and bid |
| **Accelerated round** | Support accelerated auction rules if applicable to auction year |

### Auction Set Flow State Machine

```
IDLE
  → SET_PREVIEW        (show set details, wait for user to start)
  → PLAYER_LOADING     (load next player from queue)
  → PLAYER_DISPLAY     (show player card, identify interested teams)
  → BIDDING_ACTIVE     (run opponent bids, wait for user when relevant)
  → RTM_DECISION       (if applicable, RTM-eligible team decides)
  → SALE_CONFIRMED     (player sold, update state)
  → UNSOLD_CONFIRMED   (player unsold, update state)
  → SET_COMPLETE       (all players in set done)
  → AUCTION_COMPLETE   (all sets done, move to final squad review)
```

---

## 8. Bidding Engine Responsibilities

The Bidding Engine orchestrates all opponent bidding decisions. It does **not** handle user bids.

### Pipeline (per opponent team, per bid opportunity)

```
Step 1 — Real-World Franchise Intent Check
  Inputs: player type, role, nationality, reputation, auction year context,
          franchise historical behaviour, current squad
  Output: interestScore (0–100), interestReason

Step 2 — IPL Rule Validation
  Delegate to Rule Engine
  Output: valid / blocked

Step 3 — Purse vs Slot Validation
  reservedPurse = remainingMinSlots × minimumBasePrice
  safeBidLimit  = currentPurse - reservedPurse
  Output: maxAllowedBid

Step 4 — Squad Need Scoring
  Inputs: role gaps, quality gaps, Indian core need, overseas balance,
          captaincy need, keeper need, specialist needs, bench depth,
          role scarcity in remaining pool
  Output: needScore (0–100)

Step 5 — Emotion Scoring
  Inputs: former player flag, fan favourite, marquee status,
          rival team competing, missed targets, purse pressure,
          franchise identity fit, owner pressure, brand value
  Output: emotionModifier (bounded, cannot exceed safeBidLimit)

Step 6 — Max Bid Calculation
  maxBid = baseValue
         + needPremium
         + scarcityPremium
         + personaPremium
         + emotionPremium
         + previousTeamPremium
         + captaincyPremium
         - redundancyPenalty
         - futureOptionsPenalty
         - budgetStressPenalty
  Output: privateMaxBid (not exposed to UI)

Step 7 — Final Bid or Pass
  Bid only if:
    nextBid ≤ privateMaxBid
    AND nextBid ≤ safeBidLimit
    AND needScore ≥ minimumInterestThreshold
    AND Rule Engine validates bid
  Otherwise: pass
```

### Anti-Fake-Bidding Rule

If no team passes Step 1 with genuine intent, the player goes unsold. The engine must not manufacture interest to create drama.

### Difficulty Scaling

| Difficulty | Effect |
|-----------|--------|
| Easy | Lower interest thresholds, smaller premiums, weaker purse planning |
| Normal | Realistic values across all steps |
| Hard | Stronger intent checks, better purse reservation, smarter scarcity detection |

---

## 9. Franchise Persona System

Each of the 10 franchises has a static persona configuration used by the Bidding Engine and LLM Persona Layer.

### Persona Data Schema (per franchise)

```typescript
interface FranchisePersona {
  id: TeamId;
  name: string;
  shortName: string;

  // Bidding weights (0–100)
  aggressionLevel: number;
  riskAppetite: number;
  purseDisciline: number;
  emotionalTendency: number;

  // Player preferences
  preferredRoles: PlayerRole[];
  preferredNationality: 'indian' | 'overseas' | 'balanced';
  avoidedPlayerProfiles: string[];

  // Bid calculation modifiers
  formerPlayerBonus: number;
  captaincyPremium: number;
  marqueeResponseMultiplier: number;
  rivalTeamMultiplier: number;
  lateAuctionDesperation: number;

  // RTM behaviour
  rtmThreshold: number;         // score threshold to use RTM
  rtmFormerAttachmentBonus: number;

  // Trade behaviour
  tradeOpenness: number;        // 0=closed, 100=very open
  protectedRoles: PlayerRole[]; // roles they will not trade away

  // LLM prompt identity string
  llmPersonaPrompt: string;     // franchise voice and style for LLM calls
}
```

### Franchise Summary Table

| Team | Aggression | Risk | Purse Discipline | Emotional | Key Trigger |
|------|-----------|------|-----------------|-----------|-------------|
| CSK | Low | Low | High | Low | Former CSK player, role clarity |
| MI | Medium | Low | High | Medium | Young Indian talent, elite pace |
| RCB | High | High | Medium | High | Star names, rival bidding |
| KKR | Medium | Medium | Medium | Medium | Former player, mystery spin |
| DC | Medium | Low | Medium | Medium | Young Indian, captaincy |
| RR | Low | Low | Very High | Very Low | Value, exact role fit |
| SRH | High | Medium | Medium | Medium | Fast bowlers, power profiles |
| PBKS | Very High | High | Low | High | Captain, Indian star, purse advantage |
| GT | Medium | Low | High | Low | Role-perfect fit, bowling depth |
| LSG | High | Medium | Medium | High | Captaincy, explosive batting |

---

## 10. LLM Opponent Owner Architecture

### Permitted LLM Usage (opponent-only)

| Use Case | When Called |
|----------|-------------|
| Bidding intent + emotional reasoning | Per player, for interested opponent teams (batched) |
| Suggested max bid influence | Per player — feeds into Bidding Engine step 6 |
| Owner reaction comment | Per sale/unsold result (shown in UI) |
| RTM reasoning display | When RTM window opens for opponent team |
| Trade evaluation + response | When user proposes a trade |
| Season captain/strategy selection | Once at season setup for each opponent |

### Prohibited LLM Usage

- Any advice, recommendation, or suggestion directed at the user
- Bid suggestions for user team
- Retention recommendations for user team
- Captain or strategy suggestions for user team
- Trade advice for user team
- Any override of Rule Engine decisions

### How LLM Integrates Into the Bidding Pipeline

```
Step 1 (Static pre-filter):
  Franchise Persona Store → quick interest check
  Teams with zero realistic interest → ELIMINATED (no LLM call)

Step 2 (Static): Rule Engine validates squad/purse/overseas → blocks ineligible teams

Step 3 (Static): Safe bid limit calculated per team (reserved purse formula)

Steps 4–6 (LLM-powered, batched):
  One OpenRouter API call per player covers ALL remaining interested teams:

  Prompt: "Evaluate [Player Name] for each of these teams: [CSK, MI, RR].
           Each team's squad state, purse, and persona are below.
           Return JSON array with one entry per team."

  Response per team:
  {
    teamId: string,
    interestLevel: 0–100,        // blended into need scoring (step 4)
    emotionalTriggers: string[], // drives emotion score (step 5)
    suggestedMaxBid: number,     // weighted into max bid calc (step 6)
    reasoning: string,           // internal, not shown to user
    ownerComment: string         // shown in auction room UI
  }

Step 7 (Static):
  Final bid/pass: nextBid ≤ min(suggestedMaxBid, safeBidLimit)
  AND Rule Engine validates → BID or PASS
```

### LLM Call Volume and Cost

| Metric | Value |
|--------|-------|
| Avg interested teams per player (after Step 1 filter) | 2–4 |
| LLM calls per full 200-player auction | ~200 (1 batched call per player) |
| Tokens per batched call (input + output) | ~800 |
| Total tokens per auction | ~160,000 |
| Cost at $0.40/1M tokens (Llama 3.3 70B paid) | ~$0.06 per full auction |

### LLM Provider: OpenRouter

- Endpoint: `https://openrouter.ai/api/v1/chat/completions`
- Required headers: `X-Title: IPL Auction Simulator`, `HTTP-Referer: <app URL>`
- Always use `response_format: { type: "json_object" }` for structured outputs
- Primary model: `meta-llama/llama-3.3-70b-instruct` (free tier or paid)
- Reaction model: `google/gemma-2-9b-it:free` (fast, for short comments)
- Fallback: `mistralai/mistral-7b-instruct:free`

### Static Fallback Bank

Each franchise has a pre-written bank of 20–30 reaction lines per scenario:
- Winning a target player
- Losing a bidding war
- Player going unsold
- RTM decision
- Trade response

If OpenRouter is unavailable or times out (>2 seconds), the fallback comment fires instantly. The auction **never stalls** waiting for LLM.

---

## 11. Session Management Plan

### Session Structure

```typescript
interface GameSession {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  version: string;                // app version for migration support

  // Setup
  auctionYear: number;
  auctionType: 'mega' | 'mini';
  userFranchise: TeamId;
  retentionMode: 'historical' | 'custom' | 'none';
  difficulty: 'easy' | 'normal' | 'hard';

  // Pre-auction state
  retentionConfig: RetentionConfig;
  tradeHistory: TradeRecord[];

  // Auction state
  auctionPhase: AuctionPhase;
  currentSetIndex: number;
  currentPlayerIndex: number;
  currentBidState: BidState | null;

  // Results
  soldPlayers: SoldPlayerRecord[];
  unsoldPlayers: PlayerRecord[];
  teamStates: Record<TeamId, TeamState>;
  auctionHistory: AuctionHistoryEntry[];

  // Season state
  seasonSetup: SeasonSetup | null;
  seasonResult: SeasonResult | null;
}
```

### Auto-Save Triggers

- After every bid
- After every player sale or unsold confirmation
- After every set completion
- After every trade
- After session setup is complete

### Save Strategy (Local-First + Cloud Sync)

```
User action changes game state
    → Zustand persist middleware → IndexedDB (instant, <5ms)
    → Background Supabase Sync Service → Supabase game_sessions table (async)

On app load:
    → Check Supabase for latest session version
    → Compare updatedAt with local IndexedDB version
    → Load whichever is newer

Offline play:
    → All game logic runs on local IndexedDB
    → Syncs to Supabase automatically when internet returns
```

### Supabase Database Schema

```sql
-- Auth managed by Supabase Auth (auth.users)

CREATE TABLE game_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  auction_year   INT NOT NULL,
  auction_type   TEXT NOT NULL,
  user_franchise TEXT NOT NULL,
  difficulty     TEXT NOT NULL,
  phase          TEXT NOT NULL,
  state_json     JSONB NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- Row-Level Security: users can only access their own sessions
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their sessions"
  ON game_sessions FOR ALL
  USING (user_id = auth.uid());
```

### Session Operations

| Operation | Description |
|-----------|-------------|
| Create | New session → stored in IndexedDB + Supabase |
| Resume | Load from Supabase (latest) or IndexedDB (offline fallback) |
| Manual Save | User-triggered — forces immediate Supabase sync |
| Duplicate | Copy session JSON → new session ID |
| Export | Serialize `state_json` → browser download as `.json` |
| Import | File picker → parse JSON → validate → insert to Supabase + IndexedDB |
| Delete | Remove from both IndexedDB and Supabase |

---

## 12. Retention System Plan

### Retention Mode: Historical

- Dataset provides real-life retention data per team
- App applies retained players, purse deductions, RTM availability automatically
- User cannot change historical retention for opponent teams
- User can use historical retention for their own team or switch to custom

### Retention Mode: Custom

User manually configures their own team's retention. Opponents use historical retention.

Custom retention UI allows:
- Add player to retained list (from their previous squad if available in dataset)
- Remove player from retained list
- Set retained player price (within allowed bands for auction year)
- View updated purse deduction
- View RTM availability impact
- Reset to historical

Rule Engine validates on every change:
- Max retained players (per auction year)
- Overseas retention cap
- Purse deduction correctness
- Squad size feasibility
- Player eligibility for retention

### Retention Mode: No Retention

- All players enter the pool
- Purses start at the auction year's maximum starting purse
- RTM is not available

### Retention Data Schema (per team, per year)

```typescript
interface RetentionRecord {
  teamId: TeamId;
  year: number;
  retainedPlayers: {
    playerId: string;
    retentionPrice: number;   // in crores
    wasRTMEligible: boolean;
  }[];
  purseAfterRetention: number;
  rtmSlotsAvailable: number;
}
```

---

## 13. Trade Window Plan

### When Trade Windows Are Available

| Timing | Condition |
|--------|-----------|
| Pre-auction (mega) | Before retention deadline in mega auction years |
| Pre-mini-auction | Between seasons before mini auction |
| Between seasons | If a future season mode is added |

### Trade Types Supported

- Player for player
- Player for cash
- Player + cash for player
- Multiple players for one player
- Multiple players + cash for player

### Trade Proposal Flow

```
User proposes trade to opponent team
  → Rule Engine pre-validates legality (squad limits, purse limits)
  → If invalid: shown to user with reason, not sent to opponent
  → If valid: Trade Engine sends to opponent LLM Persona Layer
      → LLM evaluates using franchise persona
      → LLM returns: accept / reject / counteroffer + owner comment
      → Rule Engine validates LLM's counteroffer (if any)
      → Result shown to user
      → If accepted: squads and purse updated via Session Manager
```

### Opponent Trade Evaluation Factors (via LLM + Persona)

- Player value vs what they are receiving
- Role fit of incoming player
- Whether a core player is being given up
- Squad balance impact
- Purse benefit
- Future auction strategy
- Whether user franchise is being strengthened too much
- Franchise identity alignment
- Auction year context

### Trade Engine Interface

```typescript
interface TradeEngine {
  proposeTrade(state: GameState, proposal: TradeProposal): Promise<TradeResponse>;
  validateTrade(state: GameState, proposal: TradeProposal): ValidationResult;
  applyTrade(state: GameState, proposal: TradeProposal): GameState;
  getTradeHistory(sessionId: string): TradeRecord[];
}

interface TradeResponse {
  decision: 'accept' | 'reject' | 'counteroffer';
  ownerComment: string;
  counteroffer?: TradeProposal;
  reason: string;
}
```

---

## 14. RTM System Plan

### RTM Eligibility

RTM is available only in auction years where real IPL rules allowed it.
Dataset defines per-team RTM slots.

### RTM Trigger

After a player's bidding ends with a winner:
- Check if any team had this player previously and has RTM remaining
- If yes, prompt that team with RTM decision
- For user team: display RTM decision panel (user decides manually)
- For opponent teams: run RTM scoring pipeline

### RTM Scoring (opponent)

```
rtmScore =
  previousTeamAttachment   (was player core to that team?)
+ roleNeed                 (does current squad need this role?)
+ priceValue               (is the sold price reasonable?)
+ scarcity                 (is this role scarce in remaining pool?)
+ personaFit               (does player fit franchise identity?)
+ emotionalValue           (was player beloved by franchise?)
- budgetStress             (does using RTM hurt future bidding badly?)
- redundancyPenalty        (does team already have similar players?)
- betterOptionsAvailable   (are better players still in the pool?)
```

If `rtmScore >= rtmThreshold` (persona-configured), the team uses RTM.

### RTM UI Display (opponent)

```
[Team Name] RTM thinking...
→ Role fit: Yes / No
→ Budget impact: Safe / Tight / Risky
→ Better options remaining: Yes / No
→ [Team Name] uses RTM. / [Team Name] declines RTM.
```

### RTM Rule Engine Checks

- Team has RTM slots remaining
- Player was previously with that team (per dataset)
- RTM is allowed in selected auction year
- Team can afford the RTM price
- Team has squad and overseas slots available

---

## 15. Auction Room State Flow

### State Machine

```
AUCTION_SETUP
  → RETENTION_CONFIG
  → TRADE_WINDOW (optional)
  → AUCTION_STARTED

AUCTION_STARTED
  → SET_PREVIEW
  → SET_ACTIVE
      → PLAYER_UP
          → BIDDING_ROUND
              → OPPONENT_BID_PIPELINE (per team)
              → USER_DECISION_GATE (when user team is eligible)
              → BID_ACCEPTED / BID_REJECTED
              → ROUND_CONTINUES / BIDDING_ENDS
          → RTM_WINDOW (if applicable)
          → PLAYER_SOLD → STATE_UPDATED → AUTOSAVE
          → PLAYER_UNSOLD → STATE_UPDATED → AUTOSAVE
      → NEXT_PLAYER / SET_ENDS
  → NEXT_SET / ALL_SETS_DONE

ALL_SETS_DONE
  → ACCELERATED_ROUND (if applicable per auction year)
  → AUCTION_COMPLETE
  → FINAL_SQUAD_REVIEW
  → SEASON_SETUP (optional)
  → SEASON_SIMULATION
  → SEASON_RESULTS
```

### User Decision Gate Rules

The app **pauses and waits** for user input when:
- The current bid is not from the user team and the user team is still eligible to bid
- RTM window opens for the user team
- Any user team decision is required

The app **never** auto-bids for the user under any circumstances.

---

## 16. Simple Season Simulation Plan

### Philosophy

- Not a match simulator
- Not ball-by-ball
- Not a cricket management game
- Uses real IPL player performance from the selected year as the primary base
- Player performance data is loaded from the dataset
- Simulation is a weighted scoring computation, not a random generator

### Season Setup (user)

User selects:
- Captain (from squad)
- Vice-captain (optional)
- Team instructions (one of the defined strategic options)

Opponent teams: LLM Persona Layer picks captain and strategy based on franchise identity.

### Season Simulation Formula

```
seasonStrength =
  realWorldPerformanceBase   × 0.45   (dominant factor)
+ squadBalance               × 0.15
+ roleFit                    × 0.10
+ captaincyEffect            × 0.08
+ strategyFit                × 0.07
+ benchDepth                 × 0.05
+ bowlingBalance              × 0.05
+ battingBalance              × 0.03
+ overseasBalance             × 0.02
+ controlledRandomness        (±10% variance, seeded per session)
```

### Captain Type Effects

| Captain Type | Positive | Risk |
|-------------|---------|------|
| Aggressive | Higher attack upside, powerplay intent | Collapse risk, volatility |
| Calm | Close-match stability, consistency | Lower explosive ceiling |
| Young | Fresh tactics, youth inspiration | Pressure risk, tactical gaps |
| Senior | Dressing-room control, stability | Lower innovation |

### Strategy Effects

| Strategy | Positive | Risk |
|---------|---------|------|
| Aggressive Batting | High-score potential | Collapse risk |
| Anchor Batting | Consistency | Lower ceiling |
| Spin Heavy | Good if spinners are strong | Suffers on pace tracks |
| Pace Heavy | Good if pace attack is strong | Suffers if death bowling weak |
| Back Youngsters | Upside potential | Inconsistency |
| Trust Experience | Stability | Lower breakthrough potential |
| Flexible Order | Tactical adaptability | Role confusion |
| Fixed Roles | Role clarity | Tactical inflexibility |

### Season Outputs

| Output | Description |
|--------|-------------|
| Final Points Table | Wins, losses, NRR, points for all 10 teams |
| Playoff Qualifiers | Top 4 teams |
| Winner | Champion team |
| Runner-Up | Final loser |
| Orange Cap | Highest run scorer |
| Purple Cap | Highest wicket taker |
| MVP | Best overall performer |
| Best Auction Buy | Highest impact relative to cost |
| Worst Auction Buy | Lowest impact relative to cost |
| Most Improved Team | Relative to pre-season expectations |
| Most Disappointing Team | Below pre-season expectations |
| User Team Review | Factual performance summary (no advice) |
| All Team Summaries | Per-team key metrics |

---

## 17. Data Requirements

### Dataset Structure (per auction year)

#### Auction Metadata

| Field | Type | Description |
|-------|------|-------------|
| `year` | number | e.g. 2025 |
| `auctionType` | string | 'mega' or 'mini' |
| `teams` | TeamId[] | List of participating teams |
| `startingPurse` | Record<TeamId, number> | Per-team starting purse in crores |
| `minimumSquadSize` | number | e.g. 18 |
| `maximumSquadSize` | number | e.g. 25 |
| `overseasLimit` | number | e.g. 8 |
| `bidIncrements` | BidIncrementBand[] | Bid step per price range |
| `rtmAvailable` | boolean | Whether RTM applies this year |
| `maxRTMPerTeam` | number | Max RTM uses per team |
| `maxRetainedPlayers` | number | Max retentions per team |
| `maxOverseasRetained` | number | Max overseas retentions |
| `retentionPriceBands` | PriceBand[] | Price tiers for retention |
| `tradeWindowEnabled` | boolean | |
| `acceleratedRoundEnabled` | boolean | |

#### Player Records

| Field | Type | Description |
|-------|------|-------------|
| `playerId` | string | Unique identifier |
| `name` | string | Full name |
| `role` | PlayerRole | BAT / BWL / AR / WK |
| `nationality` | string | Country name |
| `isOverseas` | boolean | |
| `isCapped` | boolean | Capped by national team |
| `basePrice` | number | In crores |
| `auctionSet` | string | Set name e.g. 'Marquee Set A' |
| `auctionSetOrder` | number | Position within set |
| `previousTeam` | TeamId | null | Team in prior IPL season |
| `rtmEligibleFor` | TeamId | null | Team eligible to RTM this player |

#### Historical Retention Data (per year, if applicable)

| Field | Type | Description |
|-------|------|-------------|
| `teamId` | TeamId | |
| `retainedPlayers` | RetainedPlayer[] | List with price and RTM flag |
| `purseAfterRetention` | number | |
| `rtmSlotsAvailable` | number | |

#### Player Performance Data (for season simulation)

| Field | Type | Description |
|-------|------|-------------|
| `playerId` | string | |
| `year` | number | IPL season year |
| `matches` | number | Matches played |
| `runsScored` | number | null | |
| `battingAverage` | number | null | |
| `strikeRate` | number | null | |
| `wicketsTaken` | number | null | |
| `bowlingEconomy` | number | null | |
| `bowlingAverage` | number | null | |
| `allRoundContribution` | number | Composite score |
| `performanceRating` | number | 0–100 composite rating (primary simulation input) |
| `injuryFlag` | boolean | Had significant injury that year |
| `formFlag` | string | 'peak' | 'average' | 'poor' |

---

## 18. Dataset Validation Rules

On dataset load, the app must validate:

| Validation | Rule |
|-----------|------|
| Required fields present | All mandatory fields must exist for every record |
| Player IDs unique | No duplicate player IDs within a year's dataset |
| Base price within valid range | Must be one of the legal base price bands for that year |
| Auction set ordering | Every player must have a set and order number |
| Purse values positive | No negative purse values |
| RTM eligibility consistency | RTM-eligible player must have a valid previous team in same dataset |
| Overseas count | Total overseas players in each team's retained list must not exceed overseas retention cap |
| Performance data alignment | If performance data present, player IDs must match auction dataset |
| Bid increment bands | Must cover all possible price ranges (no gaps) |
| Team list completeness | All referenced team IDs must be in the teams list |

Datasets that fail validation must be rejected with a clear error message showing the failing field and record.

---

## 19. UI Screen Map

| Screen | Purpose |
|--------|---------|
| **Login / Register** | Supabase Auth — email/password or Google OAuth |
| **Home** | New game / resume / import session |
| **Auction Selection** | Choose auction year and type |
| **Franchise Selection** | Choose user franchise; view team history |
| **Difficulty Selection** | Easy / Normal / Hard |
| **Retention Setup** | Historical / Custom / No retention mode |
| **Custom Retention Config** | Add/remove/edit retained players |
| **Trade Window** | Propose / review / respond to trades |
| **Auction Room** | Main gameplay screen (see below) |
| **Player Detail Modal** | Full player card with stats |
| **My Squad View** | User team's current squad, purse, slots |
| **All Squads View** | All teams' current squads |
| **Auction History** | Full log of all bids and sales |
| **Unsold Players** | List of unsold players with reasons |
| **Final Squad Review** | Post-auction squad summary, all teams |
| **Season Setup** | Captain, vice-captain, team instructions |
| **Season Results** | Points table, awards, team reviews |
| **Team Review Detail** | Per-team full season review |
| **Saved Sessions** | List saved sessions with metadata |

### Auction Room Panel Layout

```
┌─────────────────────────────────────────────────────────┐
│  AUCTION YEAR  │  SET: Marquee Set A  │  Player 3 of 12 │
├──────────────────────┬──────────────────────────────────┤
│  PLAYER CARD         │  BID TIMELINE                    │
│  Name                │  ₹2.0 Cr — MI                   │
│  Role / Country      │  ₹2.4 Cr — RCB                  │
│  Capped / Overseas   │  ₹3.0 Cr — MI                   │
│  Base Price: ₹X Cr   │  ₹3.6 Cr — RCB                  │
│  Previous: Team      ├──────────────────────────────────┤
│  Current Bid: ₹X Cr  │  OPPONENT REACTIONS              │
│  Leading: Team       │  RCB: "We need this bowling slot."│
│  Next Valid: ₹X Cr   │  MI: "Hold discipline."          │
├──────────────────────┴──────────────────────────────────┤
│  TEAM PADDLES (active teams shown)                      │
│  [CSK] [MI] [RCB ✓] [KKR] [SRH]                       │
├─────────────────────────────────────────────────────────┤
│  MY TEAM STATUS                                         │
│  Purse: ₹42.5 Cr │ Squad: 14/25 │ Overseas: 3/8        │
│  RTMs: 1 remaining                                      │
├──────────────────┬──────────────────────────────────────┤
│  [BID ₹X Cr]     │  [CUSTOM BID]  │  [PASS]            │
│  [VIEW MY SQUAD] │  [ALL SQUADS]  │  [HISTORY] [SAVE]  │
└──────────────────┴──────────────────────────────────────┘
```

---

## 20. Edge Cases

| Edge Case | Handling |
|-----------|---------|
| User has insufficient purse to bid | Bid button disabled; factual message shown |
| User has no overseas slots | Overseas players show slot status; bidding blocked by Rule Engine |
| All teams have full squads before auction ends | Auction ends early, unsold remaining players |
| Dataset missing performance data | Season simulation uses squad-based scoring only; performance factor is zeroed |
| LLM API fails during opponent bid | Bidding Engine uses persona static values; no LLM flavour text |
| LLM returns invalid bid suggestion | Rule Engine validates; invalid suggestion ignored silently |
| Player already sold appears in queue | Rule Engine blocks; flagged as dataset error |
| RTM team has zero purse | RTM decision forced to decline |
| Trade leaves team below minimum squad | Rule Engine rejects trade |
| User tries to bid after passing | If round still active, allow re-entry per auction year rules |
| User closes app mid-bid | Auto-save recovers state from before that bid |
| Dataset purse sum does not equal expected total | Validation warning shown at load |
| Retained player not in dataset | Validation error; dataset rejected |
| No teams have interest in a player | Player goes unsold — no artificial bids injected |
| Accelerated round eligibility unknown | Default off; only enable if dataset flags it |

---

## 21. Risk Areas

| Risk | Severity | Mitigation |
|------|---------|-----------|
| LLM producing inconsistent or out-of-character responses | Medium | Strong persona prompts, structured JSON output, fallback to static values |
| Rule Engine bugs leading to illegal game states | High | Pure unit-testable module; comprehensive test suite; no side effects |
| Dataset format inconsistencies across years | High | Strict validation at load time; reject invalid datasets with clear errors |
| Fake bidding wars making the auction feel artificial | High | Anti-fake-bid rule in Bidding Engine; unsold is always valid |
| Session corruption on crash | Medium | Auto-save after every state-changing event; atomic writes |
| LLM costs escalating with heavy opponent bidding | Medium | Cache persona calls per player; batch reasoning where possible |
| Performance data gaps for some auction years | Medium | Season simulator falls back to squad-only scoring |
| User confusion about what constitutes advice vs information | Medium | Strict UI copy review; no "you should" language ever |
| Overseas slot edge cases in unusual auction years | Medium | Rule Engine pulls overseas limits directly from dataset, not hardcoded |
| RTM logic errors for years where RTM rules changed | High | RTM rules fully specified in dataset, not hardcoded |

---

## 22. MVP Scope

The MVP delivers a complete, playable auction experience for one auction year.

### MVP Includes

- [ ] Supabase project setup (Auth + `game_sessions` schema migration)
- [ ] Login / Register screen (email/password via Supabase Auth)
- [ ] Dataset loader and validator (one auction year: IPL 2025)
- [ ] Auction year and franchise selection
- [ ] Historical retention mode only
- [ ] Rule Engine (full validation scope, unit tested)
- [ ] Auction Room (complete player/set flow)
- [ ] Bidding Engine (all 7 steps, static persona values — no LLM in Phase 1)
- [ ] All 10 franchise personas (static)
- [ ] Opponent reactions (static per-franchise comment bank)
- [ ] RTM logic (opponent + user manual decision)
- [ ] Session save/resume: IndexedDB (instant) + Supabase (cloud sync)
- [ ] UI screens: Login, Home, Auction Room, My Squad, All Squads, History, Final Squad
- [ ] Player sold/unsold display with reason
- [ ] PWA manifest and service worker (installable, offline-capable for game logic)
- [ ] Difficulty: Normal only

### MVP Excludes

- LLM integration (added in Phase 2)
- Custom retention (Phase 2)
- No-retention mode (Phase 3)
- Trade window (Phase 2)
- Season simulation (Phase 3)
- Multiple auction years (added as datasets are provided)
- Export/import session (Phase 4)
- Difficulty modes Easy/Hard (Phase 3)
- Accelerated auction round (Phase 3)
- Capacitor / Android APK (Phase 4)

---

## 23. Post-MVP Scope

| Feature | Phase |
|---------|-------|
| OpenRouter LLM Persona Layer (batched opponent bidding) | Phase 2 |
| LLM owner reaction comments in auction room | Phase 2 |
| LLM RTM reasoning display | Phase 2 |
| LLM trade negotiation | Phase 2 |
| Custom retention mode | Phase 2 |
| Trade window | Phase 2 |
| Additional auction year datasets | Phase 2 |
| Season simulation (simple) | Phase 3 |
| Season results and team reviews | Phase 3 |
| LLM opponent season captain/strategy | Phase 3 |
| No-retention mode | Phase 3 |
| Easy / Hard difficulty modes | Phase 3 |
| Accelerated auction round | Phase 3 |
| Capacitor v6 → Android APK | Phase 4 |
| Export / import session | Phase 4 |
| Session duplicate | Phase 4 |
| UI polish and animations | Phase 4 |
| Additional auction years (2018–2024) | Ongoing |

---

## 24. Suggested Implementation Phases

### Phase 1 — Core Foundation (MVP, No LLM)

**Goal:** Playable complete auction with strict rules, static AI, Supabase auth, cloud save/resume.

1. Supabase project setup — Auth config + `game_sessions` schema migration
2. Define all TypeScript types and interfaces (GameState, TeamState, PlayerRecord, etc.)
3. Build Dataset Loader and Validator
4. Create IPL 2025 dataset (JSON)
5. Build Rule Engine (pure, sync, fully unit tested)
6. Build Franchise Persona Store (10 static personas + fallback comment banks)
7. Build Bidding Engine (7-step pipeline, static persona — no LLM)
8. Build RTM Engine
9. Build Session Manager (IndexedDB instant write + async Supabase sync)
10. Build Auction Room Controller (state machine)
11. Build React UI: Login/Register, Home, Auction Room, My Squad, All Squads, History, Final Squad
12. Historical retention logic
13. PWA manifest + service worker
14. Test full auction end-to-end (start → complete → save → resume)

**Deliverable:** Complete IPL 2025 auction, playable from login to final squad, save/resume working on any device.

---

### Phase 2 — LLM Integration + Trade Window + Custom Retention

**Goal:** Living opponents with emotional realism, trade flexibility, custom retention.

1. OpenRouter LLM Persona Layer (batched calls, structured JSON output)
2. LLM integrated into Bidding Engine steps 4–6 (interest level + suggestedMaxBid)
3. Owner reaction comments in auction room UI (LLM-generated, fallback bank ready)
4. RTM LLM reasoning display for opponents
5. Trade Engine + Trade Window UI
6. Trade LLM evaluation and opponent persona responses
7. Custom Retention UI + Rule Engine validation
8. Additional auction year datasets (2022, 2023, 2024)
9. Easy and Hard difficulty modes

**Deliverable:** Full LLM-powered opponent personality, trade window, custom retention, multi-year support.

---

### Phase 3 — Season Simulation

**Goal:** Post-auction season simulation with real performance data.

1. Player performance data structure and loader
2. Season Simulator (formula-based, per Section 16)
3. Captain and strategy effect modules
4. LLM opponent captain/strategy selection
5. Season Results screen (points table, awards)
6. Team Review generation (factual, no advice)
7. No-retention mode
8. Accelerated auction round support
9. Easy / Hard difficulty mode tuning for season simulation

**Deliverable:** Complete game loop from auction through season results.

---

### Phase 4 — Mobile + Polish

**Goal:** Android APK, session completeness, UI immersion.

1. Capacitor v6 setup → `cap add android` → `cap sync` → APK build via Android Studio
2. Touch interaction testing and mobile UI adjustments
3. Export / import session (browser download + file picker)
4. Session duplicate
5. UI animations (sold/unsold results, bid timeline, opponent reactions)
6. All remaining historical datasets (2018–2021)
7. Performance tuning and edge case hardening

**Deliverable:** Production-quality web app + Android APK.

---

## 25. Questions and Assumptions Requiring Confirmation

### Resolved Decisions

| Decision | Confirmed |
|---------|-----------|
| Platform | Web app (React + Vite PWA) → Android APK via Capacitor (Phase 4) |
| LLM provider | OpenRouter (free + paid models; user provides their own API key) |
| LLM in bidding | Yes — LLM powers opponent intent, emotion, and suggested max bid (steps 4–6); Rule Engine validates final action |
| Auth + sessions | Supabase (Auth + PostgreSQL JSONB sessions) |
| Local cache | IndexedDB via `idb` (optimistic local-first, async Supabase sync) |

### Open Questions

1. **Dataset provision:** Will you provide the IPL 2025 dataset (player names, base prices, sets, auction order), or should the app define the JSON format and you populate it? Should one dataset ship pre-loaded in the app?

2. **Season simulation data:** Is IPL 2025 player performance data (runs, wickets, economy, strike rate) already compiled, or will it need to be manually assembled before Phase 3?

3. **Custom retention for opponents:** In custom retention mode, can the user also modify opponent team retentions, or only their own team's?

4. **Replacement players:** Are mid-season replacement rules (injury replacements) in scope for any phase, or fully out of scope?

5. **OpenRouter API key:** Will the app prompt the user to enter their OpenRouter key in a settings screen, or should it be hardcoded in a `.env` file during development?

### Assumptions

| Assumption | Basis |
|-----------|-------|
| Auction year rules are encoded in the dataset, not hardcoded | Feature guide: dataset defines rules |
| Opponent teams always use historical retention in custom mode | Feature guide implies user-only custom retention |
| No online multiplayer required | Single-player product throughout |
| English-only UI | Not specified; assuming English |
| No external sports API connection | Dataset is user-provided, not live data |
| LLM called once per player (batched across teams), not once per bid | Cost + latency optimisation; confirmed in architecture |
| Season simulation runs once per session | Feature guide implies single pass |
| IPL 2025 Mega Auction is the first MVP dataset | Most recent complete dataset |

---

## Next Recommended Claude Code Prompt

Once you have reviewed and approved this planning document, paste the following prompt to begin Phase 1 implementation:

```
I have reviewed and approved PLANNING.md.

Begin Phase 1 implementation of the IPL Auction Simulator.

Confirmed tech stack:
- React 18 + Vite 5 (PWA via vite-plugin-pwa)
- TypeScript strict mode throughout
- Zustand + persist middleware (state)
- Tailwind CSS v3
- Supabase (Auth + PostgreSQL JSONB sessions)
- IndexedDB via idb v8 (local-first cache)
- No LLM in Phase 1 — static persona values only
- OpenRouter LLM comes in Phase 2

Phase 1 deliverables:
1. Supabase project setup + game_sessions schema migration
2. All TypeScript types and interfaces (GameState, TeamState, PlayerRecord, etc.)
3. IPL 2025 dataset (JSON format defined by you; confirm whether pre-loaded or user-provided)
4. Rule Engine — pure, sync, zero side effects, fully unit tested
5. Franchise Persona Store — 10 static personas + fallback comment banks
6. Bidding Engine — 7-step pipeline, static persona, no LLM
7. RTM Engine
8. Session Manager — IndexedDB instant write + async Supabase sync
9. Auction Room Controller — state machine
10. React UI — Login/Register, Home, Auction Room, My Squad, All Squads, History, Final Squad Review
11. Historical retention mode
12. PWA manifest + service worker

Build order: types → Rule Engine (with tests) → Persona Store → Bidding Engine
→ RTM Engine → Session Manager → Auction Room Controller → UI screens

Strict constraints (never violate):
- Rule Engine is always final authority — no module overrides it
- No LLM in Phase 1
- No advice to user ever (factual information only)
- No invented players — only dataset players
- Auto-save after every state-changing event
- Bidding Engine must never manufacture fake bidding wars
- LLM layer (Phase 2) is input to bidding steps 4–6 only; Rule Engine validates all outputs
```
