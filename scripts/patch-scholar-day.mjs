import fs from 'node:fs';
const path='src/ScholarApp.tsx';
let s=fs.readFileSync(path,'utf8');
let changed=0;
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
for(const [from,to] of replacements){if(s.includes(from)){s=s.replaceAll(from,to);changed++}}
if(changed){fs.writeFileSync(path,s);console.log(`ScholarMCP local-engine UI patch applied (${changed} replacements).`)}else console.log('ScholarMCP UI already reflects local engines.');
