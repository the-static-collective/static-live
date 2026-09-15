import test from 'node:test';
import assert from 'node:assert/strict';
import { compileStageProjection } from '../src/compiler.js';
import * as stageAids from '../src/render-stage-aids.js';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const packet = {
  version: 'static-live.performance-packet/v0.1',
  song: { id: 'rocket-step', title: 'ROCKET STEP', sourceReceipt: 'specimen:MIDI-LIVE-001/rocket-step' },
  tempo: { bpm: 148, meter: '4/4' },
  landmarks: ['intro', 'drop', 'outro'],
  requiredCapabilities: ['lead-vocal.live', 'midi-controller.live'],
  stems: [],
  cues: { click: 'stems/click.wav', voice: 'stems/cues.wav' },
  midiControls: [
    {
      id: 'alesis-main',
      capability: 'midi-controller.live',
      deviceHint: 'Alesis',
      bindings: [
        { input: { type: 'note', note: 36, channel: 1 }, action: 'stem.drums.toggle' },
        { input: { type: 'cc', controller: 1, channel: 1 }, action: 'haunt.intensity' },
      ],
    },
  ],
};

const configuration = {
  id: 'alesis-duo',
  label: 'Voice + Alesis',
  performers: [
    { id: 'voice', label: 'Voice', capabilities: ['lead-vocal.live'] },
    { id: 'lu', label: 'Lu', capabilities: ['midi-controller.live'] },
  ],
};

test('MIDI control maps activate only through an explicitly declared live capability', () => {
  const projection = compileStageProjection(packet, configuration);

  assert.equal(projection.playable, true);
  assert.deepEqual(projection.midiControls, [
    {
      id: 'alesis-main',
      capability: 'midi-controller.live',
      deviceHint: 'Alesis',
      providers: [{ performerId: 'lu', label: 'Lu' }],
      bindings: packet.midiControls[0].bindings,
    },
  ]);
});

test('stage aids expose a human-readable MIDI control sheet', () => {
  const projection = compileStageProjection(packet, configuration);

  assert.equal(typeof stageAids.renderControls, 'function');
  const rendered = stageAids.renderControls(projection);
  assert.match(rendered, /Alesis/);
  assert.match(rendered, /Lu/);
  assert.match(rendered, /note 36 ch 1 → stem\.drums\.toggle/);
  assert.match(rendered, /cc 1 ch 1 → haunt\.intensity/);
});

test('CLI emits machine and human MIDI control artifacts', () => {
  const outDir = mkdtempSync(join(tmpdir(), 'static-live-midi-'));

  try {
    const run = spawnSync(
      process.execPath,
      [
        'src/cli.js',
        'compile',
        'fixtures/midi-live-001/song.json',
        'fixtures/midi-live-001/configurations/alesis-duo.json',
        '--out',
        outDir,
      ],
      { cwd: process.cwd(), encoding: 'utf8' },
    );

    assert.equal(run.status, 0, run.stderr || run.stdout);
    assert.equal(existsSync(join(outDir, 'midi-map.json')), true);
    assert.equal(existsSync(join(outDir, 'controls.md')), true);

    const midiMap = JSON.parse(readFileSync(join(outDir, 'midi-map.json'), 'utf8'));
    const controls = readFileSync(join(outDir, 'controls.md'), 'utf8');

    assert.equal(midiMap.version, 'static-live.midi-map/v0.1');
    assert.equal(midiMap.controls[0].providers[0].performerId, 'lu');
    assert.match(controls, /haunt\.intensity/);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});

test('packets without MIDI declarations preserve the legacy projection shape', () => {
  const legacyPacket = { ...packet };
  delete legacyPacket.midiControls;

  const projection = compileStageProjection(legacyPacket, configuration);
  assert.equal('midiControls' in projection, false);
});
