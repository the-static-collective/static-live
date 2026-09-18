# STREAM-001 — Static Broadcast Console Design

**Status:** approved design  
**Date:** 2026-09-18  
**Host repository:** `the-static-collective/static-live`

> **ONE PERSON CAN RUN A CLEAN SERVICE STREAM FROM A BROWSER-FACING CONSOLE.**
>
> **LIVE EVENT != STREAM != RECORDING != ARCHIVE != EDIT.**
>
> **A FALLBACK MAY REPLACE A MISSING MEDIA FUNCTION. IT MAY NOT PRETEND THE MISSING HUMAN OR SOURCE WAS PRESENT.**

## 1. Purpose

STREAM-001 adds the first live-broadcast membrane to Static Live.

The immediate use case is a small church/ministry team that already uses OBS Studio but wants a simpler, safer operator surface for volunteers. The first slice does not replace OBS. OBS remains the media engine. Static Live owns the truthful broadcast packet, operator state, allowed scene transitions, preservation policy, and receipt.

The operator should not need to understand OBS internals during a normal service.

The first human-facing contract is:

```text
GO LIVE
CHANGE SCENE
END + PRESERVE
```

Everything else remains behind configuration or diagnostic surfaces.

## 2. Why Static Live owns this

Static Live already compiles declared performance material plus actual human presence into executable stage projections. STREAM-001 is the same kind of boundary for broadcast:

```text
declared service packet
+ actual OBS availability
+ actual operator actions
    ↓
bounded broadcast projection
    ↓
OBS executes media actions
    ↓
Static Live preserves an attributable receipt
```

Static Live does not become a video encoder, switcher, streaming CDN, social platform, or cloud archive.

## 3. Existing law carried forward

STREAM-001 inherits Static Live's central law:

> A fallback may replace a missing function. It may not pretend the missing human participated.

Broadcast form:

```text
camera absent
  -> fallback scene may activate
  -> absence remains explicit

live musician absent
  -> prerecorded media may fill a declared media function
  -> receipt does not claim live participation

network stream fails
  -> local recording continues when possible
  -> recording != successful live transmission

replay
  -> descendant of the event
  -> replay != original occurrence
```

## 4. External dependency boundary

STREAM-001 targets OBS Studio with obs-websocket 5.x.

As of OBS Studio 28+, obs-websocket is included with OBS by default. The 5.x protocol uses JSON WebSocket RPC; the default port is 4455. OBS recommends password authentication. Node.js 22 provides a stable built-in WebSocket client, so Static Live can speak the protocol without adding a package dependency.

Reference sources:
- https://github.com/obsproject/obs-websocket
- https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md
- https://obsproject.com/kb/remote-control-guide
- https://nodejs.org/download/release/latest-jod/docs/api/globals.html#websocket

STREAM-001 MUST NOT store the OBS password in a service packet, receipt, browser page, URL, log, or checked-in fixture.

Default secret source:

```text
STATIC_BROADCAST_OBS_PASSWORD
```

Default OBS endpoint:

```text
ws://127.0.0.1:4455
```

## 5. First architecture

```text
ServiceBroadcastPacket
        |
        v
compileBroadcastPlan()
        |
        v
Static Broadcast local server
        |
        +------ browser operator console
        |           |
        |           +-- GO LIVE
        |           +-- CHANGE SCENE
        |           +-- END + PRESERVE
        |
        v
OBS WebSocket v5 client
        |
        +-- GetSceneList
        +-- SetCurrentProgramScene
        +-- StartRecord
        +-- StartStream
        +-- GetRecordStatus / GetStreamStatus
        +-- StopStream
        +-- StopRecord
        |
        v
BroadcastReceipt
```

The browser talks only to the local Static Broadcast server. It never receives the OBS password.

## 6. ServiceBroadcastPacket v0.1

Conceptual shape:

```json
{
  "version": "static-live.broadcast-packet/v0.1",
  "event": {
    "id": "impact-makers-sunday-001",
    "title": "Sunday Service"
  },
  "obs": {
    "url": "ws://127.0.0.1:4455",
    "sceneCollection": "Impact Makers",
    "standbyScene": "Standby",
    "fallbackScene": "Fallback",
    "allowedScenes": [
      { "id": "wide", "label": "Wide", "obsSceneName": "Wide" },
      { "id": "speaker", "label": "Speaker", "obsSceneName": "Speaker" },
      { "id": "scripture", "label": "Scripture", "obsSceneName": "Scripture" }
    ]
  },
  "recording": {
    "requiredBeforeStream": true
  },
  "stream": {
    "enabled": true
  }
}
```

No stream key belongs in this packet. OBS owns its stream-service configuration.

## 7. Compilation

`compileBroadcastPlan(packet)` validates the declared service before any OBS command can be sent.

It must fail closed when:

- the packet version is unknown;
- event ID is absent;
- OBS URL is not loopback in STREAM-001;
- allowed scene IDs are duplicated;
- allowed OBS scene names are duplicated;
- standby/fallback scenes collide with ordinary scene IDs in an ambiguous way;
- no operator scene is declared;
- recording is not required before streaming.

The compiled plan is deterministic and content-addressed using Static Live's existing canonical JSON/hash discipline.

The plan owns no OBS password.

## 8. OBS preflight

Before a service can enter operator-ready state, the server connects and authenticates to OBS, then checks:

1. obs-websocket identification succeeds;
2. `GetSceneList` succeeds;
3. every packet scene required by the plan exists;
4. current OBS scene collection matches the declared collection, or STREAM-001 refuses readiness;
5. current record/stream state is known.

STREAM-001 does not automatically create or rewrite the user's OBS scene collection.

That is a future provisioning tool, not first-slice runtime behavior.

## 9. Operator state machine

```text
BOOT
  -> PREFLIGHT
      -> READY
          -> RECORDING
              -> LIVE
                  -> ENDING
                      -> PRESERVED

PREFLIGHT -> BLOCKED
READY -> BLOCKED
RECORDING -> RECORDING_ONLY
LIVE -> RECORDING_ONLY
ENDING -> PRESERVE_FAULT
```

### READY

OBS is connected, authenticated, and expected scenes exist.

No stream or recording is started by merely opening the browser.

### GO LIVE

GO LIVE performs an ordered crossing:

```text
1. StartRecord
2. verify recording active
3. set declared opening/standby scene if required
4. StartStream
5. verify stream active
```

Critical law:

```text
STREAM START FAILURE
!=
RECORDING ROLLBACK
```

If recording starts successfully and streaming fails, the console enters `RECORDING_ONLY`.

The local event is still being preserved.

### CHANGE SCENE

The browser may request only a scene declared in `allowedScenes`, plus the packet's standby/fallback scenes where explicitly allowed by the server state.

The server maps the packet scene ID to its OBS scene name and sends `SetCurrentProgramScene`.

Arbitrary scene names from browser input are rejected.

### END + PRESERVE

Normal shutdown order:

```text
1. StopStream if active
2. verify stream inactive
3. StopRecord if active
4. capture recording output path if OBS returns one
5. write BroadcastReceipt
```

If stream shutdown fails, the server reports the fault and does not falsely claim a clean end.

If recording shutdown fails, the receipt remains incomplete/faulted rather than inventing an archive path.

## 10. Recording continuity

STREAM-001 treats the local master recording as the preservation floor.

```text
recording requiredBeforeStream = true
```

is mandatory in the first packet version.

Therefore:

```text
network outage
!=
loss of local event witness
```

when OBS is still recording successfully.

The first slice does not upload the master recording anywhere.

## 11. Browser surface

The first browser surface is intentionally plain and volunteer-oriented.

It contains:

- event title;
- OBS connection status;
- recording status;
- stream status;
- current scene;
- one prominent `GO LIVE` button while ready;
- scene buttons while recording/live;
- one prominent `END + PRESERVE` button once recording has begun;
- one visible fault/recovery panel when degraded.

No advanced OBS settings are exposed.

No password field is rendered.

No stream key field is rendered.

No analytics, chat, donations, moderation, overlays editor, clip editor, or account system is included in STREAM-001.

## 12. Local server security

STREAM-001 binds to loopback only by default:

```text
127.0.0.1
```

The browser control server is not exposed to LAN/WAN in v0.1.

Remote tablet/phone operation is a later boundary because it introduces authentication, network trust, TLS, and device-loss concerns.

The OBS WebSocket password stays server-side.

Logs must redact authentication material.

## 13. OBS client boundary

The OBS client module owns protocol mechanics only:

- opening the WebSocket;
- v5 hello/identify/authentication;
- request IDs;
- request/response matching;
- timeouts;
- converting OBS request failures into typed local errors.

It does not decide service policy.

The controller decides ordering and state.

The browser server decides HTTP/UI transport.

This separation keeps protocol, domain, and UI independently testable.

## 14. Authentication

When OBS Hello includes an authentication challenge, STREAM-001 computes the obs-websocket v5 authentication string exactly as specified by OBS:

```text
secret = Base64(SHA256(password + salt))
authentication = Base64(SHA256(secret + challenge))
```

The resulting authentication string is sent only in the Identify message.

The password itself is never logged or included in receipts.

When OBS does not request authentication, STREAM-001 may identify without an authentication field, but documentation must continue to recommend OBS authentication.

## 15. BroadcastReceipt v0.1

A receipt records what Static Broadcast actually observed and commanded.

Conceptual shape:

```json
{
  "version": "static-live.broadcast-receipt/v0.1",
  "eventId": "impact-makers-sunday-001",
  "planDigest": "sha256:...",
  "started": {
    "recording": true,
    "stream": true
  },
  "sceneChanges": [
    {
      "sceneId": "speaker",
      "obsSceneName": "Speaker",
      "result": "confirmed"
    }
  ],
  "ended": {
    "stream": "confirmed-stopped",
    "recording": "confirmed-stopped"
  },
  "recordingOutputPath": "/path/reported/by/obs.mkv",
  "disposition": "preserved"
}
```

Allowed dispositions:

```text
preserved
recording_only
partial
faulted
```

The receipt does not claim:

- viewers actually watched;
- a platform successfully archived the stream;
- a human shown in a scene was physically present;
- the recording file remains permanently available;
- the event was spiritually, morally, or socially successful.

## 16. Failure law

Every operator command returns one of:

```text
confirmed
refused
failed
unknown
```

Unknown is first-class.

A timeout does not become success.

A browser click is not proof OBS executed the command.

A successful OBS response is not proof a remote streaming platform received every frame.

## 17. Testing strategy

STREAM-001 uses Node's built-in test runner and no external packages.

Tests are split into:

### Compiler tests

- deterministic packet compilation;
- loopback enforcement;
- duplicate scene rejection;
- missing required recording policy rejection.

### OBS protocol tests

Use a fake WebSocket transport.

- authenticated Identify is computed correctly;
- password never appears in emitted logs;
- request/response correlation;
- OBS failure becomes typed failure;
- timeout becomes unknown/failure, never success.

### Controller tests

Use a fake OBS adapter.

- GO LIVE starts recording before streaming;
- stream failure leaves recording active;
- scene changes reject undeclared scenes;
- END stops stream before recording;
- clean end yields preserved receipt;
- recording-stop failure yields faulted/partial receipt.

### HTTP/browser tests

- server binds loopback;
- status endpoint exposes no secret;
- GO LIVE route delegates once;
- scene route accepts only packet scene IDs;
- END route delegates once.

A live OBS integration test is optional/manual because CI cannot assume OBS is installed.

## 18. First executable specimen

Fixture:

```text
STREAM-001 / IMPACT-MAKERS-DEMO
```

Scenes:

```text
Standby
Wide
Speaker
Scripture
Fallback
```

Test sequence:

```text
preflight
-> GO LIVE
-> Wide
-> Speaker
-> Scripture
-> END + PRESERVE
```

Hostile sequence:

```text
preflight
-> StartRecord succeeds
-> StartStream fails
-> state becomes RECORDING_ONLY
-> END + PRESERVE stops recording
-> receipt says recording_only/partial
-> receipt never claims a successful stream
```

This fixture is synthetic and makes no claim about Impact Makers' real OBS scene names or production configuration.

## 19. Non-goals

STREAM-001 does not implement:

- multi-platform restream infrastructure;
- RTMP relay;
- cloud transcoding;
- CDN delivery;
- account/login system;
- LAN/WAN remote control;
- automatic OBS scene creation;
- camera discovery;
- audio mixing;
- audio DSP;
- donation overlays;
- chat moderation;
- automatic sermon clipping;
- AI captions;
- archive upload;
- worship licensing/compliance;
- viewer analytics;
- Book of Acts receipts;
- Upper Room integration.

Those may become later descendants after the local operator crossing proves itself.

## 20. Success criterion

STREAM-001 succeeds when one volunteer can launch a local Static Broadcast console, connect to an already-configured OBS instance, pass preflight, click `GO LIVE`, change only declared scenes, click `END + PRESERVE`, and receive a truthful receipt — while a stream-start failure still preserves the local recording and never gets mislabeled as a successful broadcast.

## 21. Working seal

> **THE STREAM MAY FAIL. THE EVENT MUST NOT BE FORCED TO LIE ABOUT WHAT SURVIVED.**
