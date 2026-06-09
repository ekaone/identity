export type MemoryScope = 'working' | 'episodic' | 'semantic'

export type AuthorityLevel = 'read' | 'write' | 'execute' | 'delegate'

// Ordered lowest → highest for privilege-clamping comparisons
export const AUTHORITY_ORDER: AuthorityLevel[] = [
  'read',
  'write',
  'execute',
  'delegate',
]

export type AgentManifest = {
  id: string              // stable unique identifier, e.g. 'agent-incident-coordinator'
  role: string            // human-readable role label
  description?: string    // prose description; bridge to CLAUDE.md agent persona
  skills: string[]        // skill IDs this agent can invoke
  memoryScope: MemoryScope     // isolation level for @ekaone/memory
  authority: AuthorityLevel    // ceiling authority level; gates @ekaone/approval
  permissions?: string[]       // optional fine-grained named permissions
  maxTokenBudget?: number      // optional per-turn resource cap
  tags?: string[]              // routing filter tags for @ekaone/relay
  parentId?: string            // set by createChildAgent(); used for lineage tracking
  createdAt: string            // ISO 8601 timestamp; set at construction
}

export type AgentManifestInput = Omit<AgentManifest, 'createdAt'>

// Return type of parseManifest — includes createdAt when parsing a full serialized manifest
export type ParsedManifest = AgentManifestInput & { createdAt?: string }

export type CreateAgentOptions = {
  parent?: AgentManifest  // if provided, authority is clamped to parent.authority
}
