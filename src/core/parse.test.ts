import { fc, test } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'
import { anyText } from '../../test/arbitraries'
import { type EntryNode, parse, stringify } from './parse'

function entries(text: string): EntryNode[] {
  return parse(text).nodes.filter((node) => node.kind === 'entry')
}

describe('parse', () => {
  it('reads keys with digits, dots, dashes and lower case', () => {
    expect(entries('OAUTH2_CLIENT_ID=x\napi.key-1=y\n').map((e) => e.key)).toEqual([
      'OAUTH2_CLIENT_ID',
      'api.key-1',
    ])
  })

  it('reads export and spaces around =', () => {
    const [entry] = entries('export KEY = x # note')
    expect(entry).toMatchObject({ key: 'KEY', exported: true, rawValue: ' x # note' })
  })

  it('keeps a quoted value that spans lines in one entry', () => {
    const doc = parse('KEY="a\nb"\nNEXT=1\n')
    expect(doc.nodes.map((n) => [n.kind, n.line])).toEqual([
      ['entry', 1],
      ['entry', 3],
    ])
    expect(doc.nodes[0]).toMatchObject({ rawValue: '"a\nb"' })
  })

  it('treats \\" as an escape only inside double quotes', () => {
    expect(entries('A="a\\"b"\n')[0]?.rawValue).toBe('"a\\"b"')
    expect(entries("B='a\\'\n")[0]?.rawValue).toBe("'a\\'")
  })

  it('marks only the line with an unclosed quote as unknown', () => {
    const doc = parse('A="open\nB=2\n')
    expect(doc.nodes.map((n) => n.kind)).toEqual(['unknown', 'entry'])
  })

  it.each([
    ['KEY=', true],
    ['KEY=  ', true],
    ['KEY=""', true],
    ["KEY=''", true],
    ['KEY=# comment', true],
    ['KEY="" # comment', true],
    ['KEY=x', false],
    ['KEY="#"', false],
    ['URL=https://x/#a', false],
  ])('isEmpty of %s is %s', (line, isEmpty) => {
    expect(entries(line)[0]?.isEmpty).toBe(isEmpty)
  })

  it('classifies blank lines, comments and garbage', () => {
    expect(parse('\n  \n# c\n=x\n').nodes.map((n) => n.kind)).toEqual([
      'blank',
      'blank',
      'comment',
      'unknown',
    ])
  })

  it('detects the BOM, CRLF and a missing final newline', () => {
    const doc = parse(`${String.fromCharCode(0xfeff)}A=1\nB=2\r\nC=3`)
    expect(doc).toMatchObject({ bom: true, newline: '\r\n', finalNewline: false })
    expect(doc.nodes.map((n) => n.eol)).toEqual(['\n', '\r\n', ''])
  })

  it('returns no nodes for an empty text', () => {
    expect(parse('')).toEqual({ nodes: [], newline: '\n', bom: false, finalNewline: false })
  })
})

describe('stringify', () => {
  test.prop([anyText])('restores the parsed text exactly', (text) => {
    expect(stringify(parse(text))).toBe(text)
  })

  test.prop([fc.string()])('restores any string exactly', (text) => {
    expect(stringify(parse(text))).toBe(text)
  })
})
