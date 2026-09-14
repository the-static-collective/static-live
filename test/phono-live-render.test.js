import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function render(outDir) {
  const run = spawnSync(process.execPath, ['scripts/render-phono-live-001.js', outDir], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
}

function read(path) {
  return readFileSync(path, 'utf8');
}

test('PHONO-LIVE renderer emits deterministic crossing and room witnesses', () => {
  const first = mkdtempSync(join(tmpdir(), 'phono-live-a-'));
  const second = mkdtempSync(join(tmpdir(), 'phono-live-b-'));

  try {
    render(first);
    render(second);

    for (const root of [first, second]) {
      assert.equal(existsSync(join(root, 'performance-packet.json')), true);
      assert.equal(existsSync(join(root, 'crossing-receipt.json')), true);
      for (const id of ['pl2', 'pl1', 'pl0', 'broken']) {
        assert.equal(existsSync(join(root, id, 'projection.json')), true);
        assert.equal(existsSync(join(root, id, 'setlist.md')), true);
        assert.equal(existsSync(join(root, id, 'routing.md')), true);
      }
    }

    assert.equal(read(join(first, 'crossing-receipt.json')), read(join(second, 'crossing-receipt.json')));
    assert.equal(read(join(first, 'performance-packet.json')), read(join(second, 'performance-packet.json')));
    assert.equal(read(join(first, 'pl1', 'projection.json')), read(join(second, 'pl1', 'projection.json')));

    const broken = JSON.parse(read(join(first, 'broken', 'projection.json')));
    assert.equal(broken.playable, false);
    assert.deepEqual(broken.unresolvedCapabilities, ['pulse.live']);
  } finally {
    rmSync(first, { recursive: true, force: true });
    rmSync(second, { recursive: true, force: true });
  }
});
