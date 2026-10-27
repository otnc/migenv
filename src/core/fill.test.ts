import { fc, test } from '@fast-check/vitest'
import { parse as dotenv } from 'dotenv'
import { describe, expect, it, vi } from 'vitest'
import { align } from './align'
import { parseDirectives } from './directives'
import { fill } from './fill'
import { generators, type Generator } from './generators'
import { parse } from './parse'

describe('generation', () => {
  it('applies built-ins only to the immediately following entry', () => {
    const result = fill('# @generate hex:8\nTOKEN=\nUNANNOTATED=\n')
    expect(result.filled).toEqual(['TOKEN'])
    expect(result.text).toContain('UNANNOTATED=\n')
  })
  it('reads namespaced groups, stopping at comments and blank lines', () => {
    const result = parseDirectives(
      '# @migenv generate pair:arg\nPUBLIC=\nPRIVATE=\n\nOTHER=\n# @generate hex:8\nTOKEN=\n# end\nLAST=\n',
    )
    expect(result.generate).toEqual([
      { name: 'pair', arg: 'arg', keys: ['PUBLIC', 'PRIVATE'], line: 1 },
      { name: 'hex', arg: '8', keys: ['TOKEN'], line: 6 },
    ])
    expect(result.warnings).toEqual([])
    const invalid = parseDirectives(
      '# @generate hex:sensitive:bad\nA=\n# @generate\nB=\n# @generate hex\n\nC=\n',
    )
    expect(invalid.warnings).toHaveLength(3)
    expect(JSON.stringify(invalid.warnings)).not.toContain('sensitive')
  })

  it('fills built-in groups independently and preserves non-empty and protected values', () => {
    const text =
      '\uFEFF# @generate hex:8\r\nexport TOKEN = "" # keep\r\nEXISTING="private"\r\n# @generate hex:8\r\nKEEP=\r\n# @generate hex:8\r\nLAST='
    const result = fill(text, { protect: ['KEEP'] })
    expect(result.filled).toEqual(['TOKEN', 'LAST'])
    expect(result.text).toMatch(/export TOKEN = [a-f0-9]{16} # keep\r\n/)
    expect(result.text).toContain('EXISTING="private"\r\n# @generate hex:8\r\nKEEP=\r\n')
    expect(result.text.startsWith('\uFEFF')).toBe(true)
    expect(result.text.endsWith('\n')).toBe(false)
    expect(result.protectedSkips).toEqual([{ key: 'KEEP', action: 'fill' }])
    expect(fill(result.text, { protect: ['KEEP'] }).text).toBe(result.text)
  })

  it.each([1, 2, 3, 31, 32, 33, 65536])('encodes %i random bytes correctly', (size) => {
    const hex = generators.hex({ keys: ['A'], arg: String(size) }).A as string
    const base64 = generators.base64url({ keys: ['B'], arg: String(size) }).B as string
    expect(hex).toMatch(new RegExp(`^[a-f0-9]{${size * 2}}$`))
    expect(base64).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(Buffer.from(base64, 'base64url')).toHaveLength(size)
    expect(Buffer.from(base64, 'base64url').toString('base64url')).toBe(base64)
  })

  it('generates UUID v4 and defaults to 32 random bytes', () => {
    expect(generators.uuid({ keys: ['A'] }).A).toMatch(
      /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
    )
    expect(generators.hex({ keys: ['A'] }).A).toHaveLength(64)
    expect(generators.base64url({ keys: ['A'] }).A).toHaveLength(43)
    const result = fill('# @generate hex\nA=\n# @generate hex\nB=\n')
    expect(dotenv(result.text).A).not.toBe(dotenv(result.text).B)
  })

  it.each([
    'hex:0',
    'hex:-1',
    'hex:1.5',
    'hex:65537',
    'base64url:bad',
    'uuid:32',
    'missing',
    'toString',
  ])('rejects %s without leaking arguments', (spec) => {
    expect(() => fill(`# @generate ${spec}\nA=\n`)).toThrow(
      expect.objectContaining({ code: 'GENERATION_FAILED' }),
    )
  })

  it('generates paired values once and skips partially initialized or protected pairs', () => {
    const pair = vi.fn<Generator>(({ keys, arg }) => {
      expect(keys).toEqual(['PUBLIC', 'PRIVATE'])
      expect(arg).toBe('arg')
      return { PUBLIC: 'public-value', PRIVATE: 'private-value' }
    })
    const text = '# @generate pair:arg\nPUBLIC=\nPRIVATE=\n'
    const options = { generators: { pair } }
    const result = fill(text, options)
    expect(result.filled).toEqual(['PUBLIC', 'PRIVATE'])
    expect(fill(result.text, options).changed).toBe(false)
    expect(fill(text, { ...options, protect: ['PRIVATE'] }).changed).toBe(false)
    expect(fill(text.replace('PUBLIC=', 'PUBLIC=existing'), options).warnings).toEqual([
      expect.objectContaining({ code: 'generation-conflict' }),
    ])
    expect(pair).toHaveBeenCalledTimes(1)
  })

  it('skips duplicate keys instead of creating conflicting secrets', () => {
    const text = '# @generate hex\nTOKEN=\nTOKEN=existing\n'
    expect(fill(text).text).toBe(text)
    expect(fill(text, { duplicates: 'first' }).text).toBe(text)
    expect(() => fill(text, { duplicates: 'error' })).toThrow(
      expect.objectContaining({ code: 'DUPLICATE_KEY' }),
    )
  })

  it('quotes generated values without changing the value dotenv reads', () => {
    for (const value of [
      'with spaces',
      'hash#value',
      "single'quote",
      'double"quote',
      'a\\nb',
      "a'\\nb",
    ]) {
      const result = fill('# @generate custom\nA=\n', {
        generators: { custom: () => ({ A: value }) },
      })
      expect(dotenv(result.text).A).toBe(value)
    }
  })

  it('rejects failed, incomplete and unsafe custom output without leaking secrets', () => {
    const outputs = [
      { A: '' },
      { A: 'secret\nINJECTED=value' },
      { OTHER: 'secret' },
      { A: 'secret', EXTRA: 'secret' },
      { A: 'secret\\' },
    ]
    for (const output of outputs) {
      expect(() =>
        fill('# @generate custom\nA=\n', { generators: { custom: () => output } }),
      ).toThrow(expect.objectContaining({ code: 'GENERATION_FAILED' }))
    }
    try {
      fill('# @generate custom\nA=\n', {
        generators: {
          custom: () => {
            throw new Error('secret-value')
          },
        },
      })
      expect.unreachable()
    } catch (error) {
      expect(String(error)).not.toContain('secret-value')
      expect(error).not.toHaveProperty('cause')
    }
  })

  it('keeps unknown lines unless strict and never generates without opting in to align', () => {
    const template = '# @generate hex:8\nTOKEN=\n'
    expect(align('', template).text).toBe(template)
    const current = 'TOKEN=\nprivate unknown line\n'
    const aligned = align(current, template, { fill: true, reorder: false })
    expect(aligned.filled).toEqual(['TOKEN'])
    expect(aligned.text).toContain('private unknown line\n')
    expect(align(aligned.text, template, { fill: true, reorder: false }).text).toBe(aligned.text)
    expect(() => fill('# @generate hex\nA=\nunknown\n', { strict: true })).toThrow(
      expect.objectContaining({ code: 'UNKNOWN_LINE' }),
    )
  })

  test.prop([fc.string().filter((value) => !/[\r\n]/.test(value))])(
    'never changes a non-empty current entry',
    (value) => {
      const text = `# @generate hex:8\nTOKEN=${value}\n`
      const entry = parse(text).nodes.find((node) => node.kind === 'entry')
      if (entry?.kind === 'entry' && !entry.isEmpty) expect(fill(text).text).toBe(text)
      const result = fill(text)
      expect(fill(result.text).text).toBe(result.text)
    },
  )
})
