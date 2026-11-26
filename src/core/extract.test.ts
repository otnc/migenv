import { fc, test } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'
import { anyText, envText } from '../../test/helpers'
import { extract } from './extract'

describe('extract without a template', () => {
  it('empties values and keeps comments, blank lines and export', () => {
    const current =
      '# Server\nexport PORT = 3000 # local port\n\n# Keys\nAPI_KEY="sk-live\nsecond line"\nEMPTY=\n'
    const result = extract(current)
    expect(result.text).toBe('# Server\nexport PORT =\n\n# Keys\nAPI_KEY=\nEMPTY=\n')
    expect(result.added).toEqual(['PORT', 'API_KEY', 'EMPTY'])
    expect(result.changed).toBe(true)
  })

  it('drops commented-out entries by default without leaving extra blank lines', () => {
    const current = '# OLD_KEY=sk-old\n\nA=1\n\n# export B = sk-b\n\nC=3\n# just a note\n'
    const result = extract(current)
    expect(result.text).toBe('A=\n\nC=\n# just a note\n')
    expect(result.droppedCommentedEntries).toEqual(['OLD_KEY', 'B'])
  })

  it('writes commented-out entries as empty ones with commentedEntries: empty', () => {
    const current = '# SENTRY_DSN=https://key@sentry\n# A=old\nA=new\n'
    const result = extract(current, undefined, { commentedEntries: 'empty' })
    expect(result.text).toBe('# SENTRY_DSN=\nA=\n')
    expect(result.droppedCommentedEntries).toEqual([])
  })

  it('copies commented-out entries as they are with commentedEntries: keep', () => {
    const current = '# SENTRY_DSN=https://key@sentry\nA=1\n'
    expect(extract(current, undefined, { commentedEntries: 'keep' }).text).toBe(
      '# SENTRY_DSN=https://key@sentry\nA=\n',
    )
  })

  it('copies only the values keepValues names', () => {
    const current = 'PORT=3000\nNEXT_PUBLIC_URL=https://dev\nAPI_KEY=sk\nEMPTY=\n'
    const result = extract(current, undefined, { keepValues: ['PORT', 'NEXT_PUBLIC_*', 'EMPTY'] })
    expect(result.text).toBe('PORT=3000\nNEXT_PUBLIC_URL=https://dev\nAPI_KEY=\nEMPTY=\n')
    expect(result.keptValues).toEqual(['PORT', 'NEXT_PUBLIC_URL'])
  })

  it('writes each key once', () => {
    expect(extract('A=1\nB=2\nA=3\n').text).toBe('A=\nB=\n')
  })

  it('leaves out unparsable lines with a warning that has no value, or throws in strict mode', () => {
    const current = 'A=1\nsk-live-secret\nB=2\n'
    const result = extract(current)
    expect(result.text).toBe('A=\nB=\n')
    expect(result.warnings).toEqual([expect.objectContaining({ code: 'unknown-line', line: 2 })])
    expect(JSON.stringify(result.warnings)).not.toContain('secret')
    expect(() => extract(current, undefined, { strict: true })).toThrow(
      expect.objectContaining({ code: 'UNKNOWN_LINE' }),
    )
  })

  it('keeps the BOM, line endings and missing final newline of the env file', () => {
    expect(extract('﻿A=1\r\nB=2').text).toBe('﻿A=\r\nB=')
  })
})

describe('extract into an existing template', () => {
  it('inserts new keys after the key before them, with the comments directly above them', () => {
    const template = '# Database\nDB_URL=postgres://localhost # default\n\n# Auth\nAUTH_SECRET=\n'
    const current =
      'DB_URL=postgres://prod\n# pool size\nDB_POOL=10\n\nAUTH_SECRET=s\n\n# Redis\nREDIS_URL=redis://x\nREDIS_TLS=1\n'
    const result = extract(current, template)
    expect(result.text).toBe(
      '# Database\nDB_URL=postgres://localhost # default\n# pool size\nDB_POOL=\n\n# Auth\nAUTH_SECRET=\n# Redis\nREDIS_URL=\nREDIS_TLS=\n',
    )
    expect(result.added).toEqual(['DB_POOL', 'REDIS_URL', 'REDIS_TLS'])
  })

  it('appends keys with no known key before them at the end, after a blank line when they bring comments', () => {
    const result = extract('# New\nFIRST=1\nA=2\n', 'A=\n')
    expect(result.text).toBe('A=\n\n# New\nFIRST=\n')
  })

  it('leaves the template unchanged when it already has every key', () => {
    const template = '# keep me\nA=default\n# SENTRY_DSN=\n'
    const result = extract('A=1\nSENTRY_DSN=x\n', template)
    expect(result).toMatchObject({ text: template, changed: false, added: [] })
  })

  it('does not add back keys the template retires or renames', () => {
    const template = '# @renamed-from OLD_NAME\nNEW_NAME=\n# @retired LEGACY\n'
    expect(extract('OLD_NAME=1\nLEGACY=2\n', template).changed).toBe(false)
  })

  it('removes unused template entries with remove: true, except protected ones', () => {
    const template = 'A=\nGONE=\nKEPT_SECRET=\n'
    const result = extract('A=1\n', template, { remove: true, protect: ['*_SECRET'] })
    expect(result.text).toBe('A=\nKEPT_SECRET=\n')
    expect(result.removed).toEqual(['GONE'])
    expect(result.protectedSkips).toEqual([{ key: 'KEPT_SECRET', action: 'remove' }])
  })

  it("uses the template's line endings for new lines and keeps its missing final newline", () => {
    expect(extract('A=1\r\nB=2\r\n', '﻿A=\nX=').text).toBe('﻿A=\nB=\nX=')
  })

  it('adds commented-out entries the template lacks with commentedEntries: empty', () => {
    const result = extract('A=1\n# OPTIONAL=secret\n', 'A=\n', { commentedEntries: 'empty' })
    expect(result.text).toBe('A=\n# OPTIONAL=\n')
  })
})

const SECRET = 'S3CR3T'
const secretLine = fc.constantFrom(
  `KEY_1=${SECRET}`,
  `export B = "${SECRET}\nmore" # x`,
  `C='${SECRET}'`,
  `# A=${SECRET}`,
  `# export lower_case = ${SECRET}`,
  `${SECRET}`,
)
const withSecrets = fc
  .tuple(envText, fc.array(secretLine, { minLength: 1, maxLength: 4 }))
  .map(([text, secrets]) => [...secrets, text].join('\n'))

describe('extract properties', () => {
  test.prop([
    withSecrets,
    fc.option(envText, { nil: undefined }),
    fc.constantFrom('remove' as const, 'empty' as const),
  ])('never copies a value into the template', (current, template, commentedEntries) => {
    const result = extract(current, template, { commentedEntries })
    expect(result.text).not.toContain(SECRET)
    expect(JSON.stringify(result.warnings)).not.toContain(SECRET)
  })

  test.prop([anyText, fc.option(anyText, { nil: undefined })])(
    'changes nothing when run on its own output',
    (current, template) => {
      const once = extract(current, template).text
      expect(extract(current, once).text).toBe(once)
    },
  )
})
