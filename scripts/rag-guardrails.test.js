const test = require('node:test')
const assert = require('node:assert/strict')
const { chunkTextDeterministic, clampTopK, sourceKeyForCall } = require('./rag-guardrails')

test('chunk boundaries respect size and overlap', () => {
  const text = 'a'.repeat(1300)
  const chunks = chunkTextDeterministic(text, 500, 150)
  assert.ok(chunks.length >= 3)
  for (const c of chunks) assert.ok(c.length <= 500)
  assert.equal(chunks[0].slice(-150), chunks[1].slice(0, 150))
})

test('topK is clamped to cost-safe bounds', () => {
  assert.equal(clampTopK(undefined), 8)
  assert.equal(clampTopK(0), 1)
  assert.equal(clampTopK(3), 3)
  assert.equal(clampTopK(999), 12)
})

test('source key deduplicates by call id', () => {
  assert.equal(sourceKeyForCall('abc'), 'call:abc:transcript')
  assert.equal(sourceKeyForCall('abc'), sourceKeyForCall('abc'))
  assert.notEqual(sourceKeyForCall('abc'), sourceKeyForCall('xyz'))
})
