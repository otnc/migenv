import { fc, test } from '@fast-check/vitest'
import { parse as dotenv } from 'dotenv'
import { describe, expect, it } from 'vitest'
import { anyText, envText } from '../../test/helpers'
import { parse } from './parse'
import { setValues } from './set'

describe('setValues', () => {
  it('explicitly overwrites non-empty values and leaves unrelated bytes intact', () => {
    const text =
      '\uFEFF# app\r\nexport ORIGIN = old # replaced\r\nHOST = "127.0.0.1" # kept\nLAST=x'
    const result = setValues(text, new Map([['ORIGIN', 'https://example.com']]))
    expect(result.text).toBe(text.replace(' old # replaced', 'https://example.com'))
    expect(result).toMatchObject({
      changed: true,
      updated: ['ORIGIN'],
      added: [],
      skipped: [],
      warnings: [],
    })
    expect(setValues(result.text, new Map([['ORIGIN', 'https://example.com']]))).toMatchObject({
      text: result.text,
      changed: false,
      updated: [],
    })
  })

  it.each(['', 'A=old\n', 'A=old\r\n', 'A=old'])('adds missing keys in map order to %j', (text) => {
    const values = new Map([
      ['NEW', 'x'],
      ['EMPTY', ''],
    ])
    const result = setValues(text, values)
    expect(dotenv(result.text)).toMatchObject({ NEW: 'x', EMPTY: '' })
    expect(result.added).toEqual(['NEW', 'EMPTY'])
    expect(result.text.includes('\r\n')).toBe(text.includes('\r\n'))
    expect(result.text.endsWith('\n')).toBe(text === '' || text.endsWith('\n'))
    expect(setValues(result.text, values)).toMatchObject({ changed: false, updated: [], added: [] })
  })

  it('can update without adding missing keys', () => {
    expect(
      setValues(
        'A=old\n',
        new Map([
          ['A', 'new'],
          ['B', 'x'],
        ]),
        { add: false },
      ),
    ).toMatchObject({ text: 'A=new\n', updated: ['A'], added: [], skipped: ['B'] })
  })

  it('protects existing and missing keys, including every occurrence of a protected key', () => {
    const values = new Map([
      ['TOKEN', 'new'],
      ['NEW_SECRET', 'x'],
    ])
    const text = 'TOKEN=old\nTOKEN=vault:stored\n'
    const result = setValues(text, values, {
      protect: (key, raw) => key.endsWith('_SECRET') || raw.startsWith('vault:'),
    })
    expect(result).toMatchObject({
      text,
      changed: false,
      skipped: ['TOKEN', 'NEW_SECRET'],
      updated: [],
      added: [],
    })
    expect(result.warnings.map((warning) => warning.code)).toEqual([
      'duplicate-key',
      'protected',
      'protected',
    ])
    expect(JSON.stringify(result.warnings)).not.toContain('vault:stored')
    expect(setValues('TOKEN=old\n', new Map([['TOKEN', 'new']]), { protect: ['TOK*'] }).text).toBe(
      'TOKEN=old\n',
    )
  })

  it.each(['first', 'last'] as const)(
    'updates all duplicate occurrences with duplicates: %s',
    (duplicates) => {
      const result = setValues('A=first\nKEEP=x\nexport A = last\n', new Map([['A', 'new']]), {
        duplicates,
      })
      expect(result.text).toBe('A=new\nKEEP=x\nexport A =new\n')
      expect(result.updated).toEqual(['A'])
      expect(dotenv(result.text).A).toBe('new')
      expect(() =>
        setValues('A=first\nA=last\n', new Map([['A', 'new']]), { duplicates: 'error' }),
      ).toThrow(expect.objectContaining({ code: 'DUPLICATE_KEY' }))
    },
  )

  it.each([
    '',
    'plain',
    '"spaces and #hash" # comment',
    "'literal\\n'",
    '"expanded\\nline"',
    "'first\nsecond'",
    '`both \' and "`',
  ])('uses raw env syntax %j without decoding or escaping it', (raw) => {
    const result = setValues('VALUE=old\nKEEP=untouched\n', new Map([['VALUE', raw]]))
    expect(result.text).toBe(`VALUE=${raw}\nKEEP=untouched\n`)
    expect(dotenv(result.text).VALUE).toBe(dotenv(`VALUE=${raw}\n`).VALUE)
  })

  it.each([
    'private\nINJECTED=yes',
    'private\rINJECTED=yes',
    'private\n',
    '"private',
    'private\0value',
  ])('rejects unsafe raw values without exposing them', (raw) => {
    try {
      setValues('A=old\n', new Map([['A', raw]]))
      expect.unreachable()
    } catch (error) {
      expect(error).toMatchObject({ code: 'INVALID_VALUE' })
      expect(String(error)).not.toContain('private')
    }
  })

  it.each(['BAD=private', 'BAD\nPRIVATE', '', '1KEY'])(
    'rejects invalid key %j without echoing it',
    (key) => {
      expect(() => setValues('', new Map([[key, 'private']]))).toThrow(
        expect.objectContaining({ code: 'INVALID_VALUE' }),
      )
    },
  )

  it('keeps unknown lines and inserts missing keys before them', () => {
    const current = '# app\r\nA=old\r\nBROKEN="private\r\n'
    const result = setValues(current, new Map([['NEW', 'x']]))
    expect(result.text).toBe('# app\r\nA=old\r\nNEW=x\r\nBROKEN="private\r\n')
    expect(result.warnings).toEqual([expect.objectContaining({ code: 'unknown-line', line: 3 })])
    expect(() => setValues(current, new Map(), { strict: true })).toThrow(
      expect.objectContaining({ code: 'UNKNOWN_LINE' }),
    )
  })

  it('returns the original text when an update would change a neighboring quoted value', () => {
    const current = 'A="C:\\tools\\"\nB=old\n'
    const result = setValues(current, new Map([['B', '"\nnew"']]))
    expect(result).toMatchObject({
      text: current,
      changed: false,
      updated: [],
      added: [],
      skipped: ['B'],
    })
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'ambiguous-quote' }))
  })

  test.prop([anyText])('preserves every byte without updates', (text) => {
    expect(setValues(text, new Map()).text).toBe(text)
  })

  test.prop([anyText])('keeps all non-target entries and is idempotent', (text) => {
    const values = new Map([['TARGET', 'replacement']])
    const result = setValues(text, values)
    const untouched = (source: string) =>
      parse(source)
        .nodes.filter((node) => node.kind === 'entry' && node.key !== 'TARGET')
        .map((node) => node.raw)
    expect(untouched(result.text)).toEqual(untouched(text))
    expect(setValues(result.text, values).text).toBe(result.text)
  })

  test.prop(
    [
      envText.filter((text) => parse(text).nodes.every((node) => node.kind !== 'unknown')),
      fc.string({ unit: fc.constantFrom('a', 'B', '1', ':', '/') }),
    ],
    { numRuns: 1000 },
  )('changes only the requested dotenv value', (text, value) => {
    const result = setValues(text, new Map([['A', value]]))
    const before = dotenv(text)
    const after = dotenv(result.text)
    for (const [key, previous] of Object.entries(before)) {
      if (key !== 'A') expect(after[key]).toBe(previous)
    }
    if (result.updated.includes('A') || result.added.includes('A')) expect(after.A).toBe(value)
    expect(setValues(result.text, new Map([['A', value]])).text).toBe(result.text)
  })
})
