// CHURCH COMMONS 001: bounded, church-authorized public-only mirrors.
// No private seed journal, reviewer credential, stem, or unrestricted task transport crosses.
import { createHash, randomUUID, sign, verify } from 'node:crypto';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertTenant, replay, toRelattePublicProjection } from './core.mjs';

const ENVELOPE = 'church-commons.signed-mirror/v0.1';
const PUBLIC = 'church-commons.public-hymnal/v0.1';
const MAX_BYTES = 512_000;
const MAX_SONGS = 100;

function checksum(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
function bytesOf(payload) {
  return Buffer.from(JSON.stringify(payload), 'utf8');
}
function projectionOk(song) {
  if (!song || typeof song !== 'object' || Array.isArray(song)) return false;
  if (Object.keys(song).sort().join(',') !== 'bpm,id,lyrics,meter,scriptureRef,title') return false;
  return typeof song.id === 'string' && /^[a-f0-9-]{36}$/.test(song.id) &&
    typeof song.title === 'string' && song.title.length > 0 && song.title.length <= 120 &&
    typeof song.lyrics === 'string' && song.lyrics.length >= 8 && song.lyrics.length <= 12000 &&
    typeof song.scriptureRef === 'string' && song.scriptureRef.length <= 120 &&
    Number.isInteger(song.bpm) && song.bpm >= 40 && song.bpm <= 240 &&
    ['4/4', '3/4', '6/8', '12/8', '2/4'].includes(song.meter);
}

// Reads an *existing* Living Hymnal journal, never modifies its human approvals.
// A local PUBLIC_LYRICS permission alone is insufficient for interchurch mirroring.
export function signPublicJournal({ tenant, journalPath, edition, privateKeyPem }) {
  assertTenant(tenant);
  if (!Number.isSafeInteger(edition) || edition < 1) throw new Error('Invalid edition');
  if (typeof privateKeyPem !== 'string') throw new Error('Owner signing key required');
  const events = existsSync(journalPath)
    ? readFileSync(journalPath, 'utf8').split('\n').filter(Boolean).map(JSON.parse) : [];
  const state = replay(events, tenant);
  const songs = state.songs
    .filter(song => song.sharingApproval?.affirmed === true &&
      song.sharingApproval?.scope === 'PUBLIC_LYRICS_ONLY')
    .map(toRelattePublicProjection)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (songs.length > MAX_SONGS || songs.some(song => !projectionOk(song)))
    throw new Error('Public projection limits exceeded');
  const payload = { schema: PUBLIC, tenant, edition, songs };
  const bytes = bytesOf(payload);
  if (bytes.length > MAX_BYTES) throw new Error('Public snapshot too large');
  const envelope = { schema: ENVELOPE, payload, sha256: checksum(bytes),
    signature: sign(null, bytes, privateKeyPem).toString('base64') };
  // The signature attests to the owner key, not human identity or actual license validity.
  verifyPublicEnvelope(envelope, tenant, undefined, { skipSignature: true });
  return envelope;
}

// Mirrors trust a pinned public key, not a self-declared sender or network address.
export function verifyPublicEnvelope(envelope, tenant, publicKeyPem, { skipSignature = false } = {}) {
  assertTenant(tenant);
  if (!envelope || Object.keys(envelope).sort().join(',') !== 'payload,schema,sha256,signature' ||
      envelope.schema !== ENVELOPE) throw new Error('Invalid signed envelope');
  const p = envelope.payload;
  if (!p || Object.keys(p).sort().join(',') !== 'edition,schema,songs,tenant' ||
      p.schema !== PUBLIC || p.tenant !== tenant ||
      !Number.isSafeInteger(p.edition) || p.edition < 1 ||
      !Array.isArray(p.songs) || p.songs.length > MAX_SONGS ||
      p.songs.some(song => !projectionOk(song)) ||
      new Set(p.songs.map(song => song.id)).size !== p.songs.length)
    throw new Error('Invalid public-only payload');
  const bytes = bytesOf(p);
  if (bytes.length > MAX_BYTES || checksum(bytes) !== envelope.sha256)
    throw new Error('Public content digest mismatch');
  if (typeof envelope.signature !== 'string' ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(envelope.signature))
    throw new Error('Invalid signature encoding');
  const sig = Buffer.from(envelope.signature, 'base64');
  if (sig.length !== 64) throw new Error('Invalid Ed25519 signature');
  if (!skipSignature && (typeof publicKeyPem !== 'string' ||
      !verify(null, bytes, publicKeyPem, sig)))
    throw new Error('Untrusted or altered public snapshot');
  return { edition: p.edition, sha256: envelope.sha256, songs: p.songs };
}

function respond(res, code, body, contentType = 'application/json') {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(code, { 'Content-Type': contentType + '; charset=utf-8',
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; form-action 'none'; frame-ancestors 'none'" });
  res.end(raw);
}
function htmlEscape(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
function renderHymnal(tenant, songs) {
  const items = songs.map(s =>
    '<article><h2>' + htmlEscape(s.title) + '</h2><p>' +
    htmlEscape(s.scriptureRef) + '</p><pre>' + htmlEscape(s.lyrics) + '</pre></article>').join('');
  return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" ' +
    'content="width=device-width,initial-scale=1"><title>Shared Living Hymnal</title>' +
    '<style>body{font:1.1rem system-ui;max-width:50rem;margin:2rem auto;padding:0 1rem;' +
    'line-height:1.6}pre{white-space:pre-wrap;font:inherit}article{border-top:1px solid #777;' +
    'margin-top:2rem}small{color:#555}</style><h1>Shared Living Hymnal</h1><small>' +
    htmlEscape(tenant) + ' · signed public-song mirror · read only</small>' +
    (items || '<p>No interchurch-approved songs in this edition.</p>') + '</html>';
}

async function readBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BYTES + 2048) throw new Error('Snapshot too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function createCommonsMirror({ tenant, dataDir, trustedPublicKeyPem }) {
  assertTenant(tenant);
  if (typeof trustedPublicKeyPem !== 'string' || !dataDir)
    throw new Error('Pinned owner public key and independent mirror directory required');
  mkdirSync(dataDir, { recursive: true });
  const snapshotPath = join(dataDir, tenant + '.public-snapshot.json');
  let current = null;
  if (existsSync(snapshotPath)) {
    const saved = JSON.parse(readFileSync(snapshotPath, 'utf8'));
    current = { envelope: saved, ...verifyPublicEnvelope(saved, tenant, trustedPublicKeyPem) };
  }
  return createServer(async (req, res) => {
    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      if (req.method === 'GET' && path === '/health')
        return respond(res, 200, { role: 'read-only-public-mirror', tenant, ready: !!current,
          edition: current?.edition ?? null, sha256: current?.sha256 ?? null });
      if (req.method === 'GET' && path === '/api/' + tenant + '/songs')
        return respond(res, current ? 200 : 503,
          current ? { songs: current.songs, edition: current.edition } : { error: 'No verified snapshot' });
      if (req.method === 'GET' && path === '/c/' + tenant)
        return current
          ? respond(res, 200, renderHymnal(tenant, current.songs), 'text/html')
          : respond(res, 503, { error: 'No verified snapshot' });
      if (req.method !== 'POST' || path !== '/replicate')
        return respond(res, 404, { error: 'Not found' });
      if (req.headers.origin) return respond(res, 403, { error: 'Browser-origin writes disabled' });
      const nextEnvelope = await readBody(req);
      const next = verifyPublicEnvelope(nextEnvelope, tenant, trustedPublicKeyPem);
      if (current && next.edition < current.edition)
        return respond(res, 409, { error: 'Stale edition' });
      if (current && next.edition === current.edition) {
        if (next.sha256 !== current.sha256)
          return respond(res, 409, { error: 'Conflicting edition' });
        return respond(res, 200, { status: 'ALREADY_MIRRORED', ...next, songs: next.songs.length });
      }
      const tmp = snapshotPath + '.' + randomUUID() + '.tmp';
      writeFileSync(tmp, JSON.stringify(nextEnvelope), { flag: 'wx', mode: 0o600 });
      renameSync(tmp, snapshotPath);
      current = { envelope: nextEnvelope, ...next };
      return respond(res, 201, { status: 'MIRRORED', edition: next.edition,
        sha256: next.sha256, songs: next.songs.length });
    } catch (error) {
      return respond(res, 400, { error: error.message || 'Invalid snapshot' });
    }
  });
}
