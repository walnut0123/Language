const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..'), target = path.join(root, 'data/source-words.js');
const original = fs.readFileSync(target, 'utf8'), ctx = { window: {} };
vm.runInNewContext(original, ctx);
const data = ctx.window.VOCABULARY;
const transcript = JSON.parse(fs.readFileSync(path.join(root, 'data/mainbook-photos.json'), 'utf8'));
const photos = ['20261023_155119','20261023_155122','20261023_155129','20261023_155139','20261023_155142','20261024_124847','20261024_124850','20261024_124902','20261024_124906','20261024_124912','20261024_124915','20261024_124921','20261024_124924','20261024_124932','20261024_124935','20261024_124940','20261024_124955','20261024_124958','20261024_125002','20261024_125010','20261024_125013','20261024_125018','20261024_125027','20261024_125031','20261024_125044','20261024_125059','20261024_125101','20261024_125108','20261024_125131','20261024_125139','20261024_125145','20261024_125201','20261024_125205','20261024_125253','20261024_125256','20261024_125302','20261024_125305','20261024_125318','20261024_125322','20261024_125327','20261024_125330','20261024_125335','20261024_125338','20261024_125344','20261024_125346','20261024_125352','20261024_125356','20261024_125401','20261024_125404','20261024_125410','20261024_125413','20261024_125418','20261024_125421','20261024_125425','20261024_125429','20261024_125435','20261024_125438','20261024_125443','20261024_125447'];
const legacy = data.words.filter(w => w.book === 'main' && ['day-01', 'day-02'].includes(w.unit));
const used = new Set(), counts = {}, pages = {}, words = [];
for (const entry of transcript.entries) {
  const { day, photo, ...text } = entry;
  const unit = `day-${String(day).padStart(2,'0')}`, order = counts[day] = (counts[day] || 0) + 1;
  // Match each old occurrence exactly once, preserving IDs even when its order changes.
  const old = day <= 2 ? legacy.find(w => w.unit === unit && w.japanese === text.japanese && !used.has(w.id)) : null;
  if (day <= 2 && !old) throw Error(`Legacy occurrence missing: ${day} ${text.japanese}`);
  const id = old?.id || `yuhadayo-n3-main-d${String(day).padStart(2,'0')}-${String(order).padStart(3,'0')}`;
  used.add(id);
  const word = { ...old, ...text, id, book: 'main', unit, order, starred: old?.starred || false, partOfSpeech: text.partOfSpeech || '', sourceImage: photos[photo] + '.jpg', sourcePhoto: photo, sourcePageOrder: pages[photo] = (pages[photo] || 0) + 1 };
  if (old) { word.reading = old.reading; word.meaning = old.meaning; }
  if (word.synonym) word.meaning += ` ≒ ${word.synonym.japanese} (${word.synonym.meaning})`;
  words.push(word);
}
if (legacy.some(w => !used.has(w.id))) throw Error('Legacy IDs were dropped');
if (Object.keys(pages).length !== 59 || new Set(words.map(w => w.id)).size !== words.length) throw Error('Invalid coverage or IDs');
data.words = [...data.words.filter(w => w.book !== 'main'), ...words];
const main = data.books.find(b => b.id === 'main');
for (const u of main.units) {
  const day = Number(u.id.slice(4));
  const group = words.find(w => w.unit === u.id)?.category;
  u.name = `DAY ${String(day).padStart(2,'0')}${group ? ` · ${day <= 15 ? group : '핵심단어'}` : ''}`;
}
fs.writeFileSync(target, original.slice(0, original.indexOf('window.VOCABULARY')) + 'window.VOCABULARY = ' + JSON.stringify(data, null, 2) + ';\n');
const quote = s => '"' + String(s ?? '').replaceAll('"', '""') + '"';
const csv = [['일차','번호','유형','분류','일본어','읽는 법','한국어 뜻','유의어','유의어 읽기','유의어 뜻','사진']];
for (const w of words) csv.push([Number(w.unit.slice(4)),w.order,w.entryType,w.category,w.japanese,w.reading,w.synonym ? w.meaning.split(' ≒ ')[0] : w.meaning,w.synonym?.japanese,w.synonym?.reading,w.synonym?.meaning,w.sourceImage]);
fs.writeFileSync(path.join(root, 'data/mainbook-vocabulary.csv'), '\uFEFF' + csv.map(r => r.map(quote).join(',')).join('\r\n') + '\r\n');
fs.writeFileSync(path.join(root, 'data/mainbook-photo-report.json'), JSON.stringify({ photos: photos.map((name,i) => ({ name: name + '.jpg', entries: pages[i] })), days: counts, sourceEntries: words.length, synonymPairs: words.filter(w=>w.synonym).length, lastPage: 125 }, null, 2) + '\n');
require('./build_vocabulary.cjs');
console.log(JSON.stringify({ days: counts, total: words.length }));
