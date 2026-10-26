// Reconstruct a reviewable photo transcript using the existing book glossary.
// Run before import; mainbook-photos.json is the frozen, independently reviewable input.
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'data/source-words.js'), 'utf8'), ctx);
const base = ctx.window.VOCABULARY.words.filter(w => w.book === 'check' || (w.book === 'main' && ['day-01', 'day-02'].includes(w.unit)));
const overrides = new Map(fs.readFileSync(path.join(root, 'data/mainbook-photo-glossary.txt'), 'utf8').split(/\r?\n/).filter(l => l && !l.startsWith('#')).map(l => { const [japanese, reading, meaning] = l.split('|'); return [japanese, { japanese, reading, meaning }]; }));
const norm = s => s.replace(/[～~]/g, '').replace(/だ$/, '').replace(/する$/, '');
function lookup(japanese) {
  if (overrides.has(japanese)) return { ...overrides.get(japanese) };
  const found = base.find(w => w.japanese === japanese) || base.find(w => w.reading === japanese) || base.find(w => norm(w.japanese) === norm(japanese) || norm(w.reading) === norm(japanese));
  if (!found) throw Error(`Missing glossary: ${japanese}`);
  let reading = found.reading;
  for (const suffix of ['する', 'だ']) {
    if (japanese.endsWith(suffix) && !found.japanese.endsWith(suffix)) reading += suffix;
    else if (!japanese.endsWith(suffix) && found.japanese.endsWith(suffix)) reading = reading.replace(new RegExp(suffix + '$'), '');
  }
  return { japanese, reading, meaning: found.meaning, partOfSpeech: found.partOfSpeech };
}
const rows = fs.readFileSync(path.join(root, 'data/mainbook-photo-order.txt'), 'utf8').split(/\r?\n/).filter(l => l && !l.startsWith('#')).map(l => { const [photo, day, type, category, text] = l.split('|'); return { photo: +photo, day: +day, type, category, terms: text.split(' ') }; }).sort((a,b) => a.photo - b.photo);
const entries = [];
for (const row of rows) for (const term of row.terms) {
  const [left, right] = term.split('=');
  const word = { ...lookup(left), day: row.day, photo: row.photo, entryType: row.type, category: row.category };
  if (right) word.synonym = lookup(right);
  if (row.type === 'core') word.partOfSpeech = row.category.startsWith('명사') ? '명' : row.category.startsWith('い') ? 'い형' : 'な형';
  entries.push(word);
}
fs.writeFileSync(path.join(root, 'data/mainbook-photos.json'), JSON.stringify({ notes: '59 photos, printed text only; horizontal order. Readings/meanings reconciled with the existing book glossary. Core list: two photographed pages per study day, DAY 16–26.', entries }, null, 2) + '\n');
console.log(`Transcribed ${entries.length} entries from ${new Set(entries.map(w=>w.photo)).size} photos.`);
