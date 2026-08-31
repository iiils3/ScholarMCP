import {useMemo,useState} from 'react';
import {BookOpen,Brain,Check,Clock3,FileQuestion,Flame,Layers3,Target} from 'lucide-react';
import {type AppState,courseMastery,daysUntil,riskScore} from './lib';
import {dueDate} from './spaced';
import './scholar-day.css';

type Mission={id:string;title:string;detail:string;minutes:number;kind:'learn'|'review'|'test'|'work';courseId?:string};
type Props={state:AppState;openStudy:(id?:string)=>void;openCourse:(course:any)=>void;go:(view:any)=>void};
const KEY='scholarmcp.day.v1';
function todayKey(){return new Date().toISOString().slice(0,10)}
function doneSet(){try{const x=JSON.parse(localStorage.getItem(KEY)||'{}');return x.day===todayKey()?new Set<string>(x.done||[]):new Set<string>()}catch{return new Set<string>()}}
function saveDone(done:Set<string>){localStorage.setItem(KEY,JSON.stringify({day:todayKey(),done:[...done]}))}

export default function ScholarDay({state,openStudy,openCourse,go}:Props){
 const [done,setDone]=useState<Set<string>>(()=>doneSet());
 const missions=useMemo(()=>buildMissions(state),[state]);const total=missions.reduce((n,m)=>n+m.minutes,0);const completed=missions.filter(m=>done.has(m.id));const progress=missions.length?Math.round(completed.length/missions.length*100):0;
 function toggle(id:string){const n=new Set(done);n.has(id)?n.delete(id):n.add(id);setDone(n);saveDone(n)}
 function launch(m:Mission){if(m.kind==='work'){go('assignments');return}const c=state.courses.find(x=>x.id===m.courseId);if(m.kind==='learn'||m.kind==='review'||m.kind==='test')openStudy(m.courseId);else if(c)openCourse(c)}
 if(!missions.length)return null;
 return <section className="scholar-day"><div className="day-head"><div><span className="eyebrow">SCHOLAR DAY</span><h2>مهمة اليوم</h2><p>مو قائمة أمنيات. هاي أقصر خطة ترفع فرصتك حسب الامتحان، الضعف والمراجعات المستحقة.</p></div><div className="day-ring" style={{'--p':`${progress}%`} as React.CSSProperties}><b>{progress}%</b><small>{total} د</small></div></div><div className="day-summary"><span><Clock3/> {total} دقيقة</span><span><Target/> {missions.length} مهام</span><span><Flame/> {completed.length} مكتملة</span></div><div className="mission-list">{missions.map((m,i)=>{const c=state.courses.find(x=>x.id===m.courseId);const isDone=done.has(m.id);const Icon=m.kind==='test'?FileQuestion:m.kind==='review'?Layers3:m.kind==='work'?BookOpen:Brain;return <article key={m.id} className={isDone?'done':''}><button className="mission-check" onClick={()=>toggle(m.id)} aria-label="تحديد كمكتمل">{isDone?<Check/>:<span>{i+1}</span>}</button><button className="mission-main" onClick={()=>launch(m)}><Icon/><div><b>{m.title}</b><p>{m.detail}</p>{c&&<small>{c.name} • الإتقان {courseMastery(state,c.id)}%</small>}</div><time>{m.minutes} د</time></button></article>})}</div></section>
}

function buildMissions(state:AppState):Mission[]{
 const missions:Mission[]=[];const ranked=state.courses.slice().sort((a,b)=>riskScore(state,b)-riskScore(state,a));const top=ranked[0];
 if(top){const d=daysUntil(top.examDate);missions.push({id:`learn-${top.id}`,title:d!==undefined&&d<=3?'إنقاذ المادة الأعلى خطورة':'جلسة فهم مركزة',detail:d!==undefined?`باقي ${Math.max(0,d)} يوم للامتحان؛ ابدأ بالمفاهيم الأضعف.`:'ابدأ من المادة الأعلى أولوية عندك.',minutes:d!==undefined&&d<=3?25:20,kind:'learn',courseId:top.id})}
 const due=state.flashcards.filter(c=>dueDate(c)<=new Date());if(due.length){const byCourse=new Map<string,number>();for(const c of due)byCourse.set(c.courseId,(byCourse.get(c.courseId)||0)+1);const [cid,n]=[...byCourse.entries()].sort((a,b)=>b[1]-a[1])[0];missions.push({id:`review-${cid}`,title:'راجع المستحق قبل ما يهرب من الذاكرة',detail:`عندك ${n} بطاقة مستحقة بهذه المادة.`,minutes:Math.min(18,Math.max(8,Math.ceil(n*.7))),kind:'review',courseId:cid})}
 const weak=state.topics.filter(t=>t.attempts>0&&t.mastery<60).sort((a,b)=>a.mastery-b.mastery)[0];if(weak)missions.push({id:`test-${weak.courseId}-${weak.id}`,title:`اضرب نقطة الضعف: ${weak.title}`,detail:`إتقانك الحالي ${weak.mastery}%. خذ اختبار قصير ثم راجع الخطأ فقط.`,minutes:12,kind:'test',courseId:weak.courseId});
 const deadline=state.deadlines.filter(d=>!d.done&&d.kind!=='exam'&&daysUntil(d.dueAt)!==undefined&&Number(daysUntil(d.dueAt))<=5).sort((a,b)=>+new Date(a.dueAt)-+new Date(b.dueAt))[0];if(deadline)missions.push({id:`work-${deadline.id}`,title:`تقدّم في: ${deadline.title}`,detail:`موعده بعد ${Math.max(0,daysUntil(deadline.dueAt)||0)} يوم. لا تخليه يصير أزمة ليلة التسليم.`,minutes:20,kind:'work',courseId:deadline.courseId});
 if(missions.length<3&&ranked[1])missions.push({id:`second-${ranked[1].id}`,title:'تثبيت المادة الثانية',detail:'جلسة قصيرة تمنع تراكم مادة ثانية عليك.',minutes:12,kind:'review',courseId:ranked[1].id});
 return missions.slice(0,5);
}
