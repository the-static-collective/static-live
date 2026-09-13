# LIVE-001 — THE BAND CAN LOSE A LIMB

**Status:** approved design / initial repository boundary

## Purpose

Static Live is the physical-performance embodiment of Static Collective music. It compiles a song's declared musical functions, stems, cues, and the humans actually present into a deterministic stage projection suitable for a conventional DAW, audio interface, monitors, and FOH.

Static Live does not replace Band Runtime, Groove Rooms, Project0, or a DAW.

- **Band Runtime** remembers attributable encounter, admission/refusal, replay, sovereign channels, and receipts.
- **Groove Rooms** provides an inhabitable collaborative room.
- **Static Live** turns declared song material and a real-night roster into a stage package.

## Governing laws

1. **A backing stem may replace a missing musical function. It may not pretend the missing human participated.**
2. **No particular human is required for continuation. Every present human must remain attributable and able to matter.**
3. **Presence is not participation.** A performer only appears in the participation projection for capabilities they actually provide.
4. **Fallback is capability-based, not identity-based.** A stem covers `drums.live`; it does not impersonate a named drummer.
5. **Fail closed on uncovered required musical functions.** If no present performer and no declared fallback can provide a required capability, the projection is not playable.
6. **The compiler is not the audio engine.** v0 emits a deterministic show package; an ordinary DAW emits audio.
7. **The projection is derived.** Source song identity and receipts remain outside the compiled stage view.

## LIVE-001 specimen

One song is described by a **Performance Packet** containing:

- song identity and source receipt;
- tempo and meter;
- arrangement landmarks;
- required live capabilities;
- always-on stems;
- capability-scoped fallback stems;
- click and cue references.

A **Stage Configuration** contains the humans present and the capabilities each human can supply that night.

The compiler emits a **Stage Projection** containing:

- attributable live contributions;
- enabled always-on stems;
- enabled fallback stems and the capability each covers;
- disabled fallback stems whose capability is supplied live;
- unresolved required capabilities;
- a `playable` verdict;
- explicit fallback/absence receipts that never manufacture human participation.

## Initial configurations

The fixture proves the same song under three declared configurations:

- `SC/4` — four performers, minimal fallback;
- `SC/3` — one performer absent, fallback activates for the uncovered function;
- `SC/2` — two performers, additional fallbacks activate while surviving humans remain attributable.

A hostile removal test starts from the full four-person fixture, removes each performer one at a time, recompiles, and requires the song to remain playable through declared capability fallbacks.

## Repository boundary

v0 is a dependency-free Node.js compiler and CLI. It deliberately does not implement:

- low-latency audio playback;
- MIDI or OSC device control;
- monitor mixing;
- network synchronization;
- performer identity assignment or ranking;
- automatic musical arrangement generation;
- Band Runtime event semantics;
- Groove Rooms collaboration UX.

## Output package

A compile writes:

```text
build/<configuration>/
  projection.json
  setlist.md
  routing.md
```

`projection.json` is the machine-readable receipt. Markdown files are human-readable stage aids derived from that same projection.

## Stop condition

LIVE-001 is complete when:

> One song can compile under SC/4, SC/3, and SC/2; removing any one member of the full fixture still produces a playable projection; fallback activation is capability-based and explicit; no fallback stem manufactures human participation; and an uncovered capability without a declared fallback fails closed.
