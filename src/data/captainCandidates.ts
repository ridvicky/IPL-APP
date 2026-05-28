/**
 * Multi-dimensional captaincy scoring.
 * Five dimensions: international captain, franchise captain (all global leagues),
 * domestic captain, U19 captain, experience factor (derived from market value / potential).
 * Composite score 0–100 computed by getCaptainScore().
 */

export interface CaptainProfile {
  intlCaptain: number       // 1.0 = current/former national captain, 0.5 = vice-captain, 0
  franchiseCaptain: number  // 1.0 = multi-franchise captain, 0.7 = single franchise, 0.4 = vice-cap, 0
  domesticCaptain: number   // 1.0 = captained state/Ranji, 0.5 = led domestic side briefly, 0
  u19Captain: number        // 1.0 = captained national U19, 0
  experienceFactor: number  // capped: min(1, mv/20) | uncapped: potential/10 × 0.5
}

/** Weighted composite — intl(35) + franchise(30) + domestic(15) + u19(10) + experience(10) */
export function getCaptainScore(profile: CaptainProfile): number {
  return (
    profile.intlCaptain     * 35 +
    profile.franchiseCaptain * 30 +
    profile.domesticCaptain  * 15 +
    profile.u19Captain       * 10 +
    profile.experienceFactor * 10
  )
}

export const CAPTAIN_CANDIDATES: Record<string, CaptainProfile> = {
  // ── Elite captains (composite 75–100) ───────────────────────────────────────
  'virat-kohli':        { intlCaptain: 1.0, franchiseCaptain: 1.0, domesticCaptain: 1.0, u19Captain: 1.0, experienceFactor: 1.0 }, // India + RCB + Delhi + U19
  'rohit-sharma':       { intlCaptain: 1.0, franchiseCaptain: 1.0, domesticCaptain: 1.0, u19Captain: 0,   experienceFactor: 1.0 }, // India + MI + Mumbai
  'ms-dhoni':           { intlCaptain: 1.0, franchiseCaptain: 1.0, domesticCaptain: 1.0, u19Captain: 0,   experienceFactor: 1.0 }, // India + CSK/RPS + Jharkhand
  'pat-cummins':        { intlCaptain: 1.0, franchiseCaptain: 1.0, domesticCaptain: 0,   u19Captain: 0,   experienceFactor: 0.9 }, // Australia + KKR/SRH
  'faf-du-plessis':     { intlCaptain: 1.0, franchiseCaptain: 1.0, domesticCaptain: 0,   u19Captain: 0,   experienceFactor: 0.8 }, // SA + RCB/CSK
  'david-warner':       { intlCaptain: 1.0, franchiseCaptain: 1.0, domesticCaptain: 0,   u19Captain: 0,   experienceFactor: 0.8 }, // Australia + SRH/DC/Strikers
  'jos-buttler':        { intlCaptain: 1.0, franchiseCaptain: 1.0, domesticCaptain: 0,   u19Captain: 0,   experienceFactor: 0.8 }, // England + RR
  'shreyas-iyer':       { intlCaptain: 0.5, franchiseCaptain: 1.0, domesticCaptain: 1.0, u19Captain: 0,   experienceFactor: 0.7 }, // India stand-in + DC/KKR + Mumbai
  'kl-rahul':           { intlCaptain: 0.5, franchiseCaptain: 1.0, domesticCaptain: 0.5, u19Captain: 0,   experienceFactor: 0.8 }, // India stand-in + LSG
  'hardik-pandya':      { intlCaptain: 0.5, franchiseCaptain: 1.0, domesticCaptain: 0,   u19Captain: 0,   experienceFactor: 0.9 }, // India T20I + GT/MI
  'sanju-samson':       { intlCaptain: 0.5, franchiseCaptain: 1.0, domesticCaptain: 1.0, u19Captain: 0,   experienceFactor: 0.7 }, // India T20I stand-in + RR + Kerala
  'rishabh-pant':       { intlCaptain: 0,   franchiseCaptain: 1.0, domesticCaptain: 1.0, u19Captain: 1.0, experienceFactor: 0.9 }, // DC captain + Delhi + India U19
  'shubman-gill':       { intlCaptain: 0.5, franchiseCaptain: 1.0, domesticCaptain: 0.5, u19Captain: 1.0, experienceFactor: 0.7 }, // India stand-in + GT + Punjab + U19
  'ruturaj-gaikwad':    { intlCaptain: 0.5, franchiseCaptain: 1.0, domesticCaptain: 1.0, u19Captain: 0,   experienceFactor: 0.6 }, // India T20I stand-in + CSK + Maharashtra

  // ── Strong candidates (composite 40–74) ──────────────────────────────────────
  'ravindra-jadeja':    { intlCaptain: 0.5, franchiseCaptain: 0.7, domesticCaptain: 1.0, u19Captain: 0,   experienceFactor: 0.8 }, // CSK acting captain + Saurashtra
  'suryakumar-yadav':   { intlCaptain: 0.5, franchiseCaptain: 0.4, domesticCaptain: 0.5, u19Captain: 0,   experienceFactor: 0.7 }, // India T20I captain
  'quinton-de-kock':    { intlCaptain: 0.5, franchiseCaptain: 0.7, domesticCaptain: 0,   u19Captain: 0,   experienceFactor: 0.7 }, // SA limited-overs captain + MI/LSG
  'travis-head':        { intlCaptain: 0,   franchiseCaptain: 0.4, domesticCaptain: 0.5, u19Captain: 0,   experienceFactor: 0.8 }, // SA20 Capitals + Strikers domestic
  'axar-patel':         { intlCaptain: 0,   franchiseCaptain: 0.4, domesticCaptain: 1.0, u19Captain: 0,   experienceFactor: 0.6 }, // Gujarat domestic + DC vice-cap
  'krunal-pandya':      { intlCaptain: 0,   franchiseCaptain: 0.7, domesticCaptain: 1.0, u19Captain: 0,   experienceFactor: 0.5 }, // LSG/MI + Baroda domestic
  'venkatesh-iyer':     { intlCaptain: 0,   franchiseCaptain: 0.4, domesticCaptain: 1.0, u19Captain: 0,   experienceFactor: 0.5 }, // KKR + MP domestic
  'ishan-kishan':       { intlCaptain: 0,   franchiseCaptain: 0.4, domesticCaptain: 1.0, u19Captain: 1.0, experienceFactor: 0.6 }, // MI + Jharkhand + India U19
  'ravichandaran-ashwin': { intlCaptain: 0, franchiseCaptain: 0.4, domesticCaptain: 1.0, u19Captain: 0,   experienceFactor: 1.0 }, // TN senior leader long tenure
  'deepak-hooda':       { intlCaptain: 0,   franchiseCaptain: 0.4, domesticCaptain: 1.0, u19Captain: 0,   experienceFactor: 0.5 }, // Baroda domestic captain
  'rajat-patidar':      { intlCaptain: 0,   franchiseCaptain: 0.4, domesticCaptain: 1.0, u19Captain: 0,   experienceFactor: 0.5 }, // MP domestic + RCB
  'rinku-singh':        { intlCaptain: 0,   franchiseCaptain: 0.4, domesticCaptain: 0.5, u19Captain: 0,   experienceFactor: 0.4 }, // KKR vice-cap + UP domestic
  'heinrich-klaasen':   { intlCaptain: 0,   franchiseCaptain: 0.7, domesticCaptain: 0,   u19Captain: 0,   experienceFactor: 0.6 }, // SA T20 + SRH + SA20 franchise
  'sam-curran':         { intlCaptain: 0,   franchiseCaptain: 0.7, domesticCaptain: 0,   u19Captain: 0,   experienceFactor: 0.5 }, // PBKS franchise captain 2024
  'jasprit-bumrah':     { intlCaptain: 0.5, franchiseCaptain: 0,   domesticCaptain: 0,   u19Captain: 0,   experienceFactor: 0.9 }, // India Test captain (one match)
  'liam-livingstone':   { intlCaptain: 0,   franchiseCaptain: 0.4, domesticCaptain: 0.5, u19Captain: 0,   experienceFactor: 0.5 }, // Lancashire domestic
  'shardul-thakur':     { intlCaptain: 0,   franchiseCaptain: 0,   domesticCaptain: 1.0, u19Captain: 0,   experienceFactor: 0.5 }, // Mumbai domestic senior leader

  // ── Emerging captains (composite 15–39) ──────────────────────────────────────
  'yashasvi-jaiswal':   { intlCaptain: 0,   franchiseCaptain: 0,   domesticCaptain: 0.5, u19Captain: 1.0, experienceFactor: 0.4 }, // India U19 + Mumbai domestic
  'tilak-varma':        { intlCaptain: 0,   franchiseCaptain: 0,   domesticCaptain: 0.5, u19Captain: 1.0, experienceFactor: 0.4 }, // India U19 captain + HCA
  'riyan-parag':        { intlCaptain: 0,   franchiseCaptain: 0.4, domesticCaptain: 1.0, u19Captain: 1.0, experienceFactor: 0.4 }, // Assam domestic + India U19 + RR
  'devdutt-padikkal':   { intlCaptain: 0,   franchiseCaptain: 0,   domesticCaptain: 0.5, u19Captain: 1.0, experienceFactor: 0.4 }, // Karnataka + India U19
  'prithvi-shaw':       { intlCaptain: 0,   franchiseCaptain: 0,   domesticCaptain: 0.5, u19Captain: 1.0, experienceFactor: 0.4 }, // Mumbai domestic + India U19
  'abhishek-sharma':    { intlCaptain: 0,   franchiseCaptain: 0,   domesticCaptain: 0.5, u19Captain: 1.0, experienceFactor: 0.3 }, // India U19 + SRH
  'nitish-kumar-reddy': { intlCaptain: 0,   franchiseCaptain: 0,   domesticCaptain: 0.5, u19Captain: 0,   experienceFactor: 0.3 }, // AP domestic leader
  'washington-sundar':  { intlCaptain: 0,   franchiseCaptain: 0,   domesticCaptain: 0.5, u19Captain: 1.0, experienceFactor: 0.5 }, // TN domestic + India U19
  'vaibhav-suryavanshi':{ intlCaptain: 0,   franchiseCaptain: 0,   domesticCaptain: 0,   u19Captain: 1.0, experienceFactor: 0.2 }, // India U19 captain 2025
  'angkrish-raghuvanshi':{ intlCaptain: 0,  franchiseCaptain: 0,   domesticCaptain: 0,   u19Captain: 1.0, experienceFactor: 0.2 }, // India U19
}
