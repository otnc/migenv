import type { Warning } from './align'
import { MigenvError } from './errors'
import { type MigenvOptions, resolveOptions } from './options'
import { type EntryNode, type EnvNode, parse, stringify } from './parse'

/** The text, changed key names and diagnostics returned by `setValues`. */
export interface SetResult {
  readonly text: string
  readonly changed: boolean
  readonly updated: readonly string[]
  readonly added: readonly string[]
  /** Requested keys left untouched by protection or `add: false`. */
  readonly skipped: readonly string[]
  readonly warnings: readonly Warning[]
}

/**
 * Explicitly overwrites requested keys, including non-empty values, and appends missing keys unless `add: false`. Values are raw env syntax after `=`, including any quotes or inline comments; they are never decoded or automatically escaped. All occurrences of a requested key are updated together. If any occurrence is protected, the entire key is skipped. Unrelated content and existing line endings are preserved.
 * @throws {MigenvError} `INVALID_VALUE` for invalid keys or values that do not form one complete env entry, `UNKNOWN_LINE` in strict mode, or `DUPLICATE_KEY` with `duplicates: 'error'`.
 * @example
 * const result = setValues('ORIGIN=old\nHOST=127.0.0.1\n', new Map([['ORIGIN', 'https://example.com']]))
 * result.updated // => ['ORIGIN']
 * result.text // => 'ORIGIN=https://example.com\nHOST=127.0.0.1\n'
 */
export const setValues = (
  text: string,
  values: ReadonlyMap<string, string>,
  options?: MigenvOptions,
): SetResult => {
  const resolved = resolveOptions(options)
  const doc = parse(text)
  const warnings: Warning[] = []
  const entries = new Map<string, EntryNode[]>()
  for (const node of doc.nodes) {
    if (node.kind === 'unknown') {
      if (resolved.strict)
        throw new MigenvError('UNKNOWN_LINE', `Line ${node.line} could not be parsed.`)
      warnings.push({
        code: 'unknown-line',
        source: 'current',
        line: node.line,
        message: `Line ${node.line} could not be parsed and was kept as is.`,
      })
    }
    if (node.kind !== 'entry') continue
    const occurrences = entries.get(node.key) ?? []
    if (occurrences.length > 0) {
      if (resolved.duplicates === 'error')
        throw new MigenvError('DUPLICATE_KEY', `Key "${node.key}" appears more than once.`)
      warnings.push({
        code: 'duplicate-key',
        source: 'current',
        key: node.key,
        line: node.line,
        message: `Key "${node.key}" appears more than once. Requested updates apply to every occurrence.`,
      })
    }
    occurrences.push(node)
    entries.set(node.key, occurrences)
  }
  const updated = new Set<string>()
  const added: string[] = []
  const skipped: string[] = []
  const replacements = new Map<EntryNode, EntryNode>()
  const additions: EntryNode[] = []
  for (const [key, rawValue] of values) {
    // Validate as one complete entry so a supplied value cannot introduce another key or swallow later lines.
    if (
      typeof key !== 'string' ||
      !/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(key) ||
      typeof rawValue !== 'string' ||
      rawValue.includes('\0')
    )
      throw new MigenvError(
        'INVALID_VALUE',
        'Each update must contain a valid env key and raw value.',
      )
    const parsed = parse(`${key}=${rawValue}`)
    const valueEntry = parsed.nodes[0]
    if (
      parsed.nodes.length !== 1 ||
      valueEntry?.kind !== 'entry' ||
      valueEntry.eol !== '' ||
      valueEntry.rawValue !== rawValue ||
      (/[\r\n]/.test(rawValue) && !/^[\s]*["'`]/.test(rawValue))
    )
      throw new MigenvError(
        'INVALID_VALUE',
        `The supplied value for key "${key}" is not one complete env entry.`,
      )
    const occurrences = entries.get(key) ?? []
    if (
      occurrences.some((entry) => resolved.isProtected(key, entry.rawValue)) ||
      (occurrences.length === 0 && resolved.isProtected(key, ''))
    ) {
      skipped.push(key)
      warnings.push({
        code: 'protected',
        source: 'current',
        key,
        message: `Key "${key}" is protected and was not set.`,
      })
      continue
    }
    if (occurrences.length === 0) {
      if (!resolved.add) {
        skipped.push(key)
        continue
      }
      added.push(key)
      additions.push(valueEntry)
      continue
    }
    for (const entry of occurrences) {
      if (entry.rawValue === rawValue) continue
      updated.add(key)
      const prefix = entry.raw.slice(0, entry.raw.length - entry.rawValue.length)
      replacements.set(entry, {
        ...entry,
        rawValue,
        raw: prefix + rawValue,
        isEmpty: valueEntry.isEmpty,
      })
    }
  }
  const nodes: EnvNode[] = doc.nodes.map((node) =>
    node.kind === 'entry' ? (replacements.get(node) ?? node) : node,
  )
  // Place additions before an unclosed quote instead of letting it consume new entries.
  const firstUnknown = nodes.findIndex((node) => node.kind === 'unknown')
  const insertion = firstUnknown === -1 ? nodes.length : firstUnknown
  const previous = nodes[insertion - 1]
  if (additions.length > 0 && previous !== undefined && previous.eol === '')
    nodes[insertion - 1] = { ...previous, eol: doc.newline }
  nodes.splice(
    insertion,
    0,
    ...additions.map<EntryNode>((node, index) => ({
      ...node,
      eol:
        insertion < doc.nodes.length ||
        index < additions.length - 1 ||
        doc.finalNewline ||
        doc.nodes.length === 0
          ? doc.newline
          : '',
    })),
  )
  const output = stringify({ ...doc, nodes })
  const actual = parse(output).nodes
  if (
    actual.length !== nodes.length ||
    actual.some((node, index) => node.raw !== nodes[index]?.raw)
  ) {
    return {
      text,
      changed: false,
      updated: [],
      added: [],
      skipped: [...values.keys()],
      warnings: [
        ...warnings,
        {
          code: 'ambiguous-quote',
          source: 'current',
          message:
            'The file was left unchanged because setting values would change how a quoted value reads.',
        },
      ],
    }
  }
  return { text: output, changed: output !== text, updated: [...updated], added, skipped, warnings }
}
