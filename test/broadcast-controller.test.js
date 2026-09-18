import test from 'node:test';
import assert from 'node:assert/strict';
import { compileBroadcastPlan } from '../src/broadcast-compiler.js';
import { createBroadcastController } from '../src/broadcast-controller.js';

const packet = {
  version: 'static-live.broadcast-packet/v0.1',
  event: { id: 'impact-makers-demo', title: 'Sunday Service', synthetic: true },
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
const plan = compileBroadcastPlan(packet);
const allScenes = ['Standby', 'Wide', 'Speaker', 'Scripture', 'Fallback'].map((sceneName) => ({ sceneName }));

function fakeObs(script, calls = []) {
  const queues = new Map(Object.entries(script).map(([key, value]) => [key, Array.isArray(value) ? [...value] : [value]]));
  return {
    calls,
    async request(type, data = {}) {
      calls.push({ type, data });
      const queue = queues.get(type);
      if (!queue || queue.length === 0) throw new Error(`unexpected OBS request: ${type}`);
      const value = queue.length > 1 ? queue.shift() : queue[0];
      if (value instanceof Error) throw value;
      return structuredClone(value ?? {});
    },
  };
}

function readyScript(extra = {}) {
  return {
    GetSceneCollectionList: { currentSceneCollectionName: 'Impact Makers', sceneCollections: ['Impact Makers'] },
    GetSceneList: { currentProgramSceneName: 'Standby', scenes: allScenes },
    GetRecordStatus: { outputActive: false },
    GetStreamStatus: { outputActive: false },
    ...extra,
  };
}

async function preflightController(obs) {
  const controller = createBroadcastController({ plan, obs });
  await controller.preflight();
  obs.calls.length = 0;
  return controller;
}

test('preflight requires declared scene collection and all required scenes', async () => {
  const obs = fakeObs(readyScript());
  const controller = createBroadcastController({ plan, obs });
  await controller.preflight();
  assert.equal(controller.getStatus().state, 'ready');
  assert.equal(controller.getStatus().currentScene, 'Standby');
});

test('preflight blocks on scene collection mismatch', async () => {
  const obs = fakeObs(readyScript({
    GetSceneCollectionList: { currentSceneCollectionName: 'Other', sceneCollections: ['Other', 'Impact Makers'] },
  }));
  const controller = createBroadcastController({ plan, obs });
  await assert.rejects(controller.preflight(), /scene collection/i);
  assert.equal(controller.getStatus().state, 'blocked');
});

test('GO LIVE starts and verifies recording before starting stream', async () => {
  const calls = [];
  const obs = fakeObs(readyScript({
    GetRecordStatus: [{ outputActive: false }, { outputActive: true }],
    GetStreamStatus: [{ outputActive: false }, { outputActive: true }],
    StartRecord: {},
    SetCurrentProgramScene: {},
    StartStream: {},
  }), calls);
  const controller = await preflightController(obs);
  await controller.goLive();
  assert.deepEqual(calls.map((call) => call.type), [
    'StartRecord',
    'GetRecordStatus',
    'SetCurrentProgramScene',
    'StartStream',
    'GetStreamStatus',
  ]);
  assert.equal(controller.getStatus().state, 'live');
  assert.equal(controller.getStatus().recording, true);
  assert.equal(controller.getStatus().stream, true);
});

test('stream-start failure preserves recording and enters recording_only', async () => {
  const obs = fakeObs(readyScript({
    GetRecordStatus: [{ outputActive: false }, { outputActive: true }],
    StartRecord: {},
    SetCurrentProgramScene: {},
    StartStream: new Error('stream failed'),
  }));
  const controller = await preflightController(obs);
  await assert.rejects(controller.goLive(), /stream failed/);
  assert.equal(controller.getStatus().state, 'recording_only');
  assert.equal(controller.getStatus().recording, true);
  assert.equal(controller.getStatus().stream, false);
});

test('scene changes accept packet ids and reject arbitrary OBS scene names', async () => {
  const calls = [];
  const obs = fakeObs(readyScript({
    GetRecordStatus: [{ outputActive: false }, { outputActive: true }],
    GetStreamStatus: [{ outputActive: false }, { outputActive: true }],
    StartRecord: {}, SetCurrentProgramScene: [{}, {}], StartStream: {},
  }), calls);
  const controller = await preflightController(obs);
  await controller.goLive();
  calls.length = 0;
  await controller.changeScene('speaker');
  assert.deepEqual(calls, [{ type: 'SetCurrentProgramScene', data: { sceneName: 'Speaker' } }]);
  await assert.rejects(() => controller.changeScene('Not In Packet'), /undeclared scene/);
});

test('END stops stream before recording and emits preserved receipt', async () => {
  const calls = [];
  const obs = fakeObs(readyScript({
    GetRecordStatus: [{ outputActive: false }, { outputActive: true }, { outputActive: false }],
    GetStreamStatus: [{ outputActive: false }, { outputActive: true }, { outputActive: false }],
    StartRecord: {}, SetCurrentProgramScene: {}, StartStream: {},
    StopStream: {}, StopRecord: { outputPath: '/recordings/service.mkv' },
  }), calls);
  const controller = await preflightController(obs);
  await controller.goLive();
  calls.length = 0;
  const receipt = await controller.endAndPreserve();
  assert.deepEqual(calls.map((call) => call.type), [
    'StopStream',
    'GetStreamStatus',
    'StopRecord',
    'GetRecordStatus',
  ]);
  assert.equal(receipt.disposition, 'preserved');
  assert.equal(receipt.recordingOutputPath, '/recordings/service.mkv');
  assert.equal(controller.getStatus().state, 'preserved');
});

test('recording-only session ends truthfully without claiming a stream', async () => {
  const obs = fakeObs(readyScript({
    GetRecordStatus: [{ outputActive: false }, { outputActive: true }, { outputActive: false }],
    StartRecord: {}, SetCurrentProgramScene: {}, StartStream: new Error('network down'),
    StopRecord: { outputPath: '/recordings/offline.mkv' },
  }));
  const controller = await preflightController(obs);
  await assert.rejects(controller.goLive(), /network down/);
  const receipt = await controller.endAndPreserve();
  assert.equal(receipt.started.recording, true);
  assert.equal(receipt.started.stream, false);
  assert.equal(receipt.disposition, 'recording_only');
});
