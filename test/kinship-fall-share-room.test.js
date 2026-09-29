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


test('station memory ignores drafts and begins with witnessed air', () => {
  const draft = core.makeCard({ doorId: 'what-day', sourceIds: ['coffee-day'] });
  const empty = core.buildStationMemory([draft], []);
  assert.equal(empty.airedCount, 0);

  let aired = core.transition(core.transition(draft, 'ready'), 'aired', { confirmed: true });
  const memory = core.buildStationMemory([aired], []);
  assert.equal(memory.airedCount, 1);
  assert.equal(memory.featureCounts['door:what-day'], 1);
});

test('memory projection is deterministic across card and verdict order', () => {
  let a = core.makeCard({ doorId: 'community-door', sourceIds: ['events'] });
  let b = core.makeCard({ doorId: 'volunteer-door', sourceIds: ['volunteer'] });
  a = { ...core.transition(core.transition(a, 'ready'), 'aired', { confirmed: true }), airedAt: '2026-09-29T20:00:00.000Z' };
  b = { ...core.transition(core.transition(b, 'ready'), 'aired', { confirmed: true }), airedAt: '2026-09-29T21:00:00.000Z' };
  const va = { schema: 'kinship.station-memory-verdict/v0.1', verdictId: 'v:a', cardId: a.id, createdAt: '2026-09-29T22:00:00.000Z', disposition: 'keep', wouldReopen: true };
  const vb = { schema: 'kinship.station-memory-verdict/v0.1', verdictId: 'v:b', cardId: b.id, createdAt: '2026-09-29T22:01:00.000Z', disposition: 'weird', wouldReopen: false };
  assert.deepEqual(
    core.buildStationMemory([a, b], [va, vb]),
    core.buildStationMemory([b, a], [vb, va])
  );
});

test('later memory verdict does not erase earlier testimony', () => {
  let card = core.makeCard({ doorId: 'listener-story', sourceIds: ['director'] });
  card = core.transition(core.transition(card, 'ready'), 'aired', { confirmed: true });
  const older = { schema: 'kinship.station-memory-verdict/v0.1', verdictId: 'v1', cardId: card.id, createdAt: '2026-09-29T20:00:00.000Z', disposition: 'weird', wouldReopen: false };
  const newer = { schema: 'kinship.station-memory-verdict/v0.1', verdictId: 'v2', cardId: card.id, createdAt: '2026-09-29T20:01:00.000Z', disposition: 'keep', wouldReopen: true };
  const verdicts = [older, newer];
  const memory = core.buildStationMemory([card], verdicts);
  assert.equal(verdicts.length, 2);
  assert.equal(memory.latestVerdicts[card.id].verdictId, 'v2');
});

test('re-open creates a fresh draft with explicit ancestry', () => {
  let card = core.makeCard({ doorId: 'why-kinship', sourceIds: ['director'], copy: 'historical copy' });
  card = core.transition(core.transition(card, 'ready'), 'aired', { confirmed: true });
  const returned = core.reopenCard(card, 'human:test');
  assert.equal(returned.status, 'draft');
  assert.equal(returned.ancestorId, card.id);
  assert.notEqual(returned.id, card.id);
  assert.match(returned.copy, /Prior wording is history, not current truth/);
});

test('station memory creates transparent bounded pressures', () => {
  const cards = [];
  for (let i = 0; i < 3; i++) {
    let card = core.makeCard({ doorId: 'what-day', sourceIds: ['coffee-day'] });
    card = core.transition(core.transition(card, 'ready'), 'aired', { confirmed: true });
    card.airedAt = '2026-09-29T2' + i + ':00:00.000Z';
    cards.push(card);
  }
  const memory = core.buildStationMemory(cards, []);
  assert.ok(memory.pressures.length <= 3);
  assert.ok(memory.pressures.some(item => item.kind === 'saturation'));
  assert.ok(memory.pressures.every(item => item.evidenceRefs.length > 0));
});
