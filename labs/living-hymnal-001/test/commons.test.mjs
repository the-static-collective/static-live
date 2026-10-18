import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createSeed, decideSeed, recordSeedPermission, publishSong, replay } from '../src/core.mjs';
import { createCommonsMirror, signPublicJournal, verifyPublicEnvelope } from '../src/commons.mjs';

const tenant = 'sample-church';
const keys = generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

function history({ share = true } = {}) {
  const events = [];
  function add(event) { events.push(event); return event; }
  add(createSeed(tenant, { kind: 'prayer', body: 'PRIVATE_HOLD_13579864',
    authorizedSubmitter: true, permissionToReview: true }));
  const source = add(createSeed(tenant, { kind: 'lyric',
    body: 'Approved and published worship song',
    contributorAlias: 'AUTHOR_ALIAS_PRIVATE_1357',
    authorizedSubmitter: true, permissionToReview: true }));
  add(decideSeed(tenant, replay(events, tenant), source.payload.id, 'ADMIT'));
  add(recordSeedPermission(tenant, replay(events, tenant), source.payload.id,
    share ? 'PUBLIC_LYRICS_AND_INTERCHURCH' : 'PUBLIC_LYRICS',
    'DOCUMENT_REF_PRIVATE_1357'));
  add(publishSong(tenant, replay(events, tenant), {
    title: '<img src=x onerror=alert(1)> Test Hymn', lyrics: 'Our song of light and morning',
    sourceSeedIds: [source.payload.id], bpm: 92, meter: '4/4',
    pastoralApproved: true, rightsCleared: true,
    approvalNote: 'Human pastoral decision recorded here',
    rightsNote: 'Human rights review recorded here',
    interchurchSharingApproved: share,
    ...(share ? { sharingTerms: 'Contributor grants sharing between congregations' } : {})
  }));
  return events;
}
function fixture(events) {
  const dir = mkdtempSync(join(tmpdir(), 'commons-test-'));
  const journal = join(dir, 'events.jsonl');
  writeFileSync(journal, events.map(x => JSON.stringify(x)).join('\n') + '\n');
  return { dir, journal };
}
const createEnvelope = (journal, edition = 1) =>
  signPublicJournal({ tenant, journalPath: journal, edition,
    privateKeyPem: keys.privateKey });
async function startMirror(dir) {
  const app = createCommonsMirror({ tenant, dataDir: join(dir, 'mirror'),
    trustedPublicKeyPem: keys.publicKey });
  app.listen(0, '127.0.0.1');
  await once(app, 'listening');
  return { app, root: 'http://127.0.0.1:' + app.address().port };
}
const close = app => new Promise(done => app.close(done));

test('only interchurch-approved lyrics cross; neither HOLD nor author nor permission record leaks', () => {
  const f = fixture(history());
  const local = fixture(history({ share: false }));
  try {
    const envelope = createEnvelope(f.journal);
    const serialized = JSON.stringify(envelope);
    assert.equal(envelope.payload.songs.length, 1);
    for (const forbidden of ['PRIVATE_HOLD_13579864', 'AUTHOR_ALIAS_PRIVATE_1357',
      'DOCUMENT_REF_PRIVATE_1357', 'sourceSeedIds', 'stems', 'cues'])
      assert.equal(serialized.includes(forbidden), false);
    assert.equal(createEnvelope(local.journal).payload.songs.length, 0);
    assert.equal(verifyPublicEnvelope(envelope, tenant, keys.publicKey).songs.length, 1);
    assert.throws(() => verifyPublicEnvelope(envelope, 'other-church', keys.publicKey), /payload/);
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
    rmSync(local.dir, { recursive: true, force: true });
  }
});

test('independent public mirror verifies signatures, blocks tampering, rollback and edition conflict', async () => {
  const f = fixture(history());
  const { app, root } = await startMirror(f.dir);
  try {
    const snapshot = createEnvelope(f.journal, 2);
    const post = async body => {
      const res = await fetch(root + '/replicate', { method: 'POST',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      return { status: res.status, data: await res.json() };
    };
    const unavailable = await fetch(root + '/api/' + tenant + '/songs');
    assert.equal(unavailable.status, 503);
    const altered = structuredClone(snapshot);
    altered.payload.songs[0].lyrics = 'Tampered by stranger';
    assert.equal((await post(altered)).status, 400);
    const otherKeys = generateKeyPairSync('ed25519', {
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' }
    });
    const forged = signPublicJournal({ tenant, journalPath: f.journal,
      edition: 2, privateKeyPem: otherKeys.privateKey });
    assert.equal((await post(forged)).status, 400);
    assert.equal((await post(snapshot)).status, 201);
    assert.equal((await post(snapshot)).data.status, 'ALREADY_MIRRORED');
    assert.equal((await post(createEnvelope(f.journal, 1))).status, 409);
    const conflictEvents = history();
    writeFileSync(f.journal, conflictEvents.map(e => JSON.stringify(e)).join('\n') + '\n');
    assert.equal((await post(createEnvelope(f.journal, 2))).status, 409);
    const list = await (await fetch(root + '/api/' + tenant + '/songs')).json();
    assert.equal(list.songs.length, 1);
    const html = await (await fetch(root + '/c/' + tenant)).text();
    assert.match(html, /&lt;img/);
    assert.equal(html.includes('<img src=x'), false);
    assert.equal((await fetch(root + '/admin/seeds')).status, 404);
  } finally {
    await close(app);
    rmSync(f.dir, { recursive: true, force: true });
  }
});

test('public signed snapshot cold-restores from disk, but never contains owner journal', async () => {
  const f = fixture(history());
  let running = await startMirror(f.dir);
  try {
    const snapshot = createEnvelope(f.journal, 4);
    assert.equal((await fetch(running.root + '/replicate', { method: 'POST',
      body: JSON.stringify(snapshot) })).status, 201);
    await close(running.app);
    running = await startMirror(f.dir);
    const out = await (await fetch(running.root + '/api/' + tenant + '/songs')).json();
    assert.equal(out.songs.length, 1);
    assert.equal(out.edition, 4);
    const badDir = join(f.dir, 'attacker-replacement');
    mkdirSync(badDir);
    assert.throws(() => createCommonsMirror({ tenant, dataDir: join(f.dir, 'mirror'),
      trustedPublicKeyPem: generateKeyPairSync('ed25519', {
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      }).publicKey }), /Untrusted/);
  } finally {
    await close(running.app);
    rmSync(f.dir, { recursive: true, force: true });
  }
});

test('three separate processes prove origin loss and mirror restart end-to-end', async () => {
  const filename = fileURLToPath(new URL('../scripts/commons-demo.mjs', import.meta.url));
  const { stdout } = await promisify(execFile)(process.execPath, [filename], { timeout: 20000 });
  assert.match(stdout, /PASS: origin down/);
});
