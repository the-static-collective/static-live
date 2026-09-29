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
