/* Keep printed source IDs intact; curate the active vocabulary independently. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.Vocabulary = api; root.VOCABULARY = api.prepare(root.VOCABULARY); }
})(typeof window === 'object' ? window : globalThis, () => {
  function dayOf(data, word) {
    const day = /^day-(\d+)$/.exec(word.unit);
    return day ? Number(day[1]) : data.books.find(b => b.id === word.book)?.units.findIndex(u => u.id === word.unit) + 1;
  }
  function prepare(source, { duplicateScope = 'all' } = {}) {
    if (!['day', 'book', 'all'].includes(duplicateScope)) throw Error('Unknown duplicate scope');
    const bookOrder = new Map(source.books.map((book, index) => [book.id, index]));
    const ordered = [...source.words].sort((a, b) => dayOf(source, a) - dayOf(source, b) || bookOrder.get(a.book) - bookOrder.get(b.book) || a.order - b.order);
    const seen = new Map(), duplicateOf = { ...source.duplicateOf }, retained = new Set();
    for (const word of ordered) {
      const scope = duplicateScope === 'all' ? [] : duplicateScope === 'book' ? [word.book] : [word.book, word.unit];
      // Match exactly the three user-specified fields; never normalize or merge synonyms.
      const key = JSON.stringify([...scope, word.japanese, word.reading, word.meaning]);
      if (seen.has(key)) duplicateOf[word.id] = seen.get(key).id;
      else { seen.set(key, word); retained.add(word.id); }
    }
    const words = source.words.filter(word => retained.has(word.id));
    const bySpelling = new Map();
    // Reference only entries that still exist in the active vocabulary.
    for (const word of words) {
      if (!bySpelling.has(word.japanese)) bySpelling.set(word.japanese, []);
      bySpelling.get(word.japanese).push(word);
    }
    const previousAppearances = {};
    for (const word of words) {
      const earlier = bySpelling.get(word.japanese).filter(other => dayOf(source, other) < dayOf(source, word));
      const unique = new Map(earlier.map(other => [`${other.book}/${other.unit}`, { book: other.book, unit: other.unit }]));
      previousAppearances[word.id] = [...unique.values()].sort((a, b) => dayOf(source, a) - dayOf(source, b) || bookOrder.get(a.book) - bookOrder.get(b.book));
    }
    return { ...source, words, duplicateOf, previousAppearances };
  }
  return { prepare, dayOf };
});
