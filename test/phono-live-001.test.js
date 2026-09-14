import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hpHashCanonical } from '../src/canonical-json.js';
import { intakePhonographPerformance } from '../src/phonograph-intake.js';
import { compileStageProjection } from '../src/compiler.js';

const load = (path) => JSON.parse(readFileSync(path, 'utf8'));
const performance = load('fixtures/phono-live-001/resolved-performance.json');
const receipt = load('fixtures/phono-live-001/phonograph-receipt.json');
const intent = load('fixtures/phono-live-001/live-intent.json');
const brokenIntent = load('fixtures/phono-live-001/live-intent-broken.json');
const config = (id) => load(`fixtures/phono-live-001/configurations/${id}.json`);

test('real upstream fixture verifies and crosses', () => {
  assert.equal(hpHashCanonical(performance), receipt.resolvedPerformanceHash);
  assert.doesNotThrow(() => intakePhonographPerformance({ performance, phonographReceipt: receipt, liveIntent: intent }));
});

test('PL/2, PL/1, and PL/0 remain truthful and playable', () => {
  const { packet } = intakePhonographPerformance({ performance, phonographReceipt: receipt, liveIntent: intent });
  const pl2 = compileStageProjection(packet, config('pl2'));
  const pl1 = compileStageProjection(packet, config('pl1'));
  const pl0 = compileStageProjection(packet, config('pl0'));

  assert.equal(pl2.playable, true);
  assert.deepEqual(pl2.liveContributions.map((x) => x.performerId), ['human-a', 'human-b']);
  assert.deepEqual(pl2.fallbackCoverage, []);

  assert.equal(pl1.playable, true);
  assert.deepEqual(pl1.liveContributions.map((x) => x.performerId), ['human-a']);
  assert.deepEqual(pl1.fallbackCoverage.map((x) => x.capability), ['pulse.live']);

  assert.equal(pl0.playable, true);
  assert.deepEqual(pl0.liveContributions, []);
  assert.deepEqual(pl0.fallbackCoverage.map((x) => x.capability), ['melody.live', 'pulse.live']);
});

test('PL/BROKEN crosses but fails closed at stage compilation', () => {
  const { packet } = intakePhonographPerformance({ performance, phonographReceipt: receipt, liveIntent: brokenIntent });
  const projection = compileStageProjection(packet, config('broken'));
  assert.equal(projection.playable, false);
  assert.deepEqual(projection.unresolvedCapabilities, ['pulse.live']);
});

test('tampering the real performance is refused before the room', () => {
  const tampered = structuredClone(performance);
  tampered.events[0].note += 1;
  assert.throws(
    () => intakePhonographPerformance({ performance: tampered, phonographReceipt: receipt, liveIntent: intent }),
    (error) => error.code === 'PHONOGRAPH_PERFORMANCE_HASH_MISMATCH',
  );
});
