import {useEffect,useRef,useState} from 'react';
import {BookOpen,Brain,CheckCircle2,FileAudio,Layers3,LoaderCircle,Mic,Play,Save,Square,Upload,X} from 'lucide-react';
import {aiTask,LocalRepository} from './lib';
import {speechToText} from './puter';
import './lecture.css';

const repo=new LocalRepository();
type Segment={start?:number;end?:number;text?:string;speaker?:string};
type RecordedPart={file:File;start:number;end:number};
type Props={courseId:string;courseName:string;onClose:()=>void;notify:(message:string)=>void};
function stamp(sec?:number){if(sec===undefined||!Number.isFinite(sec))return '';const m=Math.floor(sec/60);const s=Math.floor(sec%60);return `${m}:${String(s).padStart(2,'0')}`}

export default function LectureStudio({courseId,courseName,onClose,notify}:Props){
 const input=useRef<HTMLInputElement>(null);const recorder=useRef<MediaRecorder|null>(null);const stream=useRef<MediaStream|null>(null);const rotateTimer=useRef<number|null>(null);const elapsedRef=useRef(0);const stopRequested=useRef(false);
 const [file,setFile]=useState<File|null>(null);const [recordedParts,setRecordedParts]=useState<RecordedPart[]>([]);const [busy,setBusy]=useState('');const [transcript,setTranscript]=useState('');const [segments,setSegments]=useState<Segment[]>([]);const [recording,setRecording]=useState(false);const [elapsed,setElapsed]=useState(0);const [notes,setNotes]=useState<any>(null);const [saved,setSaved]=useState(false);const [transcribeProgress,setTranscribeProgress]=useState('');
 useEffect(()=>{if(!recording)return;const t=window.setInterval(()=>{elapsedRef.current+=1;setElapsed(elapsedRef.current)},1000);return()=>clearInterval(t)},[recording]);
 useEffect(()=>()=>{if(rotateTimer.current)clearInterval(rotateTimer.current);try{if(recorder.current?.state==='recording')recorder.current.stop()}catch{}stream.current?.getTracks().forEach(t=>t.stop())},[]);
 function beginSegment(s:MediaStream){
  const mime=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':'audio/webm';const chunks:Blob[]=[];const start=elapsedRef.current;const r=new MediaRecorder(s,{mimeType:mime});recorder.current=r;
  r.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
  r.onstop=()=>{const end=elapsedRef.current;const blob=new Blob(chunks,{type:r.mimeType||mime});if(blob.size){const part={file:new File([blob],`lecture-part-${start}-${end}.webm`,{type:blob.type}),start,end};setRecordedParts(prev=>[...prev,part])}if(stopRequested.current){s.getTracks().forEach(t=>t.stop());stream.current=null;recorder.current=null}else if(s.active){beginSegment(s)}};
  r.start(1000);
 }
 async function startRecord(){
  try{const s=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});stream.current=s;stopRequested.current=false;elapsedRef.current=0;setElapsed(0);setFile(null);setRecordedParts([]);setTranscript('');setSegments([]);setNotes(null);setSaved(false);beginSegment(s);setRecording(true);rotateTimer.current=window.setInterval(()=>{const r=recorder.current;if(r?.state==='recording'&&!stopRequested.current)r.stop()},45_000);notify('بدأ التسجيل — ScholarMCP يقسم المحاضرة تلقائيًا حتى لو طالت')}catch(e){notify(`تعذر تشغيل المايك: ${(e as Error).message}`)}}
 function stopRecord(){stopRequested.current=true;if(rotateTimer.current){clearInterval(rotateTimer.current);rotateTimer.current=null}const r=recorder.current;if(r?.state==='recording')r.stop();else{stream.current?.getTracks().forEach(t=>t.stop());stream.current=null}setRecording(false)}
 async function transcribe(){const inputs:RecordedPart[]=recordedParts.length?recordedParts:(file?[{file,start:0,end:0}]:[]);if(!inputs.length)return;setBusy('transcribe');setSaved(false);setTranscript('');setSegments([]);try{const texts:string[]=[];const allSegments:Segment[]=[];for(let i=0;i<inputs.length;i++){const p=inputs[i];setTranscribeProgress(`المقطع ${i+1} من ${inputs.length}`);const r:any=await speechToText(p.file);const text=String(r?.text||'').trim();if(!text)continue;texts.push(`[[TIME ${stamp(p.start)}]]\n${text}`);if(Array.isArray(r?.segments)&&r.segments.length){for(const s of r.segments)allSegments.push({...s,start:(Number(s.start)||0)+p.start,end:(Number(s.end)||0)+p.start})}else allSegments.push({start:p.start,end:p.end,text})}const joined=texts.join('\n\n').trim();if(!joined)throw new Error('لم أستطع استخراج كلام واضح من التسجيل.');setTranscript(joined);setSegments(allSegments);notify(`اكتمل تفريغ المحاضرة — ${inputs.length} مقطع جُمعت داخل نص واحد`)}catch(e){notify((e as Error).message)}finally{setBusy('');setTranscribeProgress('')}}
 async function buildNotes(){if(!transcript)return;setBusy('notes');try{const r:any=await aiTask('summary',{context:`SOURCE محاضرة ${courseName}\n[[PAGE 1]]\n${transcript}`});setNotes(r);notify('جهزت ملاحظات المحاضرة والمفاهيم المهمة')}catch(e){notify((e as Error).message)}finally{setBusy('')}}
 async function makeCards(){if(!transcript)return;setBusy('cards');try{const r:any=await aiTask('flashcards',{context:`SOURCE محاضرة ${courseName}\n[[PAGE 1]]\n${transcript}`,count:18});repo.addFlashcards(courseId,r.cards||[]);notify(`أضفت ${(r.cards||[]).length} بطاقة للمادة`)}catch(e){notify((e as Error).message)}finally{setBusy('')}}
 function saveLecture(){if(!transcript||saved)return;const pages=Math.max(1,Math.ceil(transcript.length/2600));let text='';for(let p=1;p<=pages;p++)text+=`\n\n[[PAGE ${p}]]\n${transcript.slice((p-1)*2600,p*2600)}`;repo.addMaterial({courseId,name:`محاضرة صوتية — ${new Date().toLocaleDateString('ar-IQ')}.txt`,mime:'text/plain',ext:'txt',size:new Blob([transcript]).size,pages,status:'ready',text:text.trim()});if(notes){repo.addArtifact({courseId,type:'summary',title:`ملاحظات محاضرة — ${courseName}`,truth:'supported',coverage:notes.estimatedCoverage,data:notes});repo.upsertTopics(courseId,(notes.keyConcepts||[]).map((x:any)=>({title:x.title,sourceRef:x.sourceRef})))}setSaved(true);notify('حفظت المحاضرة داخل عقل المادة')}
 const inputCount=recordedParts.length||(file?1:0);const inputSize=recordedParts.reduce((n,p)=>n+p.file.size,0)+(file?.size||0);
 return <div className="modal lecture-modal" onClick={onClose}><div className="lens lecture-lens" onClick={e=>e.stopPropagation()}>
  <div className="section-head"><div><span className="eyebrow">LECTURE INTELLIGENCE</span><h3>محاضرة {courseName}</h3><p>التسجيل والتفريغ والمعالجة تتم داخل ScholarMCP؛ التسجيل الطويل يُقسّم تلقائيًا ويُجمع من جديد.</p></div><button className="icon" onClick={onClose}><X/></button></div>
  <div className="lecture-source">
   <input ref={input} hidden type="file" accept="audio/*,video/*" onChange={e=>{const f=e.target.files?.[0]||null;setFile(f);setRecordedParts([]);setTranscript('');setSegments([]);setNotes(null);setSaved(false)}}/>
   {!recording?<><button className="primary" onClick={startRecord}><Mic/> سجل المحاضرة</button><button className="ghost" onClick={()=>input.current?.click()}><Upload/> ارفع تسجيل</button></>:<button className="danger record-stop" onClick={stopRecord}><Square/> إيقاف • {stamp(elapsed)}</button>}
   {inputCount>0&&!recording&&<div className="lecture-file"><FileAudio/><div><b>{recordedParts.length?`تسجيل المحاضرة — ${recordedParts.length} مقاطع داخلية`:file?.name}</b><small>{(inputSize/1048576).toFixed(1)} MB {recordedParts.length?'• التقسيم تلقائي':''}</small></div><button className="primary" disabled={!!busy} onClick={transcribe}>{busy==='transcribe'?<LoaderCircle className="spin"/>:<Play/>} {busy==='transcribe'?(transcribeProgress||'أفرّغ…'):'فرّغ النص'}</button></div>}
  </div>
  {recording&&<div className="recording-health"><span className="record-dot"/> التسجيل مستمر داخل ScholarMCP • حفظ مقطع آمن كل 45 ثانية</div>}
  {transcript&&<><div className="lecture-actions"><button onClick={buildNotes} disabled={!!busy}><Brain/> ملاحظات ذكية</button><button onClick={makeCards} disabled={!!busy}><Layers3/> بطاقات</button><button onClick={saveLecture} disabled={saved}><Save/> {saved?'محفوظ':'احفظ بالمادة'}</button></div>
   {busy&&busy!=='transcribe'&&<div className="ai-loading"><LoaderCircle className="spin"/> أعالج المحاضرة…</div>}
   <div className="lecture-grid"><div className="panel"><h3>النص الكامل</h3>{segments.length?<div className="segments">{segments.map((s,i)=><p key={i}><button className="timestamp" title="وقت المقطع">{stamp(s.start)}</button>{s.speaker&&<b>{s.speaker}: </b>}{s.text}</p>)}</div>:<pre className="source-text">{transcript}</pre>}</div>
   <div className="panel"><h3>ملاحظات Scholar</h3>{notes?<><p className="lecture-summary">{notes.summary}</p><div className="concept-cards">{(notes.keyConcepts||[]).map((x:any,i:number)=><div key={i}><b>{x.title}</b><p>{x.definition}</p></div>)}</div></>:<div className="lecture-empty"><BookOpen/><p>بعد التفريغ اضغط «ملاحظات ذكية» حتى تتحول المحاضرة إلى مادة قابلة للدراسة.</p></div>}</div></div>
  </>}
  {!file&&!recordedParts.length&&!recording&&<div className="lecture-empty hero"><Mic/><h3>سجّل مرة، وادرس منها مرات</h3><p>ScholarMCP يحول التسجيل إلى نص، مفاهيم، بطاقات ومراجعة داخل نفس المادة، بدون تحويلك لمنصة ثانية.</p></div>}
  {saved&&<div className="saved-banner"><CheckCircle2/> المحاضرة صارت جزءًا من Course Brain.</div>}
 </div></div>
}
