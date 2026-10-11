# LIFESTREAM-002 — Marker → finished media → HOUSE moment inbox

**Status:** experimental local-first workflow. STATIC LIVE remains the operator for
OBS and recorded source. HOUSE owns its review shelf and makes no OBS request.

## 1. Enable private markers during a real recording

Create a private directory you control. Start the existing Static Broadcast service
with the same packet, plus an explicit private marker journal:

```bash
mkdir -p "$HOME/static-private/sessions/session01"
node src/broadcast-cli.js /path/to/your-broadcast-packet.json \
  --port 3008 \
  --moment-journal "$HOME/static-private/sessions/session01/marks.jsonl"
```

The marker journal is optional. Without `--moment-journal`, the existing console
functions as before and marking remains disabled. The configured journal path is
server-side and never accepted from a web request.

While recording, use **MARK MOMENT** in the STATIC LIVE browser. The button reports
the mark ID and approximate elapsed milliseconds since the server observed
recording confirmation. Each observation is durably appended to the private
JSONL file. It records a UTC observation, monotonic elapsed time and the event
and session identifiers. These are *observations*, not OBS sample-accurate offsets,
and neither the button nor HOUSE silently derives a timestamp-to-media mapping.

End with the existing **END + PRESERVE** control. Confirm that OBS really stopped,
identify its completed local recording, and explicitly determine the segment's
start and end offsets on the actual file's playback timeline. The finished OBS
file path and its precise timeline were not verified by the marker button.
Do not finalize a recording whose output state is uncertain.

## 2. Reconcile one selected mark with the original finished source

Copy the mark ID shown by the console (or recover it from your private JSONL log).
Then, from your STATIC LIVE checkout, use your **actual observed** recording
start timestamp and **manually checked** source offsets:

```bash
node src/lifestream-002-finalize.js finalize \
  --journal "$HOME/static-private/sessions/session01/marks.jsonl" \
  --mark-id "REPLACE-WITH-MARK-UUID" \
  --source "/path/to/actual/finished-obs-recording.mkv" \
  --start-ms 12000 --end-ms 19000 \
  --recording-started-at "2026-09-20T15:00:00.000Z" \
  --recording-finished \
  --out "$HOME/static-private/sessions/session01/moment.json"
```

Do not copy the example time or offsets as if measured. If recording-start
time or the media alignment is unknown, preserve the marker as an observation,
and do not create a falsely precise moment yet. An explicit
`--recording-finished` is an operator declaration, **not** an independent OBS
state check. The finalizer does not attempt to decode the media or verify
that the declared segment fits within its duration.

The finalizer checks the chosen mark against its corresponding recording
confirmation in the journal, preserves it as an independently attributable
monotonic-clock witness, verifies the entire selected source file, and creates
an exclusive, private LIFESTREAM-001 moment manifest. The declared media
offset remains separate from the approximate elapsed marker reading.

Additional independently obtained clock witnesses can be attached with:

```bash
  --clock-witnesses "/path/to/read-only-clock-observations.json"
```

Provide an array of the existing `clockId/reading/basis/observedAtUtc/evidenceRef`
shape (up to 31 additional witnesses). CLOCKWORK is not required and this command
does not calculate sidereal, religious calendar or musical time. A common
observation timestamp does not establish that independent clocks agree.

## 3. Review in the HOUSE browser

Configure HOUSE with a local filesystem root that *explicitly includes* the
moment manifest and exact recorded source file; it does not scan your computer
for private recordings. Open `http://127.0.0.1:13700/lifestream` or choose
**Living Moment Inbox** from the HOUSE navigator.

Select the configured root, then enter both relative file paths. HOUSE verifies
the manifest and original file and stores the reviewed import as a local SQLite
entry. Pick a moment to see its declared offsets and independent clock witnesses.
Write or edit a lyric, journal, or invention draft, then confirm its human review.
A reviewed candidate is stored in HOUSE; it is not sent to OBS or published.

**Export** the candidate as JSON. STATIC LIVE independently checks the return:

```bash
node src/lifestream-001.js verify-return \
  --moment "/path/to/moment.json" \
  --return "/path/to/exported-private-return.json" \
  --source "/path/to/actual/finished-obs-recording.mkv"
```

A successful return is only `verified_return_not_performed`. Future performance,
publication and auto-generation require new, separately authorized adapters.

## Boundaries

- Marker journal: private source-side observations; may survive a restart.
- Moment manifest: a separate, manually reconciled, entire-file-verified carrier.
- HOUSE inbox: a locally stored registration. Listings are not proof that a
  previously imported source is still available; viewing and exporting reverify it.
- Clock witnesses: independent, attributed readings; no implicit conversion.
- Browser session: local single-user boundary with the existing HOUSE write token,
  not authentication for remote or multi-user deployment.
- No passive background capture, automated transcript, pipeline execution, automatic
  feedback into OBS, social posting, or inferred psychological/identity claim.

## ATTENTION-CROSSING-LIVE-001: human valuation of observed moments

When the optional private marker journal is enabled, Static Broadcast exposes
Joyful, Useful, Curiouser and None after the operator deliberately clicks
MARK MOMENT. The mark and value declaration are separate records. Simply
recording, streaming, observing or marking a moment implies no valuation.

Each value click appends a human-attributed (local operator) declaration to
the configured private marker JSONL, with the event, session, exact mark ID,
selected dimensions, UTC observation, previous declaration ID and a nonclaim
that this is not a verified media-file offset. None is explicit and distinct
from no declaration. Toggling preserves earlier declarations.

The browser's four buttons refer only to the most recently marked observation
in the current live session. Restarting the server does not silently resume
prior marks, although their previous JSONL receipts remain on disk. A future
separate reader can use that journal to reconcile history with finished source
files without asserting automatic audio/video alignment.

POST /api/moment/attention accepts bounded same-origin JSON only. A declared
value does not trigger OBS controls, run AI, publish anything, or constitute a
project-native recording receipt. Actual local browser and OBS rehearsal are
required before live-performance use.
