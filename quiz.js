/* Stable question sets; only their display order changes between rounds. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Quiz = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const hiragana = text => text.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
  function distance(a, b) {
    let row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 0; i < a.length; i++) {
      const next = [i + 1];
      for (let j = 0; j < b.length; j++) next.push(Math.min(next[j] + 1, row[j + 1] + 1, row[j] + (a[i] !== b[j])));
      row = next;
    }
    return row[b.length];
  }
  function create(words) {
    const cache = new Map();
    function choices(word, type) {
      const key = `${type}/${word.id}`;
      if (!cache.has(key)) {
        const label = w => type === 'pronunciation' ? hiragana(w.reading) : w.japanese;
        const seen = new Set([label(word)]);
        const candidates = words.filter(w => w.id !== word.id && hiragana(w.reading) !== hiragana(word.reading) &&
          w.meaning !== word.meaning && (type !== 'kanji' || /\p{Script=Han}/u.test(w.japanese)))
          .map(w => ({ word: w, score: distance(hiragana(word.reading), hiragana(w.reading)) + (w.partOfSpeech === word.partOfSpeech ? 0 : .5) }))
          .sort((a, b) => a.score - b.score || a.word.id.localeCompare(b.word.id));
        const result = [word];
        for (const candidate of candidates) {
          const text = label(candidate.word);
          if (seen.has(text)) continue;
          seen.add(text); result.push(candidate.word);
          if (result.length === 4) break;
        }
        cache.set(key, result);
      }
      return cache.get(key).slice();
    }
    return { choices };
  }
  function shuffle(choices, random = Math.random) {
    const result = choices.slice();
    for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
    return result;
  }
  return { create, hiragana, shuffle };
});
