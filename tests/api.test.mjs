import assert from 'node:assert/strict';
import {Tournament} from '../lib/tournament.js';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),workerRequire=createRequire(require.resolve('wrangler/package.json'));
const {Miniflare}=workerRequire('miniflare'),{build}=workerRequire('esbuild');
const bundle=await build({entryPoints:['tests/api.worker.ts'],bundle:true,write:false,format:'esm',platform:'neutral',external:['cloudflare:workers']});
const password='local-test-password',origin='https://greenroom.test';
const mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-05-15',bindings:{ADMIN_PASSWORD:password},d1Databases:{DB:'greenroom-test'}});
try {
const db=await mf.getD1Database('DB');
const schema=await readFile('drizzle/0000_broken_firebrand.sql','utf8');
await db.batch(schema.split('--> statement-breakpoint').map(sql=>db.prepare(sql.trim())));
const call=(path,method='GET',data,cookie='',extra={})=>mf.dispatchFetch(origin+path,{method,headers:{Origin:origin,...(data?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...extra},...(data?{body:JSON.stringify(data)}:{})});
let response=await call('/api/tournament');assert.equal(response.status,200);let initial=await response.json();assert.equal(initial.admin,false);
assert.equal((await call('/api/tournament','PUT',{revision:initial.revision,tournament:{}})).status,401);
assert.equal((await call('/api/admin','POST',{password:'wrong'})).status,401);
response=await call('/api/admin','POST',{password});assert.equal(response.status,200);const cookieHeader=response.headers.get('set-cookie');assert.match(cookieHeader,/HttpOnly/);assert.match(cookieHeader,/SameSite=Strict/);assert.match(cookieHeader,/; Secure/);const cookie=cookieHeader.split(';')[0];assert.equal((await(await call('/api/admin','GET',null,cookie)).json()).admin,true);
assert.equal((await call('/api/tournament','PUT',{revision:initial.revision,tournament:{}},cookie,{Origin:'https://example.com'})).status,403);
assert.equal((await call('/api/tournament','PUT',{revision:initial.revision,tournament:{}},cookie)).status,400);
for(const format of ['single','two','four','robin']){
 const t=new Tournament(['Mina','Alex','Jordan','Sofia'],'Sierra Chess-A-Thon',false,format);
 response=await call('/api/tournament','PUT',{revision:initial.revision,tournament:t.data()},cookie);assert.equal(response.status,200);let created=await response.json();assert.equal(created.revision,initial.revision+1);
 assert.equal((await call('/api/tournament','PUT',{revision:initial.revision,tournament:t.data()},cookie)).status,409);
 const m=t.rounds()[0].find(m=>m.ready);t.choose(m.r,m.m,format==='robin'?0:m.a.id);
 response=await call('/api/tournament','PUT',{revision:created.revision,tournament:t.data()},cookie);assert.equal(response.status,200);initial=await response.json();
 const view=await(await call('/api/tournament')).json();assert.equal(view.admin,false);assert.equal(view.revision,initial.revision);assert.deepEqual(view.tournament,t.data());
}
assert.equal((await call('/api/admin','DELETE',null,cookie)).status,200);
assert.equal((await call('/api/tournament','PUT',{revision:initial.revision,tournament:initial.tournament},cookie)).status,401);
const attacker={'cf-connecting-ip':'198.51.100.2'};
for(let i=0;i<10;i++)assert.equal((await call('/api/admin','POST',{password:'wrong'},'',attacker)).status,401);
assert.equal((await call('/api/admin','POST',{password:'wrong'},'',attacker)).status,429);
console.log('PASS: viewer read-only access, incorrect password, admin login, cookie security, CSRF rejection, all formats, shared persistence, revision conflicts, logout revocation, and login rate limit.');

} finally {await mf.dispose();}
