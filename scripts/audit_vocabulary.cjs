// Reproduce the active-vocabulary audit without changing printed source entries.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { prepare } = require('../vocabulary.js');
const root = path.resolve(__dirname, '..'), context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'data/source-words.js'), 'utf8'), context);
const source = context.window.VOCABULARY, active = prepare(source);
const byId = new Map(source.words.map(word => [word.id, word]));
const report = {
  matchFields: ['japanese', 'reading', 'meaning'],
  scope: 'all books and days; retain earliest DAY, book order breaks ties; core exercises compare only within their printed classification',
  sourceCount: source.words.length, activeCount: active.words.length,
  books: source.books.map(book => ({ id: book.id, name: book.name, activeCount: active.words.filter(word => word.book === book.id).length })),
  removed: Object.entries(active.duplicateOf).map(([id, keptId]) => ({ id, keptId, japanese: byId.get(id).japanese, reading: byId.get(id).reading, meaning: byId.get(id).meaning, book: byId.get(id).book, unit: byId.get(id).unit })),
  repeatedVariants: active.words.filter(word => active.previousAppearances[word.id].length).map(word => ({ id: word.id, japanese: word.japanese, meaning: word.meaning, previous: active.previousAppearances[word.id] }))
};
fs.writeFileSync(path.join(root, 'data/duplicate-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`Source ${report.sourceCount}; active ${report.activeCount}; removed ${report.removed.length}`);
