const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const Learning = require('../learning.js'), CloudState = require('../cloud-state.js');
const data = { books: [{ id: 'check', units: [{ id: 'day-01' }] }], words: [{ id: 'a', book: 'check', unit: 'day-01', order: 1 }] };
const copy = x => JSON.parse(JSON.stringify(x));
const flush = async () => { for (let i = 0; i < 15; i++) await new Promise(r => setImmediate(r)); };
async function harness(existing = new Map(), storage = new Map()) {
  const nodes = {}, engine = Learning.create(data), timers = [];
  let authChanged, uid = 0, fail = false;
  const node = id => nodes[id] ||= { textContent: '', hidden: false, addEventListener(name, callback) { this[name] = callback; } };
  const app = { data, snapshot: () => copy(engine.state), apply(state) { engine.replace(state); }, persist() {} };
  const snapshot = value => ({ exists: () => value !== undefined, data: () => value === undefined ? undefined : copy(value), metadata: {} });
  const sdk = {
    app: { initializeApp: () => ({}) },
    auth: { getAuth: () => ({}), GoogleAuthProvider: class { setCustomParameters() {} },
      onAuthStateChanged(_, callback) { authChanged = callback; }, signOut: async () => authChanged(null) },
    db: { getFirestore: () => ({}), doc: (_, ...parts) => parts.join('/'), serverTimestamp: () => 'server-time',
      onSnapshot: () => () => {},
      runTransaction: async (_, callback) => {
        if (fail) throw Error('offline');
        const writes = [];
        const result = await callback({ get: async path => snapshot(existing.get(path)), set: (path, value) => writes.push([path, copy(value)]) });
        for (const [path, value] of writes) existing.set(path, value);
        return result;
      }
    }
  };
  const context = vm.createContext({ window: { VocabularyApp: app, FIREBASE_CONFIG: { apiKey: 'test', projectId: 'test', authDomain: 'test', appId: 'test' }, CloudState, addEventListener() {} },
    Learning, document: { getElementById: node, querySelector: () => ({ children: [] }) }, navigator: { onLine: true },
    localStorage: { get length() { return storage.size; }, key: i => [...storage.keys()][i], getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
    crypto: { randomUUID: () => `uuid-${++uid}` }, setTimeout: callback => { timers.push(callback); return timers.length; }, clearTimeout() {}, confirm: () => true, sdk });
  let source = fs.readFileSync(require.resolve('../cloud.js'), 'utf8');
  for (const [file, name] of [['app', 'app'], ['auth', 'auth'], ['firestore', 'db']]) {
    source = source.replace(`import('https://www.gstatic.com/firebasejs/12.19.0/firebase-${file}.js')`, `Promise.resolve(sdk.${name})`);
  }
  vm.runInContext(source, context); await flush();
  return { nodes, storage, existing, engine, context,
    async login(uid) { await authChanged({ uid, email: `${uid}@example.test` }); await flush(); },
    async sync() { await nodes['cloud-sync'].click(); await flush(); },
    fail(value) { fail = value; },
    judge() { engine.current(); const before = copy(engine.state); engine.judge('known'); engine.current(); context.window.CloudSession.record('judge', ['known'], before, engine.state); }
  };
}
test('transport writes chunks and receipts; retry cannot double count', async () => {
  const h = await harness(); await h.login('alice'); h.judge();
  const pending = [...h.storage.entries()].find(([key]) => key.includes('-operation-'));
  await h.sync();
  assert.equal(h.engine.state.records.a.knownCount, 1);
  assert.ok(h.existing.has('users/alice/chunks/0'));
  assert.ok(h.existing.has('users/alice/operations/uuid-1'));
  h.storage.set(...pending); await h.sync();
  assert.equal(h.engine.state.records.a.knownCount, 1);
  assert.match(h.nodes['cloud-status'].textContent, /저장 완료/);
});
test('offline pending survives restart, and another account never inherits it', async () => {
  const h = await harness(); await h.login('alice'); h.fail(true); h.judge(); await h.sync();
  assert.match(h.nodes['cloud-status'].textContent, /미완료/);
  const next = await harness(h.existing, h.storage); await next.login('bob');
  assert.equal(next.engine.state.records.a, undefined);
  await next.login('alice');
  assert.equal(next.engine.state.records.a.knownCount, 1);
  assert.equal([...h.storage.keys()].filter(key => key.includes('-operation-')).length, 0);
});
