import assert from 'node:assert/strict'
import { test } from 'node:test'

test('core loads through import', async () => {
  const core = await import('migenv')
  assert.equal(typeof core, 'object')
})

test('node layer loads through import', async () => {
  const node = await import('migenv/node')
  assert.equal(typeof node, 'object')
})
