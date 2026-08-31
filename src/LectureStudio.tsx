import {useEffect,useRef,useState} from 'react';
import {BookOpen,Brain,CheckCircle2,FileAudio,Layers3,LoaderCircle,Mic,Pause,Play,Save,Square,Upload,X} from 'lucide-react';
import {aiTask,LocalRepository} from './lib';
import {speechToText} from './puter';
import './lecture.css';

const repo=new LocalRepository();
type Segment={start?:number;end?:number;text?:string;speaker?:string};
type Props={courseId:string;courseName:string;onClose:()=>void;notify:(message:string)=>void};
function stamp(sec?:number){if(sec===undefined||!Number.isFinite(sec))return '';const m=Math.floor(sec/60);const s=Math.floor(sec%60);return `${m}:${String(s).padStart(2,'0')}`}

export default function LectureStudio({courseId,courseName,onClose,notify}:Props){
 const input=useRef<HTMLInputElement>(null);const recorder=useRef<MediaRecorder|null>(null);const stream=useRef<MediaStream|null>(null);const chunks=useRef<Blob[]>([]);
 const [file,setFile]=useState<File|null>(null);const [busy,setBusy]=useState('');const [transcript,setTranscript]=useState('');const [segments,setSegments]=useState<Segment[]>([]);const [recording,setRecording]=useState(false);const [elapsed,setElapsed]=useState(0);const [notes,setNotes]=useState<any>(null);const [saved,setSaved]=useState(false);
 useEffect(()=>{if(!recording)return;const t=setInterval(()=>setElapsed(v=>v+1),1000);return()=>clearInterval(t)},[recording]);
 useEffect(()=>()=>{stream.current?.getTracks().forEach(t=>t.stop())},[]);
 async function startRecord(){
  try{const s=await navigator.mediaDevices.getUserMedia({audio:true});stream.current=s;chunks.current=[];const r=new MediaRecorder(s);recorder.current=r;r.ondataavailable=e=>{if(e.data.size)chunks.current.push(e.data)};r.onstop=()=>{const blob=new Blob(chunks.current,{type:r.mimeType||'audio/webm'});setFile(new File([blob],`lecture-${Date.now()}.webm`,{type:blob.type}));s.getTracks().forEach(t=>t.stop());stream.current=null};r.start(1000);setElapsed(0);setRecording(true)}catch(e){notify(`تعذر تشغيل المايك: ${(e as Error).message}`)}}
 function stopRecord(){recorder.current?.stop();setRecording(false)}
 async function transcribe(){if(!file)return;setBusy('transcribe');setSaved(false);try{const r:any=await speechToText(file,{diarize:true});const text=String(r?.text||'').trim();if(!text)throw new Error('لم أستطع استخراج كلام واضح من التسجيل.');setTranscript(text);setSegments(Array.isArray(r?.segments)?r.segments:[]);notify('اكتمل تفريغ المحاضرة على السحابة')}catch(e){notify((e as Error).message)}finally{setBusy('')}}
 async function buildNotes(){if(!transcript)return;setBusy('notes');try{const r:any=await aiTask('summary',{context:`SOURCE محاضرة ${courseName}\n[[PAGE 1]]\n${transcript}`});setNotes(r);notify('جهزت ملاحظات المحاضرة والمفاهيم المهمة')}catch(e){notify((e as Error).message)}finally{setBusy('')}}
 async function makeCards(){if(!transcript)return;setBusy('cards');try{const r:any=await aiTask('flashcards',{context:`SOURCE محاضرة ${courseName}\n[[PAGE 1]]\n${transcript}`,count:18});repo.addFlashcards(courseId,r.cards||[]);notify(`أضفت ${(r.cards||[]).length} بطاقة للمادة`)}catch(e){notify((e as Error).message)}finally{setBusy('')}}
 function saveLecture(){if(!transcript||saved)return;const pages=Math.max(1,Math.ceil(transcript.length/2600));let text='';for(let p=1;p<=pages;p++)text+=`\n\n[[PAGE ${p}]]\n${transcript.slice((p-1)*2600,p*2600)}`;repo.addMaterial({courseId,name:`محاضرة صوتية — ${new Date().toLocaleDateString('ar-IQ')}.txt`,mime:'text/plain',ext:'txt',size:new Blob([transcript]).size,pages,status:'ready',text:text.trim()});if(notes){repo.addArtifact({courseId,type:'summary',title:`ملاحظات محاضرة — ${courseName}`,truth:'supported',coverage:notes.estimatedCoverage,data:notes});repo.upsertTopics(courseId,(notes.keyConcepts||[]).map((x:any)=>({title:x.title,sourceRef:x.sourceRef})))}setSaved(true);notify('حفظت المحاضرة داخل عقل المادة')}
 return <div className="modal lecture-modal" onClick={onClose}><div className="lens lecture-lens" onClick={e=>e.stopPropagation()}>
  <div className="section-head"><div><span className="eyebrow">LECTURE INTELLIGENCE</span><h3>محاضرة {courseName}</h3><p>التسجيل والتفريغ والمعالجة تتم على السحابة، مو على قوة الموبايل.</p></div><button className="icon" onClick={onClose}><X/></button></div>
  <div className="lecture-source">
   <input ref={input} hidden type="file" accept="audio/*,video/*" onChange={e=>{const f=e.target.files?.[0]||null;setFile(f);setTranscript('');setNotes(null);setSaved(false)}}/>
   {!recording?<><button className="primary" onClick={startRecord}><Mic/> سجل المحاضرة</button><button className="ghost" onClick={()=>input.current?.click()}><Upload/> ارفع تسجيل</button></>:<button className="danger record-stop" onClick={stopRecord}><Square/> إيقاف • {stamp(elapsed)}</button>}
   {file&&<div className="lecture-file"><FileAudio/><div><b>{file.name}</b><small>{(file.size/1048576).toFixed(1)} MB</small></div><button className="primary" disabled={!!busy} onClick={transcribe}>{busy==='transcribe'?<LoaderCircle className="spin"/>:<Play/>} فرّغ النص</button></div>}
  </div>
  {transcript&&<><div className="lecture-actions"><button onClick={buildNotes} disabled={!!busy}><Brain/> ملاحظات ذكية</button><button onClick={makeCards} disabled={!!busy}><Layers3/> بطاقات</button><button onClick={saveLecture} disabled={saved}><Save/> {saved?'محفوظ':'احفظ بالمادة'}</button></div>
   {busy&&busy!=='transcribe'&&<div className="ai-loading"><LoaderCircle className="spin"/> أعالج المحاضرة…</div>}
   <div className="lecture-grid"><div className="panel"><h3>النص الكامل</h3>{segments.length?<div className="segments">{segments.map((s,i)=><p key={i}><button className="timestamp" title="وقت المقطع">{stamp(s.start)}</button>{s.speaker&&<b>{s.speaker}: </b>}{s.text}</p>)}</div>:<pre className="source-text">{transcript}</pre>}</div>
   <div className="panel"><h3>ملاحظات Scholar</h3>{notes?<><p className="lecture-summary">{notes.summary}</p><div className="concept-cards">{(notes.keyConcepts||[]).map((x:any,i:number)=><div key={i}><b>{x.title}</b><p>{x.definition}</p></div>)}</div></>:<div className="lecture-empty"><BookOpen/><p>بعد التفريغ اضغط «ملاحظات ذكية» حتى تتحول المحاضرة إلى مادة قابلة للدراسة.</p></div>}</div></div>
  </>}
  {!file&&!recording&&<div className="lecture-empty hero"><Mic/><h3>سجّل مرة، وادرس منها مرات</h3><p>ScholarMCP يحول التسجيل إلى نص، مفاهيم، بطاقات ومراجعة داخل نفس المادة.</p></div>}
  {saved&&<div className="saved-banner"><CheckCircle2/> المحاضرة صارت جزءًا من Course Brain.</div>}
 </div></div>
}
