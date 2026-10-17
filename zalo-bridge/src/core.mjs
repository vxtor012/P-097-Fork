import { DatabaseSync } from 'node:sqlite';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { pdfAttachmentSource } from './pdf-attachment.mjs';

export function createBridge({ adapter, database, encryptionKey, minDelayMs = 60_000, sendTimeoutMs = 45_000, now = Date.now }) {
  // Account keys are authenticated staff UUIDs. The historical SQLite column
  // "dealer" stays in place to avoid copying or rewriting stored credentials.
  const key = Buffer.from(encryptionKey, 'hex');
  if (key.length !== 32 || !/^[a-f\d]{64}$/i.test(encryptionKey)) throw new Error('A 32-byte encryption key is required');
  const db = new DatabaseSync(database);
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS accounts (dealer TEXT PRIMARY KEY,uid TEXT UNIQUE NOT NULL,secret TEXT NOT NULL,last_send INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY,dealer TEXT NOT NULL,hash TEXT NOT NULL,status TEXT NOT NULL,provider_id TEXT,error TEXT);
    UPDATE jobs SET status='unknown',error='Dịch vụ khởi động lại trong lúc gửi; cần đối soát' WHERE status='sending';`);
  const states = new Map();
  const busy = new Set();
  const encrypt = value => {
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
    const body = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
  };
  const decrypt = value => {
    const data = Buffer.from(value, 'base64'), cipher = createDecipheriv('aes-256-gcm', key, data.subarray(0, 12));
    cipher.setAuthTag(data.subarray(12, 28));
    return JSON.parse(Buffer.concat([cipher.update(data.subarray(28)), cipher.final()]).toString());
  };
  const status = dealer => {
    const state = states.get(dealer);
    return state ? { status: state.status, uid: state.uid ?? null, qr: state.qr ?? null } : { status: 'disconnected', uid: null, qr: null };
  };
  async function restore() {
    const accounts = db.prepare('SELECT * FROM accounts').all();
    const restoring = accounts.map(account => {
      const state = { status: 'restoring', uid: account.uid };
      states.set(account.dealer, state);
      return { account,state };
    });
    await Promise.all(restoring.map(async ({ account,state }) => {
      try {
        const api = await adapter.restore(decrypt(account.secret));
        if (states.get(account.dealer) !== state) { api.close?.(); return; }
        if (String(api.uid) !== account.uid) { api.close?.(); state.status = 'reconnect_required'; return; }
        state.api = api; state.status = 'connected';
      } catch { state.status = 'reconnect_required'; }
    }));
  }
  function connect(dealer) {
    const old = states.get(dealer);
    if (old && ['waiting','scanned','connecting','connected','restoring'].includes(old.status)) return status(dealer);
    old?.abort?.(); old?.api?.close?.();
    const state = { status: 'connecting' };
    states.set(dealer, state);
    void adapter.connect(event => {
      if (states.get(dealer) !== state) { event.abort?.(); return; }
      state.status = event.status; state.qr = event.qr ?? null; state.abort = event.abort ?? state.abort;
    }).then(async api => {
      if (states.get(dealer) !== state) { api.close?.(); return; }
      const uid = String(api.uid);
      try {
        db.prepare(`INSERT INTO accounts(dealer,uid,secret) VALUES (?,?,?) ON CONFLICT(dealer)
          DO UPDATE SET uid=excluded.uid,secret=excluded.secret`).run(dealer, uid, encrypt(api.credentials));
        Object.assign(state, { api, uid, qr: null, status: 'connected' });
      } catch { api.close?.(); state.status = 'account_in_use'; state.qr = null; }
    }).catch(() => { if (states.get(dealer) === state) { state.status = 'reconnect_required'; state.qr = null; } });
    return status(dealer);
  }
  function disconnect(dealer) {
    if (busy.has(dealer)) return { status: 'busy' };
    const state = states.get(dealer);
    states.delete(dealer); state?.abort?.(); state?.api?.close?.();
    db.prepare('DELETE FROM accounts WHERE dealer=?').run(dealer);
    return status(dealer);
  }
  async function friends(dealer) {
    const state = states.get(dealer);
    if (state?.status !== 'connected') return { friends: [] };
    return { friends: await state.api.friends() };
  }
  function job(dealer, id) {
    const row = db.prepare('SELECT status,provider_id,error FROM jobs WHERE id=? AND dealer=?').get(id, dealer);
    return row ? { ...row } : { status: 'missing' };
  }
  async function resolve(dealer,phone) {
    const state=states.get(dealer);
    if (state?.status !== 'connected') return {status:'disconnected'};
    try {return await state.api.resolve(phone);} catch {return {status:'not_found'};}
  }
  async function send(dealer, payload) {
    const identity = [dealer,payload.account_uid,payload.uid,payload.message];
    if (payload.attachment != null) {
      try { pdfAttachmentSource(payload.attachment); }
      catch { return {status:'failed',error:'Tệp PDF không hợp lệ hoặc đã thay đổi.'}; }
      identity.push(payload.attachment.name,payload.attachment.sha256);
    }
    const hash = createHash('sha256').update(JSON.stringify(identity)).digest('hex');
    const old = db.prepare('SELECT * FROM jobs WHERE id=?').get(payload.id);
    if (old) {
      if (old.dealer !== dealer || old.hash !== hash) return { status: 'failed', error: 'Mã gửi đã được sử dụng' };
      return job(dealer, payload.id);
    }
    const state = states.get(dealer);
    if (state?.status !== 'connected') return { status: 'deferred', reason: 'disconnected' };
    if (state.uid !== payload.account_uid) return { status: 'deferred', reason: 'account_mismatch' };
    const account = db.prepare('SELECT last_send FROM accounts WHERE dealer=?').get(dealer);
    if (busy.has(dealer)) return { status: 'deferred', reason: 'busy' };
    if (now() - account.last_send < minDelayMs) return { status: 'deferred', reason: 'rate_limited', retry_after: Math.ceil((minDelayMs - (now() - account.last_send))/1000) };
    busy.add(dealer);
    db.prepare("INSERT INTO jobs(id,dealer,hash,status) VALUES (?,?,?,'sending')").run(payload.id,dealer,hash);
    db.prepare('UPDATE accounts SET last_send=? WHERE dealer=?').run(now(),dealer);
    let timeout;
    try {
      const result = await Promise.race([
        state.api.send(payload.uid,payload.message,payload.attachment),
        new Promise((_,reject) => { timeout = setTimeout(() => reject(new Error('Send timed out')),payload.attachment ? Math.max(sendTimeoutMs,90_000) : sendTimeoutMs); }),
      ]);
      db.prepare("UPDATE jobs SET status='sent',provider_id=? WHERE id=?").run(result?.id ? String(result.id) : null,payload.id);
    } catch (error) {
      // Provider diagnostics only: do not log payloads, cookies, URLs or credentials.
      const diagnostic = {
        name: String(error?.name ?? 'Error').slice(0,40),
        code: typeof error?.code === 'number' ? error.code : null,
        message: error?.name === 'ZcaApiError'
          ? String(error.message).replace(/https?:\/\/\S+/g,'[url]').replace(/\b\d{5,}\b/g,'[number]').slice(0,160)
          : 'Provider request failed or timed out',
      };
      console.warn('[Zalo send failed]',JSON.stringify(diagnostic));
      const rejected = (!payload.attachment && error?.name === 'ZcaApiError' && error.code === 114) || error?.name === 'ZaloValidationError';
      db.prepare('UPDATE jobs SET status=?,error=? WHERE id=?').run(
        rejected ? 'failed' : 'unknown',
        rejected ? (error?.name === 'ZaloValidationError' ? 'Chưa gửi: tệp PDF, người nhận hoặc kết nối tải tệp chưa sẵn sàng.' : 'Zalo từ chối yêu cầu: người nhận hoặc tham số không hợp lệ (114).') : 'Không xác định được kết quả; kiểm tra Zalo trước khi gửi lại',
        payload.id);
    } finally { clearTimeout(timeout); busy.delete(dealer); }
    return job(dealer,payload.id);
  }
  return { status,restore,connect,disconnect,friends,resolve,job,send,close: () => db.close() };
}
