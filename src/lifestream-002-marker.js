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
    return marker;
  }
  return { begin, mark, getStatus: () => ({ enabled: true, sessionId: session?.id ?? null, marks: sequence }) };
}
