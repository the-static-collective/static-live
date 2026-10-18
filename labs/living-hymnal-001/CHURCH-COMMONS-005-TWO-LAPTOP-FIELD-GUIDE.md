# CHURCH COMMONS 005 — The Two-Laptop Jubilee

**A runnable field kit for two *physical* laptops. Not a claim that the real field trial has happened.** This lab has no Real Life Covenant involvement, no real church songs, no real contributor data and no public deployment. It is stacked on Commons 004 → 003 → 002 → 001 → Living Hymnal 001.

The software already has (a) signed, public-only catalog editions; (b) explicit owner withdrawal; (c) ≤5-minute publication leases; (d) a lease-checking read-only gateway; (e) an opt-in GHoT status adapter. This package gives an operator reproducible commands to use those boundaries over **two independently powered machines**, with SSH as the only network ingress. A single-computer CI simulation checks the command sequence. Only a later operator-run field receipt can establish actual physical independence.

## What is proved if the field run succeeds

```text
Laptop A (owner)                      Laptop B (volunteer)
----------------                      --------------------
private synthetic journal             NO owner private key
owner Ed25519 private signing key      pinned owner PUBLIC key
local signed mirror A                  independent leased mirror B
local gateway                          independent snapshot disk
SSH client ------- authenticated ----> SSH daemon
 localhost:9302                        localhost:9302

1. A signs a synthetic, rights-approved PUBLIC-only leased edition.
2. A sends same edition to A's local mirror and B through SSH forwarding.
3. A gateway verifies BOTH snapshots independently, using its pinned key.
4. A mirror stops; A gateway routes to B (no stale downgrade).
5. A powers down or disconnects entirely; B independently continues serving
   exactly the same approved synthetic PUBLIC lyrics, until its lease expires.
6. B stops serving when its signed lease expires, even without A.
7. A returns, issues a signed withdrawal/new edition; B accepts it over the
   restored tunnel and removes the shared lyric from its public projection.
```

**Do not confuse a successful single-machine CI run with steps 4–7 actually occurring across physical laptops.**

## Requirements

Two laptops that run Node.js 22+; Git; OpenSSH client on A and SSH server on B; an isolated/trusted LAN or privately administered VPN with the SSH host key confirmed. Examples below assume a Linux/macOS-style shell. Windows machines can use WSL, with SSH networking carefully scoped to the chosen environment. Old hardware can work if the OS has a supported Node 22 build.

Do **not** forward HTTP ports to your router, add public firewall exceptions for mirror/gateway, expose GHoT's prototype task listener or send the owner's private key to B. Every Node server binds to `127.0.0.1`. Nothing should be routed through Tithely or a live church account for this test.

### 1. Download the exact experimental branch on BOTH laptops

```sh
git clone --branch experiment/church-commons-005-two-laptop-field-kit \
  https://github.com/the-static-collective/static-live.git
cd static-live/labs/living-hymnal-001
node --version
```

If either laptop already has the repository, use a separate checkout or worktree and explicitly select this branch. Do not run the example against `main`: the stacked prototypes are not merged there. This lab needs no npm install.

### 2. Laptop A — create synthetic owner, and start mirror A

```sh
node scripts/two-laptop-kit.mjs init "$HOME/commons-owner"
```

Run `issue` later, after the SSH tunnel is ready, to avoid wasting the short lease window. Do not transfer the generated `owner-private.pem` file.

In a separate terminal on A, start its local mirror:

```sh
node scripts/two-laptop-kit.mjs mirror \
  "$HOME/commons-mirror-a" \
  "$HOME/commons-owner/owner-public.pem" 9301
```

Keep this terminal running.

### 3. Transfer ONLY the public key to B and start mirror B

On A, substitute B's actual SSH user and LAN hostname/IP:

```sh
scp "$HOME/commons-owner/owner-public.pem" \
  <B_USER>@<B_LAN_HOST>:~/commons-owner-public.pem
```

Verify B's SSH host key before accepting it. Do not copy `owner-private.pem`, any `.jsonl` journals, the owner directory itself, or application credentials. The public signing key may be copied.

On B, from its checkout's `static-live/labs/living-hymnal-001` directory:

```sh
node scripts/two-laptop-kit.mjs mirror \
  "$HOME/commons-mirror-b" "$HOME/commons-owner-public.pem" 9302
```

**Only mirror B's loopback port 9302 is now listening; it is not reachable as a public HTTP service.** Leave the B mirror running.

### 4. A establishes the authenticated tunnel to B

Open a *different* terminal on A:

```sh
ssh -o ExitOnForwardFailure=yes -N \
  -L 127.0.0.1:9302:127.0.0.1:9302 \
  <B_USER>@<B_LAN_HOST>
```

The first `127.0.0.1:9302` is A's local tunnel socket. The second is B's loopback mirror, reached through the authenticated SSH connection. Keep the tunnel running. If SSH authentication fails, fix SSH independently; do not expose the mirror on `0.0.0.0` to work around it.

### 5. A issues the lease, publishes, and starts the gateway

Run these on A close together; the default edition lease lasts **at most five minutes**:

```sh
node scripts/two-laptop-kit.mjs issue "$HOME/commons-owner"
node scripts/two-laptop-kit.mjs verify \
  "$HOME/commons-owner/owner-public.pem" \
  "$HOME/commons-owner/public-edition.json"
node scripts/two-laptop-kit.mjs publish "$HOME/commons-owner" 9301 9302
```

In another A terminal start the gateway:

```sh
node scripts/two-laptop-kit.mjs gateway \
  "$HOME/commons-gateway" \
  "$HOME/commons-owner/owner-public.pem" \
  9300 9301 9302
```

Finally on A:

```sh
node scripts/two-laptop-kit.mjs check 9300
```

Expected: `AVAILABLE`, edition ≥1, song count **1**, selected mirror `laptop-a`. The synthetic private HOLD prayer, anonymous alias and locally published but *not* interchurch-approved song do **not** cross to B.

### 6. Kill A's local mirror, then the *entire* A laptop

First use Ctrl-C in A's `mirror ...9301` terminal. The gateway stays alive. Run:

```sh
node scripts/two-laptop-kit.mjs check 9300
```

Expected: `AVAILABLE`, selected mirror `laptop-b`. This validates route selection over the SSH tunnel.

Then **disconnect or power off laptop A** while leaving B powered and its mirror process running. On B, within the remaining signed lease window:

```sh
node scripts/two-laptop-kit.mjs check 9302
```

Expected: B reports `AVAILABLE` and song count **1**, even though its owner laptop is offline. This is the crucial *physical* observation. Capture the B console output with the time and host identity (do not publish LAN addresses).

After the signed expiry, repeat the B command. Expected: `HOLD` and HTTP 503. `check` intentionally exits nonzero on HOLD. If you need a longer observation window, issue another ≤300-second edition before shutting down A.

### 7. A returns; exercise actual owner withdrawal

Reconnect A and restart the SSH tunnel if necessary. No private data needs to be reintroduced to B.

On A (the owner):

```sh
node scripts/two-laptop-kit.mjs withdraw "$HOME/commons-owner"
node scripts/two-laptop-kit.mjs publish "$HOME/commons-owner" 9302
```

On B, before the replacement lease expires:

```sh
node scripts/two-laptop-kit.mjs check 9302
```

Expected: `AVAILABLE`, higher edition and **zero** shared songs. An old edition cannot undo the withdrawal at a cooperating mirror. Re-issuing while no new content exists creates another higher edition and requires a fresh publish. If A never returns, B correctly holds after its previous lease expires.

## Optional GHoT receipt while the gateway is still available

On A, in a *third* checkout of the project-owned GHoT runtime or from an existing checkout:

```sh
export GHOT_ADAPTER_MANIFESTS="$PWD/ghot/adapter-manifest.json"
export GHOT_COMMONS_GATEWAY_URL="http://127.0.0.1:9300"
export GHOT_COMMONS_TENANT="sample-church"
export GHOT_HOME="$HOME/commons-ghot-state"
python3 /path/to/GHoT/ghot/reference_node.py run \
  church-commons.public-hymnal.lease-status
```

This creates a real bounded GHoT receipt **for a status probe**; it still does not assign hosting, authenticate a volunteer server, or create PENNY credits.

## Evidence to preserve

Keep command outputs from both physical machines, observed UTC times, their distinct machine identities, mirror health and editions, a note describing exactly which machine was powered off, the gateway's local routing-observation directory, and B's output before/after lease expiry. Do not publish private owner signing keys, journals, SSH credentials or unredacted LAN addresses.

**No claims of field success without receipts from physically distinct machines.** The automated test only simulates this procedure with independent loopback processes.

## Remaining production HOLDs

This is an **experimental protocol**, not hosting for a congregation. It has no ongoing key rotation, authenticated public Internet ingress, independent identity/permission review, usable production publisher UI, traffic control, tenant isolation at scale, backups, trusted clock enforcement, signed GHoT host placement, PENNY economics, legal rights verification or automated SSH tunnel supervision. Leases are bounded consent for cooperating hosts, not deletion of a song from the wider Internet.

**THE HOST MAY DEPART; THE RELEASE REMAINS UNTIL ITS OWNER'S PERMISSION EXPIRES.**
