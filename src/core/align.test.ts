import { fc, test } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'
import { anyText, entriesOf, envText } from '../../test/helpers'
import { align } from './align'
import type { MigenvOptions } from './options'
import type { EntryNode } from './parse'

const HEADER = '# ---- Not in template (review manually) ----'

function lastEntries(text: string): Map<string, EntryNode> {
  return new Map(entriesOf(text).map((entry) => [entry.key, entry]))
}

const options: fc.Arbitrary<MigenvOptions> = fc.record(
  {
    add: fc.boolean(),
    remove: fc.boolean(),
    reorder: fc.boolean(),
    useTemplateDefaults: fc.boolean(),
    extrasHeader: fc.constantFrom(false as const, '# extra'),
    newline: fc.constantFrom(
      'template' as const,
      'current' as const,
      'lf' as const,
      'crlf' as const,
    ),
  },
  { requiredKeys: [] },
)

describe('align', () => {
  it('follows the example in its doc comment', () => {
    const result = align('B=2\nA=1\nOLD=x\n', '# app\nA=\nB=\nC=3\n', { protect: ['OLD'] })
    expect(result.text).toBe(`# app\nA=1\nB=2\nC=3\n\n${HEADER}\nOLD=x\n`)
    expect(result).toMatchObject({ changed: true, added: ['C'], extra: ['OLD'], removed: [] })
  })

  it('reports removed keys and protected skips', () => {
    const result = align('SECRET=\nOLD=1\nKEEP=2\n', 'SECRET=default\n', {
      remove: true,
      protect: ['SECRET', 'KEEP'],
    })
    expect(result.removed).toEqual(['OLD'])
    expect(result.extra).toEqual(['KEEP'])
    expect(result.protectedSkips).toEqual([
      { key: 'SECRET', action: 'default' },
      { key: 'KEEP', action: 'remove' },
    ])
    expect(result.warnings.map((w) => w.code)).toEqual(['protected', 'protected'])
  })

  it('reports comments that only the current file had, but not its own header', () => {
    const result = align(`# mine\nA=1\n\n${HEADER}\nB=2\n`, '# shared\nA=\n', {})
    expect(result.droppedComments).toEqual(['# mine'])
  })

  it('keeps the current order with reorder: false and puts added keys before broken lines', () => {
    const result = align('B=2\nX="open\nA=1\n', 'A=\nB=\nC=3\n', { reorder: false })
    expect(result.text).toBe('B=2\nC=3\nX="open\nA=1\n')
  })

  it('warns about unknown lines without their content', () => {
    const [warning] = align('A=1\nTOKEN="abc\n', 'A=\n').warnings
    expect(warning).toMatchObject({ code: 'unknown-line', source: 'current', line: 2 })
    expect(warning?.message).not.toContain('abc')
  })

  it('throws on unknown lines with strict: true', () => {
    expect(() => align('TOKEN="abc\n', 'A=\n', { strict: true })).toThrow(
      expect.objectContaining({ code: 'UNKNOWN_LINE' }),
    )
  })

  it("throws on duplicate keys with duplicates: 'error'", () => {
    expect(() => align('A=1\nA=2\n', 'A=\n', { duplicates: 'error' })).toThrow(
      expect.objectContaining({ code: 'DUPLICATE_KEY' }),
    )
  })

  it('reports no change when the file is already aligned', () => {
    expect(align('A=1\n', 'A=\n')).toMatchObject({ text: 'A=1\n', changed: false })
  })
})

describe('align properties', () => {
  test.prop([envText, envText, options])(
    'keeps every non-empty value unless the key is removed',
    (current, template, opts) => {
      const result = align(current, template, opts)
      const output = lastEntries(result.text)
      for (const entry of lastEntries(current).values()) {
        if (entry.isEmpty || result.removed.includes(entry.key)) continue
        expect(output.get(entry.key)?.rawValue).toBe(entry.rawValue)
      }
    },
  )

  test.prop([anyText, anyText, options])('is idempotent', (current, template, opts) => {
    const once = align(current, template, opts).text
    expect(align(once, template, opts).text).toBe(once)
  })

  test.prop([envText, envText, options])(
    'never changes the line of a protected key',
    (current, template, opts) => {
      const protect = ['A', 'api.*']
      const result = align(current, template, { ...opts, protect })
      const outputRaws = entriesOf(result.text).map((entry) => entry.raw)
      for (const entry of lastEntries(current).values()) {
        if (entry.key === 'A' || entry.key.startsWith('api.')) {
          expect(outputRaws).toContain(entry.raw)
        }
      }
    },
  )

  test.prop([envText, envText, options])(
    'keeps every current key with remove: false',
    (current, template, opts) => {
      const result = align(current, template, { ...opts, remove: false })
      const outputKeys = new Set(entriesOf(result.text).map((entry) => entry.key))
      for (const entry of entriesOf(current)) {
        expect(outputKeys).toContain(entry.key)
      }
    },
  )

  test.prop([envText, envText])('puts template keys in template order', (current, template) => {
    const templateKeys = [...new Set(entriesOf(template).map((entry) => entry.key))]
    const outputKeys = entriesOf(align(current, template).text)
      .map((entry) => entry.key)
      .filter((key) => templateKeys.includes(key))
    expect(outputKeys).toEqual(templateKeys)
  })
})
