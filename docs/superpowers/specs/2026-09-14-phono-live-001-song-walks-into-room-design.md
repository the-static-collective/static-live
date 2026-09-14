# PHONO-LIVE-001 — THE SONG WALKS INTO THE ROOM

**Status:** approved design / cross-project boundary specimen

## Purpose

PHONO-LIVE-001 proves one bounded crossing from Haunted Phonography into Static Live without collapsing the authority of either system.

Haunted Phonography owns the resolved musical descendant and its provenance. Static Live owns the stage embodiment of declared song material with the humans actually present.

The crossing must establish this claim:

> Given one exact Haunted Phonograph `ResolvedPerformance` and its matching receipt, Static Live can combine that object with explicit human-authored Live Intent and compile several truthful stage incarnations without inventing musical ancestry or human participation.

This is the first executable seam in the larger loop:

```text
recording
  -> Haunted Phonography
  -> receipted musical descendant
  -> Static Live
  -> actual humans in a room
  -> performance
  -> new recording / witness residue
  -> possible future source
```

PHONO-LIVE-001 proves only the Phonograph -> Live crossing. It does not yet close the room-recording return loop.

## Why the crossing belongs in Static Live

Haunted Phonography's `ResolvedPerformance` already contains the musical execution facts it may lawfully own, including:

- source hash;
- score hash;
- tempo;
- PPQ;
- ordered performance events;
- mutation identity;
- retained uncertainty references;
- optional influence metadata.

It does **not** own facts such as:

- which live capabilities are required on a particular stage;
- which humans are expected or available;
- which fallback stems are acceptable;
- arrangement landmarks used by performers;
- stage cues;
- monitor/FOH routing intentions;
- meter when that was not established by the source evidence.

Those are performance declarations.

Therefore the receiving system owns the adapter. Haunted Phonography remains unchanged in PHONO-LIVE-001.

## Governing laws

1. **Resolved music is not a stage arrangement.**
2. **A musical event is not a performer capability.** MIDI note/channel information may not be promoted into `guitar.live`, `drums.live`, or any other human capability without an explicit Live Intent declaration.
3. **Phonograph ancestry is read-only at the crossing.** Static Live may reference the source/score/performance chain; it may not rewrite it.
4. **Live Intent may arrange embodiment; it may not rewrite musical provenance.**
5. **Absence of a performer is not absence of a musical function.** Static Live may cover a missing function with a declared fallback while preserving the absence.
6. **Fallback does not manufacture participation.** A stem may cover `pulse.live`; it may not create a fictional performer.
7. **The receiving system verifies what it consumes.** A `ResolvedPerformance` whose canonical hash does not match the supplied Phonograph receipt is refused.
8. **Uncertainty remains uncertainty.** The adapter must not fill missing stage facts by guessing from the music.
9. **No new shared package is introduced in this slice.** The crossing remains appliance-local until repeated use demonstrates a stable extraction boundary.
10. **Failure is explicit.** Unsupported schemas, mismatched hashes, malformed Live Intent, invalid tempo, or uncovered required capabilities must fail closed.

## Input A — Haunted Phonograph `ResolvedPerformance`

PHONO-LIVE-001 accepts the existing schema:

```text
haunted-phonograph/resolved-performance/v1
```

The adapter needs only a bounded subset of the object:

- `schema`;
- `sourceHash`;
- `scoreHash`;
- `tempoBpm`;
- `ppq`;
- `mutation`;
- `events`;
- `retainedUncertaintyRefs`;
- optional `hauntInfluence`.

The adapter does not reinterpret the events into instrumentation or live roles.

## Input B — Haunted Phonograph receipt

PHONO-LIVE-001 accepts the existing completed Phonograph receipt schema:

```text
haunted-phonograph/receipt/v1
```

The adapter verifies at minimum:

```text
receipt.status == completed
performance.sourceHash == receipt.sourceHash
performance.scoreHash == receipt.scoreHash
hashCanonical(performance) == receipt.resolvedPerformanceHash
```

The adapter also retains the receipt's source, score, mutation, MIDI, and uncertainty references as provenance for the crossing receipt.

Static Live must not recompute or reinterpret Haunted Phonograph's upstream source evidence.

## Input C — `LiveIntent`

`LiveIntent` is the new declaration introduced by this slice.

It contains only facts that belong to stage embodiment rather than the resolved musical object.

Proposed schema:

```json
{
  "version": "static-live.live-intent/v0.1",
  "song": {
    "id": "phono-live-001",
    "title": "PHONO-LIVE-001"
  },
  "meter": "4/4",
  "landmarks": ["entry", "body", "exit"],
  "requiredCapabilities": ["melody.live", "pulse.live"],
  "stems": [
    {
      "id": "melody-fallback",
      "kind": "fallback",
      "coversCapability": "melody.live",
      "path": "stems/melody.wav",
      "output": "foh"
    },
    {
      "id": "pulse-fallback",
      "kind": "fallback",
      "coversCapability": "pulse.live",
      "path": "stems/pulse.wav",
      "output": "foh"
    }
  ],
  "cues": {
    "click": null,
    "voice": null
  }
}
```

`LiveIntent` is explicit human/arrangement intent. Its fields are not claims that Haunted Phonography heard those roles in the source recording.

## Output — Static Live Performance Packet

The adapter emits the existing Static Live packet schema:

```text
static-live.performance-packet/v0.1
```

Field ownership is fixed as follows:

| Performance Packet field | Authority/source |
| --- | --- |
| `song.id` | `LiveIntent` |
| `song.title` | `LiveIntent` |
| `song.sourceReceipt` | PHONO-LIVE crossing receipt identity/reference |
| `tempo.bpm` | `ResolvedPerformance.tempoBpm` |
| `tempo.meter` | `LiveIntent.meter` |
| `landmarks` | `LiveIntent.landmarks` |
| `requiredCapabilities` | `LiveIntent.requiredCapabilities` |
| `stems` | `LiveIntent.stems` |
| `cues` | `LiveIntent.cues` |

The emitted packet must not contain invented performer identities.

## Crossing receipt

The adapter also emits a machine-readable crossing receipt, proposed schema:

```text
static-live.phono-live-crossing-receipt/v0.1
```

It records at minimum:

- accepted Phonograph schema;
- accepted Phonograph receipt schema;
- Phonograph `sourceHash`;
- Phonograph `scoreHash`;
- Phonograph `resolvedPerformanceHash`;
- mutation identity copied from the upstream receipt/performance;
- retained uncertainty references;
- hash of the exact `LiveIntent` consumed;
- hash of the exact Static Live Performance Packet emitted;
- adapter version;
- result status.

The receipt states only that this exact Phonograph descendant crossed into this exact declared stage packet. It does not claim that the resulting packet has been performed.

## Adapter responsibility

The adapter has four responsibilities:

1. validate supported schemas;
2. verify the Phonograph performance/receipt identity chain needed at the boundary;
3. validate `LiveIntent` as explicit stage declaration;
4. deterministically compose those inputs into a Static Live Performance Packet plus crossing receipt.

It does **not**:

- infer instrumentation from MIDI channels or pitches;
- infer required capabilities from musical events;
- infer meter from note grouping;
- generate stems;
- render audio;
- assign humans to roles;
- choose a night roster;
- decide whether a resulting stage projection is playable.

Playability remains the responsibility of the existing Static Live compiler after a Stage Configuration is supplied.

## PHONO-LIVE-001 fixture

The first specimen intentionally uses the existing small Haunted Phonograph executable specimen rather than a full Autodiscography song.

The fixture contains:

```text
fixtures/phono-live-001/
  resolved-performance.json
  phonograph-receipt.json
  live-intent.json
  configurations/
    pl2.json
    pl1.json
    pl0.json
    broken.json
```

The imported Phonograph fixture must be an exact checked-in copy of a verified completed specimen output, with its source identity and receipt preserved. It is fixture evidence, not a live runtime dependency on the Haunted Phonography repository.

## Stage configurations

### `PL/2`

Two humans are present:

```text
Human A -> melody.live
Human B -> pulse.live
```

Expected result:

- playable;
- both humans appear as attributable live contributions;
- both fallback stems remain disabled.

### `PL/1`

One human is present:

```text
Human A -> melody.live
```

Expected result:

- playable;
- Human A remains attributable;
- `pulse-fallback` activates;
- no pulse performer is invented.

### `PL/0`

No humans are present.

Expected result:

- playable only because both required capabilities have declared fallbacks;
- both fallback stems activate;
- live contribution list is empty.

This configuration demonstrates executable survival, not a claim that a no-human playback event is equivalent to a live band performance.

### `PL/BROKEN`

At least one required capability has neither a live provider nor a declared fallback.

Expected result:

- crossing itself may still succeed if the Performance Packet is valid;
- Static Live stage compilation returns `playable: false`;
- the unresolved capability is explicit.

This distinction matters: packet validity is not the same claim as night-specific playability.

## Failure cases at the crossing

The intake refuses before packet generation when any of these occur:

- unsupported `ResolvedPerformance` schema;
- unsupported or non-completed Phonograph receipt;
- `sourceHash` mismatch;
- `scoreHash` mismatch;
- canonical `ResolvedPerformance` hash mismatch;
- non-positive or non-finite tempo;
- malformed `LiveIntent`;
- duplicate required capabilities if the chosen validation policy rejects them;
- fallback stem missing `coversCapability`;
- fallback stem covers an undeclared capability;
- duplicate fallback ambiguity for the same capability if not explicitly supported;
- absent song id/title;
- absent meter declaration.

No failure path is repaired by guessing.

## Determinism

Given byte-equivalent parsed inputs under the declared canonicalization rule, the adapter must emit byte-equivalent canonical packet and crossing-receipt content, excluding ordinary filesystem formatting differences if files are pretty-printed for humans.

The emitted Performance Packet should remain compatible with the existing dependency-free `compileStageProjection()` path.

## Repository boundary

PHONO-LIVE-001 changes **Static Live only**.

Expected implementation footprint:

```text
src/
  phonograph-intake.js

test/
  phonograph-intake.test.js

fixtures/
  phono-live-001/
    resolved-performance.json
    phonograph-receipt.json
    live-intent.json
    configurations/
      pl2.json
      pl1.json
      pl0.json
      broken.json

examples/
  phono-live-001/
    crossing-receipt.json
    performance-packet.json
    pl2/
    pl1/
    pl0/
    broken/
```

The existing `compiler.js` remains authoritative for stage coverage/playability and should not acquire Phonograph-specific logic.

Haunted Phonography receives no code change for this specimen.

## Test surface

The implementation must prove at least:

1. valid Phonograph performance + receipt + Live Intent produces one deterministic Performance Packet;
2. the crossing receipt binds the exact performance and Live Intent to the emitted packet;
3. a tampered performance fails the hash check;
4. a mismatched source hash fails;
5. a mismatched score hash fails;
6. malformed Live Intent fails without inference;
7. the generated packet compiles successfully through existing Static Live logic;
8. `PL/2`, `PL/1`, and `PL/0` produce the expected live/fallback attribution;
9. `PL/BROKEN` produces `playable: false` at stage compilation rather than being silently repaired;
10. repeated identical intake produces identical canonical output.

Existing LIVE-001 tests must remain green.

## Non-goals

PHONO-LIVE-001 does not implement:

- automatic instrument recognition;
- automatic stage arrangement generation;
- stem synthesis or separation;
- human scheduling;
- rehearsal state;
- monitor or FOH DSP;
- MIDI/OSC device control;
- a new shared cross-project package;
- runtime repository-to-repository fetching;
- automatic canon promotion;
- audience continuation admission;
- room recording ingestion back into Haunted Phonography.

Those remain later frontiers.

## Stop condition

PHONO-LIVE-001 is complete when:

> One exact Haunted Phonograph `ResolvedPerformance` and its matching receipt can be combined with one explicit `LiveIntent` to produce a deterministic, receipted Static Live Performance Packet; that packet compiles under PL/2, PL/1, PL/0, and PL/BROKEN; live participation remains attributable; fallback remains capability-scoped; upstream musical ancestry remains intact; and no missing stage fact is invented from musical evidence.

## Follow-on frontier

If PHONO-LIVE-001 succeeds, the next meaningful specimen is not a larger adapter. It is an actual Autodiscography song:

```text
Autodiscography source
  -> Haunted Phonography mutation
  -> ResolvedPerformance
  -> Live Intent
  -> Static Live incarnation
  -> rehearsal / room performance
  -> exact recording / witness residue
```

Only after repeated crossings demonstrate stable shared structure should any PHONO-LIVE contract be extracted into a wider common package.
