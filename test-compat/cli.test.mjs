import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const bin = fileURLToPath(new URL('../dist/cli/index.mjs', import.meta.url))

function migenv(args, cwd) {
  return spawnSync(process.execPath, [bin, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, LANG: 'en_US.UTF-8' },
  })
}

test('the CLI checks and aligns a file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'migenv-compat-cli-'))
  try {
    await writeFile(join(dir, '.env.example'), 'A=\nB=default\n')
    await writeFile(join(dir, '.env'), 'B=2\nA=1\n')
    assert.equal(migenv(['check'], dir).status, 1)
    assert.equal(migenv(['align'], dir).status, 0)
    assert.equal(await readFile(join(dir, '.env'), 'utf8'), 'A=1\nB=2\n')
    assert.equal(migenv(['check'], dir).status, 0)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
