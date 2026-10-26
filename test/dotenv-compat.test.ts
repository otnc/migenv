import { test } from '@fast-check/vitest'
import dotenv from 'dotenv'
import { expect } from 'vitest'
import { align } from '../src/core/align'
import { alignOptions, envText } from './helpers'

test.prop([envText, envText, alignOptions])(
  'dotenv reads the same non-empty values before and after align',
  (current, template, opts) => {
    const result = align(current, template, opts)
    const before = dotenv.parse(current)
    const after = dotenv.parse(result.text)
    for (const [key, value] of Object.entries(before)) {
      if (value === '' || result.removed.includes(key)) continue
      expect(after[key], key).toBe(value)
    }
  },
)
