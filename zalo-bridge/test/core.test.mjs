import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync,readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createBridge } from '../src/core.mjs';
import { createHash } from 'node:crypto';

const key = 'ab'.repeat(32);
const settle = () => new Promise(resolve => setImmediate(resolve));
function fixture(t, overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(),'zalo-test-'));
  const database = join(dir,'test.sqlite');
  let calls = 0, clock = 100_000;
  const api = { uid:'123', credentials:{ cookie:'sensitive-cookie' }, friends:async () => [], send:async () => { calls++; return { id:'456' }; }, ...overrides };
  const adapter = { connect:async () => api,restore:async () => api };
  let bridge = createBridge({ adapter,database,encryptionKey:key,now:() => clock });
  t.after(() => { bridge.close(); rmSync(dir,{ recursive:true,force:true }); });
  return { get bridge() { return bridge; }, get calls() { return calls; },database,
    advance:() => { clock += 60_000; },
    restart:async () => { bridge.close(); bridge=createBridge({adapter,database,encryptionKey:key,now:() => clock}); await bridge.restore(); } };
}
const payload = { id:'job-1', account_uid:'123',uid:'789',message:'Báo giá VF 7' };
const pdf = bytes => ({name:'P97_BaoGia_11111111-1111-1111-1111-111111111111.pdf',
  base64:bytes.toString('base64'),sha256:createHash('sha256').update(bytes).digest('hex')});

test('PDF journal includes exact attachment and survives restart without a second send',async t => {
  const f=fixture(t); f.bridge.connect('a'); await settle();
  const attached={...payload,attachment:pdf(Buffer.from('%PDF-snapshot'))};
  assert.equal((await f.bridge.send('a',attached)).status,'sent');
  await f.restart();
  assert.equal((await f.bridge.send('a',attached)).status,'sent');
  assert.equal((await f.bridge.send('a',{...attached,attachment:pdf(Buffer.from('%PDF-changed'))})).status,'failed');
  assert.equal((await f.bridge.send('a',payload)).status,'failed');
  assert.equal(f.calls,1);
});

test('PDF partial or uncertain provider errors are not automatically retried',async t => {
  let sends=0;
  const f=fixture(t,{send:async () => { sends++; throw Object.assign(new Error('Upload rejected'),{name:'ZcaApiError',code:114}); }});
  f.bridge.connect('a'); await settle();
  const attached={...payload,attachment:pdf(Buffer.from('%PDF-snapshot'))};
  assert.equal((await f.bridge.send('a',attached)).status,'unknown');
  assert.equal((await f.bridge.send('a',attached)).status,'unknown');
  assert.equal(sends,1);
});

test('repeated job IDs send once, including after restart', async t => {
  const f=fixture(t); f.bridge.connect('dealer-a'); await settle();
  assert.equal((await f.bridge.send('dealer-a',payload)).status,'sent');
  assert.equal((await f.bridge.send('dealer-a',payload)).status,'sent');
  await f.restart();
  assert.equal((await f.bridge.send('dealer-a',payload)).status,'sent');
  assert.equal(f.calls,1);
});
test('cross-staff job access and id reuse cannot leak results or send', async t => {
  const f=fixture(t); f.bridge.connect('a'); await settle(); await f.bridge.send('a',payload);
  assert.equal(f.bridge.job('b',payload.id).status,'missing');
  assert.equal((await f.bridge.send('b',payload)).status,'failed');
  assert.equal((await f.bridge.send('a',{...payload,message:'changed'})).status,'failed');
  assert.equal(f.calls,1);
});
test('provider errors are unknown and never automatically retried', async t => {
  let calls=0;
  const f=fixture(t,{send:async () => { calls++; throw new Error('connection lost after send'); }});
  f.bridge.connect('a'); await settle();
  assert.equal((await f.bridge.send('a',payload)).status,'unknown');
  await f.restart();
  assert.equal((await f.bridge.send('a',payload)).status,'unknown');
  assert.equal(calls,1);
});
test('explicit invalid-parameter rejection is failed without invalidating the login',async t => {
  const error=Object.assign(new Error('Invalid parameters'),{name:'ZcaApiError',code:114});
  const f=fixture(t,{send:async () => {throw error;}});
  f.bridge.connect('a'); await settle();
  assert.equal((await f.bridge.send('a',payload)).status,'failed');
  assert.equal(f.bridge.status('a').status,'connected');
  assert.equal((await f.bridge.send('a',{...payload,id:'next'})).reason,'rate_limited');
});
test('rate limit survives restart; disconnected or wrong account never sends', async t => {
  const f=fixture(t);
  assert.equal((await f.bridge.send('a',payload)).status,'deferred');
  f.bridge.connect('a'); await settle();
  assert.equal((await f.bridge.send('a',{...payload,account_uid:'wrong'})).status,'deferred');
  await f.bridge.send('a',payload); await f.restart();
  assert.equal((await f.bridge.send('a',{...payload,id:'job-2'})).status,'deferred');
  f.advance(); assert.equal((await f.bridge.send('a',{...payload,id:'job-2'})).status,'sent');
  assert.equal(f.calls,2);
});
test('credentials are encrypted and account cannot belong to two employees', async t => {
  const f=fixture(t); f.bridge.connect('a'); await settle(); f.bridge.connect('b'); await settle();
  assert.equal(f.bridge.status('a').status,'connected');
  assert.equal(f.bridge.status('b').status,'account_in_use');
  assert.ok(!readFileSync(`${f.database}-wal`).includes(Buffer.from('sensitive-cookie')));
  assert.ok(!JSON.stringify(f.bridge.status('a')).includes('sensitive-cookie'));
});

test('employees in the same dealership connect and send with independent accounts',async t => {
  const dir=mkdtempSync(join(tmpdir(),'zalo-staff-'));
  const sent=[];
  let next=0;
  const bridge=createBridge({database:join(dir,'db.sqlite'),encryptionKey:key,now:()=>100_000,
    adapter:{connect:async()=>{
      const uid=String(++next);
      return {uid,credentials:{cookie:`cookie-${uid}`},send:async(recipient,message)=>{
        sent.push({uid,recipient,message});return {id:`message-${uid}`};
      }};
    }}
  });
  t.after(()=>{bridge.close();rmSync(dir,{recursive:true,force:true});});
  bridge.connect('employee-a');await settle();
  bridge.connect('employee-b');await settle();
  assert.equal(bridge.status('employee-a').uid,'1');
  assert.equal(bridge.status('employee-b').uid,'2');
  assert.equal((await bridge.send('employee-a',{...payload,id:'a',account_uid:'1'})).status,'sent');
  assert.equal((await bridge.send('employee-b',{...payload,id:'b',account_uid:'2'})).status,'sent');
  assert.deepEqual(sent.map(item=>item.uid),['1','2']);
  bridge.disconnect('employee-a');
  assert.equal(bridge.status('employee-b').status,'connected');
});
test('restart converts an interrupted provider call to unknown', async t => {
  const f=fixture(t); f.bridge.connect('a'); await settle();
  const db=new DatabaseSync(f.database);
  db.prepare("INSERT INTO jobs(id,dealer,hash,status) VALUES ('interrupted','a','hash','sending')").run(); db.close();
  await f.restart(); assert.equal(f.bridge.job('a','interrupted').status,'unknown');
});
test('disconnect during QR generation prevents a late login from being saved', async t => {
  const dir=mkdtempSync(join(tmpdir(),'zalo-cancel-'));
  let finish;
  const bridge=createBridge({ database:join(dir,'db.sqlite'),encryptionKey:key,
    adapter:{connect:() => new Promise(resolve => { finish=resolve; })} });
  t.after(() => { bridge.close(); rmSync(dir,{recursive:true,force:true}); });
  bridge.connect('a'); bridge.disconnect('a');
  finish({uid:'123',credentials:{cookie:'secret'}}); await settle();
  assert.equal(bridge.status('a').status,'disconnected');
});

test('provider timeout remains unknown when the provider eventually succeeds', async t => {
  const dir=mkdtempSync(join(tmpdir(),'zalo-timeout-'));
  let finish,calls=0;
  const api={uid:'123',credentials:{cookie:'secret'},send:() => { calls++; return new Promise(resolve => {finish=resolve;}); }};
  const bridge=createBridge({ database:join(dir,'db.sqlite'),encryptionKey:key,sendTimeoutMs:5,
    adapter:{connect:async () => api} });
  t.after(() => {bridge.close();rmSync(dir,{recursive:true,force:true});});
  bridge.connect('a'); await settle();
  assert.equal((await bridge.send('a',payload)).status,'unknown');
  finish({id:'late'}); await settle();
  assert.equal((await bridge.send('a',payload)).status,'unknown'); assert.equal(calls,1);
});
