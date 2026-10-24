const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { prepare } = require('../vocabulary.js');
const Learning = require('../learning.js');
const book = id => ({ id, units: [{ id: 'day-01' }, { id: 'day-02' }, { id: 'day-03' }] });
const word = (id, extra = {}) => ({ id, book: 'main', unit: 'day-01', order: 1, japanese: '疑う', reading: 'うたがう', meaning: '의심하다', partOfSpeech: '동', ...extra });

test('day-only option preserves other days while comparing exactly the three specified fields', () => {
  const source = { books: [book('main'), book('check')], words: [
    word('later', { order: 8 }), word('first'),
    word('different-meaning', { meaning: '의심하다, 의문을 품다' }),
    word('different-reading', { reading: 'うたがい' }),
    word('different-pos', { partOfSpeech: '명' }),
    word('different-spacing', { meaning: '의심하다 ' }),
    word('next-day', { unit: 'day-02' }), word('other-book', { book: 'check' })
  ] };
  const before = JSON.stringify(source), data = prepare(source, { duplicateScope: 'day' });
  assert.deepEqual(data.duplicateOf, { later: 'first', 'different-pos': 'first' });
  assert.equal(data.words.length, 6);
  assert.equal(JSON.stringify(source), before);
  assert.equal(data.words.find(w => w.id === 'first').order, 1);
});

test('prior appearances use only strictly earlier DAYs, include other books and variant meanings, and deduplicate locations', () => {
  const source = { books: [book('main'), book('check')], words: [
    word('current', { unit: 'day-02' }), word('same-day', { unit: 'day-02', book: 'check' }),
    word('later', { unit: 'day-03' }), word('earlier'),
    word('earlier-variant', { meaning: '의문을 품다' }), word('other-earlier', { book: 'check' }),
    word('another-word', { japanese: '考える' })
  ] };
  const data = prepare(source, { duplicateScope: 'day' });
  assert.deepEqual(data.previousAppearances.current, [{ book: 'main', unit: 'day-01' }, { book: 'check', unit: 'day-01' }]);
  assert.deepEqual(data.previousAppearances.earlier, []);
  assert.deepEqual(data.previousAppearances['another-word'], []);
});

test('global deduplication retires 154 exact copies across books/days and preserves historical records', () => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('../data/words.js'), 'utf8'), context);
  const source = context.window.VOCABULARY, data = prepare(source);
  assert.equal(source.words.length - data.words.length, 154);
  assert.equal(data.words.length, 2389);
  assert.equal(data.words.filter(w => w.book === 'main' && w.unit === 'day-01').length, 82);
  assert.equal(data.words.filter(w => w.book === 'main' && w.unit === 'day-01' && w.japanese === '疑う').length, 1);
  assert.ok(!data.words.some(w => w.id === 'yuhadayo-n3-main-d02-023'));
  assert.equal(data.duplicateOf['yuhadayo-n3-main-d02-023'], 'yuhadayo-n3-main-d01-033');
  assert.equal(data.words.filter(w => w.japanese === '疑う').length, 1);
  const old = Learning.create(source); old.select({ book: 'main', mode: 'chapter', unit: 'day-01', questionOrder: 'ordered' });
  old.state.round = { ids: ['yuhadayo-n3-main-d01-086', 'yuhadayo-n3-main-d01-087'], index: 0 };
  old.judge('known');
  const migrated = Learning.create(data, Learning.parse(JSON.parse(JSON.stringify(old.state)), data));
  assert.equal(migrated.current().id, 'yuhadayo-n3-main-d01-087');
  assert.equal(migrated.state.records['yuhadayo-n3-main-d01-086'].knownCount, 1);
  assert.equal(migrated.state.history.length, old.state.history.length);
});
