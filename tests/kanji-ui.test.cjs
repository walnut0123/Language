const { test } = require('node:test');
const assert = require('node:assert/strict');
const { segments, layout, overlaps } = require('../kanji-ui.js');

test('ruby preserves kana suffixes, compound readings and kana-only words', () => {
  assert.deepEqual(segments({ japanese: '移す', reading: 'うつす' }), [
    { text: '移', reading: 'うつ', kanji: true }, { text: 'す', reading: '', kanji: false }
  ]);
  assert.deepEqual(segments({ japanese: '取り戻す', reading: 'とりもどす' }).map(p => p.reading || p.text), ['と', 'り', 'もど', 'す']);
  assert.deepEqual(segments({ japanese: 'コーヒー', reading: 'コーヒー' }), [{ text: 'コーヒー', reading: '', kanji: false }]);
  assert.deepEqual(segments({ japanese: '今日', reading: 'きょう' }), [{ text: '今日', reading: 'きょう', kanji: true }]);
  assert.deepEqual(segments({ japanese: '薬局', reading: 'やっきょく' }, { 薬局: ['やっ', 'きょく'] }).map(p => p.reading), ['やっ', 'きょく']);
});

test('up to five cards stay beside the word without overlaps; short screens request a scrolling side column', () => {
  for (const [width, height] of [[1440, 900], [1024, 768], [390, 844], [320, 568], [667, 375], [320, 380]]) {
    for (const count of [1, 2, 3, 4, 5]) for (const fraction of [.2, .5, .8]) {
      const word = { left: width <= 760 ? 28 : width / 2 - 90, top: height * fraction, width: width <= 760 ? Math.min(110, width - 212) : 180, height: 70 };
      const anchors = Array.from({ length: count }, (_, i) => ({ left: word.left + i * 50, top: word.top + 20, width: 50, height: 50 }));
      const boxes = layout(anchors, word, { width, height });
      if (width <= 760 && (height - 20 - 14 * (count - 1)) / count < 96) {
        assert.equal(boxes, null); continue;
      }
      assert.ok(boxes, `${width}×${height}, ${count} characters, y=${fraction}`);
      for (const [i, box] of boxes.entries()) {
        assert.ok(box.left >= 10 && box.top >= 10);
        assert.ok(box.left + box.width <= width - 10 && box.top + box.height <= height - 10);
        assert.equal(overlaps(box, word), false);
        assert.ok(box.left + box.width <= word.left - 14 || box.left >= word.left + word.width + 14);
        for (const other of boxes.slice(i + 1)) assert.equal(overlaps(box, other), false);
      }
    }
  }
});

test('layout reports exhaustion for a viewport with no free space around the word', () => {
  const word = { left: 0, top: 0, width: 240, height: 100 };
  assert.equal(layout([word], word, { width: 240, height: 100 }), null);
});

test('layout never falls back above or below a centered word when side space is insufficient', () => {
  const word = { left: 70, top: 200, width: 180, height: 70 };
  assert.equal(layout([word], word, { width: 320, height: 800 }), null);
});
