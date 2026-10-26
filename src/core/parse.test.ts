import { test } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'
import { anyText, entriesOf } from '../../test/helpers'
import { parse, stringify } from './parse'

describe('parse', () => {
  it('reads keys with digits, dots, dashes and lower case', () => {
    expect(entriesOf('OAUTH2_CLIENT_ID=x\napi.key-1=y\n').map((e) => e.key)).toEqual([
      'OAUTH2_CLIENT_ID',
      'api.key-1',
    ])
  })

  it('reads export and spaces around =', () => {
    const [entry] = entriesOf('export KEY = x # note')
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
    expect(entriesOf('A="a\\"b"\n')[0]?.rawValue).toBe('"a\\"b"')
    expect(entriesOf("B='a\\'\n")[0]?.rawValue).toBe("'a\\'")
  })

  it('marks only the line with an unclosed quote as unknown', () => {
    expect(parse('A="open\nB=2\n').nodes.map((n) => n.kind)).toEqual(['unknown', 'entry'])
  })

  it.each([
    ['KEY=', true],
    ['KEY=""', true],
    ["KEY=''", true],
    ['KEY=# comment', true],
    ['KEY=x', false],
    ['KEY="#"', false],
    ['URL=https://x/#a', false],
  ])('isEmpty of %s is %s', (line, isEmpty) => {
    expect(entriesOf(line)[0]?.isEmpty).toBe(isEmpty)
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
  })

  it('does not take CRLF inside a quoted value as the newline', () => {
    expect(parse('A="x\r\ny"\n').newline).toBe('\n')
  })
})

describe('stringify', () => {
  test.prop([anyText])('restores the parsed text exactly', (text) => {
    expect(stringify(parse(text))).toBe(text)
  })
})
