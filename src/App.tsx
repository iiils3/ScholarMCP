import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen, Brain, CalendarDays, CheckCircle2, CircleAlert, Download, ExternalLink,
  FileText, GraduationCap, Languages, Library, LoaderCircle, Menu, MessageSquareText,
  Plus, Search, Settings, Sparkles, Trash2, Upload, X, Youtube, ClipboardList, Home,
  Eye, Presentation, ThumbsUp, GitBranch, FileQuestion
} from 'lucide-react';
import {
  type AppState, type Course, type Material, type Artifact,
  LocalRepository, parseFile, humanSize, fmtDate, daysUntil, courseMastery, riskScore,
  weakest, retrieve, aiTask, researchCrossref, youtubeUrl, exportDocx, exportPptx
} from './lib';

type View='today'|'courses'|'course'|'study'|'assignments'|'research'|'library'|'calendar'|'settings';
type CourseTab='overview'|'topics'|'sources'|'performance';
const repo=new LocalRepository();
const nav:[View,string,React.ComponentType][]=[
  ['today','اليوم',Home],['courses','موادي',BookOpen],['study','الدراسة',Brain],
  ['assignments','الواجبات',ClipboardList],['research','البحث',Search],['library','مكتبتي',Library],
  ['calendar','جدولي',CalendarDays],['settings','الإعدادات',Settings]
];

function useData(){
  const [state,setState]=useState<AppState>(structuredClone(repo.state));
  useEffect(()=>{const refresh=()=>setState(structuredClone(repo.state));window.addEventListener('scholar-state',refresh);return()=>window.removeEventListener('scholar-state',refresh)},[]);
  return state;
}

export default function App(){
  const state=useData();
  const [view,setView]=useState<View>('today');
  const [courseId,setCourseId]=useState<string>();
  const [drawer,setDrawer]=useState(false);
  const [lens,setLens]=useState<Material|null>(null);
  const [toast,setToast]=useState('');
  const active=state.courses.find(c=>c.id===courseId)||null;
  const notify=(m:string)=>{setToast(m);window.setTimeout(()=>setToast(''),2600)};
  const go=(v:View)=>{setView(v);setDrawer(false)};
  const openCourse=(c:Course)=>{setCourseId(c.id);setView('course')};
  if(!state.profile.onboarded)return <Onboarding/>;
  return <div className="app-shell" dir="rtl">
    <Sidebar state={state} view={view} go={go} drawer={drawer} setDrawer={setDrawer}/>
    <MobileNav view={view} go={go} setDrawer={setDrawer}/>
    <main><Topbar setDrawer={setDrawer}/><div className="content">
      {view==='today'&&<Today state={state} openCourse={openCourse} go={go}/>} 
      {view==='courses'&&<Courses state={state} openCourse={openCourse} notify={notify}/>} 
      {view==='course'&&active&&<CourseWorkspace state={state} course={active} openLens={setLens} go={go} notify={notify}/>} 
      {view==='course'&&!active&&<Empty title="اختر مادة أولًا" icon={BookOpen}/>} 
      {view==='study'&&<Study state={state} notify={notify}/>} 
      {view==='assignments'&&<Assignments state={state} notify={notify}/>} 
      {view==='research'&&<Research/>} 
      {view==='library'&&<LibraryView state={state} openLens={setLens} openCourse={openCourse}/>} 
      {view==='calendar'&&<CalendarView state={state}/>} 
      {view==='settings'&&<SettingsView state={state}/>} 
    </div></main>
    {lens&&<SourceLens material={lens} onClose={()=>setLens(null)}/>} 
    {toast&&<div className="toast"><CheckCircle2/>{toast}</div>}
  </div>;
}

function Onboarding(){
  const [name,setName]=useState('');const [major,setMajor]=useState('');const [lang,setLang]=useState<'ar'|'en'>('ar');
  return <div className="onboard"><div className="brand-large"><div className="logo"><GraduationCap/></div><b>Scholar<span>MCP</span></b></div><div className="onboard-card"><span className="eyebrow">ACADEMIC OS</span><h1>من أول محاضرة إلى آخر امتحان.</h1><p className="muted">رتّب موادك ومصادرك ودراستك في عقل أكاديمي واحد.</p><label>اسمك<input value={name} onChange={e=>setName(e.target.value)} placeholder="مثال: أحمد"/></label><label>التخصص — اختياري<input value={major} onChange={e=>setMajor(e.target.value)} placeholder="الأدلة الجنائية"/></label><label>لغة الدراسة<select value={lang} onChange={e=>setLang(e.target.value as 'ar'|'en')}><option value="ar">العربية</option><option value="en">English</option></select></label><button className="primary wide" disabled={!name.trim()} onClick={()=>repo.setProfile({name:name.trim(),major:major.trim()||undefined,studyLanguage:lang,onboarded:true})}>ابدأ منصتي</button></div></div>;
}

function Sidebar({state,view,go,drawer,setDrawer}:{state:AppState;view:View;go:(v:View)=>void;drawer:boolean;setDrawer:(x:boolean)=>void}){
  return <><aside className={`sidebar ${drawer?'open':''}`}><div className="brand"><div className="logo"><GraduationCap/></div><div><b>Scholar<span>MCP</span></b><small>نظامك الأكاديمي الذكي</small></div></div><nav>{nav.map(([id,label,I])=><button key={id} className={view===id?'active':''} onClick={()=>go(id)}><I/><span>{label}</span></button>)}</nav><div className="side-profile"><div className="avatar">{state.profile.name.slice(0,1)||'ط'}</div><div><b>{state.profile.name}</b><small>{state.profile.major||'طالب جامعي'}</small></div></div></aside>{drawer&&<div className="overlay" onClick={()=>setDrawer(false)}/>}</>;
}
function MobileNav({view,go,setDrawer}:{view:View;go:(v:View)=>void;setDrawer:(x:boolean)=>void}){return <nav className="mobile-nav">{nav.slice(0,5).map(([id,label,I])=><button key={id} className={view===id?'active':''} onClick={()=>go(id)}><I/><span>{label}</span></button>)}<button onClick={()=>setDrawer(true)}><Menu/><span>المزيد</span></button></nav>}
function Topbar({setDrawer}:{setDrawer:(x:boolean)=>void}){return <header className="top-search"><button className="menu" onClick={()=>setDrawer(true)}><Menu/></button><Search/><input placeholder="ابحث داخل ScholarMCP..."/><span className="muted">نسخة GitHub</span></header>}

function Today({state,openCourse,go}:{state:AppState;openCourse:(c:Course)=>void;go:(v:View)=>void}){
  const risk=state.courses.slice().sort((a,b)=>riskScore(state,b)-riskScore(state,a))[0];
  const weak=risk?weakest(state,risk.id):[];
  const due=state.flashcards.filter(f=>new Date(f.dueAt).getTime()<=Date.now()).length;
  const deadlines=state.deadlines.filter(d=>!d.done).slice().sort((a,b)=>+new Date(a.dueAt)-+new Date(b.dueAt)).slice(0,4);
  return <section><div className="welcome"><span className="eyebrow">TODAY</span><h1>هلا {state.profile.name} 👋</h1><p>اليوم ما نعرض لك عشرين أداة؛ نعرض الخطوة اللي إلها أعلى عائد.</p></div>{risk?<><div className="hero-course"><div className="hero-copy"><span className="eyebrow">الأولوية الحالية</span><h2>{risk.name}</h2><span className="badge-risk">مؤشر الخطر {riskScore(state,risk)}%</span><div className="mastery-bar"><span style={{width:`${courseMastery(state,risk.id)}%`}}/></div><p>الإتقان {courseMastery(state,risk.id)}% • {risk.examDate?`باقي ${Math.max(0,daysUntil(risk.examDate)||0)} يوم`:'لا يوجد موعد امتحان'}</p><button className="primary" onClick={()=>openCourse(risk)}><Brain/> ادرس الآن</button></div><div className="weak-card"><b>نقاط تحتاج تركيز</b>{weak.length?weak.map(t=><p key={t.id}>{t.title} — {t.mastery}%</p>):<p>ابدأ باختبار حتى نكتشف نقاط ضعفك.</p>}</div></div><div className="today-grid"><div className="metric"><b>{due}</b><small>بطاقات مستحقة</small></div><div className="metric"><b>{state.materials.length}</b><small>مصادر مرفوعة</small></div><div className="metric"><b>{state.assignments.length}</b><small>واجبات محفوظة</small></div></div><div className="panel"><div className="section-head"><div><h3>القادم</h3><p>امتحانات وتسليمات مرتبة حسب القرب.</p></div><button className="ghost" onClick={()=>go('calendar')}>فتح الجدول</button></div><div className="deadline-list">{deadlines.length?deadlines.map(d=><div key={d.id}><CalendarDays/><div><b>{d.title}</b><small>{fmtDate(d.dueAt)}</small></div></div>):<p className="muted">ماكو مواعيد محفوظة بعد.</p>}</div></div></>:<Empty title="أضف أول مادة" text="ScholarMCP يبدأ من المادة، مو من مربع Chat." icon={BookOpen} action={()=>go('courses')} actionLabel="إضافة مادة"/>}</section>;
}

function Courses({state,openCourse,notify}:{state:AppState;openCourse:(c:Course)=>void;notify:(m:string)=>void}){
  const [name,setName]=useState('');const [exam,setExam]=useState('');const [q,setQ]=useState('');
  const list=state.courses.filter(c=>c.name.toLowerCase().includes(q.toLowerCase()));
  function add(){if(!name.trim())return;repo.addCourse(name.trim(),exam||undefined);setName('');setExam('');notify('تم إنشاء المادة')}
  return <section><div className="section-head page"><div><span className="eyebrow">COURSE BRAINS</span><h1>موادي</h1><p>كل مادة عقل مستقل يجمع ملفاتها وأداءك داخلها.</p></div></div><div className="new-course"><input value={name} onChange={e=>setName(e.target.value)} placeholder="اسم المادة"/><input type="date" value={exam} onChange={e=>setExam(e.target.value)}/><button className="primary" onClick={add}><Plus/> إضافة مادة</button></div><div className="filter"><input value={q} onChange={e=>setQ(e.target.value)} placeholder="بحث بالمواد..."/></div><div className="course-grid">{list.map(c=><article className="course-card" key={c.id}><button className="course-icon" onClick={()=>openCourse(c)}><BookOpen/></button><button className="course-main" onClick={()=>openCourse(c)}><h3>{c.name}</h3><p>{c.examDate?fmtDate(c.examDate):'بدون موعد امتحان'}</p><div className="mini-progress"><span style={{width:`${courseMastery(state,c.id)}%`}}/></div></button><button className="danger" onClick={()=>confirm(`حذف ${c.name} وكل بياناتها؟`)&&repo.deleteCourse(c.id)}><Trash2/></button></article>)}</div>{!list.length&&<Empty title="ماكو مواد مطابقة" icon={BookOpen}/>}</section>;
}

function CourseWorkspace({state,course,openLens,go,notify}:{state:AppState;course:Course;openLens:(m:Material)=>void;go:(v:View)=>void;notify:(m:string)=>void}){
  const mats=state.materials.filter(m=>m.courseId===course.id);
  const topics=state.topics.filter(t=>t.courseId===course.id);
  const artifacts=state.artifacts.filter(a=>a.courseId===course.id);
  const cards=state.flashcards.filter(f=>f.courseId===course.id);
  const [tab,setTab]=useState<CourseTab>('overview');
  const [busy,setBusy]=useState('');
  const [quiz,setQuiz]=useState<any[]>([]);
  const [artifact,setArtifact]=useState<Artifact|null>(null);
  const inputRef=useRef<HTMLInputElement>(null);
  const ready=mats.filter(m=>m.status==='ready'&&m.text.trim());
  const context=()=>ready.map(m=>`SOURCE ${m.name}\n${m.text}`).join('\n\n').slice(0,120000);
  async function upload(files:FileList|null){if(!files)return;for(const file of [...files]){setBusy('upload');const parsed=await parseFile(file);repo.addMaterial({courseId:course.id,name:file.name,mime:file.type,ext:file.name.split('.').pop()?.toLowerCase()||'',size:file.size,pages:parsed.pages,status:parsed.text?'ready':'failed',error:parsed.error,text:parsed.text});notify(parsed.error?`تمت القراءة مع ملاحظة: ${parsed.error}`:`تمت إضافة ${file.name}`)}setBusy('')}
  async function generate(type:'summary'|'translation'|'mindmap'|'flashcards'|'quiz'|'package'){
    if(!ready.length){notify('ارفع مصدرًا قابلًا للقراءة أولًا');return}
    setBusy(type);try{
      const ctx=context();
      if(type==='summary'){const d=await aiTask('summary',{context:ctx});const a=repo.addArtifact({courseId:course.id,type:'summary',title:`ملخص ${course.name}`,truth:'supported',coverage:d.estimatedCoverage,data:d});repo.upsertTopics(course.id,(d.keyConcepts||[]).map((x:any)=>({title:x.title,sourceRef:x.sourceRef})));setArtifact(a)}
      if(type==='translation'){const d=await aiTask('translate',{context:ctx,target:state.profile.studyLanguage==='ar'?'العربية':'English'});setArtifact(repo.addArtifact({courseId:course.id,type:'translation',title:`ترجمة ${course.name}`,truth:'inferred',data:d}))}
      if(type==='mindmap'){const d=await aiTask('mindmap',{context:ctx});setArtifact(repo.addArtifact({courseId:course.id,type:'mindmap',title:`خريطة ${course.name}`,truth:'supported',data:d}))}
      if(type==='flashcards'){const d=await aiTask('flashcards',{context:ctx,count:12});repo.addFlashcards(course.id,d.cards||[]);notify('تم إنشاء بطاقات المراجعة')}
      if(type==='quiz'){const d=await aiTask('quiz',{context:ctx,count:8});setQuiz(d.questions||[])}
      if(type==='package'){const d=await aiTask('package',{context:ctx,topic:course.name});setArtifact(repo.addArtifact({courseId:course.id,type:'package',title:`الحقيبة الأكاديمية — ${course.name}`,truth:'supported',data:d}))}
    }finally{setBusy('')}
  }
  return <section><div className="course-hero"><div><span className="eyebrow">COURSE BRAIN</span><h1>{course.name}</h1><p>{course.examDate?`الامتحان ${fmtDate(course.examDate)} • ${Math.max(0,daysUntil(course.examDate)||0)} يوم متبقي`:'لم تحدد موعد الامتحان'}</p></div><div className="score-ring" style={{'--score':`${courseMastery(state,course.id)}%`} as React.CSSProperties}><span>{courseMastery(state,course.id)}%</span></div></div>
  <div className="action-grid"><button onClick={()=>go('study')}><Brain/> ادرس الآن</button><button onClick={()=>generate('quiz')}><FileQuestion/> اختبرني</button><button onClick={()=>generate('summary')}><Sparkles/> ملخص ذكي</button><button onClick={()=>generate('translation')}><Languages/> ترجمة</button></div>
  <div className="tabs">{([['overview','نظرة عامة'],['topics','المفاهيم'],['sources','المصادر'],['performance','الأداء']] as [CourseTab,string][]).map(([id,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}</button>)}</div>
  {tab==='overview'&&<><div className="panel"><div className="section-head"><div><h3>أنشئ من المادة</h3><p>الأدوات تظهر داخل سياق المادة بدل ازدحام القائمة الرئيسية.</p></div></div><div className="studio-grid"><button onClick={()=>generate('flashcards')}><ClipboardList/> بطاقات مراجعة</button><button onClick={()=>generate('mindmap')}><GitBranch/> خريطة ذهنية</button><button onClick={()=>generate('package')}><Presentation/> حقيبة أكاديمية</button><a className="ghost" href={youtubeUrl(course.name)} target="_blank" rel="noreferrer"><Youtube/> شرح على YouTube</a></div></div><CourseChat course={course} materials={ready}/><div className="panel"><h3>آخر المخرجات</h3><div className="artifact-list">{artifacts.slice(0,5).map(a=><button key={a.id} onClick={()=>setArtifact(a)}><Sparkles/><div><b>{a.title}</b><small>{new Date(a.createdAt).toLocaleString('ar-IQ')}</small></div></button>)}</div>{!artifacts.length&&<p className="muted">ماكو مخرجات بعد.</p>}</div></>}
  {tab==='topics'&&<div className="panel"><div className="topic-list">{topics.map(t=><div key={t.id}><Brain/><div><b>{t.title}</b><small>{t.sourceRef||'بدون مرجع صفحة'}</small></div><span className="topic-score">{t.mastery}%</span></div>)}</div>{!topics.length&&<Empty title="المفاهيم تظهر بعد الملخص والاختبارات" icon={Brain}/>}</div>}
  {tab==='sources'&&<div className="panel"><div className="section-head"><div><h3>مصادر المادة</h3><p>PDF / DOCX / PPTX / TXT / MD — Parsing حقيقي في المتصفح.</p></div><button className="primary" onClick={()=>inputRef.current?.click()}><Upload/> إضافة ملف</button></div><input ref={inputRef} type="file" hidden multiple accept=".pdf,.docx,.pptx,.txt,.md" onChange={e=>upload(e.target.files)}/>{busy==='upload'&&<div className="ai-loading"><LoaderCircle className="spin"/> جاري قراءة الملف…</div>}<div className="material-list">{mats.map(m=><article key={m.id}><FileText/><div style={{flex:1,overflow:'hidden'}}><b style={{overflowWrap:'anywhere'}}>{m.name}</b><small>{humanSize(m.size)} • {m.pages} صفحة • {m.status}</small>{m.error&&<div className="warning"><CircleAlert/>{m.error}</div>}</div><div className="mat-actions"><button className="ghost compact" onClick={()=>openLens(m)}><Eye/> فتح</button><button className="danger compact" onClick={()=>repo.deleteMaterial(m.id)}><Trash2/></button></div></article>)}</div>{!mats.length&&<Empty title="ارفع أول ملزمة" text="بعد الرفع يصير الملف قابلًا للسؤال والتلخيص والاختبار." icon={Upload}/>}</div>}
  {tab==='performance'&&<div className="health-grid"><div><b>الإتقان</b><h2>{courseMastery(state,course.id)}%</h2></div><div><b>المفاهيم</b><h2>{topics.length}</h2></div><div><b>المصادر</b><h2>{mats.length}</h2></div><div><b>البطاقات</b><h2>{cards.length}</h2></div></div>}
  {busy&&busy!=='upload'&&<div className="ai-loading"><LoaderCircle className="spin"/> جاري المعالجة…</div>}
  {quiz.length>0&&<QuizModal course={course} questions={quiz} onClose={()=>setQuiz([])} notify={notify}/>} {artifact&&<ArtifactModal art={artifact} onClose={()=>setArtifact(null)}/>}</section>;
}

function CourseChat({course,materials}:{course:Course;materials:Material[]}){
  const [question,setQuestion]=useState('');const [messages,setMessages]=useState<Array<{role:'user'|'assistant';text:string;truth?:string}>>([]);const [busy,setBusy]=useState(false);
  async function ask(){if(!question.trim()||!materials.length)return;const q=question.trim();setMessages(m=>[...m,{role:'user',text:q}]);setQuestion('');setBusy(true);const hits=retrieve(materials,q,8);const context=hits.map(h=>`SOURCE ${h.material} [[PAGE ${h.page}]]\n${h.text}`).join('\n\n');const r=await aiTask('chat',{question:q,context});setMessages(m=>[...m,{role:'assistant',text:r.text,truth:r.truth}]);setBusy(false)}
  return <div className="panel chat-panel"><div className="section-head"><div><h3>اسأل المادة</h3><p>الإجابة مرتبطة بالمصادر المرفوعة، مو دردشة عامة.</p></div><span className="truth supported">Source-grounded</span></div><div className="messages">{!messages.length&&<div className="chat-empty"><MessageSquareText/><p>{materials.length?'اسأل عن أي مفهوم داخل المصادر.':'ارفع مصدرًا أولًا.'}</p></div>}{messages.map((m,i)=><div className={`message ${m.role}`} key={i}>{m.truth&&<span className={`truth ${m.truth}`}>{m.truth}</span>}<p>{m.text}</p></div>)}{busy&&<div className="typing"><LoaderCircle className="spin"/> أبحث داخل المادة…</div>}</div><div className="chat-input"><input value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>e.key==='Enter'&&ask()} placeholder="مثال: شنو الفرق بين المفهومين؟"/><button onClick={ask} disabled={busy||!materials.length}><Sparkles/></button></div></div>;
}

function Study({state,notify}:{state:AppState;notify:(m:string)=>void}){
  const [courseId,setCourseId]=useState(state.courses[0]?.id||'');const [mode,setMode]=useState<'learn'|'review'|'test'|'rescue'>('learn');const [steps,setSteps]=useState<Array<{title:string;detail:string;done:boolean}>>([]);const [busy,setBusy]=useState(false);
  const course=state.courses.find(c=>c.id===courseId);const mats=state.materials.filter(m=>m.courseId===courseId&&m.status==='ready');const weak=weakest(state,courseId);
  async function build(){if(!course||!mats.length){notify('اختر مادة فيها مصادر أولًا');return}setBusy(true);const context=mats.map(m=>`SOURCE ${m.name}\n${m.text}`).join('\n\n').slice(0,70000);const r=await aiTask('study',{context,mode,weakTopics:weak.map(x=>x.title),daysToExam:daysUntil(course.examDate)});setSteps((r.steps||[]).map((x:any)=>({...x,done:false})));setBusy(false)}
  return <section><div className="section-head page"><div><span className="eyebrow">ADAPTIVE STUDY</span><h1>جلسة الدراسة</h1><p>تعلم، راجع، اختبر، أو فعّل وضع الإنقاذ قبل الامتحان.</p></div></div><div className="study-config"><label>المادة<select value={courseId} onChange={e=>setCourseId(e.target.value)}>{state.courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><div className="mode-grid">{(['learn','review','test','rescue'] as const).map(x=><button key={x} className={mode===x?'active':''} onClick={()=>setMode(x)}>{x}</button>)}</div><button className="primary" onClick={build} disabled={busy}>{busy?<LoaderCircle className="spin"/>:<Brain/>} بناء الجلسة</button></div>{course&&<div className="study-context"><div><b>{course.name}</b><small>الإتقان {courseMastery(state,course.id)}%</small></div><span>{course.examDate?`${Math.max(0,daysUntil(course.examDate)||0)} يوم للامتحان`:'بدون موعد'}</span></div>}<div className="study-steps">{steps.map((s,i)=><button key={i} className={s.done?'done':''} onClick={()=>setSteps(x=>x.map((v,j)=>j===i?{...v,done:!v.done}:v))}><span>{s.done?'✓':i+1}</span><div><b>{s.title}</b><p>{s.detail}</p></div></button>)}</div>{!steps.length&&<Empty title="ابنِ أول جلسة" icon={Brain}/>}</section>;
}

function Assignments({state,notify}:{state:AppState;notify:(m:string)=>void}){
  const [courseId,setCourseId]=useState(state.courses[0]?.id||'');const [title,setTitle]=useState('');const [instructions,setInstructions]=useState('');const [rubric,setRubric]=useState('');const [due,setDue]=useState('');const [result,setResult]=useState<any>(null);const [busy,setBusy]=useState(false);
  async function run(){if(!courseId||!instructions.trim())return;const mats=state.materials.filter(m=>m.courseId===courseId&&m.status==='ready');setBusy(true);const context=mats.map(m=>`SOURCE ${m.name}\n${m.text}`).join('\n\n').slice(0,80000);const r=await aiTask('assignment',{context,instructions,rubric});setResult(r);repo.addAssignment({courseId,title:title||'واجب أكاديمي',instructions,rubric,dueAt:due||undefined,checklist:r.checklist||[],outline:r.outline,draft:r.draft,assessment:r.assessment});notify('تم حفظ تحليل الواجب');setBusy(false)}
  return <section><div className="section-head page"><div><span className="eyebrow">ACADEMIC EXECUTION</span><h1>الواجبات والتسليم</h1><p>حوّل تعليمات الدكتور إلى Checklist ومسودة قابلة للمراجعة.</p></div></div><div className="assignment-form"><label>المادة<select value={courseId} onChange={e=>setCourseId(e.target.value)}>{state.courses.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label><label>عنوان الواجب<input value={title} onChange={e=>setTitle(e.target.value)}/></label><label>الموعد<input type="date" value={due} onChange={e=>setDue(e.target.value)}/></label><label className="span2">التعليمات<textarea value={instructions} onChange={e=>setInstructions(e.target.value)}/></label><label className="span2">Rubric<textarea value={rubric} onChange={e=>setRubric(e.target.value)}/></label><button className="primary span2" onClick={run} disabled={busy||!instructions.trim()}>{busy?<LoaderCircle className="spin"/>:<Sparkles/>} تحليل وبناء المسودة</button></div>{result&&<div className="assignment-result"><section className="panel"><h3>المتطلبات</h3>{(result.checklist||[]).map((x:any,i:number)=><div className="check-row" key={i}><CheckCircle2/><span>{x.text}</span></div>)}</section><section className="panel draft"><div className="section-head"><h3>المسودة</h3><button className="ghost" onClick={()=>exportDocx(title||'ScholarMCP Assignment',result.draft||'')}><Download/> Word</button></div><pre>{result.draft}</pre></section></div>}</section>;
}

function Research(){
  const [q,setQ]=useState('');const [rows,setRows]=useState<any[]>([]);const [busy,setBusy]=useState(false);const [err,setErr]=useState('');
  async function search(){if(!q.trim())return;setBusy(true);setErr('');try{setRows(await researchCrossref(q.trim()))}catch(e){setErr((e as Error).message)}finally{setBusy(false)}}
  return <section><div className="research-hero"><span className="eyebrow">REAL METADATA • CROSSREF</span><h1>البحث الأكاديمي</h1><p>نتائج حقيقية مع DOI؛ ما نختلق Citation.</p><div className="research-search"><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&search()} placeholder="مثال: forensic toxicology biomarkers"/><button className="primary" onClick={search}>{busy?<LoaderCircle className="spin"/>:<Search/>} بحث</button></div></div>{err&&<div className="error"><CircleAlert/>{err}</div>}<div className="paper-list">{rows.map((p,i)=><article key={`${p.doi}-${i}`}><span className="paper-num">{i+1}</span><h3>{p.title}</h3><p>{p.authors?.join(', ')} • {p.year||'n.d.'} • {p.journal}</p><p>{p.citation}</p>{p.url&&<a href={p.url} target="_blank" rel="noreferrer"><ExternalLink/> فتح DOI</a>}</article>)}</div></section>;
}

function LibraryView({state,openLens,openCourse}:{state:AppState;openLens:(m:Material)=>void;openCourse:(c:Course)=>void}){return <section><div className="section-head page"><div><span className="eyebrow">LIBRARY</span><h1>مكتبتي</h1><p>كل ملفاتك مرتبطة بموادها.</p></div></div><div className="library-grid">{state.materials.map(m=><button key={m.id} onClick={()=>openLens(m)}><span className="file-badge"><FileText/></span><div><b>{m.name}</b><small>{state.courses.find(c=>c.id===m.courseId)?.name} • {humanSize(m.size)}</small></div></button>)}</div>{!state.materials.length&&<Empty title="مكتبتك فارغة" icon={Library}/>}<div className="panel"><h3>المواد</h3><div className="artifact-list">{state.courses.map(c=><button key={c.id} onClick={()=>openCourse(c)}><BookOpen/><div><b>{c.name}</b><small>{state.materials.filter(m=>m.courseId===c.id).length} ملفات</small></div></button>)}</div></div></section>}
function CalendarView({state}:{state:AppState}){const list=state.deadlines.slice().sort((a,b)=>+new Date(a.dueAt)-+new Date(b.dueAt));return <section><div className="section-head page"><div><span className="eyebrow">CALENDAR</span><h1>جدولي</h1><p>امتحانات وتسليماتك بمكان واحد.</p></div></div><div className="calendar-list">{list.map(d=><div key={d.id}><span className="datebox">{new Date(d.dueAt).getDate()}<small>{new Intl.DateTimeFormat('ar-IQ',{month:'short'}).format(new Date(d.dueAt))}</small></span><div><b>{d.title}</b><small>{state.courses.find(c=>c.id===d.courseId)?.name||d.kind}</small></div></div>)}</div>{!list.length&&<Empty title="ماكو مواعيد بعد" icon={CalendarDays}/>}</section>}
function SettingsView({state}:{state:AppState}){return <section><div className="section-head page"><div><span className="eyebrow">SETTINGS</span><h1>الإعدادات</h1></div></div><div className="settings-grid"><section className="panel"><h3>الملف الأكاديمي</h3><p><b>{state.profile.name}</b></p><p>{state.profile.major||'بدون تخصص محدد'}</p><p>لغة الدراسة: {state.profile.studyLanguage==='ar'?'العربية':'English'}</p></section><section className="panel"><h3>البنية</h3><div className="infra ok">GitHub: المصدر والبناء والنشر</div><div className="infra warn">Neon: المشروع موجود؛ ربط Auth/Data API قيد التوصيل</div><p className="muted">النسخة الحالية Local-first حتى لا نربط بياناتك بسيرفر غير جاهز.</p></section></div></section>}

function SourceLens({material,onClose}:{material:Material;onClose:()=>void}){return <div className="modal" onClick={onClose}><div className="lens" onClick={e=>e.stopPropagation()}><div className="section-head"><div><h3>{material.name}</h3><p>{material.pages} صفحة • {humanSize(material.size)}</p></div><button className="icon" onClick={onClose}><X/></button></div>{material.error&&<div className="warning"><CircleAlert/>{material.error}</div>}<pre className="source-text">{material.text||'لا يوجد نص مستخرج.'}</pre><div className="lens-note">Source Lens الحالي يعرض النص مع علامات الصفحات. عرض PDF الأصلي والـHighlight الدقيق يدخل مع طبقة التخزين السحابي.</div></div></div>}
function ArtifactModal({art,onClose}:{art:Artifact;onClose:()=>void}){const d:any=art.data||{};return <div className="modal" onClick={onClose}><div className="lens artifact-modal" onClick={e=>e.stopPropagation()}><div className="section-head"><div><h3>{art.title}</h3><span className={`truth ${art.truth}`}>{art.truth}</span></div><button className="icon" onClick={onClose}><X/></button></div>{art.type==='summary'&&<div className="summary-view"><p>{d.summary}</p><div className="chips">{(d.keyConcepts||[]).map((x:any,i:number)=><span key={i}>{x.title}</span>)}</div><b>Estimated Coverage: {d.estimatedCoverage||art.coverage||'—'}%</b></div>}{art.type==='translation'&&<pre className="source-text">{d.text}</pre>}{art.type==='mindmap'&&<div className="mindmap"><div className="root">{d.nodes?.[0]?.label||'المادة'}</div><div className="branches">{(d.nodes||[]).slice(1).map((n:any)=><div key={n.id}><b>{n.label}</b><p>{n.definition}</p></div>)}</div></div>}{art.type==='package'&&<div className="package-view"><p>{d.summary}</p><div className="export-inline"><button className="ghost" onClick={()=>exportDocx(art.title,d.summary||'')}><Download/> Word</button><button className="ghost" onClick={()=>exportPptx({title:art.title,slides:d.slides||[]})}><Presentation/> PowerPoint</button></div><div className="slides-preview">{(d.slides||[]).map((s:any,i:number)=><div key={i}><b>{s.title}</b>{s.bullets?.map((x:string,j:number)=><p key={j}>• {x}</p>)}</div>)}</div></div>}</div></div>}
function QuizModal({course,questions,onClose,notify}:{course:Course;questions:any[];onClose:()=>void;notify:(m:string)=>void}){const [i,setI]=useState(0);const [answers,setAnswers]=useState<Record<number,number>>({});const [done,setDone]=useState(false);const q=questions[i];const score=questions.filter((x,j)=>answers[j]===x.answerIndex).length;function finish(){questions.forEach((x,j)=>repo.recordTopic(course.id,x.topic,answers[j]===x.answerIndex));setDone(true);notify('تم تحديث Mastery حسب نتيجة الاختبار')}return <div className="modal"><div className="quiz-modal"><div className="section-head"><div><h3>{done?'نتيجة الاختبار':`سؤال ${i+1} من ${questions.length}`}</h3></div><button className="icon" onClick={onClose}><X/></button></div>{done?<><div className="score-ring"><span>{score}/{questions.length}</span></div><p>تم ربط الأخطاء بالمفاهيم حتى تعرف وين تركز بعدين.</p><button className="primary wide" onClick={onClose}>إنهاء</button></>:<><div className="question"><h3>{q.question}</h3><small>{q.sourceRef}</small></div><div className="options">{q.choices.map((x:string,j:number)=><button key={j} className={answers[i]===j?'picked':''} onClick={()=>setAnswers(a=>({...a,[i]:j}))}>{x}</button>)}</div>{answers[i]!==undefined&&<div className="explain">{answers[i]===q.answerIndex?<><ThumbsUp/> صحيح</>:<>الإجابة الصحيحة: {q.choices[q.answerIndex]}</>}<p>{q.explanation}</p></div>}<button className="primary wide" disabled={answers[i]===undefined} onClick={()=>i===questions.length-1?finish():setI(i+1)}>{i===questions.length-1?'أظهر النتيجة':'التالي'}</button></>}</div></div>}
function Empty({title,text,icon:Icon,action,actionLabel}:{title:string;text?:string;icon:React.ComponentType;action?:()=>void;actionLabel?:string}){return <div className="empty"><Icon/><h3>{title}</h3>{text&&<p>{text}</p>}{action&&<button className="primary" onClick={action}>{actionLabel}</button>}</div>}
