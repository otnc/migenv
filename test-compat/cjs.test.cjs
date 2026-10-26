const assert = require('node:assert/strict')
const { mkdtemp, readFile, rm, writeFile } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { test } = require('node:test')
const { align } = require('migenv')
const { migrateFile } = require('migenv/node')

test('align works through require', () => {
  assert.equal(align('B=2\nA=1\n', 'A=\nB=\n').text, 'A=1\nB=2\n')
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
