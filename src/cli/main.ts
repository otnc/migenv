import { existsSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import {
  type ArgsDef,
  type CommandDef,
  defineCommand,
  type ParsedArgs,
  renderUsage,
  runCommand,
} from 'citty'
import { type ConsolaInstance, createConsola, LogLevels } from 'consola'
import { version } from '../../package.json'
import type { MigenvOptions } from '../core/index'
import { migrateFile } from '../node/index'
import { commandArgs, flagValues, toMigenvOptions } from './args'
import { createTranslator, type Translate } from './i18n'
import { detectLocale } from './locale'
import { templateCandidates } from './pairs'
import { changeLines, warningMessages } from './report'

/** Everything the CLI takes from the process, so tests can run it in a temporary directory. */
export interface CliIo {
  readonly cwd: string
  readonly env: Readonly<Record<string, string | undefined>>
  readonly stdout: NodeJS.WriteStream
  readonly stderr: NodeJS.WriteStream
  /** Whether someone can answer a prompt: stdin and stdout are both terminals. */
  readonly interactive: boolean
}

interface Context {
  readonly io: CliIo
  readonly t: Translate
  readonly logger: ConsolaInstance
  /** citty drops a subcommand's return value, so commands report their exit code here. */
  readonly outcome: { exitCode: number }
}

interface Pair {
  readonly file: string
  readonly template: string
}

type Mode = 'align' | 'check' | 'diff'

const EXIT_OUT_OF_DATE = 1
const EXIT_USAGE = 2

/**
 * Runs the CLI and returns the exit code: 0 for success, 1 when `check` finds a file out of date, 2 for usage errors, missing files and parse failures.
 * @example
 * process.exitCode = await run(process.argv.slice(2), { cwd: process.cwd(), env: process.env, stdout: process.stdout, stderr: process.stderr, interactive: true })
 */
export async function run(rawArgs: readonly string[], io: CliIo): Promise<number> {
  const t = createTranslator(detectLocale(flagValues(rawArgs, ['--lang']).at(-1), io.env))
  const context: Context = {
    io,
    t,
    // consola lowers the level in test and CI environments on its own; the CLI's output must not depend on that.
    logger: createConsola({
      stdout: io.stdout,
      stderr: io.stderr,
      level: LogLevels.info,
      formatOptions: { date: false },
    }),
    outcome: { exitCode: 0 },
  }
  const main = mainCommand(context)

  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    const subCommand = rawArgs.find((arg) => arg === 'align' || arg === 'check' || arg === 'diff')
    const usage =
      subCommand === undefined
        ? await renderUsage(main)
        : await renderUsage(commandFor(subCommand, context), main)
    io.stdout.write(`${usage}\n`)
    return 0
  }
  if (rawArgs.length === 1 && (rawArgs[0] === '--version' || rawArgs[0] === '-v')) {
    io.stdout.write(`${version}\n`)
    return 0
  }

  try {
    await runCommand(main, { rawArgs: [...rawArgs] })
    return context.outcome.exitCode
  } catch (error) {
    // citty throws CLIError for an unknown command or a value outside an enum's choices.
    if (error instanceof Error && error.name === 'CLIError') {
      context.logger.error(t('error.usage', { detail: error.message }))
      return EXIT_USAGE
    }
    throw error
  }
}

function mainCommand(context: Context): CommandDef {
  const { t } = context
  // The default command reads the same flags as `align`, so citty can tell flag values from a command name.
  const flags = Object.fromEntries(
    Object.entries(commandArgs(t, true)).filter(([name]) => name !== 'files'),
  )
  return defineCommand({
    meta: { name: 'migenv', version, description: t('command.main') },
    args: flags,
    subCommands: {
      align: commandFor('align', context),
      check: commandFor('check', context),
      diff: commandFor('diff', context),
    },
    default: 'align',
  })
}

function commandFor(mode: Mode, context: Context): CommandDef<ArgsDef> {
  const { t } = context
  return defineCommand({
    meta: { name: mode, description: t(`command.${mode}`) },
    args: commandArgs(t, mode === 'align'),
    run: async ({ args, rawArgs }) => {
      context.outcome.exitCode = await runMode(mode, args, rawArgs, context)
    },
  })
}

async function runMode(
  mode: Mode,
  args: ParsedArgs,
  rawArgs: readonly string[],
  context: Context,
): Promise<number> {
  const options = toMigenvOptions(args, rawArgs)
  const pairs = findPairs(args, context)
  let exitCode = pairs.some((pair) => pair === undefined) ? EXIT_USAGE : 0

  for (const pair of pairs) {
    if (pair === undefined) continue
    const work =
      mode === 'align'
        ? alignPair(pair, options, args.yes === true, context)
        : previewPair(mode, pair, options, context)
    const code = await work.catch((error: unknown) => reportError(error, pair, context))
    exitCode = Math.max(exitCode, code)
  }
  if (mode === 'check' && exitCode === EXIT_OUT_OF_DATE)
    context.logger.info(context.t('check.hint'))
  return exitCode
}

/** The file and template for each positional argument, or `undefined` where no template exists. */
function findPairs(args: ParsedArgs, { io, t, logger }: Context): (Pair | undefined)[] {
  const files = args._.length > 0 ? args._ : ['.env']
  const template = typeof args.template === 'string' ? resolve(io.cwd, args.template) : undefined
  return files.map((name) => {
    const file = resolve(io.cwd, name)
    if (template !== undefined) return { file, template }
    const candidates = templateCandidates(file)
    const found = candidates.find((candidate) => existsSync(candidate))
    if (found !== undefined) return { file, template: found }
    logger.error(
      t('error.templateNotFound', {
        file: display(file, io),
        tried: candidates.map((candidate) => display(candidate, io)).join(', '),
      }),
    )
    return undefined
  })
}

async function alignPair(
  pair: Pair,
  options: MigenvOptions,
  confirmed: boolean,
  context: Context,
): Promise<number> {
  const { io, t, logger } = context
  const file = display(pair.file, io)
  if (options.remove === true && options.dryRun !== true && !confirmed) {
    const preview = await migrateFile(pair.file, pair.template, { ...options, dryRun: true })
    if (preview.removed.length > 0) {
      const keys = preview.removed.join(', ')
      if (!io.interactive) {
        logger.error(t('remove.needsYes', { file, keys }))
        return EXIT_USAGE
      }
      const answer = await logger.prompt(t('remove.confirm', { file, keys }), {
        type: 'confirm',
        initial: false,
      })
      if (answer !== true) {
        logger.info(t('remove.skipped', { file }))
        return 0
      }
    }
  }

  const result = await migrateFile(pair.file, pair.template, options)
  printChanges(pair, result, context)
  if (result.backupPath !== undefined) {
    logger.log(`  ${t('report.backup', { path: display(result.backupPath, io) })}`)
  }
  if (result.created) logger.success(t('align.created', { file }))
  else if (result.written) logger.success(t('align.updated', { file }))
  else if (result.changed) logger.info(t('align.wouldUpdate', { file }))
  else logger.success(t('align.upToDate', { file }))
  return 0
}

/** `check` and `diff` never write, and treat a missing file as one that the template would create. */
async function previewPair(
  mode: 'check' | 'diff',
  pair: Pair,
  options: MigenvOptions,
  context: Context,
): Promise<number> {
  const { io, t, logger } = context
  const file = display(pair.file, io)
  const exists = existsSync(pair.file)
  const result = await migrateFile(pair.file, pair.template, {
    ...options,
    create: true,
    dryRun: true,
  })

  if (mode === 'diff') printChanges(pair, result, context)
  if (!exists) logger.warn(t('check.missing', { file }))
  else if (result.changed) logger.warn(t('check.outOfDate', { file }))
  else logger.success(t('align.upToDate', { file }))
  return mode === 'check' && (!exists || result.changed) ? EXIT_OUT_OF_DATE : 0
}

function printChanges(
  pair: Pair,
  result: Awaited<ReturnType<typeof migrateFile>>,
  { io, t, logger }: Context,
): void {
  const names = { file: display(pair.file, io), template: display(pair.template, io) }
  const lines = changeLines(result, t)
  if (lines.length > 0) logger.log([`${names.file} ← ${names.template}`, ...lines].join('\n'))
  for (const message of warningMessages(result.warnings, names, t)) logger.warn(message)
}

function reportError(error: unknown, pair: Pair, { io, t, logger }: Context): number {
  const file = display(pair.file, io)
  const code = error instanceof Error && 'code' in error ? error.code : undefined
  const detail = error instanceof Error ? error.message : ''
  switch (code) {
    case 'FILE_NOT_FOUND':
      logger.error(t('error.fileNotFound', { file }))
      break
    case 'UNKNOWN_LINE':
      logger.error(t('error.unknownLine', { file, detail }))
      break
    case 'DUPLICATE_KEY':
      logger.error(t('error.duplicateKey', { file, detail }))
      break
    case 'INVALID_OPTION':
      logger.error(t('error.invalidOption', { detail }))
      break
    // Only the template is read before anything else, so ENOENT here means a missing --template.
    case 'ENOENT':
      logger.error(t('error.templateNotFound', { file, tried: display(pair.template, io) }))
      break
    default:
      throw error
  }
  return EXIT_USAGE
}

function display(path: string, io: CliIo): string {
  return relative(io.cwd, path) || path
}
