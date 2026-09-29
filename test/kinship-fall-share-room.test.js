import test from 'node:test';
import assert from 'node:assert/strict';

await import('../examples/kinship-fall-share-room/room.js');
const core = globalThis.KinshipRoomCore;

test('Fall Share room core loads without a browser', () => {
  assert.equal(core.VERSION, 'kinship-fall-share-room/v0.1');
  assert.ok(core.DOORS.length >= 10);
  assert.ok(core.BLOCKS.source);
});

test('money pulse is manual arithmetic, not a donor-system claim', () => {
  assert.equal(core.progress('100000', '25000'), 25);
  assert.equal(core.progress('', '25000'), null);
  assert.equal(core.progress('0', '25000'), null);
});

test('Lego composition remains explicit and deterministic', () => {
  const copy = core.composeText(['source', 'scripture', 'return']);
  assert.match(copy, /SOURCE/);
  assert.match(copy, /SCRIPTURE/);
  assert.match(copy, /RETURN/);
  assert.doesNotMatch(copy, /QUESTION/);
});

test('aired cannot be inferred without human confirmation', () => {
  const card = core.makeCard({ doorId: 'faith-gift', sourceIds: ['give'], operator: 'human:test' });
  const ready = core.transition(card, 'ready');
  assert.throws(() => core.transition(ready, 'aired'), /explicit human confirmation/);
  const aired = core.transition(ready, 'aired', { confirmed: true });
  assert.equal(aired.status, 'aired');
  assert.ok(aired.airedAt);
});

test('return requires a concrete human note', () => {
  let card = core.makeCard({ doorId: 'thank-you', sourceIds: ['director'] });
  card = core.transition(card, 'ready');
  card = core.transition(card, 'aired', { confirmed: true });
  assert.throws(() => core.transition(card, 'returned', { returnNote: '' }), /return requires a note/);
  card = core.transition(card, 'returned', { returnNote: 'A volunteer called after the segment.' });
  assert.equal(card.status, 'returned');
});

test('prayer remains a protected open-only source', () => {
  const prayer = core.OFFICIAL_LINKS.find(item => item.id === 'prayer');
  assert.equal(prayer.protected, true);
  assert.equal(prayer.kind, 'station-owned-sensitive');
});

test('rundown includes only ready or later cards', () => {
  const draft = core.makeCard({ doorId: 'what-day', sourceIds: ['director'] });
  const ready = core.transition(core.makeCard({ doorId: 'community-door', sourceIds: ['events'] }), 'ready');
  const rundown = core.buildRundown([draft, ready], core.OFFICIAL_LINKS);
  assert.equal(rundown.length, 1);
  assert.equal(rundown[0].status, 'ready');
});
