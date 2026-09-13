import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { compileStageProjection } from '../src/compiler.js';

function loadJson(path) {
  assert.equal(existsSync(path), true, `fixture missing: ${path}`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

const songPath = 'fixtures/live-001/song.json';
const configurationPaths = {
  sc4: 'fixtures/live-001/configurations/sc4.json',
  sc3: 'fixtures/live-001/configurations/sc3.json',
  sc2: 'fixtures/live-001/configurations/sc2.json',
};

test('LIVE-001 compiles SC/4, SC/3, and SC/2 as playable projections', () => {
  const packet = loadJson(songPath);

  const projections = Object.fromEntries(
    Object.entries(configurationPaths).map(([id, path]) => [
      id,
      compileStageProjection(packet, loadJson(path)),
    ]),
  );

  assert.equal(projections.sc4.playable, true);
  assert.deepEqual(projections.sc4.fallbackCoverage, []);

  assert.equal(projections.sc3.playable, true);
  assert.deepEqual(projections.sc3.fallbackCoverage.map((x) => x.capability), ['drums.live']);

  assert.equal(projections.sc2.playable, true);
  assert.deepEqual(
    projections.sc2.fallbackCoverage.map((x) => x.capability),
    ['drums.live', 'bass.live'],
  );
});

test('removing any one SC/4 performer keeps the song playable through declared fallbacks', () => {
  const packet = loadJson(songPath);
  const sc4 = loadJson(configurationPaths.sc4);

  for (const removed of sc4.performers) {
    const reduced = {
      ...sc4,
      id: `sc4-minus-${removed.id}`,
      label: `SC/4 minus ${removed.label}`,
      performers: sc4.performers.filter((performer) => performer.id !== removed.id),
    };

    const projection = compileStageProjection(packet, reduced);
    const uniquelyLost = removed.capabilities.filter((capability) =>
      packet.requiredCapabilities.includes(capability) &&
      !reduced.performers.some((performer) => performer.capabilities.includes(capability)),
    );

    assert.equal(projection.playable, true, `${removed.label} removal must remain playable`);
    assert.deepEqual(
      projection.fallbackCoverage.map((x) => x.capability),
      uniquelyLost,
      `${removed.label} removal must activate only the lost required capability`,
    );
  }
});
