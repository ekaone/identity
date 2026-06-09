import { AgentManifest, AgentManifestInput, ParsedManifest } from './types.js'

const STRING_FIELDS = new Set<string>([
  'id', 'role', 'description', 'memoryScope', 'authority', 'parentId', 'createdAt',
])
const ARRAY_FIELDS = new Set<string>(['skills', 'permissions', 'tags'])
const NUMBER_FIELDS = new Set<string>(['maxTokenBudget'])

export function parseManifest(toml: string): ParsedManifest {
  const result: Record<string, unknown> = {}

  for (const raw of toml.split('\n')) {
    const line = raw.trim()
    if (line === '' || line.startsWith('#')) continue

    const eqIdx = line.indexOf('=')
    if (eqIdx === -1) {
      throw new Error(`parseManifest: malformed line (missing '='): ${JSON.stringify(line)}`)
    }

    const key = line.slice(0, eqIdx).trim()
    const val = line.slice(eqIdx + 1).trim()

    if (STRING_FIELDS.has(key)) {
      const m = val.match(/^"(.*)"$/)
      if (!m) {
        throw new Error(`parseManifest: expected quoted string for key "${key}", got: ${val}`)
      }
      result[key] = m[1]
    } else if (ARRAY_FIELDS.has(key)) {
      const m = val.match(/^\[(.*)\]$/)
      if (!m) {
        throw new Error(`parseManifest: expected array for key "${key}", got: ${val}`)
      }
      const inner = (m[1] ?? '').trim()
      result[key] = inner === '' ? [] : inner.split(',').map(s => {
        const item = s.trim()
        const qm = item.match(/^"(.*)"$/)
        if (!qm) {
          throw new Error(`parseManifest: array item is not a quoted string: ${item}`)
        }
        return qm[1] as string
      })
    } else if (NUMBER_FIELDS.has(key)) {
      const n = Number(val)
      if (isNaN(n)) {
        throw new Error(`parseManifest: expected number for key "${key}", got: ${val}`)
      }
      result[key] = n
    } else {
      throw new Error(`parseManifest: unrecognised key: "${key}"`)
    }
  }

  return result as ParsedManifest
}

const FIELD_ORDER: (keyof AgentManifest)[] = [
  'id',
  'role',
  'description',
  'skills',
  'memoryScope',
  'authority',
  'permissions',
  'maxTokenBudget',
  'tags',
  'parentId',
  'createdAt',
]

export function serializeManifest(manifest: AgentManifest): string {
  const lines: string[] = []

  for (const key of FIELD_ORDER) {
    const value = manifest[key]
    if (value === undefined) continue

    if (Array.isArray(value)) {
      lines.push(`${key} = [${(value as string[]).map(s => `"${s}"`).join(', ')}]`)
    } else if (typeof value === 'number') {
      lines.push(`${key} = ${value}`)
    } else {
      lines.push(`${key} = "${value}"`)
    }
  }

  return lines.join('\n')
}
