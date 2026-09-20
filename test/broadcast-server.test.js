import test from 'node:test';
import assert from 'node:assert/strict';
import { compileBroadcastPlan } from '../src/broadcast-compiler.js';
import { createBroadcastServer } from '../src/broadcast-server.js';

const plan = compileBroadcastPlan({
  version: 'static-live.broadcast-packet/v0.1',
  event: { id: 'impact-makers-demo', title: 'Sunday Service — Synthetic Demo', synthetic: true },
  obs: {
    url: 'ws://127.0.0.1:4455', sceneCollection: 'Impact Makers', standbyScene: 'Standby', fallbackScene: 'Fallback',
    allowedScenes: [
      { id: 'wide', label: 'Wide', obsSceneName: 'Wide' },
      { id: 'speaker', label: 'Speaker', obsSceneName: 'Speaker' },
      { id: 'scripture', label: 'Scripture', obsSceneName: 'Scripture' },
    ],
  },
  recording: { requiredBeforeStream: true },
  stream: { enabled: true },
});

function fakeController(calls = []) {
  return {
    calls,
    getStatus() { return { state: 'ready', recording: false, stream: false, currentScene: 'Standby', fault: null }; },
    async goLive() { calls.push(['goLive']); return { state: 'live' }; },
    async changeScene(sceneId) { calls.push(['changeScene', sceneId]); return { state: 'live', currentScene: plan.scenes[sceneId]?.obsSceneName }; },
    async endAndPreserve() { calls.push(['endAndPreserve']); return { version: 'static-live.broadcast-receipt/v0.1', disposition: 'preserved' }; },
  };
}

async function withServer(controller, fn) {
  const server = createBroadcastServer({ controller, plan, port: 0 });
  const address = await server.start();
  try { await fn(address); } finally { await server.stop(); }
}

test('server binds loopback and status exposes no secrets', async () => {
  await withServer(fakeController(), async (address) => {
    assert.equal(address.host, '127.0.0.1');
    const response = await fetch(`${address.url}/api/status`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(JSON.stringify(body).includes('password'), false);
    assert.equal(JSON.stringify(body).includes('streamKey'), false);
    assert.equal(body.event.title, 'Sunday Service — Synthetic Demo');
  });
});

test('scene endpoint passes only declared scene ids to controller', async () => {
  const calls = [];
  await withServer(fakeController(calls), async (address) => {
    const response = await fetch(`${address.url}/api/scene/speaker`, { method: 'POST' });
    assert.equal(response.status, 200);
    assert.deepEqual(calls, [['changeScene', 'speaker']]);

    const rejected = await fetch(`${address.url}/api/scene/Not%20In%20Packet`, { method: 'POST' });
    assert.equal(rejected.status, 404);
    assert.deepEqual(calls, [['changeScene', 'speaker']]);
  });
});

test('GO LIVE and END routes delegate once', async () => {
  const calls = [];
  await withServer(fakeController(calls), async (address) => {
    assert.equal((await fetch(`${address.url}/api/live`, { method: 'POST' })).status, 200);
    assert.equal((await fetch(`${address.url}/api/end`, { method: 'POST' })).status, 200);
    assert.deepEqual(calls, [['goLive'], ['endAndPreserve']]);
  });
});

test('operator page exposes only the three primary controls plus declared scenes', async () => {
  await withServer(fakeController(), async (address) => {
    const html = await (await fetch(address.url)).text();
    assert.match(html, /GO LIVE/);
    assert.match(html, /END \+ PRESERVE/);
    assert.match(html, /Speaker/);
    assert.doesNotMatch(html, /password/i);
    assert.doesNotMatch(html, /stream key/i);
  });
});

test('HOUSE identity exposes only a descriptive local console contract', async () => {
  await withServer(fakeController(), async (address) => {
    const identityResponse = await fetch(`${address.url}/api/house/identity`);
    assert.equal(identityResponse.status, 200);
    assert.deepEqual(await identityResponse.json(), {
      service: 'static-live.broadcast',
      contract: 'static-live.broadcast-house-door/v0.1',
      consolePath: '/',
      eventId: 'impact-makers-demo',
    });
    const statusResponse = await fetch(`${address.url}/api/status`);
    assert.equal(statusResponse.status, 200);
    assert.equal((await statusResponse.json()).event.id, 'impact-makers-demo');
  });
});

test('human attention routes only to a selected private mark, not OBS', async () => {
  const calls=[];
  const markId='00000000-0000-4000-8000-000000000001';
  const markerBook={
    attend(payload){calls.push(['attend',payload]);return {id:'00000000-0000-4000-8000-000000000002',...payload};}
  };
  const server=createBroadcastServer({controller:fakeController(calls),plan,markerBook,port:0});
  const address=await server.start();
  try{
    const html=await (await fetch(address.url)).text();
    assert.match(html,/data-value="joyful"/);
    assert.match(html,/data-value="curiouser"/);
    const payload={markId,dimensions:['joyful','curiouser'],explicitNone:false,expectedPreviousId:null};
    const saved=await fetch(address.url+'/api/moment/attention',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    assert.equal(saved.status,200);
    assert.deepEqual((await saved.json()).declaration.dimensions,['joyful','curiouser']);
    assert.deepEqual(calls,[['attend',payload]]);
    const refused=await fetch(address.url+'/api/moment/attention',{
      method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(payload)});
    assert.equal(refused.status,403);
    const wrongOrigin=await fetch(address.url+'/api/moment/attention',{
      method:'POST',headers:{'Content-Type':'application/json',Origin:'https://unrelated.example'},
      body:JSON.stringify(payload)});
    assert.equal(wrongOrigin.status,403);
    const unknown=await fetch(address.url+'/api/moment/attention',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({...payload,extra:'not allowed'})});
    assert.equal(unknown.status,422);
    assert.deepEqual(calls,[['attend',payload]]);
  }finally{await server.stop();}
});

test('source-owned Attention Crossing handoff is exposed only after a declaration', async () => {
  const server=createBroadcastServer({controller:fakeController(),plan,
    markerBook:{attend(){ throw Error('not called'); }},port:0});
  const address=await server.start();
  try{
    const html=await (await fetch(address.url)).text();
    assert.match(html,/id="attention-export" type="button" disabled/);
    assert.match(html,/source_app:'static-live'/);
    assert.match(html,/source_record_id:declaration.id/);
    assert.match(html,/source_target_id:declaration.markId/);
    assert.match(html,/source_previous_id:declaration.previousId/);
    assert.match(html,/source_recorded_at:declaration.createdAtUtc/);
    assert.match(html,/evidence:'source-export\/self-reported'/);
    assert.match(html,/Clipboard unavailable/);
  }finally{await server.stop();}
});
