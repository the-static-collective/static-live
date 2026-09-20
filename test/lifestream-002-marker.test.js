import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createMomentMarker } from '../src/lifestream-002-marker.js';
import { parseBroadcastCliArgs } from '../src/broadcast-cli.js';

const active = { recording:true, state:'recording_only' };
test('marked observation persists without claiming media time or triggering OBS', () => {
  const root=mkdtempSync(join(tmpdir(),'live-002-'));
  try {
    let tick=10;
    const file=join(root,'marks.jsonl');
    const book=createMomentMarker({journalPath:file,eventId:'session:1',tick:()=>tick,now:()=> '2026-09-20T16:01:00.000Z'});
    assert.throws(()=>book.mark(active),/confirmation marker unavailable/);
    book.begin();tick=410;
    const marker=book.mark(active);
    assert.equal(marker.approximateElapsedSinceConfirmationMs,400);
    assert.match(marker.offsetBasis,/NOT verified OBS media offset/);
    assert.deepEqual(marker.clockWitnesses,[]);
    assert.equal(marker.sequence,1);
    assert.throws(()=>book.mark({recording:false,state:'preserved'}),/confirmed active recording/);
    const lines=readFileSync(file,'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(lines.length,2);
    assert.equal(lines[0].type,'recording-confirmed-observation');
    assert.equal(lines[1].markId,marker.markId);
    assert.equal(lines[1].sessionId,lines[0].sessionId);
    const first=book.attend({markId:marker.markId,dimensions:['curiouser','joyful'],explicitNone:false,expectedPreviousId:null});
    assert.deepEqual(first.dimensions,['joyful','curiouser']);
    assert.equal(first.previousId,null);
    const second=book.attend({markId:marker.markId,dimensions:[],explicitNone:true,expectedPreviousId:first.id});
    assert.equal(second.previousId,first.id);
    assert.equal(second.explicitNone,true);
    assert.throws(()=>book.attend({markId:marker.markId,dimensions:['joyful'],expectedPreviousId:first.id}),/stale/);
    assert.throws(()=>book.attend({markId:marker.markId,dimensions:['joyful','joyful'],expectedPreviousId:second.id}),/distinct/);
    assert.throws(()=>book.attend({markId:'00000000-0000-4000-8000-000000000000',dimensions:[],expectedPreviousId:null}),/requires a mark/);
    const revisions=readFileSync(file,'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(revisions.length,4);
    assert.equal(revisions[2].type,'human-attention-declaration');
    assert.equal(revisions[3].markId,marker.markId);
    assert.match(revisions[3].basis,/not verified OBS media offset/);
  } finally {rmSync(root,{recursive:true,force:true});}
});
test('journal is opt in; malformed CLI and missing private path refuse',()=>{
  assert.equal(parseBroadcastCliArgs(['event.json']).momentJournal,undefined);
  assert.equal(parseBroadcastCliArgs(['event.json','--moment-journal','/private/marks.jsonl']).momentJournal,'/private/marks.jsonl');
  assert.throws(()=>parseBroadcastCliArgs(['event.json','--moment-journal']),/requires one private/);
  assert.throws(()=>createMomentMarker({journalPath:'',eventId:'s'}),/required/);
});
