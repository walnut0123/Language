const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const Learning = require('../learning.js');
const root = path.resolve(__dirname, '..');
const fixture = () => ({ books: [
  { id: 'check', name: '체크북', units: [{ id: 'day-01', name: 'DAY 01' }, { id: 'day-02', name: 'DAY 02' }, { id: 'day-03', name: 'DAY 03' }] },
  { id: 'main', name: '메인북', units: [{ id: 'day-01', name: 'DAY 01' }] }
], words: [
  { id: 'a', book: 'check', unit: 'day-01', order: 1, japanese: '愛', reading: 'あい', meaning: '사랑', partOfSpeech: '명' },
  { id: 'b', book: 'check', unit: 'day-01', order: 2, japanese: '合図', reading: 'あいず', meaning: '신호', partOfSpeech: '명' },
  { id: 'c', book: 'check', unit: 'day-02', order: 1, japanese: '本', reading: 'ほん', meaning: '책', partOfSpeech: '명' },
  { id: 'd', book: 'main', unit: 'day-01', order: 1, japanese: '朝', reading: 'あさ', meaning: '아침', partOfSpeech: '명' }
] });
const engine = () => Learning.create(fixture());
const copy = value => JSON.parse(JSON.stringify(value));

test('restored same-day occurrence is appended to saved round without losing judgments', () => {
  const old = fixture(), e = Learning.create(old);
  e.select({book:'check',mode:'chapter',unit:'day-01',questionOrder:'ordered'});
  e.judge('known');
  const saved=copy(e.state), updated=fixture();
  updated.words.push({...updated.words[0],id:'restored-repeat',order:3});
  const parsed=Learning.parse(saved,updated);
  assert.deepEqual(parsed.round.ids,[...saved.round.ids,'restored-repeat']);
  assert.equal(parsed.round.index,saved.round.index);
  assert.deepEqual(copy(parsed.records),saved.records);
  assert.deepEqual(parsed.history,saved.history);
});

test('PDF import: 30 days, 2376 unique IDs; source counts and sequence match', () => {
  const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(root, 'data/source-words.js'), 'utf8'), ctx);
  const data = ctx.window.VOCABULARY, report = JSON.parse(fs.readFileSync(path.join(root, 'data/import-report.json'), 'utf8'));
  assert.equal(data.words.filter(w => w.book === 'check').length, 2376);
  assert.equal(new Set(data.words.map(w => w.id)).size, data.words.length);
  for (const book of data.books) assert.equal(book.units.length, 30);
  assert.equal(data.words.filter(w => w.book === 'main').length, 2409);
  for (const day of report.days) {
    const words = data.words.filter(w => w.book === 'check' && w.unit === `day-${String(day.day).padStart(2, '0')}`);
    assert.equal(words.length, day.expected); assert.equal(words[0].japanese, day.first); assert.equal(words.at(-1).japanese, day.last);
    assert.deepEqual(Array.from(words, w => w.order), Array.from({ length: day.expected }, (_, i) => i + 1));
    for (const w of words) { assert.ok(w.japanese && w.reading && w.meaning); assert.equal(w.sourcePage, day.day); assert.ok(!w.japanese.includes('★')); }
  }
});

test('mainbook photos: day assignment, printed entries and source counts', () => {
  const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(root, 'data/source-words.js'), 'utf8'), ctx);
  const words = ctx.window.VOCABULARY.words.filter(w => w.book === 'main');
  for (const [unit, count] of [['day-01', 87], ['day-02', 80]]) {
    const entries = words.filter(w => w.unit === unit);
    assert.equal(entries.length, count);
    assert.deepEqual(Array.from(entries, w => w.order), Array.from({ length: count }, (_, i) => i + 1));
    for (const w of entries) assert.ok(w.japanese && w.reading && w.meaning && w.sourceImage && w.sourceYear);
  }
  const counts = [32,31,24,38,42,38,42,36,30,36,24,36,24,44,44,33,44,44,22,44,44,22,17,20,18,17,19,14,17,19,14,30,25,33,17,33,17,53,68,66,69,69,69,64,69,69,69,66,69,64,66,69,63,69,30,62,15,63,24];
  assert.deepEqual(Array.from(new Set(words.map(w => w.sourceImage)), file => words.filter(w => w.sourceImage === file).length), counts);
  assert.deepEqual(Array.from(words.slice(0,6), w=>w.japanese), ['移す','帯','完全','苦しい','呼吸','困る']);
  assert.equal(words[0].japanese, '移す'); assert.equal(words[86].japanese, '留守');
  assert.equal(words[87].japanese, '印象'); assert.equal(words.at(-1).japanese, 'わがままだ');
  assert.equal(words.filter(w => w.synonym).length, 155);
  for (const word of words.filter(w=>w.entryType === 'core')) assert.ok(word.category);
});

test('one pass per round, remaining-only next round, known exclusion', () => {
  const e = engine(); assert.equal(e.current().id, 'a'); e.judge('review'); assert.equal(e.current().id, 'b');
  e.judge('known'); assert.equal(e.current(), null); e.start(); assert.deepEqual(e.state.round.ids, ['a']);
  e.judge('known'); assert.equal(e.current(), null); assert.equal(e.totals().known, 2);
  assert.equal(e.judge('review'), false);
});

test('ordered spans days in original order, irrespective of array order', () => {
  const data = fixture(); data.words.reverse(); const e = Learning.create(data);
  e.select({ book: 'check', mode: 'ordered', unit: 'all' }); assert.deepEqual(e.state.round.ids, ['a', 'b', 'c']);
  for (const id of ['a', 'b', 'c']) { assert.equal(e.current().id, id); e.judge('known'); }
  assert.equal(e.current(), null);
});

test('random is a permutation without replacement and preserves order on reload', () => {
  const e = Learning.create(fixture(), Learning.fresh(), () => 0);
  e.select({ book: 'check', mode: 'random', unit: 'all' }); assert.deepEqual(e.state.round.ids, ['b', 'c', 'a']);
  e.judge('review'); const loaded = Learning.create(fixture(), Learning.parse(copy(e.state), fixture()));
  assert.equal(loaded.current().id, 'c'); assert.deepEqual(loaded.state.round.ids, ['b', 'c', 'a']);
  assert.equal(new Set(loaded.state.round.ids).size, 3);
});

test('chapter order can shuffle only that DAY, persists on reload and undo, excludes known words', () => {
  const e = Learning.create(fixture(), Learning.fresh(), () => 0);
  e.select({ book: 'check', mode: 'chapter', unit: 'day-01', questionOrder: 'random' });
  assert.deepEqual(e.state.round.ids, ['b', 'a']); e.judge('known');
  const loaded = Learning.create(fixture(), Learning.parse(copy(e.state), fixture()));
  assert.equal(loaded.state.selection.questionOrder, 'random'); assert.equal(loaded.current().id, 'a');
  loaded.undo(); assert.equal(loaded.current().id, 'b'); assert.equal(loaded.state.selection.questionOrder, 'random');
  loaded.judge('known'); loaded.start(); assert.deepEqual(loaded.state.round.ids, ['a']);
  loaded.select({ book: 'check', mode: 'chapter', unit: 'day-01', questionOrder: 'ordered' });
  assert.deepEqual(loaded.state.round.ids, ['a']);
});

test('older v2 backup without questionOrder resumes the existing round and undo', () => {
  const e = engine(); e.judge('review'); const backup = copy(e.state);
  delete backup.selection.questionOrder; delete backup.undo.selection.questionOrder;
  const loaded = Learning.create(fixture(), Learning.parse(backup, fixture()));
  assert.equal(loaded.state.selection.questionOrder, 'ordered'); assert.equal(loaded.current().id, 'b');
  loaded.undo(); assert.equal(loaded.current().id, 'a'); assert.equal(loaded.state.selection.questionOrder, 'ordered');
});

test('reset keeps judgment counts, records unit participation, and exposes all words again', () => {
  const e = engine(); e.judge('known'); e.judge('review');
  e.reset(); assert.equal(e.totals().known, 0); assert.equal(e.totals().knownCount, 1); assert.equal(e.totals().reviewCount, 1);
  assert.deepEqual(e.state.round.ids, ['a', 'b']); assert.equal(e.state.unitResets['check/day-01'], 1);
  assert.equal(e.state.records.a.resetCount, 1); assert.equal(e.state.history.at(-1).knownBefore, 1); assert.equal(e.state.undo, null);
  e.judge('known'); assert.equal(e.state.records.a.knownCount, 2);
  e.reset(); assert.equal(e.state.unitResets['check/day-01'], 2); assert.equal(e.state.records.a.knownCount, 2);
});

test('scope reset leaves other units intact; global reset covers both books', () => {
  const e = engine(); e.select({ book: 'check', mode: 'ordered', unit: 'all' });
  e.judge('known'); e.judge('known'); e.judge('known'); e.select({ book: 'check', mode: 'chapter', unit: 'day-01' });
  e.reset(); assert.ok(e.known('c')); assert.equal(e.state.unitResets['check/day-02'], undefined);
  e.select({ book: 'main', mode: 'chapter', unit: 'day-01' }); e.judge('known'); e.reset(true);
  assert.equal(e.known('c'), false); assert.equal(e.known('d'), false);
  assert.equal(e.state.records.d.knownCount, 1); assert.equal(e.state.unitResets['check/day-01'], 2);
  assert.equal(e.state.unitResets['check/day-02'], 1); assert.equal(e.state.unitResets['main/day-01'], 1);
  assert.equal(e.state.history.at(-1).wordCount, 4);
});

test('undo after reload restores scope, exact counters, prior status; canceled event is retained', () => {
  let e = engine(); e.judge('review'); e.judge('known'); e.start(); e.judge('known');
  e = Learning.create(fixture(), Learning.parse(copy(e.state), fixture()));
  e.select({ book: 'main', mode: 'chapter', unit: 'day-01' }); assert.equal(e.undo(), true);
  assert.equal(e.current().id, 'a'); assert.equal(e.state.records.a.reviewCount, 1); assert.equal(e.state.records.a.knownCount, 0);
  assert.equal(e.state.records.a.status, 'review'); assert.ok(e.state.history.at(-1).undoneAt); assert.equal(e.undo(), false);
});

test('restore retains cumulative judgments and returns word in next pass', () => {
  const e = engine(); e.judge('known'); assert.ok(e.restore('a')); assert.equal(e.state.records.a.knownCount, 1);
  assert.equal(e.state.records.a.restoreCount, 1); assert.equal(e.current().id, 'b'); e.judge('known'); e.start(); assert.equal(e.current().id, 'a');
  assert.equal(e.restore('missing'), false);
});

test('new and removed words do not corrupt active round or ID-linked records', () => {
  let e = engine(); e.judge('known'); const data = fixture(); data.words.reverse();
  data.words.push({ ...data.words.find(w => w.id === 'a'), id: 'new', order: 3 });
  e = Learning.create(data, Learning.parse(copy(e.state), data)); assert.equal(e.current().id, 'b'); assert.ok(e.known('a'));
  e.judge('known'); e.start(); assert.deepEqual(e.state.round.ids, ['new']);
  data.words = data.words.filter(w => w.id !== 'new'); e = Learning.create(data, Learning.parse(copy(e.state), data)); assert.equal(e.current(), null);
});

test('v1 migration preserves orphan sample records, derives minimum counts and starts real data', () => {
  const legacy = { version: 1, records: { 'check-000001': { status: 'known', updatedAt: new Date().toISOString() } }, selection: { book: 'check', unit: 'day-01' }, round: { ids: ['check-000001'], index: 1 }, undo: null };
  const migrated = Learning.parse(legacy, fixture()), e = Learning.create(fixture(), migrated);
  assert.equal(e.current().id, 'a'); assert.equal(e.totals().known, 0); assert.equal(e.state.records['check-000001'].knownCount, 1);
  assert.ok(e.state.migratedFromV1); assert.equal(e.state.version, 2);
  assert.ok(Learning.parse(copy(e.state), fixture()).records['check-000001']);
});

test('backup roundtrip retains history, counters, reset counts, unknown IDs, and undo', () => {
  const e = engine(); e.judge('known'); e.reset(true); e.judge('review');
  e.state.records['future-word'] = { status: 'known', updatedAt: new Date().toISOString(), knownCount: 7, reviewCount: 3, restoreCount: 0, resetCount: 2 };
  const result = Learning.parse(copy(e.state), fixture()); assert.deepEqual(copy(result), copy(e.state));
  const restored = Learning.create(fixture(), result); assert.ok(restored.undo()); assert.equal(restored.state.records.a.knownCount, 1);
});

test('malformed backup rejection is atomic', () => {
  const e = engine(); e.judge('known'); const previous = copy(e.state);
  for (const mutate of [s => s.version = 99, s => s.records.a.knownCount = -1, s => s.history[0].at = 'bad', s => s.unitResets.x = 1.5, s => s.undo.eventId = 'missing', s => s.history.push(s.history[0])]) {
    const bad = copy(previous); mutate(bad); assert.throws(() => e.replace(bad)); assert.deepEqual(copy(e.state), previous);
  }
});

test('empty unit has no questions and does not count a reset', () => {
  const e = engine(); e.select({ book: 'check', mode: 'chapter', unit: 'day-03' }); assert.equal(e.current(), null);
  assert.equal(e.reset(), false); assert.equal(e.state.history.length, 0);
});

// Small DOM/storage adapter for real app.js event wiring (not a layout/browser test).
test('legacy 167 permanent IDs still identify the same printed occurrences after horizontal reordering', () => {
  const ctx = {window:{}}; vm.runInNewContext(fs.readFileSync(path.join(root,'data/source-words.js'),'utf8'),ctx);
  let day; const counts={};
  for(const line of fs.readFileSync(path.join(root,'data/mainbook-transcription.txt'),'utf8').split(/\r?\n/)) {
    if(!line || line.startsWith('#')) continue;
    if(line.startsWith('@')) { day=Number(line.slice(1).split('|')[0]); continue; }
    const order=counts[day]=(counts[day]||0)+1;
    const id=`yuhadayo-n3-main-d${String(day).padStart(2,'0')}-${String(order).padStart(3,'0')}`;
    assert.equal(ctx.window.VOCABULARY.words.find(w=>w.id===id)?.japanese,line.split('|')[0]);
  }
});

function ui(storage = {}, failSave = false, vocabulary = fixture()) {
  const nodes = {}, documentEvents = {};
  class Element {
    constructor(tag = 'DIV') { this.tagName = tag.toUpperCase(); this.children = []; this.events = {}; this.dataset = {}; this.style = { setProperty() {} }; this.value = ''; this._text = ''; this.hidden = false; this.firstChild = { textContent: '' }; this.classList = { add() {}, toggle() {}, contains() { return false; } }; }
    get textContent() { return this._text + this.children.map(n => n.textContent).join(''); }
    set textContent(value) { this._text = value; this.children = []; }
    append(...items) { for (const item of items) { item.parent = this; this.children.push(item); } }
    prepend(...items) { for (const item of items) item.parent = this; this.children.unshift(...items); }
    after(...items) { for (const item of items) item.parent = this.parent; this.parent.children.splice(this.parent.children.indexOf(this)+1,0,...items); }
    replaceChildren(...items) { this.children = []; this.append(...items); }
    addEventListener(name, handler) { this.events[name] = handler; }
    setAttribute(name, value) { (this.attributes ||= {})[name] = value; }
    getAttribute(name) { return this.attributes?.[name]; }
    removeAttribute(name) { if (this.attributes) delete this.attributes[name]; }
    remove() {}
    closest() { for (let n = this; n; n = n.parent) if (n.hidden) return n; return null; }
    showModal() { this.open = true; }
    close() { this.open = false; this.fire('close'); }
    showPopover() { this.open = true; } hidePopover() { this.open = false; }
    focus() {}
    getBoundingClientRect() { return { left: 450, top: 300, width: 60, height: 80 }; }
    click() { if (!this.disabled) return this.events.click?.({ target: this }); }
    fire(name) { return this.events[name]?.({ target: this }); }
  }
  const document = { getElementById: id => nodes[id] ||= new Element(), createElement: tag => new Element(tag), createDocumentFragment: () => new Element(), createTextNode: text => ({ textContent: text }), body: new Element('body'), addEventListener: (type, fn) => documentEvents[type] = fn };
  const context = vm.createContext({ window: { VOCABULARY: require('../vocabulary.js').prepare(vocabulary), scrollTo() {}, addEventListener() {}, innerWidth: 1200, innerHeight: 800 }, document, Learning, KanjiUI: require('../kanji-ui.js'), console, Blob, URL, setTimeout: fn => fn(), localStorage: {
    getItem: key => storage[key] || null, setItem: (key, value) => { if (failSave) throw Error('quota'); storage[key] = value; }
  } });
  const quizButtons = ['classic', 'pronunciation', 'kanji'].map(type => {
    const button = nodes['type-' + type] = new Element('button'); button.dataset.quiz = type; return button;
  });
  const descendants = node => (node?.children || []).flatMap(n => [n, ...descendants(n)]);
  document.getElementById = id => descendants(nodes.card).find(n => n.id === id) || (nodes[id] ||= new Element());
  document.querySelectorAll = selector => selector === '[data-quiz]' ? quizButtons : descendants(nodes.card).filter(n => n.className === 'quiz-choice');
  context.Quiz = require('../quiz.js');
  nodes['actions'] = new Element();
  for (const id of ['meaning', 'reading', 'again', 'memorize']) { nodes[id] = new Element('button'); nodes.actions.append(nodes[id]); }
  vm.runInContext(fs.readFileSync(path.join(root, 'data/kanji-notes.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'data/kanji-details.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'data/kanji-all.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'app.js'), 'utf8'), context);
  return { nodes, storage, click: id => nodes[id].click(), state: () => JSON.parse(storage['haru-vocabulary-v1']),
    card: () => {
      const visible = n => n.hidden || n.className === 'ruby-hidden' ? '' : (n._text || '') + (n.children || []).map(visible).join('');
      return nodes.card.children.map(visible).join(' ');
    },
    key(code, extra = {}) { const e = { code, target: new Element('body'), preventDefault() {}, ...extra }; documentEvents.keydown(e); },
    async file(text) { nodes.file.files = [{ size: text.length, text: async () => text }]; await nodes.file.fire('change'); },
    close(id, result) { nodes[id].returnValue = result; nodes[id].open = false; nodes[id].fire('close'); }
  };
}

test('all vocabulary characters have notes; DAY 01 keeps exact per-character ruby readings', () => {
  const context = { window: {} };
  for (const file of ['data/words.js', 'data/kanji-notes.js', 'data/kanji-details.js', 'data/kanji-all.js']) vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
  const words = context.window.VOCABULARY.words.filter(w => w.book === 'main' && w.unit === 'day-01');
  assert.equal(words.length, 87);
  for (const word of words) {
    const note = context.window.KANJI_NOTES[word.japanese];
    assert.ok(note?.origin && note?.connection, word.japanese);
    for (const character of word.japanese.match(/\p{Script=Han}/gu) || []) {
      const detail = context.window.KANJI_DETAILS[character];
      assert.ok(detail?.label && detail.components && detail.formation, character);
    }
    const parts = require('../kanji-ui.js').segments(word, context.window.KANJI_READINGS);
    assert.equal(parts.map(p => p.reading || p.text).join(''), word.reading, word.japanese);
    assert.ok(parts.filter(p => p.kanji).every(p => [...p.text].length === 1), word.japanese);
  }
  const allWords = context.window.VOCABULARY.words;
  assert.equal(allWords.length, 4785);
  const characters = new Set(allWords.flatMap(w => (w.japanese + (w.synonym?.japanese || '')).match(/\p{Script=Han}/gu) || []));
  assert.equal(characters.size, 1081);
  for (const character of characters) {
    const detail = context.window.KANJI_DETAILS[character];
    assert.ok(detail?.label && detail.components && detail.formation, character);
    assert.doesNotMatch([detail.label, detail.components, detail.formation].join(''), /undefined|\[object Object\]/);
  }
  const app = ui({}, false, context.window.VOCABULARY);
  app.key('KeyX'); assert.equal(app.nodes['kanji-layer'].hidden, false);
  assert.match(app.nodes['kanji-layer'].textContent, /愛/);
  app.nodes.book.value = 'main'; app.nodes.book.fire('change');
  app.key('KeyX', { repeat: true }); assert.ok(app.nodes['kanji-layer'].hidden);
  app.key('KeyX'); assert.equal(app.nodes['kanji-layer'].hidden, false);
  assert.equal(app.nodes['kanji-layer'].children.length, 1);
  assert.match(app.nodes['kanji-layer'].textContent, /移/);
  const body = app.nodes['kanji-layer'].children[0].children[1];
  assert.deepEqual(body.children.filter(n => n.tagName === 'H3').map(n => n.textContent), ['구성', '형성 원리']);
  assert.doesNotMatch(body.textContent, /뜻의 확장|글자의 뜻|유래·구성/);
  app.key('KeyX'); assert.equal(app.nodes['kanji-layer'].hidden, true);
  app.key('KeyX'); app.key('Escape'); assert.equal(app.nodes['kanji-layer'].hidden, true);
  app.key('KeyX'); app.key('Space'); assert.equal(app.nodes['kanji-layer'].hidden, true);
  app.key('Space'); app.key('KeyX'); assert.equal(app.nodes['kanji-layer'].children.length, 2);
  app.nodes.unit.value = 'day-02'; app.nodes.unit.fire('change');
  assert.equal(app.nodes['kanji-layer'].hidden, true);
  app.key('KeyX'); assert.equal(app.nodes['kanji-layer'].hidden, false);
});

test('meaning and reading toggle independently without changing learning records; no reading placeholder row', () => {
  const app = ui(), before = JSON.stringify(app.state());
  assert.doesNotMatch(app.card(), /읽는 법을 떠올려/);
  assert.equal(app.nodes.card.children[1].className, 'japanese');
  assert.match(app.nodes.card.children[2].className, /^answer/);
  app.key('KeyZ'); assert.match(app.card(), /사랑/);
  assert.equal(app.nodes.meaning.getAttribute('aria-pressed'), 'true');
  assert.equal(app.nodes.meaning.disabled, false);
  app.key('KeyX'); assert.match(app.card(), /あい/);
  assert.equal(app.nodes.reading.getAttribute('aria-pressed'), 'true');
  assert.equal(app.nodes['kanji-layer'].hidden, false);
  app.key('KeyZ'); assert.doesNotMatch(app.card(), /사랑/); assert.match(app.card(), /あい/);
  assert.equal(app.nodes.meaning.getAttribute('aria-pressed'), 'false');
  app.click('reading'); assert.doesNotMatch(app.card(), /あい/);
  assert.equal(app.nodes.reading.getAttribute('aria-pressed'), 'false');
  assert.equal(app.nodes['kanji-layer'].hidden, true);
  app.click('reading'); app.click('meaning');
  assert.match(app.card(), /あい/); assert.match(app.card(), /사랑/);
  assert.equal(JSON.stringify(app.state()), before);
  app.nodes['kanji-layer'].children[0].children[0].children[2].click();
  assert.equal(app.nodes.reading.getAttribute('aria-pressed'), 'false');
  assert.equal(app.nodes['kanji-layer'].hidden, true);
  app.key('KeyV'); assert.equal(app.nodes['kanji-layer'].hidden, true);
});

test('duplicate badge appears on both occurrences in study and list with the other location', () => {
  const vocabulary = fixture();
  vocabulary.words.push({ ...vocabulary.words[0], id: 'variant', unit: 'day-02', meaning: '사랑, 애정', order: 2 });
  const app = ui({}, false, vocabulary);
  assert.match(app.card(), /같은 표기의 단어/);
  app.nodes.unit.value = 'day-02'; app.nodes.unit.fire('change');
  app.key('Space');
  assert.match(app.card(), /같은 표기의 단어/);
  const badge = app.nodes.card.children.find(n => n.className === 'previous-appearance');
  assert.deepEqual(badge.children.map(n => n.textContent), ['같은 표기의 단어 · 읽기·뜻 확인', '체크북 / D1 / 1번']);
  app.click('tab-list');
  assert.match(app.nodes['word-list'].textContent, /같은 표기의 단어 · 읽기·뜻 확인체크북 \/ D1 \/ 1번/);
});

test('published main DAY 02 and DAY 01 both display their printed 郵便 occurrence', () => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'data/words.js'), 'utf8'), context);
  const app = ui({}, false, context.window.VOCABULARY);
  app.nodes.book.value = 'main'; app.nodes.book.fire('change'); app.click('tab-list');
  app.nodes.unit.value = 'day-02'; app.nodes.unit.fire('change');
  assert.match(app.nodes['word-list'].textContent, /郵便/);
  app.nodes.unit.value = 'day-01'; app.nodes.unit.fire('change');
  assert.match(app.nodes['word-list'].textContent, /郵便/);
});

test('UI shortcuts reveal answers and advance, ignore repeat/editable/modal/list contexts', () => {
  const app = ui(); app.key('KeyZ'); app.key('KeyX'); assert.match(app.card(), /사랑/); assert.match(app.card(), /あい/);
  for (const extra of [{ repeat: true }, { ctrlKey: true }, { isComposing: true }, { target: { tagName: 'INPUT' } }, { target: { tagName: 'SELECT' } }]) app.key('Space', extra);
  assert.equal(app.state().round.index, 0);
  app.click('reset-all'); app.key('Space'); assert.equal(app.state().round.index, 0); app.close('reset-dialog', 'cancel');
  app.key('KeyC'); assert.doesNotMatch(app.card(), /사랑|あい/); app.key('Space'); app.key('Enter'); assert.match(app.card(), /愛/);
  app.key('KeyB'); assert.match(app.card(), /合図/); assert.equal(app.state().records.b, undefined);
  app.click('tab-list'); const before = JSON.stringify(app.state()); app.key('Space'); assert.equal(JSON.stringify(app.state()), before);
});

test('settings drawer blocks study shortcuts and Escape restores study without changing progress', () => {
  const app = ui(); app.click('settings-toggle'); app.key('Space');
  assert.equal(app.state().round.index, 0);
  app.key('Escape'); app.key('Space');
  assert.equal(app.state().records.a.knownCount, 1);
  app.click('settings-toggle'); app.click('tab-list'); app.click('tab-study');
  assert.equal(app.nodes['quiz-dialog'].open, true); app.close('quiz-dialog', '');
  app.key('KeyC'); assert.equal(app.state().records.b.reviewCount, 1);
});

test('pronunciation quiz shows four readings immediately and keeps its rows when revealing the answer', () => {
  const app = ui(); app.click('type-pronunciation');
  assert.match(app.card(), /사랑/); assert.match(app.card(), /あい/); assert.doesNotMatch(app.card(), /愛/);
  const rows = app.nodes.card.children.map(n => n.className);
  app.key('Space'); assert.equal(app.state().round.index, 0);
  const choices = app.nodes.card.children.find(n => n.className === 'quiz-choices').children;
  choices.find(n => n.children[1].textContent === 'あい').click();
  assert.match(app.card(), /愛/); assert.equal(app.state().round.index, 0);
  assert.deepEqual(app.nodes.card.children.map(n => n.className), rows);
  app.key('Space'); assert.equal(app.state().round.index, 1);
});

test('kanji quiz shows choices immediately, Z reveals meaning, wrong answer remains review', () => {
  const app = ui(); app.click('type-kanji');
  assert.match(app.card(), /あい/); assert.match(app.card(), /愛/); assert.doesNotMatch(app.card(), /사랑/);
  const rows = app.nodes.card.children.map(n => n.className);
  const controls = app.nodes.card.children.find(n => n.className === 'quiz-controls');
  assert.equal(controls.children[0].id, 'quiz-hint');
  app.key('KeyZ'); assert.match(app.card(), /사랑/);
  assert.deepEqual(app.nodes.card.children.map(n => n.className), rows);
  assert.doesNotMatch(app.card(), /한글 뜻 힌트/);
  assert.equal(app.nodes.card.children.filter(n => n.className === 'answer').length, 0);
  const choices = app.nodes.card.children.find(n => n.className === 'quiz-choices').children;
  choices.find(n => n.children[1].textContent !== '愛').click();
  assert.equal(app.state().round.index, 0);
  choices.find(n => n.children[1].textContent === '愛').click();
  assert.match(app.card(), /신호|아침|책/);
  const revealed = app.nodes.card.children.find(n => n.className === 'quiz-choices').children;
  assert.ok(revealed.every(n => n.children.some(c => c.className === 'quiz-explanation' && !c.hidden)));
  app.key('Space'); assert.equal(app.state().records.a.status, 'review');
});

test('both choice quizzes map QWER to the displayed positions and ignore numeric keys', () => {
  for (const type of ['pronunciation', 'kanji']) for (const [index, code] of ['KeyQ', 'KeyW', 'KeyE', 'KeyR'].entries()) {
    const app = ui(); app.click('type-' + type);
    if (type === 'pronunciation') app.key('KeyZ');
    const buttons = () => app.nodes.card.children.find(n => n.className === 'quiz-choices').children;
    assert.ok(buttons()[index].children[0].textContent === 'QWER'[index]);
    for (const old of ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Numpad1']) app.key(old);
    assert.ok(buttons().every(button => !button.disabled));
    app.key(code); assert.equal(buttons()[index].disabled, true);
    assert.equal(app.state().round.index, 0);
  }
});

test('Space maps to known once, prevents scrolling/native click, ignores old keys and open management', () => {
  const app = ui(); let prevented = 0;
  for (const code of ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Numpad3', 'KeyV']) app.key(code);
  assert.equal(app.state().round.index, 0);
  app.nodes['study-tools'].open = true; app.key('Space'); assert.equal(app.state().round.index, 0);
  app.nodes['study-tools'].open = false;
  app.key('Space', { target: { tagName: 'BUTTON' }, preventDefault() { prevented++; } });
  assert.equal(prevented, 1); assert.equal(app.state().records.a.knownCount, 1); assert.equal(app.state().records.a.reviewCount, 0);
  app.key('Space', { repeat: true }); assert.equal(app.state().round.index, 1);
  app.key('KeyB'); assert.equal(app.state().records.a, undefined);
});

test('UI reset cancellation does not change history; confirm preserves judgments', () => {
  const app = ui(); app.click('memorize'); const before = JSON.stringify(app.state());
  app.click('reset-all'); app.close('reset-dialog', 'cancel'); assert.equal(JSON.stringify(app.state()), before);
  app.click('reset-all'); app.close('reset-dialog', 'confirm'); assert.equal(app.state().records.a.knownCount, 1); assert.equal(app.state().records.a.status, 'review');
  app.click('reset-all'); app.close('reset-dialog', ''); assert.equal(app.state().unitResets['check/day-01'], 1);
});

test('UI mode selection disables units for whole-book modes; list defaults to all without changing study', () => {
  const app = ui();
  app.nodes.mode.value = 'ordered'; app.nodes.mode.fire('change');
  assert.equal(app.nodes.unit.disabled, true); assert.deepEqual(app.state().round.ids, ['a', 'b', 'c']);
  app.nodes.mode.value = 'chapter'; app.nodes.mode.fire('change'); assert.equal(app.nodes.unit.disabled, false);
  app.nodes.unit.value = 'day-02'; app.nodes.unit.fire('change'); assert.match(app.card(), /本/);
  const before = JSON.stringify(app.state()); app.click('tab-list'); assert.equal(app.nodes.unit.value, 'all');
  app.nodes.unit.value = 'day-01'; app.nodes.unit.fire('change'); assert.equal(JSON.stringify(app.state()), before);
  app.click('tab-study'); assert.equal(app.nodes.unit.value, 'day-02'); assert.match(app.card(), /本/);
});

test('UI chapter order changes reset only the round and retain judgment history; backup resumes setting', () => {
  const app = ui(); app.click('memorize');
  app.nodes['question-order'].value = 'random'; app.nodes['question-order'].fire('change');
  assert.equal(app.state().selection.questionOrder, 'random'); assert.equal(app.state().round.index, 0);
  assert.deepEqual(app.state().round.ids, ['b']); assert.equal(app.state().records.a.knownCount, 1);
  const resumed = ui(app.storage); assert.equal(resumed.nodes['question-order'].value, 'random'); assert.equal(resumed.nodes['question-order'].disabled, false);
  resumed.nodes.mode.value = 'ordered'; resumed.nodes.mode.fire('change');
  assert.equal(resumed.nodes['question-order'].disabled, true); assert.equal(resumed.nodes['question-order'].value, 'ordered');
  resumed.nodes.mode.value = 'random'; resumed.nodes.mode.fire('change');
  assert.equal(resumed.nodes['question-order'].value, 'random');
});

test('UI import rejects invalid files, supports cancel/Escape, then restores counters and session', async () => {
  const app = ui(); app.click('memorize'); const backup = JSON.stringify(app.state()); app.click('again'); const before = JSON.stringify(app.state());
  await app.file('{bad'); assert.equal(JSON.stringify(app.state()), before);
  await app.file(backup); app.close('import-dialog', 'cancel'); assert.equal(JSON.stringify(app.state()), before);
  await app.file(backup); app.close('import-dialog', 'confirm'); assert.equal(app.state().round.index, 1); assert.equal(app.state().records.a.knownCount, 1);
  app.click('memorize'); const after = JSON.stringify(app.state()); await app.file(backup); assert.equal(app.nodes['import-dialog'].returnValue, ''); app.close('import-dialog', ''); assert.equal(JSON.stringify(app.state()), after);
});

test('UI failed save is visible and learning remains usable; malformed storage is not overwritten on load', () => {
  const app = ui({}, true); app.click('memorize'); assert.equal(app.nodes['storage-error'].hidden, false); assert.match(app.nodes['storage-error'].textContent, /保存|저장/); assert.match(app.card(), /合図/);
  const storage = { 'haru-vocabulary-v1': '{bad' }; const broken = ui(storage); assert.equal(storage['haru-vocabulary-v1'], '{bad'); assert.equal(broken.nodes['storage-error'].hidden, false);
});

test('synonym pairs reveal together with Z and keep classic shortcuts in both quiz modes', () => {
  for (const type of ['classic','pronunciation','kanji']) {
    const data=fixture(); Object.assign(data.words[0], {entryType:'synonym',japanese:'キッチン',reading:'きっちん',meaning:'키친, 부엌 ≒ 台所 (부엌)',synonym:{japanese:'台所',reading:'だいどころ',meaning:'부엌'}});
    const app=ui({'haru-quiz-preferences':JSON.stringify({type})},false,data);
    assert.match(app.card(), /비슷한 뜻/); assert.doesNotMatch(app.card(), /台所/);
    app.key('KeyZ'); assert.match(app.card(), /台所/); assert.match(app.card(), /부엌/);
    app.key('KeyX'); assert.match(app.card(), /だいどころ/);
    app.key('Space'); assert.equal(app.state().records.a.status,'known');
  }
});

test('core classification is visible before answering and searchable in the list', () => {
  const data=fixture(); Object.assign(data.words[0],{entryType:'core',category:'명사 - あ행'});
  const app=ui({},false,data); assert.match(app.card(),/명사 - あ행/);
  app.click('tab-list'); app.nodes.search.value='명사 - あ행'; app.nodes.search.fire('input');
  assert.match(app.nodes['word-list'].textContent,/愛/); assert.doesNotMatch(app.nodes['word-list'].textContent,/合図/);
});

