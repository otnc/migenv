import { MigenvError } from './errors'

/** Decides protection from the key and its undecoded value, e.g. `(key, raw) => raw.startsWith('vault:')`. */
export type ProtectFn = (key: string, rawValue: string) => boolean

/** Options shared by every migenv function. Each function ignores the ones it does not use. */
export interface MigenvOptions {
  /** Add keys that are in the template but not in the current file. Default `true`. */
  readonly add?: boolean | undefined
  /** Delete keys that are not in the template instead of keeping them at the end. Default `false`. */
  readonly remove?: boolean | undefined
  /**
   * Keys whose lines are never changed or removed. `*` matches any characters (`'*_SECRET'`).
   * Patterns from every layer passed to `resolveOptions` are combined, not overridden.
   */
  readonly protect?: readonly string[] | ProtectFn | undefined
  /** Follow the template's order and comments. When `false`, keep the current order and append added keys. Default `true`. */
  readonly reorder?: boolean | undefined
  /** Use the template's value when the current value is empty. Default `true`. */
  readonly useTemplateDefaults?: boolean | undefined
  /** Comment placed above the keys that are not in the template, or `false` for none. Default `'# ---- Not in template (review manually) ----'`. */
  readonly extrasHeader?: string | false | undefined
  /** Line ending of the output. Default `'template'`. */
  readonly newline?: 'template' | 'current' | 'lf' | 'crlf' | undefined
  /** Which value wins when a key appears twice. `'last'` matches dotenv. Default `'last'`. */
  readonly duplicates?: 'last' | 'first' | 'error' | undefined
  /** Throw on lines that cannot be parsed instead of keeping them with a warning. Default `false`. */
  readonly strict?: boolean | undefined
  /** Copy the file to `<file>.bak.<timestamp>` before changing it. Default `false`. */
  readonly backup?: boolean | undefined
  /** Directory for backups. Defaults to the directory of the file. */
  readonly backupDir?: string | undefined
  /** Create the file from the template when it does not exist. Default `false`. */
  readonly create?: boolean | undefined
  /** Compute the result without writing anything. Default `false`. */
  readonly dryRun?: boolean | undefined
}

/** `MigenvOptions` with every default filled in, as returned by `resolveOptions`. */
export interface ResolvedOptions {
  readonly add: boolean
  readonly remove: boolean
  readonly isProtected: ProtectFn
  readonly reorder: boolean
  readonly useTemplateDefaults: boolean
  readonly extrasHeader: string | false
  readonly newline: 'template' | 'current' | 'lf' | 'crlf'
  readonly duplicates: 'last' | 'first' | 'error'
  readonly strict: boolean
  readonly backup: boolean
  readonly backupDir: string | undefined
  readonly create: boolean
  readonly dryRun: boolean
}

/** The value of each option when no layer sets it. */
export const DEFAULT_OPTIONS: Readonly<Omit<ResolvedOptions, 'isProtected' | 'backupDir'>> = {
  add: true,
  remove: false,
  reorder: true,
  useTemplateDefaults: true,
  extrasHeader: '# ---- Not in template (review manually) ----',
  newline: 'template',
  duplicates: 'last',
  strict: false,
  backup: false,
  create: false,
  dryRun: false,
}

const CHOICE_OPTIONS: ReadonlyMap<string, readonly string[]> = new Map([
  ['newline', ['template', 'current', 'lf', 'crlf']],
  ['duplicates', ['last', 'first', 'error']],
])

/**
 * Fills in defaults. Later layers override earlier ones, `undefined` counts as not set, and `protect` is the union of every layer.
 * @throws {MigenvError} `INVALID_OPTION` for an unknown option name or a value of the wrong type.
 * @example
 * const options = resolveOptions(configOptions, { remove: true, protect: ['*_SECRET'] })
 * options.isProtected('SESSION_SECRET', '') // => true
 */
export function resolveOptions(...layers: readonly (MigenvOptions | undefined)[]): ResolvedOptions {
  const merged: Record<string, unknown> = { ...DEFAULT_OPTIONS, backupDir: undefined }
  const protectRules: (readonly string[] | ProtectFn)[] = []

  for (const layer of layers) {
    if (layer === undefined) continue
    for (const [name, value] of Object.entries(layer) as [string, unknown][]) {
      if (value === undefined) continue
      validateOption(name, value)
      if (name === 'protect') {
        protectRules.push(value as readonly string[] | ProtectFn)
      } else {
        merged[name] = value
      }
    }
  }

  return {
    ...(merged as Omit<ResolvedOptions, 'isProtected'>),
    isProtected: compileProtect(protectRules),
  }
}

function validateOption(name: string, value: unknown): void {
  const valid = isValidValue(name, value)
  if (valid === undefined) {
    throw new MigenvError('INVALID_OPTION', `Unknown option "${name}".`)
  }
  if (!valid) {
    throw new MigenvError('INVALID_OPTION', `Option "${name}" has a value of the wrong type.`)
  }
}

/** Returns `undefined` when `name` is not an option. */
function isValidValue(name: string, value: unknown): boolean | undefined {
  const choices = CHOICE_OPTIONS.get(name)
  if (choices !== undefined) return typeof value === 'string' && choices.includes(value)
  switch (name) {
    case 'extrasHeader':
      return typeof value === 'string' || value === false
    case 'backupDir':
      return typeof value === 'string'
    case 'protect':
      return (
        typeof value === 'function' ||
        (Array.isArray(value) && value.every((item) => typeof item === 'string'))
      )
    // Every other option must have the same type as its default.
    // An option that accepts more than one type needs its own case above.
    default:
      return Object.hasOwn(DEFAULT_OPTIONS, name)
        ? typeof value === typeof DEFAULT_OPTIONS[name as keyof typeof DEFAULT_OPTIONS]
        : undefined
  }
}

function compileProtect(rules: readonly (readonly string[] | ProtectFn)[]): ProtectFn {
  const patterns: RegExp[] = []
  const predicates: ProtectFn[] = []
  for (const rule of rules) {
    if (typeof rule === 'function') {
      predicates.push(rule)
    } else {
      patterns.push(...rule.map(wildcardToRegExp))
    }
  }
  return (key, rawValue) =>
    patterns.some((pattern) => pattern.test(key)) ||
    predicates.some((predicate) => predicate(key, rawValue))
}

function wildcardToRegExp(pattern: string): RegExp {
  const escaped = pattern.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp(`^${escaped.join('.*')}$`)
}
