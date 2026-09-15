#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileStageProjection } from './compiler.js';
import { renderControls, renderRouting, renderSetlist } from './render-stage-aids.js';

const usage = 'usage: node src/cli.js compile <packet.json> <configuration.json> --out <directory>';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function main(argv) {
  const [command, packetPath, configurationPath, outFlag, outDir] = argv;
  if (command !== 'compile' || !packetPath || !configurationPath || outFlag !== '--out' || !outDir) {
    console.error(usage);
    return 64;
  }

  const packet = readJson(packetPath);
  const configuration = readJson(configurationPath);
  const projection = compileStageProjection(packet, configuration);
  const outputDirectory = resolve(outDir);

  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(
    resolve(outputDirectory, 'projection.json'),
    `${JSON.stringify(projection, null, 2)}\n`,
  );
  writeFileSync(resolve(outputDirectory, 'setlist.md'), renderSetlist(projection));
  writeFileSync(resolve(outputDirectory, 'routing.md'), renderRouting(projection));
  writeFileSync(
    resolve(outputDirectory, 'midi-map.json'),
    `${JSON.stringify({
      version: 'static-live.midi-map/v0.1',
      song: projection.song,
      configuration: projection.configuration,
      controls: projection.midiControls,
    }, null, 2)}\n`,
  );
  writeFileSync(resolve(outputDirectory, 'controls.md'), renderControls(projection));

  return 0;
}

process.exitCode = main(process.argv.slice(2));
