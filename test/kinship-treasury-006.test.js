import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createPublicKey, generateKeyPairSync, sign as edSign } from 'node:crypto';
import { inspectPortableNeed, prepareNeighborPorch, makeReviewedRadioPack } from '../src/kinship-treasury-006.js';

function canonical(v) {
  if (v === null || typeof v === 'string' || typeof v === 'boolean' || typeof v === 'number') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
}
const hash = v => createHash('sha256').update(canonical(v)).digest('hex');
function keypair() {
  const {publicKey, privateKey} = generateKeyPairSync('ed25519');
  return {publicKey: publicKey.export({type:'spki',format:'pem'}), privateKey};
}
const owner = keypair(), intruder = keypair();
function signNeed(payload, signer = owner) {
  const content = {version:'jubilee-portable/0.1', type:'need', payload, publicKey:signer.publicKey};
  return {...content, signature:edSign(null, Buffer.from('JUBILEE-PORTABLE-V0.1\n' + canonical(content)), signer.privateKey).toString('base64')};
}
function origin(publicPatch = {}, status = 'open') {
  return signNeed({id:'winter-help-001', revision:1, previousHash:null, status, public:{
    title:'Winter household materials', summary:'Coarse public-safe description only',region:'Southern Minnesota',
    requirements:[
      {id:'wood-001',resource:'firewood',quantity:2,unit:'cord',kind:'goods'},
      {id:'ride-001',resource:'transport',quantity:1,unit:'trip',kind:'service'},
      {id:'gift-001',resource:'cash',quantity:10,unit:'usd',kind:'money'}
    ], ...publicPatch
  }});
}
function revision(previous, patch = {}, signer = owner) {
  return signNeed({...previous.payload, revision:previous.payload.revision+1, previousHash:hash(previous), ...patch}, signer);
}
function review(patch={}) {return {
  disposition:'hold', reviewedBy:'human:local-volunteer', reviewedAtUtc:'2026-10-08T19:00:00.000Z',
  note:'Only as a producer candidate; no station endorsement',freshnessChecked:true,consentChecked:true,...patch
};}
const edition = {id:'kinship-neighbor-2026-10-08', localDate:'2026-10-08', intendedUse:'experimental human-only station producer preparation'};

test('signed portable bundle verifies, with reproducible snapshot digest', () => {
  const n=origin(), i=inspectPortableNeed([n]);
  assert.equal(i.revision,1); assert.equal(i.headHash,hash(n));assert.equal(i.state,'open');
});
test('radio porch holds with no broadcast, payment, prayer, or station permission', () => {
  const p=prepareNeighborPorch([origin()]);
  assert.equal(p.status,'held_for_human_review');
  assert.deepEqual(p.resourcePossibilities.map(v=>v.resource),['firewood','transport']);
  for(const key of ['broadcast','publish','prayerRequestImport','donorInformationImport','paymentImport','stationAdoption','privateContactImport']) assert.equal(p[key],false);
  assert.doesNotMatch(JSON.stringify(p),/Southern Minnesota|Coarse public-safe description only/);
});
test('human-reviewed handoff composes with KINSHIP-001 but never claims on-air state', () => {
  const pack=makeReviewedRadioPack([origin()], review(), edition);
  assert.equal(pack.schema,'static-live.kinship-radio-pack/v0.1');
  assert.equal(pack.candidates[0].review.disposition,'hold');
  assert.deepEqual(pack.airableSegmentIds,[]);
  assert.equal(pack.boundaries.broadcast,false);assert.equal(pack.boundaries.prayerRequestIngest,false);
  assert.equal(pack.routing.officialGivingUnchanged,true);assert.equal(pack.routing.actionRouteProven,false);
  assert.equal(pack.bridgeReceiptId, 'sha256:' + hash({
    radioPackReceiptId: pack.receiptId, treasuryProvenance: pack.treasuryProvenance, routing: pack.routing
  }));
  const changed = structuredClone(pack.treasuryProvenance); changed.sha256 = '0'.repeat(64);
  assert.notEqual(pack.bridgeReceiptId, 'sha256:' + hash({radioPackReceiptId:pack.receiptId,treasuryProvenance:changed,routing:pack.routing}));
});
test('ready means eligible for human producer consideration only', () => {
  const pack=makeReviewedRadioPack([origin()],review({disposition:'ready'}),edition);
  assert.equal(pack.airableSegmentIds.length,1);
  assert.equal(pack.routing.aired,false);assert.equal(pack.routing.adoption,false);assert.equal(pack.boundaries.stationAdoptionClaimed,false);
  assert.match(pack.candidates[0].copy,/not identity|independently verified|signer/i);
});
test('no human review, unverifiable consent or stale facts can automatically become ready', () => {
  assert.throws(()=>makeReviewedRadioPack([origin()],null,edition),/explicit editorial review/);
  assert.throws(()=>makeReviewedRadioPack([origin()],review({freshnessChecked:false}),edition),/freshness and publication consent/);
  assert.throws(()=>makeReviewedRadioPack([origin()],review({consentChecked:false}),edition),/freshness and publication consent/);
  assert.throws(()=>makeReviewedRadioPack([origin()],review({reviewedBy:'bot:automatic'}),edition),/reviewer must attest/);
});
test('signature tampering and substitution fail', () => {
  const x=origin(), tampered=structuredClone(x);tampered.payload.public.title='Counterfeit title';
  assert.throws(()=>prepareNeighborPorch([tampered]),/owner signature/);
  const signer=signNeed(x.payload,intruder);
  assert.throws(()=>prepareNeighborPorch([x, revision(x,{},intruder)]),/owner key changed/);
  assert.ok(prepareNeighborPorch([signer]));
});
test('history cannot skip revisions or fork', () => {
  const x=origin(), y=revision(x), z=revision(y);
  assert.equal(prepareNeighborPorch([x,y,z]).source.revision,3);
  assert.throws(()=>prepareNeighborPorch([x,z]),/stale, forked, or incomplete/);
  const divergent=revision(x,{status:'withdrawn'});
  assert.throws(()=>prepareNeighborPorch([x,y,divergent]),/stale, forked, or incomplete/);
});
test('historical withdrawn need stays verifiable but cannot form new radio invitation', () => {
  const x=origin(), withdrawn=revision(x,{status:'withdrawn'});
  assert.equal(inspectPortableNeed([x,withdrawn]).state,'withdrawn');
  assert.throws(()=>prepareNeighborPorch([x,withdrawn]),/withdrawn public needs/);
  assert.throws(()=>inspectPortableNeed([x,withdrawn,revision(withdrawn,{status:'open'})]),/withdrawn need reactivated/);
});
test('missing signed origin cannot be presented as portable continuity', () => {
  assert.throws(()=>inspectPortableNeed([revision(origin())]),/history lacks signed origin/);
  assert.throws(()=>inspectPortableNeed([]),/complete signed history/);
});
test('private fields, extra requirements fields, and unexpected envelope fields are refused', () => {
  const x=origin();
  assert.throws(()=>inspectPortableNeed([signNeed({...x.payload,privateContact:'do not leak'})]),/unexpected need fields/);
  assert.throws(()=>inspectPortableNeed([origin({email:'private@example.com'})]),/unexpected public manifest fields/);
  const reqs=structuredClone(x.payload.public.requirements);reqs[0].contact='123';
  assert.throws(()=>inspectPortableNeed([origin({requirements:reqs})]),/unexpected requirement fields/);
});
test('money-only campaigns do not get laundered into unvetted on-air donation appeals', () => {
  const m=origin({requirements:[{id:'fund-001',resource:'cash',quantity:100,unit:'usd',kind:'money'}]});
  assert.throws(()=>prepareNeighborPorch([m]),/no nonfinancial help requirement/);
});
test('bad public text, wrong units and HTML-capable resource tags are rejected', () => {
  const original=origin();
  assert.throws(()=>inspectPortableNeed([origin({title:''})]),/invalid public strings/);
  const reqs=structuredClone(original.payload.public.requirements);reqs[0].resource='<script>';
  assert.throws(()=>inspectPortableNeed([origin({requirements:reqs})]),/invalid resource token/);
});
test('the radio bridge does not consume the unchecked summary or title for producer copy', () => {
  const attacked=origin({title:'CALL 555-555-5555',summary:'Send private info to a malicious address'});
  const pack=makeReviewedRadioPack([attacked],review({disposition:'ready'}),edition);
  assert.doesNotMatch(pack.candidates[0].copy,/555-555|malicious/);
});
test('a signed snapshot cannot add an outsider-controlled donation link', () => {
  const p=origin(), withLink={...p.payload,public:{...p.payload.public,checkout:'https://untrusted.example/payment'}};
  assert.throws(()=>prepareNeighborPorch([signNeed(withLink)]),/unexpected public manifest fields/);
});
test('Kinship reference remains the sole explicitly station-owned source', () => {
  const pack=makeReviewedRadioPack([origin()],review(),edition);
  assert.deepEqual(pack.station.sourceRefs.map(r=>r.ref),['https://kinshipradio.org/main/']);
  assert.match(pack.candidates[0].sourceRefs[0].ref,/^urn:sha256:[a-f0-9]{64}$/);
});
