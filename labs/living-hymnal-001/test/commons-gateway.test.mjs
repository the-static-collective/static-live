import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createSeed, decideSeed, recordSeedPermission, publishSong, replay } from '../src/core.mjs';
import { createCommonsMirror, signPublicJournal } from '../src/commons.mjs';
import { createCommonsGateway } from '../src/commons-gateway.mjs';

const tenant = 'sample-church';
const keys = generateKeyPairSync('ed25519', {
  publicKeyEncoding: { format: 'pem', type: 'spki' },
  privateKeyEncoding: { format: 'pem', type: 'pkcs8' }
});

function signedEdition(dir, title, edition) {
  const events = [];
  const add = event => (events.push(event), event);
  add(createSeed(tenant, { kind: 'prayer', body: 'PRIVATE_PRAYER_DO_NOT_COPY_1157',
    permissionToReview: true, authorizedSubmitter: true }));
  const seed = add(createSeed(tenant, { kind: 'lyric', body: 'A published song for the world',
    contributorAlias: 'PRIVATE_ALIAS_DO_NOT_COPY_1157',
    permissionToReview: true, authorizedSubmitter: true }));
  add(decideSeed(tenant, replay(events, tenant), seed.payload.id, 'ADMIT'));
  add(recordSeedPermission(tenant, replay(events, tenant), seed.payload.id,
    'PUBLIC_LYRICS_AND_INTERCHURCH', 'PRIVATE_RELEASE_DOC_1157'));
  add(publishSong(tenant, replay(events, tenant), {
    sourceSeedIds: [seed.payload.id], title, lyrics: 'A published song for the world',
    bpm: 92, meter: '4/4',
    pastoralApproved: true, rightsCleared: true,
    approvalNote: 'Synthetic manual pastoral review approval',
    rightsNote: 'Synthetic manual contributor and recording rights review',
    interchurchSharingApproved: true,
    sharingTerms: 'Synthetic approval for interchurch lyric distribution'
  }));
  const journal = join(dir, title.replace(/[^a-z]/ig, '_') + '.jsonl');
  writeFileSync(journal, events.map(x => JSON.stringify(x)).join('\n') + '\n');
  return signPublicJournal({ tenant, journalPath: journal, edition,
    privateKeyPem: keys.privateKey });
}
async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return 'http://127.0.0.1:' + server.address().port;
}
async function mirror(dir, id) {
  const app = createCommonsMirror({ tenant, dataDir: join(dir, id),
    trustedPublicKeyPem: keys.publicKey });
  return { id, app, url: await listen(app) };
}
const stop = app => new Promise(resolve => app.close(resolve));
async function post(node, snapshot) {
  const response = await fetch(node.url + '/replicate', { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(snapshot) });
  return response.status;
}
async function get(gatewayUrl) {
  const response = await fetch(gatewayUrl + '/api/' + tenant + '/songs');
  return { status: response.status, data: await response.json() };
}
const conf = (dir, nodes) => ({
  tenant, mirrors: nodes.map(x => ({ id: x.id, url: x.url })),
  trustedPublicKeyPem: keys.publicKey, receiptDir: join(dir, 'route-observations')
});

test('a public-only signed edition is available for independent verification', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'church-route-test-'));
  let node;
  try {
    node = await mirror(dir, 'mirror-a');
    assert.equal((await fetch(node.url + '/public-snapshot')).status, 503);
    const edition = signedEdition(dir, 'Public morning hymn', 2);
    assert.equal(await post(node, edition), 201);
    const response = await fetch(node.url + '/public-snapshot');
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body, edition);
    assert.equal(JSON.stringify(body).includes('PRIVATE_PRAYER_DO_NOT_COPY_1157'), false);
    assert.equal(JSON.stringify(body).includes('PRIVATE_RELEASE_DOC_1157'), false);
  } finally {
    if (node) await stop(node.app);
    rmSync(dir, { recursive: true, force: true });
  }
});

test('gateway independently verifies two public mirrors and routes after node A disappears', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'church-route-test-'));
  let a, b, gateway;
  try {
    a = await mirror(dir, 'mirror-a');
    b = await mirror(dir, 'mirror-b');
    const snap = signedEdition(dir, 'Shared public hymn', 5);
    assert.equal(await post(a, snap), 201);
    assert.equal(await post(b, snap), 201);
    const config = conf(dir, [a, b]);
    assert.throws(() => createCommonsGateway({ ...config,
      mirrors: [{ id: 'evil', url: 'http://example.org:8080' }] }), /loopback/);
    gateway = createCommonsGateway(config);
    const url = await listen(gateway);
    const first = await get(url);
    assert.equal(first.status, 200);
    assert.equal(first.data.fromMirror, 'mirror-a');
    assert.equal(first.data.verifiedOwnerSignature, true);
    await stop(a.app);
    a = null;
    const after = await get(url);
    assert.equal(after.status, 200);
    assert.equal(after.data.fromMirror, 'mirror-b');
    assert.deepEqual(after.data.songs, first.data.songs);
    assert.equal((await fetch(url + '/admin/seeds')).status, 404);
    const receiptDir = join(dir, 'route-observations');
    const receipts = readdirSync(receiptDir)
      .filter(s => s.endsWith('.json') && !s.endsWith('highest-seen.json'))
      .map(s => JSON.parse(readFileSync(join(receiptDir, s), 'utf8')));
    assert.ok(receipts.length >= 2);
    assert.ok(receipts.some(r => r.attempts.some(x =>
      x.nodeId === 'mirror-a' && x.status === 'unavailable-or-rejected')));
    assert.ok(receipts.every(r => r.penny === 'NO_CREDIT_OR_SETTLEMENT' && r.admission === 'NONE'));
    assert.ok(receipts.every(r => !JSON.stringify(r).includes('PRIVATE_PRAYER_DO_NOT_COPY_1157')));
    assert.ok(receipts.every(r => !JSON.stringify(r).includes('PRIVATE_ALIAS_DO_NOT_COPY_1157')));
  } finally {
    if (gateway) await stop(gateway);
    if (a) await stop(a.app);
    if (b) await stop(b.app);
    rmSync(dir, { recursive: true, force: true });
  }
});

test('gateway refuses stale fallback, persists its highest verified edition across restart', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'church-route-test-'));
  let a, b, gateway;
  try {
    a = await mirror(dir, 'mirror-a');
    b = await mirror(dir, 'mirror-b');
    const old = signedEdition(dir, 'Earlier hymn', 2);
    const newer = signedEdition(dir, 'Newer hymn', 3);
    assert.equal(await post(a, newer), 201);
    assert.equal(await post(b, old), 201);
    const config = conf(dir, [a, b]);
    gateway = createCommonsGateway(config);
    let url = await listen(gateway);
    assert.equal((await get(url)).data.edition, 3);
    await stop(a.app); a = null;
    const hold = await get(url);
    assert.equal(hold.status, 503);
    assert.equal(hold.data.status, 'HOLD');
    await stop(gateway);
    gateway = createCommonsGateway(config); // persisted watermark
    url = await listen(gateway);
    assert.equal((await get(url)).status, 503);
    assert.equal(await post(b, newer), 201);
    const restored = await get(url);
    assert.equal(restored.status, 200);
    assert.equal(restored.data.edition, 3);
  } finally {
    if (gateway) await stop(gateway);
    if (a) await stop(a.app);
    if (b) await stop(b.app);
    rmSync(dir, { recursive: true, force: true });
  }
});

test('competing owner-signed payloads with same edition are held, not arbitrarily selected', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'church-route-test-'));
  let a, b, gateway;
  try {
    a = await mirror(dir, 'mirror-a');
    b = await mirror(dir, 'mirror-b');
    assert.equal(await post(a, signedEdition(dir, 'Different A', 8)), 201);
    assert.equal(await post(b, signedEdition(dir, 'Different B', 8)), 201);
    gateway = createCommonsGateway(conf(dir, [a, b]));
    const url = await listen(gateway);
    const conflict = await get(url);
    assert.equal(conflict.status, 503);
    assert.match(conflict.data.reason, /Conflicting signed editions/);
  } finally {
    if (gateway) await stop(gateway);
    if (a) await stop(a.app);
    if (b) await stop(b.app);
    rmSync(dir, { recursive: true, force: true });
  }
});
