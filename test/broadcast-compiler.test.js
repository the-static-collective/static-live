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

test('compiler refuses standby/fallback collisions with operator scenes', () => {
  const changed = structuredClone(packet);
  changed.obs.standbyScene = 'Wide';
  assert.throws(() => compileBroadcastPlan(changed), /must not collide/);
});

test('compiler requires recording before streaming', () => {
  const changed = structuredClone(packet);
  changed.recording.requiredBeforeStream = false;
  assert.throws(() => compileBroadcastPlan(changed), /recording.*required/i);
});
