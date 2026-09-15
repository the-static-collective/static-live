import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { compileStageProjection } from '../src/compiler.js';
import { renderControls } from '../src/render-stage-aids.js';

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

const profilePath = 'device-profiles/alesis-micron.json';
const packetPath = 'fixtures/midi-live-001/song.json';
const configurationPath = 'fixtures/midi-live-001/configurations/alesis-duo.json';

test('MICRON-LIVE-001 records documented physical and routing facts without inventing wire values', () => {
  assert.equal(existsSync(profilePath), true, `device profile missing: ${profilePath}`);
  const profile = readJson(profilePath);

  assert.equal(profile.version, 'static-live.midi-device-profile/v0.1');
  assert.equal(profile.id, 'alesis-micron');
  assert.deepEqual(profile.midi.ports, ['in', 'out', 'thru']);
  assert.equal(profile.midi.usb, false);
  assert.equal(profile.midi.externalClock.receive, true);
  assert.deepEqual(profile.localControl.modes, ['on', 'off', 'off+send-ptns']);

  assert.equal(profile.controls.keys.role, 'musical');
  assert.equal(profile.controls.pitch.role, 'musical');
  for (const id of ['m1', 'm2', 'x', 'y', 'z']) {
    assert.equal(profile.controls[id].role, 'assignable');
  }

  assert.equal(profile.controls.x.wire.status, 'hardware-observation-required');
  assert.equal(profile.controls.y.wire.status, 'hardware-observation-required');
  assert.equal(profile.controls.z.wire.status, 'hardware-observation-required');
});

test('Micron stage map names physical controls and requires learning instead of fake CCs', () => {
  const packet = readJson(packetPath);
  const configuration = readJson(configurationPath);
  const projection = compileStageProjection(packet, configuration);
  const map = projection.midiControls[0];

  assert.equal(map.deviceProfile, 'alesis-micron/v0.1');
  assert.equal(map.routingMode, 'sequencer-routed');
  assert.deepEqual(
    map.bindings.map((binding) => [binding.input.type, binding.input.control, binding.input.resolution, binding.action]),
    [
      ['device-control', 'x', 'midi-learn-required', 'haunt.intensity'],
      ['device-control', 'y', 'midi-learn-required', 'mutation.depth'],
      ['device-control', 'z', 'midi-learn-required', 'topology.spread'],
      ['device-control', 'm1', 'midi-learn-required', 'band.machine.balance'],
      ['device-control', 'm2', 'midi-learn-required', 'fracture.pressure'],
    ],
  );

  for (const binding of map.bindings) {
    assert.equal('note' in binding.input, false);
    assert.equal('controller' in binding.input, false);
  }

  const controls = renderControls(projection);
  assert.match(controls, /Alesis Micron/);
  assert.match(controls, /x \[midi-learn-required\] → haunt\.intensity/);
  assert.match(controls, /m2 \[midi-learn-required\] → fracture\.pressure/);
});
