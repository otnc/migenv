export type EnvNode = BlankNode | CommentNode | EntryNode | UnknownNode

export type LineEnding = '\n' | '\r\n' | ''

interface BaseNode {
  readonly raw: string
  readonly line: number
  /** The line ending that followed the node in the source; '' for a last line without one. */
  readonly eol: LineEnding
}

export interface BlankNode extends BaseNode {
  readonly kind: 'blank'
}

export interface CommentNode extends BaseNode {
  readonly kind: 'comment'
}

export interface EntryNode extends BaseNode {
  readonly kind: 'entry'
  readonly key: string
  readonly exported: boolean
  readonly rawValue: string
  readonly isEmpty: boolean
}

export interface UnknownNode extends BaseNode {
  readonly kind: 'unknown'
}

export interface EnvDocument {
  readonly nodes: readonly EnvNode[]
  readonly newline: '\n' | '\r\n'
  readonly bom: boolean
  readonly finalNewline: boolean
}

const BOM = '\uFEFF'
const KEY = '[A-Za-z_][A-Za-z0-9_.-]*'
const ENTRY_START = new RegExp(`^\\s*(export\\s+)?(${KEY})\\s*=`)
const COMMENTED_OUT_ENTRY = new RegExp(`^\\s*#\\s*(?:export\\s+)?(${KEY})\\s*=`)
const QUOTES = new Set(['"', "'", '`'])

interface Line {
  readonly text: string
  readonly eol: LineEnding
}

/**
 * Splits an env file into nodes without decoding any value, so that `stringify(parse(text)) === text` always holds.
 * Lines that cannot be parsed become `unknown` nodes instead of errors.
 *
 * @example
 * const doc = parse('# db\nexport DATABASE_URL="postgres://x" # local\n')
 * doc.nodes[1] // => { kind: 'entry', key: 'DATABASE_URL', exported: true, rawValue: '"postgres://x" # local', ... }
 */
export function parse(text: string): EnvDocument {
  const bom = text.startsWith(BOM)
  const lines = splitLines(bom ? text.slice(BOM.length) : text)
  const nodes: EnvNode[] = []
  for (let index = 0; index < lines.length;) {
    const { node, span } = parseNode(lines, index)
    nodes.push(node)
    index += span
  }

  return {
    nodes,
    newline: nodes.some((node) => node.eol === '\r\n') ? '\r\n' : '\n',
    bom,
    finalNewline: (nodes[nodes.length - 1]?.eol ?? '') !== '',
  }
}

/** The key of a commented-out entry such as `# SENTRY_DSN=`, which templates use for optional keys. */
export function commentedOutKey(node: CommentNode): string | undefined {
  return COMMENTED_OUT_ENTRY.exec(node.raw)?.[1]
}

/**
 * Maps each key to one of its entries, the first or the last when a key appears more than once.
 * `onDuplicate` is called for every repeat with the entry kept so far.
 */
export function entriesByKey(
  doc: EnvDocument,
  keep: 'first' | 'last',
  onDuplicate?: (kept: EntryNode, repeat: EntryNode) => void,
): Map<string, EntryNode> {
  const entries = new Map<string, EntryNode>()
  for (const node of doc.nodes) {
    if (node.kind !== 'entry') continue
    const kept = entries.get(node.key)
    if (kept !== undefined) {
      onDuplicate?.(kept, node)
      if (keep === 'first') continue
    }
    entries.set(node.key, node)
  }
  return entries
}

/**
 * Turns a document back into text, line endings and BOM included.
 *
 * @example
 * stringify(parse(text)) === text // => true for any text
 */
export function stringify(doc: EnvDocument): string {
  const body = doc.nodes.map((node) => node.raw + node.eol).join('')
  return doc.bom ? BOM + body : body
}

function splitLines(text: string): Line[] {
  const lines: Line[] = []
  const pattern = /\r?\n/g
  let start = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    lines.push({ text: text.slice(start, match.index), eol: match[0] as LineEnding })
    start = match.index + match[0].length
  }
  if (start < text.length) {
    lines.push({ text: text.slice(start), eol: '' })
  }
  return lines
}

/** Reads the node that starts at `lines[index]`, with the number of lines it spans. */
function parseNode(lines: readonly Line[], index: number): { node: EnvNode; span: number } {
  const first = lines[index] as Line
  const line = index + 1
  const singleLine = (kind: 'blank' | 'comment' | 'unknown') => ({
    node: { kind, raw: first.text, line, eol: first.eol },
    span: 1,
  })

  const trimmed = first.text.trim()
  if (trimmed === '') return singleLine('blank')
  if (trimmed.startsWith('#')) return singleLine('comment')
  const match = ENTRY_START.exec(first.text)
  if (match === null) return singleLine('unknown')

  const keyPart = match[0]
  const entry = (rawValue: string, eol: LineEnding, isEmpty: boolean): EntryNode => ({
    kind: 'entry',
    raw: keyPart + rawValue,
    line,
    eol,
    key: match[2] as string,
    exported: match[1] !== undefined,
    rawValue,
    isEmpty,
  })
  const valueStart = first.text.slice(keyPart.length)
  const quote = valueStart.trimStart()[0]
  if (quote === undefined || !QUOTES.has(quote)) {
    const isEmpty = (valueStart.split('#')[0] ?? '').trim() === ''
    return { node: entry(valueStart, first.eol, isEmpty), span: 1 }
  }

  // The opening quote may be followed by line breaks, so keep reading lines until it closes.
  const openAt = valueStart.indexOf(quote)
  let rawValue = valueStart
  let searchFrom = openAt + 1
  let last = first
  for (let span = 1; ; span++) {
    const closeAt = findClosingQuote(rawValue, quote, searchFrom)
    if (closeAt !== -1) {
      return { node: entry(rawValue, last.eol, closeAt === openAt + 1), span }
    }
    const next = lines[index + span]
    if (next === undefined) return singleLine('unknown')
    searchFrom = rawValue.length + last.eol.length
    rawValue += last.eol + next.text
    last = next
  }
}

function findClosingQuote(value: string, quote: string, from: number): number {
  for (let i = from; i < value.length; i++) {
    const char = value[i]
    if (quote === '"' && char === '\\') {
      i += 1
      continue
    }
    if (char === quote) {
      return i
    }
  }
  return -1
}
