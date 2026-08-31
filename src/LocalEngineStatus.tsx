import {useEffect,useState} from 'react';
import {CheckCircle2,CircleAlert,Cpu,HardDrive,RefreshCw,ShieldCheck,Wifi,WifiOff} from 'lucide-react';
import {disposeLocalAI,disposeOCR,localAIStatus} from './scholar-engine';
import './engine-status.css';

type Row={label:string;value:string;ok:boolean;note?:string};
export default function LocalEngineStatus(){
 const [rows,setRows]=useState<Row[]>([]);const [busy,setBusy]=useState(false);
 async function inspect(){setBusy(true);try{const ai:any=await localAIStatus();const est=await navigator.storage?.estimate?.().catch(()=>undefined);const persisted=await navigator.storage?.persisted?.().catch(()=>false);const sw='serviceWorker'in navigator?await navigator.serviceWorker.getRegistration().catch(()=>undefined):undefined;const mem=Number((navigator as any).deviceMemory)||0;const items:Row[]=[
  {label:'WebAssembly',value:typeof WebAssembly!=='undefined'?'متاح':'غير متاح',ok:typeof WebAssembly!=='undefined',note:'الحد الأدنى لتشغيل المحركات المحلية'},
  {label:'WebGPU',value:(navigator as any).gpu?'متاح':'غير متاح — سيستخدم WASM',ok:true,note:(navigator as any).gpu?'تسريع أفضل للنماذج':'يشتغل، لكن أبطأ على الأجهزة الضعيفة'},
  {label:'ذاكرة الجهاز',value:mem?`${mem} GB تقريبًا`:'المتصفح لا يكشفها',ok:!mem||mem>=4,note:mem&&mem<4?'استخدم المهام الخفيفة وتجنب تشغيل أكثر من نموذج سويًا':''},
  {label:'Qwen المحلي',value:ai.loaded?'محمّل الآن':'يُحمّل عند أول استخدام',ok:true,note:'أول تشغيل يحتاج إنترنت لتنزيل ملفات النموذج ثم يستفيد من Cache المتصفح'},
  {label:'Whisper',value:'محلي عند الطلب',ok:true,note:'تفريغ المحاضرات يتم على جهازك بعد تنزيل النموذج أول مرة'},
  {label:'OCR',value:'Granite + TrOCR محليان',ok:true,note:'النماذج تُجهّز عند قراءة الصور/الخط اليدوي'},
  {label:'التخزين الدائم',value:persisted?'محمي من التنظيف التلقائي':'غير مثبت',ok:!!persisted,note:persisted?'المتصفح وافق على الحماية':'يمكن طلب التثبيت من قسم حماية البيانات'},
  {label:'مساحة المتصفح',value:est?.quota?`${Math.round((est.usage||0)/1048576)} / ${Math.round(est.quota/1048576)} MB`:'غير معروفة',ok:true},
  {label:'Offline App Shell',value:sw?'مسجل':'يُسجل بعد فتح نسخة الإنتاج',ok:!!sw||!import.meta.env.PROD,note:'يحفظ واجهة التطبيق والملفات التي زرتها؛ لا يعني أن نموذجًا لم يُنزّل بعد صار متاحًا سحريًا'},
  {label:'الاتصال الآن',value:navigator.onLine?'متصل':'غير متصل',ok:true,note:navigator.onLine?'مطلوب فقط للبحث العام وأول تنزيل للنماذج':'المواد المحلية والمحتوى المخزن يبقيان متاحين حسب الكاش'}
 ];setRows(items)}finally{setBusy(false)}}
 useEffect(()=>{void inspect()},[]);
 async function free(){await disposeLocalAI();await disposeOCR();await inspect()}
 return <div className="panel engine-readiness"><div className="section-head"><div><h3>جاهزية الجهاز والأوفلاين</h3><p>الفحص يحدث داخل المتصفح ولا يرسل مواصفات جهازك لأي جهة.</p></div><Cpu/></div><div className="engine-rows">{rows.map((r,i)=><div key={`${r.label}-${i}`}><span className={r.ok?'ok':'warn'}>{r.ok?<CheckCircle2/>:<CircleAlert/>}</span><div><b>{r.label}</b>{r.note&&<small>{r.note}</small>}</div><strong>{r.value}</strong></div>)}</div><div className="engine-actions"><button className="ghost" disabled={busy} onClick={inspect}><RefreshCw className={busy?'spin':''}/> إعادة الفحص</button><button className="ghost" onClick={free}><HardDrive/> حرّر ذاكرة النماذج</button><span><ShieldCheck/> Local-first</span>{navigator.onLine?<Wifi/>:<WifiOff/>}</div></div>
}
