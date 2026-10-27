const assert = require('node:assert/strict')
const { mkdtemp, readFile, rm, writeFile } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { test } = require('node:test')
const { align, parseDirectives, prune, fill, setValues } = require('migenv')
const { migrateFile, pruneFile, fillFile } = require('migenv/node')

test('setValues works through require', () => {
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

test('generation APIs work through require on every supported Node version', async () => {
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

test('align works through require', () => {
  assert.equal(align('B=2\nA=1\n', 'A=\nB=\n').text, 'A=1\nB=2\n')
})

test('migration APIs work through require', async () => {
  const template = '# @renamed-from OLD\nNEW=\n# @retired LEGACY\n'
  assert.deepEqual(align('OLD=secret\n', template).renamed, [{ from: 'OLD', to: 'NEW' }])
  assert.equal(prune('LEGACY=x\nKEEP=y\n', parseDirectives(template).retired).text, 'KEEP=y\n')
  const dir = await mkdtemp(join(tmpdir(), 'migenv-compat-prune-'))
  try {
    await writeFile(join(dir, 'template.env'), template)
    await writeFile(join(dir, 'current.env'), 'LEGACY=x\nKEEP=y\n')
    const result = await pruneFile(join(dir, 'current.env'), join(dir, 'template.env'))
    assert.deepEqual(result.removed, ['LEGACY'])
    assert.equal(await readFile(join(dir, 'current.env'), 'utf8'), 'KEEP=y\n')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('migrateFile rewrites a file through require', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'migenv-compat-'))
  try {
    await writeFile(join(dir, '.env.example'), 'A=\nB=default\n')
    await writeFile(join(dir, '.env'), 'A=1\n')
    const result = await migrateFile(join(dir, '.env'), join(dir, '.env.example'))
    assert.deepEqual(result.added, ['B'])
    assert.equal(await readFile(join(dir, '.env'), 'utf8'), 'A=1\nB=default\n')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
