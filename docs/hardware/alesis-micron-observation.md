# MICRON-LIVE-001 — Hardware Observation

The device profile deliberately separates **physical control identity** from **wire identity**. This procedure promotes a `midi-learn-required` control only after the actual Micron produces an observable MIDI message.

## Required chain

```text
Alesis Micron MIDI OUT
        -> MIDI interface IN
        -> MIDI monitor / DAW
```

For bidirectional routed-stage testing:

```text
Micron MIDI OUT -> interface IN -> DAW -> interface OUT -> Micron MIDI IN
```

Use the Micron's documented Local Control `off` mode for the routed sequencer test so key events are not doubled by local sound plus sequencer echo. Use `off + send ptns` only when the test specifically concerns complete pattern output.

## Observation order

Keep one control moving at a time and record the complete message family and value behavior.

1. `pitch` — control specimen; expected to behave as MIDI pitch bend.
2. `m1` — observe message type, channel, controller/parameter identity, min/max, and center/rest behavior if any.
3. `m2` — same fields.
4. `x` — observe the complete message sequence for one mapped program parameter.
5. `y` — same parameter where possible, to expose any Y-specific encoding delta.
6. `z` — same parameter where possible, to expose any Z-specific encoding delta.

Do **not** infer Y or Z from X. Do **not** collapse a multi-message NRPN sequence into a guessed CC.

## Receipt shape

Record each observation as data before changing the device profile:

```json
{
  "deviceProfile": "alesis-micron/v0.1",
  "physicalUnit": "human-local-unit",
  "control": "x",
  "program": "<program name>",
  "assignedParameter": "<parameter name>",
  "localControl": "off",
  "midiChannel": 1,
  "messages": [
    { "status": 176, "data1": 99, "data2": 0 },
    { "status": 176, "data1": 98, "data2": 0 }
  ],
  "valueRangeObserved": [0, 127],
  "status": "observed"
}
```

The example byte values above are placeholders demonstrating receipt shape only. Replace them entirely with captured evidence.

## Promotion rule

A wire mapping moves from `hardware-observation-required` to `observed` only when:

- the physical control was identified before capture;
- the entire outgoing message sequence was retained;
- the setup/program/local-control state was recorded;
- at least two movements produced consistent message identity;
- the receipt does not claim the message identifies the human performer.

After promotion, update the device profile and the MIDI-LIVE binding together. The human capability declaration remains the authority for participation.
