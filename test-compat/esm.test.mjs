import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { align, parseDirectives, prune, fill, setValues } from 'migenv'
import { migrateFile, pruneFile, fillFile } from 'migenv/node'

const fixtures = fileURLToPath(new URL('../test/fixtures/align', import.meta.url))

test('setValues works through import', () => {
  const values = new Map([
    ['A', 'new'],
    ['B', '"quoted # value"'],
  ])
  const result = setValues('A=old\r\nKEEP=private\r\n', values)
  assert.equal(result.text, 'A=new\r\nKEEP=private\r\nB="quoted # value"\r\n')
  assert.deepEqual(result.updated, ['A'])
  assert.deepEqual(result.added, ['B'])
  assert.equal(setValues(result.text, values).changed, false)
  assert.equal(setValues('A=old\n', values, { protect: ['A'], add: false }).text, 'A=old\n')
})

test('generation APIs work through import on every supported Node version', async () => {
  assert.equal(
    fill('# @generate custom\nA=\n', { generators: { custom: () => ({ A: 'generated' }) } }).text,
    '# @generate custom\nA=generated\n',
  )
  const dir = await mkdtemp(join(tmpdir(), 'migenv-compat-fill-'))
  try {
    await writeFile(join(dir, 'template.env'), '# @generate hex:8\nA=\n')
    await writeFile(join(dir, 'current.env'), 'A=\n')
    assert.deepEqual((await fillFile(join(dir, 'current.env'), join(dir, 'template.env'))).filled, [
      'A',
    ])
    assert.match(await readFile(join(dir, 'current.env'), 'utf8'), /^A=[a-f0-9]{16}\n$/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('migration APIs work through import', async () => {
  const template = '# @retired OLD\n'
  assert.equal(prune('OLD=x\nKEEP=y\n', parseDirectives(template).retired).text, 'KEEP=y\n')
  const dir = await mkdtemp(join(tmpdir(), 'migenv-compat-prune-'))
  try {
    await writeFile(join(dir, 'template.env'), template)
    await writeFile(join(dir, 'current.env'), 'OLD=x\nKEEP=y\n')
    const result = await pruneFile(join(dir, 'current.env'), join(dir, 'template.env'))
    assert.deepEqual(result.removed, ['OLD'])
    assert.equal(await readFile(join(dir, 'current.env'), 'utf8'), 'KEEP=y\n')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('align matches every fixture through import', () => {
  for (const name of readdirSync(fixtures)) {
    const read = (file) => readFileSync(join(fixtures, name, file), 'utf8')
    const options = existsSync(join(fixtures, name, 'options.json'))
      ? JSON.parse(read('options.json'))
      : undefined
    assert.equal(
      align(read('current.env'), read('template.env'), options).text,
      read('expected.env'),
      name,
    )
  }
})

test('migrateFile rewrites a file and backs it up through import', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'migenv-compat-'))
  try {
    await writeFile(join(dir, '.env.example'), 'A=\nB=default\n')
    await writeFile(join(dir, '.env'), 'B=2\nA=1\n')
    const result = await migrateFile(join(dir, '.env'), join(dir, '.env.example'), { backup: true })
    assert.equal(await readFile(join(dir, '.env'), 'utf8'), 'A=1\nB=2\n')
    assert.equal(await readFile(result.backupPath, 'utf8'), 'B=2\nA=1\n')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
