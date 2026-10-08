import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../examples/kinship-fall-share-room/room.js');
const c = globalThis.KinshipRoomCore;

const statement = (permissions = []) => c.makeLivingGift({
  title: 'Sunrise on the commute', kind: 'statement',
  note: 'The radio kept us company.', attribution: '',
  rightsRef: 'release-001', permissions
});
const admit = (gift, use) => c.reviewLivingGift(gift, use, 'admit', 'human:producer', 'checked release-001');

test('living gifts are optional unpaid, anonymous, held on arrival and bounded', () => {
  const gift = statement();
  assert.equal(gift.attribution, 'Anonymous');
  assert.deepEqual(gift.permissions, []);
  assert.equal(gift.reviews.length, 0);
  assert.equal(c.livingGiftUseEligible(gift, 'gallery'), false);
  assert.throws(() => c.makeLivingGift({title:'X',kind:'statement',note:'hello',permissions:['publish-everywhere']}), /Unknown proposed use/);
  assert.throws(() => c.makeLivingGift({title:'X',kind:'statement',note:' '.repeat(2001)}), /missing or too long/);
});

test('offer and local human review remain separate acts with scoped rights', () => {
  const gift = statement(['broadcast']);
  assert.equal(c.livingGiftUseEligible(gift, 'broadcast'), false);
  assert.throws(() => admit(gift, 'gallery'), /did not offer/);
  assert.throws(() => c.reviewLivingGift(gift, 'broadcast', 'admit', 'operator', ''), /release/);
  admit(gift, 'broadcast');
  assert.equal(c.livingGiftUseEligible(gift, 'broadcast'), true);
  assert.equal(c.livingGiftUseEligible(gift, 'gallery'), false);
  assert.equal(gift.reviews[0].publicationAuthority, false);
  c.reviewLivingGift(gift, 'broadcast', 'hold', 'operator');
  assert.equal(c.livingGiftUseEligible(gift, 'broadcast'), false);
});

test('photos and voice/video require exact, supported, reattached media bytes', () => {
  const gift = c.makeLivingGift({title:'Kitchen photo',kind:'photo',rightsRef:'release-1',permissions:['gallery']});
  assert.throws(() => admit(gift, 'gallery'), /Exact local media bytes/);
  assert.throws(() => c.bindLivingGiftAsset(gift, 'a'.repeat(64), 'image/svg+xml', 100), /Unsupported media/);
  c.bindLivingGiftAsset(gift, 'a'.repeat(64), 'image/jpeg', 100);
  assert.throws(() => c.bindLivingGiftAsset(gift, 'b'.repeat(64), 'image/jpeg', 100), /Changed bytes/);
  assert.throws(() => c.bindLivingGiftAsset(gift, 'a'.repeat(64), 'image/jpeg', 51*1024*1024), /size/);
  admit(gift, 'gallery');
  assert.equal(c.livingGiftUseEligible(gift, 'gallery'), true);
  const imported = c.recheckImportedLivingGifts({items:[gift]}).items[0];
  assert.equal(imported.needsReattach, true);
  assert.equal(c.livingGiftUseEligible(imported, 'gallery'), false);
  c.bindLivingGiftAsset(imported, 'a'.repeat(64), 'image/jpeg', 100);
  assert.equal(c.livingGiftUseEligible(imported, 'gallery'), false);
  admit(imported, 'gallery');
  assert.equal(c.livingGiftUseEligible(imported, 'gallery'), true);
});

test('a Living Gift can become a draft, not an air event', () => {
  const gift = statement(['broadcast']);
  assert.throws(() => c.draftFromLivingGift(gift, 'producer'), /human review/);
  admit(gift, 'broadcast');
  const card = c.draftFromLivingGift(gift, 'producer');
  assert.equal(card.status, 'draft');
  assert.equal(card.livingGiftId, gift.id);
  assert.equal(c.enforceLivingGiftUse(card, {items:[gift]}), true);
  assert.throws(() => c.transition(c.transition(card, 'ready'), 'aired'), /confirmation/);
});

test('withdrawal blocks new uses and redacts unbroadcast drafts, not historical air receipts', () => {
  const gift = statement(['broadcast','gallery']);
  admit(gift,'broadcast'); admit(gift,'gallery');
  const card = c.draftFromLivingGift(gift, 'producer');
  const alreadyAired = c.transition(c.transition(c.draftFromLivingGift(gift, 'producer'), 'ready'), 'aired', {confirmed:true});
  c.withdrawLivingGift(gift,'producer','owner request');
  assert.equal(c.livingGiftUseEligible(gift, 'broadcast'), false);
  assert.equal(c.livingGiftUseEligible(gift, 'gallery'), false);
  assert.throws(() => c.enforceLivingGiftUse(card, {items:[gift]}), /withdrawn/);
  c.holdUnbroadcastLivingGiftCards([card,alreadyAired],gift.id);
  assert.equal(card.status, 'hold');
  assert.doesNotMatch(card.copy,/radio kept us/);
  assert.equal(alreadyAired.status, 'aired');
  assert.throws(() => admit(gift,'broadcast'), /withdrawn/);
});

test('handoff requires new, scope-specific reviews; stale imported admissions do not travel', () => {
  const gift = statement(['broadcast','gallery']);
  admit(gift,'broadcast'); admit(gift,'gallery');
  const card = c.draftFromLivingGift(gift,'operator-a');
  const sending = c.blankState();
  sending.cards.push(card);
  sending.livingGifts.items.push(gift);
  const handoff = c.makeShiftHandoff(sending, 'operator-a');
  assert.equal(c.receiveShiftHandoff(handoff).semanticEffect,'none');
  const current = c.blankState();
  assert.equal(c.adoptShiftHandoff(current,handoff,'hold').state,current);
  const receiver = c.adoptShiftHandoff(current,handoff,'admit').state;
  assert.equal(receiver.cards.at(-1).status,'hold');
  const imported = receiver.livingGifts.items[0];
  assert.equal(c.livingGiftUseEligible(imported,'gallery'),false);
  admit(imported,'broadcast');
  assert.equal(c.livingGiftUseEligible(imported,'gallery'),false);
  assert.equal(c.livingGiftUseEligible(imported,'broadcast'),true);
  assert.throws(() => c.enforceLivingGiftUse(receiver.cards.at(-1),{items:[]}),/absent/);
});

test('forged, oversized, unsafe imported gifts fail closed', () => {
  const gift = statement(['gallery']);
  assert.throws(() => c.recheckImportedLivingGifts({items:[{...gift, adminOverride:true}]}), /Malformed/);
  assert.throws(() => c.recheckImportedLivingGifts({items:[{...gift, permissions:['unknown']}]}), /Malformed/);
  assert.throws(() => c.recheckImportedLivingGifts({items:Array(101).fill(gift)}), /Invalid/);
  assert.throws(() => c.recheckImportedLivingGifts({items:[{...gift, reviews:Array(101).fill({})}]}), /Malformed/);
});

test('local gallery and bundle are present, but no upload or donor service is wired', () => {
  const base = new URL('../examples/kinship-fall-share-room/', import.meta.url);
  const page = fs.readFileSync(new URL('index.html',base),'utf8');
  const script = fs.readFileSync(new URL('room.js',base),'utf8');
  const css = fs.readFileSync(new URL('room.css',base),'utf8');
  const bundle = fs.readFileSync(new URL('KINSHIP-FALL-SHARE-ROOM.html',base),'utf8');
  assert.match(page,/id="living-gifts"/);
  assert.match(page,/id="gift-gallery"/);
  assert.match(script,/recheckImportedLivingGifts/);
  assert.ok(bundle.includes(script));
  assert.ok(bundle.includes(css));
  assert.doesNotMatch(page,/action="https?:/);
});
