import { AgentManifest, MemoryScope, AuthorityLevel, AUTHORITY_ORDER } from './types.js'

const MEMORY_SCOPES: MemoryScope[] = ['working', 'episodic', 'semantic']

export function isAgentManifest(value: unknown): value is AgentManifest {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v['id'] === 'string' &&
    v['id'].length > 0 &&
    typeof v['role'] === 'string' &&
    v['role'].length > 0 &&
    Array.isArray(v['skills']) &&
    (v['skills'] as unknown[]).every(s => typeof s === 'string') &&
    MEMORY_SCOPES.includes(v['memoryScope'] as MemoryScope) &&
    AUTHORITY_ORDER.includes(v['authority'] as AuthorityLevel) &&
    typeof v['createdAt'] === 'string'
  )
}
