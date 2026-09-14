import test from 'node:test';
import assert from 'node:assert/strict';

async function loadCompiler() {
  try {
    return await import('../src/compiler.js');
  } catch (error) {
    assert.fail(`compileStageProjection is not implemented: ${error.code ?? error.message}`);
  }
}

const packet = {
  version: 'static-live.performance-packet/v0.1',
  song: { id: 'rocket-step', title: 'Rocket Step', sourceReceipt: 'fixture:rocket-step' },
  tempo: { bpm: 148, meter: '4/4' },
  landmarks: ['intro', 'verse', 'chorus'],
  requiredCapabilities: [
    'lead-vocal.live',
    'guitar.live',
    'drums.live',
    'bass.live',
  ],
  stems: [
    { id: 'textures', kind: 'always', path: 'stems/textures.wav', output: 'foh' },
    { id: 'vocal-fallback', kind: 'fallback', coversCapability: 'lead-vocal.live', path: 'stems/vocal.wav', output: 'foh' },
    { id: 'guitar-fallback', kind: 'fallback', coversCapability: 'guitar.live', path: 'stems/guitar.wav', output: 'foh' },
    { id: 'drums-fallback', kind: 'fallback', coversCapability: 'drums.live', path: 'stems/drums.wav', output: 'foh' },
    { id: 'bass-fallback', kind: 'fallback', coversCapability: 'bass.live', path: 'stems/bass.wav', output: 'foh' },
  ],
  cues: { click: 'stems/click.wav', voice: 'stems/cues.wav' },
};

const sc3 = {
  id: 'sc3',
  label: 'SC/3',
  performers: [
    { id: 'lu', label: 'Lu', capabilities: ['lead-vocal.live', 'guitar.live'] },
    { id: 'bass', label: 'Bass', capabilities: ['bass.live'] },
    { id: 'utility', label: 'Utility', capabilities: ['synth.live'] },
  ],
};

const sc2 = {
  id: 'sc2',
  label: 'SC/2',
  performers: [
    { id: 'lu', label: 'Lu', capabilities: ['lead-vocal.live', 'guitar.live'] },
    { id: 'utility', label: 'Utility', capabilities: ['bass.live'] },
  ],
};

test('activates fallback only for an uncovered required capability', async () => {
  const { compileStageProjection } = await loadCompiler();
  const result = compileStageProjection(packet, sc3);

  assert.equal(result.playable, true);
  assert.deepEqual(result.fallbackCoverage.map((x) => x.capability), ['drums.live']);
  assert.ok(result.enabledStems.some((x) => x.id === 'drums-fallback'));
  assert.ok(result.disabledFallbackStems.some((x) => x.id === 'bass-fallback'));
});

test('fails closed when a required capability has neither live nor fallback coverage', async () => {
  const { compileStageProjection } = await loadCompiler();
  const packetWithoutVocalFallback = {
    ...packet,
    stems: packet.stems.filter((stem) => stem.id !== 'vocal-fallback'),
  };
  const noVocalist = {
    id: 'no-vocalist',
    label: 'No vocalist',
    performers: [{ id: 'drummer', label: 'Drummer', capabilities: ['drums.live'] }],
  };

  const result = compileStageProjection(packetWithoutVocalFallback, noVocalist);

  assert.equal(result.playable, false);
  assert.deepEqual(result.unresolvedCapabilities, ['lead-vocal.live']);
});

test('fallback receipts never manufacture performer participation', async () => {
  const { compileStageProjection } = await loadCompiler();
  const result = compileStageProjection(packet, sc2);

  assert.ok(result.liveContributions.every((x) => x.performerId));
  assert.ok(result.fallbackCoverage.every((x) => !('performerId' in x)));
  assert.deepEqual(result.liveContributions.map((x) => x.performerId), ['lu', 'utility']);
});

test('identical inputs produce identical projections', async () => {
  const { compileStageProjection } = await loadCompiler();

  assert.deepEqual(
    compileStageProjection(packet, sc2),
    compileStageProjection(packet, sc2),
  );
});

test('projection carries stage-relevant song timing metadata', async () => {
  const { compileStageProjection } = await loadCompiler();
  const result = compileStageProjection(packet, sc3);

  assert.deepEqual(result.tempo, { bpm: 148, meter: '4/4' });
  assert.deepEqual(result.landmarks, ['intro', 'verse', 'chorus']);
  assert.deepEqual(result.cues, { click: 'stems/click.wav', voice: 'stems/cues.wav' });
});
