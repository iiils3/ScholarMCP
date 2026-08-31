import fs from 'node:fs';
const path='src/ScholarApp.tsx';
let s=fs.readFileSync(path,'utf8');
function must(oldText,newText,label){if(!s.includes(oldText)){console.error(`Missing patch target: ${label}`);process.exitCode=1;return}s=s.replace(oldText,newText)}

must(
"function pageFromRef(ref?:string){const n=Number(String(ref||'').match(/(?:ص|page)\\s*(\\d+)/i)?.[1]);return Number.isFinite(n)&&n>0?n:1}\nfunction speak",
"function pageFromRef(ref?:string){const n=Number(String(ref||'').match(/(?:ص|page)\\s*(\\d+)/i)?.[1]);return Number.isFinite(n)&&n>0?n:1}\nfunction materialFromRef(mats:Material[],ref?:string){const raw=String(ref||'');return mats.slice().sort((a,b)=>b.name.length-a.name.length).find(m=>raw.includes(m.name))||mats[0]}\nfunction speak",
'citation helper');

must("const context=()=>ready.map(m=>`SOURCE ${m.name}\\n${m.text}`).join('\\n\\n').slice(0,150000);const first=ready[0];","const context=()=>ready.map(m=>`SOURCE ${m.name}\\n${m.text}`).join('\\n\\n');const first=ready[0];",'course full context');
must("function openRef(ref?:string){if(first)openSource(first,pageFromRef(ref))}","function openRef(ref?:string){const m=materialFromRef(ready,ref);if(m)openSource(m,pageFromRef(ref))}",'course exact source');
must("const context=hits.map(h=>`SOURCE ${h.material} [[PAGE ${h.page}]]\\n${h.text}`).join('\\n\\n');","const context=hits.map(h=>`SOURCE ${h.material}\\n[[PAGE ${h.page}]]\\n${h.text}`).join('\\n\\n');",'chat source markers');
must("const context=()=>mats.map(m=>`SOURCE ${m.name}\\n${m.text}`).join('\\n\\n').slice(0,150000);","const context=()=>mats.map(m=>`SOURCE ${m.name}\\n${m.text}`).join('\\n\\n');",'study full context');
must("const openRef=(r?:string)=>mats[0]&&openSource(mats[0],pageFromRef(r));","const openRef=(r?:string)=>{const m=materialFromRef(mats,r);if(m)openSource(m,pageFromRef(r))};",'study exact source');
must("const context=mats.map(m=>`SOURCE ${m.name}\\n${m.text}`).join('\\n\\n').slice(0,150000);","const context=mats.map(m=>`SOURCE ${m.name}\\n${m.text}`).join('\\n\\n');",'assignment full context');

if(process.exitCode)process.exit(process.exitCode);
fs.writeFileSync(path,s);
console.log('ScholarApp grounding refactor applied.');
