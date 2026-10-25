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
