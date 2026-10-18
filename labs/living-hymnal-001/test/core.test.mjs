import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeed, replay, decideSeed, recordSeedPermission, publishSong, toStaticLivePacket,
  toRelatteOpaqueSpec, toRelatteExportBundle, hostManifest } from '../src/core.mjs';
import { compileStageProjection } from '../../../src/compiler.js';
import { createHash } from 'node:crypto';
const awaitedHash = text => createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');

const tenant = 'sample-church';
const base = { kind: 'lyric', body: 'You are the light through every dawn', permissionToReview: true, authorizedSubmitter: true };
const release = {
  title: 'At the Morning Door', lyrics: '[Verse]\nYou are the light through every dawn',
  bpm: 92, meter: '4/4', pastoralApproved: true, rightsCleared: true,
  approvalNote: 'Reviewed and approved by designated worship leader',
  rightsNote: 'Checked contributor permissions and stems terms',
  interchurchSharingApproved: true,
  sharingTerms: 'Permission for nonexclusive sharing of lyrics between local congregations',
  requiredCapabilities: ['lead-vocal.live', 'guitar.live', 'drums.live'],
  stems: [{ id: 'drums', kind: 'fallback', coversCapability: 'drums.live', path: 'stems/drums.wav', output: 'foh' }],
  cues: { click: 'stems/click.wav' }
};
test('submission remains private HOLD, not automatically admission or release', () => {
  const seed = createSeed(tenant, base);
  const state = replay([seed], tenant);
  assert.equal(state.seeds[0].status, 'HOLD');
  assert.equal(state.songs.length, 0);
  assert.throws(() => publishSong(tenant, state, { ...release, sourceSeedIds: [seed.payload.id] }), /admitted/i);
});
test('permission and type gates fail closed', () => {
  assert.throws(() => createSeed(tenant, { ...base, authorizedSubmitter: false }), /authorization/);
  assert.throws(() => createSeed(tenant, { ...base, body: 'short' }), /length/);
  assert.throws(() => createSeed('../evil', base), /tenant/i);
});
test('each church retains local control; a rejected seed never reaches stage', () => {
  const seed = createSeed(tenant, base);
  let state = replay([seed], tenant);
  const refused = decideSeed(tenant, state, seed.payload.id, 'REFUSE');
  state = replay([seed, refused], tenant);
  assert.throws(() => publishSong(tenant, state, { ...release, sourceSeedIds: [seed.payload.id] }), /admitted/i);
  assert.equal(replay([seed, refused], 'other-church').seeds.length, 0);
});
test('approved song travels to an actual Static Live stage compiler', () => {
  const seed = createSeed(tenant, base);
  const admit = decideSeed(tenant, replay([seed], tenant), seed.payload.id, 'ADMIT');
  const admitted = replay([seed, admit], tenant);
  assert.throws(() => publishSong(tenant, admitted, { ...release, sourceSeedIds: [seed.payload.id] }), /permission must be recorded/i);
  const localPermission = recordSeedPermission(tenant, admitted, seed.payload.id, 'PUBLIC_LYRICS', 'local-release-document-123');
  const localState = replay([seed, admit, localPermission], tenant);
  assert.throws(() => publishSong(tenant, localState, { ...release, sourceSeedIds: [seed.payload.id] }), /interchurch sharing requires/i);
  const permission = recordSeedPermission(tenant, admitted, seed.payload.id,
    'PUBLIC_LYRICS_AND_INTERCHURCH', 'signed-release-record-123');
  const state = replay([seed, admit, permission], tenant);
  assert.throws(() => publishSong(tenant, state, { ...release, sourceSeedIds: [seed.payload.id], rightsCleared: false }), /approval and rights/);
  const published = publishSong(tenant, state, { ...release, sourceSeedIds: [seed.payload.id] });
  const song = replay([seed, admit, permission, published], tenant).songs[0];
  const packet = toStaticLivePacket(song);
  assert.equal(packet.version, 'static-live.performance-packet/v0.1');
  const projection = compileStageProjection(packet, {
    id: 'sunday', label: 'Sunday', performers: [
      { id: 'voice', label: 'Lead vocal', capabilities: ['lead-vocal.live'] },
      { id: 'guitar', label: 'Guitar', capabilities: ['guitar.live'] }
    ]
  });
  assert.equal(projection.playable, true);
  assert.equal(projection.fallbackCoverage[0].capability, 'drums.live');
  assert.equal(projection.cues.click, 'stems/click.wav');
  assert.equal(projection.liveContributions.length, 2);
  const spec = toRelatteOpaqueSpec(song);
  assert.equal(spec.schema, 'relatte.opaque-organ-spec/v0');
  assert.equal(spec.payload_refs[0].media_type, 'application/json');
  assert.ok(!JSON.stringify(spec).includes(seed.payload.body));
  assert.ok(!JSON.stringify(spec).includes('contributorAlias'));
  assert.equal(spec.source_world, 'church:' + tenant);
  assert.equal(spec.source_history_head, null);
  const bundle = toRelatteExportBundle(song);
  assert.equal(bundle.spec.payload_refs[0].address, 'sha256:' +
    (awaitedHash(bundle.payload_text)));
  assert.equal(bundle.schema, 'living-hymnal.relatte-export/v0.1');
  assert.equal(JSON.stringify(bundle).includes('signed-release-record-123'), false);
  assert.equal(JSON.stringify(bundle).includes('contributorAlias'), false);
});
test('host integration uses external link rather than Tithely credentials', () => {
  const host = hostManifest('sample-church', 'https://example.org');
  assert.equal(host.adapters.tithely.actionType, 'Web Page');
  assert.equal(host.adapters.generic.url, 'https://example.org/c/sample-church');
  assert.throws(() => hostManifest('sample-church', 'http://public.example.org'), /HTTPS/);
});
test('stem path escaping is refused', () => {
  const seed = createSeed(tenant, base);
  const admit = decideSeed(tenant, replay([seed], tenant), seed.payload.id, 'ADMIT');
  const permission = recordSeedPermission(tenant, replay([seed, admit], tenant), seed.payload.id,
    'PUBLIC_LYRICS_AND_INTERCHURCH', 'signed-release-record-456');
  const state = replay([seed, admit, permission], tenant);
  assert.throws(() => publishSong(tenant, state, { ...release, sourceSeedIds: [seed.payload.id],
    stems: [{ id: 'bad', kind: 'always', path: '../private.wav', output: 'foh' }] }), /safe relative path/);
});

test('local-only approval cannot be exported to another congregation', () => {
  const seed = createSeed(tenant, base);
  const admit = decideSeed(tenant, replay([seed], tenant), seed.payload.id, 'ADMIT');
  const permission = recordSeedPermission(tenant, replay([seed, admit], tenant), seed.payload.id,
    'PUBLIC_LYRICS', 'local-public-lyrics-approval-record');
  const state = replay([seed, admit, permission], tenant);
  const published = publishSong(tenant, state,
    { ...release, interchurchSharingApproved: false, sourceSeedIds: [seed.payload.id] });
  const song = replay([seed, admit, permission, published], tenant).songs[0];
  assert.equal(toStaticLivePacket(song).song.title, release.title);
  assert.throws(() => toRelatteExportBundle(song), /not approved for interchurch/);
});
