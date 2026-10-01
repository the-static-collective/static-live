import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
await import('../examples/kinship-fall-share-room/room.js');
const c = globalThis.KinshipRoomCore;

test('campaign projection distinguishes intended breaks from witnessed airs', () => {
  const card = c.makeCard({ doorId: 'why-kinship', title: 'Break' });
  const track = c.blankTrack();
  track.slots.push(c.planSlot(card.id, '09:15', 'Invite volunteers'));
  assert.equal(c.trackProjection(track, [card])[0].category, 'prophecy');
  assert.throws(() => c.reviseFuture(track, [card], [card.id], 'Learned', 'Next', 'host'), /witnessed/);
  const aired = c.transition(c.transition(card, 'ready'), 'aired', { confirmed: true });
  assert.equal(c.trackProjection(track, [aired])[0].category, 'receipt');
  const before = structuredClone(track);
  const revision = c.reviseFuture(track, [aired], [card.id], 'A volunteer responded', 'Try another invitation', 'host');
  assert.deepEqual(track, before);
  assert.equal(revision.programmingAuthority, false);
  assert.deepEqual(revision.evidenceIds, [card.id]);
  assert.throws(() => c.reviseFuture(track, [aired], ['invented'], 'A', 'B', 'host'), /witnessed/);
});

test('media rights gate and pair responses bind to the same exact bytes', () => {
  const media = c.makeMedia('Letter', 'voice-letter', 'release-1');
  assert.throws(() => c.sealResponse(media, 'A', 'First'), /exact media bytes/);
  assert.throws(() => c.reviewMedia(media, 'admit', 'on-air once', 'host'), /exact local media/);
  c.bindMediaBytes(media, 'a'.repeat(64));
  media.responses.push(c.sealResponse(media, 'A', 'First'));
  assert.throws(() => c.sealResponse(media, 'A', 'Again'), /different listener/);
  media.responses.push(c.sealResponse(media, 'B', 'Second'));
  assert.throws(() => c.sealResponse(media, 'C', 'Third'), /different listener/);
  assert.throws(() => c.bindMediaBytes(media, 'b'.repeat(64)), /Different bytes/);
  assert.throws(() => c.reviewMedia(media, 'admit', '', 'host'), /permitted use/);
  const review = c.reviewMedia(media, 'admit', 'on-air once', 'host');
  assert.equal(review.broadcast, false);
  assert.equal(review.sha256, media.sha256);
});

test('shift handoff carries campaign history without admitting it at receipt', () => {
  const state = c.blankState();
  state.track.slots.push(c.planSlot(state.cards[0].id, '1', 'Invitation'));
  const handoff = c.makeShiftHandoff(state, 'A');
  assert.equal(c.receiveShiftHandoff(handoff).semanticEffect, 'none');
  const current = c.blankState();
  assert.equal(c.adoptShiftHandoff(current, handoff, 'hold').state, current);
  assert.deepEqual(c.adoptShiftHandoff(current, handoff, 'admit').state.track, state.track);
});

test('single-file handoff embeds the exact current source', () => {
  const base = new URL('../examples/kinship-fall-share-room/', import.meta.url);
  const html = fs.readFileSync(new URL('KINSHIP-FALL-SHARE-ROOM.html', base), 'utf8');
  assert.ok(html.includes(fs.readFileSync(new URL('room.js', base), 'utf8')));
  assert.ok(html.includes(fs.readFileSync(new URL('room.css', base), 'utf8')));
  assert.doesNotMatch(html, /src="room.js"|href="room.css"/);
});
