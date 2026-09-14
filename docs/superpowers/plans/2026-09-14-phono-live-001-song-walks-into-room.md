# PHONO-LIVE-001 — THE SONG WALKS INTO THE ROOM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dependency-free Static Live intake that verifies one exact Haunted Phonograph `ResolvedPerformance` plus completed receipt, combines it with explicit human-authored `LiveIntent`, emits a deterministic Static Live Performance Packet plus crossing receipt, and proves PL/2, PL/1, PL/0, and PL/BROKEN room incarnations without inventing musical ancestry or human participation.

**Architecture:** Haunted Phonography remains unchanged and authoritative for musical ancestry. Static Live owns the receiving adapter, keeps Haunted Phonograph hash compatibility separate from Static Live-local hashing, validates stage intent without inferring stage facts from music, and hands the generated packet to the existing `compileStageProjection()` unchanged.

**Tech Stack:** Node.js 22+, ECMAScript modules, built-in `node:test`, `node:crypto`, and filesystem APIs; no runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-09-14-phono-live-001-song-walks-into-room-design.md`

## Global Constraints

- Change **Static Live only**. Haunted Phonography receives no code change.
- Keep `src/compiler.js` authoritative for night-specific playability and free of Phonograph-specific logic.
- Accept only `haunted-phonograph/resolved-performance/v1` and completed `haunted-phonograph/receipt/v1`.
- Verify `sourceHash`, `scoreHash`, and Haunted Phonograph `resolvedPerformanceHash` before packet generation.
- `song.sourceReceipt = "hp-receipt:" + hpHashCanonical(phonographReceipt)`; the packet never points at the new crossing receipt.
- `LiveIntent` alone owns song id/title, meter, landmarks, required stage capabilities, stems, and cues.
- Never infer instrumentation, performer identity/capability, meter, or fallback from notes, MIDI channels, timing, or other musical evidence.
- Duplicate required capabilities and duplicate stem ids are invalid.
- A fallback must cover exactly one declared required capability; at most one fallback may cover each capability.
- A required capability may have no fallback; that is valid intake and may later produce `playable: false`.
- Keep `hpHashCanonical()` and `liveHashCanonical()` as separately named semantic surfaces even if the algorithms are presently identical.
- Existing LIVE-001 tests remain green.
- No shared cross-project package, runtime repository fetch, audio rendering, stem generation, scheduling, rehearsal state, MIDI/OSC control, or room-recording return loop in this slice.

---

## File Map

- Create `src/canonical-json.js` — canonical JSON plus separately named upstream/local hash surfaces.
- Create `src/phonograph-intake.js` — upstream verification, Live Intent validation, packet/crossing receipt composition.
- Create `test/canonical-json.test.js`.
- Create `test/phonograph-intake.test.js`.
- Create `test/phono-live-001.test.js`.
- Create `test/phono-live-render.test.js`.
- Create `fixtures/phono-live-001/resolved-performance.json`.
- Create `fixtures/phono-live-001/phonograph-receipt.json`.
- Create `fixtures/phono-live-001/live-intent.json`.
- Create `fixtures/phono-live-001/live-intent-broken.json`.
- Create `fixtures/phono-live-001/configurations/{pl2,pl1,pl0,broken}.json`.
- Create `fixtures/phono-live-001/UPSTREAM.md`.
- Create `scripts/render-phono-live-001.js`.
- Modify `package.json` only to add `phono-live:001`.
- Create generated witnesses under `examples/phono-live-001/`.
- Modify `README.md` to explain the crossing and proof.

---

### Task 1: Canonical JSON and two hash surfaces

**Files:**
- Create: `src/canonical-json.js`
- Create: `test/canonical-json.test.js`

**Interfaces:**
- `canonicalStringify(value) -> string`
- `hpHashCanonical(value) -> "sha256:<hex>"`
- `liveHashCanonical(value) -> "sha256:<hex>"`

- [ ] **Step 1: Write failing tests**

Create `test/canonical-json.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { canonicalStringify, hpHashCanonical, liveHashCanonical } from '../src/canonical-json.js';

const sha256 = (text) => `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;

test('sorts object keys, preserves array order, and normalizes -0', () => {
  const value = { z: -0, a: [3, { y: true, x: 'room' }] };
  const expected = '{"a":[3,{"x":"room","y":true}],"z":0}';
  assert.equal(canonicalStringify(value), expected);
});

test('keeps hp and live hash surfaces separately named and deterministic', () => {
  const expected = sha256('{"a":1,"b":2}');
  assert.equal(hpHashCanonical({ b: 2, a: 1 }), expected);
  assert.equal(liveHashCanonical({ b: 2, a: 1 }), expected);
});

test('rejects non-finite, undefined, sparse, and cyclic values', () => {
  assert.throws(() => canonicalStringify({ bpm: Infinity }), /finite numbers/);
  assert.throws(() => canonicalStringify({ bad: undefined }), /JSON-safe/);
  assert.throws(() => canonicalStringify([1, , 3]), /sparse arrays/);
  const cyclic = {};
  cyclic.self = cyclic;
  assert.throws(() => canonicalStringify(cyclic), /cycles/);
});
```

- [ ] **Step 2: Verify RED**

```bash
node --test test/canonical-json.test.js
```

Expected: FAIL because `src/canonical-json.js` does not exist.

- [ ] **Step 3: Implement the canonicalizer**

Create `src/canonical-json.js`:

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
      const normalized = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!(index in value)) fail(`${path} must not contain sparse arrays`);
        normalized.push(normalize(value[index], `${path}[${index}]`, ancestors));
      }
      return normalized;
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

function hashCanonical(value) {
  return `sha256:${createHash('sha256').update(canonicalStringify(value), 'utf8').digest('hex')}`;
}

export function hpHashCanonical(value) {
  return hashCanonical(value);
}

export function liveHashCanonical(value) {
  return hashCanonical(value);
}
```

Do not import Haunted Phonography code at runtime.

- [ ] **Step 4: Verify GREEN and regressions**

```bash
node --test test/canonical-json.test.js
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

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
- Consumes Task 1 hash functions.
- Produces `validateLiveIntent(liveIntent) -> true` or throws `TypeError` with `.code = "INVALID_LIVE_INTENT"`.
- Produces `intakePhonographPerformance({ performance, phonographReceipt, liveIntent }) -> { packet, crossingReceipt }`.

- [ ] **Step 1: Write the failing happy-path test**

Use this synthetic floor in `test/phonograph-intake.test.js`:

```js
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

test('crosses verified music into stage intent without inventing participation', () => {
  const { packet, crossingReceipt } = intakePhonographPerformance({ performance, phonographReceipt: receipt, liveIntent });
  const upstreamReceiptHash = hpHashCanonical(receipt);
  assert.deepEqual(packet.song, {
    id: 'phono-live-001',
    title: 'PHONO-LIVE-001',
    sourceReceipt: `hp-receipt:${upstreamReceiptHash}`,
  });
  assert.deepEqual(packet.tempo, { bpm: 120, meter: '4/4' });
  assert.equal('performers' in packet, false);
  assert.equal(crossingReceipt.upstreamReceiptHash, upstreamReceiptHash);
  assert.equal(crossingReceipt.resolvedPerformanceHash, hpHashCanonical(performance));
  assert.equal(crossingReceipt.liveIntentHash, liveHashCanonical(liveIntent));
  assert.equal(crossingReceipt.performancePacketHash, liveHashCanonical(packet));
});
```

Also assert identical parsed inputs return deep-equal results.

- [ ] **Step 2: Write refusal and Live Intent tests**

Cover these exact codes:

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

For `INVALID_LIVE_INTENT`, test missing/blank song id, song title, meter; non-array landmarks/capabilities/stems; duplicate capability; duplicate stem id; fallback without `coversCapability`; fallback covering undeclared capability; duplicate fallback coverage; invalid stem kind/path/output; and missing cues object. Also prove that a required capability with no fallback is valid.

Example tamper assertion:

```js
const tampered = structuredClone(performance);
tampered.events[0].note += 1;
assert.throws(
  () => intakePhonographPerformance({ performance: tampered, phonographReceipt: receipt, liveIntent }),
  (error) => error.code === 'PHONOGRAPH_PERFORMANCE_HASH_MISMATCH',
);
```

- [ ] **Step 3: Verify RED**

```bash
node --test test/phonograph-intake.test.js
```

Expected: FAIL because the intake module does not exist.

- [ ] **Step 4: Implement validation and crossing**

Create `src/phonograph-intake.js` with constants:

```js
const PERFORMANCE_SCHEMA = 'haunted-phonograph/resolved-performance/v1';
const RECEIPT_SCHEMA = 'haunted-phonograph/receipt/v1';
const LIVE_INTENT_SCHEMA = 'static-live.live-intent/v0.1';
const PACKET_SCHEMA = 'static-live.performance-packet/v0.1';
const CROSSING_SCHEMA = 'static-live.phono-live-crossing-receipt/v0.1';
const ADAPTER = Object.freeze({ id: 'static-live.phonograph-intake', version: '0.1' });
```

Validation order must be:

```text
performance schema
receipt schema
receipt completed status
sourceHash equality
scoreHash equality
hpHashCanonical(performance) equality to receipt.resolvedPerformanceHash
positive finite performance.tempoBpm
LiveIntent validation
packet composition
crossing receipt composition
```

`validateLiveIntent()` must:

```text
require version == static-live.live-intent/v0.1
require non-empty song.id, song.title, meter
require arrays for landmarks, requiredCapabilities, stems
require unique non-empty requiredCapabilities
require unique stem ids
require stem.kind in {always,fallback}
require non-empty stem.path and stem.output
for fallback: require coversCapability in requiredCapabilities and unique coverage
require cues to be a plain object with click and voice keys; null is allowed
never require every capability to have a fallback
```

Compose the packet exactly from the ownership table:

```js
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
```

Compose the crossing receipt:

```js
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
```

Deep-freeze returned objects. Do not copy notes/channels/events into stage capability declarations.

- [ ] **Step 5: Verify GREEN and regressions**

```bash
node --test test/canonical-json.test.js test/phonograph-intake.test.js
npm test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/phonograph-intake.js test/phonograph-intake.test.js
git commit -m "feat: add verified Phonograph intake boundary"
```

---

### Task 3: Real upstream fixture and four room configurations

**Files:**
- Create all `fixtures/phono-live-001/*` files listed in the File Map.
- Create: `test/phono-live-001.test.js`

**Interfaces:**
- Pin upstream Haunted Phonography commit `3ea4c141ffa3abe18f06019c0b0f2dd62ba20dd7`.
- Runtime remains independent of that repository.

- [ ] **Step 1: Export the exact upstream performance and receipt**

From the Static Live worktree root:

```bash
STATIC_LIVE_ROOT="$PWD"
export STATIC_LIVE_ROOT
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

const root = process.env.STATIC_LIVE_ROOT;
const source = await identifySource(resolve('test/fixtures/specimen-001.wav'));
const declaration = JSON.parse(await readFile(resolve('test/fixtures/specimen-001.observations.json'), 'utf8'));
const observations = admitObservations({ source, declaration });
const score = buildScore({ source, observations });
const mutationResult = mutateScore({ score, seed: 'seed-001' });
const performance = resolvePerformance({ score, observations, mutationResult });
const midiBytes = encodeMidi(performance);
const receipt = buildReceipt({ source, observations, score, mutationResult, performance, midiBytes });
await writeFile(`${root}/fixtures/phono-live-001/resolved-performance.json`, `${canonicalStringify(performance)}\n`);
await writeFile(`${root}/fixtures/phono-live-001/phonograph-receipt.json`, `${canonicalStringify(receipt)}\n`);
NODE
cd "$STATIC_LIVE_ROOT"
rm -rf "$TMP_PHONO"
```

Do not hand-edit the two exported JSON files.

- [ ] **Step 2: Record upstream provenance**

Create `fixtures/phono-live-001/UPSTREAM.md`:

```markdown
# PHONO-LIVE-001 upstream fixture

- Repository: `the-static-collective/the-haunted-phonography`
- Commit: `3ea4c141ffa3abe18f06019c0b0f2dd62ba20dd7`
- Source fixture: `test/fixtures/specimen-001.wav`
- Observation fixture: `test/fixtures/specimen-001.observations.json`
- Mutation seed: `seed-001`
- Exported objects: exact canonical `ResolvedPerformance` and exact completed Phonograph receipt reconstructed from the pinned inputs.

These files are fixture evidence. Static Live does not fetch Haunted Phonography at runtime.
```

- [ ] **Step 3: Add Live Intent fixtures**

Create normal `live-intent.json` with `melody.live` and `pulse.live`, both with fallback stems. Create `live-intent-broken.json` with the same two required capabilities but **only** `melody-fallback`; `pulse.live` intentionally has no fallback. Both use meter `4/4`, landmarks `entry/body/exit`, and `{ "click": null, "voice": null }` cues.

Use this exact normal intent:

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

- [ ] **Step 4: Add room configurations**

`pl2.json`:

```json
{"id":"pl2","label":"PL/2","performers":[{"id":"human-a","label":"Human A","capabilities":["melody.live"]},{"id":"human-b","label":"Human B","capabilities":["pulse.live"]}]}
```

`pl1.json`:

```json
{"id":"pl1","label":"PL/1","performers":[{"id":"human-a","label":"Human A","capabilities":["melody.live"]}]}
```

`pl0.json`:

```json
{"id":"pl0","label":"PL/0","performers":[]}
```

`broken.json`:

```json
{"id":"broken","label":"PL/BROKEN","performers":[]}
```

- [ ] **Step 5: Write the integration test**

Create `test/phono-live-001.test.js`:

```js
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
```

- [ ] **Step 6: Verify and commit**

```bash
node --test test/phono-live-001.test.js
npm test
git add fixtures/phono-live-001 test/phono-live-001.test.js
git commit -m "test: prove PHONO-LIVE-001 room incarnations"
```

Expected: PASS.

---

### Task 4: Deterministic specimen renderer and checked-in witnesses

**Files:**
- Create: `scripts/render-phono-live-001.js`
- Create: `test/phono-live-render.test.js`
- Modify: `package.json`
- Create/update: `examples/phono-live-001/**`

**Interfaces:**
- `node scripts/render-phono-live-001.js [output-dir]`
- Default output: `examples/phono-live-001`.
- Reads only checked-in Static Live fixtures.

- [ ] **Step 1: Write failing renderer test**

Test two temporary output directories, require `performance-packet.json`, `crossing-receipt.json`, and `projection.json/setlist.md/routing.md` under `pl2`, `pl1`, `pl0`, `broken`; compare the two crossing receipts and PL/1 projections byte-for-byte.

Core assertion:

```js
const run = spawnSync(process.execPath, ['scripts/render-phono-live-001.js', outDir], {
  cwd: process.cwd(),
  encoding: 'utf8',
});
assert.equal(run.status, 0, run.stderr || run.stdout);
```

- [ ] **Step 2: Verify RED**

```bash
node --test test/phono-live-render.test.js
```

Expected: FAIL because the renderer does not exist.

- [ ] **Step 3: Implement renderer**

Create `scripts/render-phono-live-001.js`:

```js
#!/usr/bin/env node
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { intakePhonographPerformance } from '../src/phonograph-intake.js';
import { compileStageProjection } from '../src/compiler.js';
import { renderRouting, renderSetlist } from '../src/render-stage-aids.js';

const load = (path) => JSON.parse(readFileSync(path, 'utf8'));
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
const fixtureRoot = 'fixtures/phono-live-001';
const outputRoot = resolve(process.argv[2] ?? 'examples/phono-live-001');
const performance = load(`${fixtureRoot}/resolved-performance.json`);
const phonographReceipt = load(`${fixtureRoot}/phonograph-receipt.json`);
const normalIntent = load(`${fixtureRoot}/live-intent.json`);
const brokenIntent = load(`${fixtureRoot}/live-intent-broken.json`);
const normalCrossing = intakePhonographPerformance({ performance, phonographReceipt, liveIntent: normalIntent });

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(outputRoot, { recursive: true });
writeJson(resolve(outputRoot, 'performance-packet.json'), normalCrossing.packet);
writeJson(resolve(outputRoot, 'crossing-receipt.json'), normalCrossing.crossingReceipt);

for (const id of ['pl2', 'pl1', 'pl0', 'broken']) {
  const crossing = id === 'broken'
    ? intakePhonographPerformance({ performance, phonographReceipt, liveIntent: brokenIntent })
    : normalCrossing;
  const projection = compileStageProjection(crossing.packet, load(`${fixtureRoot}/configurations/${id}.json`));
  const outDir = resolve(outputRoot, id);
  mkdirSync(outDir, { recursive: true });
  writeJson(resolve(outDir, 'projection.json'), projection);
  writeFileSync(resolve(outDir, 'setlist.md'), renderSetlist(projection));
  writeFileSync(resolve(outDir, 'routing.md'), renderRouting(projection));
}
```

- [ ] **Step 4: Add package script**

Make `package.json` scripts exactly include:

```json
"phono-live:001": "node scripts/render-phono-live-001.js"
```

Preserve existing `test` and `stage` scripts.

- [ ] **Step 5: Verify, render, mechanically inspect, commit**

```bash
node --test test/phono-live-render.test.js
npm test
npm run phono-live:001
node -e "const p=require('./examples/phono-live-001/pl2/projection.json'); if(!p.playable||p.liveContributions.length!==2) process.exit(1)"
node -e "const p=require('./examples/phono-live-001/pl1/projection.json'); if(!p.playable||p.fallbackCoverage.map(x=>x.capability).join(',')!=='pulse.live') process.exit(1)"
node -e "const p=require('./examples/phono-live-001/pl0/projection.json'); if(!p.playable||p.liveContributions.length!==0||p.fallbackCoverage.length!==2) process.exit(1)"
node -e "const p=require('./examples/phono-live-001/broken/projection.json'); if(p.playable||p.unresolvedCapabilities.join(',')!=='pulse.live') process.exit(1)"
git add scripts/render-phono-live-001.js test/phono-live-render.test.js package.json examples/phono-live-001
git commit -m "feat: render PHONO-LIVE-001 crossing witnesses"
```

Expected: all commands exit 0.

---

### Task 5: README and completion verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add PHONO-LIVE-001 documentation**

Add this section after LIVE-001:

```markdown
## PHONO-LIVE-001 — THE SONG WALKS INTO THE ROOM

Static Live can accept one exact Haunted Phonograph `ResolvedPerformance` plus its completed receipt, verify the upstream ancestry, combine it with explicit human-authored `LiveIntent`, and emit a normal Static Live Performance Packet.

- **Haunted Phonography says what music emerged.**
- **Live Intent says how we choose to embody it.**
- **Static Live says what the humans actually in the room can truthfully perform.**

No MIDI note, channel, or inferred instrument silently becomes a human stage role.

Run the checked-in specimen:

```bash
npm run phono-live:001
```

The specimen proves PL/2, PL/1, PL/0, and PL/BROKEN. PL/BROKEN crosses successfully as a valid packet, then fails closed at stage compilation because one required capability has neither a live provider nor a declared fallback. PL/0 demonstrates executable fallback coverage, not equivalence to a human live performance.

Checked-in witnesses live under `examples/phono-live-001/`.

Design: `docs/superpowers/specs/2026-09-14-phono-live-001-song-walks-into-room-design.md`

Plan: `docs/superpowers/plans/2026-09-14-phono-live-001-song-walks-into-room.md`
```

- [ ] **Step 2: Run full verification twice around specimen regeneration**

```bash
npm test
npm run phono-live:001
npm test
```

Expected: PASS.

- [ ] **Step 3: Verify forbidden coupling did not land**

```bash
grep -R "the-haunted-phonography" -n src scripts package.json || true
grep -R "guitar.live\|drums.live\|bass.live\|lead-vocal.live" -n src/phonograph-intake.js || true
git diff main...HEAD -- src/canonical-json.js src/phonograph-intake.js src/compiler.js package.json README.md test fixtures examples scripts docs/superpowers/specs docs/superpowers/plans
```

Expected:

- no runtime import/package dependency on Haunted Phonography;
- no hard-coded conventional-instrument inference in the adapter;
- `src/compiler.js` unchanged by PHONO-LIVE-specific logic.

- [ ] **Step 4: Commit documentation**

```bash
git add README.md
git commit -m "docs: explain PHONO-LIVE-001 room crossing"
```

- [ ] **Step 5: Final clean-tree verification**

```bash
git status --short
npm test
```

Expected: clean working tree and all tests PASS.

PHONO-LIVE-001 is complete only when the checked-in evidence supports:

> One exact Haunted Phonograph `ResolvedPerformance` and its matching receipt can be combined with explicit Live Intent to produce a deterministic, receipted Static Live Performance Packet; that packet lawfully compiles under PL/2, PL/1, PL/0, and PL/BROKEN without inventing musical ancestry or human participation.
