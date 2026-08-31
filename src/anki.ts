import type { Flashcard } from './lib';

function save(bytes:Uint8Array,name:string){const blob=new Blob([bytes as BlobPart],{type:'application/octet-stream'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}
function safe(v:string){return v.replace(/[\\/:*?"<>|]+/g,'-').slice(0,90)||'ScholarMCP'}

export async function exportAnki(deckName:string,cards:Flashcard[]){
  if(!cards.length)throw new Error('لا توجد بطاقات لتصديرها.');
  const [{default:initSqlJs},anki,wasmUrl]=await Promise.all([import('sql.js'),import('ankipack'),import('sql.js/dist/sql-wasm.wasm?url')]);
  const SQL=await initSqlJs({locateFile:()=>wasmUrl.default});
  const {Package,Deck,DeckConfig,Notetype,Note}=anki as any;
  const notetype=Notetype.basic({name:'ScholarMCP Basic'});
  const deck=new Deck({name:deckName,description:'Generated inside ScholarMCP',config:new DeckConfig({name:'ScholarMCP FSRS',desiredRetention:.9,newPerDay:40})});
  for(const c of cards)deck.addNote(new Note({notetype,fields:[c.front,`${c.back}${c.sourceRef?`<hr><small>${c.sourceRef}</small>`:''}`],tags:['ScholarMCP',c.topic||'study']}));
  const pkg=new Package();pkg.addDeck(deck);const bytes:Uint8Array=await pkg.toUint8Array(SQL);save(bytes,`${safe(deckName)}.apkg`);return cards.length;
}
