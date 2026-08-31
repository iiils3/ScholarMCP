import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const failures=[];
function check(ok,msg){if(!ok)failures.push(msg)}
const index=read('index.html');
const puter=read('src/puter.ts');
const app=read('src/ScholarApp.tsx');
check(index.includes('https://js.puter.com/v2/'),'Puter cloud runtime is missing from index.html');
check(puter.includes('img2txt'),'Cloud OCR bridge is missing');
check(puter.includes('speech2txt'),'Cloud lecture transcription bridge is missing');
check(!puter.includes("from './local-ai'"),'AI bridge still imports the on-device LLM');
check(!puter.includes("from './local-ocr'"),'AI bridge still imports the on-device OCR');
check(app.includes("view==='today'"),'Today route missing');
check(app.includes("view==='courses'"),'Courses route missing');
check(app.includes("view==='study'"),'Study route missing');
check(app.includes("view==='assignments'"),'Assignments route missing');
check(app.includes("view==='research'"),'Research route missing');
check(app.includes('CourseChat'),'Source-grounded course chat missing');
check(app.includes('QuizModal'),'Quiz UI missing');
check(app.includes('FlashcardsModal'),'Flashcard review UI missing');
if(failures.length){console.error('\nScholarMCP quality gate FAILED:\n- '+failures.join('\n- '));process.exit(1)}
console.log('ScholarMCP quality gate passed. Core study paths and cloud runtime are present.');
