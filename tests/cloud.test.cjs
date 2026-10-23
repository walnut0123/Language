const { test } = require('node:test');
const assert = require('node:assert/strict');
const L = require('../learning.js'), C = require('../cloud-state.js');
const data = { books: [{ id: 'check', units: [{ id: 'day-01' }] }], words: ['a', 'b'].map((id, i) => ({ id, book: 'check', unit: 'day-01', order: i + 1 })) };
const copy = x => JSON.parse(JSON.stringify(x));
function action(e, method, ...args) {
  e.current(); const before = copy(e.state); e[method](...args); e.current();
  return C.command(method, args, before, e.state, 'operation');
}
test('concurrent judgments preserve both devices counters on the same word', () => {
  const pc = L.create(data), phone = L.create(data);
  const a = action(pc, 'judge', 'known'), b = action(phone, 'judge', 'review');
  const result = C.replay(C.replay(L.fresh(), [a], data), [b], data);
  assert.equal(result.records.a.knownCount, 1); assert.equal(result.records.a.reviewCount, 1);
  assert.equal(result.history.length, 2); assert.equal(result.records.a.status, 'review');
  assert.equal(result.round.index, 1);
});
test('undo restores actual remote prior record instead of stale local record', () => {
  const pc = L.create(data), phone = L.create(data);
  const a = action(pc, 'judge', 'known'), b = action(phone, 'judge', 'review');
  const u = action(phone, 'undo');
  const result = C.replay(C.replay(L.fresh(), [a], data), [b, u], data);
  assert.equal(result.records.a.knownCount, 1); assert.equal(result.records.a.reviewCount, 0);
  assert.equal(result.records.a.status, 'known');
});
test('stale undo fails without changing input state', () => {
  const pc = L.create(data), phone = L.create(data);
  action(pc, 'judge', 'known'); const undo = action(pc, 'undo');
  action(phone, 'judge', 'review'); const initial = copy(phone.state);
  assert.throws(() => C.replay(initial, [undo], data), /취소/);
  assert.deepEqual(initial, copy(phone.state));
});
test('concurrent restore no-op does not rename another event', () => {
  const pc = L.create(data); action(pc, 'judge', 'known');
  const cmd = action(pc, 'restore', 'a');
  const remote = copy(pc.state), id = remote.history.at(-1).id;
  const result = C.replay(remote, [cmd], data);
  assert.equal(result.history.at(-1).id, id); assert.equal(result.records.a.restoreCount, 1);
});
test('scope reset preserves other-device counters and increments resets', () => {
  const pc = L.create(data), phone = L.create(data);
  const cmd = action(pc, 'reset', false); action(phone, 'judge', 'known');
  const result = C.replay(phone.state, [cmd], data);
  assert.equal(result.records.a.knownCount, 1); assert.equal(result.records.a.status, 'review');
  assert.equal(result.unitResets['check/day-01'], 1);
});
