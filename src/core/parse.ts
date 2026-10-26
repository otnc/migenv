/** One line of an env file, or several for a quoted value that spans lines. Narrow it by `kind`. */
export type EnvNode = BlankNode | CommentNode | EntryNode | UnknownNode

/** The line break after a node; `''` only for a last line without one. */
export type LineEnding = '\n' | '\r\n' | ''

interface BaseNode {
  /** The source text without the trailing line ending. A multi-line value keeps its inner line breaks. */
  readonly raw: string
  /** 1-based line number where the node starts. */
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
  /** Whether the line starts with `export `. */
  readonly exported: boolean
  /** Everything after `=`, undecoded: quotes, leading spaces and an inline comment included. */
  readonly rawValue: string
  /** True when the value is blank, a bare comment, or an empty pair of quotes. */
  readonly isEmpty: boolean
}

/** A line that could not be parsed, such as an unclosed quote. It is kept, never dropped. */
export interface UnknownNode extends BaseNode {
  readonly kind: 'unknown'
}

export interface EnvDocument {
  readonly nodes: readonly EnvNode[]
  /** `'\r\n'` when any line ends with CRLF, otherwise `'\n'`. */
  readonly newline: '\n' | '\r\n'
  /** Whether the text started with a UTF-8 BOM. `stringify` writes it back. */
  readonly bom: boolean
  /** Whether the last line ends with a line break. */
  readonly finalNewline: boolean
}

const BOM = '\uFEFF'
const KEY = '[A-Za-z_][A-Za-z0-9_.-]*'
const ENTRY_START = new RegExp(`^\\s*(export\\s+)?(${KEY})\\s*=`)
const COMMENTED_OUT_ENTRY = new RegExp(`^\\s*#\\s*(?:export\\s+)?(${KEY})\\s*=`)
const QUOTES = new Set(['"', "'", '`'])
const CLOSING_QUOTE_TAIL = /^\s*(?:#[^\n]*)?$/

interface Line {
  readonly text: string
  readonly eol: LineEnding
}

/**
 * Splits an env file into nodes without decoding any value, so that `stringify(parse(text)) === text` always holds.
 * Lines that cannot be parsed become `unknown` nodes instead of errors.
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

  // A quoted value may span lines, so the closing quote is searched for in the rest of the file.
  const rest = lines
    .slice(index)
    .map((l) => l.text + l.eol)
    .join('')
  const openAt = keyPart.length + valueStart.indexOf(quote)
  const closeAt = findClosingQuote(rest, quote, openAt)
  if (closeAt === -1) return singleLine('unknown')

  let lineStart = 0
  for (let span = 1; ; span++) {
    const current = lines[index + span - 1] as Line
    const lineEnd = lineStart + current.text.length
    if (closeAt < lineEnd) {
      const rawValue = rest.slice(keyPart.length, lineEnd)
      return { node: entry(rawValue, current.eol, closeAt === openAt + 1), span }
    }
    lineStart = lineEnd + current.eol.length
  }
}

/**
 * Finds the closing quote the way dotenv does, so both read the same value.
 * A quote right after a backslash can be passed over, and the first one that is not ends the search.
 * Of the quotes seen, the last one followed by nothing but spaces or a comment on its line closes the value.
 */
function findClosingQuote(text: string, quote: string, openAt: number): number {
  let closeAt = -1
  for (let at = text.indexOf(quote, openAt + 1); at !== -1; at = text.indexOf(quote, at + 1)) {
    const lineBreak = text.indexOf('\n', at)
    const restOfLine = text.slice(at + 1, lineBreak === -1 ? undefined : lineBreak)
    if (CLOSING_QUOTE_TAIL.test(restOfLine)) closeAt = at
    if (text[at - 1] !== '\\') break
  }
  return closeAt
}
