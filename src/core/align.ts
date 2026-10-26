import { MigenvError } from './errors'
import { type MigenvOptions, type ResolvedOptions, resolveOptions } from './options'
import { type EntryNode, type EnvDocument, type EnvNode, parse, stringify } from './parse'

export type WarningCode = 'unknown-line' | 'duplicate-key' | 'protected'

/** Something worth telling the user. Messages never contain values. */
export interface Warning {
  readonly code: WarningCode
  readonly message: string
  readonly source: 'current' | 'template'
  readonly line?: number
  readonly key?: string
}

export interface ProtectedSkip {
  readonly key: string
  /** `'default'`: an empty value was not replaced with the template's. `'remove'`: the key was kept although `remove` is on. */
  readonly action: 'default' | 'remove'
}

export interface AlignResult {
  readonly text: string
  readonly changed: boolean
  /** Keys added from the template. */
  readonly added: readonly string[]
  /** Keys kept although they are not in the template. */
  readonly extra: readonly string[]
  /** Keys deleted by `remove: true`. */
  readonly removed: readonly string[]
  readonly protectedSkips: readonly ProtectedSkip[]
  /** Comments that were only in the current file and are gone from the output. */
  readonly droppedComments: readonly string[]
  readonly warnings: readonly Warning[]
}

interface Report {
  readonly added: string[]
  readonly extra: string[]
  readonly removed: string[]
  readonly protectedSkips: ProtectedSkip[]
  readonly droppedComments: string[]
  readonly warnings: Warning[]
}

interface Context {
  readonly options: ResolvedOptions
  readonly current: EnvDocument
  readonly template: EnvDocument
  /** The entry that wins for each key in the current file, chosen by `duplicates`. */
  readonly chosen: ReadonlyMap<string, EntryNode>
  readonly report: Report
}

const COMMENTED_OUT_KEY = /^\s*#\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*=/

/**
 * Rewrites `current` so that it follows `template`: the same key order and comments, missing keys added from the template, and keys the template does not have collected at the end.
 * Non-empty values in `current` are kept byte for byte.
 *
 * @throws {MigenvError} `UNKNOWN_LINE` with `strict: true`, `DUPLICATE_KEY` with `duplicates: 'error'`, `INVALID_OPTION` for bad options.
 *
 * @example
 * const result = align('B=2\nA=1\nOLD=x\n', '# app\nA=\nB=\nC=3\n', { protect: ['OLD'] })
 * result.text // => '# app\nA=1\nB=2\nC=3\n\n# ---- Not in template (review manually) ----\nOLD=x\n'
 * result.added // => ['C']
 */
export function align(current: string, template: string, options?: MigenvOptions): AlignResult {
  const resolved = resolveOptions(options)
  const report: Report = {
    added: [],
    extra: [],
    removed: [],
    protectedSkips: [],
    droppedComments: [],
    warnings: [],
  }
  const currentDoc = parse(current)
  const templateDoc = parse(template)
  checkUnknownLines(currentDoc, 'current', resolved, report)
  checkUnknownLines(templateDoc, 'template', resolved, report)

  const context: Context = {
    options: resolved,
    current: currentDoc,
    template: templateDoc,
    chosen: chooseEntries(currentDoc, resolved, report),
    report,
  }
  const nodes = resolved.reorder ? followTemplate(context) : keepCurrentOrder(context)
  const text = stringify(finishDocument(nodes, context))

  return { text, changed: text !== current, ...report }
}

function checkUnknownLines(
  doc: EnvDocument,
  source: 'current' | 'template',
  options: ResolvedOptions,
  report: Report,
): void {
  for (const node of doc.nodes) {
    if (node.kind !== 'unknown') continue
    if (options.strict) {
      throw new MigenvError(
        'UNKNOWN_LINE',
        `Line ${node.line} of the ${source} file could not be parsed.`,
      )
    }
    report.warnings.push({
      code: 'unknown-line',
      source,
      line: node.line,
      message:
        source === 'current'
          ? `Line ${node.line} of the current file could not be parsed and was kept as is.`
          : `Line ${node.line} of the template could not be parsed and was left out.`,
    })
  }
}

function chooseEntries(
  doc: EnvDocument,
  options: ResolvedOptions,
  report: Report,
): Map<string, EntryNode> {
  const chosen = new Map<string, EntryNode>()
  for (const node of doc.nodes) {
    if (node.kind !== 'entry') continue
    const previous = chosen.get(node.key)
    if (previous !== undefined) {
      const lines = `lines ${previous.line} and ${node.line}`
      if (options.duplicates === 'error') {
        throw new MigenvError(
          'DUPLICATE_KEY',
          `"${node.key}" appears more than once in the current file (${lines}).`,
        )
      }
      report.warnings.push({
        code: 'duplicate-key',
        source: 'current',
        line: node.line,
        key: node.key,
        message: `"${node.key}" appears more than once in the current file (${lines}). Only the ${options.duplicates} one is kept.`,
      })
      if (options.duplicates === 'first') continue
    }
    chosen.set(node.key, node)
  }
  return chosen
}

/** Picks the line for a template key, or `undefined` when nothing should be written. */
function lineForTemplateEntry(templateEntry: EntryNode, context: Context): EnvNode | undefined {
  const { options, report } = context
  const currentEntry = context.chosen.get(templateEntry.key)
  if (currentEntry === undefined) {
    if (!options.add) return undefined
    report.added.push(templateEntry.key)
    return templateEntry
  }
  if (currentEntry.isEmpty && options.useTemplateDefaults && !templateEntry.isEmpty) {
    if (!options.isProtected(currentEntry.key, currentEntry.rawValue)) return templateEntry
    skipForProtect(
      currentEntry.key,
      'default',
      `"${currentEntry.key}" is protected, so its empty value was not replaced with the template's.`,
      report,
    )
  }
  return currentEntry
}

/** Returns true when the extra entry should be dropped. */
function shouldRemoveExtra(entry: EntryNode, context: Context): boolean {
  const { options, report } = context
  if (!options.remove) return false
  if (!options.isProtected(entry.key, entry.rawValue)) {
    report.removed.push(entry.key)
    return true
  }
  skipForProtect(
    entry.key,
    'remove',
    `"${entry.key}" is protected, so it was kept although it is not in the template.`,
    report,
  )
  return false
}

function skipForProtect(
  key: string,
  action: ProtectedSkip['action'],
  message: string,
  report: Report,
): void {
  report.protectedSkips.push({ key, action })
  report.warnings.push({ code: 'protected', source: 'current', key, message })
}

function followTemplate(context: Context): EnvNode[] {
  const { options, current, template, chosen, report } = context
  const templateKeys = new Set(template.nodes.flatMap((n) => (n.kind === 'entry' ? [n.key] : [])))
  const writtenKeys = new Set<string>()
  const output: EnvNode[] = []

  for (const node of template.nodes) {
    if (node.kind === 'blank') {
      output.push(node)
    } else if (node.kind === 'comment') {
      const key = COMMENTED_OUT_KEY.exec(node.raw)?.[1]
      const currentEntry = key === undefined ? undefined : chosen.get(key)
      // `# KEY=` in the template marks an optional key; the current line takes the comment's place.
      if (
        currentEntry !== undefined &&
        !templateKeys.has(currentEntry.key) &&
        !writtenKeys.has(currentEntry.key)
      ) {
        writtenKeys.add(currentEntry.key)
        output.push(currentEntry)
      } else {
        output.push(node)
      }
    } else if (node.kind === 'entry' && !writtenKeys.has(node.key)) {
      writtenKeys.add(node.key)
      const line = lineForTemplateEntry(node, context)
      if (line !== undefined) output.push(line)
    }
    // Unknown template lines are left out: an unclosed quote there could swallow the lines after it.
  }

  const templateComments = new Set(
    template.nodes.flatMap((n) => (n.kind === 'comment' ? [n.raw.trim()] : [])),
  )
  const header = options.extrasHeader === false ? undefined : options.extrasHeader.trim()
  const extras: EnvNode[] = []
  for (const node of current.nodes) {
    if (node.kind === 'entry') {
      if (chosen.get(node.key) !== node || writtenKeys.has(node.key)) continue
      if (shouldRemoveExtra(node, context)) continue
      report.extra.push(node.key)
      extras.push(node)
    } else if (node.kind === 'unknown') {
      extras.push(node)
    } else if (node.kind === 'comment') {
      const comment = node.raw.trim()
      if (!templateComments.has(comment) && comment !== header) {
        report.droppedComments.push(node.raw)
      }
    }
  }

  if (extras.length > 0 && options.extrasHeader !== false) {
    if (output.length > 0 && output[output.length - 1]?.kind !== 'blank') {
      output.push({ kind: 'blank', raw: '', line: 0, eol: '\n' })
    }
    output.push({ kind: 'comment', raw: options.extrasHeader, line: 0, eol: '\n' })
  }
  output.push(...extras)
  return output
}

function keepCurrentOrder(context: Context): EnvNode[] {
  const { current, template, chosen } = context
  const templateEntries = new Map<string, EntryNode>()
  for (const node of template.nodes) {
    if (node.kind === 'entry' && !templateEntries.has(node.key)) {
      templateEntries.set(node.key, node)
    }
  }

  const output: EnvNode[] = []
  for (const node of current.nodes) {
    if (node.kind !== 'entry') {
      output.push(node)
      continue
    }
    if (chosen.get(node.key) !== node) continue
    const templateEntry = templateEntries.get(node.key)
    if (templateEntry !== undefined) {
      output.push(lineForTemplateEntry(templateEntry, context) ?? node)
    } else if (!shouldRemoveExtra(node, context)) {
      context.report.extra.push(node.key)
      output.push(node)
    }
  }

  const additions: EnvNode[] = []
  for (const templateEntry of templateEntries.values()) {
    if (chosen.has(templateEntry.key)) continue
    const line = lineForTemplateEntry(templateEntry, context)
    if (line !== undefined) additions.push(line)
  }
  // Added lines must not follow an unclosed quote, or the quote would swallow them on the next parse.
  const firstUnknown = output.findIndex((node) => node.kind === 'unknown')
  output.splice(firstUnknown === -1 ? output.length : firstUnknown, 0, ...additions)
  return output
}

function finishDocument(nodes: readonly EnvNode[], context: Context): EnvDocument {
  const { options, current, template } = context
  const newline = outputNewline(context)
  const base = options.reorder ? template : current
  const fallback = options.reorder ? current : template
  const finalNewline = base.nodes.length > 0 ? base.finalNewline : fallback.finalNewline

  return {
    nodes: nodes.map((node, i) => ({
      ...withoutTrailingCarriageReturn(node),
      eol: i < nodes.length - 1 || finalNewline ? newline : '',
    })),
    newline,
    bom: current.bom,
    finalNewline,
  }
}

/** A stray `\r` before the line break would merge with an LF into CRLF and change on the next run. */
function withoutTrailingCarriageReturn(node: EnvNode): EnvNode {
  if (!node.raw.endsWith('\r')) return node
  const raw = node.raw.replace(/\r+$/, '')
  return node.kind === 'entry'
    ? { ...node, raw, rawValue: node.rawValue.replace(/\r+$/, '') }
    : { ...node, raw }
}

function outputNewline({ options, current, template }: Context): EnvDocument['newline'] {
  switch (options.newline) {
    case 'lf':
      return '\n'
    case 'crlf':
      return '\r\n'
    case 'current':
      return current.newline
    case 'template':
      return template.newline
  }
}
