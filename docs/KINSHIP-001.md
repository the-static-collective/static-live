# KINSHIP-001 — Kinship Radio community-producer pilot

**Status:** executable volunteer-side pilot; no Kinship Radio adoption is claimed.  
**Home:** `static-live` because this slice produces a bounded radio-facing handoff while preserving the existing rule that Static Live does not own station meaning, source authority, or community truth.

> **A useful volunteer packet may approach the microphone. It may not become the microphone.**

## Why Kinship is a real fit

Public Kinship Radio material checked on 2026-09-29 already exposes the human surfaces this pilot needs:

- leadership describes the station's mission as helping listeners discover, know, and grow in relationship with Jesus through worship and the Word;
- 2026 leadership messages describe a programming change intended to build a stronger bridge with the communities Kinship serves and repeatedly describe Kinship as more than a radio station;
- the Morning Show publicly uses recurring doors such as **What Day Is It?**, **Question for You**, encouragement/affirmation, **Bible Quiz**, **Storytime**, and **Just One More Thing**;
- Kinship already owns a community-event calendar and public event-submission path;
- Kinship already owns a prayer-request system where listeners may indicate that they prayed, with explicit privacy rules;
- Kinship already owns a volunteer/ambassador process with application, background check, interview, training, and station mission alignment.

Public station references:

- https://kinshipradio.org/main/
- https://kinshipradio.org/main/the-directors-chair/
- https://kinshipradio.org/main/prayer-requests/
- https://kinshipradio.org/main/ambassador-and-volunteer-faqs/
- https://kinshipradio.org/main/morning-show-archive-wednesday-july-29th-2026/
- https://kinshipradio.org/main/find-kinship-radio-near-you-this-summer/

Those station-owned paths should remain station-owned. KINSHIP-001 does not replace them.

## First useful crossing

The first proof is intentionally smaller than the wider Live Media Organism target:

```text
PUBLIC / ATTRIBUTABLE SOURCE
        ↓
VOLUNTEER CANDIDATE
        ↓
CLAIM MODE
observed | derived | interpretation | metaphor
        ↓
SOURCE REFERENCES
        ↓
EXPLICIT HUMAN REVIEW
ready | hold | reject
        ↓
KINSHIP RADIO PACK
        ↓
HUMAN PRODUCER / HOST
```

`ready` means only that a human reviewed the candidate and it is eligible to be considered by a Kinship producer or host.

```text
ready != aired
ready != station approval
ready != publication
ready != theological authority
ready != Kinship adoption of Static Collective tooling
```

## Executable boundary

`src/kinship-001.js` compiles `static-live.kinship-pilot-input/v0.1` into `static-live.kinship-radio-pack/v0.1`.

Every candidate must carry:

1. a bounded kind;
2. its proposed copy;
3. an epistemic/claim mode;
4. at least one attributable source reference;
5. an explicit human reviewer;
6. a `ready`, `hold`, or `reject` disposition.

Scripture candidates must carry a `scripture-reference` source. The pilot permits a reference such as `bible:Romans.12.10` without bundling translation text; exact wording remains under Kinship's own editorial/licensing practice.

The output always carries these effect refusals:

```text
broadcast: false
publish: false
obsControl: false
prayerRequestIngest: false
listenerIdentityInference: false
stationAdoptionClaimed: false
```

Run the checked-in specimen:

```bash
node src/kinship-001.js compile \
  --input fixtures/kinship-001/2026-09-29-pilot.json \
  --out /tmp/kinship-radio-pack.json
```

Run the repository test suite:

```bash
npm test
```

## Pilot lanes

### 1. What Day Is It? source desk

ALEX / National Treasure / Daily Slice can research a strange calendar item or historical compression. The pack carries sources and claim mode; Kinship staff retain the joke, wording, pacing, theological framing, and decision to air it.

```text
interesting compression != source authority
```

### 2. Community Door

Kinship already publishes community events and sends staff/volunteers into fairs, concerts, parades, church events, and local gatherings. KINSHIP-001 can package one station-owned/public community lead without creating a competing calendar.

Later, if Kinship explicitly wants it, Jubilee Campfire / Full Measure could supply a separate deeper path:

```text
need
→ offer
→ pledge
→ act
→ different-human confirmation
→ receipt
→ optional Book of Acts story candidate
```

That path is **not** enabled by KINSHIP-001.

### 3. Scripture reference / WITNESS door

A pack may carry a Scripture locus or eventually a WITNESS community-reading candidate. Scripture text, translation, human recording, reader identity, and broadcast permission remain distinct.

No translation text is bundled in this specimen.

## Protected surfaces

### Prayer stays Kinship-owned

Kinship's public prayer page already handles sensitive listener material and publishes privacy rules. KINSHIP-001 explicitly refuses prayer-request ingest.

Do not scrape, mirror, summarize, rank, infer from, or move prayer requests into Collective tooling as part of this pilot.

A future integration would require a separately designed station-owned consent/privacy boundary.

### Volunteers stay Kinship-owned

Kinship's volunteer/ambassador process includes application, screening, interview, training, and mission alignment. The Collective should not create a parallel volunteer registry.

A pack may point listeners toward Kinship's existing volunteer door. It may not collect applicant information.

## Relationship to existing organs

KINSHIP-001 is an edge adapter, not a new constitution.

| Organ | Possible contribution | Authority it keeps |
|---|---|---|
| ALEX.2 | source-grounded research packet | evidence/provenance |
| 3rdi | what was visible/known at a declared cut | projection/viewpoint |
| Autodisco V20 | radio/podcast presentation ancestry | narrative proposal |
| WITNESS | addressable human Scripture reading | reading/recording provenance |
| Jubilee / Full Measure | attributable community participation | act/witness lifecycle |
| Book of Acts | reviewed occurrence story candidate | irreducible particular/receipt |
| Haunted Phonograph | musical/station-locus proposal | musical proposal/provenance |
| Static Live | eventual physical media consequence | broadcast/performance membrane |
| HOUSE | local human operator/review desk | local review/workbench |

No row inherits another row's authority merely because they compose.

## What would make this genuinely useful to Kinship

The first human test should require almost no technical adoption:

1. prepare one morning-show packet outside Kinship's systems;
2. include 3–5 compact candidates, each with sources and a claim mode;
3. give it to a Kinship producer/host as an ordinary document or printout;
4. ask only: **Was any part of this actually useful in preparing the show?**
5. record what they used, ignored, corrected, or disliked;
6. change the instrument from that evidence.

Do not begin by asking Kinship to install a platform.

## Promotion gates

```text
GATE 0  local deterministic pack compiles                  ← this PR
GATE 1  Kinship human reviews one actual pack
GATE 2  Kinship identifies one recurring useful lane
GATE 3  station-owned editorial/consent boundary defined
GATE 4  optional HOUSE producer surface
GATE 5  optional community-act / WITNESS / media crossings
GATE 6  only then consider any live/broadcast integration
```

## Working seal

> **HELP THE HUMAN PREPARE THE RADIO. DO NOT PRETEND TO BE THE RADIO.**

> **KINSHIP OWNS KINSHIP. THE COLLECTIVE MAY ARRIVE WITH A USEFUL BASKET.**
