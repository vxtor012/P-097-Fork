const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');

function load(file, fetch, react) {
  const timers = new Map();
  const context = {
    exports: {}, process, AbortController, fetch,
    setTimeout: (fn, ms) => { timers.set(ms, fn); return ms; },
    clearTimeout: (id) => timers.delete(id),
    require: (name) => name === 'react' ? react : require(name),
  };
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, context);
  return { api: context.exports, timers };
}

async function checkHook(mode) {
  const state = [[], false];
  let index = 0;
  let calls = 0;
  let resolveFetch;
  const react = {
    useState: () => {
      const slot = index++;
      return [state[slot], (value) => { state[slot] = typeof value === 'function' ? value(state[slot]) : value; }];
    },
    useCallback: (fn) => fn,
    useRef: (value) => ({ current: value }),
  };
  const { api, timers } = load('hooks/use-chat.ts', (_, options) => {
    calls++;
    return new Promise((resolve, reject) => {
      resolveFetch = resolve;
      options.signal.addEventListener('abort', () => reject(new Error('aborted')));
    });
  }, react);
  const chat = api.useChat();
  const pending = chat.sendMessage('Tư vấn VF5');
  assert.equal(state[0].length, 1, 'No empty assistant bubble while waiting');
  assert.equal(state[1], true);
  await chat.sendMessage('Duplicate');
  assert.equal(calls, 1, 'Block duplicate sends during pending request');
  if (mode === 'timeout') timers.get(65000)();
  else resolveFetch({ ok: mode !== 'error', json: async () => mode === 'error'
    ? { error: 'AI chưa sẵn sàng' } : { response: 'Thông tin VF5' } });
  await pending;
  assert.equal(state[1], false, 'Unlock input after completion');
  assert.equal(timers.size, 0, 'Clear timeout after completion');
  assert.equal(state[0].length, 2);
  assert.match(state[0][1].content, mode === 'timeout' ? /quá lâu/ : mode === 'error' ? /chưa sẵn sàng/ : /Thông tin VF5/);
  const retry = chat.sendMessage('Thử lại');
  assert.equal(calls, 2, 'Allow retry after completion');
  resolveFetch({ ok: true, json: async () => ({ response: '' }) });
  await retry;
  assert.match(state[0][3].content, /chưa nhận được/);
}

async function checkProxy(mode) {
  let captured;
  const { api, timers } = load('app/api/chat/route.ts', async (_, options) => {
    captured = JSON.parse(options.body);
    if (mode === 'network') throw new Error('offline');
    if (mode === 'timeout') return new Promise((_, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('aborted')));
    });
    return { ok: mode !== 'error', status: mode === 'error' ? 503 : 200,
      json: async () => mode === 'error' ? { detail: 'AI chưa sẵn sàng' } : { response: 'Thông tin VF5' } };
  });
  const body = { message: 'Tư vấn', vehicle_context: { model: 'VF5' } };
  const pending = api.POST({ json: async () => body });
  await new Promise(setImmediate);
  if (mode === 'timeout') timers.get(60000)();
  const result = await pending;
  assert.deepEqual(captured, body, 'Preserve vehicle context');
  assert.equal(result.status, { success: 200, error: 503, network: 502, timeout: 504 }[mode]);
  const payload = await result.json();
  assert.match(payload.response || payload.error, mode === 'success' ? /VF5/ : mode === 'error' ? /chưa sẵn sàng/ : mode === 'timeout' ? /quá lâu/ : /kết nối/);
  assert.equal(timers.size, 0);
}

(async () => {
  for (const mode of ['success', 'error', 'timeout']) await checkHook(mode);
  for (const mode of ['success', 'error', 'network', 'timeout']) await checkProxy(mode);
  console.log('7 chat scenarios passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
