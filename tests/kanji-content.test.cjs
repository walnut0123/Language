const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function notes() {
  const context = { window: {} };
  // The published compact file is self-contained; no old prose is required.
  vm.runInNewContext(fs.readFileSync(path.join(root, 'data/kanji-all.js'), 'utf8'), context);
  return context.window.KANJI_DETAILS;
}
test('all 1,070 entries have short composition and formation fields with named components', () => {
  const all = notes(); assert.equal(Object.keys(all).length, 1070);
  for (const [character, note] of Object.entries(all)) {
    assert.ok(note.components && note.formation, character);
    assert.ok(note.formation.length <= 65, `${character}: formation too long`);
    assert.ok(note.components.length <= 140, `${character}: composition too long`);
    assert.doesNotMatch(note.components + note.formation, /undefined|미확인|\[object Object\]|#\(구자체\)/, character);
    assert.equal('usage' in note, false); assert.equal('origin' in note, false);
  }
});
test('agreed 郵便 and 情報 examples preserve meanings, phonetic roles and variant radical names', () => {
  const all = notes();
  assert.equal(all.郵.components, '垂(드리울 수) + 阝[邑, 고을 읍]');
  assert.equal(all.郵.formation, '변두리 마을의 역참 → 소식 전달 → 우편.');
  assert.equal(all.便.components, '亻[人, 사람 인] + 更(고칠 경)');
  assert.equal(all.便.formation, '사람이 겪는 불편을 고침 → 편리하다.');
  assert.equal(all.情.components, '忄[心, 마음 심] + 青(푸를 청)');
  assert.match(all.情.formation, /心은 뜻, 青은 소리 담당/);
  assert.match(all.報.formation, /되갚다·알리다/);
});
test('unverified etymologies are disclosed rather than converted into invented meaning stories', () => {
  const all = notes();
  for (const note of Object.values(all).filter(n => n.formationKind === 'structural')) assert.match(note.formation, /형성 원리는 미확정/);
  const coverage = JSON.parse(fs.readFileSync(path.join(root, 'data/kanji-sources/compact-coverage.json'), 'utf8'));
  assert.deepEqual(coverage.unnamedComponents, []);
  assert.equal(coverage.total, 1070);
});
