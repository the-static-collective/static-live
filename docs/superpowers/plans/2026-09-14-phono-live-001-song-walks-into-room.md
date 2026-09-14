# PHONO-LIVE-001 — THE SONG WALKS INTO THE ROOM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dependency-free Static Live intake that verifies one exact Haunted Phonograph `ResolvedPerformance` + completed receipt, combines it with explicit `LiveIntent`, emits a deterministic Performance Packet + crossing receipt, and proves truthful room incarnations under PL/2, PL/1, PL/0, and PL/BROKEN.

**Architecture:** Haunted Phonography remains unchanged and authoritative for musical ancestry. Static Live owns the receiving adapter, keeps Haunted Phonograph hash compatibility separate from Static Live-local canonical hashing, validates stage intent without inferring stage facts from music, and hands the generated Performance Packet to the existing `compileStageProjection()` unchanged.

**Tech Stack:** Node.js 22+, ECMAScript modules, built-in `node:test`, built-in `node:crypto`, built-in filesystem APIs; no runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-09-14-phono-live-001-song-walks-into-room-design.md`

## Global Constraints

- Change **Static Live only**; Haunted Phonography receives no code change.
- Keep `src/compiler.js` authoritative for night-specific coverage/playability and free of Phonograph-specific logic.
- Accept only `haunted-phonograph/resolved-performance/v1` plus completed `haunted-phonograph/receipt/v1`.
- Verify `sourceHash`, `scoreHash`, and Haunted Phonograph canonical `resolvedPerformanceHash` before packet generation.
- `song.sourceReceipt` is `"hp-receipt:" + hpHashCanonical(phonographReceipt)`; the packet must not point at the new crossing receipt.
- `LiveIntent` owns stage declarations: song id/title, meter, landmarks, capabilities, stems, cues.
- Never infer instrumentation, performer capability, meter, fallback, or human identity from pitches, channels, timing, or other musical evidence.
- Duplicate required capabilities are invalid.
- Stem ids are unique.
- Each fallback stem covers exactly one declared required capability; at most one fallback may cover each capability.
- A required capability may legitimately have no fallback; this is not an intake failure and may later produce `playable: false`.
- Preserve the semantic distinction `hpHashCanonical()` != `liveHashCanonical()` even while the algorithms are presently identical.
- Identical parsed inputs must produce canonically identical packets and crossing receipts.
- Existing LIVE-001 tests remain green.
- No shared cross-project package, repository-to-repository runtime fetch, audio rendering, stem generation, scheduling, rehearsal state, MIDI/OSC control, or room-recording return path in this slice.

---

## File map

- Create `src/canonical-json.js` — JSON-safe normalization plus separately named Haunted Phonograph compatibility and Static Live hash surfaces.
- Create `src/phonograph-intake.js` — schema checks, ancestry verification, Live Intent validation, packet composition, crossing receipt composition.
- Create `test/canonical-json.test.js` — canonicalization behavior and semantic hash-surface conformance.
- Create `test/phonograph-intake.test.js` — intake success/failure/determinism tests.
- Create `test/phono-live-001.test.js` — checked-in real upstream fixture + PL/2/PL/1/PL/0/PL/BROKEN integration proof through the existing compiler.
- Create `fixtures/phono-live-001/resolved-performance.json` — exact exported Haunted Phonograph specimen performance.
- Create `fixtures/phono-live-001/phonograph-receipt.json` — matching exact completed upstream receipt.
- Create `fixtures/phono-live-001/live-intent.json` — normal two-capability embodiment declaration with both fallbacks.
- Create `fixtures/phono-live-001/live-intent-broken.json` — valid intent with one required capability intentionally lacking fallback.
- Create `fixtures/phono-live-001/configurations/pl2.json` — two live providers.
- Create `fixtures/phono-live-001/configurations/pl1.json` — melody live, pulse fallback.
- Create `fixtures/phono-live-001/configurations/pl0.json` — no humans, both fallbacks.
- Create `fixtures/phono-live-001/configurations/broken.json` — no provider for the deliberately uncovered capability.
- Create `fixtures/phono-live-001/UPSTREAM.md` — exact Haunted Phonography commit and deterministic fixture-export recipe.
- Create `scripts/render-phono-live-001.js` — deterministic checked-in specimen/example renderer.
- Create `test/phono-live-render.test.js` — render script smoke/determinism checks in a temp directory.
- Modify `package.json` — add `phono-live:001` script only.
- Create `examples/phono-live-001/performance-packet.json` and `crossing-receipt.json` — exact crossing witnesses.
- Create `examples/phono-live-001/pl2/`, `pl1/`, `pl0/`, `broken/` stage projections and stage aids.
- Modify `README.md` — document the crossing, command, boundary, and current proof.

---

### Task 1: Canonical JSON and two explicit hash surfaces

**Files:**
- Create: `src/canonical-json.js`
- Create: `test/canonical-json.test.js`

**Interfaces:**
- Produces: `canonicalStringify(value)` -> canonical JSON string.
- Produces: `hpHashCanonical(value)` -> `sha256:<hex>` using the exact accepted Haunted Phonograph v1 algorithm.
- Produces: `liveHashCanonical(value)` -> `sha256:<hex>` for Static Live-local binding.
- Both public hash functions may call one internal serializer today; callers must not treat them as interchangeable policy names.

- [ ] **Step 1: Write failing canonicalization tests**

Create `test/canonical-json.test.js` with the exact behavioral floor:

```js
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
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test test/canonical-json.test.js
```

Expected: FAIL because `src/canonical-json.js` does not exist.

- [ ] **Step 3: Implement the minimal canonicalizer**

Create `src/canonical-json.js` using `node:crypto`. Implement a JSON-safe normalizer matching Haunted Phonograph v1 for accepted upstream verification:

```js
import { createHash } from 'node:crypto';

function fail(message) {
  throw new TypeError(message);
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalize(value, path = '$', ancestors = new WeakSet()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail(`${path} must contain only finite numbers`);
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) fail(`${path} must not contain cycles`);
    ancestors.add(value);
    try {
      return value.map((item, index) => {
        if (!(index in value)) fail(`${path} must not contain sparse arrays`);
        return normalize(item, `${path}[${index}]`, ancestors);
      });
    } finally {
      ancestors.delete(value);
    }
  }
  if (!isPlainObject(value) || Object.getOwnPropertySymbols(value).length > 0) {
    fail(`${path} must contain only JSON-safe plain objects`);
  }
  if (ancestors.has(value)) fail(`${path} must not contain cycles`);
  ancestors.add(value);
  try {
    const normalized = {};
    for (const key of Object.keys(value)) {
      const child = value[key];
      if (child === undefined || typeof child === 'function' || typeof child === 'bigint') {
        fail(`${path}.${key} must contain only JSON-safe values`);
      }
      normalized[key] = normalize(child, `${path}.${key}`, ancestors);
    }
    return normalized;
  } finally {
    ancestors.delete(value);
  }
}

function serialize(value) {
  if (value === null || ['string', 'boolean', 'number'].includes(typeof value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(serialize).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${serialize(value[key])}`).join(',')}}`;
}

export function canonicalStringify(value) {
  return serialize(normalize(value));
}

function hash(value) {
  return `sha256:${createHash('sha256').update(canonicalStringify(value), 'utf8').digest('hex')}`;
}

export function hpHashCanonical(value) {
  return hash(value);
}

export function liveHashCanonical(value) {
  return hash(value);
}
```

Do not import Haunted Phonography code at runtime.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
node --test test/canonical-json.test.js
```

Expected: PASS.

- [ ] **Step 5: Run the existing suite for regression safety**

Run:

```bash
npm test
```

Expected: existing LIVE-001 suite plus canonical tests PASS.

- [ ] **Step 6: Commit Task 1**

```bash
git add src/canonical-json.js test/canonical-json.test.js
git commit -m "feat: add PHONO-LIVE canonical hash surfaces"
```

---

### Task 2: Verified Phonograph intake and Live Intent boundary

**Files:**
- Create: `src/phonograph-intake.js`
- Create: `test/phonograph-intake.test.js`

**Interfaces:**
- Consumes: `hpHashCanonical()` and `liveHashCanonical()` from Task 1.
- Produces: `validateLiveIntent(liveIntent)` -> `true` or throws typed `TypeError` with `.code`.
- Produces: `intakePhonographPerformance({ performance, phonographReceipt, liveIntent })` -> frozen `{ packet, crossingReceipt }`.
- Exact packet schema: `static-live.performance-packet/v0.1`.
- Exact crossing schema: `static-live.phono-live-crossing-receipt/v0.1`.

- [ ] **Step 1: Write failing happy-path and ownership tests**

In `test/phonograph-intake.test.js`, construct one minimal synthetic performance and derive its receipt hash using the real helper so the test does not hard-code a fake algorithm:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { hpHashCanonical, liveHashCanonical } from '../src/canonical-json.js';
import { intakePhonographPerformance } from '../src/phonograph-intake.js';

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

const phonographReceipt = {
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

test('intake preserves musical ancestry and takes stage facts only from Live Intent', () => {
  const { packet, crossingReceipt } = intakePhonographPerformance({ performance, phonographReceipt, liveIntent });
  const upstreamReceiptHash = hpHashCanonical(phonographReceipt);

  assert.deepEqual(packet.song, {
    id: 'phono-live-001',
    title: 'PHONO-LIVE-001',
    sourceReceipt: `hp-receipt:${upstreamReceiptHash}`,
  });
  assert.deepEqual(packet.tempo, { bpm: 120, meter: '4/4' });
  assert.deepEqual(packet.requiredCapabilities, ['melody.live', 'pulse.live']);
  assert.equal(crossingReceipt.upstreamReceiptHash, upstreamReceiptHash);
  assert.equal(crossingReceipt.resolvedPerformanceHash, hpHashCanonical(performance));
  assert.equal(crossingReceipt.liveIntentHash, liveHashCanonical(liveIntent));
  assert.equal(crossingReceipt.performancePacketHash, liveHashCanonical(packet));
  assert.equal('performers' in packet, false);
});
```

Also assert repeated calls with equivalent parsed input objects produce deep-equal packet/receipt results.

- [ ] **Step 2: Write failing refusal tests**

Add separate tests with exact expected error codes:

```js
assert.throws(
  () => intakePhonographPerformance({
    performance: { ...performance, schema: 'haunted-phonograph/resolved-performance/v999' },
    phonographReceipt,
    liveIntent,
  }),
  (error) => error.code === 'UNSUPPORTED_PHONOGRAPH_PERFORMANCE_SCHEMA',
);

assert.throws(
  () => intakePhonographPerformance({
    performance: { ...performance, tempoBpm: 0 },
    phonographReceipt: { ...phonographReceipt, resolvedPerformanceHash: hpHashCanonical({ ...performance, tempoBpm: 0 }) },
    liveIntent,
  }),
  (error) => error.code === 'INVALID_PHONOGRAPH_TEMPO',
);
```

Cover all of these codes:

```text
UNSUPPORTED_PHONOGRAPH_PERFORMANCE_SCHEMA
UNSUPPORTED_PHONOGRAPH_RECEIPT_SCHEMA
INCOMPLETE_PHONOGRAPH_RECEIPT
PHONOGRAPH_SOURCE_MISMATCH
PHONOGRAPH_SCORE_MISMATCH
PHONOGRAPH_PERFORMANCE_HASH_MISMATCH
INVALID_PHONOGRAPH_TEMPO
INVALID_LIVE_INTENT
```

For `INVALID_LIVE_INTENT`, include cases for missing song id/title, missing meter, duplicate required capability, duplicate stem id, fallback without `coversCapability`, fallback covering undeclared capability, and two fallbacks covering the same capability. Include one positive case where a required capability has **no** fallback and validation still succeeds.

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```bash
node --test test/phonograph-intake.test.js
```

Expected: FAIL because `src/phonograph-intake.js` does not exist.

- [ ] **Step 4: Implement exact validators and intake**

Create `src/phonograph-intake.js`. Keep the public shape small:

```js
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

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) fail('INVALID_LIVE_INTENT', `${label} must be a non-empty string`);
}

export function validateLiveIntent(liveIntent) {
  if (!liveIntent || typeof liveIntent !== 'object' || Array.isArray(liveIntent)) fail('INVALID_LIVE_INTENT', 'Live Intent must be an object');
  if (liveIntent.version !== LIVE_INTENT_SCHEMA) fail('INVALID_LIVE_INTENT', `Live Intent must use ${LIVE_INTENT_SCHEMA}`);
  requireNonEmptyString(liveIntent.song?.id, 'song.id');
  requireNonEmptyString(liveIntent.song?.title, 'song.title');
  requireNonEmptyString(liveIntent.meter, 'meter');
  if (!Array.isArray(liveIntent.landmarks) || !Array.isArray(liveIntent.requiredCapabilities) || !Array.isArray(liveIntent.stems)) {
    fail('INVALID_LIVE_INTENT', 'landmarks, requiredCapabilities, and stems must be arrays');
  }
  const capabilitySet = new Set(liveIntent.requiredCapabilities);
  if (capabilitySet.size !== liveIntent.requiredCapabilities.length) fail('INVALID_LIVE_INTENT', 'requiredCapabilities must be unique');
  const stemIds = new Set();
  const fallbackCapabilities = new Set();
  for (const stem of liveIntent.stems) {
    requireNonEmptyString(stem?.id, 'stem.id');
    if (stemIds.has(stem.id)) fail('INVALID_LIVE_INTENT', `duplicate stem id: ${stem.id}`);
    stemIds.add(stem.id);
    if (stem.kind === 'fallback') {
      requireNonEmptyString(stem.coversCapability, `stem ${stem.id}.coversCapability`);
      if (!capabilitySet.has(stem.coversCapability)) fail('INVALID_LIVE_INTENT', `fallback ${stem.id} covers undeclared capability`);
      if (fallbackCapabilities.has(stem.coversCapability)) fail('INVALID_LIVE_INTENT', `multiple fallbacks cover ${stem.coversCapability}`);
      fallbackCapabilities.add(stem.coversCapability);
    }
  }
  return true;
}
```

Then implement `intakePhonographPerformance()` in this exact order:

```text
validate performance schema
validate receipt schema + completed status
compare performance.sourceHash to receipt.sourceHash
compare performance.scoreHash to receipt.scoreHash
verify hpHashCanonical(performance) == receipt.resolvedPerformanceHash
validate positive finite performance.tempoBpm
validate LiveIntent
compute upstreamReceiptHash = hpHashCanonical(phonographReceipt)
build packet only from the fixed ownership table
compute liveIntentHash + packet hash with liveHashCanonical
build crossing receipt
return frozen { packet, crossingReceipt }
```

Use this crossing receipt shape:

```js
{
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
}
```

The Performance Packet must be:

```js
{
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
}
```

Do not copy performance events, MIDI channels, pitches, or performer guesses into stage declarations.

- [ ] **Step 5: Run focused intake tests and verify GREEN**

Run:

```bash
node --test test/canonical-json.test.js test/phonograph-intake.test.js
```

Expected: PASS.

- [ ] **Step 6: Run full suite**

Run:

```bash
npm test
```

Expected: all tests PASS; existing LIVE-001 behavior unchanged.

- [ ] **Step 7: Commit Task 2**

```bash
git add src/phonograph-intake.js test/phonograph-intake.test.js
git commit -m "feat: add verified Phonograph intake boundary"
```

---

### Task 3: Import the exact Haunted Phonograph specimen and prove four room configurations

**Files:**
- Create: `fixtures/phono-live-001/resolved-performance.json`
- Create: `fixtures/phono-live-001/phonograph-receipt.json`
- Create: `fixtures/phono-live-001/live-intent.json`
- Create: `fixtures/phono-live-001/live-intent-broken.json`
- Create: `fixtures/phono-live-001/configurations/pl2.json`
- Create: `fixtures/phono-live-001/configurations/pl1.json`
- Create: `fixtures/phono-live-001/configurations/pl0.json`
- Create: `fixtures/phono-live-001/configurations/broken.json`
- Create: `fixtures/phono-live-001/UPSTREAM.md`
- Create: `test/phono-live-001.test.js`

**Interfaces:**
- Consumes: exact Haunted Phonography main commit `3ea4c141ffa3abe18f06019c0b0f2dd62ba20dd7`.
- Consumes: `intakePhonographPerformance()` and existing `compileStageProjection()`.
- Produces: checked-in immutable fixture evidence with no runtime GitHub/Phonograph dependency.

- [ ] **Step 1: Export the exact upstream performance + receipt from the pinned Haunted Phonograph commit**

From the Static Live worktree root, preserve its path and use an isolated temporary clone:

```bash
STATIC_LIVE_ROOT="$PWD"
TMP_PHONO="$(mktemp -d)"
git clone https://github.com/the-static-collective/the-haunted-phonography.git "$TMP_PHONO"
cd "$TMP_PHONO"
git checkout 3ea4c141ffa3abe18f06019c0b0f2dd62ba20dd7
npm test
mkdir -p "$STATIC_LIVE_ROOT/fixtures/phono-live-001"
node --input-type=module <<'NODE'
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { identifySource } from './src/source.mjs';
import { admitObservations } from './src/observations.mjs';
import { buildScore } from './src/score.mjs';
import { mutateScore } from './src/mutation.mjs';
import { resolvePerformance } from './src/performance.mjs';
import { encodeMidi } from './src/midi.mjs';
import { buildReceipt } from './src/receipt.mjs';
import { canonicalStringify } from './src/provenance.mjs';

const staticLiveRoot = process.env.STATIC_LIVE_ROOT;
const sourcePath = resolve('test/fixtures/specimen-001.wav');
const observationsPath = resolve('test/fixtures/specimen-001.observations.json');
const source = await identifySource(sourcePath);
const declaration = JSON.parse(await readFile(observationsPath, 'utf8'));
const observations = admitObservations({ source, declaration });
const score = buildScore({ source, observations });
const mutationResult = mutateScore({ score, seed: 'seed-001' });
const performance = resolvePerformance({ score, observations, mutationResult });
const midiBytes = encodeMidi(performance);
const receipt = buildReceipt({ source, observations, score, mutationResult, performance, midiBytes });
await writeFile(`${staticLiveRoot}/fixtures/phono-live-001/resolved-performance.json`, `${canonicalStringify(performance)}\n`);
await writeFile(`${staticLiveRoot}/fixtures/phono-live-001/phonograph-receipt.json`, `${canonicalStringify(receipt)}\n`);
NODE
cd "$STATIC_LIVE_ROOT"
rm -rf "$TMP_PHONO"
```

Export `STATIC_LIVE_ROOT` for the heredoc process before running the node step:

```bash
export STATIC_LIVE_ROOT
```

Expected: two checked-in-source candidates appear under `fixtures/phono-live-001/`; do not hand-edit them.

- [ ] **Step 2: Record fixture provenance**

Create `fixtures/phono-live-001/UPSTREAM.md` with the exact source repository, commit, source fixture names, seed, and the statement:

```markdown
# PHONO-LIVE-001 upstream fixture

- Repository: `the-static-collective/the-haunted-phonography`
- Commit: `3ea4c141ffa3abe18f06019c0b0f2dd62ba20dd7`
- Source fixture: `test/fixtures/specimen-001.wav`
- Observation fixture: `test/fixtures/specimen-001.observations.json`
- Mutation seed: `seed-001`
- Exported objects: exact canonical `ResolvedPerformance` and exact completed Phonograph receipt reconstructed from the pinned source/observation inputs.

These files are fixture evidence. Static Live does not fetch Haunted Phonography at runtime.
```

- [ ] **Step 3: Add explicit Live Intent fixtures**

Create `fixtures/phono-live-001/live-intent.json`:

```json
{
  "version": "static-live.live-intent/v0.1",
  "song": { "id": "phono-live-001", "title": "PHONO-LIVE-001" },
  "meter": "4/4",
  "landmarks": ["entry", "body", "exit"],
  "requiredCapabilities": ["melody.live", "pulse.live"],
  "stems": [
    { "id": "melody-fallback", "kind": "fallback", "coversCapability": "melody.live", "path": "stems/melody.wav", "output": "foh" },
    { "id": "pulse-fallback", "kind": "fallback", "coversCapability": "pulse.live", "path": "stems/pulse.wav", "output": "foh" }
  ],
  "cues": { "click": null, "voice": null }
}
```

Create `fixtures/phono-live-001/live-intent-broken.json` as a **valid** intent whose `pulse.live` capability has no fallback:

```json
{
  "version": "static-live.live-intent/v0.1",
  "song": { "id": "phono-live-001-broken", "title": "PHONO-LIVE-001 / BROKEN" },
  "meter": "4/4",
  "landmarks": ["entry", "body", "exit"],
  "requiredCapabilities": ["melody.live", "pulse.live"],
  "stems": [
    { "id": "melody-fallback", "kind": "fallback", "coversCapability": "melody.live", "path": "stems/melody.wav", "output": "foh" }
  ],
  "cues": { "click": null, "voice": null }
}
```

- [ ] **Step 4: Add exact room configurations**

`fixtures/phono-live-001/configurations/pl2.json`:

```json
{
  "id": "pl2",
  "label": "PL/2",
  "performers": [
    { "id": "human-a", "label": "Human A", "capabilities": ["melody.live"] },
    { "id": "human-b", "label": "Human B", "capabilities": ["pulse.live"] }
  ]
}
```

`fixtures/phono-live-001/configurations/pl1.json`:

```json
{
  "id": "pl1",
  "label": "PL/1",
  "performers": [
    { "id": "human-a", "label": "Human A", "capabilities": ["melody.live"] }
  ]
}
```

`fixtures/phono-live-001/configurations/pl0.json`:

```json
{
  "id": "pl0",
  "label": "PL/0",
  "performers": []
}
```

`fixtures/phono-live-001/configurations/broken.json`:

```json
{
  "id": "broken",
  "label": "PL/BROKEN",
  "performers": []
}
```

- [ ] **Step 5: Write the real-fixture integration test**

Create `test/phono-live-001.test.js` following the existing fixture-loading convention:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hpHashCanonical } from '../src/canonical-json.js';
import { intakePhonographPerformance } from '../src/phonograph-intake.js';
import { compileStageProjection } from '../src/compiler.js';

const loadJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const performance = loadJson('fixtures/phono-live-001/resolved-performance.json');
const receipt = loadJson('fixtures/phono-live-001/phonograph-receipt.json');
const liveIntent = loadJson('fixtures/phono-live-001/live-intent.json');
const brokenIntent = loadJson('fixtures/phono-live-001/live-intent-broken.json');

const configs = Object.fromEntries(['pl2', 'pl1', 'pl0', 'broken'].map((id) => [
  id,
  loadJson(`fixtures/phono-live-001/configurations/${id}.json`),
]));

test('checked-in Phonograph fixture verifies against its real upstream receipt', () => {
  assert.equal(hpHashCanonical(performance), receipt.resolvedPerformanceHash);
  assert.doesNotThrow(() => intakePhonographPerformance({ performance, phonographReceipt: receipt, liveIntent }));
});

test('one musical descendant truthfully compiles as PL/2, PL/1, and PL/0', () => {
  const { packet } = intakePhonographPerformance({ performance, phonographReceipt: receipt, liveIntent });
  const pl2 = compileStageProjection(packet, configs.pl2);
  const pl1 = compileStageProjection(packet, configs.pl1);
  const pl0 = compileStageProjection(packet, configs.pl0);

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

test('PL/BROKEN crosses successfully but fails closed only at room compilation', () => {
  const { packet } = intakePhonographPerformance({ performance, phonographReceipt: receipt, liveIntent: brokenIntent });
  const projection = compileStageProjection(packet, configs.broken);
  assert.equal(projection.playable, false);
  assert.deepEqual(projection.unresolvedCapabilities, ['pulse.live']);
});

test('tampering the real performance is refused before entering Static Live', () => {
  const tampered = structuredClone(performance);
  tampered.events[0].note += 1;
  assert.throws(
    () => intakePhonographPerformance({ performance: tampered, phonographReceipt: receipt, liveIntent }),
    (error) => error.code === 'PHONOGRAPH_PERFORMANCE_HASH_MISMATCH',
  );
});
```

- [ ] **Step 6: Run integration tests and verify GREEN**

Run:

```bash
node --test test/phono-live-001.test.js
npm test
```

Expected: all PASS.

- [ ] **Step 7: Commit Task 3**

```bash
git add fixtures/phono-live-001 test/phono-live-001.test.js
git commit -m "test: prove PHONO-LIVE-001 room incarnations"
```

---

### Task 4: Deterministic PHONO-LIVE specimen renderer and checked-in witnesses

**Files:**
- Create: `scripts/render-phono-live-001.js`
- Create: `test/phono-live-render.test.js`
- Modify: `package.json`
- Create/update generated witnesses under `examples/phono-live-001/`

**Interfaces:**
- Produces CLI-like script: `node scripts/render-phono-live-001.js [output-dir]`.
- Default output directory: `examples/phono-live-001`.
- Script reads only checked-in Static Live fixtures; no network or Haunted Phonography checkout.
- Writes `performance-packet.json`, `crossing-receipt.json`, and for each configuration `projection.json`, `setlist.md`, `routing.md`.

- [ ] **Step 1: Write failing renderer smoke test**

Create `test/phono-live-render.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('PHONO-LIVE renderer emits crossing + four room witnesses deterministically', () => {
  const outA = mkdtempSync(join(tmpdir(), 'phono-live-a-'));
  const outB = mkdtempSync(join(tmpdir(), 'phono-live-b-'));
  try {
    for (const outDir of [outA, outB]) {
      const run = spawnSync(process.execPath, ['scripts/render-phono-live-001.js', outDir], { cwd: process.cwd(), encoding: 'utf8' });
      assert.equal(run.status, 0, run.stderr || run.stdout);
      assert.equal(existsSync(join(outDir, 'performance-packet.json')), true);
      assert.equal(existsSync(join(outDir, 'crossing-receipt.json')), true);
      for (const id of ['pl2', 'pl1', 'pl0', 'broken']) {
        assert.equal(existsSync(join(outDir, id, 'projection.json')), true);
        assert.equal(existsSync(join(outDir, id, 'setlist.md')), true);
        assert.equal(existsSync(join(outDir, id, 'routing.md')), true);
      }
    }
    assert.equal(
      readFileSync(join(outA, 'crossing-receipt.json'), 'utf8'),
      readFileSync(join(outB, 'crossing-receipt.json'), 'utf8'),
    );
    assert.equal(
      readFileSync(join(outA, 'pl1', 'projection.json'), 'utf8'),
      readFileSync(join(outB, 'pl1', 'projection.json'), 'utf8'),
    );
  } finally {
    rmSync(outA, { recursive: true, force: true });
    rmSync(outB, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run renderer test and verify RED**

Run:

```bash
node --test test/phono-live-render.test.js
```

Expected: FAIL because the renderer does not exist.

- [ ] **Step 3: Implement the deterministic renderer**

Create `scripts/render-phono-live-001.js` using only built-in APIs plus existing project functions:

```js
#!/usr/bin/env node
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { intakePhonographPerformance } from '../src/phonograph-intake.js';
import { compileStageProjection } from '../src/compiler.js';
import { renderRouting, renderSetlist } from '../src/render-stage-aids.js';

const loadJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);

const outputRoot = resolve(process.argv[2] ?? 'examples/phono-live-001');
const fixtureRoot = 'fixtures/phono-live-001';
const performance = loadJson(`${fixtureRoot}/resolved-performance.json`);
const phonographReceipt = loadJson(`${fixtureRoot}/phonograph-receipt.json`);
const normalIntent = loadJson(`${fixtureRoot}/live-intent.json`);
const brokenIntent = loadJson(`${fixtureRoot}/live-intent-broken.json`);
const crossing = intakePhonographPerformance({ performance, phonographReceipt, liveIntent: normalIntent });

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(outputRoot, { recursive: true });
writeJson(resolve(outputRoot, 'performance-packet.json'), crossing.packet);
writeJson(resolve(outputRoot, 'crossing-receipt.json'), crossing.crossingReceipt);

for (const id of ['pl2', 'pl1', 'pl0', 'broken']) {
  const configuration = loadJson(`${fixtureRoot}/configurations/${id}.json`);
  const { packet } = id === 'broken'
    ? intakePhonographPerformance({ performance, phonographReceipt, liveIntent: brokenIntent })
    : crossing;
  const projection = compileStageProjection(packet, configuration);
  const outDir = resolve(outputRoot, id);
  mkdirSync(outDir, { recursive: true });
  writeJson(resolve(outDir, 'projection.json'), projection);
  writeFileSync(resolve(outDir, 'setlist.md'), renderSetlist(projection));
  writeFileSync(resolve(outDir, 'routing.md'), renderRouting(projection));
}
```

Do not add any audio renderer or Phonograph runtime dependency.

- [ ] **Step 4: Add package script**

Modify only the `scripts` block in `package.json`:

```json
{
  "scripts": {
    "test": "node --test",
    "stage": "node src/cli.js",
    "phono-live:001": "node scripts/render-phono-live-001.js"
  }
}
```

- [ ] **Step 5: Run renderer tests and full suite**

Run:

```bash
node --test test/phono-live-render.test.js
npm test
```

Expected: PASS.

- [ ] **Step 6: Regenerate and inspect the checked-in examples**

Run:

```bash
npm run phono-live:001
```

Verify mechanically:

```bash
node -e "const p=require('./examples/phono-live-001/pl2/projection.json'); if(!p.playable||p.liveContributions.length!==2) process.exit(1)"
node -e "const p=require('./examples/phono-live-001/pl1/projection.json'); if(!p.playable||p.fallbackCoverage.map(x=>x.capability).join(',')!=='pulse.live') process.exit(1)"
node -e "const p=require('./examples/phono-live-001/pl0/projection.json'); if(!p.playable||p.liveContributions.length!==0||p.fallbackCoverage.length!==2) process.exit(1)"
node -e "const p=require('./examples/phono-live-001/broken/projection.json'); if(p.playable||p.unresolvedCapabilities.join(',')!=='pulse.live') process.exit(1)"
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit Task 4**

```bash
git add scripts/render-phono-live-001.js test/phono-live-render.test.js package.json examples/phono-live-001
git commit -m "feat: render PHONO-LIVE-001 crossing witnesses"
```

---

### Task 5: Document the crossing and run completion verification

**Files:**
- Modify: `README.md`

**Interfaces:**
- Documentation must preserve the authority split: Phonograph owns musical descendant/provenance; Live Intent owns stage declaration; Static Live owns room projection.
- Documentation must not imply that PL/0 is equivalent to a human live performance.

- [ ] **Step 1: Add a concise PHONO-LIVE-001 README section**

Add after the LIVE-001 section:

```markdown
## PHONO-LIVE-001 — THE SONG WALKS INTO THE ROOM

Static Live can now accept one exact Haunted Phonograph `ResolvedPerformance` plus its completed receipt, verify the upstream ancestry, combine it with explicit human-authored `LiveIntent`, and emit a normal Static Live Performance Packet.

The boundary is deliberate:

- **Haunted Phonography says what music emerged.**
- **Live Intent says how we choose to embody it.**
- **Static Live says what the humans actually in the room can truthfully perform.**

No MIDI note, channel, or inferred instrument silently becomes a human stage role.

Run the checked-in specimen:

```bash
npm run phono-live:001
```

The specimen proves the same musical descendant as PL/2, PL/1, PL/0, and PL/BROKEN. PL/BROKEN crosses successfully as a valid packet and then fails closed at stage compilation because one required capability has neither a live provider nor a declared fallback.

Checked-in witnesses live under `examples/phono-live-001/`.
```

Also add design/plan links:

```markdown
Design: `docs/superpowers/specs/2026-09-14-phono-live-001-song-walks-into-room-design.md`

Plan: `docs/superpowers/plans/2026-09-14-phono-live-001-song-walks-into-room.md`
```

- [ ] **Step 2: Run the complete verification surface**

Run:

```bash
npm test
npm run phono-live:001
npm test
```

Expected: every command exits 0.

- [ ] **Step 3: Verify no forbidden coupling landed**

Run:

```bash
grep -R "the-haunted-phonography" -n src scripts package.json || true
grep -R "guitar.live\|drums.live\|bass.live\|lead-vocal.live" -n src/phonograph-intake.js || true
```

Expected:

- no runtime import/package dependency on Haunted Phonography;
- no hard-coded conventional instrument capability inference in the Phonograph adapter.

Then inspect the final diff:

```bash
git diff main...HEAD -- src compiler.js package.json README.md test fixtures examples scripts docs/superpowers/specs docs/superpowers/plans
```

Confirm `src/compiler.js` is unchanged by PHONO-LIVE-specific logic.

- [ ] **Step 4: Commit Task 5**

```bash
git add README.md
git commit -m "docs: explain PHONO-LIVE-001 room crossing"
```

- [ ] **Step 5: Final completion check**

Run:

```bash
git status --short
npm test
```

Expected: clean working tree and all tests PASS.

The implementation is complete only when this statement is supported by the checked-in fixtures and tests:

> One exact Haunted Phonograph `ResolvedPerformance` and its matching receipt can be combined with explicit Live Intent to produce a deterministic, receipted Static Live Performance Packet; that packet lawfully compiles under PL/2, PL/1, PL/0, and PL/BROKEN without inventing musical ancestry or human participation.
