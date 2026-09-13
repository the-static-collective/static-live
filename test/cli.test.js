import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('CLI emits a deterministic stage package for SC/3', () => {
  const outDir = mkdtempSync(join(tmpdir(), 'static-live-'));

  try {
    const run = spawnSync(
      process.execPath,
      [
        'src/cli.js',
        'compile',
        'fixtures/live-001/song.json',
        'fixtures/live-001/configurations/sc3.json',
        '--out',
        outDir,
      ],
      { cwd: process.cwd(), encoding: 'utf8' },
    );

    assert.equal(run.status, 0, run.stderr || run.stdout);
    assert.equal(existsSync(join(outDir, 'projection.json')), true);
    assert.equal(existsSync(join(outDir, 'setlist.md')), true);
    assert.equal(existsSync(join(outDir, 'routing.md')), true);

    const projection = JSON.parse(readFileSync(join(outDir, 'projection.json'), 'utf8'));
    const routing = readFileSync(join(outDir, 'routing.md'), 'utf8');

    assert.equal(projection.playable, true);
    assert.deepEqual(projection.fallbackCoverage.map((x) => x.capability), ['drums.live']);
    assert.match(routing, /drums\.live/);
    assert.match(routing, /drums-fallback/);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});
