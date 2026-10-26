import { randomBytes } from 'node:crypto'
import { constants } from 'node:fs'
import {
  chmod,
  copyFile,
  mkdir,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import {
  type AlignResult,
  align,
  MigenvError,
  type MigenvOptions,
  resolveOptions,
} from '../core/index'

export interface MigrateFileResult extends AlignResult {
  readonly file: string
  /** Whether the file was written. `false` when nothing changed or with `dryRun: true`. */
  readonly written: boolean
  /** Whether the file did not exist and was created from the template. */
  readonly created: boolean
  /** Where the original was copied with `backup: true`; `undefined` when no backup was made. */
  readonly backupPath: string | undefined
}

/** Env files hold secrets, so new files and backups are readable by the owner only. */
const PRIVATE_MODE = 0o600
const RENAME_RETRIES = 5

/**
 * Aligns the env file at `file` with the template at `template` and writes the result in place.
 * The file is left untouched, backup included, when the result is the same as before.
 *
 * @throws {MigenvError} `FILE_NOT_FOUND` when `file` does not exist and `create` is off, plus the errors of `align`.
 *
 * @example
 * const result = await migrateFile('.env', '.env.example', {
 *   remove: true,
 *   protect: ['SESSION_SECRET'],
 *   backup: true,
 * })
 * console.log(result.added, result.removed, result.backupPath)
 */
export async function migrateFile(
  file: string,
  template: string,
  options?: MigenvOptions,
): Promise<MigrateFileResult> {
  const { create, dryRun, backup, backupDir } = resolveOptions(options)
  const templateText = await readFile(template, 'utf8')
  const currentText = await unlessMissing(readFile(file, 'utf8'), undefined)
  if (currentText === undefined && !create) {
    throw new MigenvError(
      'FILE_NOT_FOUND',
      `${file} does not exist. Pass create: true to create it from the template.`,
    )
  }

  const result = align(currentText ?? '', templateText, options)
  const created = currentText === undefined
  const written = !dryRun && (created || result.changed)
  let backupPath: string | undefined
  if (written) {
    if (backup && !created) backupPath = await backUp(file, backupDir)
    await writeFileAtomic(file, result.text)
  }

  return { ...result, file, written, created: created && written, backupPath }
}

/**
 * Replaces the file at `path` with `text` without ever leaving it half written: the text goes to a temporary file in the same directory, which is then renamed over `path`.
 * An existing file keeps its permissions, a symbolic link keeps pointing at the file it points to, and a new file is created with mode `0o600`.
 *
 * @example
 * await writeFileAtomic('.env', 'API_KEY=abc\n')
 */
export async function writeFileAtomic(path: string, text: string): Promise<void> {
  const target = await unlessMissing(realpath(path), path)
  const mode = await unlessMissing(
    stat(target).then((stats) => stats.mode & 0o777),
    PRIVATE_MODE,
  )
  const temp = join(dirname(target), `.${basename(target)}.${randomBytes(6).toString('hex')}.tmp`)
  try {
    await writeFile(temp, text, { mode, flag: 'wx' })
    // The umask can strip bits from the mode given to writeFile.
    await chmod(temp, mode)
    await renameWithRetry(temp, target)
  } catch (error) {
    await rm(temp, { force: true })
    throw error
  }
}

async function backUp(file: string, backupDir: string | undefined): Promise<string> {
  const dir = backupDir ?? dirname(file)
  await mkdir(dir, { recursive: true })
  const timestamp = new Date().toISOString().replace(/[-:.]/g, '')
  const backupPath = join(dir, `${basename(file)}.bak.${timestamp}`)
  await copyFile(await realpath(file), backupPath, constants.COPYFILE_EXCL)
  await chmod(backupPath, PRIVATE_MODE)
  return backupPath
}

/** Resolves to `fallback` instead of rejecting when the path does not exist. */
async function unlessMissing<T, F>(promise: Promise<T>, fallback: F): Promise<T | F> {
  try {
    return await promise
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) return fallback
    throw error
  }
}

/** On Windows, antivirus software and editors holding the file open make rename fail for a moment. */
async function renameWithRetry(from: string, to: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(from, to)
      return
    } catch (error) {
      const transient =
        process.platform === 'win32' &&
        (hasErrorCode(error, 'EPERM') ||
          hasErrorCode(error, 'EBUSY') ||
          hasErrorCode(error, 'EACCES'))
      if (!transient || attempt >= RENAME_RETRIES) throw error
      await sleep(50 * 2 ** attempt)
    }
  }
}

function hasErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code
}
