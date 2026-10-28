import assert from 'node:assert/strict';
import {Tournament} from '../lib/tournament.js';
import {createRequire} from 'node:module';
import {readFile,readdir} from 'node:fs/promises';
const require=createRequire(import.meta.url),workerRequire=createRequire(require.resolve('wrangler/package.json'));
const {Miniflare}=workerRequire('miniflare'),{build}=workerRequire('esbuild');
const bundle=await build({entryPoints:['tests/api.worker.ts'],bundle:true,write:false,format:'esm',platform:'neutral',external:['cloudflare:workers']});
const password='local-test-password',origin='https://greenroom.test';
const mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-05-15',bindings:{ADMIN_PASSWORD:password},d1Databases:{DB:'greenroom-test'}});
try {
const db=await mf.getD1Database('DB');
for(const name of (await readdir('drizzle')).filter(n=>n.endsWith('.sql')).sort()){const schema=await readFile('drizzle/'+name,'utf8');await db.batch(schema.split('--> statement-breakpoint').map(sql=>db.prepare(sql.trim())));}
const call=(path,method='GET',data,cookie='',extra={})=>mf.dispatchFetch(origin+path,{method,headers:{Origin:origin,...(data?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...extra},...(data?{body:JSON.stringify(path==='/api/admin'&&method==='POST'?{username:'admin',...data}:data)}:{})});
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

// Account management and authorization, isolated from the hosted database.
assert.equal((await call('/api/accounts')).status,403);
assert.equal((await call('/api/admin','POST',{username:'',password})).status,401);
assert.equal((await call('/api/accounts','POST',{username:'reader',password:'reader-password',role:'viewer'},cookie,{Origin:'https://evil.example'})).status,403);
assert.equal((await call('/api/accounts','POST',{username:'admin',password:'reader-password',role:'viewer'},cookie)).status,409);
assert.equal((await call('/api/accounts','POST',{username:'reader',password:'short',role:'viewer'},cookie)).status,400);
assert.equal((await call('/api/accounts','POST',{username:'Reader',password:'reader-password',role:'viewer'},cookie)).status,201);
assert.equal((await call('/api/accounts','POST',{username:'READER',password:'reader-password',role:'admin'},cookie)).status,409);
let list=await(await call('/api/accounts','GET',null,cookie)).json(),reader=list.accounts.find(a=>a.username==='reader');assert(reader);assert(!JSON.stringify(list).includes('password_hash'));assert(!JSON.stringify(list).includes('reader-password'));
let stored=await db.prepare('SELECT password_hash,salt FROM accounts WHERE id = ?').bind(reader.id).first();assert.equal(stored.password_hash.length,64);assert.notEqual(stored.password_hash,'reader-password');assert.equal(stored.salt.length,64);
async function login(username,password){let response=await call('/api/admin','POST',{username,password});assert.equal(response.status,200);return response.headers.get('set-cookie').split(';')[0];}
let readerCookie=await login('reader','reader-password');let readerState=await(await call('/api/tournament','GET',null,readerCookie)).json();assert.equal(readerState.admin,false);assert.equal(readerState.user.username,'reader');
assert.equal((await call('/api/tournament','PUT',{revision:initial.revision,tournament:initial.tournament},readerCookie)).status,401);
assert.equal((await call('/api/accounts','GET',null,readerCookie)).status,403);
assert.equal((await call('/api/accounts','POST',{username:'intruder',password:'reader-password',role:'admin'},readerCookie)).status,403);
assert.equal((await call('/api/accounts','PATCH',{id:'system-admin',disabled:true},cookie)).status,403);
assert.equal((await call('/api/accounts','DELETE',{id:'system-admin'},cookie)).status,403);
assert.equal((await call('/api/accounts','PATCH',{id:reader.id,disabled:true},cookie)).status,200);
assert.equal((await(await call('/api/admin','GET',null,readerCookie)).json()).user,null);
assert.equal((await call('/api/admin','POST',{username:'reader',password:'reader-password'})).status,401);
assert.equal((await call('/api/accounts','PATCH',{id:reader.id,disabled:false},cookie)).status,200);
readerCookie=await login('reader','reader-password');
assert.equal((await call('/api/accounts','PATCH',{id:reader.id,password:'replacement-password'},cookie)).status,200);
assert.equal((await(await call('/api/admin','GET',null,readerCookie)).json()).user,null);
assert.equal((await call('/api/admin','POST',{username:'reader',password:'reader-password'})).status,401);
readerCookie=await login('reader','replacement-password');
assert.equal((await call('/api/accounts','PATCH',{id:reader.id,role:'admin'},cookie)).status,200);
assert.equal((await(await call('/api/admin','GET',null,readerCookie)).json()).user,null);
readerCookie=await login('reader','replacement-password');assert.equal((await(await call('/api/admin','GET',null,readerCookie)).json()).admin,true);
assert.equal((await call('/api/accounts','GET',null,readerCookie)).status,200);
assert.equal((await call('/api/accounts','PATCH',{id:reader.id,role:'viewer'},readerCookie)).status,400);
assert.equal((await call('/api/accounts','POST',{username:'helper',password:'helper-password',role:'viewer'},readerCookie)).status,201);
assert.equal((await call('/api/accounts','DELETE',{id:reader.id},cookie)).status,200);
assert.equal((await(await call('/api/admin','GET',null,readerCookie)).json()).user,null);
assert.equal((await call('/api/admin','POST',{username:'reader',password:'replacement-password'})).status,401);
assert.equal((await call('/api/accounts','DELETE',{id:reader.id},cookie)).status,404);
console.log('PASS: account creation, hashed passwords, uniqueness, viewer restrictions, admin delegation, protected root/self, disable/enable, resets, role changes, session revocation, and deletion.');
assert.equal((await call('/api/admin','DELETE',null,cookie)).status,200);
assert.equal((await call('/api/tournament','PUT',{revision:initial.revision,tournament:initial.tournament},cookie)).status,401);
const attacker={'cf-connecting-ip':'198.51.100.2'};
for(let i=0;i<10;i++)assert.equal((await call('/api/admin','POST',{password:'wrong'},'',attacker)).status,401);
assert.equal((await call('/api/admin','POST',{password:'wrong'},'',attacker)).status,429);
console.log('PASS: viewer read-only access, incorrect password, admin login, cookie security, CSRF rejection, all formats, shared persistence, revision conflicts, logout revocation, and login rate limit.');

} finally {await mf.dispose();}
