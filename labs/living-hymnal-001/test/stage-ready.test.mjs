import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { auditStageAudio, readWaveHeader } from '../src/stage-ready.mjs';

function wav(sampleRate = 48000, seconds = 1, channels = 2) {
  const frames = sampleRate * seconds, byteRate = sampleRate * channels * 2;
  const size = frames * channels * 2;
  const b = Buffer.alloc(44 + size);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + size, 4);
  b.write('WAVE', 8);
  b.write('fmt ', 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(channels, 22);
  b.writeUInt32LE(sampleRate, 24);
  b.writeUInt32LE(byteRate, 28);
  b.writeUInt16LE(channels * 2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(size, 40);
  return b;
}
function packet(stemPath = 'stems/pad.wav', clickPath = 'stems/click.wav') {
  return {
    version: 'static-live.stage-projection/v0.1',
    song: { title: 'Test Song' }, configuration: { label: 'Sunday' },
    playable: true, enabledStems: [{ id: 'pad', kind: 'always', path: stemPath, output: 'foh' }],
    cues: { click: clickPath }
  };
}
function workspace(fn) {
  const root = mkdtempSync(join(tmpdir(), 'stage-wav-'));
  mkdirSync(join(root, 'stems'));
  try { return fn(root); } finally { rmSync(root, { recursive: true, force: true }); }
}
test('aligned WAV backing stem and privately routed click are preflight-ready', () => workspace(root => {
  writeFileSync(join(root, 'stems/pad.wav'), wav());
  writeFileSync(join(root, 'stems/click.wav'), wav(48000, 1, 1));
  const header = readWaveHeader(join(root, 'stems/click.wav'));
  assert.equal(header.channels, 1);
  assert.equal(header.seconds, 1);
  const result = auditStageAudio(packet(), root);
  assert.equal(result.ready, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.files.length, 2);
  assert.equal(result.files[1].role, 'private-click');
}));
test('mismatched duration and sample rate reject stage readiness', () => workspace(root => {
  writeFileSync(join(root, 'stems/pad.wav'), wav(48000, 1));
  writeFileSync(join(root, 'stems/click.wav'), wav(44100, 2));
  const result = auditStageAudio(packet(), root);
  assert.equal(result.ready, false);
  assert.ok(result.errors.some(x => x.startsWith('SAMPLE_RATE_MISMATCH')));
  assert.ok(result.errors.some(x => x.startsWith('DURATION_DRIFT')));
}));
test('missing, duplicate and path traversal fail closed', () => workspace(root => {
  writeFileSync(join(root, 'stems/pad.wav'), wav());
  assert.equal(auditStageAudio(packet(), root).ready, false);
  assert.ok(auditStageAudio(packet('stems/pad.wav', 'stems/pad.wav'), root).errors.some(x => x.includes('DUPLICATE_ROUTE')));
  assert.ok(auditStageAudio(packet('../stems/pad.wav', 'stems/pad.wav'), root).errors.some(x => x.includes('UNSAFE_WAV_PATH')));
  const allLive = { ...packet(), playable: false, enabledStems: [], cues: {} };
  assert.equal(auditStageAudio(allLive, root).ready, false);
}));
