(() => {
  'use strict';
  const KEY = 'haru-vocabulary-v1'; // Keep the old key so existing records can migrate.
  const data = window.VOCABULARY, $ = id => document.getElementById(id);
  const byId = new Map(data.words.map(w => [w.id, w]));
  let initial = Learning.fresh(), loadFailed = false;
  try { const raw = localStorage.getItem(KEY); if (raw) initial = Learning.parse(JSON.parse(raw), data); }
  catch { loadFailed = true; $('storage-error').textContent = '저장된 기록을 읽지 못했습니다. 기존 저장값은 아직 덮어쓰지 않았습니다. 백업을 불러오거나 새 학습을 시작하세요. 이후 조작은 새 기록으로 저장됩니다.'; $('storage-error').hidden = false; }
  const engine = Learning.create(data, initial);
  for (const method of ['judge', 'undo', 'restore', 'reset', 'select', 'start', 'replace']) {
    const original = engine[method];
    engine[method] = (...args) => {
      const before = JSON.parse(JSON.stringify(engine.state));
      const result = original(...args);
      if (result !== false) window.CloudSession?.record(method, args, before, engine.state);
      return result;
    };
  }
  let view = 'study', meaning = false, reading = false, pending = null, pendingReset = null;
  let kanjiOpen = false, kanjiAnchors = [], kanjiCards = [], japaneseNode = null;
  const state = () => engine.state;
  const notice = text => { $('notice').textContent = text; };
  const hideAnswers = () => { meaning = false; reading = false; };
  const bookName = id => data.books.find(b => b.id === id)?.name || id;
  const unitName = (book, unit) => data.books.find(b => b.id === book)?.units.find(u => u.id === unit)?.name || unit;
  const formatDate = at => new Date(at).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }
  function save() {
    try { localStorage.setItem(window.CloudSession?.key || KEY, JSON.stringify(state())); $('storage-error').hidden = true; return true; }
    catch { $('storage-error').textContent = '브라우저 저장에 실패했습니다. 새로고침하거나 닫기 전에 백업을 내보내세요. 현재 화면에서는 학습을 계속할 수 있습니다.'; $('storage-error').hidden = false; return false; }
  }
  function selectors() {
    $('book').value = state().selection.book; $('mode').value = state().selection.mode;
    fillUnits(view === 'study' ? state().selection.unit : 'all');
  }
  function fillUnits(selected = 'day-01') {
    const book = data.books.find(b => b.id === $('book').value);
    $('unit').replaceChildren();
    const all = view !== 'study' || $('mode').value !== 'chapter';
    const units = all ? [{ id: 'all', name: '전체 단원 · DAY 01–30' }, ...(view !== 'study' ? book.units : [])] : book.units;
    for (const u of units) { const option = el('option', '', u.name); option.value = u.id; $('unit').append(option); }
    $('unit').value = units.some(u => u.id === selected) ? selected : units[0].id;
    $('unit').disabled = view === 'study' && $('mode').value !== 'chapter';
    $('mode-label').hidden = view !== 'study';
    $('order-label').hidden = view !== 'study';
    $('question-order').value = state().selection.questionOrder;
    $('question-order').disabled = $('mode').value !== 'chapter';
    $('unit-label').firstChild.textContent = view === 'study' ? '03 학습 단원' : '02 표시 단원';
  }
  function selectedWords() {
    return view === 'study' ? engine.scope() : data.words.filter(w => w.book === $('book').value && ($('unit').value === 'all' || w.unit === $('unit').value));
  }
  function renderStats() {
    const list = selectedWords(), t = engine.totals(list);
    $('total').textContent = t.total.toLocaleString(); $('known').textContent = t.known.toLocaleString(); $('remaining').textContent = (t.total - t.known).toLocaleString();
    $('compact-scope').textContent = `${bookName($('book').value)} · ${$('unit').value === 'all' ? '전체' : unitName($('book').value, $('unit').value)} · 남은 ${t.total - t.known}`;
    $('known-count').textContent = t.knownCount.toLocaleString(); $('review-count').textContent = t.reviewCount.toLocaleString();
    $('source-label').textContent = $('book').value === 'check' ? '유하다요 N3 · 체크북 2,376개' : '메인북 · DAY 01–02 · 167개';
    $('scope-description').textContent = view !== 'study' ? '단원과 상태로 살펴보고, 단어별 누적 학습 횟수를 확인하세요.' : {
      chapter: `선택한 DAY의 남은 단어를 ${state().selection.questionOrder === 'random' ? '랜덤으로' : '순서대로'} 학습합니다.`,
      ordered: 'DAY 구분 없이 01부터 30까지 이어서 학습합니다.',
      random: '선택한 단어장 전체를 회독마다 무작위로 섞습니다.'
    }[state().selection.mode];
  }
  function renderStudy() {
    const word = engine.current(), r = state().round, t = engine.totals();
    closeKanji();
    kanjiAnchors = [];
    $('meaning').setAttribute('aria-pressed', String(meaning));
    $('reading').setAttribute('aria-pressed', String(reading));
    $('undo').disabled = !state().undo;
    $('round-label').textContent = `이번 회독 · ${r.index.toLocaleString()} / ${r.ids.length.toLocaleString()}`;
    $('progress').max = r.ids.length || 1; $('progress').value = r.index;
    $('actions').hidden = !word; $('card').replaceChildren();
    $('reset-scope').disabled = !t.total; $('reset-all').disabled = !data.words.length;
    if (word) {
      const jp = el('div', `japanese${word.japanese.length > 8 ? ' long' : ''}`); jp.lang = 'ja';
      japaneseNode = jp;
      for (const part of KanjiUI.segments(word, window.KANJI_READINGS)) {
        if (!part.kanji) { jp.append(el('span', 'okurigana', part.text)); continue; }
        const ruby = el('ruby'), base = el('span', 'ruby-base');
        for (const character of part.text) {
          const characterNode = el('span', 'kanji-character', character);
          base.append(characterNode);
          if (/\p{Script=Han}/u.test(character) && window.KANJI_DETAILS[character]) kanjiAnchors.push({ character, node: characterNode });
        }
        const rt = el('rt', reading ? '' : 'ruby-hidden', part.reading);
        rt.setAttribute('aria-hidden', String(!reading));
        ruby.append(base, rt); jp.append(ruby);
      }
      const answer = el('p', `answer${meaning ? '' : ' concealed'}`, meaning ? `${word.partOfSpeech ? `[${word.partOfSpeech}] ` : ''}${word.meaning}` : '이 단어의 뜻은 무엇일까요?');
      const record = state().records[word.id];
      $('card').append(el('span', 'unit-tag', `${bookName(word.book)} / ${unitName(word.book, word.unit)} / ${String(word.order).padStart(2, '0')}${word.starred ? ' · ★ 기출' : ''}`), jp, answer,
        el('p', 'word-history', `누적 알고 있음 ${record?.knownCount || 0} · 다시 학습 ${record?.reviewCount || 0} · 리셋 ${record?.resetCount || 0}`));
      $('meaning').disabled = false; $('reading').disabled = false;
      if (reading) openKanji();
    } else {
      $('card').append(el('span', 'unit-tag', t.total ? '오늘의 작은 성취' : '단어 준비 중'), el('h2', 'end-title', !t.total ? '아직 단어가 없어요' : t.total > t.known ? '한 회독을 마쳤어요' : '모두 기억했어요!'),
        el('p', 'end-copy', !t.total ? '메인북도 DAY 01~30으로 준비했습니다. 실제 단어를 받으면 추가할게요.' : t.total > t.known ? `남은 ${(t.total - t.known).toLocaleString()}개 단어를 다시 만나볼까요?` : '다른 단원을 고르거나, 기록을 남긴 채 다시 시작해 보세요.'));
      if (t.total > t.known) { const button = el('button', 'primary', '남은 단어 다시 학습 ↵'); button.id = 'restart'; button.addEventListener('click', restart); $('card').append(button); }
    }
  }
  function renderList() {
    const query = $('search').value.trim().toLocaleLowerCase(), status = $('status-filter').value;
    const list = selectedWords().filter(w => (!query || `${w.japanese} ${w.reading} ${w.meaning}`.toLocaleLowerCase().includes(query)) &&
      (status === 'all' || (status === 'known' ? engine.known(w.id) : !engine.known(w.id))));
    $('word-list').replaceChildren(); $('list-count').textContent = `${list.length.toLocaleString()}개 단어`; $('list-empty').hidden = !!list.length;
    const book = data.books.find(b => b.id === $('book').value);
    const fragment = document.createDocumentFragment();
    for (const unit of book.units) {
      const words = list.filter(w => w.unit === unit.id).sort((a, b) => a.order - b.order); if (!words.length) continue;
      const section = el('section', 'unit-section'), title = el('h2', '', unit.name); title.append(el('small', '', `${words.length}개 단어`));
      const wrap = el('div', 'word-table'), table = el('table'), head = el('thead'), hr = el('tr');
      for (const label of ['번호', '일본어', '읽는 법', '한국어 뜻', '누적 판단', '학습 상태']) hr.append(el('th', '', label));
      head.append(hr); const body = el('tbody');
      for (const word of words) {
        const tr = el('tr'), jp = el('td', 'jp', word.japanese); jp.lang = 'ja';
        if (word.starred) jp.append(el('span', 'star', '★'));
        const kana = el('td', 'kana', word.reading); kana.lang = 'ja';
        const def = el('td'); def.append(el('span', 'pos', word.partOfSpeech), document.createTextNode(word.meaning));
        const record = state().records[word.id], stats = el('td', 'word-counts', `알고 있음 ${record?.knownCount || 0} / 다시 학습 ${record?.reviewCount || 0}`);
        const status = el('td', 'status');
        if (engine.known(word.id)) {
          const button = el('button', 'row-action', '암기 완료 ↶ 되돌리기'); button.setAttribute('aria-label', `${word.japanese} 다시 학습 대상으로 되돌리기`);
          button.addEventListener('click', () => { engine.restore(word.id); save(); render(); notice('다시 학습 대상으로 되돌렸습니다. 다음 회독부터 출제됩니다. 누적 판단은 유지됩니다.'); }); status.append(button);
        } else status.textContent = '학습 대상';
        tr.append(el('td', 'word-counts', String(word.order).padStart(2, '0')), jp, kana, def, stats, status); body.append(tr);
      }
      table.append(head, body); wrap.append(table); section.append(title, wrap); fragment.append(section);
    }
    $('word-list').append(fragment);
  }
  function renderHistory() {
    const list = selectedWords(), book = data.books.find(b => b.id === $('book').value), selected = $('unit').value;
    $('legacy-note').hidden = !state().migratedFromV1;
    $('unit-history').replaceChildren();
    for (const unit of book.units.filter(u => selected === 'all' || u.id === selected)) {
      const t = engine.totals(list.filter(w => w.unit === unit.id)), row = el('tr');
      for (const v of [unit.name, `${t.known} / ${t.total}`, t.knownCount, t.reviewCount, state().unitResets[`${book.id}/${unit.id}`] || 0]) row.append(el('td', '', String(v)));
      $('unit-history').append(row);
    }
    const keys = new Set(list.map(w => `${w.book}/${w.unit}`));
    const events = state().history.filter(e => e.type === 'reset' ? e.units.some(key => keys.has(key)) : e.book === book.id && (selected === 'all' || e.unit === selected)).slice(-100).reverse();
    $('event-history').replaceChildren();
    if (!events.length) $('event-history').append(el('li', 'hint', '아직 학습 이력이 없습니다.'));
    for (const event of events) {
      const li = el('li'), word = byId.get(event.wordId);
      const text = event.type === 'reset' ? `${event.scope === 'all' ? '전체' : '선택 범위'} 리셋 · ${event.wordCount}개 대상 · 암기 상태 ${event.knownBefore}개 해제` :
        `${unitName(event.book, event.unit)} · ${word?.japanese || event.wordId} · ${{ known: '알고 있어요', review: '다시 학습', restore: '완료 상태 되돌리기' }[event.type]}`;
      li.append(el('span', event.undoneAt ? 'undone' : '', text + (event.undoneAt ? ' (판단 취소됨)' : '')), el('time', '', formatDate(event.at)));
      $('event-history').append(li);
    }
  }
  function render() { renderStats(); if (view === 'study') renderStudy(); else if (view === 'list') renderList(); else renderHistory(); }
  function switchView(next) {
    closeKanji();
    closeSettings();
    $('study-tools').open = false;
    view = next; document.body.dataset.view = view;
    for (const name of ['study', 'list', 'history']) {
      $(`view-${name}`).hidden = name !== view; $(`tab-${name}`).classList.toggle('active', name === view);
      if (name === view) $(`tab-${name}`).setAttribute('aria-current', 'page'); else $(`tab-${name}`).removeAttribute('aria-current');
    }
    $('page-title').textContent = { study: '오늘도, 단어 하나.', list: '차곡차곡, 나의 단어장.', history: '다시 보아도, 기록은 그대로.' }[view];
    selectors(); render(); notice(''); window.scrollTo({ top: 0 });
  }
  function selectScope() {
    if (view === 'study') { engine.select({ book: $('book').value, mode: $('mode').value, unit: $('unit').value, questionOrder: $('question-order').value }); $('question-order').value = state().selection.questionOrder; hideAnswers(); save(); }
    render(); notice('');
  }
  $('book').addEventListener('change', () => { fillUnits(view === 'study' ? 'day-01' : 'all'); selectScope(); });
  function closeSettings() { settingsExpanded = false; $('settings-panel').classList.toggle('expanded', false); $('settings-toggle').setAttribute('aria-expanded', 'false'); }
  let settingsExpanded = false;
  $('settings-toggle').addEventListener('click', () => {
    settingsExpanded = !settingsExpanded;
    $('settings-panel').classList.toggle('expanded', settingsExpanded); $('settings-toggle').setAttribute('aria-expanded', String(settingsExpanded));
    $('study-tools').open = false;
  });
  $('mode').addEventListener('change', () => { fillUnits(state().selection.unit); selectScope(); });
  $('unit').addEventListener('change', selectScope);
  $('question-order').addEventListener('change', selectScope);
  for (const name of ['study', 'list', 'history']) $(`tab-${name}`).addEventListener('click', () => switchView(name));
  $('meaning').addEventListener('click', () => { meaning = !meaning; renderStudy(); });
  $('reading').addEventListener('click', () => { reading = !reading; renderStudy(); });
  function hideReading() { reading = false; renderStudy(); $('reading').focus(); }
  function closeKanji() {
    const layer = $('kanji-layer');
    if (kanjiOpen) layer.hidePopover?.();
    layer.hidden = true; layer.replaceChildren();
    kanjiOpen = false; kanjiCards = [];
    document.body.classList.toggle('kanji-side-open', false);
    $('reading').setAttribute('aria-expanded', 'false');
    for (const anchor of kanjiAnchors) anchor.node.classList.toggle('explained', false);
  }
  function positionKanji() {
    if (!kanjiOpen) return;
    const viewport = window.visualViewport;
    const width = viewport?.width || window.innerWidth, height = viewport?.height || window.innerHeight;
    const offsetX = viewport?.offsetLeft || 0, offsetY = viewport?.offsetTop || 0;
    const rect = node => { const r = node.getBoundingClientRect(); return { left: r.left - offsetX, top: r.top - offsetY, width: r.width, height: r.height }; };
    const word = rect(japaneseNode), anchors = kanjiAnchors.map(a => rect(a.node));
    const boxes = KanjiUI.layout(anchors, word, { width, height });
    const layer = $('kanji-layer'); layer.classList.toggle('kanji-rail', !boxes);
    layer.style.left = `${offsetX}px`; layer.style.top = `${offsetY}px`;
    layer.style.width = `${width}px`; layer.style.height = `${height}px`;
    if (!boxes) {
      // Preserve the side relationship even on unusually narrow/zoomed viewports.
      const railHeight = Math.max(80, Math.min(480, height - 20));
      layer.style.left = `${offsetX + word.left + word.width + 14}px`;
      layer.style.top = `${offsetY + Math.max(10, Math.min(word.top, height - railHeight - 10))}px`;
      layer.style.width = `${Math.max(0, width - word.left - word.width - 24)}px`;
      layer.style.height = `${railHeight}px`;
    }
    kanjiCards.forEach((card, i) => {
      if (!boxes) { card.removeAttribute('style'); return; }
      const b = boxes[i];
      Object.assign(card.style, { left: `${b.left}px`, top: `${b.top}px`, width: `${b.width}px`, height: `${b.height}px` });
    });
  }
  function openKanji() {
    if (!kanjiAnchors.length) return;
    document.body.classList.toggle('kanji-side-open', true);
    const layer = $('kanji-layer'); layer.replaceChildren();
    for (const [index, anchor] of kanjiAnchors.entries()) {
      const note = window.KANJI_DETAILS[anchor.character];
      const card = el('section', 'kanji-float'); card.setAttribute('aria-labelledby', `kanji-title-${index}`);
      const heading = el('div', 'kanji-heading'), title = el('h2', '', anchor.character); title.id = `kanji-title-${index}`; title.lang = 'ja';
      const close = el('button', 'kanji-close', '×'); close.setAttribute('aria-label', '읽기 도움 끄기'); close.addEventListener('click', hideReading);
      heading.append(title, el('span', '', note.label?.replace(/^.\(|\)$/g, '') || note.meaning), close);
      const body = el('div', 'kanji-copy'); body.tabIndex = 0;
      body.append(el('h3', '', '유래·구성'), el('p', '', note.origin), el('h3', '', '글자의 뜻'), el('p', '', note.meaning), el('h3', '', '뜻의 확장·쓰임'), el('p', '', note.usage));
      card.append(heading, body); layer.append(card); kanjiCards.push(card);
      anchor.node.classList.toggle('explained', true);
    }
    layer.hidden = false; layer.showPopover?.(); kanjiOpen = true;
    $('reading').setAttribute('aria-expanded', 'true'); positionKanji();
  }
  window.addEventListener('resize', positionKanji);
  document.addEventListener('scroll', positionKanji, true);
  window.visualViewport?.addEventListener('resize', positionKanji);
  window.visualViewport?.addEventListener('scroll', positionKanji);
  document.fonts?.ready.then(positionKanji);
  function judge(status) { if (!engine.judge(status)) return; hideAnswers(); engine.current(); save(); render(); notice(status === 'known' ? '암기 완료로 기록했습니다.' : '복습 대상으로 남겼습니다. 다음 회독에서 다시 만나요.'); }
  $('again').addEventListener('click', () => judge('review')); $('memorize').addEventListener('click', () => judge('known'));
  $('undo').addEventListener('click', () => { if (!engine.undo()) return; hideAnswers(); selectors(); save(); render(); notice('직전 판단을 취소했습니다. 해당 판단은 누적 횟수에서도 제외됩니다.'); });
  function restart() { engine.start(); hideAnswers(); save(); render(); notice('남은 단어로 새 회독을 시작했습니다.'); }
  function askReset(all) {
    $('study-tools').open = false;
    const targets = all ? data.words : engine.scope(), known = targets.filter(w => engine.known(w.id)).length;
    if (!targets.length) return;
    pendingReset = all;
    $('reset-description').textContent = `${all ? '체크북·메인북 전체' : '현재 선택 범위'} ${targets.length.toLocaleString()}개 단어를 다시 출제합니다. 현재 암기 완료 ${known.toLocaleString()}개를 학습 대상으로 돌립니다.`;
    $('reset-dialog').returnValue = ''; $('reset-dialog').showModal();
  }
  $('reset-scope').addEventListener('click', () => askReset(false)); $('reset-all').addEventListener('click', () => askReset(true));
  $('reset-dialog').addEventListener('close', () => {
    if ($('reset-dialog').returnValue === 'confirm' && pendingReset !== null) { engine.reset(pendingReset); hideAnswers(); save(); render(); notice('암기 상태를 해제했습니다. 누적 판단을 보존하고 리셋 이력을 추가했습니다.'); }
    pendingReset = null;
  });
  $('search').addEventListener('input', renderList); $('status-filter').addEventListener('change', renderList);
  $('export').addEventListener('click', () => {
    $('study-tools').open = false;
    try {
      const url = URL.createObjectURL(new Blob([JSON.stringify({ ...state(), exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' }));
      const link = el('a'); link.href = url; link.download = `haru-vocabulary-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      notice('누적 횟수와 전체 이력을 포함한 백업을 내보냈습니다. 다운로드 폴더를 확인해 주세요.');
    } catch { notice('백업 파일을 만들지 못했습니다. 브라우저의 다운로드 설정을 확인해 주세요.'); }
  });
  $('import').addEventListener('click', () => { $('study-tools').open = false; $('file').click(); });
  $('file').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    try {
      if (file.size > 25 * 1024 * 1024) throw Error('백업 파일은 25MB 이하여야 합니다.');
      pending = Learning.parse(JSON.parse(await file.text()), data);
      const unknown = Object.keys(pending.records).filter(id => !byId.has(id)).length;
      $('import-description').textContent = `${Object.keys(pending.records).length.toLocaleString()}개 단어 기록과 이력 ${pending.history.length.toLocaleString()}건을 불러옵니다.${unknown ? ` 현재 단어장에 없는 ${unknown}개 ID도 보존합니다.` : ''}`;
      $('import-dialog').returnValue = ''; $('import-dialog').showModal();
    } catch (error) { pending = null; notice(`불러오지 못했습니다. ${error.message}`); }
    finally { event.target.value = ''; }
  });
  $('import-dialog').addEventListener('close', () => {
    if ($('import-dialog').returnValue === 'confirm' && pending) {
      engine.replace(pending); hideAnswers(); selectors(); const saved = save(); render();
      notice(saved ? '백업 시점의 기록으로 교체하고 저장했습니다.' : '백업을 불러왔지만 브라우저 저장은 실패했습니다. 위 안내를 확인하세요.');
    }
    pending = null;
  });
  document.addEventListener('keydown', event => {
    if (reading && view === 'study' && !settingsExpanded && !$('import-dialog').open && !$('reset-dialog').open && !$('study-tools').open && event.code === 'Escape' && !event.isComposing) { event.preventDefault(); hideReading(); return; }
    if (event.code === 'Escape') { settingsExpanded = false; closeSettings(); return; }
    if (view !== 'study' || settingsExpanded || event.repeat || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || $('import-dialog').open || $('reset-dialog').open || $('study-tools').open) return;
    const target = event.target;
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable) return;
    const mapping = { KeyZ: 'meaning', KeyX: 'reading', KeyC: 'again', Space: 'memorize', KeyB: 'undo' };
    if (mapping[event.code]) { event.preventDefault(); const button = $(mapping[event.code]); if (!button.disabled && !button.closest('[hidden]')) button.click(); }
    else if (event.code === 'Enter' && target.tagName !== 'BUTTON' && !engine.current() && engine.totals().known < engine.totals().total) { event.preventDefault(); restart(); }
  });
  document.body.dataset.view = view; selectors(); engine.current(); render();
  if (!loadFailed) save();
  if (state().migratedFromV1) notice('이전 버전 기록을 보존했습니다. 샘플 기록은 실제 단어와 분리되며 백업에 함께 포함됩니다.');
  window.VocabularyApp = {
    data, snapshot: () => JSON.parse(JSON.stringify(state())),
    apply(value) { engine.replace(Learning.parse(value, data)); hideAnswers(); selectors(); render(); },
    persist: save
  };
})();
