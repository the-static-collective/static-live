# CHURCH COMMONS 003 — permission expires; withdrawal is a signed replacement

**Status: local-only, synthetic church data, experimental.** This is stacked on Commons 002 and is not a production church service, integration with Real Life Church, or a universal right to delete previously exported public material.

## The ownership problem

Earlier copies of an approved song can survive the origin. That helps public data availability, but it can leave withdrawn content available indefinitely if a mirror never learns the withdrawal. An ordinary signed snapshot has no expiration. **Commons 003 provides a new, explicit opt-in mode** in which every cooperating mirror *and* its gateway must confirm a short-lived, owner-signed publication lease before serving the public material.

This prototype uses a maximum lease of **5 minutes**. Real deployments would choose shorter/longer limits by operational policy and clock discipline. Under normal, honest-clock operation, an isolated mirror will stop serving once the lease expires. It might serve content withdrawn at the origin until that deadline, because it has not received the news; we do not claim instantaneous global withdrawal, deletion, or control over copies outside this protocol.

### New church journal event

An authenticated reviewer can append \`song.withdrawn\` with \`POST /api/:tenant/admin/withdraw\` and an internal \`{songId, reason}\`. Replay preserves history and marks the song \`WITHDRAWN\`. It no longer appears in the originating church's public song API, Static Live stage export, or new Commons public edition. The reason stays private.

### New signed publication bundle

\`\`\`text
church-owned source journal
    |
    +-- local ADMIT, contributor rights, pastoral review, publication
    +-- authenticated human withdrawal, when applicable
    |
    v
signed public-only snapshot (Commons 001)
    |
    +-- owner-signed lease:
        tenant, edition, snapshot digest, issuedAt, expiresAt,
        withdrawnSongIds (public interchurch releases only)
    |
    v
leased public mirror (NEW, opted in)
    |
    +-- checks BOTH Ed25519 signatures and owner-pinned key
    +-- checks tenant, digest, edition, short expiry and song IDs
    +-- persists most recent edition across restarts
    +-- rejects old editions and same-edition lease extension
    +-- stops serving after expiration even when offline
    |
    v
lease-verifying gateway (requireLease: true)
    |
    +-- verifies signed bundle itself; no trust in mere HTTP availability
    +-- remembers highest seen edition and refuses rollback
    +-- HOLDs when permission expired or no valid replica survives
\`\`\`

Legacy Commons 001 \`createCommonsMirror\` and default Commons 002 \`createCommonsGateway\` remain explicitly *non-leased historical experiments*. Only \`createLeasedMirror\` plus \`requireLease: true\` on the gateway have the withdrawal-expiry guarantee. The leased mirror has no legacy \`/public-snapshot\` endpoint. It exposes \`GET /public-bundle\` only while currently licensed.

### Local run

Node.js 22+ and no external runtime dependencies:

\`\`\`sh
cd labs/living-hymnal-001
node --test test/commons-lease.test.mjs
node --test test/*.test.mjs
\`\`\`

To start a leased mirror, set \`COMMONS_DATA_DIR\` to an **independent** directory, \`COMMONS_TRUSTED_KEY_FILE\` to an owner public-key PEM provisioned out-of-band, and optionally \`COMMONS_PORT\` (bound to 127.0.0.1). Then:

\`\`\`sh
node scripts/commons-node.mjs leased-mirror
\`\`\`

For the gateway, set \`COMMONS_MIRRORS_JSON\` to at least one operator-known loopback \`{"id":"mirror-a","url":"http://127.0.0.1:9301"}\` descriptor, \`COMMONS_DATA_DIR\` to an independent audit directory, and use:

\`\`\`sh
node scripts/commons-node.mjs leased-gateway
\`\`\`

**No real hosting path is exposed.** The signed publication is produced from an authorized synthetic journal using \`createLeasedEdition\`. A separate owner publication CLI, proper identity provider, key escrow/recovery, continuous renewal service, clock monitors, and transport authentication are not yet implemented.

## Important limitations

- Signed leases are only as reliable as mirror/gateway clocks. Clock rollback, hostile servers, copied text outside cooperating mirrors, and old historical unleased endpoints cannot be forced to obey. The original local journal persists for review and audit.
- Lease expiration is a *temporary licensing gate*, not cryptographic revocation or deletion. A withdrawn song can remain live on an offline honest mirror until its previously granted lease expires.
- A local TENANT reviewer token only operates this lab. It is not suitable for production authentication, key custody or public upload. A publisher must still guard signing keys and decide when to renew.
- A latest edition is not a universal event-ordering fact: an isolated gateway can serve older but unexpired signed publications until it hears an updated edition. New public copies are not automatically authorized by the snapshot signature alone.
- All HTTP listeners are localhost-only and remain unencrypted in this lab. WAN access, DNS, geographically distributed uptime, host trust onboarding and power/energy telemetry are separate field gates.
- No GHoT integration, verified GHoT task receipt, reLATTE signed crossing, PENNY minting, payment, charitable donation system, user accounts, or real church deployment is claimed.

**Law:** SIGNED PUBLICATION != PERPETUAL PERMISSION · WITHDRAWAL != ERASURE · OFFLINE != EXEMPT FROM EXPIRY · MIRROR != OWNER · SIGNATURE != HUMAN IDENTITY
