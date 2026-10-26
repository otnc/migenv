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
const KEY_PATTERN = /^\s*(export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*=/
const QUOTES = new Set(['"', "'", '`'])

interface Line {
  readonly text: string
  readonly eol: LineEnding
}

export function parse(text: string): EnvDocument {
  const bom = text.startsWith(BOM)
  const body = bom ? text.slice(BOM.length) : text
  const lines = splitLines(body)
  const nodes: EnvNode[] = []

  let index = 0
  while (index < lines.length) {
    const consumed = parseNode(lines, index, nodes)
    index += consumed
  }

  return {
    nodes,
    newline: nodes.some((node) => node.eol === '\r\n') ? '\r\n' : '\n',
    bom,
    finalNewline: lines.length > 0 && lines[lines.length - 1]?.eol !== '',
  }
}

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

/** Pushes the node starting at `lines[index]` and returns how many lines it spans. */
function parseNode(lines: readonly Line[], index: number, nodes: EnvNode[]): number {
  const first = lines[index] as Line
  const line = index + 1
  const trimmed = first.text.trim()

  if (trimmed === '') {
    nodes.push({ kind: 'blank', raw: first.text, line, eol: first.eol })
    return 1
  }
  if (trimmed.startsWith('#')) {
    nodes.push({ kind: 'comment', raw: first.text, line, eol: first.eol })
    return 1
  }

  const match = KEY_PATTERN.exec(first.text)
  if (match === null) {
    nodes.push({ kind: 'unknown', raw: first.text, line, eol: first.eol })
    return 1
  }

  const keyPart = match[0]
  const key = match[2] as string
  const exported = match[1] !== undefined
  const valueStart = first.text.slice(keyPart.length)
  const quote = valueStart.trimStart()[0]

  if (quote === undefined || !QUOTES.has(quote)) {
    nodes.push({
      kind: 'entry',
      raw: first.text,
      line,
      eol: first.eol,
      key,
      exported,
      rawValue: valueStart,
      isEmpty: (valueStart.split('#')[0] ?? '').trim() === '',
    })
    return 1
  }

  // The opening quote may be followed by line breaks, so keep reading lines until it closes.
  const openAt = valueStart.indexOf(quote)
  let rawValue = valueStart
  let searchFrom = openAt + 1
  let last = first
  let span = 1
  for (;;) {
    const closeAt = findClosingQuote(rawValue, quote, searchFrom)
    if (closeAt !== -1) {
      nodes.push({
        kind: 'entry',
        raw: keyPart + rawValue,
        line,
        eol: last.eol,
        key,
        exported,
        rawValue,
        isEmpty: closeAt === openAt + 1,
      })
      return span
    }
    const next = lines[index + span]
    if (next === undefined) {
      nodes.push({ kind: 'unknown', raw: first.text, line, eol: first.eol })
      return 1
    }
    searchFrom = rawValue.length + last.eol.length
    rawValue += last.eol + next.text
    last = next
    span += 1
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
