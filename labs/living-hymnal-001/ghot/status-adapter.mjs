#!/usr/bin/env node
// Opt-in GHoT external adapter: executes a bounded read of an existing
// lease-verifying Commons gateway. No visitor content or credentials are returned.
// GHoT's own Python runtime supplies the capability and writes task/receipt records.
import { assertTenant } from '../src/core.mjs';

const CAPABILITY = 'church-commons.public-hymnal.lease-status';
function safeGateway(raw) {
  if (typeof raw !== 'string') throw new Error('Gateway address must be provided by local operator');
  const url = new URL(raw);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    !url.port || url.username || url.password || url.search || url.hash ||
    (url.pathname !== '/' && url.pathname !== ''))
    throw new Error('Only explicit loopback gateway URL permitted');
  return url.origin;
}
async function readJson(url) {
  const response = await fetch(url, { method: 'GET', redirect: 'error',
    signal: AbortSignal.timeout(2500) });
  if (response.status !== 200) return { status: response.status };
  const declared = Number(response.headers.get('content-length'));
  if (declared > 262144) throw new Error('Oversized response');
  const chunks = []; let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 262144) throw new Error('Oversized response');
    chunks.push(chunk);
  }
  return { status: 200, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) };
}
async function run() {
  if (process.env.GHOT_EXTERNAL_CAPABILITY !== CAPABILITY)
    throw new Error('External capability was not explicitly selected by GHoT');
  const tenant = assertTenant(process.env.GHOT_COMMONS_TENANT || 'sample-church');
  const root = safeGateway(process.env.GHOT_COMMONS_GATEWAY_URL);
  let incoming = '';
  for await (const chunk of process.stdin) {
    incoming += chunk.toString('utf8');
    if (incoming.length > 4096) throw new Error('Input too large');
  }
  const requested = JSON.parse(incoming || 'null');
  if (requested !== null && (typeof requested !== 'object' ||
      Array.isArray(requested) || Object.keys(requested).length))
    throw new Error('No arbitrary payloads or URLs accepted');
  const health = await readJson(root + '/health');
  if (health.status !== 200 ||
      health.body?.boundedLeaseEnforced !== true || health.body.tenant !== tenant) {
    return { schema: 'church-commons.ghot-capability-output/v0.1', tenant,
      status: 'HOLD', reason: 'No trusted lease-enforcing gateway' };
  }
  const publicResponse = await readJson(root + '/api/' + tenant + '/songs');
  if (publicResponse.status !== 200) {
    return { schema: 'church-commons.ghot-capability-output/v0.1', tenant,
      status: 'HOLD', reason: 'No presently valid publication lease' };
  }
  const p = publicResponse.body;
  if (!p || p.verifiedOwnerSignature !== true ||
      p.boundedPublicationPermission !== true ||
      !Array.isArray(p.songs) ||
      !Number.isSafeInteger(p.edition) || p.edition < 1 ||
      typeof p.leaseExpiresAt !== 'string' ||
      !Number.isFinite(Date.parse(p.leaseExpiresAt)) ||
      Date.parse(p.leaseExpiresAt) <= Date.now() ||
      typeof p.fromMirror !== 'string' || !/^[a-z0-9-]{1,40}$/.test(p.fromMirror))
    throw new Error('Gateway did not provide verified bounded-publication evidence');
  return {
    schema: 'church-commons.ghot-capability-output/v0.1', tenant,
    status: 'AVAILABLE', publicSongCount: p.songs.length,
    edition: p.edition, leaseExpiresAt: p.leaseExpiresAt,
    mirror: p.fromMirror,
    attestation: 'gateway-verified-lease-observed',
    rightsNotice: 'Signature verification is not proof of contributor rights'
  };
}
try {
  process.stdout.write(JSON.stringify(await run()) + '\n');
} catch (error) {
  // Clean refusal rather than leaking runtime internals or any song text.
  process.stderr.write('Church Commons GHoT adapter refused unsafe or unavailable invocation\n');
  process.exitCode = 1;
}
