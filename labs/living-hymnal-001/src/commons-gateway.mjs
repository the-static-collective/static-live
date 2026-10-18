// CHURCH COMMONS 002: independent signed-public mirror selection and no-rollback HOLD.
// GHoT-inspired PLAN/ATTEMPT/RECEIPT *candidate* records. No GHoT protocol registration,
// signed reLATTE crossing, PENNY accounting, dynamic peer discovery or WAN listener.
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertTenant } from './core.mjs';
import { verifyPublicEnvelope } from './commons.mjs';
import { verifyLeasedEdition } from './commons-lease.mjs';

const MAX_ENVELOPE_BYTES = 520_000;
function atomicJson(file, value) {
  const temp = file + '.' + randomUUID() + '.tmp';
  writeFileSync(temp, JSON.stringify(value) + '\n', { flag: 'wx', mode: 0o600 });
  renameSync(temp, file);
}
function respond(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'"
  });
  res.end(JSON.stringify(data));
}
function mirrorUrl(raw) {
  const url = new URL(raw);
  // Deliberately loopback-only: use an operator-controlled SSH tunnel to reach
  // a second physical machine. No arbitrary URL fetches, redirects, or public bind.
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(url.hostname) ||
      url.username || url.password || url.search || url.hash ||
      (url.pathname !== '/' && url.pathname !== '') || !url.port)
    throw new Error('Mirror URL must be a loopback HTTP origin with explicit port');
  return url.origin;
}
function validateHighWater(value) {
  return !!value && Number.isSafeInteger(value.edition) && value.edition >= 1 &&
    typeof value.sha256 === 'string' && /^[a-f0-9]{64}$/.test(value.sha256);
}
async function fetchMirror(node, tenant, trustedKey, timeoutMs, requireLease, clock) {
  // Probe only operator-declared, loopback-tunneled mirror endpoints.
  const response = await fetch(node.url + (requireLease ? '/public-bundle' : '/public-snapshot'), {
    method: 'GET', redirect: 'error', signal: AbortSignal.timeout(timeoutMs)
  });
  if (response.status !== 200) throw new Error('No public snapshot, HTTP ' + response.status);
  const declared = Number(response.headers.get('content-length'));
  if (declared > MAX_ENVELOPE_BYTES) throw new Error('Oversized mirror snapshot');
  const raw = await response.text();
  if (Buffer.byteLength(raw) > MAX_ENVELOPE_BYTES) throw new Error('Oversized mirror snapshot');
  const checked = requireLease
    ? verifyLeasedEdition(JSON.parse(raw), tenant, trustedKey, clock())
    : verifyPublicEnvelope(JSON.parse(raw), tenant, trustedKey);
  return { ...checked, nodeId: node.id, byteCount: Buffer.byteLength(raw) };
}

export function createCommonsGateway({ tenant, mirrors, trustedPublicKeyPem, receiptDir,
  timeoutMs = 1200, requireLease = false, clock = Date.now }) {
  assertTenant(tenant);
  if (!Array.isArray(mirrors) || !mirrors.length || mirrors.length > 8 ||
      typeof trustedPublicKeyPem !== 'string' || !receiptDir ||
      !Number.isInteger(timeoutMs) || timeoutMs < 50 || timeoutMs > 10000 ||
      typeof requireLease !== 'boolean' || typeof clock !== 'function')
    throw new Error('Explicit mirrors, owner key, receipt directory and bounded timeout required');
  const nodes = mirrors.map(m => {
    if (!m || typeof m.id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(m.id))
      throw new Error('Invalid mirror id');
    return { id: m.id, url: mirrorUrl(m.url) };
  });
  if (new Set(nodes.map(m => m.id)).size !== nodes.length ||
      new Set(nodes.map(m => m.url)).size !== nodes.length)
    throw new Error('Duplicate mirrors are not independent capacity');
  mkdirSync(receiptDir, { recursive: true });
  const watermarkFile = join(receiptDir, tenant + '.highest-seen.json');
  let highWater = existsSync(watermarkFile) ?
    JSON.parse(readFileSync(watermarkFile, 'utf8')) : null;
  if (highWater && !validateHighWater(highWater)) throw new Error('Damaged high-water state');

  async function route() {
    const record = {
      schema: 'church-commons.verified-route-observation/v0.1',
      id: randomUUID(), tenant, at: new Date().toISOString(),
      capability: 'public-hymnal.serve.read-only',
      requester: 'local-gateway', // no assertion of an actual GHoT node identity
      leaseRequired: requireLease,
      nodes: nodes.map(n => n.id),
      attempts: [], selected: null,
      final: 'HOLD', admission: 'NONE',
      penny: 'NO_CREDIT_OR_SETTLEMENT'
    };
    let selected;
    try {
      const probed = await Promise.all(nodes.map(async node => {
        try {
          const result = await fetchMirror(node, tenant, trustedPublicKeyPem, timeoutMs, requireLease, clock);
          record.attempts.push({ nodeId: node.id, status: 'verified', edition: result.edition,
            sha256: result.sha256, bytesObserved: result.byteCount,
            ...(requireLease ? { leaseExpiresAt: new Date(result.expiresAt).toISOString() } : {}) });
          return result;
        } catch (error) {
          record.attempts.push({ nodeId: node.id, status: 'unavailable-or-rejected',
            reason: String(error?.message || 'unavailable').slice(0, 160) });
          return null;
        }
      }));
      // Make observation order deterministic despite asynchronous probes.
      record.attempts.sort((a, b) => a.nodeId.localeCompare(b.nodeId));
      const valid = probed.filter(Boolean);
      if (!valid.length) return { code: 503, body: { status: 'HOLD', reason: 'No verified live mirror' } };
      const topEdition = Math.max(...valid.map(x => x.edition));
      const latest = valid.filter(x => x.edition === topEdition);
      // A single owner edition cannot have two equally authoritative payloads.
      if (new Set(latest.map(x => x.sha256)).size !== 1)
        return { code: 503, body: { status: 'HOLD', reason: 'Conflicting signed editions' } };
      const best = latest[0];
      if (highWater && (topEdition < highWater.edition ||
          (topEdition === highWater.edition && best.sha256 !== highWater.sha256)))
        return { code: 503, body: { status: 'HOLD', reason: 'Rollback or edition conflict refused' } };
      if (highWater && valid.some(x => x.edition === highWater.edition &&
          x.sha256 !== highWater.sha256))
        return { code: 503, body: { status: 'HOLD', reason: 'Historical edition conflict refused' } };
      if (!highWater || topEdition > highWater.edition) {
        highWater = { edition: topEdition, sha256: best.sha256 };
        atomicJson(watermarkFile, highWater);
      }
      // Deterministic route after verifying key, payload digest, version and watermark.
      selected = latest.sort((a, b) => a.nodeId.localeCompare(b.nodeId))[0];
      record.selected = selected.nodeId;
      record.edition = selected.edition;
      record.sha256 = selected.sha256;
      if (requireLease && clock() >= selected.expiresAt)
        return { code: 503, body: { status: 'HOLD', reason: 'Selected publication lease expired' } };
      record.final = 'VERIFIED_PUBLIC_RESPONSE';
      return { code: 200, body: {
        songs: selected.songs, edition: selected.edition,
        fromMirror: selected.nodeId, verifiedOwnerSignature: true,
        ...(requireLease ? { leaseExpiresAt: new Date(selected.expiresAt).toISOString(),
          boundedPublicationPermission: true } : {})
      } };
    } finally {
      // An operational observation, not a GHoT execution receipt, PENNY issuance,
      // settlement attestation, independent human witness or legal rights proof.
      try {
        atomicJson(join(receiptDir, record.at.replace(/[:.]/g, '-') + '-' + record.id + '.json'), record);
      } catch (error) {
        // A readable response should not masquerade as an auditable claim if its
        // candidate receipt could not be written; routing remains a local experiment.
        throw new Error('Unable to preserve routing observation: ' + error.message);
      }
    }
  }
  return createServer(async (req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (req.method === 'GET' && path === '/health')
      return respond(res, 200, { role: 'verified-public-route', tenant, nodes: nodes.length,
        highestSeenEdition: highWater?.edition ?? null, noPublicListener: true,
        boundedLeaseEnforced: requireLease });
    if (req.method !== 'GET' || path !== '/api/' + tenant + '/songs')
      return respond(res, 404, { error: 'Not found' });
    try {
      const result = await route();
      return respond(res, result.code, result.body);
    } catch {
      return respond(res, 503, { status: 'HOLD', reason: 'Verification or audit persistence unavailable' });
    }
  });
}
