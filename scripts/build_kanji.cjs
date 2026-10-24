// Build the redistributable vocabulary subset from public dictionary source files.
// Usage: node scripts/build_kanji.cjs [source-directory]
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const sourceDir = path.resolve(process.argv[2] || path.join(root, 'tmp/kanji-sources'));
const read = name => fs.readFileSync(path.join(sourceDir, name), 'utf8');
const context = { window: {} };
for (const name of ['words', 'kanji-notes', 'kanji-details']) vm.runInNewContext(fs.readFileSync(path.join(root, `data/${name}.js`), 'utf8'), context);
const words = context.window.VOCABULARY.words;
const characters = [...new Set(words.flatMap(w => w.japanese.match(/\p{Script=Han}/gu) || []))].sort();
const korean = new Map(), variants = new Map();
for (const line of read('hanja.txt').split('\n')) {
  if (line.startsWith('#')) continue;
  const [, character, gloss] = line.trim().split(':');
  if (character?.length === 1 && gloss && !korean.has(character)) korean.set(character, gloss);
}
for (const line of read('jp-old-style.txt').split('\n')) {
  if (line.startsWith('#')) continue;
  const [a, b] = line.trim().split(/\s+/);
  if (a && b && [...a][0] !== [...b][0]) variants.set([...a][0], [...b][0]);
}
const dictionary = new Map(read('dictionary.txt').trim().split('\n').map(line => { const entry = JSON.parse(line); return [entry.character, entry]; }));
const customLabels = { 々: '한자 반복 부호', 込: '들어가다 · 일본 국자', 働: '일하다 · 일본 국자', 既: '이미 기', 者: '사람 자' };
const extraOrigins = {
  '々': '앞에 나온 한자를 한 번 더 쓰는 대신 사용하는 반복 부호입니다. 독립된 한자의 뜻이나 고정된 발음이 있는 글자는 아닙니다.',
  '込': '이동을 나타내는 辶와 들어감을 뜻하는 入을 합쳐 일본에서 만든 국자입니다. 안으로 들어가거나 한곳에 모이는 뜻을 나타냅니다.',
  '働': '사람을 나타내는 亻과 움직임을 뜻하는 動을 합쳐 일본에서 만든 국자입니다. 사람이 움직여 일한다는 뜻으로 연결됩니다.',
  '挙': '옛 글자 擧·舉를 간략하게 한 일본 신자체입니다. 손을 나타내는 手가 남아 있으며 들어 올리다·일으키다의 뜻으로 쓰입니다.',
  '扱': '扌(손)와 及이 결합한 글자입니다. 손으로 다루는 행동과 연결되어 물건을 취급하거나 사람을 대하는 뜻에 씁니다.',
  '噂': '口(입)와 소리 요소 尊이 결합한 글자입니다. 입으로 전하는 말과 관련되며 일본어에서는 소문을 뜻합니다.',
  '値': '亻(사람)와 直이 결합한 일본 자형입니다. 물건이나 일에 매기는 값·가치라는 뜻으로 쓰입니다.',
  '喫': '口(입)와 소리 요소 契가 결합한 글자입니다. 먹다·마시다의 뜻에서 어떤 경험을 겪는 뜻으로도 넓어졌습니다.',
  '粧': '米와 소리 요소 庄이 결합한 글자입니다. 얼굴이나 몸을 꾸미는 화장·단장과 관련됩니다.',
  '郷': '옛 글자 鄕·鄉를 간략하게 한 일본 신자체입니다. 고을을 나타내는 邑 계열 요소가 들어가 고향·마을을 뜻합니다.',
  '奨': '獎을 간략하게 한 일본 신자체입니다. 좋은 행동을 권하거나 장려하고, 그 성과를 칭찬하는 뜻으로 쓰입니다.',
  '渋': '澁을 간략하게 한 일본 신자체입니다. 氵는 물 관련 요소이며 떫은맛이나 일이 매끄럽게 진행되지 않음을 나타냅니다.',
  '揃': '扌(손)와 소리 요소 前이 결합한 글자입니다. 일본어에서는 여럿을 가지런히 맞추거나 필요한 것을 모두 갖추는 데 씁니다.',
  '匂': '勹가 匕를 감싼 형태의 일본 국자입니다. 일본어에서 냄새나 향기를 나타내며, 자형을 역사적 장면처럼 풀이하지 않습니다.',
  '雰': '雨(비)와 소리 요소 分이 결합한 글자입니다. 안개와 공기 중의 기운을 나타내며 분위기라는 말에 쓰입니다.',
  '駄': '馬(말)와 소리 요소 太가 결합한 글자입니다. 짐을 싣는 말과 관련되며 일본어의 無駄에서는 쓸모없음이라는 뜻으로 쓰입니다.',
  '菓': '艹(풀)와 소리 요소 果가 결합한 글자입니다. 과일을 가리키던 뜻에서 과자나 달콤한 먹거리로 쓰임이 넓어졌습니다.'
};
const pictographs = {
  人:'서 있는 사람의 옆모습', 口:'벌어진 입의 모습', 山:'이어진 산봉우리', 木:'줄기와 가지, 뿌리가 있는 나무', 水:'물줄기가 흐르는 모습', 火:'타오르는 불꽃', 日:'해의 둥근 모습', 月:'초승달의 모습', 手:'손바닥과 펼친 손가락', 心:'심장의 모습', 女:'무릎을 굽힌 여자의 모습', 子:'머리와 팔이 두드러진 어린아이', 目:'눈의 윤곽과 눈동자', 雨:'하늘에서 떨어지는 빗방울', 鳥:'부리와 날개가 있는 새', 馬:'갈기와 다리가 있는 말', 牛:'뿔이 있는 소의 머리', 門:'양쪽 문짝이 있는 문', 米:'벼에서 얻은 쌀알', 井:'우물의 둘레', 穴:'동굴의 입구', 工:'일을 할 때 쓰는 도구', 止:'발의 모습', 片:'나무를 둘로 나눈 한쪽', 豆:'받침이 있는 옛 그릇', 足:'다리와 발의 모습', 示:'제물을 올리는 제단', 食:'그릇에 담긴 음식', 革:'펼친 짐승의 가죽', 缶:'흙을 구워 만든 항아리', 丘:'나란히 있는 언덕', 了:'몸을 감싼 어린아이', 北:'두 사람이 등을 맞댄 모습', 卒:'옷을 입은 병사', 皮:'손으로 짐승의 가죽을 벗기는 모습', 文:'몸에 무늬를 새긴 모습', 曲:'굽어 있는 물건', 立:'땅 위에 서 있는 사람', 申:'번개가 뻗는 모습'
};
const labelFor = character => {
  const gloss = customLabels[character] || korean.get(character) || korean.get(variants.get(character));
  if (!gloss) throw Error(`Missing Korean meaning: ${character}`);
  return gloss.split(',').slice(0, 2).join(', ');
};
const shortLabels = Object.fromEntries(characters.map(k => [k, labelFor(k)]));
const describeComponent = k => {
  const aliases = { '氵':'水', '扌':'手', '忄':'心', '亻':'人', '艹':'艸', '灬':'火', '衤':'衣', '礻':'示', '飠':'食', '讠':'言', '钅':'金', '糹':'糸', '釒':'金', '阝':'阜', '刂':'刀', '⺼':'肉', '⺮':'竹' };
  const label = korean.get(aliases[k] || k)?.split(',')[0];
  return label ? `${k}(${label})` : k;
};
const sourceSubset = {}, generated = {};
const report = { words: words.length, characters: characters.length, existing: 0, added: 0, phonetic: 0, structure: 0, pictographic: 0, sourceHashes: {} };
for (const file of ['hanja.txt', 'dictionary.txt', 'jp-old-style.txt']) report.sourceHashes[file] = crypto.createHash('sha256').update(read(file)).digest('hex');
for (const character of characters) {
  if (context.window.KANJI_DETAILS[character]) { report.existing++; continue; }
  const old = variants.get(character);
  const entry = dictionary.get(character) || dictionary.get(old);
  const etymology = entry?.etymology;
  let origin = extraOrigins[character];
  const variantPrefix = entry?.character !== character && old ? `일본 표기 ${character}의 옛 글자는 ${old}입니다. ` : '';
  if (!origin && etymology?.type === 'pictophonetic' && etymology.semantic && etymology.phonetic) {
    origin = variantPrefix + `${describeComponent(etymology.semantic)}는 뜻을, ${etymology.phonetic}는 소리를 나타내는 형성자입니다. 소리 요소는 글자가 만들어질 당시의 발음과 관련되므로 현대 일본어 읽기와 그대로 일치하지 않을 수 있습니다.`;
    report.phonetic++;
  } else if (!origin && pictographs[character]) {
    origin = `${pictographs[character]}을 바탕으로 한 상형자입니다. 지금의 글자 모양은 옛 그림 같은 형태가 긴 시간 동안 선과 획으로 정리된 결과입니다.`;
    report.pictographic++;
  } else if (!origin) {
    const components = [...new Set([...(entry?.decomposition || '')].filter(k => /\p{Script=Han}/u.test(k) || /[⺀-⻿]/u.test(k)))];
    if (!components.length && entry?.radical && entry.radical !== character) components.push(entry.radical);
    origin = variantPrefix + (components.length ? `글자 구성은 ${components.map(describeComponent).join(' · ')}로 나누어 살펴볼 수 있습니다. ` : `현재 자형은 ${entry?.character || character}의 형태를 바탕으로 살펴볼 수 있습니다. `) + '이는 자형을 구분하는 설명이며, 각 부품의 뜻을 단순히 더한 이야기가 곧 역사적 어원이라는 의미는 아닙니다.';
    report.structure++;
  }
  const examples = [...new Map(words.filter(w => w.japanese.includes(character)).map(w => [w.japanese, w])).values()].slice(0, 2);
  const usage = examples.map(w => `「${w.japanese}（${w.reading}）」: ${w.meaning}`).join(' / ');
  generated[character] = { label: `${character}(${shortLabels[character]})`, origin, meaning: shortLabels[character], usage, source: 'libhangul / Make Me a Hanzi', ...(old ? { traditional: old } : {}) };
  sourceSubset[character] = { korean: shortLabels[character], ...(old ? { traditional: old } : {}), ...(entry ? { dictionary: entry } : {}) };
  report.added++;
}
const targetDir = path.join(root, 'data/kanji-sources'); fs.mkdirSync(targetDir, { recursive: true });
fs.writeFileSync(path.join(root, 'data/kanji-all.js'), '// Generated by scripts/build_kanji.cjs. Data licenses: data/kanji-sources/NOTICE.md\nObject.assign(window.KANJI_DETAILS, ' + JSON.stringify(generated, null, 2) + ');\n');
fs.writeFileSync(path.join(targetDir, 'source-subset.json'), JSON.stringify(sourceSubset, null, 2) + '\n');
fs.writeFileSync(path.join(targetDir, 'coverage.json'), JSON.stringify(report, null, 2) + '\n');
const header = read('hanja.txt').split('\n').filter(line => line.startsWith('#')).slice(0, 26).join('\n');
fs.writeFileSync(path.join(targetDir, 'libhangul-BSD.txt'), header + '\n');
for (const file of ['COPYING.txt', 'LGPL.txt']) fs.copyFileSync(path.join(sourceDir, file), path.join(targetDir, file));
console.log(JSON.stringify(report, null, 2));
