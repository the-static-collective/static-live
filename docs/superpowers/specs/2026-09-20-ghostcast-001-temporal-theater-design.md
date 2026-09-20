# GHOSTCAST-001 — The Ghost Seat and Temporal Theater

**Status:** Proposed architectural design for human review, not implemented software or canonical doctrine.  
**Date:** 2026-09-20  
**Owner:** `the-static-collective/static-live`  
**Tracking:** [static-live issue #20](https://github.com/the-static-collective/static-live/issues/20)  
**Starting point:** `main@92dbec38840e190e302d36cafd37cdef1a02dd79`

## 1. Human intent and success

A person at the Static Station should be able to host a podcast with a fictional AI "ghost robot cowboy" sitting in an otherwise empty seat. They should be able to watch or listen to something together, record the session with honest speaker identities, and leave a message attached to an exact moment for a later human or AI encounter. The system is a creative instrument, not merely a chat window, and should work with a small number of operator gestures.

Success eventually means a genuinely audible half-duplex cohost running on the user's Zorin Linux / TV workstation with OBS, a useful shared-attention commentary theater, and a delayed-message shelf. **None of those later runtime or device claims are established by this design document.**

Visual and performance references, *not source assets*: Space Ghost contributes deadpan retro-cosmic talk-show framing; Mystery Science Theater 3000 contributes two observers jointly watching a third thing; Interstellar contributes delayed recorded messages and asynchronous encounters. Create an original character, original speech, and original stage artwork; do not imitate a copyrighted character or clone a real actor's voice.

## 2. Grounding and architectural ownership

- [Static Live README](../../../README.md) defines truthful participation, capability fallbacks, and Static Live as physical performance/broadcast owner rather than a DAW or general audio engine.
- [STREAM-001 console spec](2026-09-18-stream-001-static-broadcast-console-design.md) and `src/broadcast-server.js` own the loopback operator door; preserve its recording-before-streaming, `recording_only`, and `END + PRESERVE` semantics.
- [LIFESTREAM-002](../../LIFESTREAM-002.md) owns opt-in private moment observation, and the human-reconciled finished-source media timeline. Monotonic time since recording confirmation is not a precise OBS file offset.
- [Live Media Organism candidate](../../MADDTARGET-LIVE-MEDIA-ORGANISM-001.md) investigates one occurrence expressed as podcast, livestream, archive, and other media. It is a target, not an implemented universal runtime.
- Workbench owns review and admission of creative descendants; Static Live never derives a project-wide right to execute or publish from a message or transcript.
- GitBook's [Ghost / Residual Presence — History Without Authority](https://app.gitbook.com/s/HILTtUulCBDqDzXXk6RQ/patterns/ghost-residual-presence-history-without-authority) offers a portable invariant, not a cross-project schema: remembered presence is not present participation.

Open related draft PRs #18 and #19 are not assumed to be on `main`. This design's first slice requires neither.

## 3. Approaches considered

**A — Make the OBS operator server a large all-in-one multimodal AI chat/media service.** Fewer initial screens but conflates broadcast control, mic privacy, model transport, source provenance, and message storage. Reject for the initial architecture.

**B — Put all cohost and time-travel behavior in Workbench.** Reuses its compositional UI but gives Workbench unintended source-side audio, recording, and participant authority. Reject as primary owner.

**C — Static Live owns a small opt-in seat/encounter contract; native adapters own actual media/model work; Workbench may later receive independently reviewed candidates.** Select this. It permits a testable, inert first slice and independently authorized subsequent audio, theater, and messaging slices. An optional console module may later sit beside the existing OBS controls without changing their defaults.

## 4. Concepts and trust boundaries

**Seat** is an explicitly declared role and interface, not a human identity, model identity, or proof of participation. The operator creates a seat with a stable **session-local** `seatId` and separate fictional `personaId`; a replaceable AI provider can occupy a `synthetic_live` seat for a bounded session. A persona, model/provider binding, voice engine, permitted observations, and optional stage avatar are separate declarations. Replacing a model or TTS engine does not create a new human or erase the fictional character, but each newly produced contribution records the actual declared provider/binding that produced it; earlier contributions retain their original binding. No universal personality service or inherited cross-project authority is implied. Seat absence and provider failure remain visible.

**Encounter** is a new attributable event that references the supplied input(s) encountered and the current session origin. An observed playback is not a fresh utterance by the original actor: an earlier human contribution viewed later is `human_recorded`, and an earlier generated cowboy contribution played today is `synthetic_replay`, both retaining the exact original event ref. Today's cowboy, even if sharing yesterday's fictional persona, contributes through a distinct current-session `synthetic_live` seat and an attributable provider binding. Audio from a fallback does not manufacture an absent human participant. A quote extracted from a recording is not a newly spoken line.

**Shared Theater** is an explicitly chosen, read-only source on a source-owned timeline. Text, audio segments, sampled frames, or a local application state may be independently admitted to a seat's observation list; neither a title nor an arbitrary model summary proves the model saw or heard that source. An observer may remain silent, joke, disagree, or note missing input. Commentary and observations have separate event identities.

**Message Shelf** preserves an authored message and a typed anchor: `event_exact` names an exact source event, `media_verified` names a specifically reconciled offset/range on finished source media with evidence, and `media_unresolved` retains a proposed marker or position with no verified alignment. The source ref is exact even when the media position is unresolved; these claims must never be conflated. A later operator reconciliation may produce a new anchor/reconciliation event citing the original unresolved message and finished-media witness without overwriting it. The message also records its time basis, intended recipient/scope, delivery state, and subsequent encounters. Recording, message, delivery, encounter, and later response are separate events. No unverified time conversion, automatic notification, or inferred consent.

**Workbench handoff** is a human-selected, source-scoped proposed artifact with source refs and nonclaims. Static Live may offer it for review but may not claim the candidate is executed, verified by another project, automatically admitted, published, or canonical.

## 5. Minimal data contract: design shape, not final API

Use explicit versioned local records. Illustrative envelope:

```json
{
  "version": "static-live.ghostcast-event/v0.1",
  "eventId": "unique-local-id",
  "sessionId": "unique-local-session-id",
  "kind": "encounter",
  "actor": {"seatId": "cowboy", "presence": "synthetic_live"},
  "sourceRefs": ["session-origin-event-id", "actual-supplied-input-event-id"],
  "clock": {
    "occurredAtUtc": null,
    "availableAtUtc": null,
    "encounteredAtUtc": "operator-observed-time",
    "respondedAtUtc": null,
    "mediaOffsetMs": null,
    "mediaOffsetBasis": "unverified"
  },
  "evidence": {"class": "operator_reported", "receiptRef": null},
  "nonclaims": ["not_human_participation", "not_verified_media_alignment"]
}
```

The envelope shows **fields and intended distinctions only**; string values above are illustrative, not production timestamps or real receipts. Only accept clock values with declared bases, preserve unknown `null` without inventing offsets, and validate unique IDs, exact references and admitted enum values. Never silently treat supplied wall-clock order as proof of playback ordering or sample-accurate synchronization. The physical media bytes remain under source-owner custody and are not copied into a general conversation ledger by default.

A `session_origin` is the one explicitly declared, parentless first event of a session; it is not an invented conversation utterance. All other admitted events belong to that origin. The first live utterance cites the session origin as its sole source ref; subsequent utterances and encounters cite the origin plus the actual prior input event(s) they consumed. A replay encounter additionally cites the original recorded contribution through a local or opaque, explicitly declared external-source carrier. Empty references for non-origin events, a second origin in one session, or a fabricated source parent fail validation. The `session_origin` is a session boundary, not independent proof a human was physically present.

An immutable original event may have many later encounters; a later encounter never overwrites the original. A local digest may detect accidental modifications but is not source authentication or a cross-project authority grant. A deliberate operator-verified media anchor may link to LIFESTREAM's already distinct finished-source manifest rather than forging a new offset from the marker journal.

### 5A. Slice 001 lineage: original, observation, and descendant are separate

The fixture-only contract begins with exactly one parentless `session_origin` and uses **session-local declared IDs**, not a universal source registry. A `seat_declared` record fixes the declared role; an `utterance` or `encounter` is a distinct event with a unique local ID and a declared actor seat. The first utterance names the origin as its source; each subsequent utterance/encounter names the origin **and exact prior actual input event IDs** it consumes. A recorded-source encounter additionally names the original recorded event via a resolvable local reference or an explicitly unverified external-source carrier; citing only the new session origin cannot make a recorded contribution appear as newly live. The original event is not edited or re-dated by a later replay, quotation, or response. When the source is only an imported recording, Slice 001 may carry an inert `external_source_declared` fixture with original owner, opaque source reference and `verification: unverified`; it must never claim the imported source's bytes, playback offset, human participation, or authenticity were checked. Live-source and replay-source kinds remain different even when their text is identical.

The reducer refuses a missing/duplicate/non-first `session_origin`, an origin with parent refs, a non-origin event without its origin ref, duplicate event IDs, future or absent local source IDs, unknown seats, self-reference, circular ancestry, mismatched source session/owner, a replay without the original recorded event ref, and a fabricated external-source verification flag. A reference to an external system is an **opaque claim** until that source owner provides a separately verifiable handoff; no GitBook pattern, digest or similar-looking ID authenticates it. The derived transcript is a projection: rebuilding it from the same admitted fixtures yields the same ordered records and source links without inventing a source.

### 5B. Presence is a declaration plus a witnessed contribution, not a persona

`human_present`, `human_recorded`, `synthetic_live`, and `synthetic_replay` are four disjoint **contribution/presentation presence** states, not interchangeable seat identities. A declared current-session human or synthetic seat can originate a new live contribution; replay presentation is a distinct encounter event referencing an original contribution, **not a new declaration that the original actor is present**. A recorded human has `human_recorded` presentation, and a playback of a prior synthetic contribution has `synthetic_replay` presentation. The same `personaId` across yesterday's and today's synthetic sessions does not merge seat IDs, original source refs, current participation, or provider identity. A cowboy persona or voice is descriptive styling of an explicitly synthetic seat, not a different person and not evidence that any provider ran. A human-present seat can be declared by an operator but is shown as **declared, not independently verified** in a synthetic fixture. A contributed utterance requires a valid event attributed to that seat; declaration alone does not prove speech. A recorded-human source stays recorded when encountered later; a newly generated synthetic comment on that source has its **own** synthetic actor, time and lineage. A later actor cannot switch an earlier seat's class to make past events appear live or human. Fail closed if a new contribution's actor/presence conflicts with its current-session seat declaration, or if a replay's presence contradicts the classified original source; never silently repair by reclassification. A replay event may identify its current observer seat separately from its recorded source actor, but cannot claim the original actor newly spoke.

### 5C. Permission changes are first-class events

For the first pure reducer, fixture input explicitly declares the seat and appends ordered `permission_granted` / `permission_revoked` records containing the **seat ID, capability name, bounded session scope, grant epoch and event ID**. Each asynchronous-like fixture operation records the grant epoch it was admitted under and a distinct operation ID; a later grant creates a new epoch rather than reviving pending work under a revoked epoch. Capabilities needed for Slice 001 are `contribute_text` and `encounter_source` only. Initial permissions are empty/deny; an utterance or encounter requires the corresponding prior grant for its seat and session. Revocation takes effect for later events in the admitted append order: earlier valid records remain historical, while a later attempt is rejected; re-entry requires a new explicit grant. Revoking a grant also transitions its in-flight fixture operations to `cancel_requested` and records `cancelled` when cancellation succeeds or `failed` when it fails; where cancellation is unavailable, any later completion is preserved as `late_result_blocked`, never an admitted utterance or output. These are **deterministic synthetic state transitions**, not a claim that Slice 001 cancels real model, microphone or audio operations. Slice 002 adapters must make best-effort cancellation, prevent late results reaching the audio/output bus, record the actual outcome, and ensure MUTE/END blocks new inputs immediately. Grant epochs make stale responses remain blocked even after a new grant. Duplicate grants, revocation without an active matching grant, grants for undeclared seats, stale references or cross-session carryover refuse rather than silently expand access. A fixture permission record is an **operator-supplied declaration**, not proof that a human consented to a mic, media capture, recording, delivery, or model input. Those operations remain behind the separate Slice 002–004 consent gates.

A reducer processes a complete supplied ordered sequence only. It cannot accept new events by reading a revoked seat's old transcript as if old permissions still applied; an independently authorized future encounter must be declared and granted anew. No permissions pass automatically to a substitute model, derivative clip, message recipient, or Workbench artifact. A provider change requires an explicit new binding declaration and a new, narrowly scoped admission decision before that provider receives inputs; the seat's persona and transcript lineage may persist, not its permissions.

### 5D. Clock fields preserve type, basis and uncertainty

An event may carry **occurrence, availability, encounter, and response timestamps independently**, each as a supplied valid UTC instant or `null`, with a declared `operator_reported` / `source_verified` / `unknown` basis and optional exact evidence reference. For Slice 001's manual fixtures, permit `operator_reported` or `unknown` only: `source_verified` is invalid without a separate source-owned verification adapter, which is out of scope. A `null` instant always has `unknown` basis; a non-null instant requires a non-unknown basis. The reducer never calls the wall clock or fills missing timestamps from an event's insertion order. Insertion order, UTC time, monotonic recorder time and verified media playback offset are four different coordinates; only insertion order is guaranteed by a Slice 001 fixture. A missing media anchor is `null` and must never become zero or a fabricated derived timestamp. Unrelated clock values may disagree without being normalized; contradictory **claims of a verified clock basis** are rejected, not repaired. The transcript displays unknowns visibly and does not sort historical source events into live-encounter order by timestamp.

### 5E. Typed source/message anchors (planned for Slice 004)

`event_exact`: requires a real resolvable source event ID; it asserts **event identity**, not a position in a media file. `media_verified`: requires a finished-media source reference, explicit operator-reconciled position/range on the finished playback timeline, time basis and separate evidence ref from the existing LIFESTREAM finalization boundary. `media_unresolved`: requires the exact source event or carrier ref plus a declared proposed marker/offset (which may be `null`); it has no verified media alignment. Reconciliation creates a new record linking the unresolved anchor to a verified one; original message and source refs are immutable. Unknown positions are never encoded as zero, and a local digest never upgrades `media_unresolved` to `media_verified`.

Slice 001 tests may use inert sample anchors to validate these distinctions only if required to verify the base event contract; no Message Shelf storage, media decoding, delivery, or operator reconciliation is required in Slice 001.

## 6. Human-facing interaction

The first full user journey is: **Open Ghostcast → admit mic/model provider → seat the fictional cohost → talk and optionally record → mute/interrupt/end → review the transcript and separate recorded sources.**

The theater extension adds a deliberate `Watch / Listen / Revisit` selection. The message extension adds `Leave a message`, with an explicit selected source moment and recipient/delivery policy. A large visible **ON AIR / RECORDING / COHOST CONNECTED / COHOST SILENT / OFFLINE** state replaces hidden activity. Show the two participants, a clear synthetic-person label, and the one shared thing they are watching. A blank or no-avatar seat is allowed. Screen reader labels, keyboard reachability, captions, readable time basis and no automatic microphone start are required.

No passive mic capture, video capture, background model requests, invisible replay rewrites, or auto-publishing. The human can end or mute an AI response immediately. Creative suggestions are optional, not required for every turn.

## 7. Execution slices and cut lines

### Slice 001 — Seat and encounter contract (first proposed implementation)

An isolated, dependency-free Node 22 module and tests in Static Live should accept **manually entered, synthetic fixture utterances**, declare one parentless `session_origin`, one current-session `human_present` and one `synthetic_live` seat, append only admitted origin/seat/permission/utterance/encounter/fixture-operation records under sections 5A–5D, and render a deterministic, inert readable transcript that labels each contribution's presence class, exact source lineage, active permission at admission, and independently unknown time bases. This slice does **not** capture sound, synthesize a voice, call an AI, control OBS, or claim a usable podcast. It proves the later audio adapters have an identity-and-time boundary to connect to. Provide a sample JSON fixture and a small CLI or pure function that consumes it.

Negative controls: reject absent/duplicate/out-of-position `session_origin`, missing origin refs on non-origin events, duplicate or out-of-order IDs, undeclared or reclassified seats, forged/dangling/circular source refs, a replay omitting its original event reference, fabricated external-source verification, an AI seat asserted as human, a recorded-human or synthetic-replay event relabeled as newly live, a revoked or ungranted capability, late results from revoked grant epochs (including after re-grant), cross-session permission reuse, a claimed source-verified timestamp without an adapter, invalid/unknown clock bases, inferred media offsets, and an output with a missing source ref. Include a positive re-grant fixture and one later encounter that preserves a previously recorded source event unchanged. Session-local encounter order may differ from media playback time without being silently normalized. Avoid conflating `human_recorded` with `human_present`.

### Slice 002 — Opt-in local half-duplex voice bridge

Add an explicit provider adapter for speech recognition, cohost text generation, and TTS with bounded request/turn limits; bind each response to the producing provider/binding identity and the exact session grant epoch; support a no-provider/degraded state without suppressing the human recording. Separate captured human mic from synthesized audio and from the OBS program bus. Confirm mic permission and recording status; prevent the cohost's own output from being fed into input; make mute/interrupt/end immediately revoke the relevant session grants, request cancellation where supported, quarantine/deny late results at the audio output bus even if cancellation fails, and record cancellation/failure outcomes. Preserve actor provenance and consent in exported transcript and track manifest. Hardware/OBS validation on Zorin is a separate acceptance gate.

### Slice 003 — Shared-attention theater

Provide operator-selected local source or OBS scene and a read-only, explicitly sampled observation adapter. Track source identity, supplied frames/audio/text, visibility, observation instant and source-owned playback anchor if actually known. No guessed frame understanding from a filename; no unsolicited screen capture; no incompatible time-base conversion. A host and synthetic commentator may respond to the same admitted observation while retaining separate clocks and identities.

### Slice 004 — Temporal message shelf and reviewed creative return

Store explicitly authored context-bound messages with `event_exact`, `media_verified`, or `media_unresolved` anchors (section 5E), actual source refs and audience scope; represent `created`, `available`, `encountered`, `replied` separately and allow undelivered/unanswered messages. Require the receiver's encounter to produce a fresh event with a link to the immutable old source. Keep source-side and recipient-side receipts distinguishable. Later offer a human-reviewed Workbench export with nonclaims; do not graft a write API or publisher into Static Live merely for convenience.

Each slice gets a separate spec/plan/PR as needed. No monolithic Ghostcast runtime PR.

## 8. Failure handling and verification contract

When a model, microphone, speech engine, media file, OBS stream, or recipient is absent, present a truthful degraded state, retain any independently successful recording, and do not synthesize evidence of a missing participant or deliver a message that was not delivered. A failed model turn stays failed, not silently rewritten into a human statement. A pause or crash does not mutate earlier messages. Reopen from stored data only with explicit original-vs-reentry labels.

Before claiming Slice 001 implemented, a test-first run must show failures prior to implementation, green focused unit tests afterward, `npm test` on the exact PR head, plus a manual inspection of the generated transcript against negative fixtures. The test matrix must distinguish first utterance bound to `session_origin` vs invented parent, recorded source reference vs a current-session origin alone, yesterday's synthetic playback vs today's newly generated cowboy contribution, unknown external source vs verified source, declared seat vs attributed contribution, deny→grant→in-flight revoke→cancel/fail/late-block→regrant transitions (including stale completion after regrant), same persona with different declared provider bindings, identical deterministic fixture replay, unknown media anchor vs exact event and verified media anchor, missing/independent clocks, and legacy broadcast/performance regression. Before claiming the **audible podcast** exists, separately demonstrate mic + synthetic response + isolated audio tracks + mute/interrupt + stop and replay on actual Zorin/OBS hardware. An ordinary CI success cannot substitute for that device observation.

Do not merge a PR merely because it opened, and do not claim a drafted design is executable. This revision incorporates the four findings in the supplied source-level review; it does not constitute independent reviewer approval or a runtime verification claim. An implementation plan begins only after review of this design.

## 9. Unresolved / user-review questions

Which explicitly supported local or cloud voice provider is available on the workstation? Which local media/screen sources may be admitted? What is the intended private retention/deletion policy for real human voice and cross-time messages? How should consent be represented for later human collaborators? Those choices are intentionally **not inferred** from the excitement of the initial concept; Slice 001 needs none of them.

**Working compression:** A ghost may sit in the next chair. A recording may join us from another time. Neither may impersonate a human who is absent, nor rewrite the hour in which the original event happened.
