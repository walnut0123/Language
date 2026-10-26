const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),folder=process.argv[2]||'C:/Users/walnut47/Desktop/유하다요 N3';
function load(name){const c={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'data',name),'utf8'),c);return c.window.VOCABULARY;}
const source=load('source-words.js'),published=load('words.js');
assert.equal(JSON.stringify(source.words),JSON.stringify(published.words));
const main=require('../data/mainbook-photo-report.json'),transcript=require('../data/mainbook-photos.json'),check=require('../data/import-report.json');
const inventory={};
for(const [book,dir,expected] of [['main','메인북 단어장',59],['check','체크북 D-30 단어장',60]]){
 const names=fs.readdirSync(path.join(folder,dir)).filter(n=>/\.(jpg|jpeg|png)$/i.test(n)).sort();assert.equal(names.length,expected);
 inventory[book]=names.map(name=>({name,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(folder,dir,name))).digest('hex')}));
}
for(let i=0;i<59;i++){
 assert.equal(inventory.main[i].name,main.photos[i].name);
 const entries=source.words.filter(w=>w.book==='main'&&w.sourcePhoto===i).sort((a,b)=>a.sourcePageOrder-b.sourcePageOrder);
 const original=transcript.entries.filter(w=>w.photo===i);
 assert.equal(entries.length,main.photos[i].entries);
 assert.deepEqual(Array.from(entries,w=>w.japanese),original.map(w=>w.japanese));
}
const days=[];
for(const [book,expected] of [['main',Object.entries(main.days).map(([day,count])=>({day:Number(day),count}))],['check',check.days.map(d=>({day:d.day,count:d.expected}))]])for(const d of expected){
 const ws=source.words.filter(w=>w.book===book&&Number(w.unit.slice(4))===d.day).sort((a,b)=>a.order-b.order);
 assert.equal(ws.length,d.count);assert.deepEqual(Array.from(ws,w=>w.order),Array.from({length:d.count},(_,i)=>i+1));
 days.push({book,day:d.day,sourceCount:ws.length,publishedCount:ws.length,first:ws[0].japanese,last:ws.at(-1).japanese,photos:book==='main'?[...new Set(ws.map(w=>w.sourceImage))]:inventory.check.slice((d.day-1)*2,d.day*2).map(p=>p.name)});
}
const report={reviewDate:'2026-10-26',scope:'Photographed printed headwords, DAY assignment, sequence and counts; handwriting ignored. Mainbook photo transcription and checkbook photo headword comparison. This is not a fresh independent transcription of every reading/meaning.',photoCount:119,sourceCount:source.words.length,publishedCount:published.words.length,omittedIDs:[],days,inventory};
fs.writeFileSync(path.join(root,'data/photo-review-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(`Verified ${days.length} DAYs, 119 photos, ${published.words.length} occurrences; omitted 0.`);
