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
  } finally {rmSync(root,{recursive:true,force:true});}
});
test('journal is opt in; malformed CLI and missing private path refuse',()=>{
  assert.equal(parseBroadcastCliArgs(['event.json']).momentJournal,null);
  assert.equal(parseBroadcastCliArgs(['event.json','--moment-journal','/private/marks.jsonl']).momentJournal,'/private/marks.jsonl');
  assert.throws(()=>parseBroadcastCliArgs(['event.json','--moment-journal']),/requires one private/);
  assert.throws(()=>createMomentMarker({journalPath:'',eventId:'s'}),/required/);
});
