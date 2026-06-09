import {
  AgentManifest,
  AgentManifestInput,
  AuthorityLevel,
  AUTHORITY_ORDER,
  CreateAgentOptions,
} from './types.js'
import { authorityIndex } from './authority.js'

function clampAuthority(
  requested: AuthorityLevel,
  ceiling: AuthorityLevel
): AuthorityLevel {
  return authorityIndex(requested) <= authorityIndex(ceiling) ? requested : ceiling
}

function validateManifest(input: AgentManifestInput): void {
  if (typeof input.id !== 'string' || input.id.trim() === '') {
    throw new Error('AgentManifest: `id` must be a non-empty string')
  }
  if (typeof input.role !== 'string' || input.role.trim() === '') {
    throw new Error('AgentManifest: `role` must be a non-empty string')
  }
  if (!Array.isArray(input.skills)) {
    throw new Error('AgentManifest: `skills` must be an array')
  }
  if (!AUTHORITY_ORDER.includes(input.authority)) {
    throw new Error(
      `AgentManifest: \`authority\` must be one of: ${AUTHORITY_ORDER.join(', ')}`
    )
  }
}

export function createAgent(
  input: AgentManifestInput,
  options: CreateAgentOptions = {}
): AgentManifest {
  validateManifest(input)

  const authority = options.parent
    ? clampAuthority(input.authority, options.parent.authority)
    : input.authority

  const parentId = options.parent?.id ?? input.parentId
  const manifest: AgentManifest = {
    ...input,
    authority,
    createdAt: new Date().toISOString(),
  }
  if (parentId !== undefined) manifest.parentId = parentId
  return manifest
}

export function createChildAgent(
  input: Omit<AgentManifestInput, 'parentId'>,
  parent: AgentManifest
): AgentManifest {
  return createAgent({ ...input, parentId: parent.id }, { parent })
}
