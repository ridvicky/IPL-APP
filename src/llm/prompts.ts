/**
 * Prompt builders for each LLM use case.
 * Each builder returns a messages array ready for callLLMJson().
 */

import type { ChatMessage } from './openRouterClient'
import type { PlayerRecord } from '@/types/player'
import type { TeamState } from '@/types/team'
import type { FranchisePersona } from '@/types/team'
import type { PlayerImportanceProfile } from '@/engine/playerImportance'

// ─── Bidding prompt ───────────────────────────────────────────────────────────

export interface BiddingPromptContext {
  persona: FranchisePersona
  player: PlayerRecord
  teamState: TeamState
  currentBid: number
  auctionYear: number
  setName: string
  soldCount: number
}

/** Expected JSON shape returned by the bidding LLM call */
export interface BiddingLLMResponse {
  interestLevel: number        // 0–100
  suggestedMaxBid: number      // in Cr — advisory, capped by Rule Engine
  emotionalTriggers: string[]  // 1–3 short phrases e.g. ["former CSK player"]
  ownerComment: string         // 1 punchy sentence shown in auction room UI
  reasoning: string            // internal — not shown to user
}

export function buildBiddingMessages(ctx: BiddingPromptContext): ChatMessage[] {
  const { persona, player, teamState, currentBid, auctionYear, setName } = ctx

  const squadRoles = teamState.squad.map(p => p.role)
  const roleCount = (r: string) => squadRoles.filter(x => x === r).length

  const squadSummary = `WK:${roleCount('WK')} BAT:${roleCount('BAT')} AR:${roleCount('AR')} BWL:${roleCount('BWL')}`
  const purse = teamState.currentPurse.toFixed(1)
  const overseas = teamState.overseasCount

  return [
    {
      role: 'system',
      content: `You are the owner/decision-maker of ${persona.displayName} at the IPL ${auctionYear} auction.

${persona.llmPersonaPrompt}

CURRENT SQUAD: ${teamState.squad.length} players — ${squadSummary}
PURSE REMAINING: ₹${purse} Cr
OVERSEAS SLOTS USED: ${overseas}/8
AUCTION SET: ${setName}

IPL AUCTION PRICING REALITY (critical for suggestedMaxBid):
- Base price is just the starting bid floor, NOT a fair value indicator
- Capped Indian batters/allrounders: routinely sell for 8–25× base price
- Top overseas players: 10–20× base price is normal
- Uncapped Indian youngsters: 3–10× if high potential
- A ₹2 Cr base price player CAN and DOES sell for ₹20–30 Cr in real IPL auctions
- If you want a player, suggestedMaxBid should reflect real IPL valuation (minimum 5× base price for any player you want)
- Only set suggestedMaxBid below 4× base if you genuinely have low interest or tight purse

IMPORTANT: Your entire response must be a single valid JSON object. No markdown, no code blocks, no explanation — just raw JSON starting with { and ending with }.`,
    },
    {
      role: 'user',
      content: `PLAYER UP FOR AUCTION:
Name: ${player.name}
Role: ${player.role}${player.role === 'BWL' ? '' : ''}
Nationality: ${player.isOverseas ? `Overseas (${player.country})` : `Indian (${player.country})`}
Status: ${player.cappedStatus === 'capped' ? 'Capped international' : 'Uncapped'}
Previous team: ${player.previousTeam ?? 'None'}
Base price: ₹${player.basePrice.toFixed(2)} Cr
Current bid: ₹${currentBid.toFixed(2)} Cr

Decide how much you want this player. Remember: in IPL auctions, top players sell for 10–25× base price. Set suggestedMaxBid realistically — if you want this player, bid accordingly.

Respond with this exact JSON structure (no other text):
{
  "interestLevel": 75,
  "suggestedMaxBid": 18.5,
  "emotionalTriggers": ["former player", "bowling need"],
  "ownerComment": "We want him back in blue!",
  "reasoning": "He fills our pace bowling gap and has IPL experience."
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

Do you exercise your Right to Match? Respond with this exact JSON (no other text):
{
  "exercisesRTM": true,
  "ownerComment": "He's ours — we match!",
  "reasoning": "He was integral to our plans last season and we can afford it."
}`,
    },
  ]
}

// ─── Trade prompt ─────────────────────────────────────────────────────────────

export interface TradePromptContext {
  persona: FranchisePersona
  // Players arriving to proposedTo (they receive these)
  offeredProfiles: PlayerImportanceProfile[]
  // Players leaving proposedTo (they give these up)
  requestedProfiles: PlayerImportanceProfile[]
  cashDelta: number   // positive = we receive cash
  teamState: TeamState
}

export interface TradeLLMResponse {
  accepts: boolean
  counterOffer: string | null
  ownerComment: string
  reasoning: string
}

export function buildTradeMessages(ctx: TradePromptContext): ChatMessage[] {
  const { persona, offeredProfiles, requestedProfiles, cashDelta, teamState } = ctx
  const purse = teamState.currentPurse.toFixed(1)

  const totalOffered   = offeredProfiles.reduce((s, p) => s + p.player.soldPrice, 0) + Math.max(0, cashDelta)
  const totalRequested = requestedProfiles.reduce((s, p) => s + p.player.soldPrice, 0) + Math.max(0, -cashDelta)
  const valueDiff = totalOffered - totalRequested

  const fmtProfile = (p: PlayerImportanceProfile) => [
    `  ▸ ${p.player.name} [Importance: ${p.importanceScore}/100]`,
    `    ${p.marketLabel}`,
    `    Role: ${p.roleLabel}`,
    `    Loyalty: ${p.loyaltyLabel}`,
    `    Star power: ${p.starLabel}`,
    p.importanceScore >= 60 ? `    ⚡ ${p.fanbaseNote}` : '',
    p.marketTier === 'elite' || p.marketTier === 'star'
      ? `    Replacement cost at re-auction: ~₹${p.replacementCost.toFixed(1)} Cr`
      : '',
  ].filter(Boolean).join('\n')

  const highValueLeaving = requestedProfiles.filter(p => p.marketTier === 'elite' || p.marketTier === 'star')
  const iconLeaving      = requestedProfiles.filter(p => p.loyaltyTier === 'icon' || p.loyaltyTier === 'loyal')
  const soleRoleLeaving  = requestedProfiles.filter(p => p.roleCriticality === 'sole')
  const avgImportance    = requestedProfiles.length > 0
    ? Math.round(requestedProfiles.reduce((s, p) => s + p.importanceScore, 0) / requestedProfiles.length)
    : 0

  const alerts: string[] = []
  if (highValueLeaving.length > 0)
    alerts.push(`🔴 STAR LEAVING: ${highValueLeaving.map(p => `${p.player.name} (₹${p.player.soldPrice.toFixed(1)} Cr)`).join(', ')} — these are not replaceable players`)
  if (iconLeaving.length > 0)
    alerts.push(`💛 LOYALTY BOND: ${iconLeaving.map(p => p.player.name).join(', ')} — retained/RTM signing, franchise-level emotional connection`)
  if (soleRoleLeaving.length > 0)
    alerts.push(`⚠️  SQUAD CRISIS: Losing ${soleRoleLeaving.map(p => p.player.name).join(', ')} leaves a role with NO cover in your squad`)

  return [
    {
      role: 'system',
      content: `You are the owner of ${persona.displayName} — one of the 10 IPL franchises.

${persona.llmPersonaPrompt}

This is the pre-auction TRADE WINDOW. Trades here are SEASON-DEFINING. Every player has:
- Auction history (what you paid)
- Squad role (can anyone else fill this position?)
- Loyalty tier (retained icons vs new signings)
- Star power (fanbase, commercial value, media presence)
- Replacement cost (what it'd cost to find someone equivalent at re-auction)

YOUR DECISION FRAMEWORK (follow strictly based on your style "${persona.auctionStyle}"):
- NEVER give away a player with importance ≥70 without receiving equivalent or higher value
- NEVER leave a sole role (WK, only pacer, etc.) without a replacement in the squad
- Retained/RTM players have maximum loyalty — losing them is a franchise wound, not just a numbers decision
- If value difference is >₹6 Cr against you, reject unless squad fit is exceptional AND you're getting younger/better

Squad: ${teamState.squad.length} players. Purse left: ₹${purse} Cr.

Respond with ONLY a JSON object. No markdown, no prose outside JSON.`,
    },
    {
      role: 'user',
      content: `TRADE PROPOSAL — evaluate every dimension carefully:

━━━━━━━━━━━━━━━━━━━━━━━━
YOU GIVE UP (avg importance: ${avgImportance}/100)
━━━━━━━━━━━━━━━━━━━━━━━━
${requestedProfiles.map(fmtProfile).join('\n\n')}${cashDelta < 0 ? `\n\n  + ₹${Math.abs(cashDelta).toFixed(1)} Cr from your purse` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━
YOU RECEIVE
━━━━━━━━━━━━━━━━━━━━━━━━
${offeredProfiles.map(fmtProfile).join('\n\n')}${cashDelta > 0 ? `\n\n  + ₹${cashDelta.toFixed(1)} Cr cash into your purse` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━
ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━
Auction value leaving:  ₹${totalRequested.toFixed(1)} Cr
Auction value arriving: ₹${totalOffered.toFixed(1)} Cr
Net:                    ${valueDiff >= 0 ? '+' : ''}₹${valueDiff.toFixed(1)} Cr ${valueDiff >= 0 ? '(you gain)' : '(you LOSE)'}

${alerts.length > 0 ? alerts.join('\n') : '✅ No major red flags — this deal is worth considering on numbers.'}

━━━━━━━━━━━━━━━━━━━━━━━━
YOUR RESPONSE
━━━━━━━━━━━━━━━━━━━━━━━━
React as the real owner of ${persona.displayName}. Be territorial, emotional where appropriate, analytical if that's your style.
The ownerComment should be vivid and in-character — the kind of thing a real IPL owner would say in the auction room.
The reasoning should be 2–4 sentences explaining your actual thinking.
If rejecting, counterOffer should be a specific ask ("give us a pacer + ₹2 Cr", not just "better offer").

{"accepts":false,"counterOffer":"Add a quality death bowler and we'll revisit","ownerComment":"You want our backbone for this package? Not happening. Come back with something that respects what he means to this team.","reasoning":"This player is central to our batting plans and was retained at significant cost. The value offered doesn't come close, and our squad has no cover at this role. We'd rather go into the auction needing cash than needing a batter of this calibre."}`,
    },
  ]
}
