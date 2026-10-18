import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createSeed, replay, decideSeed, recordSeedPermission,
  publishSong, withdrawSong, toStaticLivePacket } from '../src/core.mjs';
import { createLeasedEdition, verifyLeasedEdition, createLeasedMirror } from '../src/commons-lease.mjs';
import { createCommonsMirror } from '../src/commons.mjs';
import { createCommonsGateway } from '../src/commons-gateway.mjs';
import { createApp } from '../src/server.mjs';

const tenant = 'sample-church';
const keys = generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});
function tmp() { return mkdtempSync(join(tmpdir(), 'church-commons-003-')); }
function pubEvents() {
  const events = [], add = e => (events.push(e), e);
  add(createSeed(tenant, { kind: 'prayer', body: 'PRIVATE_HOLD_NEVER_PUBLISH_731',
    permissionToReview: true, authorizedSubmitter: true }));
  const source = add(createSeed(tenant, { kind: 'lyric', body: 'Good morning to the open house',
    contributorAlias: 'AUTHOR_PRIVATE_731',
    permissionToReview: true, authorizedSubmitter: true }));
  add(decideSeed(tenant, replay(events, tenant), source.payload.id, 'ADMIT'));
  add(recordSeedPermission(tenant, replay(events, tenant), source.payload.id,
    'PUBLIC_LYRICS_AND_INTERCHURCH', 'SECRET_PERMISSION_REFERENCE_731'));
  const song = add(publishSong(tenant, replay(events, tenant), {
    sourceSeedIds: [source.payload.id], title: 'The Open House',
    lyrics: 'Good morning to the open house',
    bpm: 92, meter: '4/4', rightsCleared: true, pastoralApproved: true,
    rightsNote: 'Synthetic rights review clearance on this published song',
    approvalNote: 'Synthetic pastoral approval for published song',
    interchurchSharingApproved: true,
    sharingTerms: 'Synthetic nonexclusive interchurch text sharing permission'
  }));
  return { events, songId: song.song.id };
}
function saveJournal(dir, events) {
  const path = join(dir, tenant + '.jsonl');
  writeFileSync(path, events.map(x => JSON.stringify(x)).join('\n') + '\n');
  return path;
}
function edition(journal, revision, time, ttl = 10) {
  return createLeasedEdition({ tenant, journalPath: journal,
    edition: revision, privateKeyPem: keys.privateKey, nowMs: time, ttlSeconds: ttl });
}
async function listen(app) {
  app.listen(0, '127.0.0.1');
  await once(app, 'listening');
  return { app, url: 'http://127.0.0.1:' + app.address().port };
}
async function close(node) { if (node) await new Promise(done => node.app.close(done)); }
async function post(node, value) {
  const res = await fetch(node.url + '/replicate', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(value)
  });
  return { code: res.status, data: await res.json() };
}
async function api(node) {
  const response = await fetch(node.url + '/api/' + tenant + '/songs');
  return { code: response.status, data: await response.json() };
}

test('authorized church journal withdrawal removes release and blocks stage/export', () => {
  const { events, songId } = pubEvents();
  const first = replay(events, tenant);
  assert.equal(first.songs[0].status, 'PUBLISHED');
  const withdrawn = withdrawSong(tenant, first, songId, 'Approved song withdrawn at owner request');
  events.push(withdrawn);
  const result = replay(events, tenant);
  assert.equal(result.songs[0].status, 'WITHDRAWN');
  assert.throws(() => toStaticLivePacket(result.songs[0]), /unreleased/i);
  assert.throws(() => withdrawSong(tenant, result, songId, 'Already withdrawn'), /not actively published/i);
  assert.throws(() => withdrawSong('second-church', result, songId, 'Different authority'), /not actively published/i);
});

test('fresh signed replacement removes one published song; withdrawn reason stays private', async () => {
  const dir = tmp(), now = Date.now(), clock = () => now;
  let mirror;
  try {
    const { events, songId } = pubEvents();
    const journal = saveJournal(dir, events);
    const first = edition(journal, 1, now);
    const forged = structuredClone(first);
    forged.lease.body.expiresAt = new Date(now + 86400000).toISOString();
    assert.throws(() => verifyLeasedEdition(forged, tenant, keys.publicKey, now), /duration/i);
    const otherKey = generateKeyPairSync('ed25519', {
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' }
    });
    assert.throws(() => verifyLeasedEdition(first, tenant, otherKey.publicKey, now));
    assert.throws(() => createLeasedEdition({ tenant, journalPath: journal,
      edition: 1, ttlSeconds: 600, privateKeyPem: keys.privateKey }), /duration/i);

    mirror = await listen(createLeasedMirror({ tenant, dataDir: join(dir, 'mirror'),
      trustedPublicKeyPem: keys.publicKey, clock }));
    assert.equal((await post(mirror, first)).code, 201);
    assert.equal((await api(mirror)).data.songs.length, 1);
    assert.equal((await fetch(mirror.url + '/public-snapshot')).status, 404,
      'No legacy endpoint bypasses lease validation');

    events.push(withdrawSong(tenant, replay(events, tenant), songId,
      'PRIVATE_WITHDRAWAL_REASON_731'));
    saveJournal(dir, events);
    const withdrawn = edition(journal, 2, now);
    assert.equal(withdrawn.snapshot.payload.songs.length, 0);
    assert.deepEqual(withdrawn.lease.body.withdrawnSongIds, [songId]);
    assert.equal(JSON.stringify(withdrawn).includes('PRIVATE_WITHDRAWAL_REASON_731'), false);
    assert.equal(JSON.stringify(withdrawn).includes('AUTHOR_PRIVATE_731'), false);
    assert.equal(JSON.stringify(withdrawn).includes('PRIVATE_HOLD_NEVER_PUBLISH_731'), false);
    assert.equal((await post(mirror, withdrawn)).code, 201);
    assert.equal((await api(mirror)).data.songs.length, 0);
    assert.equal((await post(mirror, first)).code, 409, 'Old valid lease cannot roll back withdrawal');
    assert.equal((await post(mirror, withdrawn)).code, 200);
    const dupe = edition(journal, 2, now + 1000);
    assert.equal((await post(mirror, dupe)).code, 409, 'Same edition cannot extend its expiration');
  } finally {
    await close(mirror);
    rmSync(dir, { recursive: true, force: true });
  }
});

test('disconnected cooperating mirror may serve old approved text only until signed expiry', async () => {
  const dir = tmp();
  let node;
  try {
    let time = Date.now();
    const { events, songId } = pubEvents();
    const journal = saveJournal(dir, events);
    node = await listen(createLeasedMirror({ tenant, dataDir: join(dir, 'lease'),
      trustedPublicKeyPem: keys.publicKey, clock: () => time }));
    const first = edition(journal, 1, time, 3);
    assert.equal((await post(node, first)).code, 201);
    // Owner withdraws while mirror is deliberately kept offline from owner.
    events.push(withdrawSong(tenant, replay(events, tenant), songId,
      'The originating church withdraws permission'));
    saveJournal(dir, events);
    assert.equal((await api(node)).data.songs.length, 1,
      'No false promise of instantaneous off-network revocation');
    time += 3000;
    assert.equal((await api(node)).code, 503);
    assert.equal((await fetch(node.url + '/c/' + tenant)).status, 503);
    assert.equal((await fetch(node.url + '/public-bundle')).status, 503);
    await close(node); node = null;
    node = await listen(createLeasedMirror({ tenant, dataDir: join(dir, 'lease'),
      trustedPublicKeyPem: keys.publicKey, clock: () => time }));
    assert.equal((await api(node)).code, 503, 'Restart does not restore an expired license');
    const replacement = edition(journal, 2, time);
    assert.equal((await post(node, replacement)).code, 201);
    assert.equal((await api(node)).data.songs.length, 0);
  } finally {
    await close(node);
    rmSync(dir, { recursive: true, force: true });
  }
});

test('lease-enforcing gateway chooses healthy authorized mirrors and refuses expired ones', async () => {
  const dir = tmp();
  let mirrorA, mirrorB, gateway, legacy;
  try {
    let time = Date.now();
    const { events } = pubEvents();
    const journal = saveJournal(dir, events);
    mirrorA = await listen(createLeasedMirror({ tenant, dataDir: join(dir, 'a'),
      trustedPublicKeyPem: keys.publicKey, clock: () => time }));
    mirrorB = await listen(createLeasedMirror({ tenant, dataDir: join(dir, 'b'),
      trustedPublicKeyPem: keys.publicKey, clock: () => time }));
    const snapshot = edition(journal, 3, time, 5);
    assert.equal((await post(mirrorA, snapshot)).code, 201);
    assert.equal((await post(mirrorB, snapshot)).code, 201);
    gateway = await listen(createCommonsGateway({ tenant,
      mirrors: [{ id: 'mirror-a', url: mirrorA.url },
        { id: 'mirror-b', url: mirrorB.url }],
      requireLease: true, clock: () => time, receiptDir: join(dir, 'audit'),
      trustedPublicKeyPem: keys.publicKey }));
    assert.equal((await api(gateway)).data.fromMirror, 'mirror-a');
    await close(mirrorA); mirrorA = null;
    assert.equal((await api(gateway)).data.fromMirror, 'mirror-b');
    time += 5000;
    assert.equal((await api(gateway)).code, 503, 'Gateway fails closed on expired lease');
    // Old Commons 001 mirror deliberately has no timed grant: never route to it.
    legacy = await listen(createCommonsMirror({ tenant, dataDir: join(dir, 'legacy'),
      trustedPublicKeyPem: keys.publicKey }));
    const rejects = await listen(createCommonsGateway({ tenant,
      mirrors: [{ id: 'legacy', url: legacy.url }],
      requireLease: true, clock: () => time, receiptDir: join(dir, 'audit2'),
      trustedPublicKeyPem: keys.publicKey }));
    assert.equal((await api(rejects)).code, 503);
    await close(rejects);
  } finally {
    await close(gateway);
    await close(mirrorA);
    await close(mirrorB);
    await close(legacy);
    rmSync(dir, { recursive: true, force: true });
  }
});

test('withdrawal HTTP endpoint is tenant-token protected and public list stops showing song', async () => {
  const dir = tmp(), { events, songId } = pubEvents();
  let node;
  try {
    saveJournal(dir, events);
    node = await listen(createApp({ dataDir: dir,
      tenants: { [tenant]: { name: 'Synthetic Church' } },
      adminTokens: { [tenant]: 'testing-reviewer-token-of-adequate-length' },
      allowSubmissions: false }));
    const denied = await fetch(node.url + '/api/' + tenant + '/admin/withdraw', {
      method: 'POST', body: JSON.stringify({ songId, reason: 'Owner withdrawal' }) });
    assert.equal(denied.status, 401);
    const allowed = await fetch(node.url + '/api/' + tenant + '/admin/withdraw', {
      method: 'POST', headers: { authorization: 'Bearer testing-reviewer-token-of-adequate-length' },
      body: JSON.stringify({ songId, reason: 'Human reviewer withdrew the local release' }) });
    assert.equal(allowed.status, 200);
    assert.equal((await api(node)).data.songs.length, 0);
    const packet = await fetch(node.url + '/api/' + tenant + '/admin/stage/' + songId, {
      headers: { authorization: 'Bearer testing-reviewer-token-of-adequate-length' } });
    assert.equal(packet.status, 404);
  } finally {
    await close(node);
    rmSync(dir, { recursive: true, force: true });
  }
});
