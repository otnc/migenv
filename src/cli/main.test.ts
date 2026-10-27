import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import { stripVTControlCharacters } from 'node:util'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { run } from './main'

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'migenv-cli-'))
  await writeFile(join(dir, '.env.example'), 'APP_URL=http://localhost\nPORT=3000\nSECRET=\n')
  await writeFile(join(dir, '.env'), 'SECRET=s3cr3t\nAPP_URL=https://dev\nOLD=abc123\n')
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

async function cli(
  args: string[],
  { env = {}, interactive = false }: { env?: Record<string, string>; interactive?: boolean } = {},
): Promise<{ code: number; output: string }> {
  let output = ''
  const capture = (): NodeJS.WriteStream => {
    const stream = new PassThrough()
    stream.on('data', (chunk: Buffer) => (output += chunk.toString()))
    return stream as unknown as NodeJS.WriteStream
  }
  const code = await run(args, {
    cwd: dir,
    env: { LANG: 'en_US.UTF-8', ...env },
    stdout: capture(),
    stderr: capture(),
    interactive,
  })
  return { code, output: stripVTControlCharacters(output) }
}

const readEnv = (name = '.env'): Promise<string> => readFile(join(dir, name), 'utf8')

describe('fill and init', () => {
  it('fills from template directives without aligning or printing generated values', async () => {
    await writeFile(join(dir, '.env.example'), '# @generate hex:8\nTOKEN=\n\nMISSING=\n')
    await writeFile(join(dir, '.env'), '# local\nEXISTING=private\nTOKEN=\n')
    const before = await readEnv()
    expect((await cli(['fill', '--dry-run', '--backup'])).code).toBe(0)
    expect(await readEnv()).toBe(before)
    const result = await cli(['fill', '--backup'])
    expect(result.code).toBe(0)
    const text = await readEnv()
    expect(text).toMatch(/^# local\nEXISTING=private\nTOKEN=[a-f0-9]{16}\n$/)
    expect(result.output).toContain('generated')
    expect(result.output).not.toContain(text.match(/TOKEN=(.+)/)?.[1])
    expect(result.output).not.toContain('private')
    expect((await cli(['fill'])).output).toContain('up to date')
  })

  it('initializes missing files and preserves values on repeated init', async () => {
    await writeFile(join(dir, '.dev.vars.example'), '# @generate uuid\nTOKEN=\n\nPORT=3000\n')
    expect((await cli(['init', '.dev.vars', '--dry-run'])).code).toBe(0)
    await expect(readEnv('.dev.vars')).rejects.toMatchObject({ code: 'ENOENT' })
    expect((await cli(['init', '.dev.vars'])).code).toBe(0)
    const initialized = await readEnv('.dev.vars')
    expect(initialized).toMatch(/TOKEN=[a-f0-9-]{36}/)
    expect(initialized).toContain('PORT=3000')
    await cli(['init', '.dev.vars'])
    expect(await readEnv('.dev.vars')).toBe(initialized)
  })

  it('supports align --fill and localized generation errors', async () => {
    await writeFile(join(dir, '.env.example'), '# @generate base64url:8\nTOKEN=\n')
    expect((await cli(['align', '--fill', '--protect', 'SECRET'])).code).toBe(0)
    expect(await readEnv()).toMatch(/TOKEN=[A-Za-z0-9_-]{11}\n/)
    await writeFile(join(dir, '.env.example'), '# @generate unknown:private-argument\nNEW=\n')
    const before = await readEnv()
    const result = await cli(['init', '--lang', 'ja'])
    expect(result.code).toBe(2)
    expect(result.output).toContain('値を生成できませんでした')
    expect(result.output).not.toContain('private-argument')
    expect(await readEnv()).toBe(before)
    for (const command of ['fill', 'init']) expect((await cli([command, '--help'])).code).toBe(0)
  })
})

describe('template migrations', () => {
  it('renames through align and previews the same migration without printing values', async () => {
    await writeFile(join(dir, '.env.example'), '# @renamed-from OLD\nNEW=\n# @retired SECRET\n')
    const before = await readEnv()
    const preview = await cli(['diff'])
    expect(preview.output).toContain('OLD → NEW')
    expect(preview.output).not.toContain('abc123')
    expect(preview.output).not.toContain('s3cr3t')
    expect(await readEnv()).toBe(before)
    expect((await cli(['align', '--no-rename'])).code).toBe(0)
    expect(await readEnv()).toContain('OLD=abc123')
    await cli(['align'])
    expect(await readEnv()).toContain('NEW=abc123')
  })

  it('requires confirmation for prune, supports dry runs and backs up only when writing', async () => {
    await writeFile(join(dir, '.env.example'), '# @retired OLD\n')
    const before = await readEnv()
    expect((await cli(['prune'])).code).toBe(2)
    expect(await readEnv()).toBe(before)
    const preview = await cli(['prune', '--dry-run', '--backup'])
    expect(preview.code).toBe(0)
    expect(preview.output).toContain('OLD')
    expect(preview.output).not.toContain('abc123')
    expect(await readEnv()).toBe(before)
    const result = await cli(['prune', '--yes', '--backup'])
    expect(result.code).toBe(0)
    expect(result.output).toContain('backup:')
    expect(await readEnv()).toBe(before.replace('OLD=abc123\n', ''))
    const { readdir } = await import('node:fs/promises')
    const backup = (await readdir(dir)).find((name) => name.startsWith('.env.bak.'))
    expect(backup).toBeDefined()
    expect(await readEnv(backup)).toBe(before)
  })

  it('prunes only retired keys, honors protection and leaves comments and order alone', async () => {
    await writeFile(join(dir, '.env.example'), '# @retired OLD SECRET\n')
    const before = await readEnv()
    expect((await cli(['prune', '--yes', '--protect', 'SECRET'])).code).toBe(0)
    expect(await readEnv()).toBe(before.replace('OLD=abc123\n', ''))
  })
})

describe('migenv align', () => {
  it('rewrites the file, lists the keys it touched and never prints a value', async () => {
    const { code, output } = await cli([])
    expect(code).toBe(0)
    expect(await readEnv()).toContain('APP_URL=https://dev\nPORT=3000\nSECRET=s3cr3t\n')
    expect(output).toMatch(/\+ PORT/)
    expect(output).toMatch(/\? OLD/)
    for (const value of ['s3cr3t', 'https://dev', 'abc123']) expect(output).not.toContain(value)
  })

  it('refuses --remove without --yes when nobody can answer, and leaves the file alone', async () => {
    const before = await readEnv()
    const { code, output } = await cli(['align', '--remove'])
    expect(code).toBe(2)
    expect(output).toContain('--yes')
    expect(await readEnv()).toBe(before)
  })

  it('removes keys with --remove --yes, except the ones protected with repeated -p', async () => {
    await writeFile(join(dir, '.env'), 'OLD=1\nKEEP_A=2\nKEEP_B=3\n')
    const { code } = await cli(['align', '--remove', '--yes', '-p', 'KEEP_A', '-p', 'KEEP_B'])
    expect(code).toBe(0)
    const text = await readEnv()
    expect(text).not.toContain('OLD=')
    expect(text).toContain('KEEP_A=2')
    expect(text).toContain('KEEP_B=3')
  })

  it('finds .env.example for .env.local, and takes --template over it', async () => {
    await writeFile(join(dir, '.env.local'), 'PORT=1\n')
    await writeFile(join(dir, 'other.example'), 'OTHER=\n')
    expect((await cli(['align', '.env.local'])).code).toBe(0)
    expect(await readEnv('.env.local')).toBe('APP_URL=http://localhost\nPORT=1\nSECRET=\n')

    expect((await cli(['align', '.env.local', '-t', 'other.example', '--remove', '-y'])).code).toBe(
      0,
    )
    expect(await readEnv('.env.local')).toBe('OTHER=\n')
  })

  it('exits with 2 when no template exists or a flag value is not allowed', async () => {
    expect((await cli(['align', 'missing.env'])).code).toBe(2)
    expect((await cli(['align', '--newline', 'cr'])).code).toBe(2)
  })
})

describe('migenv check', () => {
  it('exits with 1 for an out-of-date or missing file without writing, and 0 once aligned', async () => {
    const before = await readEnv()
    expect((await cli(['check'])).code).toBe(1)
    expect(await readEnv()).toBe(before)
    expect((await cli(['check', '.env.local'])).code).toBe(1)

    await cli(['align'])
    expect((await cli(['check'])).code).toBe(0)
  })
})

describe('migenv diff', () => {
  it('lists what align would change without writing it', async () => {
    const before = await readEnv()
    const { code, output } = await cli(['diff', '--remove'])
    expect(code).toBe(0)
    expect(output).toMatch(/\+ PORT/)
    expect(output).toMatch(/- OLD/)
    expect(await readEnv()).toBe(before)
  })
})

describe('output', () => {
  it('speaks Japanese with --lang ja or a Japanese LANG', async () => {
    expect((await cli(['check', '--lang', 'ja'])).output).toContain('ずれています')
    expect((await cli(['check'], { env: { LANG: 'ja_JP.UTF-8' } })).output).toContain(
      'ずれています',
    )
    expect(
      (await cli(['check', '--lang', 'en'], { env: { LANG: 'ja_JP.UTF-8' } })).output,
    ).toContain('out of date')
  })

  it('prints help and the version', async () => {
    const help = await cli(['check', '--help'])
    expect(help.code).toBe(0)
    expect(help.output).toContain('--strict')
    expect((await cli(['--version'])).output.trim()).toMatch(/^\d+\.\d+\.\d+/)
  })
})
