import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createApp } from '../src/server.mjs';

test('church-scoped HTTP intake: anonymous HOLD, protected review, explicit release', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'living-hymnal-'));
  const token = 'local-review-key-for-sample-church-123456789';
  const app = createApp({ dataDir: dir,
    tenants: { 'sample-church': { name: 'Sample Church' }, 'second-church': { name: 'Second Church' } },
    adminTokens: { 'sample-church': token }, allowSubmissions: true });
  app.listen(0, '127.0.0.1');
  await once(app, 'listening');
  const root = 'http://127.0.0.1:' + app.address().port;
  const at = path => root + '/api/sample-church/' + path;
  const headers = { authorization: 'Bearer ' + token, 'content-type': 'application/json' };
  const post = (path, body, authorized = false) => fetch(at(path), { method: 'POST',
    headers: authorized ? headers : { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  try {
    const rejectedCrossOrigin = await fetch(at('seeds'), { method: 'POST',
      headers: { origin: 'https://attacker.example', 'content-type': 'application/json' },
      body: JSON.stringify({}) });
    assert.equal(rejectedCrossOrigin.status, 403);
    const made = await post('seeds', { kind: 'lyric', body: 'I bring this little seed before you',
      permissionToReview: true, authorizedSubmitter: true, contributorAlias: 'Someone' });
    assert.equal(made.status, 201);
    const seedId = (await made.json()).id;
    assert.equal((await (await fetch(at('songs'))).json()).songs.length, 0);
    assert.equal((await fetch(at('admin/seeds'))).status, 401);
    const read = await fetch(at('admin/seeds'), { headers });
    const state = await read.json();
    assert.equal(state.seeds[0].status, 'HOLD');
    assert.equal(state.seeds[0].id, seedId);
    assert.equal((await (await fetch(root + '/api/second-church/songs')).json()).songs.length, 0);
    const admit = await post('admin/decision', { seedId, decision: 'ADMIT' }, true);
    assert.equal(admit.status, 200);
    const premature = await post('admin/publish', {
      sourceSeedIds: [seedId], title: 'Seed Becoming Song', lyrics: 'I bring this little seed before you',
      bpm: 92, meter: '4/4', pastoralApproved: true, rightsCleared: true,
      approvalNote: 'Human worship leader explicitly approved this release',
      rightsNote: 'Rights and permissions were manually reviewed'
    }, true);
    assert.equal(premature.status, 400);
    const consent = await post('admin/permission', {
      seedId, scope: 'PUBLIC_LYRICS_AND_INTERCHURCH', recordRef: 'signed-permission-reference-001'
    }, true);
    assert.equal(consent.status, 200);
    const publish = await post('admin/publish', {
      sourceSeedIds: [seedId], title: 'Seed Becoming Song', lyrics: 'I bring this little seed before you',
      bpm: 92, meter: '4/4', pastoralApproved: true, rightsCleared: true,
      approvalNote: 'Human worship leader explicitly approved this release',
      rightsNote: 'Rights and permissions were manually reviewed',
      interchurchSharingApproved: true,
      sharingTerms: 'The author grants nonexclusive interchurch lyric sharing permission',
      requiredCapabilities: ['lead-vocal.live', 'guitar.live'], stems: [], cues: {}
    }, true);
    assert.equal(publish.status, 201);
    const songId = (await publish.json()).songId;
    const publishedList = (await (await fetch(at('songs'))).json()).songs;
    assert.equal(publishedList.length, 1);
    assert.equal(JSON.stringify(publishedList).includes('Someone'), false);
    assert.equal((await fetch(at('admin/stage/' + songId), { headers })).status, 200);
    const relatte = await fetch(at('admin/relatte/' + songId), { headers });
    assert.equal((await relatte.json()).schema, 'relatte.opaque-organ-spec/v0');
    const bundle = (await (await fetch(at('admin/bundle/' + songId), { headers })).json());
    assert.equal(bundle.schema, 'living-hymnal.relatte-export/v0.1');
    assert.equal(bundle.spec.payload_refs[0].address, (await (await fetch(at('admin/relatte/' + songId), { headers })).json()).payload_refs[0].address);
    assert.ok(!JSON.stringify(bundle).includes('Someone'));
    assert.ok(!JSON.stringify(bundle).includes('signed-permission-reference-001'));
    assert.equal((await (await fetch(at('integration'))).json()).adapters.tithely.actionType, 'Web Page');
  } finally {
    await new Promise(resolve => app.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});
