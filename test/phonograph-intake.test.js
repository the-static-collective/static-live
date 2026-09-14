import test from 'node:test';
import assert from 'node:assert/strict';
import { hpHashCanonical, liveHashCanonical } from '../src/canonical-json.js';
import { intakePhonographPerformance, validateLiveIntent } from '../src/phonograph-intake.js';

const performance = {
  schema: 'haunted-phonograph/resolved-performance/v1',
  sourceHash: 'sha256:source',
  scoreHash: 'sha256:score',
  tempoBpm: 120,
  ppq: 480,
  mutation: { law: 'interval-preserving-displacement/v1', stream: 'specimen-001', seed: 'seed-001', selectedOffset: 2 },
  events: [{ tick: 0, durationTicks: 480, note: 62, velocity: 88, channel: 0, provenance: { sourceClaimHash: 'sha256:claim' } }],
  retainedUncertaintyRefs: ['sha256:harmony'],
};

const receipt = {
  schema: 'haunted-phonograph/receipt/v1',
  status: 'completed',
  sourceHash: performance.sourceHash,
  scoreHash: performance.scoreHash,
  mutation: performance.mutation,
  resolvedPerformanceHash: hpHashCanonical(performance),
  midi: { profile: 'smf0-ppq480/v1', sha256: 'sha256:midi', byteLength: 42 },
  retainedUncertaintyRefs: [...performance.retainedUncertaintyRefs],
};

const liveIntent = {
  version: 'static-live.live-intent/v0.1',
  song: { id: 'phono-live-001', title: 'PHONO-LIVE-001' },
  meter: '4/4',
  landmarks: ['entry', 'body', 'exit'],
  requiredCapabilities: ['melody.live', 'pulse.live'],
  stems: [
    { id: 'melody-fallback', kind: 'fallback', coversCapability: 'melody.live', path: 'stems/melody.wav', output: 'foh' },
    { id: 'pulse-fallback', kind: 'fallback', coversCapability: 'pulse.live', path: 'stems/pulse.wav', output: 'foh' },
  ],
  cues: { click: null, voice: null },
};

function expectCode(fn, code) {
  assert.throws(fn, (error) => error?.code === code);
}

test('crosses verified music into stage intent without inventing participation', () => {
  const { packet, crossingReceipt } = intakePhonographPerformance({ performance, phonographReceipt: receipt, liveIntent });
  const upstreamReceiptHash = hpHashCanonical(receipt);
  assert.deepEqual(packet.song, {
    id: 'phono-live-001',
    title: 'PHONO-LIVE-001',
    sourceReceipt: `hp-receipt:${upstreamReceiptHash}`,
  });
  assert.deepEqual(packet.tempo, { bpm: 120, meter: '4/4' });
  assert.deepEqual(packet.requiredCapabilities, ['melody.live', 'pulse.live']);
  assert.equal('performers' in packet, false);
  assert.equal(crossingReceipt.upstreamReceiptHash, upstreamReceiptHash);
  assert.equal(crossingReceipt.resolvedPerformanceHash, hpHashCanonical(performance));
  assert.equal(crossingReceipt.liveIntentHash, liveHashCanonical(liveIntent));
  assert.equal(crossingReceipt.performancePacketHash, liveHashCanonical(packet));
  assert.deepEqual(
    intakePhonographPerformance({ performance, phonographReceipt: receipt, liveIntent }),
    intakePhonographPerformance({ performance: structuredClone(performance), phonographReceipt: structuredClone(receipt), liveIntent: structuredClone(liveIntent) }),
  );
});

test('refuses unsupported or mismatched Phonograph ancestry', () => {
  expectCode(() => intakePhonographPerformance({ performance: { ...performance, schema: 'bad' }, phonographReceipt: receipt, liveIntent }), 'UNSUPPORTED_PHONOGRAPH_PERFORMANCE_SCHEMA');
  expectCode(() => intakePhonographPerformance({ performance, phonographReceipt: { ...receipt, schema: 'bad' }, liveIntent }), 'UNSUPPORTED_PHONOGRAPH_RECEIPT_SCHEMA');
  expectCode(() => intakePhonographPerformance({ performance, phonographReceipt: { ...receipt, status: 'partial' }, liveIntent }), 'INCOMPLETE_PHONOGRAPH_RECEIPT');
  expectCode(() => intakePhonographPerformance({ performance, phonographReceipt: { ...receipt, sourceHash: 'sha256:other' }, liveIntent }), 'PHONOGRAPH_SOURCE_MISMATCH');
  expectCode(() => intakePhonographPerformance({ performance, phonographReceipt: { ...receipt, scoreHash: 'sha256:other' }, liveIntent }), 'PHONOGRAPH_SCORE_MISMATCH');
  const tampered = structuredClone(performance);
  tampered.events[0].note += 1;
  expectCode(() => intakePhonographPerformance({ performance: tampered, phonographReceipt: receipt, liveIntent }), 'PHONOGRAPH_PERFORMANCE_HASH_MISMATCH');
  const zeroTempo = { ...performance, tempoBpm: 0 };
  expectCode(() => intakePhonographPerformance({ performance: zeroTempo, phonographReceipt: { ...receipt, resolvedPerformanceHash: hpHashCanonical(zeroTempo) }, liveIntent }), 'INVALID_PHONOGRAPH_TEMPO');
});

test('validates Live Intent explicitly and allows required capability without fallback', () => {
  assert.equal(validateLiveIntent(liveIntent), true);
  const noPulseFallback = { ...liveIntent, stems: liveIntent.stems.filter((stem) => stem.id !== 'pulse-fallback') };
  assert.equal(validateLiveIntent(noPulseFallback), true);

  const badCases = [
    { ...liveIntent, song: { ...liveIntent.song, id: '' } },
    { ...liveIntent, song: { ...liveIntent.song, title: ' ' } },
    { ...liveIntent, meter: '' },
    { ...liveIntent, landmarks: 'entry' },
    { ...liveIntent, requiredCapabilities: ['melody.live', 'melody.live'] },
    { ...liveIntent, stems: [liveIntent.stems[0], { ...liveIntent.stems[1], id: 'melody-fallback' }] },
    { ...liveIntent, stems: [{ id: 'x', kind: 'fallback', path: 'x.wav', output: 'foh' }] },
    { ...liveIntent, stems: [{ id: 'x', kind: 'fallback', coversCapability: 'ghost.live', path: 'x.wav', output: 'foh' }] },
    { ...liveIntent, stems: [...liveIntent.stems, { id: 'pulse-two', kind: 'fallback', coversCapability: 'pulse.live', path: 'two.wav', output: 'foh' }] },
    { ...liveIntent, stems: [{ id: 'x', kind: 'weird', path: 'x.wav', output: 'foh' }] },
    { ...liveIntent, stems: [{ id: 'x', kind: 'always', path: '', output: 'foh' }] },
    { ...liveIntent, cues: null },
  ];

  for (const bad of badCases) {
    expectCode(() => validateLiveIntent(bad), 'INVALID_LIVE_INTENT');
  }
});
