import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  canonicalStringify,
  hpHashCanonical,
  liveHashCanonical,
} from '../src/canonical-json.js';

const sha256 = (text) => `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;

test('canonical JSON sorts object keys, preserves array order, and normalizes -0', () => {
  const value = {
    z: -0,
    a: [3, { y: true, x: 'room' }],
  };
  const expected = '{"a":[3,{"x":"room","y":true}],"z":0}';
  assert.equal(canonicalStringify(value), expected);
});

test('hp and live hash surfaces are separately named and deterministic', () => {
  const value = { b: 2, a: 1 };
  const expected = sha256('{"a":1,"b":2}');
  assert.equal(hpHashCanonical(value), expected);
  assert.equal(liveHashCanonical(value), expected);
  assert.equal(hpHashCanonical(value), hpHashCanonical({ a: 1, b: 2 }));
  assert.equal(liveHashCanonical(value), liveHashCanonical({ a: 1, b: 2 }));
});

test('canonicalization rejects non-finite numbers and unsupported JSON values', () => {
  assert.throws(() => canonicalStringify({ bpm: Infinity }), /finite numbers/);
  assert.throws(() => canonicalStringify({ bad: undefined }), /JSON-safe/);
  assert.throws(() => canonicalStringify([1, , 3]), /sparse arrays/);
});
