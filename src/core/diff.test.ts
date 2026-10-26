import { describe, expect, it } from 'vitest'
import { diff } from './diff'

describe('diff', () => {
  it('lists missing, empty and extra keys and spots a different order', () => {
    expect(diff('B=\nA=1\nOLD=x\n', 'A=\nB=\nC=\n')).toEqual({
      missing: ['C'],
      empty: ['B'],
      extra: ['OLD'],
      orderDiffers: true,
    })
  })

  it('reports nothing for a file that matches its template', () => {
    expect(diff('A=1\nB=2\n', '# c\nA=\nB=\n')).toEqual({
      missing: [],
      empty: [],
      extra: [],
      orderDiffers: false,
    })
  })

  it('compares the order only among keys that both files have', () => {
    expect(diff('X=1\nA=1\nB=2\n', 'A=\nY=\nB=\n').orderDiffers).toBe(false)
  })

  it('does not count a key the template has commented out as extra', () => {
    expect(diff('SENTRY_DSN=x\n', '# SENTRY_DSN=\n').extra).toEqual([])
  })

  it('uses the duplicates option to pick the value that counts', () => {
    expect(diff('A=\nA=1\n', 'A=\n').empty).toEqual([])
    expect(diff('A=\nA=1\n', 'A=\n', { duplicates: 'first' }).empty).toEqual(['A'])
  })
})
