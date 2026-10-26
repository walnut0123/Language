const {test}=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {prepare}=require('../vocabulary.js');
function load(file){const c={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../data/'+file),'utf8'),c);return c.window.VOCABULARY;}
test('keeps all occurrences and flags same-day, future and other-book duplicates symmetrically',()=>{
 const word=(id,extra={})=>({id,book:'main',unit:'day-01',order:1,japanese:'同じ',reading:'おなじ',meaning:'같다',...extra});
 const source={books:[{id:'main',units:[]},{id:'check',units:[]}],words:[word('a'),word('b',{order:2}),word('c',{unit:'day-02'}),word('d',{book:'check',meaning:'동일하다'})],duplicateOf:{b:'a'}};
 const before=JSON.stringify(source),data=prepare(source);
 assert.deepEqual(data.words,source.words);assert.deepEqual(data.duplicateOf,{});assert.equal(JSON.stringify(source),before);
 assert.equal(data.duplicateOccurrences.a.length,3);
 assert.equal(data.duplicateOccurrences.a.find(w=>w.id==='b').exact,true);
 assert.equal(data.duplicateOccurrences.a.find(w=>w.id==='d').exact,false);
 assert.ok(data.duplicateOccurrences.b.some(w=>w.id==='a'));
 assert.deepEqual(data.previousAppearances.a,[]);
 assert.equal(data.previousAppearances.c.length,2);
});
test('published data preserves every source ID, field, order and repeated item across all DAYs',()=>{
 const source=load('source-words.js'),published=load('words.js'),data=prepare(source);
 assert.equal(source.words.length,4785);assert.equal(data.words.length,4785);
 assert.equal(JSON.stringify(published.words),JSON.stringify(source.words));
 assert.equal(Object.keys(published.duplicateOf).length,0);
 for(const [book,count] of [['main',2409],['check',2376]])assert.equal(data.words.filter(w=>w.book===book).length,count);
 for(const [day,count] of [[1,87],[2,80],[3,80]])assert.equal(data.words.filter(w=>w.book==='main'&&Number(w.unit.slice(4))===day).length,count);
 const d3=data.words.filter(w=>w.book==='main'&&w.unit==='day-03');
 assert.ok(d3.some(w=>w.order===3&&w.japanese==='一般的だ'));
 for(const w of data.words)for(const other of data.duplicateOccurrences[w.id]||[])assert.ok(data.duplicateOccurrences[other.id].some(o=>o.id===w.id));
});
