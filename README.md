# Static Live

> The song survives the missing limb. The receipt does not pretend the limb was there.

Static Live is the physical-performance embodiment for Static Collective music. It compiles a declared **Performance Packet** plus the humans actually present into a deterministic stage projection that a conventional DAW, audio interface, monitors, and FOH can execute.

It is deliberately downstream from the Collective's other runtime boundaries:

- **Band Runtime** remembers attributable encounter, admission/refusal, replay, sovereign channels, and receipts.
- **Groove Rooms** provides an inhabitable collaborative room.
- **Static Live** turns declared song material and a real-night roster into a stage package.

Static Live is **not** a DAW, a low-latency audio engine, a performer-ranking system, or a replacement for Band Runtime.

## Governing law

**A backing stem may replace a missing musical function. It may not pretend the missing human participated.**

Fallback is therefore capability-based:

```text
drums.live absent
  -> drums-fallback enabled
  -> absence remains explicit
  -> no drummer identity is manufactured
```

Required capabilities fail closed. If a required musical function has neither a present live provider nor a declared fallback stem, the resulting projection reports `playable: false`.

## LIVE-001 — THE BAND CAN LOSE A LIMB

The first executable specimen proves one song under three configurations:

```text
SC/4 -> four live required capabilities, no fallback
SC/3 -> drums.live absent, drum fallback activates
SC/2 -> drums.live + bass.live absent, both fallbacks activate
```

The hostile proof removes each SC/4 performer one at a time and recompiles. Every removal remains playable because the fixture declares a fallback for every required capability. The fallback receipt names only the capability and stem—not an absent performer.

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

## MIDI-LIVE-001 / MICRON-LIVE-001 — THE BAND HAS HANDLES

A Performance Packet may declare a MIDI control surface as stage intent. The map becomes active only when the real-night configuration explicitly includes a performer providing the declared capability, such as `midi-controller.live`.

The first physical device profile is the **Alesis Micron** at `device-profiles/alesis-micron.json`. It records the documented hardware surface and routing facts separately from unverified wire-level behavior:

- 37-key velocity keybed and pitch wheel remain musical controls;
- M1/M2 sliders and X/Y/Z parameter knobs are available as assignable performance controls;
- MIDI transport is 5-pin DIN In/Out/Thru, not USB MIDI;
- the Micron can receive external MIDI clock;
- local control exposes `on`, `off`, and `off + send ptns` modes;
- exact outgoing messages for the assignable controls are **not promoted to truth until observed on this physical unit**.

The current routed-stage grammar is:

```text
X  -> haunt.intensity
Y  -> mutation.depth
Z  -> topology.spread
M1 -> band.machine.balance
M2 -> fracture.pressure

keys + pitch -> musical performance
```

Each of those five system bindings is currently marked `midi-learn-required`. This intentionally replaces the earlier placeholder note/CC numbers. Community reverse-engineering suggests parameter-dependent NRPN behavior for X/Y/Z and conventional controller behavior for M1/M2, but Static Live keeps those as hints until hardware observation produces a receipt.

Compile the specimen:

```bash
node src/cli.js compile \
  fixtures/midi-live-001/song.json \
  fixtures/midi-live-001/configurations/alesis-duo.json \
  --out build/midi-live-001
```

The resulting `midi-map.json` is a machine-readable handoff for ordinary stage software. `controls.md` is the human-readable control sheet. Both preserve the explicitly declared performer attribution from the stage projection.

## Quick start

Requires Node.js 22+ and no external packages.

```bash
npm test
```

Compile a stage package:

```bash
node src/cli.js compile \
  fixtures/live-001/song.json \
  fixtures/live-001/configurations/sc2.json \
  --out build/sc2
```

Output:

```text
build/sc2/
  projection.json
  setlist.md
  routing.md
  midi-map.json
  controls.md
```

Checked-in examples for SC/4, SC/3, and SC/2 live under `examples/live-001/`.

## Performance Packet

A packet declares song-level stage facts:

```json
{
  "version": "static-live.performance-packet/v0.1",
  "song": {
    "id": "rocket-step",
    "title": "ROCKET STEP",
    "sourceReceipt": "specimen:LIVE-001/rocket-step"
  },
  "tempo": { "bpm": 148, "meter": "4/4" },
  "requiredCapabilities": [
    "lead-vocal.live",
    "guitar.live",
    "drums.live",
    "bass.live"
  ],
  "stems": [
    { "id": "textures", "kind": "always", "path": "stems/textures.wav", "output": "foh" },
    { "id": "drums-fallback", "kind": "fallback", "coversCapability": "drums.live", "path": "stems/drums.wav", "output": "foh" }
  ]
}
```

A configuration declares who is actually present and what each person can provide:

```json
{
  "id": "sc2",
  "label": "SC/2",
  "performers": [
    { "id": "voice", "label": "Voice", "capabilities": ["lead-vocal.live"] },
    { "id": "guitar", "label": "Guitar", "capabilities": ["guitar.live"] }
  ]
}
```

The compiler intersects each performer's declared capabilities with the song's required capabilities. Presence alone does not create participation.

## Stage Projection

`projection.json` is the machine-readable receipt. It records:

- attributable live contributions;
- enabled always-on and fallback stems;
- disabled fallback stems whose function is supplied live;
- capability-scoped fallback coverage;
- unresolved required capabilities;
- the final `playable` verdict;
- song timing/cue metadata needed by the stage aids;
- declared MIDI control maps when the packet supplies them and a present performer provides their capability.

`setlist.md`, `routing.md`, and `controls.md` are derived stage aids from that projection. `midi-map.json` is the machine-readable MIDI control handoff.

## Boundary

Static Live compiles declared MIDI control maps, but intentionally does not implement live MIDI/OSC device I/O, audio playback, monitor mixing, network sync, arrangement generation, or cross-project authority semantics. The compiler emits deterministic instructions and receipts; ordinary stage software emits sound and executes device control.

Design: `docs/superpowers/specs/2026-09-13-live-001-band-can-lose-a-limb-design.md`

Plan: `docs/superpowers/plans/2026-09-13-live-001-band-can-lose-a-limb.md`
