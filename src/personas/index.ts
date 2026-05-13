import type { FranchisePersona } from '@/types/team'
import { CSK_PERSONA } from './csk'
import { MI_PERSONA } from './mi'
import { RCB_PERSONA } from './rcb'
import { KKR_PERSONA } from './kkr'
import { DC_PERSONA } from './dc'
import { RR_PERSONA } from './rr'
import { SRH_PERSONA } from './srh'
import { PBKS_PERSONA } from './pbks'
import { GT_PERSONA } from './gt'
import { LSG_PERSONA } from './lsg'

export const ALL_PERSONAS: Record<string, FranchisePersona> = {
  CSK: CSK_PERSONA,
  MI: MI_PERSONA,
  RCB: RCB_PERSONA,
  KKR: KKR_PERSONA,
  DC: DC_PERSONA,
  RR: RR_PERSONA,
  SRH: SRH_PERSONA,
  PBKS: PBKS_PERSONA,
  GT: GT_PERSONA,
  LSG: LSG_PERSONA,
}

export function getPersona(teamId: string): FranchisePersona {
  const persona = ALL_PERSONAS[teamId]
  if (!persona) throw new Error(`No persona found for team ${teamId}`)
  return persona
}

export {
  CSK_PERSONA, MI_PERSONA, RCB_PERSONA, KKR_PERSONA, DC_PERSONA,
  RR_PERSONA, SRH_PERSONA, PBKS_PERSONA, GT_PERSONA, LSG_PERSONA,
}
