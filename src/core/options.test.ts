import { describe, expect, it } from 'vitest'
import { type MigenvOptions, resolveOptions } from './options'

describe('resolveOptions', () => {
  it('uses the documented defaults', () => {
    expect(resolveOptions()).toMatchObject({
      add: true,
      rename: true,
      fill: false,
      generators: {},
      remove: false,
      reorder: true,
      useTemplateDefaults: true,
      extrasHeader: '# ---- Not in template (review manually) ----',
      newline: 'template',
      duplicates: 'last',
      strict: false,
      backup: false,
      backupDir: undefined,
      create: false,
      dryRun: false,
    })
    expect(resolveOptions().isProtected('ANY', '')).toBe(false)
  })

  it('lets later layers win and ignores undefined', () => {
    const options = resolveOptions({ remove: true, add: false }, { remove: undefined, add: true })
    expect(options).toMatchObject({ remove: true, add: true })
  })

  it('combines protect from every layer', () => {
    const { isProtected } = resolveOptions(
      { protect: ['DATABASE_URL'] },
      { protect: ['*_SECRET'] },
      { protect: (_key, rawValue) => rawValue.startsWith('vault:') },
    )
    expect(isProtected('DATABASE_URL', '')).toBe(true)
    expect(isProtected('SESSION_SECRET', '')).toBe(true)
    expect(isProtected('TOKEN', 'vault:x')).toBe(true)
    expect(isProtected('TOKEN', 'x')).toBe(false)
  })

  it.each([
    ['*_SECRET', 'A_SECRET', true],
    ['*_SECRET', 'A_SECRET_2', false],
    ['API.*', 'APIXKEY', false],
  ])('pattern %s matches %s: %s', (pattern, key, matches) => {
    expect(resolveOptions({ protect: [pattern] }).isProtected(key, '')).toBe(matches)
  })

  it.each<object>([
    { remvoe: true },
    { add: 'yes' },
    { newline: 'cr' },
    { toString: 'x' },
    { fill: 'yes' },
    { generators: null },
    { generators: { custom: 'bad' } },
  ])('rejects %o', (options) => {
    expect(() => resolveOptions(options as unknown as MigenvOptions)).toThrow(
      expect.objectContaining({ code: 'INVALID_OPTION' }),
    )
  })
})

describe('extract options', () => {
  it('defaults to dropping commented-out entries and keeping no values', () => {
    const options = resolveOptions()
    expect(options.commentedEntries).toBe('remove')
    expect(options.isValueKept('PORT', '3000')).toBe(false)
  })

  it('combines keepValues from every layer, separately from protect', () => {
    const options = resolveOptions(
      { keepValues: ['PORT'] },
      { keepValues: (key) => key.startsWith('PUBLIC_') },
    )
    expect(options.isValueKept('PORT', '')).toBe(true)
    expect(options.isValueKept('PUBLIC_URL', '')).toBe(true)
    expect(options.isProtected('PORT', '')).toBe(false)
  })

  it.each<object>([{ commentedEntries: 'drop' }, { keepValues: 'PORT' }])(
    'rejects %o',
    (options) => {
      expect(() => resolveOptions(options as unknown as MigenvOptions)).toThrow(
        expect.objectContaining({ code: 'INVALID_OPTION' }),
      )
    },
  )
})
