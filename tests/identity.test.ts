import { describe, it, expect } from 'vitest'
import {
  createAgent,
  createChildAgent,
  hasAuthority,
  canDelegate,
  authorityIndex,
  parseManifest,
  serializeManifest,
  isAgentManifest,
} from '../src/index.js'
import type { AgentManifest } from '../src/index.js'

function baseInput() {
  return {
    id: 'agent-001',
    role: 'Coordinator',
    skills: ['skill-a', 'skill-b'],
    memoryScope: 'working' as const,
    authority: 'write' as const,
  }
}

// ── factory ──────────────────────────────────────────────────────────────────

describe('createAgent()', () => {
  it('returns a well-formed manifest with createdAt as ISO string', () => {
    const m = createAgent(baseInput())
    expect(m.id).toBe('agent-001')
    expect(m.role).toBe('Coordinator')
    expect(typeof m.createdAt).toBe('string')
    expect(new Date(m.createdAt).toISOString()).toBe(m.createdAt)
  })

  it('throws on empty id', () => {
    expect(() => createAgent({ ...baseInput(), id: '' })).toThrow(/`id`/)
  })

  it('throws on whitespace-only id', () => {
    expect(() => createAgent({ ...baseInput(), id: '   ' })).toThrow(/`id`/)
  })

  it('throws on missing role', () => {
    expect(() => createAgent({ ...baseInput(), role: '' })).toThrow(/`role`/)
  })

  it('throws on whitespace-only role', () => {
    expect(() => createAgent({ ...baseInput(), role: '   ' })).toThrow(/`role`/)
  })

  it('throws on invalid authority value', () => {
    expect(() =>
      createAgent({ ...baseInput(), authority: 'superuser' as never })
    ).toThrow(/`authority`/)
  })

  it('throws when skills is not an array', () => {
    expect(() =>
      createAgent({ ...baseInput(), skills: 'skill-a' as never })
    ).toThrow(/`skills`/)
  })

  it('clamps authority to parent ceiling when parent is provided', () => {
    const parent = createAgent({ ...baseInput(), authority: 'write' })
    const child = createAgent({ ...baseInput(), id: 'child', authority: 'delegate' }, { parent })
    expect(child.authority).toBe('write')
  })

  it('does not escalate when requested authority equals parent ceiling', () => {
    const parent = createAgent({ ...baseInput(), authority: 'execute' })
    const child = createAgent({ ...baseInput(), id: 'child', authority: 'execute' }, { parent })
    expect(child.authority).toBe('execute')
  })

  it('sets parentId from options.parent when provided', () => {
    const parent = createAgent(baseInput())
    const child = createAgent({ ...baseInput(), id: 'child' }, { parent })
    expect(child.parentId).toBe(parent.id)
  })
})

describe('createChildAgent()', () => {
  it('sets parentId to parent id', () => {
    const parent = createAgent(baseInput())
    const child = createChildAgent({ ...baseInput(), id: 'child' }, parent)
    expect(child.parentId).toBe(parent.id)
  })

  it('prevents privilege escalation', () => {
    const parent = createAgent({ ...baseInput(), authority: 'read' })
    const child = createChildAgent({ ...baseInput(), id: 'child', authority: 'delegate' }, parent)
    expect(child.authority).toBe('read')
  })

  it('preserves all non-authority fields', () => {
    const parent = createAgent({ ...baseInput(), authority: 'delegate' })
    const child = createChildAgent(
      { ...baseInput(), id: 'child-x', role: 'Worker', description: 'desc', tags: ['t1'] },
      parent
    )
    expect(child.id).toBe('child-x')
    expect(child.role).toBe('Worker')
    expect(child.description).toBe('desc')
    expect(child.tags).toEqual(['t1'])
  })
})

// ── authority ────────────────────────────────────────────────────────────────

describe('hasAuthority()', () => {
  it('returns true when agent meets exact required level', () => {
    expect(hasAuthority({ authority: 'write' }, 'write')).toBe(true)
  })

  it('returns true when agent exceeds required level', () => {
    expect(hasAuthority({ authority: 'delegate' }, 'read')).toBe(true)
  })

  it('returns false when agent is below required level', () => {
    expect(hasAuthority({ authority: 'read' }, 'execute')).toBe(false)
  })
})

describe('canDelegate()', () => {
  it('returns true when child authority equals parent', () => {
    expect(canDelegate({ authority: 'write' }, { authority: 'write' })).toBe(true)
  })

  it('returns true when child authority is below parent', () => {
    expect(canDelegate({ authority: 'execute' }, { authority: 'read' })).toBe(true)
  })

  it('returns false when child authority exceeds parent', () => {
    expect(canDelegate({ authority: 'read' }, { authority: 'delegate' })).toBe(false)
  })
})

describe('authorityIndex()', () => {
  it('returns correct ordinal for each level', () => {
    expect(authorityIndex('read')).toBe(0)
    expect(authorityIndex('write')).toBe(1)
    expect(authorityIndex('execute')).toBe(2)
    expect(authorityIndex('delegate')).toBe(3)
  })
})

// ── toml ─────────────────────────────────────────────────────────────────────

const sampleToml = `
# sample manifest
id = "agent-toml-test"
role = "Tester"
description = "A test agent"
skills = ["skill-a", "skill-b"]
memoryScope = "episodic"
authority = "execute"
permissions = ["perm-x"]
maxTokenBudget = 4096
tags = ["tag-1", "tag-2"]
parentId = "agent-parent"
`.trim()

describe('parseManifest()', () => {
  it('parses all string fields correctly', () => {
    const m = parseManifest(sampleToml)
    expect(m.id).toBe('agent-toml-test')
    expect(m.role).toBe('Tester')
    expect(m.description).toBe('A test agent')
    expect(m.memoryScope).toBe('episodic')
    expect(m.authority).toBe('execute')
    expect(m.parentId).toBe('agent-parent')
  })

  it('parses array fields correctly', () => {
    const m = parseManifest(sampleToml)
    expect(m.skills).toEqual(['skill-a', 'skill-b'])
    expect(m.permissions).toEqual(['perm-x'])
    expect(m.tags).toEqual(['tag-1', 'tag-2'])
  })

  it('parses numeric field (maxTokenBudget) correctly', () => {
    const m = parseManifest(sampleToml)
    expect(m.maxTokenBudget).toBe(4096)
  })

  it('ignores comment lines', () => {
    const m = parseManifest('# this is a comment\nid = "x"\nrole = "r"\nskills = []\nmemoryScope = "working"\nauthority = "read"')
    expect(m.id).toBe('x')
  })

  it('ignores blank lines', () => {
    const m = parseManifest('\n\nid = "x"\n\nrole = "r"\nskills = []\nmemoryScope = "working"\nauthority = "read"\n\n')
    expect(m.role).toBe('r')
  })

  it('throws on malformed line', () => {
    expect(() => parseManifest('not-a-valid-line')).toThrow(/malformed/)
  })

  it('throws on unrecognised key', () => {
    expect(() => parseManifest('unknownKey = "value"')).toThrow(/unrecognised key/)
  })
})

describe('serializeManifest()', () => {
  const manifest: AgentManifest = {
    id: 'agent-s',
    role: 'Serializer',
    description: 'desc',
    skills: ['s1', 's2'],
    memoryScope: 'semantic',
    authority: 'delegate',
    permissions: ['p1'],
    maxTokenBudget: 2048,
    tags: ['t1'],
    parentId: 'parent-x',
    createdAt: '2026-01-01T00:00:00.000Z',
  }

  it('emits all required string fields', () => {
    const out = serializeManifest(manifest)
    expect(out).toContain('id = "agent-s"')
    expect(out).toContain('role = "Serializer"')
    expect(out).toContain('authority = "delegate"')
    expect(out).toContain('createdAt = "2026-01-01T00:00:00.000Z"')
  })

  it('emits array fields in correct TOML syntax', () => {
    const out = serializeManifest(manifest)
    expect(out).toContain('skills = ["s1", "s2"]')
    expect(out).toContain('tags = ["t1"]')
  })

  it('omits undefined optional fields', () => {
    const minimal: AgentManifest = {
      id: 'min',
      role: 'Min',
      skills: [],
      memoryScope: 'working',
      authority: 'read',
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    const out = serializeManifest(minimal)
    expect(out).not.toContain('description')
    expect(out).not.toContain('permissions')
    expect(out).not.toContain('maxTokenBudget')
    expect(out).not.toContain('tags')
    expect(out).not.toContain('parentId')
  })

  it('round-trips with full fidelity', () => {
    const out = serializeManifest(manifest)
    const parsed = parseManifest(out)
    expect(parsed.id).toBe(manifest.id)
    expect(parsed.role).toBe(manifest.role)
    expect(parsed.description).toBe(manifest.description)
    expect(parsed.skills).toEqual(manifest.skills)
    expect(parsed.memoryScope).toBe(manifest.memoryScope)
    expect(parsed.authority).toBe(manifest.authority)
    expect(parsed.permissions).toEqual(manifest.permissions)
    expect(parsed.maxTokenBudget).toBe(manifest.maxTokenBudget)
    expect(parsed.tags).toEqual(manifest.tags)
    expect(parsed.parentId).toBe(manifest.parentId)
    expect(parsed.createdAt).toBe(manifest.createdAt)
  })
})

// ── guards ───────────────────────────────────────────────────────────────────

describe('isAgentManifest()', () => {
  const valid: AgentManifest = {
    id: 'g-001',
    role: 'Guard',
    skills: [],
    memoryScope: 'working',
    authority: 'read',
    createdAt: '2026-01-01T00:00:00.000Z',
  }

  it('returns true for a valid manifest', () => {
    expect(isAgentManifest(valid)).toBe(true)
  })

  it('returns false when id is missing', () => {
    const { id: _id, ...rest } = valid
    expect(isAgentManifest(rest)).toBe(false)
  })

  it('returns false when id is an empty string', () => {
    expect(isAgentManifest({ ...valid, id: '' })).toBe(false)
  })

  it('returns false when authority is invalid', () => {
    expect(isAgentManifest({ ...valid, authority: 'superuser' })).toBe(false)
  })

  it('returns false when memoryScope is invalid', () => {
    expect(isAgentManifest({ ...valid, memoryScope: 'permanent' })).toBe(false)
  })

  it('returns false when createdAt is missing', () => {
    const { createdAt: _c, ...rest } = valid
    expect(isAgentManifest(rest)).toBe(false)
  })

  it('returns false when skills contains non-string items', () => {
    expect(isAgentManifest({ ...valid, skills: [1, 2, 3] })).toBe(false)
  })

  it('returns false for a non-object input', () => {
    expect(isAgentManifest(null)).toBe(false)
    expect(isAgentManifest('string')).toBe(false)
    expect(isAgentManifest(42)).toBe(false)
  })
})
