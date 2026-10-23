// Import the visually verified printed text; never reads handwritten notes.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const target = path.join(root, 'data/words.js');
const original = fs.readFileSync(target, 'utf8');
const ctx = { window: {} };
vm.runInNewContext(original, ctx);
const data = ctx.window.VOCABULARY;
const imported = [], counts = {}, pages = {};
let day, photo, year;
for (const line of fs.readFileSync(path.join(root, 'data/mainbook-transcription.txt'), 'utf8').split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue;
  if (line.startsWith('@')) { [day, photo, year] = line.slice(1).split('|').map(Number); continue; }
  const [japanese, reading, meaning, partOfSpeech] = line.split('|');
  if (!japanese || !reading || !meaning || !partOfSpeech) throw Error(`Invalid entry: ${line}`);
  const order = counts[day] = (counts[day] || 0) + 1;
  pages[photo] = (pages[photo] || 0) + 1;
  imported.push({ id: `yuhadayo-n3-main-d${String(day).padStart(2, '0')}-${String(order).padStart(3, '0')}`,
    book: 'main', unit: `day-${String(day).padStart(2, '0')}`, japanese, reading, meaning,
    partOfSpeech, starred: false, order, sourceImage: `KakaoTalk_20261023_155212472${photo === 1 ? '' : `_${String(photo - 1).padStart(2, '0')}`}.jpg`, sourceYear: year });
}
if (counts[1] !== 87 || counts[2] !== 80 || JSON.stringify(Object.values(pages)) !== '[32,31,24,38,42]') throw Error('Source counts mismatch');
for (const word of imported) {
  const existing = data.words.find(w => w.id === word.id);
  if (existing && JSON.stringify(existing) !== JSON.stringify(word)) throw Error(`Existing ID differs: ${word.id}`);
  if (!existing) data.words.push(word);
}
fs.writeFileSync(target, original.slice(0, original.indexOf('window.VOCABULARY')) + 'window.VOCABULARY = ' + JSON.stringify(data, null, 2) + ';\n');
console.log(JSON.stringify({ days: counts, images: pages, imported: imported.length, total: data.words.length }));
