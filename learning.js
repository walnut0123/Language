/* Pure learning state; browser UI and Node tests share this implementation. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Learning = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const modes = ['chapter', 'ordered', 'random'];
  const withOrder = selection => ({ ...selection, questionOrder: selection.mode === 'chapter' ? (selection.questionOrder || 'ordered') : selection.mode === 'random' ? 'random' : 'ordered' });
  const counters = ['knownCount', 'reviewCount', 'restoreCount', 'resetCount'];
  const stamp = () => new Date().toISOString();
  const clone = value => JSON.parse(JSON.stringify(value));
  const dictionary = () => Object.create(null);
  const validTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
  const count = value => Number.isSafeInteger(value) && value >= 0;
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const assert = (condition, message = '백업의 기록 형식이 올바르지 않습니다.') => { if (!condition) throw Error(message); };
  const emptyRecord = () => ({ status: 'review', knownCount: 0, reviewCount: 0, restoreCount: 0, resetCount: 0, updatedAt: stamp() });
  const fresh = () => ({ version: 2, records: dictionary(), selection: { book: 'check', mode: 'chapter', unit: 'day-01', questionOrder: 'ordered' }, round: null, undo: null, history: [], unitResets: dictionary() });

  function parse(value, data) {
    assert(object(value) && [1, 2].includes(value.version), '지원하지 않는 백업 버전입니다.');
    assert(object(value.records));
    const next = fresh(), legacy = value.version === 1;
    function record(r) {
      assert(object(r) && ['known', 'review'].includes(r.status) && validTime(r.updatedAt));
      const result = { ...emptyRecord(), status: r.status, updatedAt: r.updatedAt };
      if (legacy) { result[r.status === 'known' ? 'knownCount' : 'reviewCount'] = 1; result.legacy = true; }
      else {
        for (const key of counters) { assert(count(r[key])); result[key] = r[key]; }
        for (const key of ['firstStudiedAt', 'lastKnownAt', 'lastReviewAt', 'lastResetAt']) {
          if (r[key] !== undefined) { assert(validTime(r[key])); result[key] = r[key]; }
        }
        if (r.legacy === true) result.legacy = true;
      }
      return result;
    }
    for (const [id, r] of Object.entries(value.records)) { assert(id.length > 0 && id.length <= 200); next.records[id] = record(r); }
    function selection(s) {
      return object(s) && data.books.some(b => b.id === s.book &&
        modes.includes(s.mode) && (s.questionOrder === undefined || ['ordered', 'random'].includes(s.questionOrder)) && (s.mode === 'chapter' ? b.units.some(u => u.id === s.unit) : s.unit === 'all'));
    }
    let selected = value.selection;
    if (legacy && selected) selected = { ...selected, mode: selected.unit === 'all' ? 'ordered' : 'chapter' };
    if (selection(selected)) next.selection = withOrder(clone(selected));
    const byId = new Map(data.words.map(w => [w.id, w]));
    function round(r, s) {
      return object(r) && Array.isArray(r.ids) && r.ids.every(id => typeof id === 'string' && id.length <= 200 &&
        (!byId.has(id) || (byId.get(id).book === s.book && (s.mode !== 'chapter' || byId.get(id).unit === s.unit)))) &&
        new Set(r.ids).size === r.ids.length && count(r.index) && r.index <= r.ids.length;
    }
    if (round(value.round, next.selection) && (!legacy || value.round.ids.some(id => byId.has(id)))) next.round = clone(value.round);
    // Restore previously omitted catalog entries into the saved round without
    // resetting the answered prefix, judgments, counters, or existing order.
    if (next.round) {
      const included = new Set(next.round.ids);
      const missing = data.words.filter(w => w.book === next.selection.book && (next.selection.mode !== 'chapter' || w.unit === next.selection.unit) &&
        !included.has(w.id) && !next.records[w.id]);
      missing.sort((a,b)=>a.unit.localeCompare(b.unit) || a.order-b.order);
      next.round.ids.push(...missing.map(w=>w.id));
    }
    if (!legacy) {
      assert(Array.isArray(value.history) && object(value.unitResets));
      const eventIds = new Set();
      for (const event of value.history) {
        assert(object(event) && typeof event.id === 'string' && !eventIds.has(event.id) && validTime(event.at) && ['known', 'review', 'restore', 'reset'].includes(event.type));
        if (event.type === 'reset') {
          assert(['scope', 'all'].includes(event.scope) && Array.isArray(event.units) && event.units.every(u => typeof u === 'string') && count(event.wordCount) && count(event.knownBefore));
        } else assert(typeof event.wordId === 'string' && typeof event.book === 'string' && typeof event.unit === 'string');
        if (event.undoneAt !== undefined) assert(validTime(event.undoneAt));
        next.history.push(clone(event)); eventIds.add(event.id);
      }
      for (const [key, resetCount] of Object.entries(value.unitResets)) { assert(count(resetCount)); next.unitResets[key] = resetCount; }
      const u = value.undo;
      if (u !== null && u !== undefined) {
        assert(object(u) && typeof u.id === 'string' && selection(u.selection) && round(u.round, u.selection) && u.round.ids[u.round.index] === u.id);
        assert(next.history.some(e => e.id === u.eventId && e.wordId === u.id && ['known', 'review'].includes(e.type) && !e.undoneAt));
        next.undo = { id: u.id, previous: u.previous === null ? null : record(u.previous), eventId: u.eventId, selection: withOrder(clone(u.selection)), round: clone(u.round) };
      }
    } else next.migratedFromV1 = true;
    if (value.migratedFromV1) next.migratedFromV1 = true;
    return next;
  }

  function create(data, initial = fresh(), random = Math.random) {
    let state = initial;
    const byId = new Map(data.words.map(w => [w.id, w]));
    const ordered = data.books.flatMap(book => book.units.flatMap(unit => data.words.filter(w => w.book === book.id && w.unit === unit.id).sort((a, b) => (a.order || 0) - (b.order || 0))));
    const known = id => state.records[id]?.status === 'known';
    const scope = () => ordered.filter(w => w.book === state.selection.book && (state.selection.mode !== 'chapter' || w.unit === state.selection.unit));
    function start() {
      const ids = scope().filter(w => !known(w.id)).map(w => w.id);
      if (state.selection.mode === 'random' || (state.selection.mode === 'chapter' && state.selection.questionOrder === 'random')) for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
      state.round = { ids, index: 0 };
    }
    function current() {
      if (!state.round) start();
      const allowed = new Set(scope().map(w => w.id));
      while (state.round.index < state.round.ids.length) {
        const id = state.round.ids[state.round.index];
        if (allowed.has(id) && !known(id)) return byId.get(id);
        state.round.index++;
      }
      return null;
    }
    function event(type, extra) {
      const at = stamp();
      const entry = { id: `${at}-${state.history.length}-${Math.random().toString(36).slice(2)}`, at, type, ...extra };
      state.history.push(entry); return entry;
    }
    function judge(status) {
      const word = current(); if (!word) return false;
      const previous = state.records[word.id] ? clone(state.records[word.id]) : null;
      const e = event(status, { wordId: word.id, book: word.book, unit: word.unit });
      state.undo = { id: word.id, previous, eventId: e.id, selection: clone(state.selection), round: clone(state.round) };
      const r = state.records[word.id] ||= emptyRecord();
      r.status = status; r[status === 'known' ? 'knownCount' : 'reviewCount']++;
      r.firstStudiedAt ||= e.at; r[status === 'known' ? 'lastKnownAt' : 'lastReviewAt'] = e.at; r.updatedAt = e.at;
      state.round.index++; return true;
    }
    function undo() {
      const u = state.undo; if (!u) return false;
      if (u.previous) state.records[u.id] = u.previous; else delete state.records[u.id];
      const e = state.history.find(e => e.id === u.eventId); if (e) e.undoneAt = stamp();
      state.selection = u.selection; state.round = u.round; state.undo = null; return true;
    }
    function restore(id) {
      const word = byId.get(id); if (!word || !known(id)) return false;
      const e = event('restore', { wordId: id, book: word.book, unit: word.unit });
      const r = state.records[id]; r.status = 'review'; r.restoreCount++; r.updatedAt = e.at; state.undo = null; return true;
    }
    function reset(all = false) {
      const targets = all ? ordered : scope(); if (!targets.length) return false;
      const units = [...new Set(targets.map(w => `${w.book}/${w.unit}`))];
      const e = event('reset', { scope: all ? 'all' : 'scope', units, wordCount: targets.length, knownBefore: targets.filter(w => known(w.id)).length });
      for (const w of targets) { const r = state.records[w.id] ||= emptyRecord(); r.status = 'review'; r.resetCount++; r.lastResetAt = e.at; r.updatedAt = e.at; }
      for (const key of units) state.unitResets[key] = (state.unitResets[key] || 0) + 1;
      state.undo = null; start(); return true;
    }
    return { get state() { return state; }, known, scope, current, start, judge, undo, restore, reset,
      select(selection) { state.selection = withOrder(clone(selection)); start(); },
      replace(value) { state = parse(value, data); current(); },
      totals(list = scope()) { return list.reduce((r, w) => { const record = state.records[w.id]; r.total++; if (known(w.id)) r.known++; r.knownCount += record?.knownCount || 0; r.reviewCount += record?.reviewCount || 0; return r; }, { total: 0, known: 0, knownCount: 0, reviewCount: 0 }); }
    };
  }
  return { create, parse, fresh };
});
