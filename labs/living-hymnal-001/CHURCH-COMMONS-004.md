# CHURCH COMMONS 004 — opt-in GHoT runtime adapter

**Status: executable integration through GHoT's own external-adapter manifest protocol, local-only.** Stacked on Commons 003. No deployment or volunteer node is enrolled.

The owning GHoT repository already provides a standard \`ghot.external-adapter-manifest/v0\` contract, with opt-in manifests selected by the operator through \`GHOT_ADAPTER_MANIFESTS\`. This lab adds one actual bounded capability without editing GHoT or pretending that a generic discovery event grants hosting authority.

### Capability

\`church-commons.public-hymnal.lease-status\`

- GHoT discovers a declared **Node.js** external executor through \`ghot/adapter-manifest.json\`.
- GHoT executes \`ghot/status-adapter.mjs\` with a JSON-null payload under its standard stdin/stdout protocol.
- The adapter only calls a **locally configured**, loopback, lease-enforcing gateway; it refuses arbitrary client-supplied hostnames, URLs, payloads and shell tasks.
- It checks that the gateway reports \`boundedLeaseEnforced: true\` and that a current verified-public response has \`boundedPublicationPermission: true\`.
- It returns **only** \`AVAILABLE/HOLD\`, source tenant, published song count, edition, selected mirror and expiry. It never returns lyrics, author aliases, private submissions, rights files, journal data or keys to GHoT receipts.
- GHoT creates its *actual* \`ghot.task\` and \`ghot.receipt\` artifacts under \`GHOT_HOME\`; the adapter's \`AVAILABLE\` is a claim about current gateway response, **not** GHoT hosting task assignment, signed mirror identity, church authorization, or PENNY compensation.

### Run with GHoT

Node.js 22+, Python 3, a checkout of the official GHoT repository, and a working **leased-gateway** from Commons 003:

\`\`\`sh
cd labs/living-hymnal-001
export GHOT_ADAPTER_MANIFESTS="$PWD/ghot/adapter-manifest.json"
export GHOT_COMMONS_GATEWAY_URL="http://127.0.0.1:9300"
export GHOT_COMMONS_TENANT="sample-church"
export GHOT_HOME="$PWD/.ghot-lab"  # local state, do not commit
python3 /path/to/GHoT/ghot/reference_node.py pantry
python3 /path/to/GHoT/ghot/reference_node.py run church-commons.public-hymnal.lease-status
\`\`\`

The gateway itself must enforce signed time-bounded publication leases (\`leased-gateway\` mode). Never point this adapter at an unleased Commons 002 gateway.

### Proof in CI

\`node --test labs/living-hymnal-001/test/ghot-adapter.test.mjs\` tests the GHoT adapter against an actual signed synthetic lease and its gateway.

The Living Hymnal CI workflow additionally checks out **the actual GHoT runtime** and executes it with \`GHOT_REFERENCE_NODE\` set to the source file. The test checks that GHoT runs the adapter via its own manifest and returns an actual \`ghot.receipt\` marked \`ok\`, with only allowed public metadata. This is a real runtime crossing, but all servers still live in one loopback runner.

### Explicit remaining work

To let volunteer churches *host* content through GHoT, we still need a separate bounded hosting capability (not merely the status probe), authentication for remote task ingress, honest resource/energy admission, real node identity/transport trust, revocation-aware mirror onboarding, anti-abuse, backup/restore, and physical LAN tests. GHoT's existing remote task listener is **not production authenticated**; do not expose it publicly to enable this adapter.

\`OFFER != SERVER\` · \`CHECK != HOSTING\` · \`GHOT RECEIPT != PENNY CREDIT\` · \`SIGNED LEASE != RIGHTS PROOF\` · \`CHURCH AUTHORITY != MACHINE IDENTITY\`
