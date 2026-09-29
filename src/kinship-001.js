import { createHash } from 'node:crypto';
import { closeSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { canonicalStringify } from './canonical-json.js';

const INPUT_SCHEMA = 'static-live.kinship-pilot-input/v0.1';
const OUTPUT_SCHEMA = 'static-live.kinship-radio-pack/v0.1';
const KINDS = new Set(['calendar', 'community-door', 'scripture-reference', 'story-lead', 'station-note']);
const CLAIM_MODES = new Set(['observed', 'derived', 'interpretation', 'metaphor']);
const DISPOSITIONS = new Set(['ready', 'hold', 'reject']);
const SOURCE_AUTHORITIES = new Set([
  'station-public',
  'scripture-reference',
  'human-witness',
  'alex-source',
  'collective-receipt',
]);

const sha256 = value => 'sha256:' + createHash('sha256').update(value).digest('hex');
const insist = (ok, message) => { if (!ok) throw new Error(message); };
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const token = (value, label) => {
  insist(typeof value === 'string' && /^[A-Za-z0-9._:-]{1,160}$/.test(value), `invalid ${label}`);
  return value;
};
const text = (value, label, max = 4000) => {
  insist(typeof value === 'string' && value.trim().length > 0 && value.length <= max, `invalid ${label}`);
  return value.trim();
};
const utc = value => {
  insist(typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value), 'review time must be millisecond UTC');
  insist(Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value, 'review time must be valid UTC');
  return value;
};

function normalizeSourceRef(source, candidateId) {
  insist(object(source), `candidate ${candidateId} source reference must be an object`);
  const ref = text(source.ref, `candidate ${candidateId} source ref`, 1200);
  const label = text(source.label, `candidate ${candidateId} source label`, 300);
  insist(SOURCE_AUTHORITIES.has(source.authority), `candidate ${candidateId} source authority unsupported`);
  return { ref, label, authority: source.authority };
}

function normalizeCandidate(candidate) {
  insist(object(candidate), 'candidate must be an object');
  const id = token(candidate.id, 'candidate id');
  insist(KINDS.has(candidate.kind), `candidate ${id} kind unsupported`);
  insist(CLAIM_MODES.has(candidate.claimMode), `candidate ${id} claim mode unsupported`);
  const title = text(candidate.title, `candidate ${id} title`, 200);
  const copy = text(candidate.copy, `candidate ${id} copy`, 2500);
  insist(Array.isArray(candidate.sourceRefs) && candidate.sourceRefs.length > 0 && candidate.sourceRefs.length <= 12,
    `candidate ${id} requires 1..12 source references`);
  const sourceRefs = candidate.sourceRefs.map(source => normalizeSourceRef(source, id));

  if (candidate.kind === 'scripture-reference') {
    insist(sourceRefs.some(source => source.authority === 'scripture-reference'),
      `candidate ${id} scripture reference requires scripture-reference authority`);
  }

  insist(object(candidate.review), `candidate ${id} requires explicit human review`);
  insist(DISPOSITIONS.has(candidate.review.disposition), `candidate ${id} review disposition unsupported`);
  const reviewedBy = token(candidate.review.reviewedBy, `candidate ${id} reviewer`);
  const reviewedAtUtc = utc(candidate.review.reviewedAtUtc);
  const note = candidate.review.note == null ? null : text(candidate.review.note, `candidate ${id} review note`, 1000);

  return {
    id,
    kind: candidate.kind,
    title,
    copy,
    claimMode: candidate.claimMode,
    sourceRefs,
    review: {
      disposition: candidate.review.disposition,
      reviewedBy,
      reviewedAtUtc,
      note,
    },
  };
}

export function compileKinshipPilot(input) {
  insist(object(input), 'pilot input must be an object');
  insist(input.schema === INPUT_SCHEMA, 'unsupported Kinship pilot input schema');
  insist(object(input.station), 'station declaration required');
  const station = {
    id: token(input.station.id, 'station id'),
    name: text(input.station.name, 'station name', 200),
  };
  insist(station.id === 'kinship-radio', 'KINSHIP-001 is scoped only to Kinship Radio');
  insist(Array.isArray(input.station.sourceRefs) && input.station.sourceRefs.length > 0,
    'station public source references required');
  station.sourceRefs = input.station.sourceRefs.map(source => normalizeSourceRef(source, 'station'));

  insist(object(input.edition), 'edition declaration required');
  const edition = {
    id: token(input.edition.id, 'edition id'),
    localDate: text(input.edition.localDate, 'edition local date', 32),
    intendedUse: text(input.edition.intendedUse, 'edition intended use', 240),
  };

  insist(Array.isArray(input.candidates) && input.candidates.length > 0 && input.candidates.length <= 24,
    'pilot requires 1..24 bounded candidates');
  const candidates = input.candidates.map(normalizeCandidate);
  insist(new Set(candidates.map(candidate => candidate.id)).size === candidates.length, 'candidate ids must be unique');

  const ready = candidates.filter(candidate => candidate.review.disposition === 'ready');
  const packUnsigned = {
    schema: OUTPUT_SCHEMA,
    station,
    edition,
    candidates,
    airableSegmentIds: ready.map(candidate => candidate.id),
    heldSegmentIds: candidates.filter(candidate => candidate.review.disposition === 'hold').map(candidate => candidate.id),
    rejectedSegmentIds: candidates.filter(candidate => candidate.review.disposition === 'reject').map(candidate => candidate.id),
    boundaries: {
      broadcast: false,
      publish: false,
      obsControl: false,
      prayerRequestIngest: false,
      listenerIdentityInference: false,
      stationAdoptionClaimed: false,
      note: 'ready means reviewed candidate for a Kinship human producer/host; it does not mean aired, approved by Kinship, or published',
    },
  };

  return {
    ...packUnsigned,
    receiptId: sha256(Buffer.from(canonicalStringify(packUnsigned), 'utf8')),
  };
}

function args(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    insist(argv[index]?.startsWith('--') && argv[index + 1] !== undefined, 'expected --key value pairs');
    const key = argv[index].slice(2);
    insist(!(key in result), `duplicate argument ${key}`);
    result[key] = argv[index + 1];
  }
  return result;
}

function writeExclusive(path, payload) {
  const fd = openSync(path, 'wx', 0o600);
  try { writeFileSync(fd, JSON.stringify(payload, null, 2) + '\n', 'utf8'); }
  finally { closeSync(fd); }
}

export function main(argv = process.argv.slice(2)) {
  const [command, ...rest] = argv;
  insist(command === 'compile', 'usage: compile --input FILE --out NEW_FILE');
  const a = args(rest);
  insist(a.input && a.out, 'compile requires --input and --out');
  const input = JSON.parse(readFileSync(a.input, 'utf8'));
  const pack = compileKinshipPilot(input);
  writeExclusive(a.out, pack);
  console.log(JSON.stringify({ status: 'reviewed_radio_pack_not_broadcast', receiptId: pack.receiptId, out: a.out }));
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  try { main(); }
  catch (error) { console.error('KINSHIP-001 REFUSED:', error.message); process.exitCode = 1; }
}
