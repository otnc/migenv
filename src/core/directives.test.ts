import { describe, expect, it } from 'vitest'
import { parseDirectives } from './directives'

describe('parseDirectives', () => {
  it('reads namespaced renames and deduplicates retired keys without reading quoted contents', () => {
    const result = parseDirectives(
      'TEXT="a\n# @retired SECRET\nb"\n# @migenv renamed-from OLD\nNEW=\n# @retired A B A\n',
    )
    expect([...result.renamedFrom]).toEqual([['NEW', 'OLD']])
    expect(result.retired).toEqual(['A', 'B'])
    expect(result.warnings).toEqual([])
  })

  it('warns about malformed, detached and unknown directives without echoing their arguments', () => {
    const result = parseDirectives(
      '# @renamed-from OLD\n\nNEW=\n# @retired bad=value\n# @oops sensitive-value\n',
    )
    expect(result.renamedFrom.size).toBe(0)
    expect(result.retired).toEqual([])
    expect(result.warnings).toHaveLength(3)
    expect(JSON.stringify(result.warnings)).not.toContain('sensitive-value')
    expect(JSON.stringify(result.warnings)).not.toContain('bad=value')
  })
})
