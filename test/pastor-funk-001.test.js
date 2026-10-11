import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileFragmentChoir, INPUT_SCHEMA, OUTPUT_SCHEMA } from '../src/pastor-funk-001.js';

const base = () => ({
  schema: INPUT_SCHEMA,
  performance: { id: 'rehearsal-001', title: 'Pastor of Funk', host: 'human:pastor' },
  fragments: [
    {
      id: 'doorframe', kind: 'object', material: 'An old doorframe with its cracked blue paint',
      source: { mode: 'witnessed', description: 'Human: a recovered doorframe' },
      credit: { mode: 'named', name: 'Rainbow Elf' },
      permission: { perform: true, transform: true, preserve: true },
      review: { decision: 'admit', by: 'human:pastor' },
    },
    {
      id: 'unadmitted', kind: 'word', material: 'Keep this private and out of the score',
      source: { mode: 'imagined', description: 'Unreviewed idea' },
      credit: { mode: 'anonymous', name: null },
      permission: { perform: false, transform: false, preserve: false },
      review: { decision: 'hold', by: 'human:pastor' },
    },
  ],
  cues: [{ id: 'cue-01', fragmentId: 'doorframe', action: 'fracture', instruction: 'Keep the crack in the rhythm' }],
});

test('produces deterministic, bounded, attributable but non-performed stage proposal', () => {
  const input = base();
  const out = compileFragmentChoir(input);
  assert.equal(out.schema, OUTPUT_SCHEMA);
  assert.equal(out.cues.length, 1);
  assert.equal(out.cues[0].fragment.credit.name, 'Rainbow Elf');
  assert.equal(out.cues[0].action, 'fracture');
  assert.deepEqual(out.heldFragmentIds, ['unadmitted']);
  assert.doesNotMatch(JSON.stringify(out), /Keep this private/);
  assert.deepEqual([
    out.boundaries.performed, out.boundaries.broadcast, out.boundaries.recorded,
    out.boundaries.published, out.boundaries.authenticatedContributorConsent,
    out.boundaries.renderedAudio, out.boundaries.obsControl,
  ], Array(7).fill(false));
  assert.match(out.receiptId, /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(out, compileFragmentChoir(structuredClone(input)));
});

test('changing a contribution changes the receipt rather than rewriting its ancestor', () => {
  const first = base(); const second = base();
  second.fragments[0].material += ' and one brass button';
  assert.notEqual(compileFragmentChoir(first).receiptId, compileFragmentChoir(second).receiptId);
  assert.equal(first.fragments[0].material, 'An old doorframe with its cracked blue paint');
});

test('refused and held materials are absent from exported scores', () => {
  const input = base();
  input.fragments[1].review.decision = 'refuse';
  const out = compileFragmentChoir(input);
  assert.deepEqual(out.refusedFragmentIds, ['unadmitted']);
  assert.deepEqual(out.heldFragmentIds, []);
  assert.doesNotMatch(JSON.stringify(out), /Unreviewed idea/);
});

test('unadmitted sources are never stage material', () => {
  const input = base(); input.cues[0].fragmentId = 'unadmitted';
  assert.throws(() => compileFragmentChoir(input), /unadmitted fragment/);
});

test('stage cues require BOTH perform and preserve permission', () => {
  for (const key of ['perform', 'preserve']) {
    const input = base(); input.fragments[0].permission[key] = false;
    assert.throws(() => compileFragmentChoir(input), /performance and preservation permission/);
  }
});

test('remix requires transform permission, but an unchanged presentation does not', () => {
  const input = base(); input.fragments[0].permission.transform = false;
  assert.throws(() => compileFragmentChoir(input), /transform permission/);
  input.cues[0].action = 'present';
  assert.equal(compileFragmentChoir(input).cues[0].action, 'present');
});

test('explicit human review, source posture and contributor permission cannot be inferred', () => {
  for (const key of ['review', 'permission', 'source']) {
    const input = base(); delete input.fragments[0][key];
    assert.throws(() => compileFragmentChoir(input));
  }
});

test('duplicate ids, missing references, and unsupported actions fail closed', () => {
  const duplicate = base(); duplicate.cues.push({ ...duplicate.cues[0] });
  assert.throws(() => compileFragmentChoir(duplicate), /duplicate cue id/);
  const missing = base(); missing.cues[0].fragmentId = 'phantom';
  assert.throws(() => compileFragmentChoir(missing), /missing fragment/);
  const unknown = base(); unknown.cues[0].action = 'unlicensed-broadcast';
  assert.throws(() => compileFragmentChoir(unknown), /unsupported cue action/);
});

test('bounds reject oversized or malformed stage material', () => {
  const input = base(); input.fragments[0].material = 'x'.repeat(2001);
  assert.throws(() => compileFragmentChoir(input), /fragment material/);
  const many = base(); many.cues = Array.from({length:201},(_,i)=>({id:'c-'+i,fragmentId:'doorframe',action:'present',instruction:'cue'}));
  assert.throws(() => compileFragmentChoir(many), /at most 200/);
  const bad = base(); bad.fragments[0].credit.mode = 'impersonated';
  assert.throws(() => compileFragmentChoir(bad), /credit mode/);
});

test('the offline performance desk is no-install, no active-network and displays typed material as text', () => {
  const html = readFileSync(new URL('../examples/pastor-of-funk-001/index.html', import.meta.url), 'utf8');
  assert.match(html, /Fragment Choir/);
  assert.match(html, /textContent/);
  assert.match(html, /fragment-choir-proposal\.json/);
  assert.doesNotMatch(html, /<script\s+src=|fetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage/i);
});
