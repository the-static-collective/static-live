import { createHash, verify as edVerify } from 'node:crypto';
import { closeSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { compileKinshipPilot } from './kinship-001.js';

const NEED_SCHEMA = 'jubilee-portable/0.1';
const PORCH_SCHEMA = 'kinship.jubilee-neighbor-door/v0.1';
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:._-]{2,127}$/;
const RESOURCE_PATTERN = /^[a-z0-9][a-z0-9_-]{1,63}$/;
const kinds = new Set(['goods', 'service', 'money']);
const only = (v, fields) => v && typeof v === 'object' && !Array.isArray(v) &&
  Object.keys(v).length === fields.length && Object.keys(v).every(k => fields.includes(k));
function check(ok, message) { if (!ok) throw new Error('KINSHIP-TREASURY REFUSED: ' + message); }
function canonical(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  check(value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype, 'nonportable JSON');
  return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
}
function sha256(v) { return createHash('sha256').update(canonical(v)).digest('hex'); }
function bounded(v, max) { return typeof v === 'string' && v.trim().length > 0 && v.length <= max; }
function positive(v) { return Number.isSafeInteger(v) && v >= 1 && v <= 1000000; }

function validateRevision(signed) {
  check(only(signed, ['version','type','payload','publicKey','signature']), 'unexpected signed envelope fields');
  check(signed.version === NEED_SCHEMA && signed.type === 'need', 'not a Treasury signed need');
  check(bounded(signed.publicKey, 2048) && bounded(signed.signature, 200), 'invalid signing fields');
  const p = signed.payload;
  check(only(p, ['id','revision','previousHash','status','public']), 'unexpected need fields');
  check(ID_PATTERN.test(p.id) && positive(p.revision), 'invalid need identity or revision');
  check(p.revision === 1 ? p.previousHash === null : typeof p.previousHash === 'string' && HASH_PATTERN.test(p.previousHash), 'invalid predecessor');
  check(['open','withdrawn'].includes(p.status), 'invalid need state');
  const visible = p.public;
  check(only(visible, ['title','summary','region','requirements']), 'unexpected public manifest fields');
  check(bounded(visible.title,220) && bounded(visible.summary,1200) && bounded(visible.region,70), 'invalid public strings');
  check(Array.isArray(visible.requirements) && visible.requirements.length > 0 && visible.requirements.length <= 20, 'invalid requirement list');
  const used = new Set();
  for (const req of visible.requirements) {
    check(only(req, ['id','resource','quantity','unit','kind']), 'unexpected requirement fields');
    check(typeof req.id === 'string' && ID_PATTERN.test(req.id) && !used.has(req.id), 'invalid or duplicate requirement');
    used.add(req.id);
    check(typeof req.resource === 'string' && RESOURCE_PATTERN.test(req.resource), 'invalid resource token');
    check(typeof req.unit === 'string' && RESOURCE_PATTERN.test(req.unit), 'invalid unit token');
    check(positive(req.quantity) && kinds.has(req.kind), 'invalid quantity or kind');
  }
  let valid = false;
  try {
    const sig = Buffer.from(signed.signature,'base64');
    const { signature, ...unsigned } = signed;
    valid = sig.length === 64 && sig.toString('base64') === signature &&
      edVerify(null, Buffer.from('JUBILEE-PORTABLE-V0.1\n' + canonical(unsigned)), signed.publicKey, sig);
  } catch { valid = false; }
  check(valid, 'invalid owner signature');
  return p;
}

// Validate a complete history. A mirror is not a station, an identity issuer, or the need owner.
export function inspectPortableNeed(bundle) {
  check(Array.isArray(bundle) && bundle.length >= 1 && bundle.length <= 128, 'complete signed history required');
  check(Buffer.byteLength(JSON.stringify(bundle)) <= 300000, 'bundle too large');
  let last;
  for (const revision of bundle) {
    const p = validateRevision(revision);
    if (!last) {
      check(p.revision === 1 && p.previousHash === null, 'history lacks signed origin');
    } else {
      check(revision.publicKey === last.publicKey, 'owner key changed');
      check(last.payload.status === 'open', 'withdrawn need reactivated');
      check(p.id === last.payload.id, 'different need identity');
      check(p.revision === last.payload.revision + 1 && p.previousHash === sha256(last), 'stale, forked, or incomplete history');
    }
    last = revision;
  }
  return { needId: last.payload.id, revision: last.payload.revision, state: last.payload.status,
    headHash: sha256(last), requirements: structuredClone(last.payload.public.requirements) };
}

// This is the only operation that can occur without a human producer.
export function prepareNeighborPorch(bundle) {
  const source = inspectPortableNeed(bundle);
  check(source.state === 'open', 'withdrawn public needs cannot be proposed as current invitations');
  const resources = source.requirements.filter(r => r.kind !== 'money').map(r => ({
    resource: r.resource, quantity: r.quantity, unit: r.unit, kind: r.kind
  }));
  check(resources.length > 0, 'no nonfinancial help requirement for community radio');
  return {
    schema: PORCH_SCHEMA, status: 'held_for_human_review',
    source: { protocol: NEED_SCHEMA, needId: source.needId, revision: source.revision, sha256: source.headHash,
      signerProof: 'cryptographic_key_continuity_only_not_verified_person_or_need' },
    resourcePossibilities: resources,
    privateContactImport: false, donorInformationImport: false, prayerRequestImport: false,
    paymentImport: false, broadcast: false, publish: false, stationAdoption: false,
    notice: 'Owner-signed public data is a claim, not proof of need, identity, freshness, permission, or a safe action route. No station or recipient consent is inferred.'
  };
}

// Only a separately declared human review may make an existing KINSHIP-001 candidate.
// Even ready remains producer-preparation, not Kinship station approval or broadcast.
export function makeReviewedRadioPack(bundle, review, edition) {
  const porch = prepareNeighborPorch(bundle);
  check(only(review, ['disposition','reviewedBy','reviewedAtUtc','note','freshnessChecked','consentChecked']), 'explicit editorial review required');
  check(['ready','hold','reject'].includes(review.disposition), 'invalid disposition');
  check(review.freshnessChecked === true && review.consentChecked === true, 'freshness and publication consent need human checks');
  check(typeof review.reviewedBy === 'string' && review.reviewedBy.startsWith('human:'), 'reviewer must attest as human');
  check(only(edition, ['id','localDate','intendedUse']), 'bounded edition required');
  const items = porch.resourcePossibilities.map(v => v.quantity + ' ' + v.unit.replaceAll('_',' ') + ' of ' + v.resource.replaceAll('_',' ')).join('; ');
  const candidate = {
    id: 'treasury-neighbor-door-' + porch.source.sha256.slice(0,16),
    kind: 'community-door',
    title: 'Possible neighbor-help invitation',
    claimMode: 'derived',
    copy: 'PRODUCER LEAD ONLY. Public-key signed, self-attested request for: ' + items +
      '. Need identity, consent, location, current status, safe response route and editorial suitability independently verified before air. No payment destination or private listener details were imported. Human producer decides whether and how to speak.',
    sourceRefs: [{ ref: 'urn:sha256:' + porch.source.sha256,
      label: 'Jubilee Treasury signed public need revision ' + porch.source.revision + ' (signer not identity verified)',
      authority: 'collective-receipt' }],
    review: { disposition: review.disposition, reviewedBy: review.reviewedBy,
      reviewedAtUtc: review.reviewedAtUtc, note: review.note }
  };
  const pack = compileKinshipPilot({
    schema: 'static-live.kinship-pilot-input/v0.1',
    station: { id: 'kinship-radio', name: 'Kinship Radio',
      sourceRefs: [{ ref: 'https://kinshipradio.org/main/', label: 'Kinship public home (not an endorsement of this request)', authority: 'station-public' }] },
    edition, candidates: [candidate]
  });
  return { ...pack, treasuryProvenance: porch.source, routing: {
    externalPayment: false, listenerData: false, officialGivingUnchanged: true,
    aired: false, adoption: false, actionRouteProven: false
  } };
}

function writeExclusive(path, payload) {
  const fd = openSync(path, 'wx', 0o600);
  try { writeFileSync(fd, JSON.stringify(payload, null, 2) + '\n'); }
  finally { closeSync(fd); }
}

// Usage: node src/kinship-treasury-006.js porch signed-bundle.json new-file.json
// Or: node src/kinship-treasury-006.js pack signed-bundle.json review.json edition.json new-file.json
export function main(argv = process.argv.slice(2)) {
  const [command, ...args] = argv;
  check((command === 'porch' && args.length === 2) || (command === 'pack' && args.length === 4), 'usage: porch BUNDLE OUT or pack BUNDLE REVIEW EDITION OUT');
  const bundle = JSON.parse(readFileSync(args[0], 'utf8'));
  const result = command === 'porch' ? prepareNeighborPorch(bundle) :
    makeReviewedRadioPack(bundle, JSON.parse(readFileSync(args[1], 'utf8')), JSON.parse(readFileSync(args[2], 'utf8')));
  writeExclusive(args.at(-1), result);
  console.log(JSON.stringify({ output: args.at(-1), broadcast: false, status: command === 'porch' ? 'hold' : 'producer_review_only' }));
}
if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
