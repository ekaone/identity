import { AuthorityLevel, AUTHORITY_ORDER } from './types.js'

export function authorityIndex(level: AuthorityLevel): number {
  return AUTHORITY_ORDER.indexOf(level)
}

export function hasAuthority(
  agent: { authority: AuthorityLevel },
  required: AuthorityLevel
): boolean {
  return authorityIndex(agent.authority) >= authorityIndex(required)
}

export function canDelegate(
  parent: { authority: AuthorityLevel },
  child: { authority: AuthorityLevel }
): boolean {
  return authorityIndex(child.authority) <= authorityIndex(parent.authority)
}
