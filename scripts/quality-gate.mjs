import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const exists=p=>fs.existsSync(p);
const failures=[];
function check(ok,msg){if(!ok)failures.push(msg)}
const index=read('index.html');
const puter=read('src/puter.ts');
const app=read('src/ScholarApp.tsx');
const parser=read('src/parser.ts');
const academic=exists('src/AcademicHub.tsx')?read('src/AcademicHub.tsx'):'';
const lecture=exists('src/LectureStudio.tsx')?read('src/LectureStudio.tsx'):'';
const seminar=exists('src/SeminarStudio.tsx')?read('src/SeminarStudio.tsx'):'';
const exam=exists('src/ExamDNAStudio.tsx')?read('src/ExamDNAStudio.tsx'):'';
const feed=exists('src/SmartFeed.tsx')?read('src/SmartFeed.tsx'):'';
const day=exists('src/ScholarDay.tsx')?read('src/ScholarDay.tsx'):'';

check(index.includes('https://js.puter.com/v2/'),'Cloud AI runtime is missing from index.html');
check(puter.includes('img2txt'),'Cloud OCR bridge is missing');
check(puter.includes('speech2txt'),'Cloud lecture transcription bridge is missing');
check(puter.includes('txt2speech'),'Cloud TTS bridge is missing');
check(puter.includes('txt2vid'),'Cloud study-video bridge is missing');
check(!puter.includes("from './local-ai'"),'AI bridge still imports the on-device LLM');
check(!puter.includes("from './local-ocr'"),'AI bridge still imports the on-device OCR');
check(parser.includes("ext==='pdf'")&&parser.includes('ocrSource'),'PDF + OCR ingestion path missing');
check(app.includes("view==='today'"),'Today route missing');
check(app.includes("view==='courses'"),'Courses route missing');
check(app.includes("view==='study'"),'Study route missing');
check(app.includes("view==='assignments'"),'Assignments route missing');
check(app.includes("view==='academic'"),'Academic OS route missing');
check(app.includes("view==='research'"),'Research route missing');
check(app.includes('CourseChat'),'Source-grounded course chat missing');
check(app.includes('QuizModal'),'Quiz UI missing');
check(app.includes('FlashcardsModal'),'Flashcard review UI missing');
check(app.includes('LectureStudio'),'Lecture Intelligence is not wired into Course Brain');
check(app.includes('AcademicHub'),'Academic Hub is not wired into navigation');
check(app.includes('ScholarDay'),'Scholar Day is not wired into Today');
check(academic.includes('SyllabusMagic'),'Syllabus Magic missing');
check(academic.includes('GradePlanner'),'Grade planner missing');
check(academic.includes('SeminarStudio'),'Seminar Studio missing from Academic Hub');
check(academic.includes('ExamDNAStudio'),'Exam DNA missing from Academic Hub');
check(academic.includes('SmartFeed'),'Smart Feed missing from Academic Hub');
check(lecture.includes('speechToText')&&lecture.includes('MediaRecorder'),'Lecture record/transcribe path incomplete');
check(seminar.includes('exportPptx')&&seminar.includes('buildSeminarRehearsal'),'Seminar export/rehearsal path incomplete');
check(exam.includes('analyzeExamDNA'),'Exam DNA analysis path incomplete');
check(feed.includes('reviewFSRS'),'Smart Feed is not tied to spaced repetition');
check(day.includes('riskScore')&&day.includes('dueDate'),'Scholar Day is not adaptive to risk/reviews');

if(failures.length){console.error('\nScholarMCP quality gate FAILED:\n- '+failures.join('\n- '));process.exit(1)}
console.log('ScholarMCP quality gate passed: cloud runtime, ingestion, Course Brain, study, lecture, Academic OS, seminar, Exam DNA, Smart Feed and Scholar Day are wired.');
