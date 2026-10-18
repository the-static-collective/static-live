// CHURCH COMMONS 003 — a church can stop licensing a public catalog.
// Owner-signed short leases apply to a COMPLETE, independently signed public edition.
// The mirror cannot indefinitely serve an old edition just because the origin is offline.
import { sign, verify, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { assertTenant, replay } from './core.mjs';
import { signPublicJournal, verifyPublicEnvelope } from './commons.mjs';

const SCHEMA = 'church-commons.publication-lease/v0.1';
const BUNDLE = 'church-commons.leased-public-edition/v0.1';
const MAX_LIFETIME_MS = 300_000;
const CLOCK_SKEW_MS = 5000;
const MAX_BYTES = 530_000;
const songId = s => typeof s === 'string' && /^[a-f0-9-]{36}$/.test(s);
const iso = ms => new Date(ms).toISOString();

function when(value) {
  if (typeof value !== 'string') throw new Error('Lease time must be ISO timestamp');
  const ms = Date.parse(value);
  if (!Number.isFinite(ms) || iso(ms) !== value) throw new Error('Noncanonical lease timestamp');
  return ms;
}
function checksum(value) {
  return Buffer.from(JSON.stringify(value), 'utf8');
}
function assertSignedBody(record, schema) {
  if (!record || Object.keys(record).sort().join(',') !== 'body,schema,signature' ||
      record.schema !== schema || !record.body ||
      typeof record.signature !== 'string' ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(record.signature))
    throw new Error('Invalid signed lease');
  const sig = Buffer.from(record.signature, 'base64');
  if (sig.length !== 64) throw new Error('Invalid lease signature length');
  return sig;
}
function withdrawnSongIds(journal, tenant) {
  const events = existsSync(journal)
    ? readFileSync(journal, 'utf8').split('\n').filter(Boolean).map(JSON.parse) : [];
  const state = replay(events, tenant);
  return state.songs
    .filter(s => s.status === 'WITHDRAWN' &&
      s.sharingApproval?.affirmed && s.sharingApproval.scope === 'PUBLIC_LYRICS_ONLY')
    .map(s => s.id).sort();
}
export function createLeasedEdition({ tenant, journalPath, edition, privateKeyPem,
  ttlSeconds = 60, nowMs = Date.now() }) {
  assertTenant(tenant);
  if (typeof privateKeyPem !== 'string' || !Number.isFinite(nowMs) ||
      !Number.isSafeInteger(ttlSeconds) || ttlSeconds < 1 ||
      ttlSeconds * 1000 > MAX_LIFETIME_MS)
    throw new Error('Invalid signing input or lease duration');
  const snapshot = signPublicJournal({ tenant, journalPath, edition, privateKeyPem });
  const withdrawals = withdrawnSongIds(journalPath, tenant);
  const active = new Set(snapshot.payload.songs.map(s => s.id));
  if (withdrawals.some(id => active.has(id))) throw new Error('Withdrawn song still published');
  const body = {
    tenant, edition, sha256: snapshot.sha256,
    issuedAt: iso(nowMs), expiresAt: iso(nowMs + ttlSeconds * 1000),
    withdrawnSongIds: withdrawals
  };
  const lease = { schema: SCHEMA, body,
    signature: sign(null, checksum(body), privateKeyPem).toString('base64') };
  return { schema: BUNDLE, snapshot, lease };
}
export function verifyLeasedEdition(bundle, tenant, publicKeyPem, nowMs = Date.now()) {
  assertTenant(tenant);
  if (!bundle || Object.keys(bundle).sort().join(',') !== 'lease,schema,snapshot' ||
      bundle.schema !== BUNDLE) throw new Error('Invalid leased edition');
  const bytes = checksum(bundle);
  if (bytes.length > MAX_BYTES) throw new Error('Leased edition too large');
  const snap = verifyPublicEnvelope(bundle.snapshot, tenant, publicKeyPem);
  const signature = assertSignedBody(bundle.lease, SCHEMA);
  const b = bundle.lease.body;
  if (Object.keys(b).sort().join(',') !== 'edition,expiresAt,issuedAt,sha256,tenant,withdrawnSongIds' ||
      b.tenant !== tenant || b.edition !== snap.edition || b.sha256 !== snap.sha256 ||
      !Array.isArray(b.withdrawnSongIds) || b.withdrawnSongIds.length > 100 ||
      b.withdrawnSongIds.some(x => !songId(x)) ||
      b.withdrawnSongIds.join('|') !== [...new Set(b.withdrawnSongIds)].sort().join('|') ||
      b.withdrawnSongIds.some(id => snap.songs.some(s => s.id === id)))
    throw new Error('Lease not bound to unique, correctly scoped public edition');
  const issued = when(b.issuedAt), expires = when(b.expiresAt);
  if (expires <= issued || expires - issued > MAX_LIFETIME_MS)
    throw new Error('Lease duration exceeds bounded permission');
  if (!Number.isFinite(nowMs) || issued - nowMs > CLOCK_SKEW_MS || nowMs >= expires)
    throw new Error('Publication lease not presently valid');
  if (!verify(null, checksum(b), publicKeyPem, signature))
    throw new Error('Untrusted publication lease');
  return { ...snap, issuedAt: issued, expiresAt: expires,
    withdrawnSongIds: b.withdrawnSongIds };
}
function respond(res, status, value, type = 'application/json') {
  res.writeHead(status, { 'Content-Type': type + '; charset=utf-8',
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; form-action 'none'" });
  res.end(typeof value === 'string' ? value : JSON.stringify(value));
}
function escape(s) {
  return String(s).replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;',
    '>': '&gt;', '"': '&quot;', "'": '&#39;' })[x]);
}
function page(tenant, songs) {
  return '<!doctype html><html lang="en"><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Church Commons — Approved Public Songs</title>' +
    '<h1>Church Commons — Approved Public Songs</h1><p>' + escape(tenant) +
    ' · temporary, owner-authorized public projection</p>' +
    (songs.map(s => '<article><h2>' + escape(s.title) + '</h2><pre>' +
      escape(s.lyrics) + '</pre></article>').join('') ||
      '<p>No currently licensed public songs.</p>') + '</html>';
}
async function limitedJson(req) {
  const parts = []; let bytes = 0;
  for await (const part of req) {
    bytes += part.length;
    if (bytes > MAX_BYTES) throw new Error('Edition too large');
    parts.push(part);
  }
  return JSON.parse(Buffer.concat(parts).toString('utf8'));
}
export function createLeasedMirror({ tenant, dataDir, trustedPublicKeyPem, clock = Date.now }) {
  assertTenant(tenant);
  if (!dataDir || typeof trustedPublicKeyPem !== 'string' ||
      typeof clock !== 'function') throw new Error('Owner public key and local custody required');
  mkdirSync(dataDir, { recursive: true });
  const file = join(dataDir, tenant + '.leased-edition.json');
  let current = null;
  let watermark = null;
  // Keep even expired bundles: they prove the most recent observed edition and
  // prevent accepting an old-but-currently-valid lease after process restart.
  if (existsSync(file)) {
    const saved = JSON.parse(readFileSync(file, 'utf8'));
    // Verify authenticity and structure at the original issue instant.
    const issueMs = when(saved?.lease?.body?.issuedAt);
    const verified = verifyLeasedEdition(saved, tenant, trustedPublicKeyPem, issueMs);
    current = saved;
    watermark = { edition: verified.edition, sha256: verified.sha256 };
  }
  const live = () => {
    if (!current) return null;
    try { return verifyLeasedEdition(current, tenant, trustedPublicKeyPem, clock()); }
    catch { return null; }
  };
  return createServer(async (req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (req.method === 'GET' && path === '/health') {
      const v = live();
      return respond(res, 200, { role: 'time-bounded-public-mirror', tenant,
        ready: !!v, edition: watermark?.edition ?? null,
        expiresAt: current?.lease?.body?.expiresAt ?? null });
    }
    if (req.method === 'GET' && path === '/public-bundle') {
      return live() ? respond(res, 200, current) : respond(res, 503,
        { status: 'HOLD', reason: 'No currently licensed public edition' });
    }
    if (req.method === 'GET' && path === '/api/' + tenant + '/songs') {
      const v = live();
      return v ? respond(res, 200, { songs: v.songs, edition: v.edition,
        expiresAt: current.lease.body.expiresAt }) :
        respond(res, 503, { status: 'HOLD', reason: 'Public license unavailable or expired' });
    }
    if (req.method === 'GET' && path === '/c/' + tenant) {
      const v = live();
      return v ? respond(res, 200, page(tenant, v.songs), 'text/html') :
        respond(res, 503, { status: 'HOLD', reason: 'Public license unavailable or expired' });
    }
    // Unlike Commons 001, no raw /public-snapshot bypass exists here.
    if (req.method !== 'POST' || path !== '/replicate')
      return respond(res, 404, { error: 'Not found' });
    if (req.headers.origin) return respond(res, 403, { error: 'Browser origin cannot publish' });
    try {
      const proposed = await limitedJson(req);
      const checked = verifyLeasedEdition(proposed, tenant, trustedPublicKeyPem, clock());
      if (watermark && (checked.edition < watermark.edition ||
          (checked.edition === watermark.edition &&
          checked.sha256 !== watermark.sha256)))
        return respond(res, 409, { error: 'Publication rollback or conflict rejected' });
      if (watermark && checked.edition === watermark.edition) {
        // Same edition cannot silently extend its permission window, either.
        if (JSON.stringify(proposed) !== JSON.stringify(current))
          return respond(res, 409, { error: 'Edition already has a distinct lease' });
        return respond(res, 200, { status: 'ALREADY_MIRRORED', edition: checked.edition });
      }
      const tmp = file + '.' + randomUUID() + '.tmp';
      writeFileSync(tmp, JSON.stringify(proposed), { mode: 0o600, flag: 'wx' });
      renameSync(tmp, file);
      watermark = { edition: checked.edition, sha256: checked.sha256 };
      current = proposed;
      return respond(res, 201, { status: 'MIRRORED', edition: checked.edition,
        withdrawnSongIds: checked.withdrawnSongIds,
        expiresAt: proposed.lease.body.expiresAt });
    } catch (error) {
      return respond(res, 400, { error: error?.message || 'Invalid publication' });
    }
  });
}
