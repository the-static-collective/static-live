#!/usr/bin/env node
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { intakePhonographPerformance } from '../src/phonograph-intake.js';
import { compileStageProjection } from '../src/compiler.js';
import { renderRouting, renderSetlist } from '../src/render-stage-aids.js';

const load = (path) => JSON.parse(readFileSync(path, 'utf8'));
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
const fixtureRoot = 'fixtures/phono-live-001';
const outputRoot = resolve(process.argv[2] ?? 'examples/phono-live-001');
const performance = load(`${fixtureRoot}/resolved-performance.json`);
const phonographReceipt = load(`${fixtureRoot}/phonograph-receipt.json`);
const normalIntent = load(`${fixtureRoot}/live-intent.json`);
const brokenIntent = load(`${fixtureRoot}/live-intent-broken.json`);
const normalCrossing = intakePhonographPerformance({
  performance,
  phonographReceipt,
  liveIntent: normalIntent,
});

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(outputRoot, { recursive: true });
writeJson(resolve(outputRoot, 'performance-packet.json'), normalCrossing.packet);
writeJson(resolve(outputRoot, 'crossing-receipt.json'), normalCrossing.crossingReceipt);

for (const id of ['pl2', 'pl1', 'pl0', 'broken']) {
  const crossing = id === 'broken'
    ? intakePhonographPerformance({ performance, phonographReceipt, liveIntent: brokenIntent })
    : normalCrossing;
  const configuration = load(`${fixtureRoot}/configurations/${id}.json`);
  const projection = compileStageProjection(crossing.packet, configuration);
  const outDir = resolve(outputRoot, id);
  mkdirSync(outDir, { recursive: true });
  writeJson(resolve(outDir, 'projection.json'), projection);
  writeFileSync(resolve(outDir, 'setlist.md'), renderSetlist(projection));
  writeFileSync(resolve(outDir, 'routing.md'), renderRouting(projection));
}

console.log(`PHONO-LIVE-001: ${outputRoot}`);
