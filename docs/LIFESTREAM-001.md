# LIFESTREAM-001 — local manual bridge (experimental)

This is a bounded executable crossing, **not** the fully autonomous live media organism.
It does not replace STREAM-001, start OBS, capture microphone input, transcribe audio,
read private HOUSE notes, publish a podcast, or broadcast an artifact. It works with
one already-recorded, explicitly selected local media file and one reviewed text draft.
The original file remains in place; the manifest preserves a digest of its entire bytes,
a declared recording-start UTC anchor, an observed-at UTC instant and a bounded media
offset. The offset is relative to the file's timeline, **not** an inferred wall-clock
instant. A timestamp is a declared witness, not independently verified camera metadata.

## The first actual roundtrip

Use Node 22+ and Python 3.11+ with both repos checked out locally. No third-party
packages, network access, model or OBS installation are required for this CLI specimen.

On a real machine, replace `recording.wav` and the example timestamps with your
real source and *known* clock values. Do not fabricate an offset-to-UTC alignment.

```bash
# In static-live; replace this with an already recorded, explicitly selected file.
node src/lifestream-001.js capture \
  --event session01:moment01 --source /path/to/recording.wav \
  --start-ms 2000 --end-ms 7000 \
  --recording-started-at 2026-09-20T15:00:00.000Z \
  --observed-at 2026-09-20T15:15:00.000Z \
  --out /path/to/private-work/moment.json

# In static-workbench; source is selected again, never guessed from the manifest.
python -m static_workbench.lifestream_001 inspect \
  --moment /path/to/private-work/moment.json \
  --source /path/to/recording.wav

# Edit a local UTF-8 file with the words YOU actually reviewed.
python -m static_workbench.lifestream_001 draft \
  --moment /path/to/private-work/moment.json \
  --source /path/to/recording.wav \
  --draft-file /path/to/private-work/reviewed-lyric.txt \
  --kind lyric --admitted-by human:operator --reviewed \
  --out /path/to/private-work/return.json

# Back in static-live: verify the return. This NEVER adds it to a set or broadcast.
node src/lifestream-001.js verify-return \
  --moment /path/to/private-work/moment.json \
  --return /path/to/private-work/return.json \
  --source /path/to/recording.wav
```

The receiving CLI returns `verified_return_not_performed`: an acknowledged,
verified *candidate* available for a separately authorized future performance.
The human attribution token is declared by the operator, **not authenticated**.
All outputs are exclusive-create, never overwrite existing files, and new output
files are created with mode 0600 on POSIX platforms. Keep them in a private directory
of your own; the manifest intentionally does not leak the source filesystem path.
A digest authenticates bytes relative to a trusted reference, but it does **not**
prove who recorded a file, that timestamps are true, or that an occurrence meant
what a draft says it meant. Media-type decoding and in/out offset vs recording
duration are not validated in this specimen.

## Independent coordinated clocks (optional)

Pass `--clock-witnesses /path/to/clocks.json` to the capture command. The file must
contain an array of 0..32 standalone witness objects, e.g.:

```json
[
  {
    "clockId": "house.clockwork.abstract-60",
    "reading": "17",
    "basis": "declared abstract tick; not a conversion from UTC or audio time",
    "observedAtUtc": "2026-09-20T15:15:00.000Z",
    "evidenceRef": "clockwork-001:local-observation-17"
  },
  {
    "clockId": "music.beat-phase",
    "reading": "bar=5;beat=3;phase=0.25",
    "basis": "operator-declared from local musical transport; not UTC",
    "observedAtUtc": "2026-09-20T15:15:00.000Z",
    "evidenceRef": "session01:tempo-map-v1"
  }
]
```

Readings are portable strings with explicit basis and provenance. This carrier
does not calculate 60/64 return periods, Hindu or Hebrew dates, sunrise, sidereal
time, tempo, beat phase, or any correspondence between these clocks. CLOCKWORK-001/002
is independently experimental in HOUSE; a clock observation may be attached **only**
when it has actually been calculated or declared and attributed. Do not treat a
coincidence between clock readings as proof of causation or semantic identity.
CLOCKWORK remains optional: all four commands work when no witness is supplied.

## Ownership and future growth

STATIC LIVE owns source and moment manifest; HOUSE owns human-review and the
non-effectful draft return. No generic browser-to-shell adapter has been enabled.
The manually passed JSON is *carrier*, not shared authority. LOADOUT may eventually
issue a version-pinned capability-scoped admission to render or stage an artifact
after a separate explicit review; this protocol grants none.

Prove local interruption/replay, source-scoped access, and typed project adapters
before connecting this to the existing HOUSE browser, Creator Desk SQLite shelf,
OBS, GOATnote, or any background process. Until then, do not describe it as an
automatic livestream-to-artifact pipeline.
