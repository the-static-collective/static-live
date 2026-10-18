# CHURCH COMMONS 002 — signed-public failover without rollback

**Status: draft local experiment stacked on Commons 001.** Not a Real Life Covenant deployment, public church platform, or actual GHoT/PENNY/reLATTE integration.

## What this adds

Commons 001 proved that public-only, owner-signed songs can survive an origin outage on independently persisted mirror processes. Commons 002 adds a **read-only entrypoint** that decides which mirror may safely answer a public song request, rather than requiring a human to manually pick a mirror.

1. Each mirror can expose \`GET /public-snapshot\`: exactly the existing publicly released, owner-signed envelope. No private journal, seed, alias, rights reference, stem or admin credential.
2. A gateway has an **operator-provided** list of up to eight loopback mirror addresses and the *pinned owner public key*. It probes every mirror, verifies the Ed25519 signature and SHA-256 before considering it usable.
3. It prefers the highest verified edition; ties for that edition resolve deterministically by node ID. Competing signed histories for one edition mean **HOLD**, not arbitrary selection.
4. The highest verified edition and content digest are persisted. After the gateway has seen edition 3, it refuses to serve edition 2, **even if edition 3's only copy is currently offline**. After restarting the gateway it retains this no-rollback fence.
5. Each routing attempt writes a machine-local observation showing which nodes were probed, which responded with verified material, which were rejected, and which content was served. This is a **candidate work observation**, NOT a signed GHoT receipt or PENNY credit.

### Run

Requires Node.js 22+ and no external dependencies:

\`\`\`sh
cd labs/living-hymnal-001
node --test test/commons-gateway.test.mjs
node --test test/*.test.mjs
node scripts/commons-demo.mjs
\`\`\`

Gateway and mirrors are opt-in processes. The gateway route is \`GET /api/sample-church/songs\`. The runner \`scripts/commons-node.mjs\` supports \`owner\`, \`mirror\` and \`gateway\`, and binds **only to 127.0.0.1**. Its environment variables are:

| Variable | Scope |
| --- | --- |
| \`COMMONS_DATA_DIR\` | Required; independent per-node snapshot directory or gateway receipt directory |
| \`COMMONS_TRUSTED_KEY_FILE\` | Required for mirror and gateway; public Ed25519 SPKI PEM distributed out of band |
| \`COMMONS_PORT\` | Optional; defaults to an OS-assigned loopback port |
| \`COMMONS_MIRRORS_JSON\` | Gateway only: array of \`{"id":"mirror-a","url":"http://127.0.0.1:9301"}\` descriptors |

Example gateway launch *after* two independently approved mirrors have snapshots:

\`\`\`sh
COMMONS_DATA_DIR=./data/gateway \
COMMONS_TRUSTED_KEY_FILE=./owner-public.pem \
COMMONS_PORT=9300 \
COMMONS_MIRRORS_JSON='[{"id":"mirror-a","url":"http://127.0.0.1:9301"},{"id":"mirror-b","url":"http://127.0.0.1:9302"}]' \
node scripts/commons-node.mjs gateway
\`\`\`

The receiving mirrors can run on physically separate machines with **operator-controlled SSH local forwarding** to the loopback endpoints. The tunnel, not the demo HTTP server, is responsible for network transport security. For example, after mirror A is listening on its own machine's loopback port 9301, the gateway operator can create a local forward with \`ssh -N -L 127.0.0.1:9301:127.0.0.1:9301 mirror-a-user@mirror-a-host\`. Configure similar forwarding to a second distinct local port for B. The peers must be known and authorized; no untrusted LAN broadcast discovery is enabled.

## Trust, capacity and availability boundaries

- **PUBLIC MIRROR != CHURCH AUTHORITY**: the originating church determines which published lyrics have explicit interchurch permissions. Receiver-local admission is a separate act. The gateway only reads signed, public-only exports.
- **SIGNED != VALID LICENSE**: the owner key identifies the signer, not the rights validity or theology. Real song or child/private data must not be used in these tests.
- **OBSERVED WORK != CREDIT**: observed mirror replies are recorded as unsigned local evidence; no verified GHoT identity, power measurement, economic value, PENNY issuance or settlement is asserted.
- **LIVENESS != TRUST**: a reachable mirror with an invalid/unknown signature is rejected. The trusted set is provisioned manually; this isn't actual GHoT peer discovery or scheduling.
- **FRESHNESS != GUARANTEED**: highest-*observed* edition is not universally latest. The gateway cannot detect a newer edition it has never seen. A compromised owner signing key, uncooperative mirrors, unbounded redistribution and malicious host rollback are still outside the experiment.
- **FAIL CLOSED ON ROLLBACK**: a surviving but older mirror does **not** become an automatic stale fallback once the gateway has recorded a newer owner-signed edition. This sacrifices some availability to avoid serving potentially withdrawn content.
- No HTTPS termination, Internet ingress, rate limiting, identity provider, key rotation, clock-bound leases, explicit withdrawal process, stable real-world host identifiers, fsync-grade disaster recovery, DNS failover or production monitoring are provided. Existing Commons 001 mirror APIs still have no authentication for public mirroring; keep them strictly loopback.

## Next gates

1. **Church-controlled withdrawals and time-bound content leases**: a signed removal should be reflected by willing mirrors, while stale/offline copies eventually stop serving. Distributed public copies cannot be guaranteed erased.
2. **Real GHoT adapter**: project-owned \`ghot.body\` offers and authenticated receipt semantics with availability, power, storage and liveness. Current route observations should remain proposals until then.
3. **Two-physical-machine field proof**, then reversible hosting onboarding for volunteer churches, including revocation, transport authorization, key custody and backups.

**Law:** NODE ANSWERS != NODE TRUSTED · VERIFIED PUBLIC EDITION != LATEST EDITION · RETRY != ROLLBACK · CANDIDATE RECEIPT != PENNY CREDIT · CHURCH CONSENT != PERPETUAL LICENSE.
