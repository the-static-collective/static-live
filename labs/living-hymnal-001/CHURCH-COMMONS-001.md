# CHURCH COMMONS 001 — origin loss, signed public mirrors, local restore

**Status: executable loopback experiment; NOT a church deployment or a proof of distributed production hosting.** Branch is layered on the Living Hymnal 001 draft. Three **independent operating-system processes**, on one machine, stand in for one church origin and two public mirrors. No real church or member data is used.

## Run the proof

Requires Node.js 22+, no external packages or Internet connection.

    cd labs/living-hymnal-001
    node --test test/commons.test.mjs
    node scripts/commons-demo.mjs

The demo creates a synthetic original event journal (including one private HOLD, one interchurch-approved published song and one locally published but *not* interchurch-licensed song), then:

1. Creates an ephemeral Ed25519 owner signing key; pins its public key at both mirrors.
2. Boots the existing Living Hymnal owner HTTP app in one process and two standalone HTTP mirrors in separate processes/directories, all bound to localhost.
3. Has the owner produce a signed, public-only edition **from its existing event journal** using the existing rights/admission/release gates.
4. Posts that edition to each mirror, which independently verifies the signature, tenant, shape and SHA-256 content digest before storing its own copy.
5. Terminates the owner HTTP process; confirms each mirror continues serving a public song list and a read-only hymnal HTML page.
6. Terminates mirror B; starts a *new process* from its disk snapshot; terminates A; confirms B continues serving the same approved song.

The test suite also challenges tampering, unknown signing keys, replay of stale editions, conflicting snapshots with equal edition, HTML injection, tenant confusion, and unsafe startup from a saved snapshot signed by another key. These proofs do **not** demonstrate a multi-machine WAN network, service discovery, automated load balancing, or production-grade crash consistency.

## Boundaries: what moves and what stays

    Living Hymnal event journal (church private custody)
        -> replay admission and permissions
        -> select explicitly interchurch-approved PUBLISHED songs
        -> export only {id,title,lyrics,scriptureRef,bpm,meter}
        -> church signs public edition with Ed25519
        -> independent read-only replicas verify and store
        -> public GET /c/:tenant, /api/:tenant/songs

**Never copied:** private/HOLD/refused seeds, contributor aliases, permission-record references, reviewer credentials, raw event journals, local-only publications, unreviewed lyric drafts, unlicensed WAV stems or prayer requests. The public edition is a *deliberate publication* and should contain no sensitive information.

This is an extra public mirror format; it does not pretend to be a signed reLATTE crossing, a GHoT runtime integration, a PENNY resource settlement, or an official Tithely API. The existing Static Live stage compiler and generic Tithely external-link manifest are unchanged.

The signing key belongs to the originating church/authorized operator; the public key is pinned **out of band** by a mirror operator. Signature verification attests to the signing key, **not** to legal rights, human identity, or theological fitness. There is no automatic admission at receiving churches. Public mirroring is not private data synchronization.

## Operating limits

- The mirror accepts a single named tenant, on loopback only, and a maximum 512 KB public payload with up to 100 song projections. No remote listener, reverse proxy, DNS or TLS is supplied.
- Snapshots are **full public editions**. Edition numbers increase monotonically per owner key/tenant; lower numbers and same-number conflicting contents are refused. This does not solve key compromise or revocation of *already copied public content*.
- Current signing bytes use JSON serialization from the same JavaScript payload. This is not cross-language JCS and should be versioned or replaced before multi-language peers.
- Mirrors write a private-permission local snapshot by rename. There is no formal power-loss fsync protocol, cryptographic chain of editions, key rotation, HTTPS termination, disaster recovery SLA, quorum, peer discovery, telemetry, abuse reporting or geographic redundancy.
- There is no PENNY minting, hosting credit, compensation, financial settlement or charitable fundraising. Resource accounting should remain **candidate records** until independently checked and admitted.
- Withdrawing consent must stop future publication, but cannot guarantee deletion from independent past recipients. **No real person’s information should be included.**

## Next real field milestone (not claimed here)

Connect two physical machines on an isolated LAN; independently provision/pin the church's public signing key; transfer only the signed public edition. Confirm loss/restart, stale snapshot refusal, explicit authorized revocation signaling, and a tested rollback/recovery procedure. Only then work on GHoT capability discovery and receipts, reLATTE signed crossing envelopes, PENNY resource ledgers, and a narrow production-grade public entry service. The original church remains the publication authority; mirrors cannot publish new content on its behalf.

**Invariant:** CONTRIBUTION ≠ AUTHORITY · PUBLICATION ≠ REPLICATION CONSENT · MIRROR ≠ OWNER · RECEIPT ≠ SETTLEMENT · HOST LOSS ≠ PUBLIC LIBRARY LOSS
