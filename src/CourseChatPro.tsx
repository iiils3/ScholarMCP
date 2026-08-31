import {useState} from 'react';
import {BookOpenCheck,Globe2,LoaderCircle,MessageSquareText,ShieldCheck,Sparkles,Volume2} from 'lucide-react';
import {type Material,aiTask,retrieve} from './lib';
import {scholarSearch,type ScholarPaper} from './research';
import {customTask,textToSpeech} from './scholar-engine';
import './course-chat.css';

type Mode='source'|'verified'|'open';
type Msg={role:'user'|'assistant';text:string;refs?:string[];papers?:ScholarPaper[];mode?:Mode};
type Props={materials:Material[];openRef:(ref?:string)=>void};
const labels:{id:Mode;label:string;desc:string}[]=[
 {id:'source',label:'من مصادري فقط',desc:'أعلى دقة للامتحان'},
 {id:'verified',label:'أكاديمي متحقق',desc:'مصادرك + أوراق أكاديمية'},
 {id:'open',label:'بحث أكاديمي أوسع',desc:'يوسع الاكتشاف داخل المنصة'}
];
function paperContext(rows:ScholarPaper[]){return rows.map((p,i)=>`ACADEMIC PAPER ${i+1}\nTitle: ${p.title}\nAuthors: ${p.authors.join(', ')}\nYear: ${p.year||''}\nJournal: ${p.journal||''}\nDOI: ${p.doi||''}\nAbstract: ${p.abstract||'Abstract unavailable'}\nSource index: ${p.source}`).join('\n\n')}

export default function CourseChatPro({materials,openRef}:Props){
 const [question,setQuestion]=useState('');const [msgs,setMsgs]=useState<Msg[]>([]);const [busy,setBusy]=useState(false);const [mode,setMode]=useState<Mode>('source');
 async function ask(){if(!question.trim()||!materials.length)return;const q=question.trim();setQuestion('');setMsgs(x=>[...x,{role:'user',text:q,mode}]);setBusy(true);try{
   const hits=retrieve(materials,q,10);const courseContext=hits.map(h=>`SOURCE ${h.material}\n[[PAGE ${h.page}]]\n${h.text}`).join('\n\n');
   if(mode==='source'){
     const r:any=await aiTask('chat',{context:courseContext,question:q});setMsgs(x=>[...x,{role:'assistant',text:r.text||'غير موجود في المصدر.',refs:r.sourceRefs||[],mode}]);return;
   }
   const found=await scholarSearch(q);const papers=found.filter(p=>mode==='open'||!!p.doi||!!p.abstract).slice(0,mode==='verified'?6:10);const academic=paperContext(papers);
   const r:any=await customTask(`أجب عن سؤال الطالب: «${q}». لديك قسمان من الأدلة: COURSE_SOURCE من ملفات الطالب وACADEMIC_EVIDENCE من أوراق أكاديمية مكتشفة داخل ScholarMCP. لا تخلطهما. إذا تعارض البحث الخارجي مع مادة الطالب، اذكر التعارض ولا تستبدل جواب المادة بصمت. لا تدعِ قراءة Full Text عندما الموجود Abstract فقط. أعد JSON: {"text":"جواب واضح","courseRefs":["اسم الملف — ص N"],"paperNumbers":[1],"confidence":"high|medium|low","limits":""}.`,`${courseContext}\n\n--- ACADEMIC_EVIDENCE ---\n${academic||'لا توجد نتائج أكاديمية كافية.'}`);
   const refs=Array.isArray(r.courseRefs)?r.courseRefs:[];const nums=Array.isArray(r.paperNumbers)?r.paperNumbers:[];const used=nums.map((n:number)=>papers[n-1]).filter(Boolean);const suffix=r.limits?`\n\nحدود الإجابة: ${r.limits}`:'';setMsgs(x=>[...x,{role:'assistant',text:`${r.text||'لم أجد جوابًا موثوقًا.'}${suffix}`,refs,papers:used,mode}]);
 }catch(e){setMsgs(x=>[...x,{role:'assistant',text:(e as Error).message,mode}])}finally{setBusy(false)}}
 return <div className="panel chat-panel course-chat-pro"><div className="section-head"><div><h3>اسأل المادة</h3><p>{mode==='source'?'الإجابة مقفلة على ملفاتك.':'توسيع أكاديمي داخل ScholarMCP مع فصل واضح بين نوعي الدليل.'}</p></div><span className={`truth ${mode==='source'?'verified':'supported'}`}>{mode==='source'?'SOURCE LOCKED':mode==='verified'?'ACADEMIC VERIFIED':'OPEN ACADEMIC'}</span></div><div className="chat-modes">{labels.map(x=><button className={mode===x.id?'active':''} key={x.id} onClick={()=>setMode(x.id)}>{x.id==='source'?<ShieldCheck/>:x.id==='verified'?<BookOpenCheck/>:<Globe2/>}<span><b>{x.label}</b><small>{x.desc}</small></span></button>)}</div><div className="messages">{!msgs.length&&<div className="chat-empty"><MessageSquareText/><p>مثال: اشرح الفرق بين المفهومين واذكر الصفحة.</p></div>}{msgs.map((m,i)=><div className={`message ${m.role}`} key={i}><p>{m.text}</p>{m.role==='assistant'&&<div className="msg-tools"><button onClick={()=>textToSpeech(m.text)}><Volume2/> اسمع</button>{m.refs?.map((r,j)=><button key={`${r}-${j}`} onClick={()=>openRef(r)}>{r}</button>)}{m.papers?.map((p,j)=><span className="paper-ref" key={`${p.id}-${j}`}>{p.title} • {p.year||'—'} • {p.source}</span>)}</div>}</div>)}{busy&&<div className="typing"><LoaderCircle className="spin"/> {mode==='source'?'أراجع المصدر…':'أجمع الدليل الأكاديمي داخل المنصة…'}</div>}</div><div className="chat-input"><input value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>e.key==='Enter'&&ask()} placeholder="سؤالك عن المادة…"/><button onClick={ask} disabled={busy||!materials.length}><Sparkles/></button></div></div>
}
