import { describe, expect, it } from 'vitest'
import { align } from './align'
import { prune } from './prune'

const template = '# @renamed-from OLD\nNEW=default\n# @retired LEGACY\n'

describe('renaming', () => {
  it.each([true, false])(
    'keeps raw values and export formatting with reorder=%s, independently of add',
    (reorder) => {
      const current = '  export OLD = "first\nsecond" # keep\n'
      const result = align(current, template, { reorder, add: false })
      expect(result.text).toContain('  export NEW = "first\nsecond" # keep\n')
      expect(result.renamed).toEqual([{ from: 'OLD', to: 'NEW' }])
      expect(result.added).toEqual([])
      expect(result.extra).toEqual([])
      expect(align(result.text, template, { reorder, add: false }).changed).toBe(false)
    },
  )

  it('fills an empty destination without losing the source value', () => {
    const result = align('OLD=secret\nNEW=""\n', template)
    expect(result.text).toContain('NEW=secret\n')
    expect(result.text).not.toContain('OLD=')
  })

  it('keeps both non-empty values when the destination already exists', () => {
    const result = align('OLD=secret\nNEW=other\n', template)
    expect(result.text).toContain('OLD=secret\n')
    expect(result.text).toContain('NEW=other\n')
    expect(result.renamed).toEqual([])
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'rename-conflict' }))
    expect(JSON.stringify(result.warnings)).not.toContain('secret')
  })

  it.each(['OLD', 'NEW'])('honors protection of %s', (key) => {
    const result = align('OLD=secret\nNEW=\n', template, { protect: [key] })
    expect(result.text).toContain('OLD=secret\n')
    expect(result.renamed).toEqual([])
    expect(result.protectedSkips).toContainEqual({ key: 'OLD', action: 'rename' })
  })

  it('can disable renaming', () => {
    expect(align('OLD=secret\n', template, { rename: false }).renamed).toEqual([])
  })

  it('uses duplicate policy before moving a value', () => {
    expect(align('OLD=first\nOLD=last\n', template).text).toContain('NEW=last\n')
    expect(align('OLD=first\nOLD=last\n', template, { duplicates: 'first' }).text).toContain(
      'NEW=first\n',
    )
    expect(() => align('OLD=first\nOLD=last\n', template, { duplicates: 'error' })).toThrow(
      expect.objectContaining({ code: 'DUPLICATE_KEY' }),
    )
  })

  it('does not apply chains, cycles or a source shared by multiple destinations', () => {
    for (const rules of [
      '# @renamed-from A\nB=\n# @renamed-from B\nC=\n',
      '# @renamed-from A\nB=\n# @renamed-from B\nA=\n',
      '# @renamed-from A\nB=\n# @renamed-from A\nC=\n',
    ]) {
      const result = align('A=value\n', rules)
      expect(result.renamed).toEqual([])
      expect(result.text).toContain('A=value\n')
      expect(align(result.text, rules).changed).toBe(false)
    }
  })

  it('warns about retired keys without deleting them by default', () => {
    const result = align('LEGACY=secret\n', template)
    expect(result.text).toContain('LEGACY=secret\n')
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: 'retired-key', key: 'LEGACY' }),
    )
  })
})

describe('prune', () => {
  it('deletes all occurrences while preserving unrelated bytes and quoted directive-like text', () => {
    const current = '\uFEFF# keep\r\nOLD=one\r\nTEXT="a\nOLD=inside\nb"\r\nOLD=two\r\nKEEP=x'
    const result = prune(current, ['OLD'])
    expect(result.text).toBe('\uFEFF# keep\r\nTEXT="a\nOLD=inside\nb"\r\nKEEP=x')
    expect(result.removed).toEqual(['OLD'])
    expect(prune(result.text, ['OLD']).changed).toBe(false)
  })

  it('protects individual entries even among duplicates', () => {
    const result = prune('OLD=keep\nOLD=remove\n', ['OLD'], {
      protect: (_key, raw) => raw === 'keep',
    })
    expect(result.text).toBe('OLD=keep\n')
    expect(result.protectedSkips).toEqual([{ key: 'OLD', action: 'remove' }])
  })

  it('keeps unknown lines with warnings and rejects them in strict mode', () => {
    const current = 'OLD=x\nNOT AN ENTRY\n'
    expect(prune(current, ['OLD']).text).toBe('NOT AN ENTRY\n')
    expect(() => prune(current, ['OLD'], { strict: true })).toThrow(
      expect.objectContaining({ code: 'UNKNOWN_LINE' }),
    )
  })
})
