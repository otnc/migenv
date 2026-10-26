import { describe, expect, it } from 'vitest'
import type { MigenvError } from './errors'
import { DEFAULT_OPTIONS, type MigenvOptions, resolveOptions } from './options'

function errorCodeOf(fn: () => unknown): string | undefined {
  try {
    fn()
  } catch (error) {
    return (error as MigenvError).code
  }
  return undefined
}

describe('resolveOptions', () => {
  it('fills in the defaults', () => {
    expect(resolveOptions()).toMatchObject({ ...DEFAULT_OPTIONS, backupDir: undefined })
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
    ['API.*', 'API.KEY', true],
    ['API.*', 'APIXKEY', false],
    ['*', 'ANY', true],
  ])('pattern %s matches %s: %s', (pattern, key, matches) => {
    expect(resolveOptions({ protect: [pattern] }).isProtected(key, '')).toBe(matches)
  })

  it('rejects unknown options and wrong types', () => {
    expect(errorCodeOf(() => resolveOptions({ remvoe: true } as MigenvOptions))).toBe(
      'INVALID_OPTION',
    )
    expect(errorCodeOf(() => resolveOptions({ add: 'yes' } as unknown as MigenvOptions))).toBe(
      'INVALID_OPTION',
    )
    expect(errorCodeOf(() => resolveOptions({ newline: 'cr' } as unknown as MigenvOptions))).toBe(
      'INVALID_OPTION',
    )
  })
})
