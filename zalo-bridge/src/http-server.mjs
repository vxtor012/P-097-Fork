import http from 'node:http';
import { createHash,timingSafeEqual } from 'node:crypto';
import { pdfAttachmentSource } from './pdf-attachment.mjs';

export function createHttpServer(bridge, token) {
if (token.length < 32) throw new Error('ZALO_BRIDGE_TOKEN must have at least 32 characters');
const secretHash = createHash('sha256').update(`Bearer ${token}`).digest();
const uuid = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const route = new RegExp(`^/accounts/(${uuid})(?:/(connect|friends|send|jobs|resolve)(?:/(${uuid}))?)?$`,'i');

return http.createServer(async (req,res) => {
  const reply = (code,data) => { res.writeHead(code,{ 'Content-Type':'application/json','Cache-Control':'no-store' }); res.end(JSON.stringify(data)); };
  const provided = createHash('sha256').update(req.headers.authorization ?? '').digest();
  if (!timingSafeEqual(secretHash,provided)) return reply(401,{ error:'Unauthorized' });
  const match = route.exec(req.url);
  if (!match) return reply(404,{ error:'Not found' });
  const [,dealer,action,id] = match;
  try {
    if (req.method === 'GET' && !action) return reply(200,bridge.status(dealer));
    if (req.method === 'POST' && action === 'connect') return reply(200,bridge.connect(dealer));
    if (req.method === 'DELETE' && !action) return reply(200,bridge.disconnect(dealer));
    if (req.method === 'GET' && action === 'friends') return reply(200,await bridge.friends(dealer));
    if (req.method === 'GET' && action === 'jobs' && id) return reply(200,bridge.job(dealer,id));
    if (req.method === 'POST' && action === 'resolve') {
      let body='';
      for await (const chunk of req) { body+=chunk; if(body.length>1024)return reply(413,{error:'Too large'}); }
      const payload=JSON.parse(body);
      if(!/^0\d{9}$/.test(payload.phone))return reply(422,{error:'Invalid phone'});
      return reply(200,await bridge.resolve(dealer,payload.phone));
    }
    if (req.method === 'POST' && action === 'send') {
      let body = '', size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 2 * 1024 * 1024) return reply(413,{ error:'Too large' }); body += chunk; }
      const payload = JSON.parse(body);
      if (!new RegExp(`^${uuid}$`,'i').test(payload.id) || !/^\d{1,100}$/.test(payload.uid)
          || !/^\d{1,100}$/.test(payload.account_uid) || typeof payload.message !== 'string'
          || !payload.message.trim() || payload.message.length > 3000) return reply(422,{ error:'Invalid payload' });
      if (payload.attachment != null) {
        try { pdfAttachmentSource(payload.attachment); }
        catch { return reply(422,{error:'Invalid PDF attachment'}); }
      }
      return reply(200,await bridge.send(dealer,payload));
    }
    reply(405,{ error:'Method not allowed' });
  } catch { reply(503,{ error:'Zalo bridge unavailable' }); }
});
}
