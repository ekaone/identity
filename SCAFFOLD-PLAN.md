# Scaffold Plan — `@ekaone/identity`

> **For Claude Code.** Root-level files already exist (`package.json`, `tsconfig.json`,
> `tsup.config.ts`, `vitest.config.ts`, `README.md`, `.gitignore`, `LICENSE`).
> **Build only the files listed below — nothing else.**

---

## What exists (do not touch)

```
identity/
├── .github/          ← leave alone
├── src/
│   ├── index.ts      ← will be replaced in Step 2
│   └── types.ts      ← will be replaced in Step 1
├── tests/
│   └── test.ts       ← will be replaced in Step 3
├── package.json      ✓ done
├── tsconfig.json     ✓ done
├── tsup.config.ts    ✓ done
├── vitest.config.ts  ✓ done
├── README.md         ✓ done
└── .gitignore        ✓ done
```

---

## Step 1 — Fill `src/types.ts`

Replace the file contents with:

```ts
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

export type CreateAgentOptions = {
  parent?: AgentManifest  // if provided, authority is clamped to parent.authority
}
```

---

## Step 2 — Create remaining `src/` files

### `src/factory.ts`

```ts
import {
  AgentManifest,
  AgentManifestInput,
  AuthorityLevel,
  AUTHORITY_ORDER,
  CreateAgentOptions,
} from './types.js'

function clampAuthority(
  requested: AuthorityLevel,
  ceiling: AuthorityLevel
): AuthorityLevel {
  const requestedIdx = AUTHORITY_ORDER.indexOf(requested)
  const ceilingIdx = AUTHORITY_ORDER.indexOf(ceiling)
  return requestedIdx <= ceilingIdx ? requested : ceiling
}

function validateManifest(input: AgentManifestInput): void {
  if (!input.id || typeof input.id !== 'string' || input.id.trim() === '') {
    throw new Error('AgentManifest: `id` must be a non-empty string')
  }
  if (!input.role || typeof input.role !== 'string' || input.role.trim() === '') {
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

  return {
    ...input,
    authority,
    parentId: options.parent?.id ?? input.parentId,
    createdAt: new Date().toISOString(),
  }
}

export function createChildAgent(
  input: Omit<AgentManifestInput, 'parentId'>,
  parent: AgentManifest
): AgentManifest {
  return createAgent({ ...input, parentId: parent.id }, { parent })
}
```

---

### `src/authority.ts`

```ts
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
```

---

### `src/toml.ts`

Minimal hand-rolled TOML parser scoped to the `AgentManifest` schema. Zero external dependencies.

Implement:

**`parseManifest(toml: string): AgentManifestInput`**
- Skip blank lines and comment lines (`# …`)
- Parse `key = "value"` → string fields: `id`, `role`, `description`, `memoryScope`, `authority`, `parentId`
- Parse `key = ["a", "b"]` → string array fields: `skills`, `permissions`, `tags`
- Parse `key = 123` → number fields: `maxTokenBudget`
- Throw a descriptive `Error` for unrecognised keys or malformed lines
- Return a plain object satisfying `AgentManifestInput`

**`serializeManifest(manifest: AgentManifest): string`**
- Emit string fields as `key = "value"`
- Emit string array fields as `key = ["a", "b"]`
- Emit number fields as `key = 123`
- Omit undefined/optional fields
- Output fields in a stable order matching `AgentManifest` key order

---

### `src/guards.ts`

```ts
import { AgentManifest, MemoryScope, AuthorityLevel, AUTHORITY_ORDER } from './types.js'

const MEMORY_SCOPES: MemoryScope[] = ['working', 'episodic', 'semantic']

export function isAgentManifest(value: unknown): value is AgentManifest {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v['id'] === 'string' &&
    typeof v['role'] === 'string' &&
    Array.isArray(v['skills']) &&
    MEMORY_SCOPES.includes(v['memoryScope'] as MemoryScope) &&
    AUTHORITY_ORDER.includes(v['authority'] as AuthorityLevel) &&
    typeof v['createdAt'] === 'string'
  )
}
```

---

### `src/index.ts`

Replace the existing file with the full public API barrel:

```ts
export type {
  AgentManifest,
  AgentManifestInput,
  MemoryScope,
  AuthorityLevel,
  CreateAgentOptions,
} from './types.js'

export { AUTHORITY_ORDER } from './types.js'
export { createAgent, createChildAgent } from './factory.js'
export { hasAuthority, canDelegate, authorityIndex } from './authority.js'
export { parseManifest, serializeManifest } from './toml.js'
export { isAgentManifest } from './guards.js'
```

---

## Step 3 — Fill `tests/test.ts`

Replace the existing file with all tests. Target: **≥ 30 tests, all green**.

### factory tests

- `createAgent()` returns a well-formed manifest with `createdAt` as ISO string
- `createAgent()` throws on empty `id`
- `createAgent()` throws on missing `role`
- `createAgent()` throws on invalid `authority` value
- `createAgent()` throws when `skills` is not an array
- `createAgent()` with `parent` clamps authority to parent ceiling
- `createAgent()` does not escalate when requested authority equals parent ceiling
- `createChildAgent()` sets `parentId` to parent's `id`
- `createChildAgent()` prevents privilege escalation (child authority clamped)
- `createChildAgent()` preserves all non-authority fields

### authority tests

- `hasAuthority()` returns `true` when agent meets exact required level
- `hasAuthority()` returns `true` when agent exceeds required level
- `hasAuthority()` returns `false` when agent is below required level
- `canDelegate()` returns `true` when child authority equals parent
- `canDelegate()` returns `true` when child authority is below parent
- `canDelegate()` returns `false` when child authority exceeds parent
- `authorityIndex()` returns correct ordinal for each level

### toml tests

- `parseManifest()` parses all string fields correctly
- `parseManifest()` parses array fields correctly
- `parseManifest()` parses numeric field (`maxTokenBudget`) correctly
- `parseManifest()` ignores comment lines
- `parseManifest()` ignores blank lines
- `parseManifest()` throws on malformed line
- `serializeManifest()` emits all required string fields
- `serializeManifest()` emits array fields in correct TOML syntax
- `serializeManifest()` omits undefined optional fields
- `parseManifest(serializeManifest(manifest))` round-trips with full fidelity

### guards tests

- `isAgentManifest()` returns `true` for a valid manifest
- `isAgentManifest()` returns `false` when `id` is missing
- `isAgentManifest()` returns `false` when `authority` is invalid
- `isAgentManifest()` returns `false` for a non-object input

---

## Step 4 — Verify

```bash
pnpm typecheck   # zero errors
pnpm test        # ≥ 30 tests, all green
pnpm build       # dist/ contains index.js, index.cjs, index.d.ts
```

---

## Checklist

- [ ] `src/types.ts` — all types and `AUTHORITY_ORDER` exported
- [ ] `src/factory.ts` — `createAgent`, `createChildAgent` with authority clamping
- [ ] `src/authority.ts` — `hasAuthority`, `canDelegate`, `authorityIndex`
- [ ] `src/toml.ts` — `parseManifest`, `serializeManifest` (zero-dep)
- [ ] `src/guards.ts` — `isAgentManifest`
- [ ] `src/index.ts` — full public API barrel
- [ ] `tests/test.ts` — ≥ 30 tests, all green
- [ ] `pnpm typecheck` — zero errors
- [ ] `pnpm build` — ESM + CJS + `.d.ts` in `dist/`