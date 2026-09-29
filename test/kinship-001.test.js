import test from 'node:test';
import assert from 'node:assert/strict';
import { compileKinshipPilot } from '../src/kinship-001.js';

const base = () => ({
  schema: 'static-live.kinship-pilot-input/v0.1',
  station: {
    id: 'kinship-radio',
    name: 'Kinship Radio',
    sourceRefs: [{
      ref: 'https://kinshipradio.org/main/',
      label: 'Kinship Radio public home',
      authority: 'station-public',
    }],
  },
  edition: {
    id: 'kinship-2026-09-29-pilot',
    localDate: '2026-09-29',
    intendedUse: 'human-reviewed volunteer morning/community pack',
  },
  candidates: [{
    id: 'community-door-001',
    kind: 'community-door',
    title: 'Soup and Sweets',
    copy: 'Kinship Radio has a public community event listed for this evening.',
    claimMode: 'observed',
    sourceRefs: [{
      ref: 'https://kinshipradio.org/main/find-kinship-radio-near-you-this-summer/',
      label: 'Kinship public summer events page',
      authority: 'station-public',
    }],
    review: {
      disposition: 'ready',
      reviewedBy: 'human:operator',
      reviewedAtUtc: '2026-09-29T20:00:00.000Z',
      note: 'Producer must verify time/location again before use.',
    },
  }],
});

test('compiles a reviewed non-effectful Kinship radio pack', () => {
  const pack = compileKinshipPilot(base());
  assert.equal(pack.schema, 'static-live.kinship-radio-pack/v0.1');
  assert.deepEqual(pack.airableSegmentIds, ['community-door-001']);
  assert.equal(pack.boundaries.broadcast, false);
  assert.equal(pack.boundaries.publish, false);
  assert.equal(pack.boundaries.stationAdoptionClaimed, false);
  assert.match(pack.receiptId, /^sha256:[0-9a-f]{64}$/);
});

test('scripture candidate requires a scripture-reference authority', () => {
  const input = base();
  input.candidates[0].kind = 'scripture-reference';
  assert.throws(() => compileKinshipPilot(input), /scripture-reference authority/);
});

test('candidate cannot silently skip human review', () => {
  const input = base();
  delete input.candidates[0].review;
  assert.throws(() => compileKinshipPilot(input), /explicit human review/);
});

test('the pilot refuses to impersonate another station', () => {
  const input = base();
  input.station.id = 'other-station';
  assert.throws(() => compileKinshipPilot(input), /scoped only to Kinship Radio/);
});
