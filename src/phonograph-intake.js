import { hpHashCanonical, liveHashCanonical } from './canonical-json.js';

const PERFORMANCE_SCHEMA = 'haunted-phonograph/resolved-performance/v1';
const RECEIPT_SCHEMA = 'haunted-phonograph/receipt/v1';
const LIVE_INTENT_SCHEMA = 'static-live.live-intent/v0.1';
const PACKET_SCHEMA = 'static-live.performance-packet/v0.1';
const CROSSING_SCHEMA = 'static-live.phono-live-crossing-receipt/v0.1';
const ADAPTER = Object.freeze({ id: 'static-live.phonograph-intake', version: '0.1' });

function fail(code, message) {
  const error = new TypeError(message);
  error.code = code;
  throw error;
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail('INVALID_LIVE_INTENT', `${label} must be a non-empty string`);
  }
}

export function validateLiveIntent(liveIntent) {
  if (!isPlainObject(liveIntent) || liveIntent.version !== LIVE_INTENT_SCHEMA) {
    fail('INVALID_LIVE_INTENT', `LiveIntent must use ${LIVE_INTENT_SCHEMA}`);
  }
  if (!isPlainObject(liveIntent.song)) fail('INVALID_LIVE_INTENT', 'song must be an object');
  requireNonEmptyString(liveIntent.song.id, 'song.id');
  requireNonEmptyString(liveIntent.song.title, 'song.title');
  requireNonEmptyString(liveIntent.meter, 'meter');
  if (!Array.isArray(liveIntent.landmarks)) fail('INVALID_LIVE_INTENT', 'landmarks must be an array');
  if (!Array.isArray(liveIntent.requiredCapabilities)) fail('INVALID_LIVE_INTENT', 'requiredCapabilities must be an array');
  if (!Array.isArray(liveIntent.stems)) fail('INVALID_LIVE_INTENT', 'stems must be an array');

  const required = new Set();
  for (const capability of liveIntent.requiredCapabilities) {
    requireNonEmptyString(capability, 'requiredCapabilities[]');
    if (required.has(capability)) fail('INVALID_LIVE_INTENT', `duplicate required capability: ${capability}`);
    required.add(capability);
  }

  const stemIds = new Set();
  const fallbackCoverage = new Set();
  for (const stem of liveIntent.stems) {
    if (!isPlainObject(stem)) fail('INVALID_LIVE_INTENT', 'stem must be an object');
    requireNonEmptyString(stem.id, 'stem.id');
    if (stemIds.has(stem.id)) fail('INVALID_LIVE_INTENT', `duplicate stem id: ${stem.id}`);
    stemIds.add(stem.id);
    if (!['always', 'fallback'].includes(stem.kind)) fail('INVALID_LIVE_INTENT', `invalid stem kind: ${stem.kind}`);
    requireNonEmptyString(stem.path, 'stem.path');
    requireNonEmptyString(stem.output, 'stem.output');
    if (stem.kind === 'fallback') {
      requireNonEmptyString(stem.coversCapability, 'stem.coversCapability');
      if (!required.has(stem.coversCapability)) fail('INVALID_LIVE_INTENT', `fallback covers undeclared capability: ${stem.coversCapability}`);
      if (fallbackCoverage.has(stem.coversCapability)) fail('INVALID_LIVE_INTENT', `duplicate fallback coverage: ${stem.coversCapability}`);
      fallbackCoverage.add(stem.coversCapability);
    }
  }

  if (!isPlainObject(liveIntent.cues) || !Object.hasOwn(liveIntent.cues, 'click') || !Object.hasOwn(liveIntent.cues, 'voice')) {
    fail('INVALID_LIVE_INTENT', 'cues must be an object with click and voice keys');
  }
  return true;
}

export function intakePhonographPerformance({ performance, phonographReceipt, liveIntent }) {
  if (performance?.schema !== PERFORMANCE_SCHEMA) fail('UNSUPPORTED_PHONOGRAPH_PERFORMANCE_SCHEMA', 'unsupported Phonograph performance schema');
  if (phonographReceipt?.schema !== RECEIPT_SCHEMA) fail('UNSUPPORTED_PHONOGRAPH_RECEIPT_SCHEMA', 'unsupported Phonograph receipt schema');
  if (phonographReceipt.status !== 'completed') fail('INCOMPLETE_PHONOGRAPH_RECEIPT', 'Phonograph receipt must be completed');
  if (performance.sourceHash !== phonographReceipt.sourceHash) fail('PHONOGRAPH_SOURCE_MISMATCH', 'performance source does not match receipt');
  if (performance.scoreHash !== phonographReceipt.scoreHash) fail('PHONOGRAPH_SCORE_MISMATCH', 'performance score does not match receipt');

  const resolvedPerformanceHash = hpHashCanonical(performance);
  if (resolvedPerformanceHash !== phonographReceipt.resolvedPerformanceHash) {
    fail('PHONOGRAPH_PERFORMANCE_HASH_MISMATCH', 'performance hash does not match receipt');
  }
  if (!Number.isFinite(performance.tempoBpm) || performance.tempoBpm <= 0) {
    fail('INVALID_PHONOGRAPH_TEMPO', 'performance tempo must be positive and finite');
  }

  validateLiveIntent(liveIntent);
  const upstreamReceiptHash = hpHashCanonical(phonographReceipt);
  const packet = {
    version: PACKET_SCHEMA,
    song: {
      id: liveIntent.song.id,
      title: liveIntent.song.title,
      sourceReceipt: `hp-receipt:${upstreamReceiptHash}`,
    },
    tempo: { bpm: performance.tempoBpm, meter: liveIntent.meter },
    landmarks: structuredClone(liveIntent.landmarks),
    requiredCapabilities: structuredClone(liveIntent.requiredCapabilities),
    stems: structuredClone(liveIntent.stems),
    cues: structuredClone(liveIntent.cues),
  };

  const crossingReceipt = {
    version: CROSSING_SCHEMA,
    status: 'completed',
    adapter: ADAPTER,
    acceptedPerformanceSchema: performance.schema,
    acceptedReceiptSchema: phonographReceipt.schema,
    upstreamReceiptHash,
    sourceHash: phonographReceipt.sourceHash,
    scoreHash: phonographReceipt.scoreHash,
    resolvedPerformanceHash: phonographReceipt.resolvedPerformanceHash,
    mutation: structuredClone(phonographReceipt.mutation ?? performance.mutation),
    retainedUncertaintyRefs: [...(performance.retainedUncertaintyRefs ?? [])],
    liveIntentHash: liveHashCanonical(liveIntent),
    performancePacketHash: liveHashCanonical(packet),
  };

  return deepFreeze({ packet, crossingReceipt });
}
