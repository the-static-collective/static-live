import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRadioWorldServer } from './radio-world-server.js';
const cfg=fileURLToPath(new URL('../fixtures/radio-world-001/worlds.json',import.meta.url));
const manifest=JSON.parse(readFileSync(cfg,'utf8'));
const server=createRadioWorldServer({registry:manifest,port:Number(process.env.RADIO_WORLD_PORT||8789)});
server.start().then(x=>{console.log('RADIO WORLD 001 / OWNER-SAFE LINKS / '+x.url);}).catch(e=>{
  console.error('RADIO WORLD HOLD:',e.message);process.exitCode=1;
});
