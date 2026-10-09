# RADIO WORLD 001 — Two Doors, One App Shell

Experimental home: **Static Live**, not GHoT and not a substitute for either owner's broadcast service. Future goal: one installable Radio World app that lets listeners enter either Kinship Radio's independent station world (Minnesota) or Rock Impact's independent church/media world (Nigeria).

## What is executable today?

A mobile-friendly, installable local PWA interface with an explicitly human-controlled world selector and three views: Listen / Make / Exchange. The app uses a strict catalog with **two pinned official HTTPS websites**, immediately refuses any arbitrary stream URL, autoplay, syndication, recording, tracking, or inferred ownership, and permits only an external official-source handoff.

It is a clickable directory and world container—not yet a combined audio player or a live stream aggregator. On first start, it does **not** fetch or play either broadcaster's audio. It does not know whether either station is live or has approved a joint listener app.

- Kinship Radio official website: https://kinshipradio.org/main/
- Rock Impact official website: https://rockimpactmakersglobal.org/
- Kinship's public site advertises its own Android/iOS app. That app's license, direct stream endpoint and vendor arrangement are independent.
- Rock Impact advertises online services, but a verified owner-provided direct podcast/live endpoint has **not** been established.
- Do not import unverified third-party stream links or infer a "worldwide radio" license from an app listing.

This layer belongs next to existing Static Live **STREAM-001** (owner-local OBS controls) and **LIFESTREAM** (preserved human occurrence); it must never replace or override either. GHoT's RADIO HOUSE 004 is a separate optional Linux compute organ, not a media redistribution contract. reLATTE could later carry independently selected media artifacts, only after an authorized crossing and receiving editor review.

## Run the first clicky app (Node >=22)

From the Static Live repo on branch experiment/radio-world-001-two-doors:

~~~sh
npm test
npm run radio-world:001
~~~

Open **http://127.0.0.1:8789/** on that machine. The server deliberately binds loopback only. In-app world switching never starts audio or moves people, donations, cookies, accounts, licenses or programs between owners. Links open official source websites directly in a new tab. Browser navigation is not evidence that a listener heard anything.

On supported browsers, install as a standalone PWA. Its service worker caches only the first-party UI and public directory; **never** an organization's stream, recording, podcast, account data or copyrighted content. Browsing an official site still requires internet when that site does.

## Proposed migration to real two-source listening, in order

1. **Organizational yes/no, separately.** Kinship and Rock Impact each independently decide whether Static Live may name/list them, deep link to their player, embed their stream, receive recordings, share metadata and show their branding. A contact or interest in a project does not automatically grant a media license.
2. **Determine real source topology.** For each owner ask which official stream/video/podcast platform is authorized, the direct HTTPS endpoint (if any), the publisher or streaming vendor, hosting policy, player embedding permissions, simultaneous-user and rate limits, licensed music restrictions, jurisdiction, transcript/podcast/archive rights and withdrawal route. Keep stream keys and authorization credentials server-side on the owner's machine.
3. **Compatibility proof in owner-chosen environments.** Test Android, low-memory phones, modest Nigerian mobile data, intermittent networks, Wi-Fi, cellular and loss/recovery. Measure approximate data use per listener hour, dropouts, latency, codec and expected monthly hosting cost. A USA app-store listing says nothing about Nigerian store availability or actual stream reliability.
4. **After independent licensing, build exact owner-specific listen-only adapters.** A direct audio adapter is not a universal URL scraper. The app may play only one explicitly selected, licensed source at a time, user gesture required; world switch stops old audio, no crossfade/automatic rebroadcast/retention. An authorized external player remains the fallback.
5. **Keep podcast and live separate.** A source-owned RSS feed, local MP3 that the ministry actually owns or authorized embedded platform is not the same permission as internet radio or music syndication. Store the original master locally before editing; no transcripts/media reuse without appropriate speaker/editorial consent.
6. **Introduce permissioned exchange only later.** The proposed Nigeria↔Minnesota audio postcard is one independent source-offered item that the other recipient may review and decline. reLATTE may record that crossing, but does not create a license. GHoT can process separately approved compute tasks without touching a live OBS output.
7. **Preserve rollback.** Existing station apps/sites remain the system of record and original listening route. All shared-world features can be withdrawn without breaking either organization's current broadcast or presence.

### Readiness ledger (first results)

| Gate | Kinship | Rock Impact |
|---|---|---|
| Official organization site | Located | Located |
| Direct authorized stream URL | Not established | Not established |
| Live web audio embedded or licensed | Not established | Not established |
| Podcast RSS ownership/feed | Not established | Not established |
| Actual platform/vendor review | Pending | Pending |
| Owner invitation to integrate | Not established | Not established |
| Mobile/device/data measurements | Not performed | Not performed |
| Content/branding/editorial rights | Not established | Not established |
| First-party UI prototype | Built | Built |

No app store, Kinship mobile-app control, Rock Impact live platform account, ministry hardware, broadcasting equipment, donors or listener analytics were accessed or modified.

**SITE != STREAM. SOURCE OWNER != APP OWNER. LISTENER CLICK != VERIFIED PLAY. MUSIC LICENSE != PODCAST LICENSE. COMPOSITION != AUTHORIZATION.**
