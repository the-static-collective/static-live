# STREAM-001 — Static Broadcast Demo

This is a **synthetic** local demo for the first Static Broadcast console. The checked-in scene names are examples only; they are not a claim about Impact Makers' real production OBS configuration.

## Requirements

- Node.js 22+
- OBS Studio 28+ with obs-websocket available
- OBS WebSocket authentication enabled and protected with a password
- OBS streaming service configured inside OBS itself
- An OBS scene collection matching the packet you run

OBS Studio 28+ includes obs-websocket by default. Static Broadcast does not store or manage your platform stream key.

## Demo scene collection

The synthetic fixture expects a scene collection named:

```text
Impact Makers
```

with these scenes:

```text
Standby
Wide
Speaker
Scripture
Fallback
```

For a real deployment, copy `fixtures/stream-001/impact-makers-demo.json` and change the event title, scene collection, and scene names to match the actual OBS installation.

## Start

Set the OBS WebSocket secret in the environment:

```bash
export STATIC_BROADCAST_OBS_PASSWORD='your-obs-websocket-secret'
```

Then run:

```bash
npm run stream-001:demo
```

The CLI performs OBS preflight and prints a loopback URL such as:

```text
http://127.0.0.1:3008
```

Open that address in a browser on the same computer.

The first operator surface is deliberately small:

```text
GO LIVE
CHANGE SCENE
END + PRESERVE
```

## Preservation law

GO LIVE starts and verifies local recording before it attempts to start the stream.

If streaming fails after recording has begun, Static Broadcast enters `recording_only`. It does not stop the recording merely because the network path failed.

```text
STREAM START FAILURE
!=
RECORDING ROLLBACK
```

## Boundary

STREAM-001 is loopback-only. It does not provide phone/tablet LAN control, cloud relay, stream-key management, automatic OBS provisioning, archive upload, analytics, chat moderation, AI captions, or clip generation.

## HOUSE local operator door (v0.1)

After OBS preflight and the Static Broadcast service have started, the console exposes
a read-only `GET /api/house/identity` response identifying the service contract
`static-live.broadcast-house-door/v0.1`, the console path, and the event id.
`GET /api/status` remains the project-owned source of current recording, stream,
and controller state. These fields are descriptive, **not authentication or evidence
of remote broadcast delivery**. HOUSE must verify both responses and show a manual
link only for the explicitly configured loopback port.

The operator still controls GO LIVE, scene selection, and END + PRESERVE **inside
Static Broadcast**. HOUSE does not call the mutation endpoints, store OBS passwords,
or autostart any service. No LAN, proxy, or remote access is introduced.
