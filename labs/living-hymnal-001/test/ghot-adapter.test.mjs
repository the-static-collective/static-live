import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { createSeed, replay, decideSeed, recordSeedPermission, publishSong } from '../src/core.mjs';
import { createLeasedEdition, createLeasedMirror } from '../src/commons-lease.mjs';
import { createCommonsGateway } from '../src/commons-gateway.mjs';

const tenant = 'sample-church';
const adapterPath = fileURLToPath(new URL('../ghot/status-adapter.mjs', import.meta.url));
const keys = generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});
async function start(app) {
  app.listen(0, '127.0.0.1');
  await once(app, 'listening');
  return { app, url: 'http://127.0.0.1:' + app.address().port };
}
const stop = n => new Promise(done => n.app.close(done));
async function callAdapter(url, opts = {}) {
  const child = spawn(process.execPath, [adapterPath], {
    env: { ...process.env, GHOT_EXTERNAL_CAPABILITY: 'church-commons.public-hymnal.lease-status',
      GHOT_COMMONS_GATEWAY_URL: url, GHOT_COMMONS_TENANT: tenant, ...opts },
    stdio: ['pipe', 'pipe', 'pipe']
  });
  let output = '', stderr = '';
  child.stdout.on('data', c => { output += c.toString(); });
  child.stderr.on('data', c => { stderr += c.toString(); });
  child.stdin.end('null');
  const [code] = await once(child, 'close');
  return { code, result: output ? JSON.parse(output) : null, stderr };
}
function makeJournal(dir) {
  const events = [], add = x => (events.push(x), x);
  add(createSeed(tenant, { kind: 'prayer', body: 'SECRET_PRAYER_MUST_NOT_TRAVEL_345',
    permissionToReview: true, authorizedSubmitter: true }));
  const seed = add(createSeed(tenant, { kind: 'lyric', body: 'A shining hymn for the morning',
    permissionToReview: true, authorizedSubmitter: true }));
  add(decideSeed(tenant, replay(events, tenant), seed.payload.id, 'ADMIT'));
  add(recordSeedPermission(tenant, replay(events, tenant), seed.payload.id,
    'PUBLIC_LYRICS_AND_INTERCHURCH', 'SECRET_RIGHTS_REF_MUST_NOT_TRAVEL_345'));
  add(publishSong(tenant, replay(events, tenant), {
    sourceSeedIds: [seed.payload.id], title: 'GHoT Commons Public Test',
    lyrics: 'A shining hymn for the morning',
    bpm: 92, meter: '4/4', pastoralApproved: true, rightsCleared: true,
    approvalNote: 'Synthetic explicit human pastoral review for a test',
    rightsNote: 'Synthetic explicit rights clearance review for a test',
    interchurchSharingApproved: true,
    sharingTerms: 'Synthetic permission for church-to-church sharing'
  }));
  const journal = join(dir, 'sample-church.jsonl');
  writeFileSync(journal, events.map(x => JSON.stringify(x)).join('\n') + '\n');
  return journal;
}

test('GHoT external adapter reads the strict local gateway and emits no song text', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'church-commons-ghot-'));
  let mirror, gateway;
  try {
    let time = Date.now();
    const journalPath = makeJournal(dir);
    const bundle = createLeasedEdition({ tenant, journalPath, edition: 1,
      privateKeyPem: keys.privateKey, nowMs: time, ttlSeconds: 10 });
    mirror = await start(createLeasedMirror({ tenant,
      dataDir: join(dir, 'mirror'), trustedPublicKeyPem: keys.publicKey, clock: () => time }));
    const replicated = await fetch(mirror.url + '/replicate', {
      method: 'POST', body: JSON.stringify(bundle) });
    assert.equal(replicated.status, 201);
    gateway = await start(createCommonsGateway({ tenant, requireLease: true,
      mirrors: [{ id: 'mirror-a', url: mirror.url }],
      receiptDir: join(dir, 'audit'), trustedPublicKeyPem: keys.publicKey,
      clock: () => time }));
    const available = await callAdapter(gateway.url);
    assert.equal(available.code, 0, available.stderr);
    assert.equal(available.result.status, 'AVAILABLE');
    assert.equal(available.result.publicSongCount, 1);
    assert.equal(available.result.mirror, 'mirror-a');
    const observed = JSON.stringify(available.result);
    for (const privateValue of ['A shining hymn for the morning',
      'SECRET_PRAYER_MUST_NOT_TRAVEL_345',
      'SECRET_RIGHTS_REF_MUST_NOT_TRAVEL_345'])
      assert.equal(observed.includes(privateValue), false);
    const malicious = await callAdapter(gateway.url, {
      GHOT_EXTERNAL_CAPABILITY: 'system.hash' });
    assert.notEqual(malicious.code, 0, 'Only declared capability can execute');
    const publicUrl = await callAdapter('https://example.com:443');
    assert.notEqual(publicUrl.code, 0, 'External URLs are refused without network access');
    time += 10000;
    const expired = await callAdapter(gateway.url);
    assert.equal(expired.code, 0);
    assert.equal(expired.result.status, 'HOLD');
    assert.equal(expired.result.publicSongCount, undefined);
  } finally {
    if (gateway) await stop(gateway);
    if (mirror) await stop(mirror);
    rmSync(dir, { recursive: true, force: true });
  }
});
