// Uses the same zca-js dependency as Deplao, without Electron or its local CRM.
import { Zalo, LoginQRCallbackEventType, ThreadType } from 'zca-js';
import { pdfAttachmentSource } from './pdf-attachment.mjs';

const makeZalo = () => new Zalo({ selfListen: false, checkUpdate: false, logging: false,
  polyfill: (url, options = {}) => fetch(url, { ...options,
    signal: options.signal ? AbortSignal.any([options.signal,AbortSignal.timeout(60_000)]) : AbortSignal.timeout(60_000) }),
});
export function wrapZaloApi(api) {
  const context = api.getContext();
  let uploadReady = false, listenerStarted = false, waiting = null;
  // File uploads finish through the provider's websocket file_done callback.
  // Do not subscribe to, store or log incoming customer messages.
  api.listener?.on('disconnected', () => { uploadReady = false; });
  api.listener?.on('closed', () => { uploadReady = false; listenerStarted = false; });
  api.listener?.on('error', () => {});
  function ensureUploadReady() {
    if (uploadReady) return Promise.resolve();
    if (waiting) return waiting;
    const listener = api.listener;
    if (!listener) return Promise.reject(Object.assign(new Error('Upload listener unavailable'), { name: 'ZaloValidationError' }));
    waiting = new Promise((resolve, reject) => {
      const finish = error => {
        clearTimeout(timer);
        listener.off('connected', connected); listener.off('closed', failed); listener.off('error', failed);
        if (error) {
          listenerStarted = false; uploadReady = false; listener.stop();
          reject(Object.assign(new Error('Upload connection unavailable'), { name: 'ZaloValidationError' }));
        } else { uploadReady = true; resolve(); }
      };
      const connected = () => finish();
      const failed = () => finish(true);
      const timer = setTimeout(failed, 10_000);
      listener.once('connected', connected); listener.once('closed', failed); listener.once('error', failed);
      if (!listenerStarted) {
        listenerStarted = true;
        try { listener.start(); } catch { failed(); }
      }
    }).finally(() => { waiting = null; });
    return waiting;
  }
  return {
    uid: api.getOwnId(),
    credentials: { cookie: context.cookie.serializeSync().cookies, imei: context.imei, userAgent: context.userAgent },
    friends: async () => (await api.getAllFriends()).map(f => ({ uid: String(f.userId), name: f.displayName || f.zaloName || 'Khách hàng' })),
    resolve: async phone => {
      const normalize = value => String(value ?? '').replace(/\D/g,'').replace(/^84/,'0');
      const friends = await api.getAllFriends();
      const exact = friends.find(f => normalize(f.phoneNumber) === normalize(phone));
      if (exact) return { uid:String(exact.userId),name:exact.displayName || exact.zaloName,is_friend:true };
      const found = await api.findUser(phone);
      if (!found?.uid) return { status:'not_found' };
      return {uid:String(found.uid),name:found.display_name || found.zalo_name,
        is_friend:friends.some(f => String(f.userId) === String(found.uid))};
    },
    send: async (uid, message, attachment) => {
      // Zalo's personal cloud uses send2me_id, which can differ from the account UID.
      const recipient = String(uid) === String(api.getOwnId()) ? context.loginInfo?.send2me_id : uid;
      if (!recipient) {
        const error = new Error('Self recipient is not available');
        error.name = 'ZaloValidationError';
        throw error;
      }
      const source = attachment == null ? null : pdfAttachmentSource(attachment);
      if (source) await ensureUploadReady();
      const result = await api.sendMessage(source ? { msg: message, attachments: [source] } : message,
        String(recipient), ThreadType.User);
      const id = source ? result.attachment?.[0]?.msgId : result.message?.msgId;
      if (source && !id) throw new Error('Provider did not confirm PDF delivery');
      return { id };
    },
    close: () => api.listener.stop(),
  };
}
export const adapter = {
  restore: async credentials => wrapZaloApi(await makeZalo().login(credentials)),
  connect: async onEvent => wrapZaloApi(await makeZalo().loginQR({}, event => {
    const common = { abort: event.actions?.abort };
    if (event.type === LoginQRCallbackEventType.QRCodeGenerated) {
      onEvent({ ...common, status: 'waiting', qr: `data:image/png;base64,${event.data.image}` });
    } else if (event.type === LoginQRCallbackEventType.QRCodeScanned) onEvent({ ...common, status: 'scanned' });
    else if (event.type === LoginQRCallbackEventType.QRCodeExpired || event.type === LoginQRCallbackEventType.QRCodeDeclined) {
      onEvent({ ...common, status: 'expired' }); event.actions?.abort?.();
    }
  })),
};
