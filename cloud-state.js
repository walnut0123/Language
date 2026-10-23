/* Pure command replay shared by the browser and tests. */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./learning.js') : root.Learning);
  if (typeof module === 'object' && module.exports) module.exports = api; else root.CloudState = api;
})(typeof window !== 'undefined' ? window : globalThis, function (Learning) {
  const copy = value => JSON.parse(JSON.stringify(value));
  function command(method, args, before, after, id) {
    return { id, method, args: copy(args), selection: copy(before.selection), round: copy(before.round),
      undoEvent: before.undo?.eventId || null, event: copy(after.history.at(-1) || null),
      result: { selection: copy(after.selection), round: copy(after.round) } };
  }
  function replay(state, commands, data) {
    const engine = Learning.create(data, Learning.parse(state, data));
    for (const c of commands) {
      if (c.method === 'replace') throw Error('백업 복원은 최신 클라우드 기록을 확인한 뒤 다시 시도하세요.');
      if (c.method === 'select' || c.method === 'start') {
        engine.state.selection = copy(c.result.selection); engine.state.round = copy(c.result.round); continue;
      }
      if (c.method === 'undo') {
        if (engine.state.undo?.eventId !== c.undoEvent) throw Error('다른 기기의 학습 이후에는 이전 판단을 취소할 수 없습니다.');
        engine.undo(); continue;
      }
      const historyLength = engine.state.history.length;
      engine.state.selection = copy(c.selection); engine.state.round = copy(c.round);
      if (c.method === 'judge') {
        // Replay the exact displayed word even if another device already marked it known.
        const id = c.round?.ids[c.round.index], record = engine.state.records[id];
        const previous = record ? copy(record) : null;
        if (record) record.status = 'review';
        if (!engine.judge(...c.args)) throw Error('학습 단어를 확인할 수 없습니다.');
        // Preserve the actual remote prior state for undo, including concurrent counters.
        engine.state.undo.previous = previous;
      } else if (c.method === 'restore') engine.restore(...c.args);
      else if (c.method === 'reset') engine.reset(...c.args);
      else throw Error('지원하지 않는 학습 동작입니다.');
      const event = engine.state.history.at(-1);
      if (engine.state.history.length > historyLength && event && c.event) {
        const oldId = event.id; event.id = c.event.id;
        if (engine.state.undo?.eventId === oldId) engine.state.undo.eventId = event.id;
      }
      engine.state.selection = copy(c.result.selection); engine.state.round = copy(c.result.round);
      state = copy(engine.state);
    }
    return Learning.parse(engine.state, data);
  }
  return { command, replay };
});
