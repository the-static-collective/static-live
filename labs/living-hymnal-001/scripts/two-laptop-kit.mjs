#!/usr/bin/env node
// Church Commons 005 — synthetic two-laptop kit, loopback only.
// Physical-machine connectivity requires independently authorized SSH forwarding.
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, renameSync, unlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createSeed, replay, decideSeed, recordSeedPermission, publishSong, withdrawSong } from '../src/core.mjs';
import { createLeasedEdition, createLeasedMirror, verifyLeasedEdition } from '../src/commons-lease.mjs';
import { createCommonsGateway } from '../src/commons-gateway.mjs';

const TENANT = 'sample-church', TTL = 300;
const help = [
  'Church Commons 005 (Node 22+, synthetic data only):',
  '  init <owner-dir>',
  '  issue <owner-dir> [ttlSeconds 1..300]',
  '  withdraw <owner-dir>',
  '  verify <public-key.pem> <public-edition.json>',
  '  mirror <mirror-dir> <public-key.pem> <port>',
  '  gateway <gateway-dir> <public-key.pem> <gateway-port> <mirror-a-port> <mirror-b-port>',
  '  publish <owner-dir> <port> [more-ports...]',
  '  check <port>'
].join('\n');
function directory(raw) {
  if (!raw) throw Error('Directory required');
  const d = resolve(raw);
  mkdirSync(d, { recursive: true, mode: 0o700 });
  return d;
}
function pnum(raw) {
  if (!/^\d{4,5}$/.test(String(raw))) throw Error('Explicit port 1024–65535 required');
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1024 || n > 65535) throw Error('Invalid port');
  return n;
}
const journal = d => join(d, TENANT + '.jsonl');
const readEvents = d => readFileSync(journal(d), 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const json = file => JSON.parse(readFileSync(file, 'utf8'));
function atomic(file, value) {
  const next = file + '.pending-' + process.pid;
  writeFileSync(next, value, { flag: 'wx', mode: 0o600 });
  renameSync(next, file);
}
function initialized(d) {
  for (const f of ['owner-private.pem', 'owner-public.pem', TENANT + '.jsonl']) {
    if (!existsSync(join(d, f))) throw Error('Missing owner file: ' + f);
  }
}
function locked(d, fn) {
  initialized(d);
  const lock = join(d, '.owner-lock');
  writeFileSync(lock, process.pid + '\n', { flag: 'wx', mode: 0o600 });
  try { return fn(); } finally { unlinkSync(lock); }
}
function syntheticHistory() {
  const out = [], add = e => (out.push(e), e);
  add(createSeed(TENANT, { kind: 'prayer', body: 'SYNTHETIC_PRIVATE_HOLD_1927',
    contributorAlias: 'SYNTHETIC_PRIVATE_ALIAS', permissionToReview: true,
    authorizedSubmitter: true }));
  for (const shared of [true, false]) {
    const lyrics = shared ? 'The synthetic morning opens for everyone'
      : 'A synthetic local-only song that must not be replicated';
    const seed = add(createSeed(TENANT, { kind: 'lyric', body: lyrics,
      contributorAlias: 'SYNTHETIC_PRIVATE_AUTHOR', permissionToReview: true,
      authorizedSubmitter: true }));
    add(decideSeed(TENANT, replay(out, TENANT), seed.payload.id, 'ADMIT'));
    add(recordSeedPermission(TENANT, replay(out, TENANT), seed.payload.id,
      shared ? 'PUBLIC_LYRICS_AND_INTERCHURCH' : 'PUBLIC_LYRICS',
      shared ? 'synthetic-cross-church-permission-001' : 'synthetic-local-permission-002'));
    add(publishSong(TENANT, replay(out, TENANT), {
      sourceSeedIds: [seed.payload.id], title: shared ? 'SYNTHETIC Open Morning' : 'SYNTHETIC Local Only',
      lyrics, bpm: 92, meter: '4/4', pastoralApproved: true, rightsCleared: true,
      approvalNote: 'Synthetic test-only deliberate pastoral approval',
      rightsNote: 'Synthetic test-only rights review declaration',
      interchurchSharingApproved: shared,
      ...(shared ? { sharingTerms: 'Synthetic, noncommercial interchurch lyric test' } : {})
    }));
  }
  return out;
}
function init(d) {
  const filenames = ['owner-private.pem', 'owner-public.pem', TENANT + '.jsonl',
    'edition-state.json', 'public-edition.json'];
  if (filenames.some(f => existsSync(join(d, f))))
    throw Error('Refusing to overwrite existing owner state');
  const keys = generateKeyPairSync('ed25519', {
    privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
    publicKeyEncoding: { format: 'pem', type: 'spki' }
  });
  writeFileSync(join(d, 'owner-private.pem'), keys.privateKey, { flag: 'wx', mode: 0o600 });
  writeFileSync(join(d, 'owner-public.pem'), keys.publicKey, { flag: 'wx', mode: 0o600 });
  writeFileSync(journal(d), syntheticHistory().map(JSON.stringify).join('\n') + '\n',
    { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ operation: 'initialized', ownerDir: d,
    syntheticOnly: true, publicKey: join(d, 'owner-public.pem'),
    privateKeyMustStayOnOwner: true }));
}
function issueWithinLock(d, ttl = TTL) {
  if (!Number.isSafeInteger(ttl) || ttl < 1 || ttl > 300)
    throw Error('TTL must be 1–300 seconds');
  const stateFile = join(d, 'edition-state.json');
  const state = existsSync(stateFile) ? json(stateFile) : { edition: 0 };
  if (Object.keys(state).join(',') !== 'edition' ||
      !Number.isSafeInteger(state.edition) || state.edition < 0 ||
      state.edition >= Number.MAX_SAFE_INTEGER) throw Error('Invalid edition state');
  const edition = state.edition + 1;
  const bundle = createLeasedEdition({ tenant: TENANT, journalPath: journal(d), edition,
    privateKeyPem: readFileSync(join(d, 'owner-private.pem'), 'utf8'), ttlSeconds: ttl });
  // Advance durable owner edition BEFORE publishing new bundle: crash may skip,
  // never automatically reuse an edition with altered content.
  atomic(stateFile, JSON.stringify({ edition }) + '\n');
  atomic(join(d, 'public-edition.json'), JSON.stringify(bundle) + '\n');
  console.log(JSON.stringify({ operation: 'issued', edition,
    publishedSongCount: bundle.snapshot.payload.songs.length,
    withdrawnSongCount: bundle.lease.body.withdrawnSongIds.length,
    expiresAt: bundle.lease.body.expiresAt, bundleFile: join(d, 'public-edition.json') }));
}
function withdraw(d) {
  locked(d, () => {
    const history = readEvents(d), state = replay(history, TENANT);
    const song = state.songs.find(s => s.status === 'PUBLISHED' &&
      s.sharingApproval?.affirmed === true);
    if (!song) throw Error('No active interchurch-licensed test publication');
    const event = withdrawSong(TENANT, state, song.id,
      'Synthetic test owner withdraws publication authorization');
    appendFileSync(journal(d), JSON.stringify(event) + '\n', { mode: 0o600 });
    issueWithinLock(d);
  });
}
function verifyBundle(keyFile, bundleFile) {
  const verified = verifyLeasedEdition(json(resolve(bundleFile)), TENANT,
    readFileSync(resolve(keyFile), 'utf8'));
  console.log(JSON.stringify({ operation: 'verified', edition: verified.edition,
    publicSongCount: verified.songs.length,
    expiresAt: new Date(verified.expiresAt).toISOString(), containsPrivateJournal: false }));
}
function serve(server, port, role) {
  server.listen(port, '127.0.0.1', () => console.log(JSON.stringify({
    operation: 'listening', role, address: '127.0.0.1', port, internetListener: false
  })));
}
async function localRequest(port, route, init) {
  return fetch('http://127.0.0.1:' + port + route, {
    ...init, redirect: 'error', signal: AbortSignal.timeout(3000)
  });
}
async function publish(d, ports) {
  initialized(d);
  if (!ports.length || ports.length > 8) throw Error('1–8 mirror ports required');
  const bundle = json(join(d, 'public-edition.json'));
  verifyLeasedEdition(bundle, TENANT, readFileSync(join(d, 'owner-public.pem'), 'utf8'));
  for (const portText of ports) {
    const n = pnum(portText);
    const response = await localRequest(n, '/replicate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bundle)
    });
    const result = await response.json();
    console.log(JSON.stringify({ operation: 'replicate', port: n, status: response.status,
      outcome: result.status || result.error || 'UNKNOWN', edition: bundle.snapshot.payload.edition }));
    if (!response.ok) process.exitCode = 1;
  }
}
async function check(port) {
  const h = await localRequest(port, '/health');
  const health = await h.json();
  const r = await localRequest(port, '/api/' + TENANT + '/songs');
  const body = await r.json();
  console.log(JSON.stringify({ operation: 'check', port, role: health.role,
    status: r.ok ? 'AVAILABLE' : 'HOLD', httpStatus: r.status,
    edition: body.edition ?? health.edition ?? null,
    songCount: r.ok ? body.songs?.length : null, mirror: body.fromMirror || null,
    expiresAt: body.expiresAt || body.leaseExpiresAt || health.expiresAt || null }));
  if (!r.ok) process.exitCode = 1;
}
async function main(args) {
  const [command, ...argv] = args;
  if (command === 'init' && argv.length === 1) return init(directory(argv[0]));
  if (command === 'issue' && argv.length >= 1 && argv.length <= 2) {
    const d = directory(argv[0]);
    return locked(d, () => issueWithinLock(d,
      argv[1] === undefined ? TTL : Number(argv[1])));
  }
  if (command === 'withdraw' && argv.length === 1) return withdraw(directory(argv[0]));
  if (command === 'verify' && argv.length === 2) return verifyBundle(argv[0], argv[1]);
  if (command === 'mirror' && argv.length === 3)
    return serve(createLeasedMirror({ tenant: TENANT, dataDir: directory(argv[0]),
      trustedPublicKeyPem: readFileSync(resolve(argv[1]), 'utf8') }), pnum(argv[2]), 'leased-mirror');
  if (command === 'gateway' && argv.length === 5) {
    const [dataDir, key, gateway, a, b] = argv;
    const mirrors = [{ id: 'laptop-a', url: 'http://127.0.0.1:' + pnum(a) },
      { id: 'laptop-b', url: 'http://127.0.0.1:' + pnum(b) }];
    return serve(createCommonsGateway({ tenant: TENANT, mirrors,
      trustedPublicKeyPem: readFileSync(resolve(key), 'utf8'),
      requireLease: true, receiptDir: directory(dataDir) }), pnum(gateway), 'leased-gateway');
  }
  if (command === 'publish' && argv.length >= 2) return publish(directory(argv[0]), argv.slice(1));
  if (command === 'check' && argv.length === 1) return check(pnum(argv[0]));
  throw Error(help);
}
try { await main(process.argv.slice(2)); }
catch (error) { console.error('Field kit refused: ' + error.message); process.exitCode = 1; }
