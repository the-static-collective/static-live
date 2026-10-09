/* RADIO WORLD 001: a listener-facing link and capability membrane for two sovereign media owners.
 * Strict v0.1 contract deliberately rejects stream URLs and all invented playback authority.
 * No OBS, GHoT worker, network fetch, analytics, auto-join, licensing or rehosting.
 */
import { createHash } from 'node:crypto';
import { canonicalStringify } from './canonical-json.js';

const SCHEMA = 'static-live.radio-world-registry/v0.1';
const ALLOWED = new Map([
  ['kinship-radio', { origin:'https://kinshipradio.org', path:'/main/', country:'US' }],
  ['rock-impact', { origin:'https://rockimpactmakersglobal.org', path:'/', country:'NG' }],
]);
const VIEWS = ['listen','produce','exchange'];
const assert = (ok,msg) => { if (!ok) throw new TypeError(msg); };
const exact = (obj,keys) => obj && typeof obj === 'object' && !Array.isArray(obj)
  && Object.keys(obj).sort().join('|') === keys.slice().sort().join('|');
const checksum = obj => 'sha256:' + createHash('sha256').update(canonicalStringify(obj)).digest('hex');
function string(value,max=240) { return typeof value === 'string' && value.length > 0 && value.length <= max; }

export function validateWorldRegistry(registry) {
  assert(exact(registry,['schema','title','policy','worlds']), 'REGISTRY_FIELDS');
  assert(registry.schema === SCHEMA && string(registry.title,100), 'REGISTRY_SCHEMA');
  assert(exact(registry.policy,['owner_grants','active_audio','third_party_proxy','tracking','crossfade','recording','local_offline_cache','automatic_playback']), 'POLICY_FIELDS');
  const p = registry.policy;
  assert(p.owner_grants === 'NOT_OBTAINED' && p.active_audio === 'NONE' &&
    p.third_party_proxy === false && p.tracking === false && p.crossfade === false &&
    p.recording === false && p.automatic_playback === false &&
    p.local_offline_cache === 'FIRST_PARTY_SHELL_ONLY', 'POLICY_NEVER_PROMOTE');
  assert(Array.isArray(registry.worlds) && registry.worlds.length === 2, 'EXACTLY_TWO_FOUNDING_WORLDS');
  const seen = new Set();
  for (const w of registry.worlds) {
    assert(exact(w,['id','owner','place','officialUrl','description','surfaces','connection']), 'WORLD_FIELDS');
    assert(ALLOWED.has(w.id) && !seen.has(w.id), 'UNKNOWN_OR_DUPLICATE_WORLD'); seen.add(w.id);
    assert(exact(w.owner,['id','name','authority']) && string(w.owner.id,80)
      && string(w.owner.name,100) && w.owner.authority === 'INDEPENDENT_EXTERNAL_OWNER',
      'OWNER_AUTHORITY_INVALID');
    assert(exact(w.place,['country','label']) && w.place.country === ALLOWED.get(w.id).country
      && string(w.place.label,90), 'PLACE_INVALID');
    assert(string(w.description,300) && string(w.officialUrl,240), 'DESCRIPTION_OR_URL_INVALID');
    let url;
    try { url = new URL(w.officialUrl); } catch { throw new TypeError('OFFICIAL_URL_INVALID'); }
    const allow = ALLOWED.get(w.id);
    assert(url.protocol === 'https:' && url.origin === allow.origin && url.pathname === allow.path
      && !url.search && !url.hash && !url.username && !url.password, 'OFFICIAL_URL_NOT_OWNER_PINNED');
    assert(exact(w.surfaces,VIEWS) && w.surfaces.listen === 'OFFICIAL_LINK_ONLY'
      && w.surfaces.produce === 'EXTERNAL_OWNER'
      && w.surfaces.exchange === 'REQUIRES_SEPARATE_INVITATION', 'SURFACE_PERMISSIONS_INVALID');
    assert(exact(w.connection,['mode','directAudioUrl','streamLicense','observedLive','podcastFeed'])
      && w.connection.mode === 'OFFICIAL_SITE_HANDOFF'
      && w.connection.directAudioUrl === null && w.connection.streamLicense === 'NOT_ESTABLISHED'
      && w.connection.observedLive === 'UNKNOWN' && w.connection.podcastFeed === 'NOT_VERIFIED',
      'DIRECT_PLAYBACK_OR_RIGHTS_NOT_ADMITTED');
  }
  assert(seen.has('kinship-radio') && seen.has('rock-impact'), 'FOUNDING_WORLD_MISSING');
  return registry;
}
export function worldSnapshot(registry) {
  validateWorldRegistry(registry);
  return { schema:'static-live.radio-world-snapshot/v0.1',
    registryDigest:checksum(registry),
    title:registry.title,
    policy:registry.policy,
    worlds:registry.worlds.map(w=>({
      id:w.id,owner:w.owner.name,ownerAuthority:w.owner.authority,
      place:w.place,description:w.description,officialUrl:w.officialUrl,
      listenCapability:'OPEN_OFFICIAL_SITE_ONLY',
      verifiedDirectStream:false,podcastFeedVerified:false,
      collaboration:'INVITATION_REQUIRED',mediaPlayback:'NONE',
      listeningObserved:false,streamReach:'NOT_ESTABLISHED'
    })),
    mediaCaptured:false,streamsCombined:false,
    organizationalEndorsement:'NONE',actualRadioTransmission:false
  };
}
export function openWorld(registry, id) {
  validateWorldRegistry(registry);
  const world=registry.worlds.find(w=>w.id===id);
  assert(Boolean(world),'WORLD_NOT_FOUND');
  return { schema:'static-live.radio-world-handoff/v0.1',
    selectedWorld:world.id,owner:world.owner.name,
    action:'USER_CHOSEN_EXTERNAL_OFFICIAL_LINK',
    href:world.officialUrl,
    playedInsideApp:false,externalPlaybackObserved:false,
    streamLicensed:false,recordingOccurred:false,
    stationOrMinistryControl:false,
    crossingOccurred:false,requestedDonation:false
  };
}
export function switchWorld(registry, oldId, newId) {
  validateWorldRegistry(registry);
  assert(oldId === null || registry.worlds.some(w=>w.id===oldId), 'PRIOR_WORLD_INVALID');
  assert(registry.worlds.some(w=>w.id===newId), 'NEW_WORLD_INVALID');
  return {schema:'static-live.radio-world-switch/v0.1',
    from:oldId,to:newId,listenerSelection:true,
    previousAudioStopped:'NO_INTERNAL_AUDIO_EXISTS',
    nextAutoPlay:false,sourceOwnerAuthorityTransferred:false,
    donorOrUserIdentityTransferred:false,listenerMetricIncrement:0};
}
export function prepareSection(registry,worldId,section) {
  validateWorldRegistry(registry);
  assert(VIEWS.includes(section),'VIEW_INVALID');
  const world=registry.worlds.find(w=>w.id===worldId);
  assert(Boolean(world),'WORLD_NOT_FOUND');
  const messages={
    listen:'Explore the official listening service. Playback stays with the source owner.',
    produce:'Streaming and podcast production belongs to this world owner; Static Live STREAM-001 is a separate optional production tool.',
    exchange:'A proposed exchange requires a specific invitation, human review and rights for every media use.'
  };
  return {schema:'static-live.radio-world-section/v0.1',worldId,section,
    owner:world.owner.name,statement:messages[section],
    action:section==='listen'?'OPEN_OFFICIAL':'NOT_ADMITTED',
    rights:'NOT_ESTABLISHED',consequence:'NONE'};
}
