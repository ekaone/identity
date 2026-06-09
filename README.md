# > Not Published Yet

# @ekaone/identity

> Zero-dependency TypeScript library for defining, validating, and composing **agent identities** in multi-agent systems.

Each agent gets a typed `AgentManifest` — a structured record that declares what the agent can do (`skills`), how isolated its memory is (`memoryScope`), and the maximum privilege it may exercise (`authority`). Child agents are always clamped to their parent's authority ceiling, making privilege escalation structurally impossible.

Designed to pair with `@ekaone/memory`, `@ekaone/approval`, and `@ekaone/relay`, but works standalone with zero runtime dependencies.

---

## Installation

```bash
npm install @ekaone/identity
```

```bash
yarn add @ekaone/identity
```

```bash
pnpm add @ekaone/identity
```

---

## Example usage

### 1 — Create a parent agent and a clamped child

```ts
import { createAgent, createChildAgent, hasAuthority } from '@ekaone/identity'

const coordinator = createAgent({
  id: 'agent-coordinator',
  role: 'Incident Coordinator',
  description: 'Orchestrates incident response across sub-agents.',
  skills: ['triage', 'escalate', 'notify'],
  memoryScope: 'episodic',
  authority: 'delegate',
})

// Child inherits parentId. Authority is clamped to coordinator's ceiling.
const analyst = createChildAgent(
  {
    id: 'agent-analyst',
    role: 'Log Analyst',
    skills: ['parse-logs', 'summarize'],
    memoryScope: 'working',
    authority: 'write',
  },
  coordinator
)

console.log(analyst.parentId)   // 'agent-coordinator'
console.log(analyst.authority)  // 'write'

// Gate an action on required authority level
if (hasAuthority(analyst, 'execute')) {
  // not reached — analyst only has 'write'
}
```

### 2 — Serialize to TOML, persist, and restore

```ts
import {
  createAgent,
  serializeManifest,
  parseManifest,
  isAgentManifest,
} from '@ekaone/identity'
import { writeFileSync, readFileSync } from 'node:fs'

const agent = createAgent({
  id: 'agent-reporter',
  role: 'Report Generator',
  skills: ['fetch-metrics', 'render-pdf'],
  memoryScope: 'semantic',
  authority: 'read',
  tags: ['reporting', 'scheduled'],
  maxTokenBudget: 8192,
})

// Persist — includes createdAt in the TOML output
writeFileSync('agent-reporter.toml', serializeManifest(agent), 'utf8')

// Restore — parseManifest captures createdAt when present
const restored = parseManifest(readFileSync('agent-reporter.toml', 'utf8'))

if (isAgentManifest(restored)) {
  console.log(restored.id)        // 'agent-reporter'
  console.log(restored.createdAt) // original ISO timestamp preserved
}
```

---

## Concepts

### Authority levels

Ordered lowest → highest. A parent can never grant a child more than its own ceiling.

| Level | Meaning |
|---|---|
| `read` | Observe state only |
| `write` | Modify state |
| `execute` | Trigger actions and tools |
| `delegate` | Spawn and authorize sub-agents |

### Memory scopes

| Scope | Meaning |
|---|---|
| `working` | In-turn only; discarded after each invocation |
| `episodic` | Retained across turns within a session |
| `semantic` | Long-term, shared across sessions |

---

## API

### `createAgent(input, options?)`

Creates a new `AgentManifest`. Validates required fields and stamps `createdAt` with the current UTC timestamp.

```ts
createAgent(input: AgentManifestInput, options?: CreateAgentOptions): AgentManifest
```

Throws if:
- `id` or `role` is empty or whitespace-only
- `skills` is not an array
- `authority` is not a valid level

When `options.parent` is provided, `authority` is automatically clamped to the parent's ceiling and `parentId` is set.

---

### `createChildAgent(input, parent)`

Shorthand for `createAgent` that sets `parentId` and enforces the parent's authority ceiling in one call.

```ts
createChildAgent(
  input: Omit<AgentManifestInput, 'parentId'>,
  parent: AgentManifest
): AgentManifest
```

---

### `hasAuthority(agent, required)`

Returns `true` if the agent's authority is at or above `required`.

```ts
hasAuthority(agent: { authority: AuthorityLevel }, required: AuthorityLevel): boolean
```

---

### `canDelegate(parent, child)`

Returns `true` if the parent's authority is at or above the child's — i.e., the delegation is legal.

```ts
canDelegate(
  parent: { authority: AuthorityLevel },
  child:  { authority: AuthorityLevel }
): boolean
```

---

### `authorityIndex(level)`

Returns the numeric ordinal of an authority level (`read` → 0, `delegate` → 3). Useful for custom range comparisons.

```ts
authorityIndex(level: AuthorityLevel): number
```

---

### `parseManifest(toml)`

Parses a TOML string into a manifest object. Skips blank lines and `#` comments. Preserves `createdAt` when present (e.g. when parsing output from `serializeManifest`).

```ts
parseManifest(toml: string): ParsedManifest
// ParsedManifest = AgentManifestInput & { createdAt?: string }
```

Throws on unrecognised keys or malformed lines.

---

### `serializeManifest(manifest)`

Serializes an `AgentManifest` to a TOML string. Omits `undefined` optional fields. Field order is stable.

```ts
serializeManifest(manifest: AgentManifest): string
```

---

### `isAgentManifest(value)`

Type guard. Returns `true` when `value` is a structurally valid `AgentManifest`. Checks that:
- `id` and `role` are non-empty strings
- `skills` is an array of strings
- `memoryScope` and `authority` are valid enum values
- `createdAt` is a string

```ts
isAgentManifest(value: unknown): value is AgentManifest
```

---

## Types

```ts
type MemoryScope = 'working' | 'episodic' | 'semantic'

type AuthorityLevel = 'read' | 'write' | 'execute' | 'delegate'

type AgentManifest = {
  id: string
  role: string
  description?: string
  skills: string[]
  memoryScope: MemoryScope
  authority: AuthorityLevel
  permissions?: string[]
  maxTokenBudget?: number
  tags?: string[]
  parentId?: string
  createdAt: string          // ISO 8601
}

type AgentManifestInput = Omit<AgentManifest, 'createdAt'>

// Returned by parseManifest — includes createdAt when parsing a serialized manifest
type ParsedManifest = AgentManifestInput & { createdAt?: string }

type CreateAgentOptions = {
  parent?: AgentManifest
}
```

---

## License

MIT © [Eka Prasetia](./LICENSE)

## Links

- [npm Package](https://www.npmjs.com/package/@ekaone/identity)
- [GitHub Repository](https://github.com/ekaone/identity)
- [Issue Tracker](https://github.com/ekaone/identity/issues)

## Related Packages

- [Credit card masking library](https://github.com/ekaone/mask-card)
- [Token masking library](https://github.com/ekaone/mask-token)
- [Phone masking library](https://github.com/ekaone/mask-phone)
