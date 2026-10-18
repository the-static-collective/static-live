import { createHash, randomUUID } from 'node:crypto';

export const KINDS = ['lyric', 'scripture', 'melody-description', 'prayer', 'testimony', 'song-idea'];
export const DECISIONS = ['ADMIT', 'REFUSE'];
const tenantPattern = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

function requireText(value, name, max = 2000, min = 1) {
  if (typeof value !== 'string') throw new Error(name + ' must be text');
  const text = value.trim();
  if (text.length < min || text.length > max) throw new Error(name + ' length invalid');
  return text;
}
export function assertTenant(tenant) {
  if (typeof tenant !== 'string' || !tenantPattern.test(tenant)) throw new Error('Invalid tenant');
  return tenant;
}
function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
export function createSeed(tenant, input, at = new Date().toISOString()) {
  assertTenant(tenant);
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid submission');
  if (!KINDS.includes(input.kind)) throw new Error('Invalid seed kind');
  if (input.permissionToReview !== true || input.authorizedSubmitter !== true) {
    throw new Error('Review permission and adult/guardian authorization are required');
  }
  const body = requireText(input.body, 'Seed', 2000, 8);
  const scriptureRef = input.scriptureRef ? requireText(input.scriptureRef, 'Scripture reference', 120) : '';
  const contributorAlias = input.contributorAlias ? requireText(input.contributorAlias, 'Alias', 60) : '';
  return {
    type: 'seed.created', id: randomUUID(), tenant, at,
    payload: { id: randomUUID(), kind: input.kind, body, scriptureRef, contributorAlias,
      permission: 'PRIVATE_INTERNAL_REVIEW_ONLY', status: 'HOLD' }
  };
}
export function replay(events, tenant) {
  assertTenant(tenant);
  const seeds = new Map(), songs = new Map();
  for (const event of events) {
    if (event.tenant !== tenant) continue;
    if (event.type === 'seed.created') {
      if (seeds.has(event.payload.id)) throw new Error('Duplicate seed ID');
      seeds.set(event.payload.id, { ...event.payload, createdAt: event.at });
    } else if (event.type === 'seed.decided') {
      const seed = seeds.get(event.seedId);
      if (!seed || seed.status !== 'HOLD' || !DECISIONS.includes(event.decision)) throw new Error('Invalid disposition history');
      seeds.set(event.seedId, { ...seed, status: event.decision, decidedAt: event.at });
    } else if (event.type === 'song.published') {
      if (songs.has(event.song.id)) throw new Error('Duplicate publication');
      if (!event.song.sourceSeedIds.every(id => seeds.get(id)?.status === 'ADMIT')) throw new Error('Unadmitted source');
      songs.set(event.song.id, { ...event.song, publishedAt: event.at });
    } else throw new Error('Unknown event type');
  }
  return { seeds: [...seeds.values()], songs: [...songs.values()] };
}
export function decideSeed(tenant, state, seedId, decision, at = new Date().toISOString()) {
  assertTenant(tenant);
  if (!DECISIONS.includes(decision)) throw new Error('Invalid decision');
  const seed = state.seeds.find(s => s.id === seedId);
  if (!seed || seed.status !== 'HOLD') throw new Error('Seed not awaiting review');
  return { type: 'seed.decided', id: randomUUID(), tenant, seedId, decision, at };
}
function safeRelativePath(path) {
  const v = requireText(path, 'Audio path', 260);
  if (!/^[A-Za-z0-9_./-]+$/.test(v) || v.startsWith('/') || v.includes('..') || !v.endsWith('.wav')) {
    throw new Error('WAV path must be a safe relative path');
  }
  return v;
}
export function publishSong(tenant, state, input, at = new Date().toISOString()) {
  assertTenant(tenant);
  if (!input || !Array.isArray(input.sourceSeedIds) || input.sourceSeedIds.length === 0) {
    throw new Error('At least one reviewed seed required');
  }
  const seedIds = [...new Set(input.sourceSeedIds)];
  if (!seedIds.every(id => state.seeds.some(s => s.id === id && s.status === 'ADMIT'))) {
    throw new Error('All source seeds must have been admitted');
  }
  if (input.pastoralApproved !== true || input.rightsCleared !== true) {
    throw new Error('Explicit pastoral approval and rights review required');
  }
  const title = requireText(input.title, 'Title', 120);
  const lyrics = requireText(input.lyrics, 'Lyrics', 12000, 8);
  const approvalNote = requireText(input.approvalNote, 'Approval record', 500, 12);
  const rightsNote = requireText(input.rightsNote, 'Rights review record', 500, 12);
  const bpm = Number(input.bpm);
  if (!Number.isInteger(bpm) || bpm < 40 || bpm > 240) throw new Error('Invalid tempo');
  if (!['4/4', '3/4', '6/8', '12/8', '2/4'].includes(input.meter)) throw new Error('Invalid meter');
  const requiredCapabilities = input.requiredCapabilities || ['lead-vocal.live', 'guitar.live'];
  if (!Array.isArray(requiredCapabilities) || !requiredCapabilities.length ||
      requiredCapabilities.some(x => typeof x !== 'string' || !/^[a-z-]+\.live$/.test(x)) ||
      new Set(requiredCapabilities).size !== requiredCapabilities.length) throw new Error('Invalid capabilities');
  const stems = (input.stems || []).map(s => {
    if (!s || typeof s.id !== 'string' || !/^[a-z0-9-]+$/.test(s.id) ||
        !['always', 'fallback'].includes(s.kind) || s.output !== 'foh') throw new Error('Invalid stem');
    if (s.kind === 'fallback' && !requiredCapabilities.includes(s.coversCapability)) throw new Error('Unmatched fallback');
    return { id: s.id, kind: s.kind, ...(s.kind === 'fallback' ? { coversCapability: s.coversCapability } : {}),
      path: safeRelativePath(s.path), output: 'foh' };
  });
  const cues = Object.fromEntries(Object.entries(input.cues || {}).map(([key, path]) => {
    if (!['click', 'voice'].includes(key)) throw new Error('Invalid cue');
    return [key, safeRelativePath(path)];
  }));
  const song = {
    id: randomUUID(), tenant, sourceSeedIds: seedIds, title, lyrics,
    scriptureRef: input.scriptureRef ? requireText(input.scriptureRef, 'Scripture', 120) : '',
    bpm, meter: input.meter, requiredCapabilities, stems, cues, landmarks: ['intro', 'verse', 'chorus', 'outro'],
    rightsReview: { affirmed: true, note: rightsNote },
    pastoralReview: { affirmed: true, note: approvalNote },
    status: 'PUBLISHED'
  };
  return { type: 'song.published', id: randomUUID(), tenant, at, song };
}
export function toStaticLivePacket(song) {
  if (song.status !== 'PUBLISHED' || !song.rightsReview?.affirmed || !song.pastoralReview?.affirmed)
    throw new Error('Unreleased song cannot reach the stage');
  return {
    version: 'static-live.performance-packet/v0.1',
    song: { id: song.id, title: song.title, sourceReceipt: 'living-hymnal:' + song.tenant + ':' + song.id },
    tempo: { bpm: song.bpm, meter: song.meter },
    landmarks: [...song.landmarks],
    requiredCapabilities: [...song.requiredCapabilities],
    stems: song.stems.map(x => ({ ...x })), cues: { ...song.cues }
  };
}
export function toRelatteOpaqueSpec(song, at = new Date().toISOString()) {
  if (song.status !== 'PUBLISHED' || !song.rightsReview?.affirmed || !song.pastoralReview?.affirmed)
    throw new Error('Only published material may be prepared for crossing');
  const publicProjection = { id: song.id, title: song.title, lyrics: song.lyrics,
    scriptureRef: song.scriptureRef, bpm: song.bpm, meter: song.meter };
  return {
    schema: 'relatte.opaque-organ-spec/v0',
    family_ref: 'living-hymnal/v0.1',
    donor_contract_ref: 'living-hymnal.published-song/v0.1',
    artifact_kind: 'PUBLISHED_CONGREGATIONAL_SONG',
    source_world: 'church:' + song.tenant,
    source_particular: 'song:' + song.id,
    source_history_head: 'living-hymnal:published:' + song.id,
    payload_refs: [{ address: 'sha256:' + digest(publicProjection), role: 'song-projection',
      media_type: 'application/json' }],
    donor_claims: { status: 'PUBLISHED', rights_review_affirmed: true, pastoral_review_affirmed: true,
      payload_projection: 'id,title,lyrics,scriptureRef,bpm,meter' },
    requested_effect: { type: 'CANDIDATE_IMPORT', target: 'recipient-local-review' },
    return_address: null, created_at: at
  };
}
export function hostManifest(tenant, baseUrl, label = 'Living Hymnal') {
  assertTenant(tenant);
  const root = new URL(baseUrl);
  if (root.protocol !== 'https:' && !(root.hostname === '127.0.0.1' || root.hostname === 'localhost')) {
    throw new Error('HTTPS host required');
  }
  const url = new URL('/c/' + tenant, root).toString();
  return {
    version: 'living-hymnal.host-link/v0.1', tenant,
    entry: { url, label, mode: 'EXTERNAL_WEB_PAGE', accountRequired: false },
    adapters: {
      tithely: { actionType: 'Web Page', url, requiresChurchAppAdmin: true },
      generic: { type: 'external-link', url },
      qr: { url }
    },
    permissions: 'No church credentials, API access, SSO, or publishing authority granted'
  };
}
