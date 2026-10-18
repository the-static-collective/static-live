import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeed, replay, decideSeed, publishSong, toStaticLivePacket,
  toRelatteOpaqueSpec, hostManifest } from '../src/core.mjs';
import { compileStageProjection } from '../../../src/compiler.js';

const tenant = 'sample-church';
const base = { kind: 'lyric', body: 'You are the light through every dawn', permissionToReview: true, authorizedSubmitter: true };
const release = {
  title: 'At the Morning Door', lyrics: '[Verse]\nYou are the light through every dawn',
  bpm: 92, meter: '4/4', pastoralApproved: true, rightsCleared: true,
  approvalNote: 'Reviewed and approved by designated worship leader',
  rightsNote: 'Checked contributor permissions and stems terms',
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
  const state = replay([seed, admit], tenant);
  assert.throws(() => publishSong(tenant, state, { ...release, sourceSeedIds: [seed.payload.id], rightsCleared: false }), /approval and rights/);
  const published = publishSong(tenant, state, { ...release, sourceSeedIds: [seed.payload.id] });
  const song = replay([seed, admit, published], tenant).songs[0];
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
  const state = replay([seed, admit], tenant);
  assert.throws(() => publishSong(tenant, state, { ...release, sourceSeedIds: [seed.payload.id],
    stems: [{ id: 'bad', kind: 'always', path: '../private.wav', output: 'foh' }] }), /safe relative path/);
});
