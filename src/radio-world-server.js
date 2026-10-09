/* RADIO WORLD 001: read-only loopback PWA shell. No stream or URL proxy routes. */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateWorldRegistry, worldSnapshot } from './radio-world-001.js';

const root=join(dirname(fileURLToPath(import.meta.url)),'..','examples','radio-world-001');
const TYPES=new Map([
  ['/', ['index.html','text/html; charset=utf-8']],
  ['/app.js',['app.js','text/javascript; charset=utf-8']],
  ['/styles.css',['styles.css','text/css; charset=utf-8']],
  ['/manifest.webmanifest',['manifest.webmanifest','application/manifest+json']],
  ['/sw.js',['sw.js','text/javascript; charset=utf-8']],
  ['/icon.svg',['icon.svg','image/svg+xml']],
]);
const HEADERS={
  'cache-control':'no-store',
  'x-content-type-options':'nosniff',
  'referrer-policy':'no-referrer',
  'x-frame-options':'DENY',
  'content-security-policy':"default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self'; connect-src 'self'; media-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'; manifest-src 'self'; frame-ancestors 'none'"
};
export function createRadioWorldServer({registry,host='127.0.0.1',port=0}={}) {
  if(host!=='127.0.0.1')throw new TypeError('radio world may only bind loopback');
  if(!Number.isSafeInteger(port)||port<0||port>65535)throw new TypeError('invalid port');
  const projected=worldSnapshot(validateWorldRegistry(registry));
  const server=createServer((req,res)=>{
    const path=new URL(req.url||'/', 'http://127.0.0.1').pathname;
    const answer=(status,bytes,ctype)=>{
      res.writeHead(status,{...HEADERS,'content-type':ctype,
        'content-length':Buffer.byteLength(bytes)});
      res.end(req.method==='HEAD'?undefined:bytes);
    };
    if(!['GET','HEAD'].includes(req.method))return answer(405,'method not allowed','text/plain');
    if(path==='/api/worlds')return answer(200,JSON.stringify(projected),'application/json; charset=utf-8');
    const asset=TYPES.get(path);
    if(!asset)return answer(404,'not found','text/plain');
    return answer(200,readFileSync(join(root,asset[0])),asset[1]);
  });
  let opened=false;
  return {
    async start() {
      if(opened)throw new Error('already started');
      await new Promise((resolve,reject)=>{
        server.once('error',reject);
        server.listen(port,host,()=>{server.off('error',reject);resolve()});
      });
      opened=true;
      const a=server.address();
      return {url:'http://127.0.0.1:'+a.port+'/',host,port:a.port};
    },
    async stop() {
      if(!opened)return;
      await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
      opened=false;
    }
  };
}
