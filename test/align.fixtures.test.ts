import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { align } from '../src/core/align'
import type { MigenvOptions } from '../src/core/options'

const root = join(import.meta.dirname, 'fixtures', 'align')

function read(dir: string, name: string): string {
  return readFileSync(join(root, dir, name), 'utf8')
}

describe.each(readdirSync(root))('%s', (dir) => {
  const current = read(dir, 'current.env')
  const template = read(dir, 'template.env')
  const expected = read(dir, 'expected.env')
  const options = existsSync(join(root, dir, 'options.json'))
    ? (JSON.parse(read(dir, 'options.json')) as MigenvOptions)
    : undefined

  it('matches expected.env', () => {
    expect(align(current, template, options).text).toBe(expected)
  })
})
