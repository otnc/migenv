import { describe, expect, it } from 'vitest'
import { detectLocale } from './locale'

describe('detectLocale', () => {
  it('prefers --lang, then LC_ALL, LC_MESSAGES and LANG', () => {
    expect(detectLocale('ja', { LANG: 'en_US.UTF-8' })).toBe('ja')
    expect(detectLocale(undefined, { LC_ALL: 'ja_JP.UTF-8', LANG: 'en_US.UTF-8' })).toBe('ja')
    expect(detectLocale(undefined, { LC_MESSAGES: 'en_US.UTF-8', LANG: 'ja_JP.UTF-8' })).toBe('en')
  })

  it('skips empty variables and treats anything but Japanese as English', () => {
    expect(detectLocale(undefined, { LC_ALL: '', LANG: 'ja_JP.UTF-8' })).toBe('ja')
    expect(detectLocale('fr', {})).toBe('en')
  })
})
