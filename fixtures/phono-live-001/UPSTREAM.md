# PHONO-LIVE-001 upstream fixture

- Repository: `the-static-collective/the-haunted-phonography`
- Commit: `3ea4c141ffa3abe18f06019c0b0f2dd62ba20dd7`
- Source fixture: `test/fixtures/specimen-001.wav`
- Observation fixture: `test/fixtures/specimen-001.observations.json`
- Mutation seed: `seed-001`
- Source SHA-256: `sha256:8a7d0c4c3e5fe5a8eb9eb35217336d3c95fb0eb9555e72cf63c5a862e4de55ed`
- Score hash: `sha256:2d18cb2aa0ff9ec0321cebf21f4be1199a5ac4eee7a0a6eb1b202cd1f462c4ff`
- Selected offset: `-2`
- Resolved performance hash: `sha256:767137acce24b3da8f959887951cd05964b00881832766441b4fa10a133d161e`
- MIDI projection: 69 bytes, `sha256:08d0a5fd80a535d93211f4bfd36e2377c423dcaa1a95db159e881e64f666fd38`

`resolved-performance.json` and `phonograph-receipt.json` are the deterministic Specimen 001 objects reconstructed from that pinned source tree using its `identifySource -> admitObservations -> buildScore -> mutateScore -> resolvePerformance -> encodeMidi -> buildReceipt` contract. Their identities are verified again by Static Live tests at the receiving boundary.

These files are fixture evidence. Static Live does not fetch or import Haunted Phonography at runtime.
