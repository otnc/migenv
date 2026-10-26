import {
  chmod,
  lstat,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { MigenvError } from '../core/errors'
import { migrateFile, writeFileAtomic } from './file'

const onWindows = process.platform === 'win32'

let dir: string
let envPath: string
let templatePath: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'migenv-'))
  envPath = join(dir, '.env')
  templatePath = join(dir, '.env.example')
  await writeFile(templatePath, 'A=\nB=default\n')
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('migrateFile', () => {
  it('rewrites the file and reports what it did', async () => {
    await writeFile(envPath, 'OLD=x\nA=1\n')
    const result = await migrateFile(envPath, templatePath, { remove: true })
    expect(await readFile(envPath, 'utf8')).toBe('A=1\nB=default\n')
    expect(result).toMatchObject({
      written: true,
      created: false,
      added: ['B'],
      removed: ['OLD'],
      backupPath: undefined,
    })
  })

  it('leaves an aligned file and its timestamp alone, without a backup', async () => {
    await writeFile(envPath, 'A=1\nB=2\n')
    const before = await stat(envPath)
    const result = await migrateFile(envPath, templatePath, { backup: true })
    expect(result).toMatchObject({ written: false, backupPath: undefined })
    expect((await stat(envPath)).mtimeMs).toBe(before.mtimeMs)
    expect(await readdir(dir)).toHaveLength(2)
  })

  it('backs up the original content before writing', async () => {
    await writeFile(envPath, 'B=2\nA=1\n')
    const backupDir = join(dir, 'backups')
    const { backupPath } = await migrateFile(envPath, templatePath, { backup: true, backupDir })
    expect(backupPath).toMatch(/[\\/]backups[\\/]\.env\.bak\.\d{8}T\d{9}Z$/)
    expect(await readFile(backupPath as string, 'utf8')).toBe('B=2\nA=1\n')
  })

  it('throws FILE_NOT_FOUND for a missing file unless create is on', async () => {
    const error = await migrateFile(envPath, templatePath).catch((e: unknown) => e)
    expect((error as MigenvError).code).toBe('FILE_NOT_FOUND')

    const result = await migrateFile(envPath, templatePath, { create: true })
    expect(result).toMatchObject({ written: true, created: true })
    expect(await readFile(envPath, 'utf8')).toBe('A=\nB=default\n')
  })

  it('writes nothing with dryRun', async () => {
    await writeFile(envPath, 'A=1\n')
    const result = await migrateFile(envPath, templatePath, { dryRun: true })
    expect(result).toMatchObject({ written: false, changed: true, text: 'A=1\nB=default\n' })
    expect(await readFile(envPath, 'utf8')).toBe('A=1\n')
  })
})

describe('writeFileAtomic', () => {
  it('leaves no temporary file behind', async () => {
    await writeFileAtomic(envPath, 'A=1\n')
    expect(await readdir(dir)).toEqual(['.env', '.env.example'])
  })

  it.skipIf(onWindows)(
    'keeps the mode of an existing file and uses 0o600 for a new one',
    async () => {
      await chmod(templatePath, 0o640)
      await writeFileAtomic(templatePath, 'A=1\n')
      expect((await stat(templatePath)).mode & 0o777).toBe(0o640)

      await writeFileAtomic(envPath, 'A=1\n')
      expect((await stat(envPath)).mode & 0o777).toBe(0o600)
    },
  )

  it.skipIf(onWindows)('writes through a symbolic link', async () => {
    await writeFile(envPath, 'A=1\n')
    const link = join(dir, 'link.env')
    await symlink(envPath, link)
    await writeFileAtomic(link, 'A=2\n')
    expect(await readFile(envPath, 'utf8')).toBe('A=2\n')
    expect((await lstat(link)).isSymbolicLink()).toBe(true)
  })
})
