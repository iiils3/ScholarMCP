import fs from 'node:fs';
const path='src/ScholarApp.tsx';
let s=fs.readFileSync(path,'utf8');
function must(oldText,newText,label){if(!s.includes(oldText)){console.error(`Missing patch target: ${label}`);process.exitCode=1;return}s=s.replace(oldText,newText)}

must("import SourceReader from './SourceReader';","import SourceReader from './SourceReader';\nimport LectureStudio from './LectureStudio';",'lecture import');
must("const [videos,setVideos]=useState(false);const input=useRef<HTMLInputElement>(null);","const [videos,setVideos]=useState(false);const [lecture,setLecture]=useState(false);const input=useRef<HTMLInputElement>(null);",'lecture state');
must("<button onClick={()=>generate('package')}><Presentation/> حقيبة أكاديمية</button><button onClick={()=>setVideos(true)}><Youtube/> فيديوهات داخل المنصة</button>","<button onClick={()=>generate('package')}><Presentation/> حقيبة أكاديمية</button><button onClick={()=>setLecture(true)}><Volume2/> ذكاء المحاضرة</button><button onClick={()=>setVideos(true)}><Youtube/> فيديوهات داخل المنصة</button>",'lecture button');
must("{cardsOpen&&<FlashcardsModal course={course} cards={state.flashcards.filter(c=>c.courseId===course.id)} onClose={()=>setCardsOpen(false)} notify={notify}/>} {videos&&<VideoModal", "{cardsOpen&&<FlashcardsModal course={course} cards={state.flashcards.filter(c=>c.courseId===course.id)} onClose={()=>setCardsOpen(false)} notify={notify}/>} {lecture&&<LectureStudio courseId={course.id} courseName={course.name} onClose={()=>setLecture(false)} notify={notify}/>} {videos&&<VideoModal",'lecture modal');
must("<span className=\"local-pill\"><ShieldCheck/> محلي أولاً</span>","<span className=\"local-pill\"><ShieldCheck/> AI سحابي • المصدر عندك</span>",'top cloud badge');
must("Scholar AI يشتغل محليًا على المادة…","Scholar AI يعالج المادة على السحابة…",'cloud loader');
must("PDF / Word / PowerPoint / صور / خط يدوي. الملف الأصلي يبقى محفوظًا محليًا.","PDF / Word / PowerPoint / صور / خط يدوي. القراءة الثقيلة والـOCR تتم سحابيًا حتى ما نرهق جهازك.",'source cloud text');
must("<Head eyebrow=\"LOCAL-FIRST\" title=\"الإعدادات\" text=\"ملفاتك ودراستك تحت سيطرتك.\"/>","<Head eyebrow=\"CLOUD-FIRST\" title=\"الإعدادات\" text=\"المعالجة الثقيلة سحابية، وتقدمك يبقى تحت سيطرتك.\"/>",'settings title');
must("<div className=\"infra ok\">Scholar AI: Qwen3 يعمل داخل المتصفح</div><div className=\"infra ok\">OCR: Granite Docling + TrOCR داخل المتصفح</div><div className=\"infra ok\">FSRS: مراجعة علمية محلية</div><div className=\"infra ok\">GitHub: كود وبناء ونشر فقط</div>","<div className=\"infra ok\">Scholar AI: معالجة سحابية بدون تنزيل نموذج على الموبايل</div><div className=\"infra ok\">OCR: قراءة مطبوع وخط يدوي على السحابة</div><div className=\"infra ok\">Lecture AI: تفريغ التسجيلات على السحابة</div><div className=\"infra ok\">FSRS: مراجعة علمية سريعة على الجهاز</div><div className=\"infra ok\">GitHub: كود وبناء ونشر الواجهة</div>",'settings engines');

if(process.exitCode)process.exit(process.exitCode);
fs.writeFileSync(path,s);
console.log('ScholarApp cloud + lecture patch applied.');
