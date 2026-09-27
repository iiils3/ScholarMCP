import {useEffect,useState} from 'react';
import {CheckCircle2,CircleAlert,Cloud,RefreshCw,ShieldCheck,Wifi,WifiOff} from 'lucide-react';
import {aiAvailable,localAIStatus} from './scholar-engine';
import './engine-status.css';

type Row={label:string;value:string;ok:boolean;note?:string};
export default function LocalEngineStatus(){
 const [rows,setRows]=useState<Row[]>([]);const [busy,setBusy]=useState(false);
 async function inspect(){setBusy(true);try{const ai:any=await localAIStatus();const sw='serviceWorker'in navigator?await navigator.serviceWorker.getRegistration().catch(()=>undefined):undefined;const online=navigator.onLine;const items:Row[]=[
  {label:'Scholar AI',value:ai.model||'Cloud AI',ok:aiAvailable(),note:'المعالجة الذكية تتم عبر محرك سحابي، بدون تنزيل نموذج AI على جهاز الطالب'},
  {label:'OCR',value:'Cloud Mistral',ok:online,note:'استخراج النص من الصور والصفحات الممسوحة يتم سحابياً'},
  {label:'Lecture Speech-to-Text',value:'Cloud OpenAI',ok:online,note:'تفريغ المحاضرات الصوتية يتم عبر خدمة سحابية'},
  {label:'Text-to-Speech',value:'Cloud Gemini TTS',ok:online,note:'النطق الصوتي لا يعتمد على نموذج محلي'},
  {label:'Offline App Shell',value:sw?'مسجل':'يُسجل بعد فتح نسخة الإنتاج',ok:!!sw||!import.meta.env.PROD,note:'الأوفلاين يحفظ واجهة التطبيق، لكنه لا يحوّل الذكاء السحابي إلى محلي'},
  {label:'الاتصال الآن',value:online?'متصل':'غير متصل',ok:online,note:online?'جاهز للمهام السحابية':'الذكاء السحابي يحتاج اتصالاً بالإنترنت'}
 ];setRows(items)}finally{setBusy(false)}}
 useEffect(()=>{void inspect()},[]);
 return <div className="panel engine-readiness"><div className="section-head"><div><h3>جاهزية المحركات السحابية</h3><p>الفحص يوضح اتصال Scholar AI والخدمات المرتبطة به.</p></div><Cloud/></div><div className="engine-rows">{rows.map((r,i)=><div key={`${r.label}-${i}`}><span className={r.ok?'ok':'warn'}>{r.ok?<CheckCircle2/>:<CircleAlert/>}</span><div><b>{r.label}</b>{r.note&&<small>{r.note}</small>}</div><strong>{r.value}</strong></div>)}</div><div className="engine-actions"><button className="ghost" disabled={busy} onClick={inspect}><RefreshCw className={busy?'spin':''}/> إعادة الفحص</button><span><ShieldCheck/> Cloud-first</span>{navigator.onLine?<Wifi/>:<WifiOff/>}</div></div>
}