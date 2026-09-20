// LIFESTREAM-002: manually reconcile a durable mark with a finished, selected media file.
// There is deliberately no estimation/conversion from marker elapsed time to media offset.
import { createHash } from 'node:crypto';
import { readFileSync, openSync, writeFileSync, closeSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createMoment } from './lifestream-001.js';
import { canonicalStringify } from './canonical-json.js';

const fail = message => { throw new Error(message); };
function loadMark(journalFile, markId) {
  const stat = statSync(journalFile);
  if (!stat.isFile() || stat.size > 2_000_000 || stat.size === 0) fail('private marker journal missing or exceeds 2 MB');
  const bytes = readFileSync(journalFile,'utf8');
  if (!bytes.endsWith('\n')) fail('incomplete marker journal line');
  const lines = bytes.trimEnd().split('\n');
  if (lines.length > 10010) fail('marker journal has too many entries');
  const matches = [];
  const sessions = new Map();
  for (const line of lines) {
    if (line.length > 4096) fail('oversized marker journal line');
    const obj = JSON.parse(line);
    if (obj.schema !== 'static-lifestream.mark/v0.1') fail('unsupported marker journal schema');
    if (obj.type === 'recording-confirmed-observation') {
      if (sessions.has(obj.sessionId)) fail('duplicate session confirmation');
      sessions.set(obj.sessionId, obj.eventId);
    } else if (obj.type === 'candidate') {
      if (obj.markId === markId) matches.push(obj);
    } else fail('unknown journal entry type');
  }
  if (matches.length !== 1) fail('marker ID must identify exactly one observation');
  const mark = matches[0];
  if (sessions.get(mark.sessionId) !== mark.eventId) fail('marker has no matching recording-confirmed observation');
  if (!Number.isSafeInteger(mark.approximateElapsedSinceConfirmationMs) ||
      mark.approximateElapsedSinceConfirmationMs < 0) fail('marker has invalid approximate elapsed time');
  if (!/^[-a-zA-Z0-9._:]{1,120}$/.test(mark.eventId)) fail('invalid marker event id');
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(mark.observedAtUtc)) fail('marker UTC instant invalid');
  if (mark.offsetBasis !== 'local monotonic clock since controller-observed recording confirmation; NOT verified OBS media offset')
    fail('marker basis mismatch');
  return mark;
}
export function finalizeMarker({ journalFile, markId, recordingFile, startMs, endMs,
  recordingStartedAtUtc, outFile, recordingFinished=false, clockWitnesses=[] }) {
  if (recordingFinished !== true) fail('explicit --recording-finished declaration required');
  const mark = loadMark(journalFile,markId);
  if (!Array.isArray(clockWitnesses) || clockWitnesses.length > 31) fail('too many additional clocks');
  const evidenceHash = 'sha256:' + createHash('sha256').update(canonicalStringify(mark)).digest('hex');
  const markWitness = {
    clockId: 'static-live.monotonic-mark',
    reading: 'elapsed-since-confirmation-ms=' + mark.approximateElapsedSinceConfirmationMs,
    basis: 'Marker monotonic observation only; manually declared media span is independent and NOT inferred from this clock',
    observedAtUtc: mark.observedAtUtc,
    evidenceRef: 'static-live.mark:' + mark.markId + ':' + evidenceHash
  };
  const moment = createMoment({
    eventId: mark.eventId, sourceFile: recordingFile, startMs, endMs,
    recordingStartedAtUtc, observedAtUtc: mark.observedAtUtc,
    clockWitnesses: [markWitness, ...clockWitnesses]
  });
  // Exclusive create and private permissions: no silent overwrite of a previous receipt.
  const fd = openSync(outFile, 'wx', 0o600);
  try { writeFileSync(fd, JSON.stringify(moment,null,2) + '\n','utf8'); }
  finally { closeSync(fd); }
  return {status:'manual_media_alignment_declared_not_measured',momentId:moment.momentId,
    markId: mark.markId, markerApproxElapsedMs: mark.approximateElapsedSinceConfirmationMs,
    declaredMediaSpan:moment.span, sourceSha256:moment.source.sha256, outFile};
}
function cli(argv) {
  const [command,...rest]=argv;
  if(command !== 'finalize') fail('usage: finalize --journal FILE --mark-id UUID --source FINISHED_FILE --start-ms INTEGER --end-ms INTEGER --recording-started-at UTC --recording-finished --out NEW_JSON [--clock-witnesses JSON_FILE]');
  const a={};
  for(let i=0;i<rest.length;i++){
    const k=rest[i];if(!k.startsWith('--')||Object.hasOwn(a,k))fail('unexpected or duplicate flag');
    if(k==='--recording-finished'){a[k]=true;continue;}
    if(i+1 >=rest.length||rest[i+1].startsWith('--'))fail('missing flag value');
    a[k]=rest[++i];
  }
  for(const k of ['--journal','--mark-id','--source','--start-ms','--end-ms','--recording-started-at','--out','--recording-finished'])
    if(!(k in a))fail('missing '+k);
  const allowed=new Set(['--journal','--mark-id','--source','--start-ms','--end-ms','--recording-started-at','--out','--recording-finished','--clock-witnesses']);
  for(const k of Object.keys(a))if(!allowed.has(k))fail('unknown '+k);
  const clocks=a['--clock-witnesses']?JSON.parse(readFileSync(a['--clock-witnesses'],'utf8')):[];
  return finalizeMarker({journalFile:a['--journal'],markId:a['--mark-id'],recordingFile:a['--source'],
    startMs:Number(a['--start-ms']),endMs:Number(a['--end-ms']),
    recordingStartedAtUtc:a['--recording-started-at'],outFile:a['--out'],
    recordingFinished:a['--recording-finished'],clockWitnesses:clocks});
}
if(process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url){
  try {console.log(JSON.stringify(cli(process.argv.slice(2))));}
  catch(e){console.error('LIFESTREAM-002 REFUSED:',e.message);process.exitCode=1;}
}
