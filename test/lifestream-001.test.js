import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { canonicalStringify } from '../src/canonical-json.js';
import { createMoment, verifyMoment, verifyReturn, main } from '../src/lifestream-001.js';

const sha = (value) => 'sha256:' + createHash('sha256').update(value).digest('hex');
const objectHash = (value) => sha(Buffer.from(canonicalStringify(value), 'utf8'));
const instant = '2026-09-20T15:00:00.000Z';
const clock = { clockId:'clockwork.abstract-60', reading:'17', basis:'declared abstract tick; not UTC',
  observedAtUtc:instant, evidenceRef:'clockwork-001:fixture' };

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'live001-'));
  const source = join(root, 'recording.raw');
  writeFileSync(source, Buffer.from('one physical occurrence\n'));
  const moment = createMoment({eventId:'live001:take1',sourceFile:source,
    startMs:200,endMs:1400,recordingStartedAtUtc:instant,observedAtUtc:instant,
    clockWitnesses:[clock]});
  return {root,source,moment};
}
function withFixture(fn) {
  const f = fixture();
  try { fn(f); } finally { rmSync(f.root,{recursive:true,force:true}); }
}
function aReturn(moment) {
  const text = 'The road is still becoming.\n';
  const artifact = {kind:'lyric',text,sha256:sha(Buffer.from(text,'utf8')),sourceMomentId:moment.momentId};
  const unsigned = {schema:'static-lifestream.return/v0.1',momentId:moment.momentId,artifact,
    review:{admittedBy:'human:operator',admittedAtUtc:instant,disposition:'reviewed_local_draft'},
    effects:{broadcast:false,stage:false,publish:false}};
  return {...unsigned,returnId:objectHash(unsigned)};
}
test('source, offset, UTC anchor and independent clock witness survive without conversion', () =>
  withFixture(({source,moment}) => {
    assert.equal(verifyMoment(moment,source).momentId,moment.momentId);
    assert.equal(moment.span.startMs,200);
    assert.equal(moment.clockWitnesses[0].reading,'17');
    assert.notEqual(moment.clockWitnesses[0].reading, moment.span.startMs);
  }));
test('mutated source, false time and false clock provenance cannot be smuggled in', () =>
  withFixture(({source,moment}) => {
    writeFileSync(source,'changed');
    assert.throws(() => verifyMoment(moment,source),/source bytes/);
    writeFileSync(source,'one physical occurrence\n');
    const changed = structuredClone(moment);
    changed.clockWitnesses[0].reading='18';
    assert.throws(() => verifyMoment(changed,source),/manifest digest mismatch/);
    assert.throws(() => createMoment({eventId:'x',sourceFile:source,startMs:200,endMs:200,
      recordingStartedAtUtc:instant,observedAtUtc:instant}),/invalid media span/);
    assert.throws(() => createMoment({eventId:'x',sourceFile:source,startMs:0,endMs:1,
      recordingStartedAtUtc:'2026-09-20',observedAtUtc:instant}),/UTC instant/);
  }));
test('reviewed return verifies while effects remain false; any requested broadcast is refused', () =>
  withFixture(({source,moment}) => {
    const returned = aReturn(moment);
    const checked = verifyReturn(moment,returned,source);
    assert.equal(checked.status,'verified_return_not_performed');
    assert.deepEqual([checked.broadcast,checked.stage,checked.publish],[false,false,false]);
    const badEffect = structuredClone(returned); badEffect.effects.broadcast=true;
    assert.throws(() => verifyReturn(moment,badEffect,source),/effectful return refused/);
    const badText = structuredClone(returned); badText.artifact.text='I changed the source';
    assert.throws(() => verifyReturn(moment,badText,source),/artifact bytes changed/);
    const wrongMoment = structuredClone(returned); wrongMoment.momentId='sha256:'+'0'.repeat(64);
    assert.throws(() => verifyReturn(moment,wrongMoment,source),/different moment/);
  }));
test('capture CLI writes a new manifest and refuses silent overwrite', () =>
  withFixture(({root,source}) => {
    const out = join(root,'moment.json');
    const args = ['capture','--event','live001:take2','--source',source,'--start-ms','0',
      '--end-ms','10','--recording-started-at',instant,'--observed-at',instant,'--out',out];
    main(args);
    const moment = JSON.parse(readFileSync(out,'utf8'));
    verifyMoment(moment,source);
    assert.throws(() => main(args),/EEXIST/);
  }));
