import { createServer } from 'node:http';
import { readFileSync, mkdirSync, appendFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';
import { assertTenant, createSeed, replay, decideSeed, publishSong,
  toStaticLivePacket, toRelatteOpaqueSpec, hostManifest } from './core.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, '..', 'public');
const mime = { '/app.js': 'text/javascript', '/style.css': 'text/css', '/index.html': 'text/html' };
const fileLookup = { '/app.js': 'app.js', '/style.css': 'style.css', '/index.html': 'index.html' };
function send(res, status, payload, headers = {}) {
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': typeof payload === 'string' ? 'text/plain; charset=utf-8' : 'application/json',
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer', ...headers });
  res.end(data);
}
function authorize(req, token) {
  if (typeof token !== 'string' || token.length < 24) return false;
  const sent = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (Buffer.byteLength(sent) !== Buffer.byteLength(token)) return false;
  return timingSafeEqual(Buffer.from(sent), Buffer.from(token));
}
async function bodyJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 24000) throw new Error('Submission too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export function createApp({ dataDir, tenants, adminTokens = {}, allowSubmissions = false, baseUrl = null }) {
  if (!dataDir || !tenants || typeof tenants !== 'object') throw new Error('Missing app config');
  Object.keys(tenants).forEach(assertTenant);
  mkdirSync(dataDir, { recursive: true });
  const limit = new Map();
  function eventFile(tenant) { return join(dataDir, tenant + '.jsonl'); }
  function events(tenant) {
    const path = eventFile(tenant);
    if (!existsSync(path)) return [];
    return readFileSync(path, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
  }
  function append(tenant, event) { appendFileSync(eventFile(tenant), JSON.stringify(event) + '\n', { flag: 'a', mode: 0o600 }); }
  function state(tenant) { return replay(events(tenant), tenant); }
  return createServer(async (req, res) => {
    try {
      const host = req.headers.host || 'localhost';
      const url = new URL(req.url, 'http://' + host);
      const path = url.pathname;
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        const origin = req.headers.origin;
        if (origin && new URL(origin).host !== host) return send(res, 403, { error: 'Cross-origin requests forbidden' });
      }
      if (req.method === 'GET' && path === '/') {
        res.writeHead(302, { Location: '/c/sample-church', 'Cache-Control': 'no-store' }); res.end(); return;
      }
      if (req.method === 'GET' && (fileLookup[path] || /^\/c\/[a-z0-9-]+$/.test(path))) {
        const file = fileLookup[path] || 'index.html';
        const ext = '/' + file;
        if (path.startsWith('/c/')) {
          const tenant = path.split('/')[2];
          if (!Object.hasOwn(tenants, tenant)) return send(res, 404, { error: 'Unknown church' });
        }
        const content = readFileSync(join(publicDir, file));
        res.writeHead(200, { 'Content-Type': mime[ext] + '; charset=utf-8', 'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'" });
        res.end(content); return;
      }
      const match = /^\/api\/([a-z0-9-]+)(?:\/(.*))?$/.exec(path);
      if (!match || !Object.hasOwn(tenants, match[1])) return send(res, 404, { error: 'Not found' });
      const tenant = match[1], action = match[2] || '';
      if (req.method === 'GET' && action === 'config')
        return send(res, 200, { name: tenants[tenant].name, tenant, submissionsOpen: allowSubmissions });
      if (req.method === 'GET' && action === 'songs') {
        const published = state(tenant).songs.map(s => ({
          id: s.id, title: s.title, lyrics: s.lyrics, scriptureRef: s.scriptureRef, bpm: s.bpm,
          meter: s.meter, publishedAt: s.publishedAt
        }));
        return send(res, 200, { songs: published });
      }
      if (req.method === 'GET' && action === 'integration') {
        const base = baseUrl || 'http://' + host;
        return send(res, 200, hostManifest(tenant, base, tenants[tenant].name + ' Living Hymnal'));
      }
      if (req.method === 'POST' && action === 'seeds') {
        if (!allowSubmissions) return send(res, 503, { error: 'Submissions are disabled for this demonstration' });
        const ip = req.socket.remoteAddress || 'unknown';
        const key = tenant + ':' + ip, now = Date.now();
        const current = (limit.get(key) || []).filter(t => now - t < 600000);
        if (current.length >= 5) return send(res, 429, { error: 'Try again later' });
        current.push(now); limit.set(key, current);
        const seed = createSeed(tenant, await bodyJson(req));
        append(tenant, seed);
        return send(res, 201, { id: seed.payload.id, state: 'HOLD',
          message: 'Privately received for human review. Not public or approved.' });
      }
      if (!action.startsWith('admin/')) return send(res, 404, { error: 'Unknown action' });
      if (!authorize(req, adminTokens[tenant])) return send(res, 401, { error: 'Church-specific review credential required' });
      if (req.method === 'GET' && action === 'admin/seeds')
        return send(res, 200, state(tenant));
      if (req.method === 'POST' && action === 'admin/decision') {
        const input = await bodyJson(req);
        const event = decideSeed(tenant, state(tenant), input.seedId, input.decision);
        append(tenant, event); return send(res, 200, { status: event.decision });
      }
      if (req.method === 'POST' && action === 'admin/publish') {
        const event = publishSong(tenant, state(tenant), await bodyJson(req));
        append(tenant, event); return send(res, 201, { songId: event.song.id, status: 'PUBLISHED' });
      }
      const exported = /^admin\/(stage|relatte)\/([a-f0-9-]+)$/.exec(action);
      if (req.method === 'GET' && exported) {
        const song = state(tenant).songs.find(x => x.id === exported[2]);
        if (!song) return send(res, 404, { error: 'Unreleased song' });
        return send(res, 200, exported[1] === 'stage' ? toStaticLivePacket(song) : toRelatteOpaqueSpec(song));
      }
      return send(res, 404, { error: 'Unknown action' });
    } catch (error) {
      return send(res, 400, { error: error.message || 'Invalid request' });
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dataDir = process.env.HYM_DATA_DIR || join(here, '..', 'data');
  const tenants = process.env.HYM_TENANTS_JSON ? JSON.parse(process.env.HYM_TENANTS_JSON)
    : { 'sample-church': { name: 'Sample Church — Unofficial Demo' } };
  const adminTokens = process.env.HYM_ADMIN_TOKENS_JSON ? JSON.parse(process.env.HYM_ADMIN_TOKENS_JSON) : {};
  const allowSubmissions = process.env.HYM_ALLOW_SUBMISSIONS === '1';
  const app = createApp({ dataDir, tenants, adminTokens, allowSubmissions });
  app.listen(8787, '127.0.0.1', () => {
    console.log('Living Hymnal local-only lab: http://127.0.0.1:8787/c/sample-church');
    console.log('No church integration, public hosting, or Tithely privileges are enabled.');
  });
}
