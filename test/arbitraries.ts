import { fc } from '@fast-check/vitest'

const BOM = String.fromCharCode(0xfeff)

const eol = fc.constantFrom('\n', '\r\n')
const key = fc.constantFrom('A', 'B', 'C', 'KEY_1', 'api.key', 'lower_case')
const spaces = fc.constantFrom('', ' ', '  ')

const plainValue = fc.string({
  unit: fc.constantFrom('a', 'Z', '1', ' ', '#', '=', '/', '\\', ':'),
})
const quotedValue = fc.oneof(
  fc
    .string({ unit: fc.constantFrom('a', ' ', "'", '#', '\n', '\r\n', '\\"', '\\\\') })
    .map((body) => `"${body}"`),
  fc.string({ unit: fc.constantFrom('a', ' ', '"', '#', '\n', '\r\n') }).map((body) => `'${body}'`),
  fc.string({ unit: fc.constantFrom('a', ' ', '"', "'", '\n') }).map((body) => `\`${body}\``),
)
const inlineComment = fc.constantFrom('', ' # note', '#tight')

export const entryLine: fc.Arbitrary<string> = fc
  .record({
    exported: fc.boolean(),
    key,
    before: spaces,
    after: spaces,
    value: fc.oneof(
      plainValue,
      fc.tuple(quotedValue, inlineComment).map(([value, comment]) => value + comment),
    ),
  })
  .map(
    ({ exported, key, before, after, value }) =>
      `${exported ? 'export ' : ''}${key}${before}=${after}${value}`,
  )

const commentLine = fc.oneof(
  fc.string({ unit: fc.constantFrom('a', ' ', '-', '=') }).map((body) => `#${body}`),
  key.map((k) => `# ${k}=`),
)

const wellFormedLine = fc.oneof(fc.constant(''), spaces, commentLine, entryLine)
const anyLine = fc.oneof(
  wellFormedLine,
  fc.string({ unit: fc.constantFrom('a', '=', '"', "'", '`', '\\', ' ', '#', '\r') }),
)

function joinLines(line: fc.Arbitrary<string>): fc.Arbitrary<string> {
  return fc
    .record({
      bom: fc.boolean(),
      lines: fc.array(fc.tuple(line, eol), { maxLength: 12 }),
      finalNewline: fc.boolean(),
    })
    .map(({ bom, lines, finalNewline }) => {
      const body = lines
        .map(([text, ending], i) => text + (i < lines.length - 1 || finalNewline ? ending : ''))
        .join('')
      return bom ? BOM + body : body
    })
}

/** Env files whose lines all parse as blank, comment or entry nodes. */
export const envText: fc.Arbitrary<string> = joinLines(wellFormedLine)

/** Arbitrary text, including lines that do not parse. */
export const anyText: fc.Arbitrary<string> = joinLines(anyLine)
