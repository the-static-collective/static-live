import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { createMomentMarker } from '../src/lifestream-002-marker.js';
import { finalizeMarker } from '../src/lifestream-002-finalize.js';
import { verifyMoment } from '../src/lifestream-001.js';

const utc='2026-09-20T15:00:00.000Z';
test('durable mark may be manually aligned with actual finished media; observed clocks stay independent',()=>{
  const root=mkdtempSync(join(tmpdir(),'moment-final-'));
  try{
    const journal=join(root,'marks.jsonl'),source=join(root,'recorded.raw'),out=join(root,'moment.json');
    const fileBytes=Buffer.from('synthetic finished recording\n');
    writeFileSync(source,fileBytes);
    let tick=1000;
    const book=createMomentMarker({journalPath:journal,eventId:'session:01',
      tick:()=>tick,now:()=>utc});
    book.begin();tick=1420;
    const mark=book.mark({recording:true,state:'recording_only'});
    const clocks=[{clockId:'clockwork.abstract-60',reading:'17',
      basis:'independent declared abstract reading, not media time',observedAtUtc:utc,
      evidenceRef:'fixture:clock17'}];
    assert.throws(()=>finalizeMarker({journalFile:journal,markId:mark.markId,
      recordingFile:source,startMs:100,endMs:800,recordingStartedAtUtc:utc,outFile:out}),
      /recording-finished/);
    const result=finalizeMarker({journalFile:journal,markId:mark.markId,
      recordingFile:source,startMs:100,endMs:800,recordingStartedAtUtc:utc,
      outFile:out,recordingFinished:true,clockWitnesses:clocks});
    const moment=JSON.parse(readFileSync(out,'utf8'));
    assert.equal(result.status,'manual_media_alignment_declared_not_measured');
    assert.equal(moment.span.startMs,100);
    assert.equal(moment.clockWitnesses[0].reading,'elapsed-since-confirmation-ms=420');
    assert.match(moment.clockWitnesses[0].basis,/NOT inferred/);
    assert.equal(moment.clockWitnesses[1].reading,'17');
    assert.equal(verifyMoment(moment,source).momentId,result.momentId);
    assert.throws(()=>finalizeMarker({journalFile:journal,markId:mark.markId,
      recordingFile:source,startMs:100,endMs:800,recordingStartedAtUtc:utc,
      outFile:out,recordingFinished:true}),/EEXIST/);
    writeFileSync(source,'changed after capture');
    assert.throws(()=>verifyMoment(moment,source),/source bytes do not match/);
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('unknown mark and corrupt journal refuse without creating a moment',()=>{
  const root=mkdtempSync(join(tmpdir(),'moment-final-'));
  try{
    const journal=join(root,'marks.jsonl'),source=join(root,'recorded.raw');
    writeFileSync(source,'finished source');
    const book=createMomentMarker({journalPath:journal,eventId:'s',tick:()=>4,now:()=>utc});
    book.begin();book.mark({recording:true,state:'recording_only'});
    const args={journalFile:journal,markId:'missing',recordingFile:source,startMs:0,endMs:1,
      recordingStartedAtUtc:utc,outFile:join(root,'moment.json'),recordingFinished:true};
    assert.throws(()=>finalizeMarker(args),/exactly one/);
    writeFileSync(journal,'broken incomplete');
    assert.throws(()=>finalizeMarker(args),/incomplete marker journal line/);
  }finally{rmSync(root,{recursive:true,force:true});}
});
