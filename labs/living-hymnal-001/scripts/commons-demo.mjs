// CHURCH COMMONS 001
// Proof: 3 independent loopback processes, two signed mirrors, origin disappears,
// mirror restarts from disk. All names and song text are synthetic.
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { createSeed, decideSeed, recordSeedPermission, publishSong, replay } from '../src/core.mjs';
import { signPublicJournal } from '../src/commons.mjs';

const tenant = 'sample-church';
const nodeScript = join(dirname(fileURLToPath(import.meta.url)), 'commons-node.mjs');
const work = mkdtempSync(join(tmpdir(), 'church-commons-001-'));
const originDir = join(work, 'owner');
const mirrorADir = join(work, 'mirror-a');
const mirrorBDir = join(work, 'mirror-b');
const children = new Set();
for (const dir of [originDir, mirrorADir, mirrorBDir]) mkdirSync(dir, { recursive: true });

function syntheticHistory() {
  const events = [];
  function add(e) { events.push(e); return e; }
  // Deliberately private HOLD: this text may NEVER enter any mirror.
  add(createSeed(tenant, { kind: 'prayer', body: 'PRIVATE_HOLD_ONLY_NEVER_REPLICATE_7621',
    authorizedSubmitter: true, permissionToReview: true, contributorAlias: 'Private contributor' }));
  function publish({ title, lyrics, share }) {
    const seed = add(createSeed(tenant, { kind: 'lyric', body: lyrics,
      authorizedSubmitter: true, permissionToReview: true,
      contributorAlias: 'PERSONAL_ALIAS_NEVER_REPLICATE' }));
    add(decideSeed(tenant, replay(events, tenant), seed.payload.id, 'ADMIT'));
    add(recordSeedPermission(tenant, replay(events, tenant), seed.payload.id,
      share ? 'PUBLIC_LYRICS_AND_INTERCHURCH' : 'PUBLIC_LYRICS',
      share ? 'synthetic-shared-approval-record-01' : 'synthetic-local-approval-record-02'));
    add(publishSong(tenant, replay(events, tenant), {
      sourceSeedIds: [seed.payload.id], title, lyrics, bpm: 92, meter: '4/4',
      pastoralApproved: true, rightsCleared: true,
      approvalNote: 'Synthetic authorized human pastoral review',
      rightsNote: 'Synthetic explicitly documented rights review',
      interchurchSharingApproved: share,
      ...(share ? { sharingTerms: 'Synthetic nonexclusive interchurch text sharing permission' } : {})
    }));
  }
  publish({ title: 'Commons Morning', lyrics: 'The morning opens like a promise', share: true });
  publish({ title: 'Local Church Only', lyrics: 'A private-to-our-local-public song', share: false });
  return events;
}

function start(mode, dataDir, publicFile) {
  return new Promise((resolve, reject) => {
    const child = fork(nodeScript, [mode], {
      execArgv: [],
      env: { ...process.env, COMMONS_DATA_DIR: dataDir,
        COMMONS_TRUSTED_KEY_FILE: publicFile },
      stdio: ['ignore', 'inherit', 'inherit', 'ipc']
    });
    children.add(child);
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('Node did not start: ' + mode));
    }, 10000);
    const onExit = code => {
      clearTimeout(timeout);
      reject(new Error('Node exited before listening: ' + mode + ' (' + code + ')'));
    };
    child.once('exit', onExit);
    child.once('message', msg => {
      if (!msg?.ready) return;
      clearTimeout(timeout);
      child.off('exit', onExit);
      resolve({ child, port: msg.port,
        url: 'http://127.0.0.1:' + msg.port });
    });
  });
}
async function stop(node) {
  if (!node || node.child.exitCode !== null) return;
  const exited = once(node.child, 'exit');
  node.child.kill('SIGTERM');
  await exited;
}
async function json(url, options) {
  const response = await fetch(url, options);
  return { status: response.status, data: await response.json() };
}

try {
  const events = syntheticHistory();
  const journal = join(originDir, tenant + '.jsonl');
  writeFileSync(journal, events.map(e => JSON.stringify(e)).join('\n') + '\n', { mode: 0o600 });
  const keys = generateKeyPairSync('ed25519', {
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' }
  });
  const publicFile = join(work, 'pinned-owner-public.pem');
  writeFileSync(publicFile, keys.publicKey, { mode: 0o600 });

  const owner = await start('owner', originDir, publicFile);
  let mirrorA = await start('mirror', mirrorADir, publicFile);
  let mirrorB = await start('mirror', mirrorBDir, publicFile);
  const ownerList = await json(owner.url + '/api/' + tenant + '/songs');
  assert.equal(ownerList.status, 200);
  assert.equal(ownerList.data.songs.length, 2, 'Origin keeps local and shared releases');

  const envelope = signPublicJournal({ tenant, journalPath: journal,
    edition: events.length, privateKeyPem: keys.privateKey });
  assert.equal(envelope.payload.songs.length, 1, 'Only explicitly interchurch-licensed releases cross');
  assert.ok(!JSON.stringify(envelope).includes('PRIVATE_HOLD_ONLY_NEVER_REPLICATE_7621'));
  assert.ok(!JSON.stringify(envelope).includes('PERSONAL_ALIAS_NEVER_REPLICATE'));
  assert.ok(!JSON.stringify(envelope).includes('synthetic-shared-approval-record'));
  assert.ok(!JSON.stringify(envelope).includes('Local Church Only'));

  for (const mirror of [mirrorA, mirrorB]) {
    const result = await json(mirror.url + '/replicate', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(envelope)
    });
    assert.equal(result.status, 201, 'Mirror independently checks owner signature');
  }
  await stop(owner);
  const a = await json(mirrorA.url + '/api/' + tenant + '/songs');
  const b = await json(mirrorB.url + '/api/' + tenant + '/songs');
  assert.equal(a.data.songs.length, 1);
  assert.deepEqual(a.data.songs, b.data.songs);
  const page = await fetch(mirrorA.url + '/c/' + tenant);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Commons Morning/);

  // Simulated power cycle: B is a new process reading its own signed disk copy.
  await stop(mirrorB);
  mirrorB = await start('mirror', mirrorBDir, publicFile);
  await stop(mirrorA);
  const recovered = await json(mirrorB.url + '/api/' + tenant + '/songs');
  assert.equal(recovered.status, 200);
  assert.deepEqual(recovered.data.songs, b.data.songs);
  process.stdout.write('PASS: origin down; two signed public mirrors survive; ' +
    'mirror B cold-restores from its own disk; private/local-only data did not cross.\n');
} finally {
  await Promise.all([...children].map(async child => {
    if (child.exitCode !== null) return;
    const exited = once(child, 'exit');
    child.kill('SIGTERM');
    await exited;
  }));
  rmSync(work, { recursive: true, force: true });
}
