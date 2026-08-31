import fs from 'node:fs';
import path from 'node:path';

let changed=0;
const appPath='src/ScholarApp.tsx';
let app=fs.readFileSync(appPath,'utf8');
const replacements=[
  ['Scholar Core • داخل المنصة','AI محلي • على جهازك'],
  ['القراءة الثقيلة والـOCR تتم سحابيًا حتى ما نرهق جهازك.','الـOCR وقراءة الصور تتم محليًا داخل المتصفح؛ أول تشغيل قد ينزّل نموذج القراءة مرة واحدة.'],
  ['Scholar AI يعالج المادة على السحابة…','Scholar AI يعالج المادة على جهازك…'],
  ['المعالجة تجري داخل ScholarMCP','المعالجة تجري على جهازك داخل ScholarMCP'],
  ['CLOUD-FIRST','LOCAL-FIRST'],
  ['المعالجة الثقيلة سحابية، وتقدمك يبقى تحت سيطرتك.','المعالجة الأكاديمية تعمل على جهازك، وتقدمك يبقى تحت سيطرتك.'],
  ['Scholar AI: معالجة سحابية بدون تنزيل نموذج على الموبايل','Scholar AI: Qwen محلي — أول تشغيل ينزّل النموذج مرة واحدة'],
  ['OCR: قراءة مطبوع وخط يدوي على السحابة','OCR: Granite + TrOCR محليان للمطبوع والخط اليدوي'],
  ['Lecture AI: تفريغ التسجيلات على السحابة','Lecture AI: Whisper محلي لتفريغ التسجيلات داخل جهازك'],
  ['GitHub: كود وبناء ونشر الواجهة','GitHub: المستودع والبناء ونشر واجهة ScholarMCP']
];
for(const [from,to] of replacements){if(app.includes(from)){app=app.replaceAll(from,to);changed++}}
fs.writeFileSync(appPath,app);

function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(dir,entry.name)):[path.join(dir,entry.name)])}
for(const file of walk('src').filter(p=>/\.(ts|tsx|js|jsx)$/.test(p)&&!p.endsWith('scholar-engine.ts')&&!p.endsWith('puter.ts'))){
  const before=fs.readFileSync(file,'utf8');
  const after=before.replaceAll("'./puter'","'./scholar-engine'").replaceAll('"./puter"','"./scholar-engine"');
  if(after!==before){fs.writeFileSync(file,after);changed++}
}
if(fs.existsSync('src/puter.ts')){fs.unlinkSync('src/puter.ts');changed++}
console.log(`ScholarMCP source migration complete (${changed} changes).`);
