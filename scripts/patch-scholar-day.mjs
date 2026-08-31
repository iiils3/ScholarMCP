import fs from 'node:fs';
const path='src/ScholarApp.tsx';
let s=fs.readFileSync(path,'utf8');
function must(oldText,newText,label){if(!s.includes(oldText)){console.error(`Missing patch target: ${label}`);process.exitCode=1;return}s=s.replace(oldText,newText)}
must("import AcademicHub from './AcademicHub';","import AcademicHub from './AcademicHub';\nimport ScholarDay from './ScholarDay';",'ScholarDay import');
must("<p>نبدأ بما يرفع درجتك، مو بما يملأ وقتك.</p></div>{risk?","<p>نبدأ بما يرفع درجتك، مو بما يملأ وقتك.</p></div><ScholarDay state={state} openCourse={openCourse} openStudy={openStudy} go={go}/>{risk?",'ScholarDay renderer');
if(process.exitCode)process.exit(process.exitCode);
fs.writeFileSync(path,s);
console.log('Scholar Day wired into Today.');
