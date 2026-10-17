import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wrapZaloApi } from '../src/zca-adapter.mjs';
import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';

const data = Buffer.from('%PDF-1.4 test quote');
const attachment = {name:'P97_BaoGia_11111111-1111-1111-1111-111111111111.pdf',
  base64:data.toString('base64'),sha256:createHash('sha256').update(data).digest('hex')};
function pdfApi(mode = 'ok') {
  const listener=new EventEmitter();
  const calls=[];
  let starts=0, ready=false;
  listener.start=() => { starts++; queueMicrotask(() => { ready=true; listener.emit(mode === 'offline' ? 'error' : 'connected'); }); };
  listener.stop=() => { ready=false; listener.emit('closed'); };
  const api={listener,getOwnId:() => '100',getContext:() => ({cookie:{serializeSync:() => ({cookies:[]})}}),
    sendMessage:async (...args) => {assert.equal(ready,true); calls.push(args);
      if (mode === 'rejected') throw new Error('Uncertain provider outcome');
      return {message:{msgId:123},attachment:mode === 'missing' ? [] : [{msgId:456}]};}};
  return {api,calls,get starts() {return starts;}};
}

test('self-test uses personal cloud recipient; customer sends keep customer UID',async () => {
  const calls=[];
  const api={getOwnId:() => '100',getContext:() => ({cookie:{serializeSync:() => ({cookies:[]})},loginInfo:{send2me_id:'900'}}),
    sendMessage:async (...args) => {calls.push(args);return {message:{msgId:123}};}};
  const wrapped=wrapZaloApi(api);
  await wrapped.send('100','self test'); await wrapped.send('200','customer quote');
  assert.equal(calls[0][1],'900');assert.equal(calls[1][1],'200');
});
test('missing self cloud recipient fails before any provider send',async () => {
  let calls=0;
  const api={getOwnId:() => '100',getContext:() => ({cookie:{serializeSync:() => ({cookies:[]})}}),sendMessage:async () => {calls++;}};
  await assert.rejects(wrapZaloApi(api).send('100','test'),{name:'ZaloValidationError'});
  assert.equal(calls,0);
});

test('PDF waits for upload listener and sends original bytes with file confirmation',async () => {
  const f=pdfApi(), wrapped=wrapZaloApi(f.api);
  assert.deepEqual(await wrapped.send('200','quote',attachment),{id:456});
  assert.deepEqual(f.calls[0][0],{msg:'quote',attachments:[{data,filename:attachment.name,metadata:{totalSize:data.length}}]});
  assert.equal(f.calls[0][1],'200');
  await wrapped.send('201','second quote',attachment);
  assert.equal(f.starts,1);
  f.api.listener.stop();
  await wrapped.send('202','reconnected',attachment);
  assert.equal(f.starts,2);
  wrapped.close();
});

test('listener failure and corrupt PDFs never reach provider send',async () => {
  const f=pdfApi('offline'), wrapped=wrapZaloApi(f.api);
  await assert.rejects(wrapped.send('200','quote',attachment),{name:'ZaloValidationError'});
  await assert.rejects(wrapped.send('200','quote',{...attachment,sha256:'0'.repeat(64)}),{name:'ZaloValidationError'});
  assert.equal(f.calls.length,0);
});

test('text success alone is insufficient to mark PDF delivered',async () => {
  for (const mode of ['missing','rejected']) {
    const f=pdfApi(mode), wrapped=wrapZaloApi(f.api);
    await assert.rejects(wrapped.send('200','quote',attachment),{name:'Error'});
    assert.equal(f.calls.length,1);
    wrapped.close();
  }
});
