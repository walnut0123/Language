const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Quiz = require('../quiz.js');

test('all published words have four stable, distinct choices and no synonymous reading answers', () => {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('../data/words.js'), 'utf8'), ctx);
  const words = ctx.window.VOCABULARY.words, quiz = Quiz.create(words);
  for (const type of ['pronunciation', 'kanji']) for (const word of words) {
    const choices = quiz.choices(word, type);
    assert.equal(choices.length, 4, word.id);
    assert.equal(choices[0].id, word.id);
    assert.equal(new Set(choices.map(w => type === 'kanji' ? w.japanese : Quiz.hiragana(w.reading))).size, 4);
    assert.equal(choices.filter(w => Quiz.hiragana(w.reading) === Quiz.hiragana(word.reading)).length, 1);
    assert.deepEqual(quiz.choices(word, type), choices);
    assert.deepEqual(Quiz.create(words).choices(word, type), choices);
  }
});

test('shuffling changes positions without mutating question sets; explanations use hiragana', () => {
  const source = [1, 2, 3, 4];
  assert.deepEqual(Quiz.shuffle(source, () => 0), [2, 3, 4, 1]);
  assert.deepEqual(source, [1, 2, 3, 4]);
  assert.equal(Quiz.hiragana('ヒエル・コーヒー'), 'ひえる・こーひー');
});
