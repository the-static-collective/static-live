import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import { promisify } from 'node:util';
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';

const cli = fileURLToPath(new URL('../scripts/two-laptop-kit.mjs', import.meta.url));
const run = async (...args) => {
  const { stdout } = await promisify(execFile)(process.execPath, [cli, ...args],
    { timeout: 10000 });
  return JSON.parse(stdout.trim());
};
async function openPort() {
  const s = createServer();
  s.listen(0, '127.0.0.1');
  await once(s, 'listening');
  const port = s.address().port;
  await new Promise(resolve => s.close(resolve));
  return String(port);
}
async function serve(...args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'], env: process.env
    });
    let output = '', errors = '';
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };
    const timer = setTimeout(() => {
      child.kill('SIGTERM'); finish(reject, Error('Server startup timed out ' + errors));
    }, 8000);
    child.stderr.on('data', data => { errors += data.toString(); });
    child.stdout.on('data', data => {
      output += data.toString();
      const line = output.split('\n').find(x => x.trim().startsWith('{'));
      if (!line) return;
      try {
        const ready = JSON.parse(line);
        if (ready.operation === 'listening') finish(resolve, { child, ready });
      } catch { /* partial JSON line */ }
    });
    child.once('exit', code => finish(reject, Error('Server exited on startup ' + code + ': ' + errors)));
  });
}
async function stop(instance) {
  if (!instance || instance.child.exitCode !== null) return;
  const closing = once(instance.child, 'exit');
  instance.child.kill('SIGTERM');
  await closing;
}

test('two-laptop operator CLI: signed public mirror survives losing owner/gateway/local mirror', async () => {
  const d = mkdtempSync(join(tmpdir(), 'two-laptop-'));
  const owner = join(d, 'owner'), a = join(d, 'laptop-a-mirror'),
    b = join(d, 'laptop-b-mirror'), gatewayDir = join(d, 'gateway');
  const pubKey = join(owner, 'owner-public.pem');
  const copiedKey = join(d, 'b-public.pem');
  let mirrorA, mirrorB, gateway;
  try {
    const initial = await run('init', owner);
    assert.equal(initial.syntheticOnly, true);
    assert.equal(initial.privateKeyMustStayOnOwner, true);
    mkdirSync(a); mkdirSync(b);
    copyFileSync(pubKey, copiedKey); // only transferable owner public key
    const edition = await run('issue', owner);
    assert.equal(edition.edition, 1);
    assert.equal(edition.publishedSongCount, 1);
    const verified = await run('verify', copiedKey, join(owner, 'public-edition.json'));
    assert.equal(verified.publicSongCount, 1);
    const [aPort, bPort, gatewayPort] = await Promise.all([openPort(), openPort(), openPort()]);
    assert.equal(new Set([aPort, bPort, gatewayPort]).size, 3);
    mirrorA = await serve('mirror', a, pubKey, aPort);
    mirrorB = await serve('mirror', b, copiedKey, bPort);
    assert.equal(mirrorA.ready.address, '127.0.0.1');
    assert.equal(mirrorB.ready.address, '127.0.0.1');

    // In the real field run bPort will be an SSH local forward to another laptop.
    const replicated = await run('publish', owner, aPort, bPort);
    assert.equal(replicated.operation, 'replicate'); // last recipient report
    assert.equal(replicated.status, 201);
    const bDisk = readFileSync(join(b, 'sample-church.leased-edition.json'), 'utf8');
    for (const forbidden of ['SYNTHETIC_PRIVATE_HOLD_1927', 'SYNTHETIC_PRIVATE_ALIAS',
      'SYNTHETIC_PRIVATE_AUTHOR', 'SYNTHETIC Local Only', 'owner-private'])
      assert.equal(bDisk.includes(forbidden), false);

    gateway = await serve('gateway', gatewayDir, pubKey, gatewayPort, aPort, bPort);
    const before = await run('check', gatewayPort);
    assert.equal(before.status, 'AVAILABLE');
    assert.equal(before.mirror, 'laptop-a');

    await stop(mirrorA); mirrorA = null;
    const switched = await run('check', gatewayPort);
    assert.equal(switched.status, 'AVAILABLE');
    assert.equal(switched.mirror, 'laptop-b');
    assert.equal(switched.songCount, 1);

    // Simulate the entire owner/gateway laptop vanishing, not only its song service.
    await stop(gateway); gateway = null;
    const independent = await run('check', bPort);
    assert.equal(independent.status, 'AVAILABLE');
    assert.equal(independent.songCount, 1);

    const withdrawn = await run('withdraw', owner);
    assert.equal(withdrawn.edition, 2);
    assert.equal(withdrawn.publishedSongCount, 0);
    const change = await run('publish', owner, bPort);
    assert.equal(change.status, 201);
    const after = await run('check', bPort);
    assert.equal(after.status, 'AVAILABLE');
    assert.equal(after.songCount, 0);

    const expiring = await run('issue', owner, '1');
    assert.equal(expiring.edition, 3);
    assert.equal((await run('publish', owner, bPort)).status, 201);
    await new Promise(done => setTimeout(done, 1150));
    const { stdout } = await promisify(execFile)(process.execPath, [cli, 'check', bPort], {
      timeout: 6000
    }).then(x => x, error => ({ stdout: error.stdout }));
    const held = JSON.parse(stdout.trim());
    assert.equal(held.status, 'HOLD', 'No unbounded serving after lease expires');
    assert.equal(held.httpStatus, 503);
  } finally {
    await Promise.all([stop(gateway), stop(mirrorA), stop(mirrorB)]);
    rmSync(d, { recursive: true, force: true });
  }
});

test('CLI refuses Internet-facing publish target and cannot overwrite private owner', async () => {
  const d = mkdtempSync(join(tmpdir(), 'two-laptop-negative-'));
  try {
    await run('init', join(d, 'owner'));
    await assert.rejects(() => run('init', join(d, 'owner')));
    await run('issue', join(d, 'owner'));
    await assert.rejects(() => run('publish', join(d, 'owner'), '80'));
    await assert.rejects(() => run('publish', join(d, 'owner'), 'https://example.net'));
    await assert.rejects(() => run('issue', join(d, 'owner'), '500'));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});
