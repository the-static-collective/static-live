# KINSHIP-006 — Jubilee Treasury Neighbor Door

**Status:** review-only experimental cross-repository adapter; **no Kinship Radio adoption, live broadcast, outreach, or assistance is claimed**.

The existing [KINSHIP-002..005 Fall Share Room](../examples/kinship-fall-share-room/README.md) remains a local-first station-producer aid. It explicitly excludes prayer requests, donor/payment details, volunteer background checks, and private listener records. The [Jubilee Treasury portable-need protocol](https://github.com/the-static-collective/Jubilee-treasury/pull/2) remains independently owned and currently experimental.

## One new connection

```text
Jubilee Treasury owner-signed public-need history
              |
        verify the whole chain
              |
     KINSHIP-006 HELD PORCH
   (non-money resource summary only)
              |
 human checks current need + publication consent
              |
 existing KINSHIP-001 reviewable station pack
              |
 Kinship human editor / producer
              |
       possible future air decision
```

**One-way, read-only bridge.** No listener or donor database access. No fundraising redirects. No Treasury mutation. No OBS/broadcast control. No Kinship editorial authority. A need owner signing a need does not mean that Kinship endorses it or has consented to broadcast it.

### Why this should not become a station fundraising substitute

The local first lane is **material neighbor help**, such as firewood, food, mobility equipment, rides, tools, or available labor. The adapter **excludes money-only needs**. Kinship's existing [official giving path](https://kinshipradio.org/main/giving) remains separate and station-owned; third-party beneficiaries manage their own help destinations under their own consent and terms.

A radio producer could choose to mention a vetted public need, but must independently verify need authenticity, beneficiary authorization, current status, the safe method of responding, and any legal/editorial obligations. A public-key signature alone establishes none of those. No one must announce their personal emergency on air to receive help.

### The protocol wiring

Run from `static-live` with Node.js 22+:

```sh
npm test
node src/kinship-treasury-006.js porch signed-bundle.json proposed-porch.json
node src/kinship-treasury-006.js pack signed-bundle.json human-review.json edition.json reviewed-pack.json
```

The signed bundle format is the **entire versioned history array** exported by Jubilee Treasury 001. The import verifier checks the original Ed25519 owner signature, each predecessor's hash, stable owner key, no history gaps/forks, approved public shape, and whether the latest revision has been withdrawn. It creates only an unsigned local derived *porch proposal*, not a station-owned event.

`human-review.json` must be explicitly created by a human operator:

```json
{
  "disposition": "hold",
  "reviewedBy": "human:volunteer-producer",
  "reviewedAtUtc": "2026-10-08T19:00:00.000Z",
  "note": "Fixture-only review; do not air. Reverify current need, safety, locality and permission.",
  "freshnessChecked": true,
  "consentChecked": true
}
```

`edition.json`:

```json
{
  "id": "kinship-2026-10-08-example",
  "localDate": "2026-10-08",
  "intendedUse": "Human producer preparation only; Kinship has not adopted this tooling"
}
```

**Do not copy these fixture attestations into a real operator review**; those true values must describe checks the human actually performed. This is not an authenticated editorial identity system. A declared review cannot prove station employment, beneficiary consent or authenticity. If there is no reviewed, reachable, approved response route, use HOLD, not READY.

The output also has a `bridgeReceiptId`: a deterministic SHA-256 commitment over the existing Kinship radio-pack receipt, the exact Treasury source provenance, and all bridge routing refusals. It is an inspectable digest, **not** a signature or independent station witness.

`pack` reuses `compileKinshipPilot()` and retains its `ready != aired != station approval` semantics and explicit boundaries: broadcast, publishing, OBS control, prayer-request ingest, listener inference and station-adoption claims remain false. If a producer marks a candidate READY, it becomes eligible for further human consideration only.

The pack deliberately does not repeat a free-text need title, description, street address, contact or media/payment link. It uses validated controlled resource/unit tokens and a precise SHA-256 signed-snapshot reference. Coarse-region metadata and original free text remain unbroadcast. No amount of cryptography turns an owner-signed plea into independently verified need.

### Kinship Fall Share Room connection

This is intentionally not a silent ingest into `KINSHIP-FALL-SHARE-ROOM.html`. A human may carry the vetted resource lead through the room's existing Porch/customs and Workshop process. The room does not parse a Treasury bundle, decide a story is READY, change the station's funding totals, or send any content to air. A future import button requires Kinship-directed review, permission, and protected-storage design.

### Host-loss and staleness

The donor Treasury specimen simulates portable origin-host loss and signed mirror replay. KINSHIP-006 rejects a history gap and a recorded withdrawal. However, **a local snapshot cannot prove that no newer revision/withdrawal exists**. Just before any public mention, a producer must independently revalidate the current request and consent. No real-time propagation of takedowns is established.

### Cross-repo authorities

- Jubilee Treasury owns signed public need history and independent mirrors.
- Campfire / Full Measure owns native Offer → Pledge → Accept → Report → Human Witness → capacity/receipts.
- NanaSpork/Garden owns private Help Slip HOLD and explicit requirement-by-requirement POUR.
- BananaGram owns any proposed human invitation or material-offer doorway.
- Kinship Radio owns its giving, prayer, volunteers, programs, and editorial decisions.
- KINSHIP-006 is a **copy-constrained, read-only preparation adapter**.

```text
SIGNED != VERIFIED BENEFICIARY
NEED != ON-AIR INVITATION
PORCH != WORKSHOP
READY != AIRED
DONATION != DONOR RECORD
GIVING LINK != TREASURY DESTINATION
ROUTE != ACCEPTANCE
CONFIRMATION != BROADCAST STORY PERMISSION
```

## Next gates before operational use

Consent-aware and authenticated publication workflow; Kinship explicit participation; private contact channel; scoped service-area review; abuse reports and takedowns; rigorous provider/link security; live revocation/freshness checks; verified editorial authorization; two-party aid delivery acceptance; station-owned messaging and volunteer screening; and independent live field tests.

For now this is a **safe research seam**, not a public request intake service.
