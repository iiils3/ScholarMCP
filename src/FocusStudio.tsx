import {useEffect,useMemo,useState} from 'react';
import {Brain,CheckCircle2,Clock,Maximize2,Pause,Play,RotateCcw,Target,X} from 'lucide-react';
import {type AppState} from './lib';
import './focus.css';

type Props={state:AppState;notify:(message:string)=>void};
type Session={courseId:string;courseName:string;goal:string;minutes:number;finishedAt:string};
const KEY='scholarmcp.focus.sessions.v1';
function load():Session[]{try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}}
function save(rows:Session[]){localStorage.setItem(KEY,JSON.stringify(rows.slice(0,100)))}
function fmt(sec:number){return `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`}

export default function FocusStudio({state,notify}:Props){
 const [courseId,setCourseId]=useState(state.courses[0]?.id||'');const [goal,setGoal]=useState('');const [minutes,setMinutes]=useState(25);const [left,setLeft]=useState(0);const [running,setRunning]=useState(false);const [open,setOpen]=useState(false);const [sessions,setSessions]=useState<Session[]>(()=>load());const course=state.courses.find(c=>c.id===courseId);
 useEffect(()=>{if(!running||left<=0)return;const t=window.setInterval(()=>setLeft(x=>Math.max(0,x-1)),1000);return()=>clearInterval(t)},[running,left]);
 useEffect(()=>{if(open&&left===0&&running){setRunning(false);finish()}},[left,open,running]);
 function start(){if(!course){notify('اختَر مادة أولًا');return}setLeft(minutes*60);setOpen(true);setRunning(true)}
 function finish(){if(!course)return;const row={courseId:course.id,courseName:course.name,goal:goal.trim()||'جلسة دراسة مركزة',minutes,finishedAt:new Date().toISOString()};const next=[row,...sessions];setSessions(next);save(next);notify('انتهت جلسة التركيز وحفظتها')}
 function close(){setRunning(false);setOpen(false)}
 const week=useMemo(()=>sessions.filter(s=>Date.now()-new Date(s.finishedAt).getTime()<7*86400000),[sessions]);const total=week.reduce((n,s)=>n+s.minutes,0);
 return <div className="focus-studio"><div className="panel"><div className="section-head"><div><span className="eyebrow">FOCUS MODE</span><h3>اقفل الضوضاء واشتغل على هدف واحد</h3><p>مؤقت محلي، هدف واضح، وسجل جلسات بدون حساب خارجي.</p></div><Target/></div><div className="focus-config"><select value={courseId} onChange={e=>setCourseId(e.target.value)}>{state.courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><input value={goal} onChange={e=>setGoal(e.target.value)} placeholder="هدفي: أخلص Lec 3 وأختبر نفسي"/><select value={minutes} onChange={e=>setMinutes(Number(e.target.value))}>{[15,25,35,50,75,90].map(n=><option key={n} value={n}>{n} دقيقة</option>)}</select><button className="primary" onClick={start}><Maximize2/> ابدأ Focus</button></div><div className="focus-stats"><div><b>{week.length}</b><small>جلسات آخر 7 أيام</small></div><div><b>{total}</b><small>دقيقة مركزة</small></div><div><b>{sessions.length}</b><small>إجمالي الجلسات</small></div></div></div>{sessions.length>0&&<div className="panel"><h4>آخر الجلسات</h4><div className="focus-history">{sessions.slice(0,8).map((s,i)=><div key={`${s.finishedAt}-${i}`}><CheckCircle2/><div><b>{s.courseName}</b><p>{s.goal}</p></div><span>{s.minutes} د</span></div>)}</div></div>}{open&&<div className="focus-overlay"><button className="focus-close" onClick={close}><X/></button><div className="focus-room"><Brain/><span>{course?.name}</span><h1>{fmt(left)}</h1><p>{goal.trim()||'جلسة دراسة مركزة'}</p><div className="focus-progress"><i style={{width:`${Math.max(0,Math.min(100,100-left/(minutes*60)*100))}%`}}/></div><div className="focus-buttons"><button onClick={()=>setRunning(x=>!x)}>{running?<Pause/>:<Play/>}{running?'إيقاف مؤقت':'استمرار'}</button><button onClick={()=>setLeft(minutes*60)}><RotateCcw/> إعادة</button><button className="finish" onClick={()=>{setRunning(false);finish();setOpen(false)}}><CheckCircle2/> أنهي الجلسة</button></div><small><Clock/> كل شيء هنا محلي على جهازك.</small></div></div>}</div>
}
