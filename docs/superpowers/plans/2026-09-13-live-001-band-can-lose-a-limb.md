# LIVE-001 — THE BAND CAN LOSE A LIMB Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dependency-free Node.js compiler that turns one Performance Packet plus a real-night performer configuration into a deterministic, fail-closed stage package with attributable live participation and capability-scoped fallback stems.

**Architecture:** Keep the compiler pure and deterministic in `src/compiler.js`; keep filesystem/CLI concerns in `src/cli.js`; derive human-readable stage aids from the same projection rather than maintaining parallel truth. The initial fixture proves SC/4, SC/3, SC/2, hostile one-member removal, and an uncovered-capability refusal.

**Tech Stack:** Node.js 22+, ECMAScript modules, built-in `node:test`, built-in filesystem APIs; no runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-09-13-live-001-band-can-lose-a-limb-design.md`

## Global Constraints

- Fallback is capability-based, never identity-based.
- No production audio engine in LIVE-001.
- No external runtime dependencies.
- Required capability without live coverage or declared fallback must fail closed.
- Stage projection must be deterministic for identical inputs.
- Human participation remains attributable to performer ID and supplied capability.

---

### Task 1: Pure stage compiler

**Files:**
- Create: `package.json`
- Create: `src/compiler.js`
- Create: `test/compiler.test.js`

**Interfaces:**
- Produces: `compileStageProjection(packet, configuration)` returning a JSON-serializable stage projection.
- Projection fields: `version`, `song`, `configuration`, `playable`, `liveContributions`, `enabledStems`, `disabledFallbackStems`, `fallbackCoverage`, `unresolvedCapabilities`.

- [ ] **Step 1: Write failing compiler tests**

Cover these concrete behaviors with `node:test` and `assert`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { compileStageProjection } from '../src/compiler.js';

test('activates fallback only for an uncovered required capability', () => {
  const result = compileStageProjection(packet, sc3);
  assert.equal(result.playable, true);
  assert.deepEqual(result.fallbackCoverage.map(x => x.capability), ['drums.live']);
});

test('fails closed when a required capability has neither live nor fallback coverage', () => {
  const result = compileStageProjection(packetWithoutVocalFallback, noVocalist);
  assert.equal(result.playable, false);
  assert.deepEqual(result.unresolvedCapabilities, ['lead-vocal.live']);
});

test('fallback receipts never manufacture performer participation', () => {
  const result = compileStageProjection(packet, sc2);
  assert.ok(result.liveContributions.every(x => x.performerId));
  assert.ok(result.fallbackCoverage.every(x => !('performerId' in x)));
});
```

Also test deterministic equality for identical inputs and disabled fallback when a live performer supplies the capability.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test test/compiler.test.js`

Expected: failure because `src/compiler.js` / `compileStageProjection` does not exist yet.

- [ ] **Step 3: Implement the minimal pure compiler**

Rules:

```text
for each present performer:
  intersect performer capabilities with packet.requiredCapabilities
  preserve attributable matches in liveContributions

for each stem:
  kind=always   -> enabled
  kind=fallback -> enabled only when coversCapability has no live provider

for each required capability:
  live provider OR enabled fallback => covered
  otherwise => unresolved

playable = unresolvedCapabilities.length === 0
```

Sort capability-derived arrays according to `packet.requiredCapabilities`, and preserve declared stem order, so output is deterministic.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm test`

Expected: all compiler tests pass with zero failures.

- [ ] **Step 5: Commit**

```bash
git add package.json src/compiler.js test/compiler.test.js
git commit -m "feat: compile attributable stage projections"
```

---

### Task 2: LIVE-001 fixture and hostile limb-removal proof

**Files:**
- Create: `fixtures/live-001/song.json`
- Create: `fixtures/live-001/configurations/sc4.json`
- Create: `fixtures/live-001/configurations/sc3.json`
- Create: `fixtures/live-001/configurations/sc2.json`
- Create: `test/live-001.test.js`

**Interfaces:**
- Consumes: `compileStageProjection(packet, configuration)` from Task 1.
- Produces: repository-owned witness that one song survives SC/4, SC/3, SC/2 and every one-member removal from SC/4.

- [ ] **Step 1: Write the fixture test before fixture data**

The test must load the four JSON files, compile each declared configuration, and assert:

```js
assert.equal(sc4.playable, true);
assert.equal(sc3.playable, true);
assert.equal(sc2.playable, true);
```

Then derive four hostile configurations by removing each SC/4 performer in turn. Every hostile projection must remain playable. For each removed performer's uniquely supplied required capabilities, corresponding fallback coverage must appear.

- [ ] **Step 2: Run and verify RED**

Run: `node --test test/live-001.test.js`

Expected: failure because fixture files do not exist.

- [ ] **Step 3: Add the minimal fixture**

Use one song with these required capabilities:

```json
[
  "lead-vocal.live",
  "guitar.live",
  "drums.live",
  "bass.live"
]
```

Declare one fallback stem for every required capability plus one always-on texture stem. SC/4 supplies all four capabilities live across four attributable performers. SC/3 omits the drummer. SC/2 keeps two performers and requires multiple fallbacks.

- [ ] **Step 4: Run and verify GREEN**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add fixtures/live-001 test/live-001.test.js
git commit -m "test: prove LIVE-001 limb removal"
```

---

### Task 3: CLI and deterministic stage package

**Files:**
- Create: `src/render-stage-aids.js`
- Create: `src/cli.js`
- Create: `test/cli.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `compileStageProjection`.
- Produces command: `node src/cli.js compile <packet.json> <configuration.json> --out <directory>`.
- Produces files: `projection.json`, `setlist.md`, `routing.md`.

- [ ] **Step 1: Write failing CLI integration test**

Use `node:child_process` to execute the CLI against the LIVE-001 SC/3 fixture in a temporary directory. Assert all three files exist, `projection.json` is playable, and `routing.md` mentions the activated `drums.live` fallback.

- [ ] **Step 2: Run and verify RED**

Run: `node --test test/cli.test.js`

Expected: failure because CLI files do not exist.

- [ ] **Step 3: Implement minimal CLI and renderers**

`projection.json` must be pretty-printed stable JSON ending with a newline. `setlist.md` must show song title, BPM/meter, configuration, and live/fallback lanes. `routing.md` must list enabled stems and attributable live capabilities; fallback rows name capabilities and stem IDs but no absent performer identity.

Reject invalid invocation with non-zero exit status and a concise usage line.

- [ ] **Step 4: Run and verify GREEN**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add package.json src/render-stage-aids.js src/cli.js test/cli.test.js
git commit -m "feat: emit deterministic stage packages"
```

---

### Task 4: Repository entry point and example compiled proof

**Files:**
- Create: `README.md`
- Create: `.gitignore`
- Create: `examples/live-001/sc4/projection.json`
- Create: `examples/live-001/sc4/setlist.md`
- Create: `examples/live-001/sc4/routing.md`
- Create: `examples/live-001/sc3/projection.json`
- Create: `examples/live-001/sc3/setlist.md`
- Create: `examples/live-001/sc3/routing.md`
- Create: `examples/live-001/sc2/projection.json`
- Create: `examples/live-001/sc2/setlist.md`
- Create: `examples/live-001/sc2/routing.md`

**Interfaces:**
- Consumes: CLI from Task 3.
- Produces: human entry point plus checked-in LIVE-001 proof artifacts.

- [ ] **Step 1: Generate all three example packages with the CLI**

Run:

```bash
node src/cli.js compile fixtures/live-001/song.json fixtures/live-001/configurations/sc4.json --out examples/live-001/sc4
node src/cli.js compile fixtures/live-001/song.json fixtures/live-001/configurations/sc3.json --out examples/live-001/sc3
node src/cli.js compile fixtures/live-001/song.json fixtures/live-001/configurations/sc2.json --out examples/live-001/sc2
```

- [ ] **Step 2: Add README and ignore policy**

README must state the repository boundary, governing fallback law, quick-start commands, data shapes, and LIVE-001 stop condition. `.gitignore` must ignore `node_modules/`, `build/`, and temporary test output while keeping `examples/` tracked.

- [ ] **Step 3: Run full verification**

Run:

```bash
npm test
node src/cli.js compile fixtures/live-001/song.json fixtures/live-001/configurations/sc2.json --out build/sc2
```

Expected: tests pass; `build/sc2/projection.json` reports `playable: true` and multiple capability-based fallbacks.

- [ ] **Step 4: Commit**

```bash
git add README.md .gitignore examples/live-001
git commit -m "docs: land LIVE-001 executable witness"
```

---

## Self-review

- Spec coverage: compiler boundary, capability fallback, non-impersonation, fail-closed behavior, SC/4–SC/2, hostile removal, deterministic stage package, and DAW-not-engine boundary all have an implementing task.
- Placeholder scan: no TODO/TBD implementation placeholders are required for LIVE-001.
- Type consistency: all tasks use `compileStageProjection(packet, configuration)` and the same projection field names.
