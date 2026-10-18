# Living Hymnal 001 — a church-portable song garden

**Status:** experimental local-only specimen. **Not an official Real Life Church project, a Tithely integration, or a publicly deployed intake.** It is located within Static Live as a bounded lab, not an expansion of Static Live's stage-compiler authority.

## What actually works

- A responsive congregation-facing text seed form, with authorization and **internal review only** permission.
- Append-only local event history for `seed.created`, `seed.decided`, and `song.published`.
- Church-scoped event files and individually configured reviewer credentials. Every seed starts **HOLD**.
- Private human ADMIT / REFUSE, separate pastoral approval and rights review for publication.
- A public hymnal route showing *only* explicitly published songs.
- Export a published song into a real `static-live.performance-packet/v0.1`, with click/cue paths and declared fallback stems. The existing Static Live compiler consumes this packet unchanged.
- Export a `relatte.opaque-organ-spec/v0` **candidate** for later sealing, transport and receiver-local disposition.
- A generic HTTPS external-link manifest for Tithely-style apps, other church apps, browser and QR entry.

## Try it locally

Requires Node.js 22+. From this lab:

```sh
npm test
# Read-only, no church connected:
npm run dev
# Open http://127.0.0.1:8787/c/sample-church
```

For **local test submissions and a reviewer console only**, generate a private random reviewer secret (at least 24 characters):

```sh
HYM_ALLOW_SUBMISSIONS=1 \
HYM_ADMIN_TOKENS_JSON='{"sample-church":"replace-with-a-long-random-private-token"}' \
npm run dev
```

Enter the token in **Worship Team** to admit/refuse submissions and manually publish an approved song.

A multi-church **local** configuration can be passed using `HYM_TENANTS_JSON`:

```json
{
  "sample-church": {"name": "Sample Church"},
  "second-church": {"name": "Second Church"}
}
```

Give each tenant its own `HYM_ADMIN_TOKENS_JSON` credential. All recorded data stays under `data/<tenant>.jsonl` (ignored by Git). The server listens on `127.0.0.1:8787` only. Intake is **off by default**. The browser does not cache reviewer tokens.

## The adapter law

```text
church app (Tithely / other / web / QR)
                │
        HTTPS external link
                │
      Living Hymnal church route
                │
        church-local review
                │
        human rights clearance
                │
     ┌──────────┴─────────────┐
 Static Live packet    reLATTE opaque organ spec
  metadata only        unsigned / untransmitted
     │                        │
 existing stage          future receiving church:
 compiler / FOH           independently ADMIT or REFUSE
```

**Tithely compatibility today:** Tithely documents a home-screen tile **Web Page** action that points to an external URL. See [App Home Screen Layout Editor](https://help.tithe.ly/hc/en-us/articles/10791810779287-App-Home-Screen-Layout-Editor). The host manifest encodes this ordinary action. This needs permission from an administrator of the *church's* app; we do not authenticate to Tithely, call a proprietary Tithely API, edit its content, claim official support, or inherit its user identities. Other hosts that permit web links can use exactly the same church URL.

**reLATTE compatibility today:** `toRelatteOpaqueSpec` matches the source project's `OpaqueOrganSpec` field names for generic opaque artifacts. It emits a **candidate specification**, not a signed or verified crossing. The hash refers to a stable public song projection, but the actual payload object store, key custody, signing, transport, receiver-side verification and disposition are deliberately *not* implemented here. reLATTE does not interpret music, approve theology, or authorize a song's reuse.

**Static Live compatibility today:** stage packet export includes existing versioned schema fields. WAV paths are **references supplied by a human**, not stem extraction, click generation, file hosting, audio routing, or proof that sound hardware is configured. The stage compiler honestly marks unprovided musical functions unresolved.

## Governance and guardrails

1. The song belongs to the church's local governance, not the hosting platform or reLATTE. An accepted **seed** is not a public work. Church A's approval is not Church B's approval.
2. No seeded text is public, searchable, or exported into reLATTE. Only a manually approved, rights-reviewed release can be projected outward.
3. The seed form collects no email or phone number, does not accept recordings/uploads, and asks contributors to omit private details. A parent/guardian must submit material from a child.
4. Seed permission is only for private review. **Publication is blocked** until reviewers independently affirm contributor permissions, relevant generation/stem rights, and pastoral approval. Affirmations are human records, **not automatic copyright clearance**.
5. No automatic Suno generation, no sermon/theology synthesis, no AI ownership claims, no church streaming credentials. Any Suno licensing, downstream sound-recording rights, livestream and chart-usage permissions still need case-specific review.
6. **Not production-safe:** no professional identity provider, contact handling, consent withdrawal interface, anti-abuse CAPTCHA, encryption at rest, backups, observability, audit-signatures, malware-scanned uploads, tenancy at scale, legal/privacy review, or operational recovery. In-memory IP rate limiting and local tokens are demonstration safeguards, not Internet-facing security. Do not expose this server on a public interface or connect real congregational data before replacing these seams.

## Next bounded crossings

- With actual worship-leadership permission: test the app's external Web Page tile against a church-owned, HTTPS **staging URL**.
- Implement production tenant identity and data custody first, including human consent withdrawal and permission records.
- Connect Suno *manual* approved stems/exports, cross-check plan license terms at creation/export, and compile one real-song Static Live fixture against their actual console/click workflow.
- Seal a reLATTE opaque crossing with project-owned primitives; carry **only expressly released artifacts**, and test two different churches giving different recipient-local decisions.
- Only after successful trials: consider embedded panels, shared setlists, livestream replay, and broader church-platform adapters.

## Boundaries

`HOST LINK != PLATFORM API` · `SEED != SONG` · `RECEIVE != ADMIT` · `PUBLICATION != AUTOMATIC LEGAL RIGHTS` · `STAGE PACKET != REAL AUDIO`

The first goal is one real song carried by real musicians—not a congregation absorbed into a software product.

## Extension 002: source-permission and portable released lyric bytes

The lab now requires a separate **contributor publication-permission record for each admitted seed** (scope and reference to an independently obtained release document). Submitting a seed only permits **private review**, not publication. A local release and an interchurch lyric-sharing release are distinct scopes. Publication also requires pastoral and general rights-review assertions. These are **human attestations**, not cryptographic proof of real-world consent.

Church-local release may create a stage packet; it **cannot** yield a cross-church reLATTE bundle. Interchurch sharing additionally requires every source contributor's explicit wider permission and separate sharing terms.

The private reviewer route `GET /api/<tenant>/admin/bundle/<song-id>` downloads a JSON object with:

- `schema: living-hymnal.relatte-export/v0.1`
- `payload_text`: exact UTF-8 JSON bytes of six published text/music metadata fields
- `spec`: an unsigned reLATTE opaque-organ specification pointing to the SHA-256 digest of those exact bytes.

No raw seed text, alias, permission record identifier, backing stem, audio, or private prayer request is exported. The source_history_head is **null** because this lab has not established a signed historical chain.

The separate [reLATTE Living Hymnal 002 draft](https://github.com/the-static-collective/reLATTE/pull/117) validates such bundles, signs an actual reLATTE crossing, sends it through a file-transport witness, and tests two independent local church decisions with restart replay. The adapter lives outside reLATTE core, so ordinary reLATTE transport and receivers remain unaware of worship semantics.

**Still not production-ready:** authorship/license assertions are not independently verified, contributors cannot yet withdraw permission through the UI, and there is no production identity, key custody, storage, delivery or data-deletion machinery. Do not expose real congregational intake or present this as the church's own app without church leadership approval.
