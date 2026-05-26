# GPL Auction Simulator

A mobile-first IPL auction simulator built for Android, branded as the **Geek Premier League (GPL)**. Simulates the full IPL mega auction experience — retentions, live bidding, RTM, accelerated auction, and a full season simulation — all offline, no server required during play.

---

## Tech Stack

| Layer | Tech |
|---|---|
| UI | React 19 + TypeScript + Tailwind CSS 4 |
| Build | Vite 8 |
| State | Zustand (with persist middleware) |
| Routing | React Router DOM 7 |
| Mobile | Capacitor v8 (Android) |
| Storage | IndexedDB (primary) + Supabase (cloud backup) |
| Auth | Supabase Auth |

---

## Features

### Auction
- Full 2025 IPL Mega Auction dataset — 600 players across 36 sets
- Set order interleaved by role (BAT → BWL → AR → WK) to avoid consecutive same-type sets
- AI bidding engine — 7-step pipeline per team per player:
  - Static franchise interest (role weights, nationality, loyalty)
  - Rule Engine hard gates (purse, squad slots, overseas cap)
  - Safe bid limit with purse reservation
  - Squad need score (role gaps, fill ratio)
  - Emotion score (auction style, loyalty triggers)
  - Max bid calculation (market value anchor or formula fallback)
  - Bid or pass decision
- Realistic unsold rates — pass threshold at 40/100 keeps 2–4 active bidders per player
- Role saturation — teams with 6 batters don't bid on more batters
- Overseas slot conservation — teams save slots for elite players later
- Per-player franchise affinity — stable hash makes each team consistently keener or cooler on specific players

### RTM (Right to Match)
- Full RTM flow per 2025 rules
- Slot tracking per team (CSK=1, MI=1, RCB=3, etc.)
- AI teams exercise RTM based on desire threshold vs current bid
- User RTM prompt with slots-remaining display

### Accelerated Auction
- After main auction: unsold pool eligible for accelerated round
- User selects up to 5 players; AI nominates to fill 30 total
- All players auctioned at 50% base price

### Uncapped Player Potential
- Every uncapped player has `age`, `potential` (1–10), `prospectTier` (elite/promising/domestic/filler)
- Potential drives interest score and max bid ceiling
- Each franchise has `potentialWeight` (RR 0.90 → CSK 0.30) and `youthThreshold`
- Elite prospects (Suryavanshi, Mhatre, Musheer) trigger bidding wars

### Session Management
- Sessions persist to IndexedDB locally; Supabase sync is fire-and-forget
- On abrupt close: `visibilitychange` triggers immediate save
- On resume: `bidding` phase resets to `set-preview` for clean restart
- Multi-device: `loadSession` picks newer of local vs remote by `updatedAt`

### Season Simulation
- Post-auction: pick captain, vice-captain, team instruction (10 strategies)
- Full 10-team points table with W/L/NRR
- Awards: Orange Cap, Purple Cap, MVP, Best/Worst Auction Buy
- Per-team review: batting/bowling/balance/depth/auction value ratings + key performers

### Auction Report (Final Squad Review)
- Letter grade S/A/B/C/D/F with score /100
- Breakdown: Role Balance /25, Value for Money /25, Squad Depth /20, Overseas Coverage /15, Star Power /15
- Best Value Picks and Overpay list per team
- Full player value table (paid vs base, multiplier)
- Available for all 10 teams — switch franchise to compare

---

## Project Structure

```
src/
├── components/
│   ├── auction/         # PlayerCard, TeamPaddles, UserActionPanel, BidTimeline, SaleResult
│   └── ui/              # Button, BottomNav, LoadingSpinner, TeamBadge
├── controllers/
│   └── auctionController.ts   # User actions + AI decision orchestration
├── data/datasets/
│   └── ipl2025.json           # Full 600-player dataset with retentions, RTM slots, potential
├── dataset/
│   └── datasetLoader.ts       # Loads dataset, resolves bid increments, set player lists
├── engine/
│   ├── biddingEngine.ts       # 7-step AI pipeline
│   ├── ruleEngine.ts          # Hard validation (purse, slots, overseas)
│   ├── rtmEngine.ts           # RTM decision logic
│   ├── retentionEngine.ts     # Historical retention application
│   ├── seasonSimulator.ts     # Full season simulation
│   └── tradeEngine.ts         # Trade validation
├── personas/                  # 10 franchise AI personas (csk.ts, mi.ts, …)
├── screens/                   # Route-level screens
├── session/
│   ├── sessionManager.ts      # Create/save/load/delete sessions
│   ├── indexedDBStore.ts      # Local persistence
│   └── supabaseSync.ts        # Cloud backup
├── store/
│   ├── gameStore.ts           # Zustand game state (persist to localStorage)
│   └── sessionStore.ts        # Session list store
└── types/                     # TypeScript types (game, player, team, dataset, season)
```

---

## Franchise Personas

| Team | Style | Potential Weight | Youth Threshold |
|------|-------|-----------------|-----------------|
| RR | Moneyball | 0.90 | 24 |
| MI | Aggressive | 0.85 | 23 |
| KKR | Calculated | 0.80 | 24 |
| RCB | Emotional | 0.75 | 23 |
| GT | Analytical | 0.75 | 23 |
| DC | Calculated | 0.70 | 23 |
| SRH | Aggressive | 0.65 | 24 |
| LSG | Moneyball | 0.60 | 22 |
| PBKS | Emotional | 0.55 | 22 |
| CSK | Calculated | 0.30 | 21 |

---

## Building

### Web (dev)
```bash
npm install
npm run dev
```

### Android APK
```bash
npm run build
npx cap sync android
cd android
# Windows:
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set ANDROID_HOME=C:\Users\<user>\AppData\Local\Android\Sdk
.\gradlew.bat assembleDebug
```

APK output: `android/app/build/outputs/apk/debug/app-debug.apk`

### Icon generation
```bash
node scripts/gen-icon.mjs
```
Generates all Android mipmap densities (mdpi → xxxhdpi) from the GPL shield SVG.

---

## Release History

| Version | Notes |
|---------|-------|
| V1 | Initial push |
| V2 | Core auction engine |
| V3 | RTM, accelerated auction, uncapped potential |
| V4 | GPL branding, bidding realism, auction report |
| V5 | Pause/resume, bottom nav cleanup, header fixes |
| V6 | Bidding engine realism (unsold players, overseas conservation, role saturation) |

---

## Dataset Notes

- **2025 Mega Auction** is the only fully available dataset
- 2020–2024 marked "Coming Soon" in the UI
- Player `marketValue` = actual 2025 IPL auction result (used as bid ceiling anchor)
- Uncapped players: 77 notable players have real `age`/`potential`/`prospectTier`; 256 defaulted to age=25, potential=4, tier=domestic
- RTM eligibility: `rtmEligibleFor` = `previousTeam` for all pool players
