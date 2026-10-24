(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KanjiUI = api;
})(typeof window === 'object' ? window : globalThis, () => {
  const han = text => /\p{Script=Han}/u.test(text);
  const kana = text => text.normalize('NFKC').replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));

  function segments(word, readings = {}) {
    const explicit = readings[word.japanese];
    const chars = Array.from(word.japanese);
    if (explicit) {
      let index = 0;
      return chars.map(text => ({ text, reading: han(text) ? explicit[index++] : '', kanji: han(text) }));
    }
    const runs = word.japanese.match(/\p{Script=Han}+|[^\p{Script=Han}]+/gu) || [];
    const pronunciation = kana(word.reading), solutions = [];
    function align(index, offset, parts) {
      if (solutions.length > 1) return;
      if (index === runs.length) { if (offset === pronunciation.length) solutions.push(parts); return; }
      const text = runs[index];
      if (!han(text)) {
        if (pronunciation.startsWith(kana(text), offset)) align(index + 1, offset + kana(text).length, [...parts, { text, reading: '', kanji: false }]);
      } else {
        for (let end = offset + 1; end <= pronunciation.length; end++) {
          if (index + 1 === runs.length && end !== pronunciation.length) continue;
          align(index + 1, end, [...parts, { text, reading: word.reading.slice(offset, end), kanji: true }]);
        }
      }
    }
    align(0, 0, []);
    // Unknown compounds keep a shared ruby; never invent a character-level reading.
    return solutions.length === 1 ? solutions[0] : [{ text: word.japanese, reading: word.reading, kanji: han(word.japanese) }];
  }

  function overlaps(a, b, gap = 0) {
    return a.left < b.left + b.width + gap && a.left + a.width + gap > b.left && a.top < b.top + b.height + gap && a.top + a.height + gap > b.top;
  }
  function layout(anchors, word, viewport) {
    if (!anchors.length) return [];
    const margin = 10, gap = 14, minimumWidth = 150;
    const leftSpace = word.left - gap - margin;
    const rightSpace = viewport.width - margin - word.left - word.width - gap;
    if (Math.max(leftSpace, rightSpace) < minimumWidth) return null;
    const both = leftSpace >= minimumWidth && rightSpace >= minimumWidth;
    const leftCount = both ? Math.ceil(anchors.length / 2) : leftSpace >= minimumWidth ? anchors.length : 0;
    const groups = [anchors.slice(0, leftCount), anchors.slice(leftCount)];
    const largestColumn = Math.max(...groups.map(group => group.length));
    if ((viewport.height - margin * 2 - gap * (largestColumn - 1)) / largestColumn < 96) return null;
    const result = [];
    groups.forEach((group, side) => {
      if (!group.length) return;
      const width = Math.min(280, side === 0 ? leftSpace : rightSpace);
      const height = Math.floor(Math.min(240, (viewport.height - margin * 2 - gap * (group.length - 1)) / group.length));
      const total = height * group.length + gap * (group.length - 1);
      const centerY = group.reduce((sum, a) => sum + a.top + a.height / 2, 0) / group.length;
      const top = Math.max(margin, Math.min(centerY - total / 2, viewport.height - margin - total));
      const left = side === 0 ? word.left - gap - width : word.left + word.width + gap;
      group.forEach((_, i) => result.push({ left, top: top + i * (height + gap), width, height, side: side === 0 ? 'left' : 'right' }));
    });
    return result;
  }
  return { segments, layout, overlaps };
});
