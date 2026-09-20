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

**Seat** is an explicitly declared role and interface, not a human identity, model identity, or proof of participation. The operator creates a seat; a replaceable AI provider can occupy a `synthetic_live` seat for a bounded session. A persona, voice style, speech engine, and permitted observation set are separately declared. Seat absence and model failure are visible.

**Encounter** is a new attributable event that references the supplied input(s) encountered. A recorded person viewed later remains `human_recorded`; an AI comment generated while watching it is a new `synthetic_live` encounter. Audio from a fallback does not manufacture an absent human participant. A quote extracted from a recording is not a newly spoken line.

**Shared Theater** is an explicitly chosen, read-only source on a source-owned timeline. Text, audio segments, sampled frames, or a local application state may be independently admitted to a seat's observation list; neither a title nor an arbitrary model summary proves the model saw or heard that source. An observer may remain silent, joke, disagree, or note missing input. Commentary and observations have separate event identities.

**Message Shelf** preserves an authored message and an exact anchoring ref, its time basis, intended recipient/scope, delivery state, and subsequent encounters. Recording, message, delivery, encounter, and later response are separate events. No unverified time conversion, automatic notification, or inferred consent.

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
  "sourceRefs": ["source-event-id"],
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

An immutable original event may have many later encounters; a later encounter never overwrites the original. A local digest may detect accidental modifications but is not source authentication or a cross-project authority grant. A deliberate operator-verified media anchor may link to LIFESTREAM's already distinct finished-source manifest rather than forging a new offset from the marker journal.

## 6. Human-facing interaction

The first full user journey is: **Open Ghostcast → admit mic/model provider → seat the fictional cohost → talk and optionally record → mute/interrupt/end → review the transcript and separate recorded sources.**

The theater extension adds a deliberate `Watch / Listen / Revisit` selection. The message extension adds `Leave a message`, with an explicit selected source moment and recipient/delivery policy. A large visible **ON AIR / RECORDING / COHOST CONNECTED / COHOST SILENT / OFFLINE** state replaces hidden activity. Show the two participants, a clear synthetic-person label, and the one shared thing they are watching. A blank or no-avatar seat is allowed. Screen reader labels, keyboard reachability, captions, readable time basis and no automatic microphone start are required.

No passive mic capture, video capture, background model requests, invisible replay rewrites, or auto-publishing. The human can end or mute an AI response immediately. Creative suggestions are optional, not required for every turn.

## 7. Execution slices and cut lines

### Slice 001 — Seat and encounter contract (first proposed implementation)

An isolated, dependency-free Node 22 module and tests in Static Live should accept **manually entered, synthetic fixture utterances**, instantiate one `human_present` and one `synthetic_live` seat, append immutable typed conversation/encounter records, and render an inert readable transcript that labels provenance and unknown time bases. This slice does **not** capture sound, synthesize a voice, call an AI, control OBS, or claim a usable podcast. It proves the later audio adapters have an identity-and-time boundary to connect to. Provide a sample JSON fixture and a small CLI or pure function that consumes it.

Negative controls: reject duplicate IDs, undeclared seats, forged/dangling parent refs, an AI seat asserted as human, an old source event relabeled as a new live statement, unknown/contradictory time bases, and an output with missing source ref. Session-local encounter order may differ from media playback time without being silently normalized. Avoid conflating `human_recorded` with `human_present`.

### Slice 002 — Opt-in local half-duplex voice bridge

Add an explicit provider adapter for speech recognition, cohost text generation, and TTS with bounded request/turn limits; support a no-provider/degraded state without suppressing the human recording. Separate captured human mic from synthesized audio and from the OBS program bus. Confirm mic permission and recording status; prevent the cohost's own output from being fed into input; make mute/interrupt/end functional and observable. Preserve actor provenance and consent in exported transcript and track manifest. Hardware/OBS validation on Zorin is a separate acceptance gate.

### Slice 003 — Shared-attention theater

Provide operator-selected local source or OBS scene and a read-only, explicitly sampled observation adapter. Track source identity, supplied frames/audio/text, visibility, observation instant and source-owned playback anchor if actually known. No guessed frame understanding from a filename; no unsolicited screen capture; no incompatible time-base conversion. A host and synthetic commentator may respond to the same admitted observation while retaining separate clocks and identities.

### Slice 004 — Temporal message shelf and reviewed creative return

Store explicitly authored context-bound messages with source anchors and audience scope; represent `created`, `available`, `encountered`, `replied` separately and allow undelivered/unanswered messages. Require the receiver's encounter to produce a fresh event with a link to the immutable old source. Keep source-side and recipient-side receipts distinguishable. Later offer a human-reviewed Workbench export with nonclaims; do not graft a write API or publisher into Static Live merely for convenience.

Each slice gets a separate spec/plan/PR as needed. No monolithic Ghostcast runtime PR.

## 8. Failure handling and verification contract

When a model, microphone, speech engine, media file, OBS stream, or recipient is absent, present a truthful degraded state, retain any independently successful recording, and do not synthesize evidence of a missing participant or deliver a message that was not delivered. A failed model turn stays failed, not silently rewritten into a human statement. A pause or crash does not mutate earlier messages. Reopen from stored data only with explicit original-vs-reentry labels.

Before claiming Slice 001 implemented, a test-first run must show failures prior to implementation, green focused unit tests afterward, `npm test` on the exact PR head, plus a manual inspection of the generated transcript against negative fixtures. Before claiming the **audible podcast** exists, separately demonstrate mic + synthetic response + isolated audio tracks + mute/interrupt + stop and replay on actual Zorin/OBS hardware. An ordinary CI success cannot substitute for that device observation.

Do not merge a PR merely because it opened, and do not claim a drafted design is executable. An implementation plan begins only after review of this design.

## 9. Unresolved / user-review questions

Which explicitly supported local or cloud voice provider is available on the workstation? Which local media/screen sources may be admitted? What is the intended private retention/deletion policy for real human voice and cross-time messages? How should consent be represented for later human collaborators? Those choices are intentionally **not inferred** from the excitement of the initial concept; Slice 001 needs none of them.

**Working compression:** A ghost may sit in the next chair. A recording may join us from another time. Neither may impersonate a human who is absent, nor rewrite the hour in which the original event happened.
