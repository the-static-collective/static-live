// LIFESTREAM-001: manual, local-only Static Live <-> HOUSE carrier.
// No OBS control, stream keys, model calls, automatic publication or clock promotion.
import { createHash } from 'node:crypto';
import { closeSync, fstatSync, lstatSync, openSync, readFileSync, readSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { canonicalStringify } from './canonical-json.js';

const MOMENT = 'static-lifestream.moment/v0.1';
const RETURN = 'static-lifestream.return/v0.1';
const sha = (bytes) => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
const objectHash = (value) => sha(Buffer.from(canonicalStringify(value), 'utf8'));
function insist(ok, why) { if (!ok) throw new Error(why); }
function keysExactly(value, keys) {
  insist(value && typeof value === 'object' && !Array.isArray(value), 'expected object');
  insist(Object.keys(value).sort().join('|') === keys.slice().sort().join('|'), 'unexpected or missing fields');
}
function utc(value) {
  insist(typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value,
  'time must be an explicit millisecond-precision UTC instant');
}
function hex(value) { insist(typeof value === 'string' && /^sha256:[0-9a-f]{64}$/.test(value), 'invalid sha256 digest'); }
function safeToken(value, what) { insist(typeof value === 'string' && /^[A-Za-z0-9._:-]{1,120}$/.test(value), 'invalid ' + what); }
function verifiedBytes(sourceFile) {
  insist(!lstatSync(sourceFile).isSymbolicLink(), 'source symlink refused');
  const fd = openSync(sourceFile, 'r');
  try {
    const st = fstatSync(fd);
    insist(st.isFile() && st.size > 0, 'source must be a nonempty regular file');
    const hash = createHash('sha256'), buffer = Buffer.alloc(1024 * 1024);
    let count = 0, n;
    while ((n = readSync(fd, buffer, 0, buffer.length, null)) > 0) {
      hash.update(buffer.subarray(0, n)); count += n;
    }
    insist(count === st.size, 'source changed during read');
    return { sha256: 'sha256:' + hash.digest('hex'), byteLength: count };
  } finally { closeSync(fd); }
}
function checkClocks(witnesses) {
  insist(Array.isArray(witnesses) && witnesses.length <= 32, 'up to 32 independent clock witnesses permitted');
  for (const w of witnesses) {
    keysExactly(w, ['clockId','reading','basis','observedAtUtc','evidenceRef']);
    safeToken(w.clockId, 'clockId');
    insist(typeof w.reading === 'string' && w.reading.length <= 512, 'invalid clock reading');
    insist(typeof w.basis === 'string' && w.basis.length > 0 && w.basis.length <= 512, 'clock basis required');
    insist(typeof w.evidenceRef === 'string' && w.evidenceRef.length > 0 && w.evidenceRef.length <= 512, 'clock provenance required');
    utc(w.observedAtUtc);
  }
}
export function verifyMoment(moment, sourceFile) {
  keysExactly(moment, ['schema','eventId','source','span','time','clockWitnesses','momentId']);
  insist(moment.schema === MOMENT, 'unsupported moment schema');
  safeToken(moment.eventId, 'eventId');
  keysExactly(moment.source, ['sha256','byteLength']); hex(moment.source.sha256);
  insist(Number.isSafeInteger(moment.source.byteLength) && moment.source.byteLength > 0, 'invalid source length');
  keysExactly(moment.span, ['startMs','endMs']);
  insist(Number.isSafeInteger(moment.span.startMs) && moment.span.startMs >= 0
    && Number.isSafeInteger(moment.span.endMs) && moment.span.endMs > moment.span.startMs, 'invalid media span');
  keysExactly(moment.time, ['recordingStartedAtUtc','observedAtUtc']);
  utc(moment.time.recordingStartedAtUtc); utc(moment.time.observedAtUtc);
  checkClocks(moment.clockWitnesses);
  hex(moment.momentId);
  const { momentId, ...unsigned } = moment;
  insist(objectHash(unsigned) === momentId, 'moment manifest digest mismatch');
  insist(canonicalStringify(verifiedBytes(sourceFile)) === canonicalStringify(moment.source),
    'source bytes do not match moment');
  return moment;
}
export function createMoment({ eventId, sourceFile, startMs, endMs, recordingStartedAtUtc, observedAtUtc, clockWitnesses = [] }) {
  const unsigned = {
    schema: MOMENT, eventId, source: verifiedBytes(sourceFile),
    span: { startMs, endMs }, time: { recordingStartedAtUtc, observedAtUtc }, clockWitnesses
  };
  const moment = { ...unsigned, momentId: objectHash(unsigned) };
  return verifyMoment(moment, sourceFile);
}
export function verifyReturn(moment, returned, sourceFile) {
  verifyMoment(moment, sourceFile);
  keysExactly(returned, ['schema','momentId','artifact','review','effects','returnId']);
  insist(returned.schema === RETURN && returned.momentId === moment.momentId, 'return belongs to different moment');
  keysExactly(returned.artifact, ['kind','text','sha256','sourceMomentId']);
  insist(['lyric','journal','invention'].includes(returned.artifact.kind), 'unsupported artifact kind');
  insist(typeof returned.artifact.text === 'string' && returned.artifact.text.trim().length > 0
    && Buffer.byteLength(returned.artifact.text, 'utf8') <= 128 * 1024, 'invalid artifact text');
  hex(returned.artifact.sha256);
  insist(sha(Buffer.from(returned.artifact.text, 'utf8')) === returned.artifact.sha256, 'artifact bytes changed');
  insist(returned.artifact.sourceMomentId === moment.momentId, 'artifact source relation mismatch');
  keysExactly(returned.review, ['admittedBy','admittedAtUtc','disposition']);
  safeToken(returned.review.admittedBy, 'attribution');
  utc(returned.review.admittedAtUtc);
  insist(returned.review.disposition === 'reviewed_local_draft', 'not a reviewed local draft');
  keysExactly(returned.effects, ['broadcast','stage','publish']);
  insist(returned.effects.broadcast === false && returned.effects.stage === false &&
    returned.effects.publish === false, 'effectful return refused');
  hex(returned.returnId);
  const { returnId, ...unsigned } = returned;
  insist(objectHash(unsigned) === returnId, 'return digest mismatch');
  return { status: 'verified_return_not_performed', momentId: moment.momentId,
    returnId, artifactSha256: returned.artifact.sha256, kind: returned.artifact.kind,
    broadcast: false, stage: false, publish: false };
}
function args(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 2) {
    insist(argv[i]?.startsWith('--') && argv[i+1] !== undefined, 'expected --key value pairs');
    insist(!(argv[i].slice(2) in result), 'duplicate argument');
    result[argv[i].slice(2)] = argv[i+1];
  }
  return result;
}
function saveNew(path, payload) {
  insist(!path.endsWith('/') && basename(path) !== '.', 'invalid destination');
  const fd = openSync(path, 'wx', 0o600);
  try { writeFileSync(fd, JSON.stringify(payload, null, 2) + '\n', 'utf8'); } finally { closeSync(fd); }
}
export function main(argv = process.argv.slice(2)) {
  const [command, ...rest] = argv, a = args(rest);
  if (command === 'capture') {
    insist(['event','source','start-ms','end-ms','recording-started-at','observed-at','out'].every(k => k in a),
      'capture requires event, source, start-ms, end-ms, recording-started-at, observed-at, out');
    const clocks = a['clock-witnesses'] ? JSON.parse(readFileSync(a['clock-witnesses'],'utf8')) : [];
    const moment = createMoment({eventId:a.event, sourceFile:a.source, startMs:Number(a['start-ms']),
      endMs:Number(a['end-ms']), recordingStartedAtUtc:a['recording-started-at'],
      observedAtUtc:a['observed-at'], clockWitnesses:clocks});
    saveNew(a.out, moment);
    console.log(JSON.stringify({status:'moment_preserved_manifest_only',momentId:moment.momentId,out:a.out}));
  } else if (command === 'verify-return') {
    insist(['moment','return','source'].every(k => k in a), 'verify-return requires moment, return, source');
    const moment = JSON.parse(readFileSync(a.moment,'utf8'));
    const returned = JSON.parse(readFileSync(a.return,'utf8'));
    console.log(JSON.stringify(verifyReturn(moment, returned, a.source)));
  } else throw new Error('usage: capture | verify-return (local-only; never operates OBS)');
}
if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  try { main(); } catch (e) { console.error('LIFESTREAM-001 REFUSED:', e.message); process.exitCode = 1; }
}
