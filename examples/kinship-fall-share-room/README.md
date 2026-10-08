# KINSHIP-002 — Fall Share Room

A zero-install, local-first producer room tailored to **Kinship Radio Fall Share 2026**.

Open `index.html` in a modern browser. No server, account, API key, model, package install, donation-platform credential, OBS connection, or Static Collective checkout is required.

## Why this surface

Kinship's public site currently presents **Fall Share 2026** as an active station campaign and describes the ministry as listener-supported. A September 21 Director's Chair message invites listeners to join the support team and give, while other 2026 station messages emphasize that Kinship is “more than a radio station” and a family spread across communities in southern Minnesota and northern Iowa.

Public evidence checked 2026-09-29:

- https://kinshipradio.org/main/
- https://kinshipradio.org/main/fall-share-2026-landing/
- https://kinshipradio.org/main/the-directors-chair/
- https://kinshipradio.org/main/events/
- https://kinshipradio.org/main/ambassador-and-volunteer-faqs/
- https://kinshipradio.org/main/prayer-requests/

The Room translates that existing station shape into a human operator surface. It does **not** replace Kinship's giving, prayer, volunteer, calendar, automation or broadcast systems.

## What is immediately usable

### Threshold

A local manual Fall Share pulse:

- goal;
- raised amount;
- current match;
- live producer note.

These values are typed by a person. They are not fetched from donor records and are not represented as independently verified accounting.

The Threshold also provides direct doors to Kinship's official giving, volunteer, prayer and community surfaces.

### Workshop — Magic Lego

Ten radio-native starting doors are included:

- Why Kinship?
- Faith Gift invitation
- Matching moment
- Listener story
- Community door
- Volunteer door
- Scripture address
- What Day Is It?
- Thank-you / return
- Just One More Thing

A producer can compose a segment from explicit blocks:

```text
SOURCE
STORY
SCRIPTURE
QUESTION
INVITATION
RETURN
```

The blocks generate structure, not truth. A human writes and reviews the actual copy.

### Source Shelf

The shelf contains Kinship-owned public links. A producer explicitly selects which source supports a card.

The Prayer door is intentionally marked **open only · never ingest** and cannot be attached as a source through the normal selector.

### Live Stack

Each local segment moves only through explicit human transitions:

```text
draft -> ready -> aired -> returned
   \-> hold <-/
```

`aired` requires a confirmation dialog. The Room never infers an air event from a draft, playlist or web state.

`returned` requires a human note describing what actually came back.

### Return Archive

Returned cards become a small local memory surface. The intended question is broader than “how much money?”:

> What became possible because people showed up?

A gift may be one answer. A volunteer, corrected story, new community relationship, future program lead or unresolved next step may be another.

### Export / print

- **Print producer rundown** creates an ordinary human-readable sheet from cards marked ready/aired/returned.
- **Export room JSON** preserves the current browser-local state.
- **Import room JSON** restores a compatible export.

## ROroomOM / Workbench ancestry

KINSHIP-002 deliberately takes mechanisms rather than authority.

From ROroomOM:

```text
a room can hold instruments without claiming to own them
available != authorized
prepared != executed
```

From Static Workbench / HOUSE:

```text
the browser is the desk
project-owned doors remain project-owned
present != ready != authorized
```

From Full Measure / Jubilee:

```text
participation can return as witnessed capacity
self-report != witness
human worth != points
```

From Static Live:

```text
prepared media != aired media
broadcast consequence requires a separate operator boundary
```

## Privacy boundary

The Room intentionally stores only what a staff member types into that browser.

Do not put private prayer requests, donor payment information, bank/card data, sensitive listener notes, background-check material or volunteer applications into this prototype.

Browser localStorage is convenient, not a secure database. Export only to a location the operator controls.

## Next adapter, only if Kinship asks

The first extension should not be “connect everything.”

The strongest next adapter would be one station-selected, read-only source surface — for example, a vetted public community-calendar feed — followed by a separate explicit human prepare/review step.

Any donor-platform, prayer, CRM, automation, broadcast, SMS or volunteer-system integration needs its own Kinship-owned permission and privacy design.

## Founding line

> **KINSHIP OWNS KINSHIP. THE ROOM HOLDS THE DAY OPEN LONG ENOUGH FOR PEOPLE TO MEET EACH OTHER.**


## KINSHIP-003 — Station Memory from Haunted Toaster

The Room now borrows the Haunted Toaster's receipt-backed memory law:

> **Memory may change what the system is inclined to try and what the witness is inclined to notice. Neither may change what actually happened.**

Radio translation:

```text
prepared card
!=
aired occurrence

past aired occurrence
!=
current truth

human verdict
!=
audience model

memory pressure
!=
programming authority

re-open
!=
replay
```

### Past Airs

A card enters Station Memory only after a human explicitly confirms that it aired. Drafts, ready cards, and held cards do not become history simply because they existed in the Room.

### Append-only human verdicts

For a witnessed Past Air, the operator may add:

- **KEEP** — worth carrying forward;
- **WEIRD** — preserve the strange encounter without deciding that it should repeat;
- **COMPOST** — let it feed history without pushing repetition.

The operator can separately mark that they would intentionally re-open the occurrence.

A later verdict appends. Earlier testimony remains in the exported Room state.

### Rebuildable memory projection

The Room derives transparent features only from witnessed air:

- door used;
- claim mode;
- Lego blocks present;
- explicit source identities.

It counts full and recent history and derives at most three bounded pressures:

- **underexplored** — a radio door used least or not at all;
- **explicit-return** — a witnessed ancestor a human explicitly marked worth carrying forward;
- **saturation** — a recently repeated door creates pressure toward a less-used alternative.

Each pressure exposes its evidence references in the UI.

There is no donor-response optimization, listener profiling, semantic inference, or hidden model.

### Re-open

**Re-open** creates a fresh draft with a new identity and an explicit ancestor reference. It preserves the previous copy as historical material but prefixes the new draft with:

```text
Prior wording is history, not current truth.
```

The producer must re-check time-sensitive facts and decide whether any part belongs in a new occurrence.

### Why this is Toaster-shaped

Haunted Toaster keeps distinct:

```text
render receipt
human verdict
memory projection
memory capsule / pressure
influence trace
accepted execution
```

KINSHIP-003 keeps the analogous radio objects distinct:

```text
aired occurrence
human verdict
station-memory projection
bounded memory pressure
visible evidence refs
fresh human programming decision
```

The point is not to make Kinship's radio haunted by software.

The point is to let **history accumulate without becoming authority**.


## KINSHIP-004 — Porch + Shift Handoff from reLATTE

The October 1 reLATTE work exposed two mechanisms that compose directly into the Kinship gift without requiring Kinship to run reLATTE itself.

### Porch / Creative Customs

Incoming production material now lands outside the Workshop.

```text
ARRIVE
  ↓
PORCH
  ↓
WELCOME | HOLD | REFUSE
  ↓
optional separate ADMIT TO WORKSHOP
```

The room preserves:

```text
PORCH != INTERIOR
WELCOME != ADMIT
RELEASE SIGNAL != LICENSE
DELIVERY != CONSENT
```

A WELCOME receipt has `semanticEffect: none`. It says only that a human is willing to consider the item. A separate human action creates a fresh radio draft.

The Porch is explicitly for non-sensitive production material. Prayer requests, donor/payment data, volunteer screening information, and private listener records do not belong there.

### Shift Handoff

The existing whole-room export remains available, but KINSHIP-004 adds a safer producer-to-producer crossing.

```text
working room A
  ↓
SHIFT HANDOFF
  ↓
RECEIVED by room B
  ↓
HOLD | REFUSE | ADMIT
```

Receiving a handoff does not replace the current room.

```text
DELIVERY != ADMISSION
RECEIVED != ADMITTED
SAME HANDOFF != SAME CONSEQUENCE
```

Only an explicit **ADMIT AS WORKING ROOM** action replaces the local working snapshot. HOLD and REFUSE leave the current room unchanged.

This is a Kinship-local adaptation of reLATTE's durable receiver / replaceable-road work; it does not claim reLATTE signatures, transport receipts, or mirror durability.

### Newest work deliberately not hard-wired yet

Three October 1 experiments are highly relevant but remain open upstream work:

- Autodisco **RELEASE GATE → BROADCAST GATE → PAIR LISTEN**;
- ROroomOM verified **audio Lego / Video Window** resolvers;
- Haunted Toaster **Future Rearview / Batch Console**.

They are treated as next doors rather than dependencies. The one-file gift remains zero-install.

## KINSHIP-005 — campaign track and media review

The same zero-install room now carries an ordered campaign track, future
revisions, and local audio/video/voice-letter review. These are standalone
browser implementations of the composition shapes, not upstream adapters or
claims that Kinship has adopted Collective infrastructure.

### A first complete round trip

1. Enter a show date and operator. Historical September 29 starter material is
   an example; verify current events and invitations before using it.
2. Prepare a Workshop card. In **Campaign track**, choose it, enter its planned
   time/sequence and intention, and add it. It remains **PROPHECY**.
3. Prepare the card and, only after it actually airs, use **Confirm aired** in
   Live Stack. The track can now display a **RECEIPT**. Record any concrete return.
4. Select confirmed airs, write what you learned and what you propose for the
   remaining day, and append a revision. Earlier revisions and plans remain.
   The room never changes the programming order or marks a card aired from a
   proposal. Add a new card/slot when the host chooses the revised direction.
5. Export the room or a shift handoff. Campaign slots, revision evidence,
   media metadata, reviews and response history travel with that snapshot;
   received handoffs still need explicit admission.

### Media Lego and two first responses

Create a non-sensitive production reference with a permission/license document
reference, then attach an authorized local audio/video file. The browser hashes
its bytes with SHA-256; subsequent attachments must match. Different bytes need
another reference. Playback uses a temporary local object URL with no autoplay.
The file itself is neither uploaded nor included in exports, and must be
reattached after reopening. SHA-256 identifies bytes; it does not prove authorship,
consent, validity of a release, or that somebody actually listened.

Two different listener roles may each seal one response. The normal interface
hides the response text until both are sealed. This is a shared-device courtesy
workflow, **not** isolated sessions or cryptographic secrecy. A response is a
human report, not proof of listening. Responses are readable in local storage and
exports; do not put private listener identities or sensitive material here.

An operator can append HOLD / REFUSE / ADMIT reviews. Admission requires exact
attached bytes, a permission/license reference and an explicit permitted-use
scope. The software records the human assertion; station staff must verify the
underlying permission. Only the latest ADMIT permits a Workshop draft, and a
subsequent HOLD/REFUSE prevents that draft becoming ready or being confirmed
as aired. Existing air history remains history. Neither admission nor pair
responses authorize publishing, broadcasting, distributing a voice letter, or
replacing the station's release process.

### Scope and validation

This pack composes campaign memory, a bounded release/broadcast preparation
shape, two first responses and local media playback. It does not connect to
Autodisco Pair Listen, RETURN ADDRESS, the Vault, Haunted Blender or Toaster
services. It makes no signed-carrier, independent-listener, vault-resolution or
filmmaker-acceptance claim. Those adapters remain future work.

Run `npm test` from the repository root. Focused campaign tests verify that
unwitnessed plans cannot support learning, revisions carry no programming
authority, different bytes cannot inherit first responses, media admission is
bounded, shift receipt has no effect, and the handoff embeds the current source.


## KINSHIP-007 — Living Gifts (operator-local specimen)

Supporters may freely offer words, photos, voice, or video **without a donation, CRM lookup, payment proof or real-name requirement**. The new Living Gifts shelf records bounded contributor-chosen attribution, permission evidence reference and separate *offered* uses (quotation, broadcast consideration, gallery consideration, archival consideration). **No use is offered by default.** A human operator must review one exact scope and relevant release before preparing a derivative broadcast card or displaying a local gallery preview. Even then, no Kinship adoption, publication, airtime, or independent release verification is claimed.

Each image/audio/video needs exact SHA-256 byte binding; media bytes are retained only in ephemeral local browser object URLs, and must be reattached after reload or import. Handoff and import put previous editorial admission behind a fresh review boundary; all unbroadcast gift-derived cards are held. Withdrawal blocks new use and redacts locally unbroadcast card copy; already published material requires separate human action. Room exports include *text and metadata* and must be handled as sensitive even though raw media bytes are absent. The gallery is **local operator preview only** and never a public submission/gallery endpoint.

Founding boundaries: `OFFER != CONSENT`; `DONATION != STORY`; `REVIEW != AIR`; `BROADCAST != GALLERY`; `WITHDRAWN != REUSABLE`. This experiment intentionally excludes child/third-party intake and secure remote storage, moderation, donor-data integration, and public distribution pending a Kinship-owned design and explicit station participation.
