import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateWorldRegistry, worldSnapshot, openWorld, switchWorld, prepareSection } from '../src/radio-world-001.js';
import { createRadioWorldServer } from '../src/radio-world-server.js';

const fixture=JSON.parse(readFileSync(new URL('../fixtures/radio-world-001/worlds.json',import.meta.url),'utf8'));
const copy=()=>structuredClone(fixture);
const html=()=>readFileSync(new URL('../examples/radio-world-001/index.html',import.meta.url),'utf8');
const js=()=>readFileSync(new URL('../examples/radio-world-001/app.js',import.meta.url),'utf8');
const sw=()=>readFileSync(new URL('../examples/radio-world-001/sw.js',import.meta.url),'utf8');

test('founding worlds are separately owner-held and official URLs match',()=>{
  assert.equal(validateWorldRegistry(fixture),fixture);
  const d=worldSnapshot(fixture);
  assert.deepEqual(d.worlds.map(x=>x.id),['kinship-radio','rock-impact']);
  assert.deepEqual(d.worlds.map(x=>x.place.country),['US','NG']);
  assert.ok(d.worlds.every(x=>x.ownerAuthority==='INDEPENDENT_EXTERNAL_OWNER'));
  assert.ok(d.worlds.every(x=>x.verifiedDirectStream===false&&x.mediaPlayback==='NONE'));
  assert.equal(d.actualRadioTransmission,false);
  assert.equal(d.organizationalEndorsement,'NONE');
});
test('opening one world is only user chosen external link, not listener or rights proof',()=>{
  const r=openWorld(fixture,'kinship-radio');
  assert.equal(r.href,'https://kinshipradio.org/main/');
  assert.equal(r.action,'USER_CHOSEN_EXTERNAL_OFFICIAL_LINK');
  assert.equal(r.externalPlaybackObserved,false);
  assert.equal(r.streamLicensed,false);
  assert.equal(r.crossingOccurred,false);
  assert.equal(r.requestedDonation,false);
});
test('the other source is an independent same-class official page',()=>{
  assert.equal(openWorld(fixture,'rock-impact').href,'https://rockimpactmakersglobal.org/');
});
test('source switching never transfers identity or autoplays',()=>{
  const s=switchWorld(fixture,'kinship-radio','rock-impact');
  assert.equal(s.from,'kinship-radio');
  assert.equal(s.to,'rock-impact');
  assert.equal(s.nextAutoPlay,false);
  assert.equal(s.previousAudioStopped,'NO_INTERNAL_AUDIO_EXISTS');
  assert.equal(s.donorOrUserIdentityTransferred,false);
  assert.equal(s.listenerMetricIncrement,0);
});
test('listen, produce, exchange remain separable from permissioned action',()=>{
  const l=prepareSection(fixture,'rock-impact','listen');
  const p=prepareSection(fixture,'rock-impact','produce');
  const e=prepareSection(fixture,'rock-impact','exchange');
  assert.equal(l.action,'OPEN_OFFICIAL');
  assert.equal(p.action,'NOT_ADMITTED');
  assert.equal(e.action,'NOT_ADMITTED');
  assert.equal(e.rights,'NOT_ESTABLISHED');
  assert.equal(e.consequence,'NONE');
});
test('forged third-world identity, wrong country, duplicate owner or bad org status rejected',()=>{
  for(const mutate of [
    x=>x.worlds.push(structuredClone(x.worlds[0])),
    x=>x.worlds[0].id='unauthorized-radio',
    x=>x.worlds[1].id='kinship-radio',
    x=>x.worlds[0].owner.authority='STATIC_COLLECTIVE_OWNS',
    x=>x.worlds[1].place.country='GH',
    x=>x.worlds[0].owner.secret='password'
  ]){const x=copy();mutate(x);assert.throws(()=>validateWorldRegistry(x));}
});
test('app refuses direct stream URLs, false rights, podcasts, auto audio and tracking',()=>{
  for(const mutate of [
    x=>x.worlds[0].connection.directAudioUrl='https://stream.example/audio.mp3',
    x=>x.worlds[1].connection.mode='EMBEDDED_PLAYER',
    x=>x.worlds[0].connection.streamLicense='YES',
    x=>x.worlds[1].connection.observedLive='YES',
    x=>x.worlds[0].connection.podcastFeed='https://feeds.example/rss',
    x=>x.policy.automatic_playback=true,
    x=>x.policy.active_audio='BOTH',
    x=>x.policy.third_party_proxy=true,
    x=>x.policy.tracking=true,
    x=>x.policy.recording=true,
    x=>x.policy.crossfade=true,
    x=>x.policy.local_offline_cache='RECORD_ALL_MEDIA',
    x=>x.policy.owner_grants='ASSUMED'
  ]){const x=copy();mutate(x);assert.throws(()=>validateWorldRegistry(x));}
});
test('official link pinned to owner exact origin and path, no external injection',()=>{
  for(const url of [
    'http://kinshipradio.org/main/',
    'https://kinshipradio.org.evil.example/main/',
    'https://user:pass@kinshipradio.org/main/',
    'https://kinshipradio.org/main/#play',
    'https://kinshipradio.org/main/?autoplay=true',
    'javascript:alert(1)',
    'https://kinshipradio.org/live',
    'https://rockimpactmakersglobal.org/'
  ]){const x=copy();x.worlds[0].officialUrl=url;assert.throws(()=>validateWorldRegistry(x));}
});
test('no unknown section, unknown world or fabricated world ID accepted',()=>{
  assert.throws(()=>openWorld(fixture,'unknown'));
  assert.throws(()=>switchWorld(fixture,'unknown','kinship-radio'));
  assert.throws(()=>switchWorld(fixture,null,'missing'));
  assert.throws(()=>prepareSection(fixture,'kinship-radio','rebroadcast'));
});
test('PWA shell contains actual selectable worlds, official handoff and three views',()=>{
  const page=html(),client=js();
  for(const term of ['RADIO WORLD','world-list','world-content','data-view="listen"','data-view="produce"','data-view="exchange"']){
    assert.ok(page.includes(term),term);
  }
  assert.ok(client.includes('button.addEventListener'));
  assert.ok(client.includes('noopener noreferrer'));
  assert.ok(client.includes('referrerPolicy'));
  assert.ok(client.includes('selected=id;view='));
  assert.ok(!client.includes('new Audio('));
  assert.ok(!page.includes('<audio'));
  assert.ok(!page.includes('<iframe'));
});
test('offline service worker caches only first party shell and directory',()=>{
  const source=sw();
  assert.ok(source.includes('url.origin!==self.location.origin'));
  assert.ok(source.includes("if(event.request.method!=='GET')"));
  assert.ok(source.includes("'/api/worlds'"));
  assert.ok(!source.includes('.mp3'));
  assert.ok(!source.includes('.m3u8'));
  assert.ok(!source.includes('rockimpactmakersglobal.org'));
  assert.ok(!source.includes('kinshipradio.org'));
});
test('manifest is installable first party and does not request external permissions',()=>{
  const m=JSON.parse(readFileSync(new URL('../examples/radio-world-001/manifest.webmanifest',import.meta.url),'utf8'));
  assert.equal(m.display,'standalone');
  assert.equal(m.scope,'/');
  assert.deepEqual(m.icons.map(x=>x.src),['/icon.svg']);
  assert.equal(Object.hasOwn(m,'permissions'),false);
});
test('server rejects a public binding',()=>{
  assert.throws(()=>createRadioWorldServer({registry:fixture,host:'0.0.0.0'}),/loopback/);
});
test('server refuses bad policy before opening any socket',()=>{
  const altered=copy();altered.policy.third_party_proxy=true;
  assert.throws(()=>createRadioWorldServer({registry:altered}),/POLICY_NEVER_PROMOTE/);
});
test('real localhost HTTP serves a PWA and read-only two-world manifest with anti-frame and no media',async()=>{
  const server=createRadioWorldServer({registry:fixture});
  const root=await server.start();
  try {
    const r=await fetch(root.url+'api/worlds');
    assert.equal(r.status,200);
    assert.match(r.headers.get('content-security-policy'),/media-src 'none'/);
    assert.equal(r.headers.get('x-frame-options'),'DENY');
    assert.equal(r.headers.get('referrer-policy'),'no-referrer');
    const data=await r.json();
    assert.equal(data.worlds.length,2);
    assert.equal(data.streamsCombined,false);
    assert.equal(data.worlds[0].listenCapability,'OPEN_OFFICIAL_SITE_ONLY');
    for(const path of ['/','/app.js','/styles.css','/sw.js','/icon.svg','/manifest.webmanifest']){
      assert.equal((await fetch(root.url+path.slice(1))).status,200,path);
    }
  }finally{await server.stop();}
});
test('HTTP refuses all mutations, unauthorized proxy routes and unknown stream paths',async()=>{
  const server=createRadioWorldServer({registry:fixture});
  const root=await server.start();
  try{
    for(const path of ['proxy','stream','relay','record','api/compose','api/live','api/obs/scene']){
      assert.equal((await fetch(root.url+path)).status,404,path);
    }
    assert.equal((await fetch(root.url+'api/worlds',{method:'POST'})).status,405);
    assert.equal((await fetch(root.url+'api/worlds',{method:'DELETE'})).status,405);
    assert.equal((await fetch(root.url+'api/worlds',{method:'HEAD'})).status,200);
  }finally{await server.stop();}
});
