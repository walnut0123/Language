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
  function prepare(source) {
    const bookOrder = new Map(source.books.map((book, index) => [book.id, index]));
    // Every printed occurrence is a separate learning item, including repeats
    // in the same DAY. Duplicate metadata is informational and never filters IDs.
    const words = [...source.words];
    const bySpelling = new Map();
    // Reference only entries that still exist in the active vocabulary.
    for (const word of words) {
      if (!bySpelling.has(word.japanese)) bySpelling.set(word.japanese, []);
      bySpelling.get(word.japanese).push(word);
    }
    const previousAppearances = {}, duplicateOccurrences = {};
    for (const word of words) {
      const earlier = bySpelling.get(word.japanese).filter(other => dayOf(source, other) < dayOf(source, word));
      const unique = new Map(earlier.map(other => [`${other.book}/${other.unit}`, { book: other.book, unit: other.unit }]));
      previousAppearances[word.id] = [...unique.values()].sort((a, b) => dayOf(source, a) - dayOf(source, b) || bookOrder.get(a.book) - bookOrder.get(b.book));
      const others = bySpelling.get(word.japanese).filter(other => other.id !== word.id).sort((a,b) => dayOf(source,a)-dayOf(source,b) || bookOrder.get(a.book)-bookOrder.get(b.book) || a.order-b.order);
      if (others.length) duplicateOccurrences[word.id] = others.map(other => ({ id: other.id, book: other.book, unit: other.unit, order: other.order,
        exact: other.reading === word.reading && other.meaning === word.meaning }));
    }
    return { ...source, words, duplicateOf: {}, previousAppearances, duplicateOccurrences };
  }
  return { prepare, dayOf };
});
