/**
 * Prompt builders for each LLM use case.
 * Each builder returns a messages array ready for the appropriate callLLMJson* function.
 */

import type { ChatMessage } from './openRouterClient'
import type { PlayerRecord, PlayerFormContext } from '@/types/player'
import type { TeamState } from '@/types/team'
import type { FranchisePersona } from '@/types/team'
import type { PlayerImportanceProfile } from '@/engine/playerImportance'

// ─── Bidding prompt ───────────────────────────────────────────────────────────

export interface ComparableSale {
  name: string
  finalPrice: number
  isOverseas: boolean
  cappedStatus: string
}

export interface BiddingPromptContext {
  persona: FranchisePersona
  player: PlayerRecord
  teamState: TeamState
  currentBid: number
  auctionYear: number
  setName: string
  soldCount: number
  nextAvailablePlayers: PlayerRecord[]
  allTeamPurses: { teamId: string; purse: number }[]
  startingPurse: number
  comparableSales: ComparableSale[]     // real auction prices for similar players
  formContext: PlayerFormContext | null  // player's recent form fetched at auction time
}

export interface BiddingLLMResponse {
  personalCeiling: number      // franchise's true max for this player
  interestLevel: number        // 0–100
  jumpBid: number | null       // bid above minimum increment to intimidate (null = normal)
  ownerComment: string
  reasoning: string
}

export function buildBiddingMessages(ctx: BiddingPromptContext): ChatMessage[] {
  const { persona, player, teamState, currentBid, auctionYear, setName,
          nextAvailablePlayers, allTeamPurses, startingPurse, comparableSales, formContext } = ctx

  const squadRoles   = teamState.squad.map(p => p.role)
  const roleCount    = (r: string) => squadRoles.filter(x => x === r).length
  const squadSummary = `WK:${roleCount('WK')} BAT:${roleCount('BAT')} AR:${roleCount('AR')} BWL:${roleCount('BWL')}`
  const purse        = teamState.currentPurse.toFixed(1)
  const overseas     = teamState.overseasCount
  const spent        = startingPurse - teamState.currentPurse
  const spentPct     = startingPurse > 0 ? Math.round((spent / startingPurse) * 100) : 0

  const needs: string[] = []
  if (roleCount('WK') < 2) needs.push(`${2 - roleCount('WK')} more WK`)
  if (roleCount('BAT') < 4) needs.push(`${4 - roleCount('BAT')} more BAT`)
  if (roleCount('BWL') < 4) needs.push(`${4 - roleCount('BWL')} more BWL`)
  if (roleCount('AR') < 2) needs.push(`${2 - roleCount('AR')} more AR`)
  const needsSummary = needs.length > 0 ? needs.join(', ') : 'squad is well balanced'

  const isLastOfRole = nextAvailablePlayers.length === 0
  const altLines = isLastOfRole
    ? `  ⚠️ NONE — this is the LAST available ${player.role} in the entire auction. There are no alternatives.`
    : nextAvailablePlayers.map(p =>
        `  • ${p.name} (${p.isOverseas ? 'Overseas' : 'Indian'}, base ₹${p.basePrice}Cr)`
      ).join('\n')

  const purseLines = allTeamPurses
    .map(t => `  ${t.teamId}: ₹${t.purse.toFixed(0)}Cr`)
    .join('\n')

  const isAggressive = persona.auctionStyle === 'aggressive'
  const triggersLine = persona.emotionalTriggers.length > 0
    ? `\nFRANCHISE PRIORITIES: You especially value players who are: ${persona.emotionalTriggers.join(', ')}. If this player matches these traits, raise your ceiling aggressively.`
    : ''

  // Real-world market anchors from same-role players in this dataset
  const compLines = comparableSales.length > 0
    ? comparableSales
        .map(c => `  • ${c.name} (${c.isOverseas ? 'Overseas' : 'Indian'}, ${c.cappedStatus}) → ₹${c.finalPrice.toFixed(2)}Cr`)
        .join('\n')
    : '  No direct comparables available'

  // Per-player real price anchor if known
  const marketAnchor = (player.marketValue ?? null) != null
    ? `\nREAL IPL 2025 PRICE (actual auction result): ₹${player.marketValue!.toFixed(2)}Cr — use this as your primary anchor.`
    : ''

  // Recent form context — fetched by LLM at auction start, reflects SMAT/int'l/rankings
  const formLine = formContext?.source === 'llm' && formContext.summary
    ? [
        `\nPLAYER RECENT FORM (pre-auction ${auctionYear}):`,
        formContext.estimatedAge ? `  Age: ~${formContext.estimatedAge} yrs` : '',
        `  ${formContext.summary}`,
        formContext.t20iRanking ? `  ICC T20I World Ranking: #${formContext.t20iRanking}` : '',
        `  Age context: Peak-age players (26–32) combine experience and physical prime — they generally command the highest ceilings. Veterans (33+) and young prospects (≤24) carry higher risk; only stretch your ceiling for them if recent form is compelling, the role is scarce in your squad, or it matches your franchise's stated philosophy. Let form, fit, and squad context drive your ceiling — age is one input, not a rule.`,
      ].filter(Boolean).join('\n')
    : ''

  return [
    {
      role: 'system',
      content: `You are the owner/decision-maker of ${persona.displayName} at the IPL ${auctionYear} auction.

${persona.llmPersonaPrompt}

YOUR SQUAD (${teamState.squad.length} players): ${squadSummary}
OVERSEAS SLOTS USED: ${overseas}/8
PURSE: ₹${purse}Cr remaining of ₹${startingPurse}Cr (${spentPct}% spent)
SQUAD NEEDS: ${needsSummary}
AUCTION SET: ${setName}

ALTERNATIVES IN THIS ROLE STILL AVAILABLE:
${altLines}

LEAGUE PURSE LANDSCAPE (rivals' remaining budgets):
${purseLines}

REAL IPL ${auctionYear} COMPARABLE SALES (same role, similar profile — actual auction results):
${compLines}
These are real prices paid in this auction. Use them as market anchors for personalCeiling.${marketAnchor}
${formLine}
${triggersLine}
IPL AUCTION REALITY:
- Base price is the floor, NOT fair value.
- personalCeiling = the MOST you would genuinely pay given your squad need, budget, and competitive pressure.
- HOW TO SET IT (in priority order):
    1. If "REAL IPL PRICE" is shown → that is what this player actually sold for. Expect to match or exceed it if you want them — competition drives prices to and past real value. High need = set ceiling at real price or above. Low need = 60–80% of real price.
    2. If comparable sales are shown → anchor to the closest match, adjust ±25% for this player's quality difference.
    3. If neither → use player reputation, role, and capped status to estimate.
- Stars and franchise favourites attract emotional bidding — their real final price reflects that. Don't underprice marquee players.
- jumpBid: bid above minimum increment to signal dominance.${isAggressive ? ' You are aggressive — use jump bids to assert control.' : ' Use jump bids sparingly.'}

Respond with ONLY a valid JSON object. No markdown, no explanation.`,
    },
    {
      role: 'user',
      content: `PLAYER UP FOR AUCTION:
Name: ${player.name}
Role: ${player.role}
Nationality: ${player.isOverseas ? `Overseas (${player.country})` : `Indian (${player.country})`}
Status: ${player.cappedStatus === 'capped' ? 'Capped international' : 'Uncapped'}
Previous team: ${player.previousTeam ?? 'None'}
Base price: ₹${player.basePrice.toFixed(2)}Cr
Current bid: ₹${currentBid.toFixed(2)}Cr

Set your personalCeiling and decide whether to jump bid.

{"personalCeiling":18.5,"interestLevel":80,"jumpBid":null,"ownerComment":"He's exactly what we need.","reasoning":"Fills our BAT gap and no alternatives remain."}`,
    },
  ]
}

// ─── Fight-or-Fold prompt ─────────────────────────────────────────────────────

export interface FightOrFoldContext {
  persona: FranchisePersona
  player: PlayerRecord
  currentBid: number
  personalCeiling: number
  teamState: TeamState
  activeBidders: { teamId: string; purse: number }[]
  currentLeader: { teamId: string; purse: number }
  playersStillNeeded?: number | undefined   // rough count of remaining squad slots to fill
}

export interface FightOrFoldLLMResponse {
  stretchBid: boolean
  newCeiling: number      // hard updated ceiling if stretching; = personalCeiling if folding
  ownerComment: string
  reasoning: string
}

export function buildFightOrFoldMessages(ctx: FightOrFoldContext): ChatMessage[] {
  const { persona, player, currentBid, personalCeiling, teamState, activeBidders, currentLeader, playersStillNeeded } = ctx
  const gap           = currentBid - personalCeiling
  const ownPurseAfter = teamState.currentPurse - currentBid
  const maxStretch    = +(personalCeiling * 1.28).toFixed(2)  // absolute stretch cap for the LLM

  // Emotional pull factors
  const isFormerPlayer  = player.previousTeam === persona.teamId
  const isRTMCandidate  = player.rtmEligibleFor === persona.teamId
  const isCapped        = player.cappedStatus === 'capped'

  // Role scarcity in current squad
  const roleCount = teamState.squad.filter(p => p.role === player.role).length
  const roleScarcity = player.role === 'WK'
    ? roleCount === 0 ? 'SOLE — no wicketkeeper yet' : 'covered'
    : roleCount <= 1 ? 'thin — only 1 or fewer in squad' : roleCount <= 3 ? 'adequate' : 'deep'

  // Emotional context lines
  const emotionLines: string[] = []
  if (isFormerPlayer)  emotionLines.push(`⭐ FORMER ${persona.teamId} PLAYER — strong loyalty pull, the crowd loves them`)
  if (isRTMCandidate)  emotionLines.push(`⭐ RTM CANDIDATE — you fought to keep them before, there's history here`)
  if (isCapped && !player.isOverseas) emotionLines.push(`Capped Indian — high fan value, franchise prestige at stake`)
  if (player.isOverseas) emotionLines.push(`Overseas slot: using one of your 8 overseas spots on them`)

  const emotionBlock = emotionLines.length > 0
    ? `EMOTIONAL FACTORS:\n${emotionLines.map(l => `  ${l}`).join('\n')}`
    : 'No special emotional connection to this player.'

  const budgetWarning = ownPurseAfter < 20 && (playersStillNeeded ?? 0) > 5
    ? `⚠️ BUDGET ALERT: After this bid you'd have ₹${ownPurseAfter.toFixed(1)}Cr left for ~${playersStillNeeded} more players needed. Stretching here may cripple rest of auction.`
    : ''

  const rivalRead = activeBidders.length === 0
    ? `Only ${currentLeader.teamId} remains — one bid could end this.`
    : activeBidders.length === 1
    ? `Two rivals left including ${currentLeader.teamId}. Winnable if you stay.`
    : `${activeBidders.length + 1} teams still in — stretching here may not end the war.`

  const bidderLines = [
    `  ${currentLeader.teamId} (leader): ₹${currentLeader.purse.toFixed(0)}Cr left`,
    ...activeBidders.map(b => `  ${b.teamId}: ₹${b.purse.toFixed(0)}Cr left`),
  ].join('\n')

  return [
    {
      role: 'system',
      content: `You are the owner of ${persona.displayName} at the IPL ${player.role === 'WK' ? '— wicketkeeper' : ''} auction.

${persona.llmPersonaPrompt}

You have hit your valuation ceiling on ${player.name}. Decide: stretch emotionally, or accept the loss.

PLAYER: ${player.name} | ${player.role} | ${player.cappedStatus} | ${player.isOverseas ? `Overseas (${player.country})` : 'Indian'}
YOUR CEILING: ₹${personalCeiling.toFixed(1)}Cr | BID TO MATCH: ₹${currentBid.toFixed(1)}Cr | GAP: ₹${gap.toFixed(1)}Cr above ceiling
PURSE AFTER BID: ₹${ownPurseAfter.toFixed(1)}Cr | SQUAD ROLE (${player.role}): ${roleScarcity}
${budgetWarning}

${emotionBlock}

RIVALS IN THIS BID:
${bidderLines}
${rivalRead}

STRETCH RULES:
- newCeiling MUST NOT exceed ₹${maxStretch}Cr (28% above your valuation — beyond this you are being irrational)
- A small gap (₹0–1.5 Cr) + emotional pull + rival nearly broke → stretch makes sense
- A large gap (₹3+ Cr) + multiple deep rivals + no emotional pull → fold and save purse
- You can ONLY stretch once. After this, the next bid will cause a permanent pass.

Persona emotional triggers: ${persona.emotionalTriggers.join(', ')}

Respond with ONLY a valid JSON object.`,
    },
    {
      role: 'user',
      content: `Fight or fold for ${player.name}? (gap: ₹${gap.toFixed(1)}Cr, ${activeBidders.length + 1} rival(s) left)

${isFormerPlayer || isRTMCandidate
  ? `{"stretchBid":true,"newCeiling":${Math.min(currentBid + 0.5, maxStretch).toFixed(1)},"ownerComment":"He's ours — one more.","reasoning":"Former player, gap is small, crowd expects it."}`
  : `{"stretchBid":false,"newCeiling":${personalCeiling.toFixed(1)},"ownerComment":"We've gone as far as we can.","reasoning":"Gap too large and rivals have deep pockets."}`
}`,
    },
  ]
}

// ─── RTM prompt ───────────────────────────────────────────────────────────────

export interface RTMPromptContext {
  persona: FranchisePersona
  player: PlayerRecord
  teamState: TeamState
  rtmPrice: number
  auctionYear: number
}

export interface RTMLLMResponse {
  exercisesRTM: boolean
  ownerComment: string
  reasoning: string
}

export function buildRTMMessages(ctx: RTMPromptContext): ChatMessage[] {
  const { persona, player, teamState, rtmPrice } = ctx
  const purse = teamState.currentPurse.toFixed(1)

  return [
    {
      role: 'system',
      content: `You are the owner of ${persona.displayName} at the IPL auction.

${persona.llmPersonaPrompt}

PURSE REMAINING: ₹${purse} Cr
IMPORTANT: Your entire response must be a single valid JSON object. No markdown, no code blocks — just raw JSON starting with { and ending with }.`,
    },
    {
      role: 'user',
      content: `RIGHT TO MATCH OPPORTUNITY:
Player: ${player.name}
Role: ${player.role}
Was your player: ${player.previousTeam === persona.teamId ? 'YES — they played for you last season' : 'They had RTM rights but were not core squad'}
RTM Price: ₹${rtmPrice.toFixed(2)} Cr (you match this bid exactly)
Your purse after RTM: ₹${(teamState.currentPurse - rtmPrice).toFixed(1)} Cr remaining

Do you exercise your Right to Match?
{"exercisesRTM":true,"ownerComment":"He's ours — we match!","reasoning":"Integral to our plans and we can afford it."}`,
    },
  ]
}

// ─── Trade prompt ─────────────────────────────────────────────────────────────

export interface TradePromptContext {
  persona: FranchisePersona
  offeredProfiles: PlayerImportanceProfile[]
  requestedProfiles: PlayerImportanceProfile[]
  cashDelta: number
  teamState: TeamState
}

export interface TradeLLMResponse {
  accepts: boolean
  counterOffer: string | null
  counterOfferStructured: {
    playersToOffer: string[]
    playersToRequest: string[]
    cashAdjustment: number
  } | null
  ownerComment: string
  reasoning: string
}

export function buildTradeMessages(ctx: TradePromptContext): ChatMessage[] {
  const { persona, offeredProfiles, requestedProfiles, cashDelta, teamState } = ctx
  const purse = teamState.currentPurse.toFixed(1)

  const totalOffered   = offeredProfiles.reduce((s, p) => s + p.player.soldPrice, 0) + Math.max(0, cashDelta)
  const totalRequested = requestedProfiles.reduce((s, p) => s + p.player.soldPrice, 0) + Math.max(0, -cashDelta)
  const valueDiff      = totalOffered - totalRequested

  const fmtProfile = (p: PlayerImportanceProfile) => [
    `  ▸ ${p.player.name} | ${p.player.role} | Retained ₹${p.player.soldPrice.toFixed(1)} Cr | Importance: ${p.importanceScore}/100`,
    `    ${p.roleLabel}`,
    `    ${p.loyaltyLabel}`,
    p.importanceScore >= 80 ? `    ⭐ FRANCHISE PILLAR — extremely high importance to this squad` : '',
  ].filter(Boolean).join('\n')

  const avgImportanceOut = requestedProfiles.length > 0
    ? Math.round(requestedProfiles.reduce((s, p) => s + p.importanceScore, 0) / requestedProfiles.length)
    : 0
  const avgImportanceIn  = offeredProfiles.length > 0
    ? Math.round(offeredProfiles.reduce((s, p) => s + p.importanceScore, 0) / offeredProfiles.length)
    : 0

  // Detect deal type
  const isCashOnly    = offeredProfiles.length === 0 && cashDelta > 0   // someone paying cash for our player
  const isPlayerOnly  = offeredProfiles.length > 0 && cashDelta === 0   // pure player swap
  const isMixed       = offeredProfiles.length > 0 && cashDelta !== 0   // players + cash

  // Sole-role gap — only alert if incoming player doesn't cover the role
  const soleRoleGap = requestedProfiles.filter(p =>
    p.roleCriticality === 'sole' &&
    !offeredProfiles.some(q => q.player.role === p.player.role)
  )
  const captainLeaving = requestedProfiles.filter(p =>
    p.captaincyRole === 'captain' || p.captaincyRole === 'vice-captain'
  )
  const pillarsLeaving = requestedProfiles.filter(p => p.importanceScore >= 80)

  const dealbreakers: string[] = []
  if (captainLeaving.length > 0)
    dealbreakers.push(`🔴 CAPTAIN LEAVING: ${captainLeaving.map(p => p.player.name).join(', ')} — franchise leadership crisis`)
  if (soleRoleGap.length > 0)
    dealbreakers.push(`⚠️ ROLE GAP: Losing ${soleRoleGap.map(p => `${p.player.name} (${p.player.role})`).join(', ')} with no cover incoming`)
  if (pillarsLeaving.length > 0)
    dealbreakers.push(`🔴 FRANCHISE PILLAR(S) LEAVING: ${pillarsLeaving.map(p => p.player.name).join(', ')} — these players define your franchise identity`)


  // Fairness assessment (player trades)
  const isFair = Math.abs(valueDiff) <= 4 && avgImportanceIn >= avgImportanceOut - 12
  const fairnessLine = isCashOnly ? '' :
    isFair && isPlayerOnly
      ? `✅ FAIR PLAYER SWAP: Values and importance are comparable. Accept if role fit works.`
      : valueDiff < -10
      ? `🔴 LOPSIDED VALUE: You give ₹${Math.abs(valueDiff).toFixed(1)} Cr more than you receive. Reject or counter with better offer.`
      : valueDiff > 6
      ? `✅ VALUE WIN: You receive ₹${valueDiff.toFixed(1)} Cr more than you give. Good deal for your side.`
      : isMixed && valueDiff >= -4
      ? `✅ FAIR MIXED DEAL: Cash sweetener makes this close to fair value.`
      : `⚠️ SLIGHTLY UNEVEN: ₹${Math.abs(valueDiff).toFixed(1)} Cr ${valueDiff < 0 ? 'against' : 'in your favour'}. Accept if the role fit strongly justifies it.`

  const ourSquadNames = teamState.squad.map(p => `${p.name}(${p.role})`).join(', ')

  return [
    {
      role: 'system',
      content: `You are the owner of ${persona.displayName} — one of the 10 IPL franchises.

${persona.llmPersonaPrompt}

YOUR RETAINED SQUAD: ${ourSquadNames}
Purse: ₹${purse} Cr

This is the PRE-AUCTION trade window. Retention prices are what you paid, not a player's real market value.

HOW TO DECIDE:
• Player-for-player swaps: accept when value is roughly equal (within ₹5 Cr) and the incoming player fits your squad or style. Loyalty matters emotionally but a genuinely good swap improves your franchise — don't refuse fair deals.
• Cash-for-your-player: demand a real premium above retention price. Stars retained at ₹14 Cr+ are worth ₹20–25 Cr on the open market — price accordingly. Counter with your actual ask rather than flat rejecting.
• Mixed (player + cash): judge on total incoming value vs what you lose.
• Hard limits: don't trade your sole wicketkeeper without getting one back; don't accept >₹10 Cr value gap against you.

Counter offers: exact player names from the squads above only. Keep counters simple.
Respond with ONLY valid JSON.`,
    },
    {
      role: 'user',
      content: `TRADE PROPOSAL:

YOU GIVE UP:
${requestedProfiles.length > 0 ? requestedProfiles.map(fmtProfile).join('\n') : '  (nothing)'}${cashDelta < 0 ? `\n  + ₹${Math.abs(cashDelta).toFixed(1)} Cr cash` : ''}

YOU RECEIVE:
${offeredProfiles.length > 0 ? offeredProfiles.map(fmtProfile).join('\n') : '  (cash only — no players)'}${cashDelta > 0 ? `\n  + ₹${cashDelta.toFixed(1)} Cr cash` : ''}

Value out: ₹${totalRequested.toFixed(1)} Cr | Value in: ₹${totalOffered.toFixed(1)} Cr | Net: ${valueDiff >= 0 ? '+' : ''}₹${valueDiff.toFixed(1)} Cr
Importance out: ${avgImportanceOut}/100 | Importance in: ${avgImportanceIn}/100
${isCashOnly ? `\nThis is a cash-only offer. The offered ₹${cashDelta.toFixed(1)} Cr is ${cashDelta < requestedProfiles.reduce((s,p)=>s+p.player.soldPrice,0)*1.3 ? 'below your minimum premium — counter with a higher number' : 'approaching acceptable — consider accepting or countering slightly'}.` : ''}
${fairnessLine}
${dealbreakers.length > 0 ? dealbreakers.join('\n') : ''}

React as the real owner. ownerComment: 1–2 vivid in-character sentences. counterOfferStructured: null unless you have a realistic counter using exact squad names.

{"accepts":true,"counterOffer":null,"counterOfferStructured":null,"ownerComment":"This works — different profiles but we both upgrade our balance.","reasoning":"Near-equal value swap, incoming player fills a gap."}`,
    },
  ]
}

// ─── Squad Analysis prompt ────────────────────────────────────────────────────

export interface SquadAnalysisContext {
  teamId: string
  auctionYear: number
  squad: {
    name: string
    role: string
    country: string
    soldPrice: number
    isOverseas: boolean
    cappedStatus: string
    isRetained: boolean
  }[]
  allSquads: Record<string, { name: string; role: string; soldPrice: number }[]>
}

export function buildSquadAnalysisMessages(ctx: SquadAnalysisContext): ChatMessage[] {
  const squadText = ctx.squad
    .map((p, i) =>
      `${i + 1}. ${p.name} [${p.role}] ${p.isOverseas ? '(Overseas)' : '(Indian)'} ${p.cappedStatus === 'capped' ? 'Capped' : 'Uncapped'} ₹${p.soldPrice.toFixed(1)}Cr${p.isRetained ? ' [Retained]' : ''}`
    )
    .join('\n')

  const leagueText = Object.entries(ctx.allSquads)
    .filter(([tid]) => tid !== ctx.teamId)
    .map(([tid, sq]) => `${tid}: ${sq.map(p => `${p.name}(${p.role})`).join(', ')}`)
    .join('\n')

  return [
    {
      role: 'system',
      content: `You are a sharp IPL cricket analyst. Evaluate squads built in the GPL ${ctx.auctionYear} auction. Be direct and specific. Pick the best XI for T20 cricket. Respond ONLY with valid JSON matching this exact schema: { "bestXI": [{"name":string,"role":string,"reason":string}], "twelfthMan": {"name":string,"role":string,"reason":string}|null, "strengths": string[], "weaknesses": string[], "roleGaps": string[], "analystNote": string }. Exactly 11 players in bestXI. Max 4 items each in strengths/weaknesses. roleGaps contains role codes (BAT/BWL/AR/WK) that are thin or missing. Each reason is one short sentence. analystNote is 2–3 sentences.`,
    },
    {
      role: 'user',
      content: `Analyze the ${ctx.teamId} squad from GPL ${ctx.auctionYear}:\n\n${squadText}\n\nIPL rules: max 4 overseas players in the playing XI, 11 players total.\n\nLeague context (other teams for comparison):\n${leagueText}\n\nPick the best XI, name a 12th man, list strengths, weaknesses, any role gaps, and give an overall analyst verdict.`,
    },
  ]
}
