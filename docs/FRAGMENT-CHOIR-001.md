# FRAGMENT CHOIR 001 — The Pastor of Funk

**Status:** experimental local rehearsal, human-operated, not deployed.  
**Home:** Static Live. **Origin:** "Pastor of Funk" song and live co-composition discussion, 2026-10-10.

> No, no, keep it. That fracture's gold.

## What we built

A small, runnable porch → admission → composition → stage-score loop for the song's rainbow elves and remixing Pastor. A contribution is neither automatically good nor automatically usable. Every step is explicitly operated by a person.

```text
ELF BRINGS A FRAGMENT
   |  self-described provenance; operator records declared permissions
   v
PORCH: HELD
   |  host may ADMIT / HOLD / REFUSE
   v
ADMITTED FRAGMENT
   |  host chooses treatment + writes stage cue
   |  checks perform + preserve; additionally transform for remix
   v
STAGE SCORE PROPOSAL
   |  local export contains only admitted, used fragments
   v
NODE COMPILER
   |  schema verification + permission gate + deterministic receipt
   v
REVIEWABLE SCORE (NOT A PERFORMANCE)
```

### Try the browser desk (no install)

Open `examples/pastor-of-funk-001/index.html` directly in a modern browser. No server, build step, microphone, account, permissions popup or cloud service. It keeps the rehearsal **in memory only**; closing or refreshing the page loses it.

1. Type a fragment and describe its provenance. Choose witnessed, imagined or found/uncertain. Optionally supply an attribution name.
2. Check each of three declared permissions individually: may perform, may remix, may preserve in exported score.
3. Place it on the porch. A local host explicitly chooses Admit, Hold or Refuse.
4. Select admitted material in the Pastor's console, choose `present`, `loop`, `echo`, `braid`, or `fracture`, and supply an instruction.
5. Review the visual score. Export the proposal JSON. The export does **not** contain held, refused, or admitted-but-unused materials.

These controls are not cryptographic verification of consent or identity; in a real event, the host must independently communicate with each actual contributor, establish the scope, and obtain real permission before showing or preserving material. The anonymous choice only suppresses the stage credit name; it is not a privacy guarantee about the actual event.

### Compile an explicitly fictional specimen

Requires Node.js 22+ with no external packages:

```sh
npm test
node src/pastor-funk-001.js compile \
  fixtures/pastor-of-funk-001/specimen.json \
  build/pastor-funk-score.json
```

Create `build/` first if it does not exist (`mkdir -p build`). The compiler deliberately uses exclusive creation: it refuses to overwrite an existing score file. The sample is fictional and is not evidence of real contributors, real permissions, or a conducted performance.

The browser-exported `fragment-choir-proposal.json` has the same input schema and can replace the specimen path:

```sh
node src/pastor-funk-001.js compile \
  /path/to/fragment-choir-proposal.json \
  /path/to/new-reviewed-score.json
```

The output contains ordered cues, every cue's original text, declared source posture, credited or anonymous attribution, human review attribution, permission flags, the names of held/refused fragment IDs (when present in a compile input), and a deterministic SHA-256 receipt over the canonical output. This SHA-256 digest is a local **content identifier**. It is not a digital signature, a contributor identity proof, a copyright license, an archive guarantee or an OBS broadcast receipt.

## Design ownership

- **Static Live** owns stage proposals and any later, separately authorized show/broadcast observation. It does not decide what a fragment means.
- **Groove Rooms / GrO** may eventually offer multi-person presence and contribution transport, without automatically admitting material to a performance. SMS and remote submission are **not present** in 001.
- **reLATTE** may eventually carry signed fragment crossings and receiving-party dispositions; this specimen only uses local human-entered statements and a content hash. **It does not implement reLATTE.**
- **Haunted Toaster / Blender** may later propose visuals or sonic reinterpretations; their suggestions do not become event truth or permission grants.
- **Full Measure / MEMENTO** may later register witnessed human participation and revisitable lineage; this local score cannot assert verified participation.
- **OBS / Stage hardware** are deliberately untouched.

## Non-negotiable boundaries

```text
OFFER != ADMISSION
PERMISSION STATEMENT != VERIFIED CONSENT
SOURCE DESCRIPTION != SOURCE EVIDENCE
ANONYMOUS CREDIT != PROVEN ANONYMITY
CUE != SOUND
SCORE != PERFORMANCE
EXPORT != PUBLICATION
REMIX != OWNERSHIP
```

The first slice is **text descriptions and text stage cues only**. It doesn't fetch media; record performers; broadcast sound; control OBS; collect background metrics; generate from an LLM; or transmit anything to Abundent.org, a station, or any other system. Browser-side review actions aren't immutable signatures or a witness ledger. If the browser is controlled by an unauthorized operator, the asserted names and permissions cannot be trusted.

A future multi-party rendition needs: contributor-controlled authorizations with revocation posture; event/operator identity and abuse/rights safeguards; immutable original-media ancestry; boundary between ephemeral live use and archived reuse; host preview and explicit physical-stage action; a true performed/recorded observation tied to OBS media, rather than an inferred witness.

**The aesthetic principle:** don't repair the crack just because the software could. And don't give the Pastor moral authority over the people who brought it.
