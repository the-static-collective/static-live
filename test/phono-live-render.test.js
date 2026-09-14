import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const witnessPaths = [
  'performance-packet.json',
  'crossing-receipt.json',
  ...['pl2', 'pl1', 'pl0', 'broken'].flatMap((id) => [
    `${id}/projection.json`,
    `${id}/setlist.md`,
    `${id}/routing.md`,
  ]),
];

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

    for (const relativePath of witnessPaths) {
      assert.equal(existsSync(join(first, relativePath)), true);
      assert.equal(existsSync(join(second, relativePath)), true);
      assert.equal(read(join(first, relativePath)), read(join(second, relativePath)));
      assert.equal(
        read(join(first, relativePath)),
        read(join('examples/phono-live-001', relativePath)),
        `checked-in witness drifted: ${relativePath}`,
      );
    }

    const broken = JSON.parse(read(join(first, 'broken', 'projection.json')));
    assert.equal(broken.playable, false);
    assert.deepEqual(broken.unresolvedCapabilities, ['pulse.live']);
  } finally {
    rmSync(first, { recursive: true, force: true });
    rmSync(second, { recursive: true, force: true });
  }
});
