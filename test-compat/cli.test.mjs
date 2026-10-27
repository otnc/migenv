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

test('the CLI initializes and fills without relying on global Web Crypto', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'migenv-compat-generation-'))
  try {
    await writeFile(
      join(dir, '.env.example'),
      '# @generate hex:8\nTOKEN=\n\n# @generate base64url:8\nKEY=\n\n# @generate uuid\nID=\n',
    )
    assert.equal(migenv(['init', '--dry-run'], dir).status, 0)
    await assert.rejects(readFile(join(dir, '.env')), { code: 'ENOENT' })
    const initialized = migenv(['init'], dir)
    assert.equal(initialized.status, 0, initialized.stderr)
    const text = await readFile(join(dir, '.env'), 'utf8')
    assert.match(text, /TOKEN=[a-f0-9]{16}\n/)
    assert.match(text, /KEY=[A-Za-z0-9_-]{11}\n/)
    assert.match(text, /ID=[a-f0-9-]{36}\n/)
    assert.ok(!`${initialized.stdout}${initialized.stderr}`.includes(text.match(/TOKEN=(.+)/)[1]))
    assert.equal(migenv(['init'], dir).status, 0)
    assert.equal(await readFile(join(dir, '.env'), 'utf8'), text)
    await writeFile(join(dir, '.env'), 'TOKEN=\nKEY=\nID=\n')
    assert.equal(migenv(['fill'], dir).status, 0)
    assert.match(
      await readFile(join(dir, '.env'), 'utf8'),
      /^TOKEN=[a-f0-9]{16}\nKEY=[A-Za-z0-9_-]{11}\nID=[a-f0-9-]{36}\n$/,
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('the CLI renames and prunes without printing values', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'migenv-compat-migration-'))
  try {
    await writeFile(join(dir, '.env.example'), '# @renamed-from OLD\nNEW=\n# @retired LEGACY\n')
    await writeFile(join(dir, '.env'), 'OLD=private-value\nLEGACY=retired-value\n')
    const aligned = migenv(['align'], dir)
    assert.equal(aligned.status, 0)
    assert.ok(!`${aligned.stdout}${aligned.stderr}`.includes('private-value'))
    const before = await readFile(join(dir, '.env'), 'utf8')
    assert.equal(migenv(['prune'], dir).status, 2)
    assert.equal(await readFile(join(dir, '.env'), 'utf8'), before)
    const pruned = migenv(['prune', '--yes'], dir)
    assert.equal(pruned.status, 0)
    assert.ok(!`${pruned.stdout}${pruned.stderr}`.includes('retired-value'))
    const text = await readFile(join(dir, '.env'), 'utf8')
    assert.ok(text.includes('NEW=private-value\n'))
    assert.ok(!text.includes('LEGACY='))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
