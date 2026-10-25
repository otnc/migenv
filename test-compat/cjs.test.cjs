// Runs on Node 18 and 20 against the built dist, without vitest (which needs Node 22.12+).
const assert = require('node:assert/strict')
const { test } = require('node:test')

test('core loads through require', () => {
  const core = require('migenv')
  assert.equal(typeof core, 'object')
})

test('node layer loads through require', () => {
  const node = require('migenv/node')
  assert.equal(typeof node, 'object')
})
