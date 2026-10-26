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
  matchFields: ['japanese'],
  variantFields: ['reading', 'meaning'],
  scope: 'Preserve every occurrence in every book and DAY, including same-day repeats',
  sourceCount: source.words.length, activeCount: active.words.length,
  books: source.books.map(book => ({ id: book.id, name: book.name, activeCount: active.words.filter(word => word.book === book.id).length })),
  removed: Object.entries(active.duplicateOf).map(([id, keptId]) => ({ id, keptId, japanese: byId.get(id).japanese, reading: byId.get(id).reading, meaning: byId.get(id).meaning, book: byId.get(id).book, unit: byId.get(id).unit })),
  duplicateGroups: [...new Set(active.words.map(w=>w.japanese))].map(japanese=>({japanese,occurrences:active.words.filter(w=>w.japanese===japanese).map(({id,book,unit,order,reading,meaning})=>({id,book,unit,order,reading,meaning}))})).filter(group=>group.occurrences.length>1)
};
fs.writeFileSync(path.join(root, 'data/duplicate-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`Source ${report.sourceCount}; active ${report.activeCount}; removed ${report.removed.length}`);

