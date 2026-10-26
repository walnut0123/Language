// Add conservative shape notes for the eleven new characters in the photos.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..'), target = path.join(root, 'data/kanji-all.js');
const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(target, 'utf8'), ctx);
const additions = JSON.parse(fs.readFileSync(path.join(root, 'data/kanji-photo-additions.json'), 'utf8'));
for (const [character, [meaning, components, componentCharacters]] of Object.entries(additions)) {
  ctx.window.KANJI_DETAILS[character] = { label: `${character}(${meaning})`, meaning, components, componentCharacters, formation: '자형 구성만 확인됨. 역사적 형성 원리는 미확정.', formationKind: 'structural', source: '사진 추가 단어의 자형 구성 검토' };
}
fs.writeFileSync(target, '// Generated kanji notes; photo additions: scripts/build_mainbook_kanji.cjs\nwindow.KANJI_DETAILS = ' + JSON.stringify(ctx.window.KANJI_DETAILS, null, 2) + ';\n');
const coveragePath = path.join(root, 'data/kanji-sources/compact-coverage.json');
const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
coverage.total = Object.keys(ctx.window.KANJI_DETAILS).length;
coverage.structural = Object.values(ctx.window.KANJI_DETAILS).filter(n=>n.formationKind === 'structural').length;
fs.writeFileSync(coveragePath, JSON.stringify(coverage, null, 2) + '\n');
console.log(`Kanji notes: ${coverage.total}`);
