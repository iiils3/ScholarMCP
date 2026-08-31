import fs from 'node:fs';
const path='src/ScholarApp.tsx';
let s=fs.readFileSync(path,'utf8');
function must(oldText,newText,label){if(!s.includes(oldText)){console.error(`Missing patch target: ${label}`);process.exitCode=1;return}s=s.replace(oldText,newText)}

must("import LectureStudio from './LectureStudio';","import LectureStudio from './LectureStudio';\nimport AcademicHub from './AcademicHub';",'academic hub import');
must("type View='today'|'courses'|'course'|'study'|'assignments'|'research'|'library'|'calendar'|'settings';","type View='today'|'courses'|'course'|'study'|'assignments'|'academic'|'research'|'library'|'calendar'|'settings';",'academic route type');
must("['assignments','الواجبات',ClipboardList],['research','البحث',Search]","['assignments','الواجبات',ClipboardList],['academic','الأكاديمية',GraduationCap],['research','البحث',Search]",'academic nav item');
must("{view==='assignments'&&<Assignments state={state} notify={notify}/>} {view==='research'&&<Research/>}","{view==='assignments'&&<Assignments state={state} notify={notify}/>} {view==='academic'&&<AcademicHub state={state} notify={notify}/>} {view==='research'&&<Research/>}",'academic view renderer');

if(process.exitCode)process.exit(process.exitCode);
fs.writeFileSync(path,s);
console.log('ScholarApp Academic OS navigation patch applied.');
