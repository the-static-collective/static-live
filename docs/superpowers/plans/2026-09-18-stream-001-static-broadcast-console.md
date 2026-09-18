# STREAM-001 Static Broadcast Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local browser-facing broadcast console in Static Live that safely controls an already-configured OBS Studio instance with three operator actions: GO LIVE, CHANGE SCENE, and END + PRESERVE.

**Architecture:** Add four isolated runtime boundaries: a deterministic broadcast-packet compiler, a protocol-only OBS WebSocket v5 client, a policy/controller state machine, and a loopback-only HTTP browser server/CLI. OBS remains the media engine; Static Live owns declared broadcast policy, action ordering, degraded-state semantics, and truthful receipts.

**Tech Stack:** Node.js 22+, built-in `node:test`, `node:crypto`, `node:http`, built-in global `WebSocket`, existing `src/canonical-json.js`. No external packages.

**Spec:** `docs/superpowers/specs/2026-09-18-stream-001-static-broadcast-console-design.md`

## Global Constraints

- `LIVE EVENT != STREAM != RECORDING != ARCHIVE != EDIT`.
- `A FALLBACK MAY REPLACE A MISSING MEDIA FUNCTION. IT MAY NOT PRETEND THE MISSING HUMAN OR SOURCE WAS PRESENT.`
- First human surface is `GO LIVE`, `CHANGE SCENE`, `END + PRESERVE`.
- Recording MUST start and be confirmed before streaming is started.
- `STREAM START FAILURE != RECORDING ROLLBACK`.
- Local recording is the preservation floor.
- Browser never receives OBS password.
- OBS password comes from `STATIC_BROADCAST_OBS_PASSWORD`.
- Default OBS endpoint is `ws://127.0.0.1:4455`.
- Browser control server binds loopback only in v0.1.
- Service packet contains no stream key.
- Arbitrary browser-provided OBS scene names are rejected.
- Unknown/timeouts remain unknown or failed; they never become confirmed.
- Existing Static Live compiler/runtime behavior must remain unchanged.
- No restream relay, account/login system, LAN/WAN remote control, automatic OBS provisioning, AI captions, archive upload, Book of Acts integration, Upper Room integration, analytics, or clip pipeline in STREAM-001.
- All new production behavior follows TDD.

---

## File structure

```text
src/
  broadcast-compiler.js
  obs-client.js
  broadcast-controller.js
  broadcast-server.js
  broadcast-cli.js

test/
  broadcast-compiler.test.js
  obs-client.test.js
  broadcast-controller.test.js
  broadcast-server.test.js

fixtures/
  stream-001/
    impact-makers-demo.json

examples/
  stream-001/
    README.md
```

Modify:
- `package.json` to add `broadcast` and `stream-001:demo` scripts.
- `README.md` to document STREAM-001.

---

### Task 1: Compile a deterministic ServiceBroadcastPacket

**Files:**
- Create: `src/broadcast-compiler.js`
- Create: `test/broadcast-compiler.test.js`
- Create: `fixtures/stream-001/impact-makers-demo.json`

**Interfaces:**
- Consumes: JSON packet plus existing `liveHashCanonical`.
- Produces:
  - `compileBroadcastPlan(packet)`
  - compiled plan with `version: "static-live.broadcast-plan/v0.1"`
  - deterministic `planDigest`
  - normalized scene map by scene ID.

- [ ] **Step 1: Write failing compiler tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { compileBroadcastPlan } from '../src/broadcast-compiler.js';

const packet = {
  version: 'static-live.broadcast-packet/v0.1',
  event: { id: 'impact-makers-demo', title: 'Sunday Service' },
  obs: {
    url: 'ws://127.0.0.1:4455',
    sceneCollection: 'Impact Makers',
    standbyScene: 'Standby',
    fallbackScene: 'Fallback',
    allowedScenes: [
      { id: 'wide', label: 'Wide', obsSceneName: 'Wide' },
      { id: 'speaker', label: 'Speaker', obsSceneName: 'Speaker' },
      { id: 'scripture', label: 'Scripture', obsSceneName: 'Scripture' },
    ],
  },
  recording: { requiredBeforeStream: true },
  stream: { enabled: true },
};

test('compileBroadcastPlan is deterministic and maps declared scenes', () => {
  const a = compileBroadcastPlan(packet);
  const b = compileBroadcastPlan(structuredClone(packet));
  assert.equal(a.planDigest, b.planDigest);
  assert.equal(a.scenes.speaker.obsSceneName, 'Speaker');
});

test('compiler refuses non-loopback OBS URLs', () => {
  const changed = structuredClone(packet);
  changed.obs.url = 'ws://192.168.1.10:4455';
  assert.throws(() => compileBroadcastPlan(changed), /loopback/);
});

test('compiler refuses duplicate scene ids or OBS scene names', () => {
  const idDup = structuredClone(packet);
  idDup.obs.allowedScenes[1].id = 'wide';
  assert.throws(() => compileBroadcastPlan(idDup), /duplicate scene id/);

  const nameDup = structuredClone(packet);
  nameDup.obs.allowedScenes[1].obsSceneName = 'Wide';
  assert.throws(() => compileBroadcastPlan(nameDup), /duplicate OBS scene name/);
});

test('compiler requires recording before streaming', () => {
  const changed = structuredClone(packet);
  changed.recording.requiredBeforeStream = false;
  assert.throws(() => compileBroadcastPlan(changed), /recording.*required/i);
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
node --test test/broadcast-compiler.test.js
```

Expected: FAIL because `src/broadcast-compiler.js` does not exist.

- [ ] **Step 3: Implement compiler**

```js
import { liveHashCanonical } from './canonical-json.js';

const PACKET = 'static-live.broadcast-packet/v0.1';
const PLAN = 'static-live.broadcast-plan/v0.1';

function fail(message) {
  throw new TypeError(message);
}

function assertLoopback(urlText) {
  let url;
  try { url = new URL(urlText); } catch { fail('OBS url must be a valid ws:// loopback URL'); }
  if (url.protocol !== 'ws:') fail('OBS url must use ws:// in STREAM-001');
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    fail('OBS url must be loopback in STREAM-001');
  }
}

export function compileBroadcastPlan(packet) {
  if (!packet || packet.version !== PACKET) fail('unsupported broadcast packet version');
  if (!packet.event?.id?.trim()) fail('event.id is required');
  if (!packet.obs?.sceneCollection?.trim()) fail('obs.sceneCollection is required');
  assertLoopback(packet.obs?.url);
  if (packet.recording?.requiredBeforeStream !== true) {
    fail('recording is required before streaming in STREAM-001');
  }
  if (!Array.isArray(packet.obs.allowedScenes) || packet.obs.allowedScenes.length === 0) {
    fail('at least one operator scene is required');
  }

  const ids = new Set();
  const names = new Set();
  const scenes = {};
  for (const scene of packet.obs.allowedScenes) {
    if (!scene.id?.trim() || !scene.obsSceneName?.trim()) fail('scene id and OBS scene name are required');
    if (ids.has(scene.id)) fail(`duplicate scene id: ${scene.id}`);
    if (names.has(scene.obsSceneName)) fail(`duplicate OBS scene name: ${scene.obsSceneName}`);
    ids.add(scene.id);
    names.add(scene.obsSceneName);
    scenes[scene.id] = {
      id: scene.id,
      label: scene.label || scene.id,
      obsSceneName: scene.obsSceneName,
    };
  }

  const body = {
    version: PLAN,
    event: structuredClone(packet.event),
    obs: {
      url: packet.obs.url,
      sceneCollection: packet.obs.sceneCollection,
      standbyScene: packet.obs.standbyScene,
      fallbackScene: packet.obs.fallbackScene,
    },
    scenes,
    recording: { requiredBeforeStream: true },
    stream: { enabled: packet.stream?.enabled !== false },
  };

  return { ...body, planDigest: liveHashCanonical(body) };
}
```

- [ ] **Step 4: Run GREEN**

Run:
```bash
node --test test/broadcast-compiler.test.js
```

Expected: 4 passing tests.

- [ ] **Step 5: Add the synthetic fixture**

Create `fixtures/stream-001/impact-makers-demo.json` with the packet above plus `Fallback` and `Standby` declarations exactly as specified in the design. The fixture is synthetic and must say so in its event metadata.

- [ ] **Step 6: Commit**

```bash
git add src/broadcast-compiler.js test/broadcast-compiler.test.js fixtures/stream-001/impact-makers-demo.json
git commit -m "feat: compile STREAM-001 broadcast plans"
```

---

### Task 2: Implement protocol-only OBS WebSocket v5 client

**Files:**
- Create: `src/obs-client.js`
- Create: `test/obs-client.test.js`

**Interfaces:**
- Produces:
  - `computeObsAuthentication(password, salt, challenge)`
  - `ObsRequestError`
  - `ObsTimeoutError`
  - `createObsClient({ url, password, WebSocketImpl, timeoutMs, logger })`
- Client methods:
  - `connect()`
  - `request(requestType, requestData = {})`
  - `close()`

- [ ] **Step 1: Write failing authentication and request tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  computeObsAuthentication,
  createObsClient,
  ObsRequestError,
} from '../src/obs-client.js';

function expectedAuth(password, salt, challenge) {
  const secret = createHash('sha256').update(password + salt).digest('base64');
  return createHash('sha256').update(secret + challenge).digest('base64');
}

test('OBS authentication follows v5 challenge algorithm', () => {
  assert.equal(
    computeObsAuthentication('pw', 'salt', 'challenge'),
    expectedAuth('pw', 'salt', 'challenge'),
  );
});

test('OBS request failures reject with typed errors', async () => {
  // use FakeWebSocket below to emit Hello -> Identified -> failed RequestResponse
  const ws = new FakeWebSocket();
  const client = createObsClient({
    url: 'ws://127.0.0.1:4455',
    password: 'secret',
    WebSocketImpl: class { constructor() { return ws; } },
    timeoutMs: 50,
    logger: { info() {}, error() {} },
  });
  const connected = client.connect();
  ws.open();
  ws.message({ op: 0, d: { rpcVersion: 1 } });
  ws.message({ op: 2, d: { negotiatedRpcVersion: 1 } });
  await connected;

  const pending = client.request('StartStream');
  const request = JSON.parse(ws.sent.at(-1));
  ws.message({
    op: 7,
    d: {
      requestType: 'StartStream',
      requestId: request.d.requestId,
      requestStatus: { result: false, code: 500, comment: 'boom' },
    },
  });

  await assert.rejects(pending, ObsRequestError);
});
```

The test file also defines a tiny event-listener-compatible `FakeWebSocket` with `send`, `close`, `addEventListener`, `open()`, and `message(payload)`.

- [ ] **Step 2: Run RED**

Run:
```bash
node --test test/obs-client.test.js
```

Expected: FAIL because `src/obs-client.js` does not exist.

- [ ] **Step 3: Implement auth and v5 handshake/request correlation**

Use:
- OpCode 0 Hello
- OpCode 1 Identify
- OpCode 2 Identified
- OpCode 6 Request
- OpCode 7 RequestResponse
- `crypto.randomUUID()` for request IDs.
- `eventSubscriptions: 0` in Identify because STREAM-001 does not require events.
- authentication only when Hello includes `d.authentication`.
- no log line may include `password`, computed secret, or computed authentication string.

- [ ] **Step 4: Add timeout test before timeout implementation**

```js
test('unanswered OBS request times out instead of becoming success', async () => {
  // connect fake client as above
  await assert.rejects(client.request('GetSceneList'), /timed out/);
});
```

Run and verify it fails because timeout behavior is absent, then implement per-request timers which reject `ObsTimeoutError` and delete pending request state.

- [ ] **Step 5: Run GREEN**

Run:
```bash
node --test test/obs-client.test.js
```

Expected: auth, failure, correlation, timeout, and password-redaction tests all pass.

- [ ] **Step 6: Commit**

```bash
git add src/obs-client.js test/obs-client.test.js
git commit -m "feat: add OBS WebSocket v5 adapter"
```

---

### Task 3: Implement broadcast preflight, state machine, and receipt

**Files:**
- Create: `src/broadcast-controller.js`
- Create: `test/broadcast-controller.test.js`

**Interfaces:**
- Consumes: compiled broadcast plan plus an OBS adapter exposing `request(type, data)`.
- Produces `createBroadcastController({ plan, obs })`.
- Public methods:
  - `preflight()`
  - `goLive()`
  - `changeScene(sceneId)`
  - `endAndPreserve()`
  - `getStatus()`
- States:
  - `boot`
  - `ready`
  - `recording`
  - `live`
  - `recording_only`
  - `ending`
  - `preserved`
  - `blocked`
  - `faulted`

- [ ] **Step 1: Write failing preflight and GO LIVE ordering tests**

```js
test('preflight requires declared scene collection and scenes', async () => {
  const obs = fakeObs({
    GetSceneList: {
      currentProgramSceneName: 'Standby',
      currentSceneCollectionName: 'Impact Makers',
      scenes: [
        { sceneName: 'Standby' },
        { sceneName: 'Wide' },
        { sceneName: 'Speaker' },
        { sceneName: 'Scripture' },
        { sceneName: 'Fallback' },
      ],
    },
    GetRecordStatus: { outputActive: false },
    GetStreamStatus: { outputActive: false },
  });
  const controller = createBroadcastController({ plan, obs });
  await controller.preflight();
  assert.equal(controller.getStatus().state, 'ready');
});

test('GO LIVE starts and verifies recording before starting stream', async () => {
  const calls = [];
  const obs = orderedObs(calls, {
    StartRecord: {},
    GetRecordStatus: { outputActive: true },
    SetCurrentProgramScene: {},
    StartStream: {},
    GetStreamStatus: { outputActive: true },
  });
  const controller = readyController(plan, obs);
  await controller.goLive();
  assert.deepEqual(calls.map((call) => call.type), [
    'StartRecord',
    'GetRecordStatus',
    'SetCurrentProgramScene',
    'StartStream',
    'GetStreamStatus',
  ]);
  assert.equal(controller.getStatus().state, 'live');
});
```

- [ ] **Step 2: Run RED**

Run:
```bash
node --test test/broadcast-controller.test.js
```

Expected: FAIL because controller does not exist.

- [ ] **Step 3: Implement preflight and GO LIVE**

Preflight issues:
- `GetSceneList`
- `GetRecordStatus`
- `GetStreamStatus`

It refuses readiness if current scene collection differs or declared scenes/standby/fallback are absent.

GO LIVE:
1. `StartRecord`
2. `GetRecordStatus`; require `outputActive === true`
3. `SetCurrentProgramScene` to standby scene
4. `StartStream`
5. `GetStreamStatus`; require `outputActive === true`

- [ ] **Step 4: Add failing degraded-stream test**

```js
test('stream-start failure preserves recording and enters recording_only', async () => {
  const obs = fakeObs({
    StartRecord: {},
    GetRecordStatus: { outputActive: true },
    SetCurrentProgramScene: {},
    StartStream: new Error('stream failed'),
  });
  const controller = readyController(plan, obs);
  await assert.rejects(controller.goLive(), /stream failed/);
  assert.equal(controller.getStatus().state, 'recording_only');
  assert.equal(controller.getStatus().recording, true);
});
```

Run RED, then implement the catch boundary so recording remains active and the state becomes `recording_only`.

- [ ] **Step 5: Add failing declared-scene test**

```js
test('scene changes accept ids, not arbitrary OBS scene names', async () => {
  const obs = orderedObs([], { SetCurrentProgramScene: {} });
  const controller = liveController(plan, obs);
  await controller.changeScene('speaker');
  await assert.rejects(() => controller.changeScene('Not In Packet'), /undeclared scene/);
});
```

Run RED, then implement scene-ID lookup only.

- [ ] **Step 6: Add failing END + PRESERVE ordering/receipt tests**

```js
test('END stops stream before recording and emits preserved receipt', async () => {
  const calls = [];
  const obs = orderedObs(calls, {
    StopStream: {},
    GetStreamStatus: { outputActive: false },
    StopRecord: { outputPath: '/recordings/service.mkv' },
    GetRecordStatus: { outputActive: false },
  });
  const controller = liveController(plan, obs);
  const receipt = await controller.endAndPreserve();
  assert.deepEqual(calls.map((call) => call.type), [
    'StopStream',
    'GetStreamStatus',
    'StopRecord',
    'GetRecordStatus',
  ]);
  assert.equal(receipt.disposition, 'preserved');
  assert.equal(receipt.recordingOutputPath, '/recordings/service.mkv');
});
```

Run RED, implement receipt with:
- `version: "static-live.broadcast-receipt/v0.1"`
- `eventId`
- `planDigest`
- started flags
- confirmed sceneChanges
- end state
- optional recording output path
- `disposition`.

Recording-stop failure produces `faulted`; stream-start failure followed by clean recording stop produces `recording_only` or `partial`, never `preserved`.

- [ ] **Step 7: Run GREEN**

Run:
```bash
node --test test/broadcast-controller.test.js
```

Expected: all controller tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/broadcast-controller.js test/broadcast-controller.test.js
git commit -m "feat: add STREAM-001 broadcast controller"
```

---

### Task 4: Add loopback browser server and runnable CLI

**Files:**
- Create: `src/broadcast-server.js`
- Create: `src/broadcast-cli.js`
- Create: `test/broadcast-server.test.js`
- Modify: `package.json`
- Create: `examples/stream-001/README.md`
- Modify: `README.md`

**Interfaces:**
- `createBroadcastServer({ controller, plan, host = "127.0.0.1", port = 0 })`
- Routes:
  - `GET /`
  - `GET /api/status`
  - `POST /api/live`
  - `POST /api/scene/:sceneId`
  - `POST /api/end`
- `broadcast-cli.js <packet.json> [--port N]`

- [ ] **Step 1: Write failing loopback/status/action tests**

```js
test('server binds loopback and status exposes no secrets', async () => {
  const server = createBroadcastServer({ controller, plan, port: 0 });
  const address = await server.start();
  assert.equal(address.host, '127.0.0.1');
  const response = await fetch(`${address.url}/api/status`);
  const body = await response.json();
  assert.equal(JSON.stringify(body).includes('password'), false);
  await server.stop();
});

test('scene endpoint passes only declared scene id to controller', async () => {
  const calls = [];
  const controller = fakeController(calls);
  const server = createBroadcastServer({ controller, plan, port: 0 });
  const address = await server.start();
  const response = await fetch(`${address.url}/api/scene/speaker`, { method: 'POST' });
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [['changeScene', 'speaker']]);
  await server.stop();
});
```

- [ ] **Step 2: Run RED**

Run:
```bash
node --test test/broadcast-server.test.js
```

Expected: FAIL because server does not exist.

- [ ] **Step 3: Implement local HTTP server and embedded operator page**

The page renders:
- event title;
- connection/state/recording/stream/current-scene statuses;
- `GO LIVE`;
- one button per `plan.scenes`;
- `END + PRESERVE`;
- a fault panel.

Client JS calls only the local `/api/*` routes and periodically refreshes status.

The server rejects non-POST action requests with 405 and unknown routes with 404.

- [ ] **Step 4: Run GREEN**

Run:
```bash
node --test test/broadcast-server.test.js
```

Expected: server tests pass.

- [ ] **Step 5: Implement CLI**

CLI:
1. reads packet path;
2. `compileBroadcastPlan`;
3. creates OBS client with `process.env.STATIC_BROADCAST_OBS_PASSWORD || ''`;
4. connects;
5. creates controller;
6. runs preflight;
7. starts local browser server;
8. prints exactly the local URL and event title, never secret material;
9. handles SIGINT/SIGTERM by stopping the HTTP server and closing the OBS client.

Add package scripts:

```json
"broadcast": "node src/broadcast-cli.js",
"stream-001:demo": "node src/broadcast-cli.js fixtures/stream-001/impact-makers-demo.json"
```

- [ ] **Step 6: Document manual setup**

`examples/stream-001/README.md` includes:
- install OBS 28+;
- enable obs-websocket and password;
- create the fixture's synthetic scenes or adapt a copied packet;
- set `STATIC_BROADCAST_OBS_PASSWORD`;
- run `npm run stream-001:demo`;
- open the printed localhost URL;
- reminder that the fixture scene names are synthetic and not Impact Makers' actual production setup.

README adds STREAM-001 summary and links spec/example.

- [ ] **Step 7: Run full verification**

Run fresh:

```bash
npm test
```

Expected: all existing Static Live tests plus STREAM-001 tests pass.

Also run:

```bash
node --check src/broadcast-compiler.js
node --check src/obs-client.js
node --check src/broadcast-controller.js
node --check src/broadcast-server.js
node --check src/broadcast-cli.js
```

Expected: all exit 0.

- [ ] **Step 8: Scope audit**

Confirm branch diff contains:
- no external dependency;
- no stream key;
- no checked-in password;
- no LAN bind such as `0.0.0.0`;
- no changes to existing Static Live compiler semantics;
- no ministry-specific production configuration.

- [ ] **Step 9: Commit**

```bash
git add src/broadcast-server.js src/broadcast-cli.js test/broadcast-server.test.js package.json examples/stream-001/README.md README.md
git commit -m "feat: add local Static Broadcast console"
```

---

## Final verification checklist

- [ ] Full `npm test` passes.
- [ ] All five new runtime files pass `node --check`.
- [ ] Plan digest is deterministic.
- [ ] Non-loopback OBS packet fails closed.
- [ ] OBS v5 authentication test matches protocol algorithm.
- [ ] OBS password never appears in logs/status/fixture.
- [ ] GO LIVE starts recording before streaming.
- [ ] Stream-start failure leaves recording active and state `recording_only`.
- [ ] Browser can change only declared scene IDs.
- [ ] END stops stream before recording.
- [ ] Preserved receipt is emitted only after confirmed clean stop.
- [ ] Server binds `127.0.0.1`.
- [ ] Existing Static Live tests remain green.
- [ ] No external package was added.
- [ ] Fixture remains explicitly synthetic.
