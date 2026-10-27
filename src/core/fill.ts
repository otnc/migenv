import type { ProtectedSkip, Warning } from './align'
import { parseDirectives } from './directives'
import { MigenvError } from './errors'
import { generators } from './generators'
import { type MigenvOptions, resolveOptions } from './options'
import { entriesByKey, type EntryNode, parse, stringify } from './parse'

/** The text, generated key names and diagnostics returned by `fill`. */
export interface FillResult {
  readonly text: string
  readonly changed: boolean
  readonly filled: readonly string[]
  readonly protectedSkips: readonly ProtectedSkip[]
  readonly warnings: readonly Warning[]
}

/**
 * Fills empty entries annotated with `@generate`. Non-empty values and protected entries are never changed. Layout, comments, BOM and line endings are preserved. Built-ins apply to the next entry. Custom generators apply to consecutive entries, skipping partially initialized groups to keep paired secrets consistent.
 * @throws {MigenvError} `GENERATION_FAILED` for an unknown or failed generator, without including its output or error message; `UNKNOWN_LINE` in strict mode; `DUPLICATE_KEY` with `duplicates: 'error'`.
 * @example
 * fill('# @generate hex:32\nTOKEN=\n').filled // => ['TOKEN']
 */
export const fill = (text: string, options?: MigenvOptions): FillResult =>
  fillFromTemplate(text, text, options)

/** Applies generation rules from a separate template without copying its layout. */
export const fillFromTemplate = (
  text: string,
  template: string,
  options?: MigenvOptions,
): FillResult => {
  const resolved = resolveOptions(options)
  const doc = parse(text)
  const directives = parseDirectives(template)
  const warnings: Warning[] = [...directives.warnings]
  const protectedSkips: ProtectedSkip[] = []
  const filled: string[] = []
  const replacements = new Map<EntryNode, string>()
  for (const node of doc.nodes) {
    if (node.kind !== 'unknown') continue
    if (resolved.strict)
      throw new MigenvError('UNKNOWN_LINE', `Line ${node.line} could not be parsed.`)
    warnings.push({
      code: 'unknown-line',
      source: 'current',
      line: node.line,
      message: `Line ${node.line} could not be parsed and was kept as is.`,
    })
  }
  const duplicates = new Set<string>()
  const entries = entriesByKey(
    doc,
    resolved.duplicates === 'first' ? 'first' : 'last',
    (_, repeat) => {
      if (resolved.duplicates === 'error')
        throw new MigenvError('DUPLICATE_KEY', `Key "${repeat.key}" appears more than once.`)
      duplicates.add(repeat.key)
      warnings.push({
        code: 'duplicate-key',
        source: 'current',
        line: repeat.line,
        key: repeat.key,
        message: `Key "${repeat.key}" appears more than once and was not generated.`,
      })
    },
  )
  const available = { ...generators, ...resolved.generators }
  for (const directive of directives.generate) {
    const group = directive.keys.map((key) => entries.get(key))
    const empty = group.filter(
      (entry): entry is EntryNode =>
        entry !== undefined && entry.isEmpty && !filled.includes(entry.key),
    )
    if (empty.length === 0) continue
    for (const entry of empty) {
      if (!resolved.isProtected(entry.key, entry.rawValue)) continue
      protectedSkips.push({ key: entry.key, action: 'fill' })
      warnings.push({
        code: 'protected',
        source: 'current',
        key: entry.key,
        message: `Key "${entry.key}" is protected and was not generated.`,
      })
    }
    if (empty.some((entry) => resolved.isProtected(entry.key, entry.rawValue))) continue
    if (
      empty.length !== group.length ||
      new Set(directive.keys).size !== directive.keys.length ||
      directive.keys.some((key) => duplicates.has(key))
    ) {
      warnings.push({
        code: 'generation-conflict',
        source: 'template',
        line: directive.line,
        message: `The generation group on template line ${directive.line} is incomplete, duplicated or already initialized.`,
      })
      continue
    }
    const targets = empty.filter((entry) => !resolved.isProtected(entry.key, entry.rawValue))
    if (targets.length === 0) continue
    // A custom generator can throw secrets or return extra keys. Validate its entire result before changing any entry.
    const values = (() => {
      try {
        const generator = Object.hasOwn(available, directive.name)
          ? available[directive.name as keyof typeof available]
          : undefined
        if (generator === undefined) throw new Error()
        const generated = generator({ keys: targets.map((entry) => entry.key), arg: directive.arg })
        if (
          generated === null ||
          typeof generated !== 'object' ||
          Array.isArray(generated) ||
          Object.keys(generated).length !== targets.length
        )
          throw new Error()
        return targets.map((entry) => {
          if (!Object.hasOwn(generated, entry.key)) throw new Error()
          const value = generated[entry.key]
          if (typeof value !== 'string' || value.length === 0 || /[\r\n\0]/.test(value))
            throw new Error()
          const encoded = /^[A-Za-z0-9_./+=:@%,-]+$/.test(value)
            ? value
            : !value.includes("'")
              ? `'${value}'`
              : !value.includes('"') && !/\\[nr]/.test(value)
                ? `"${value}"`
                : !value.includes('`')
                  ? '`' + value + '`'
                  : undefined
          if (encoded === undefined || value.endsWith('\\')) throw new Error()
          return { entry, encoded }
        })
      } catch {
        throw new MigenvError(
          'GENERATION_FAILED',
          `Generation failed for the group on template line ${directive.line}.`,
        )
      }
    })()
    for (const { entry, encoded } of values) {
      const match = /^(\s*)(?:(["'`])\2)?(\s*(?:#.*)?)$/.exec(entry.rawValue)
      const tail = match?.[3] ?? ''
      const rawValue = `${match?.[1] ?? ''}${encoded}${tail.startsWith('#') ? ' ' : ''}${tail}`
      replacements.set(
        entry,
        entry.raw.slice(0, entry.raw.length - entry.rawValue.length) + rawValue,
      )
      filled.push(entry.key)
    }
  }
  const nodes = doc.nodes.map((node) =>
    node.kind === 'entry' && replacements.has(node)
      ? { ...node, raw: replacements.get(node) as string }
      : node,
  )
  const output = stringify({ ...doc, nodes })
  // Empty quoted values can reach into later lines when a prior value ends in a backslash.
  const parsed = parse(output)
  if (
    parsed.nodes.length !== nodes.length ||
    parsed.nodes.some((node, index) => node.raw !== nodes[index]?.raw)
  ) {
    return {
      text,
      changed: false,
      filled: [],
      protectedSkips,
      warnings: [
        ...warnings,
        {
          code: 'ambiguous-quote',
          source: 'current',
          message: 'Generation would change how a quoted value reads; the file was left unchanged.',
        },
      ],
    }
  }
  return { text: output, changed: output !== text, filled, protectedSkips, warnings }
}
