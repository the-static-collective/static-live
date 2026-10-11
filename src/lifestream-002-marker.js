// LIFESTREAM-002: durable observation markers, not source/media-time claims.
import { randomUUID } from 'node:crypto';
import { closeSync, fstatSync, fsyncSync, lstatSync, openSync, writeSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

function appendNewline(path, object) {
  // A configured private journal, never a caller-supplied HTTP path.
  // O_NOFOLLOW rejects symlink journal substitution on Linux.
  const flags = 0x1 | 0x400 | 0x40 | (process.platform === 'linux' ? 0x20000 : 0);
  const fd = openSync(path, flags, 0o600);
  try {
    if (!fstatSync(fd).isFile()) throw new Error('marker journal must be a regular file');
    const bytes = Buffer.from(JSON.stringify(object) + '\n','utf8');
    let offset = 0;
    while (offset < bytes.length) {
      const n = writeSync(fd, bytes, offset, bytes.length - offset);
      if (n <= 0) throw new Error('marker journal write was incomplete');
      offset += n;
    }
    fsyncSync(fd);
  } finally { closeSync(fd); }
}
function utcNow() { return new Date().toISOString(); }

export function createMomentMarker({ journalPath, eventId, now = utcNow, tick = () => performance.now() }) {
  if (typeof journalPath !== 'string' || !journalPath.trim()) throw new TypeError('private marker journal path required');
  if (!/^[A-Za-z0-9._:-]{1,120}$/.test(eventId)) throw new TypeError('event id invalid');
  // Fail before the live session starts if an existing journal is a symlink.
  try { if (lstatSync(journalPath).isSymbolicLink()) throw new Error('marker journal symlink refused'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  let session = null;
  let sequence = 0;
  const limit = 1000;
  const knownMarks = new Map();
  const attention = new Map();
  function begin() {
    if (session) return session.id;
    const candidate = { id: randomUUID(), tick: tick(), utc: now() };
    appendNewline(journalPath, {
      schema: 'static-lifestream.mark/v0.1', type: 'recording-confirmed-observation',
      eventId, sessionId: candidate.id, observedAtUtc: candidate.utc,
      basis: 'Static Broadcast observed OBS recording confirmed; not media start time'
    });
    session = candidate;
    return session.id;
  }
  function mark(currentStatus) {
    if (!currentStatus?.recording || !['recording','recording_only','live'].includes(currentStatus.state)) {
      throw new Error('MARK MOMENT requires confirmed active recording');
    }
    if (!session) throw new Error('recording confirmation marker unavailable');
    if (sequence >= limit) throw new Error('session marker limit reached');
    const t = tick();
    if (!Number.isFinite(t) || t < session.tick) throw new Error('monotonic marker clock unavailable');
    const observedAtUtc = now();
    const marker = {
      schema: 'static-lifestream.mark/v0.1', type: 'candidate',
      eventId, sessionId: session.id, markId: randomUUID(),
      sequence: sequence + 1,
      observedAtUtc,
      approximateElapsedSinceConfirmationMs: Math.floor(t - session.tick),
      offsetBasis: 'local monotonic clock since controller-observed recording confirmation; NOT verified OBS media offset',
      sourceStatus: currentStatus.state,
      clockWitnesses: []
    };
    appendNewline(journalPath, marker); // failed write never returns a success receipt
    sequence += 1;
    knownMarks.set(marker.markId, marker);
    return marker;
  }
  function attend({markId, dimensions, explicitNone = false, expectedPreviousId = null} = {}) {
    const target = knownMarks.get(markId);
    if (!target || !session || target.sessionId !== session.id)
      throw new Error('attention requires a mark from this marker session');
    const available = ['joyful','useful','curiouser'];
    if (!Array.isArray(dimensions) || dimensions.length > 3 ||
        dimensions.some(value => !available.includes(value)) ||
        new Set(dimensions).size !== dimensions.length)
      throw new Error('attention dimensions must be distinct Joyful / Useful / Curiouser values');
    if (typeof explicitNone !== 'boolean' || (explicitNone && dimensions.length))
      throw new Error('explicit none cannot contain dimensions');
    const previous = attention.get(markId) || null;
    if ((previous?.id || null) !== expectedPreviousId)
      throw new Error('stale attention declaration; inspect current mark before revising');
    const selected = available.filter(value => dimensions.includes(value));
    if (previous && previous.explicitNone === explicitNone &&
        JSON.stringify(previous.dimensions) === JSON.stringify(selected)) return previous;
    const declaration = {
      schema:'static-live.attention-crossing/v0.1', type:'human-attention-declaration',
      id:randomUUID(), createdAtUtc:now(), eventId, sessionId:session.id, markId,
      dimensions:selected, explicitNone, previousId:previous?.id || null,
      basis:'explicit operator declaration on observed mark; not verified OBS media offset',
      authority:'human-declared/local-only'
    };
    appendNewline(journalPath, declaration);
    attention.set(markId, declaration);
    return declaration;
  }
  return { begin, mark, attend, getStatus: () => ({ enabled: true, sessionId: session?.id ?? null, marks: sequence }) };
}
