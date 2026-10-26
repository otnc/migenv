import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { align } from 'migenv'
import { migrateFile } from 'migenv/node'

const fixtures = fileURLToPath(new URL('../test/fixtures/align', import.meta.url))

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
