import type { ArgsDef, ParsedArgs } from 'citty'
import type { MigenvOptions } from '../core/index'
import type { MessageKey, Translate } from './i18n'

type FlagSpec = {
  readonly flag: string
  readonly option: keyof MigenvOptions
  readonly description: MessageKey
  /** Flags available only to commands that write files. */
  readonly writes?: boolean
} & (
  | {
      readonly type: 'boolean'
      /** Makes the flag default to on, so the help shows `--no-<flag>` with this text. */
      readonly negativeDescription?: MessageKey
    }
  | { readonly type: 'string'; readonly alias?: string }
  | { readonly type: 'enum'; readonly choices: readonly string[] }
)

/** The flags that map onto `MigenvOptions`, kept in one place so that citty's definitions and the conversion cannot drift apart. */
const OPTION_FLAGS: readonly FlagSpec[] = [
  { flag: 'fill', option: 'fill', type: 'boolean', description: 'arg.fill' },
  {
    flag: 'rename',
    option: 'rename',
    type: 'boolean',
    description: 'arg.rename',
    negativeDescription: 'arg.rename.negative',
  },
  {
    flag: 'add',
    option: 'add',
    type: 'boolean',
    description: 'arg.add',
    negativeDescription: 'arg.add.negative',
  },
  { flag: 'remove', option: 'remove', type: 'boolean', description: 'arg.remove' },
  { flag: 'protect', option: 'protect', type: 'string', alias: 'p', description: 'arg.protect' },
  {
    flag: 'reorder',
    option: 'reorder',
    type: 'boolean',
    description: 'arg.reorder',
    negativeDescription: 'arg.reorder.negative',
  },
  {
    flag: 'template-defaults',
    option: 'useTemplateDefaults',
    type: 'boolean',
    description: 'arg.templateDefaults',
    negativeDescription: 'arg.templateDefaults.negative',
  },
  {
    flag: 'newline',
    option: 'newline',
    type: 'enum',
    choices: ['template', 'current', 'lf', 'crlf'],
    description: 'arg.newline',
  },
  {
    flag: 'duplicates',
    option: 'duplicates',
    type: 'enum',
    choices: ['last', 'first', 'error'],
    description: 'arg.duplicates',
  },
  { flag: 'strict', option: 'strict', type: 'boolean', description: 'arg.strict' },
  { flag: 'backup', option: 'backup', type: 'boolean', writes: true, description: 'arg.backup' },
  {
    flag: 'backup-dir',
    option: 'backupDir',
    type: 'string',
    writes: true,
    description: 'arg.backupDir',
  },
  { flag: 'create', option: 'create', type: 'boolean', writes: true, description: 'arg.create' },
  { flag: 'dry-run', option: 'dryRun', type: 'boolean', writes: true, description: 'arg.dryRun' },
]

/** citty argument definitions for a command, restricted to the operations it supports. */
export function commandArgs(
  t: Translate,
  writing: boolean,
  operation: 'align' | 'prune' | 'fill' = 'align',
): ArgsDef {
  const args: ArgsDef = {
    files: { type: 'positional', required: false, description: t('arg.files') },
    template: { type: 'string', alias: 't', description: t('arg.template') },
    lang: { type: 'string', description: t('arg.lang') },
  }
  if (writing && operation !== 'fill')
    args.yes = { type: 'boolean', alias: 'y', description: t('arg.yes') }

  for (const spec of OPTION_FLAGS) {
    if (
      operation === 'prune' &&
      !['protect', 'strict', 'backup', 'backupDir', 'dryRun'].includes(spec.option)
    )
      continue
    if (
      operation === 'fill' &&
      !['protect', 'strict', 'duplicates', 'backup', 'backupDir', 'dryRun'].includes(spec.option)
    )
      continue
    if (spec.writes === true && !writing) continue
    const description = t(spec.description)
    switch (spec.type) {
      case 'boolean':
        args[spec.flag] =
          spec.negativeDescription === undefined
            ? { type: 'boolean', description }
            : {
                type: 'boolean',
                description,
                default: true,
                negativeDescription: t(spec.negativeDescription),
              }
        break
      case 'string':
        args[spec.flag] =
          spec.alias === undefined
            ? { type: 'string', description }
            : { type: 'string', description, alias: spec.alias }
        break
      case 'enum':
        args[spec.flag] = { type: 'enum', description, options: [...spec.choices] }
        break
    }
  }
  return args
}

/**
 * Turns parsed flags into `MigenvOptions`. Flags that were not given stay `undefined`, so `resolveOptions` fills in the defaults.
 * `rawArgs` is needed because citty keeps only the last of repeated `--protect` flags.
 */
export function toMigenvOptions(args: ParsedArgs, rawArgs: readonly string[]): MigenvOptions {
  const protect = flagValues(rawArgs, ['--protect', '-p']).flatMap((value) =>
    value
      .split(',')
      .map((key) => key.trim())
      .filter((key) => key !== ''),
  )
  const options: Record<string, unknown> = protect.length > 0 ? { protect } : {}
  for (const spec of OPTION_FLAGS) {
    if (spec.option === 'protect') continue
    const value = args[spec.flag]
    if (value !== undefined) options[spec.option] = value
  }
  return options
}

/** Every value given to one of `names`, as `--name value` or `--name=value`, in order. */
export function flagValues(rawArgs: readonly string[], names: readonly string[]): string[] {
  const values: string[] = []
  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i]
    if (arg === undefined || arg === '--') break
    const name = names.find((n) => arg === n || arg.startsWith(`${n}=`))
    if (name === undefined) continue
    const next = rawArgs[i + 1]
    if (arg.length > name.length) {
      values.push(arg.slice(name.length + 1))
    } else if (next !== undefined) {
      values.push(next)
      i++
    }
  }
  return values
}
