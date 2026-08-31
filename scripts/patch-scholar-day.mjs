import fs from 'node:fs';
const path='src/ScholarApp.tsx';
let s=fs.readFileSync(path,'utf8');
function must(oldText,newText,label){if(!s.includes(oldText)){console.error(`Missing patch target: ${label}`);process.exitCode=1;return}s=s.replace(oldText,newText)}
must("{art.type==='translation'&&<pre className=\"source-text\">{d.text}</pre>}","{art.type==='translation'&&<div><div className=\"export-inline\" style={{marginBottom:10}}><button className=\"ghost\" onClick={()=>exportDocx(art.title,d.text||'')}><Download/> تنزيل ملف الترجمة Word</button></div><pre className=\"source-text\">{d.text}</pre></div>}",'translation export');
must("{typeof p.progress==='number'?`${Math.round(p.progress*100)}%`:'أول تشغيل قد يحتاج تنزيل النموذج مرة واحدة'}","{typeof p.progress==='number'?`${Math.round(p.progress*100)}%`:'المعالجة تجري داخل ScholarMCP'}",'engine progress label');
must("<span className=\"local-pill\"><ShieldCheck/> AI سحابي • المصدر عندك</span>","<span className=\"local-pill\"><ShieldCheck/> Scholar Core • داخل المنصة</span>",'topbar internal core label');
if(process.exitCode)process.exit(process.exitCode);
fs.writeFileSync(path,s);
console.log('ScholarMCP finishing patch applied.');
