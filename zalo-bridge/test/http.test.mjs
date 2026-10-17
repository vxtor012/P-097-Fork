import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { createHttpServer } from '../src/http-server.mjs';

test('private bridge accepts PDF bodies over 32KB and rejects corrupt or oversized attachments',async t => {
  let calls=0;
  const token='test-only-token-'.repeat(3), id='11111111-1111-1111-1111-111111111111';
  const server=createHttpServer({send:async () => { calls++; return {status:'sent'}; }},token);
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url=`http://127.0.0.1:${server.address().port}/accounts/${id}/send`;
  const data=Buffer.concat([Buffer.from('%PDF-'),Buffer.alloc(40_000,65)]);
  const payload={id,uid:'456',account_uid:'123',message:'quote',attachment:{name:`P97_BaoGia_${id}.pdf`,
    base64:data.toString('base64'),sha256:createHash('sha256').update(data).digest('hex')}};
  const send=(body,auth=token) => fetch(url,{method:'POST',headers:{authorization:`Bearer ${auth}`,'content-type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await send(payload,'wrong')).status,401);
  assert.equal((await send(payload)).status,200);
  assert.equal((await send({...payload,attachment:{...payload.attachment,sha256:'0'.repeat(64)}})).status,422);
  assert.equal((await send({...payload,attachment:{...payload.attachment,name:'../../quote.pdf'}})).status,422);
  assert.equal((await send({...payload,attachment:{...payload.attachment,base64:'A'.repeat(1_500_000)}})).status,422);
  assert.equal(calls,1);
});
