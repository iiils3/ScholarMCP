import { useEffect, useState } from 'react';
import { createAuthClient } from '@neondatabase/neon-js/auth';
import { BetterAuthVanillaAdapter } from '@neondatabase/neon-js';
import './cloud.css';

const apiBase=String(import.meta.env.VITE_API_BASE_URL||'').replace(/\/$/,'');
const authUrl=String(import.meta.env.VITE_NEON_AUTH_URL||'');
const createPilotAuth=(url:string)=>createAuthClient(url,{adapter:BetterAuthVanillaAdapter({fetchOptions:{credentials:'include'}})});
type Course={id:string;name:string};
type Material={id:string;name:string};
type Wallet={monthly_balance:number;topup_balance:number;plan_code:string};
type LocalCourse={id:string;name:string};
type LocalMaterial={id:string;courseId:string;name:string;text:string};
type CloudProps={embedded?:boolean;profile?:{name:string;major?:string};localCourses?:LocalCourse[];localMaterials?:LocalMaterial[];onSummary?:(summary:string,courseId?:string)=>void};

function Pilot({authClient,embedded=false,profile,localCourses=[],localMaterials=[],onSummary}:{authClient:ReturnType<typeof createPilotAuth>}&CloudProps){
  const [isLoaded,setLoaded]=useState(false);const [isSignedIn,setSignedIn]=useState(false);
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [signUp,setSignUp]=useState(false);
  const [name,setName]=useState(profile?.name||'');const [major,setMajor]=useState(profile?.major||'');
  const [courseName,setCourseName]=useState('');const [course,setCourse]=useState<Course|null>(null);
  const [localCourseId,setLocalCourseId]=useState('');
  const [materialName,setMaterialName]=useState('');const [text,setText]=useState('');
  const [material,setMaterial]=useState<Material|null>(null);const [summary,setSummary]=useState('');
  const [requestKey,setRequestKey]=useState('');
  const [sourceConsent,setSourceConsent]=useState(false);
  const [wallet,setWallet]=useState<Wallet|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');

  async function call<T>(path:string,method:'GET'|'POST'='POST',payload?:unknown):Promise<T>{
    const {data,error:authError}=await authClient.getSession();
    const token=data?.session?.token;
    if(authError||!token)throw new Error('انتهت الجلسة. سجل الدخول مجدداً.');
    const response=await fetch(`${apiBase}${path}`,{method,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:payload===undefined?undefined:JSON.stringify(payload)});
    const result=await response.json();
    if(!response.ok){const error=new Error(result.message||result.error||'تعذر إكمال الطلب') as Error&{code?:string};error.code=result.error;throw error}
    return result as T;
  }
  async function run(task:()=>Promise<void>){setBusy(true);setError('');try{await task()}catch(e){setError(e instanceof Error?e.message:'حدث خطأ')}finally{setBusy(false)}}
  useEffect(()=>{let active=true;authClient.getSession().then(({data})=>{if(active){setSignedIn(!!data?.session);setName(data?.user?.name||'');setLoaded(true)}}).catch(()=>{if(active)setLoaded(true)});return()=>{active=false}},[authClient]);
  async function authenticate(){await run(async()=>{const result=signUp?await authClient.signUp.email({name:email.split('@')[0]||'طالب',email,password}):await authClient.signIn.email({email,password});if(result.error)throw new Error(result.error.message||'تعذر تسجيل الدخول');const session=await authClient.getSession();if(!session.data?.session)throw new Error('تحقق من بريدك الإلكتروني ثم سجل الدخول.');setSignedIn(true);setName(session.data.user?.name||'')})}
  async function signOut(){await run(async()=>{const result=await authClient.signOut();if(result.error)throw new Error(result.error.message||'تعذر الخروج');setSignedIn(false);setWallet(null);setCourse(null);setMaterial(null);setSummary('')})}
  if(!isLoaded)return <div className={`cloud-shell ${embedded?'cloud-embedded':''}`}><p>جاري تجهيز الحساب…</p></div>;
  return <div className={`cloud-shell ${embedded?'cloud-embedded':''}`} dir="rtl">
    <header><div><strong>ScholarMCP</strong><span>التلخيص السحابي</span></div>{!embedded&&<a href="/">العودة للمنصة</a>}{isSignedIn&&<button className="cloud-signout" onClick={signOut}>تسجيل الخروج</button>}</header>
    <section className="cloud-hero"><span>نسخة تجريبية محدودة</span><h1>من نص محاضرتك إلى ملخص محفوظ بحسابك</h1><p>الملخص مولّد آلياً ويحتاج مراجعة مقابل المصدر. هذه التجربة تقبل النص فقط، وتعرض الرصيد قبل كل طلب.</p></section>
    {!isSignedIn?<section className="cloud-card cloud-auth"><h2>{signUp?'إنشاء حساب':'تسجيل الدخول'}</h2><form onSubmit={e=>{e.preventDefault();void authenticate()}}><label>البريد الإلكتروني<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>كلمة المرور<input type="password" minLength={8} autoComplete={signUp?'new-password':'current-password'} required value={password} onChange={e=>setPassword(e.target.value)}/></label><div className="cloud-actions"><button disabled={busy}>{busy?'جاري التنفيذ…':signUp?'إنشاء حساب':'دخول'}</button><button type="button" className="secondary" onClick={()=>setSignUp(!signUp)}>{signUp?'عندي حساب':'حساب جديد'}</button></div></form></section>:<>
      <section className="cloud-grid">
        <div className="cloud-card"><small>01 — الملف الدراسي</small><h2>فعّل حسابك</h2><label>اسمك<input value={name} maxLength={100} onChange={e=>setName(e.target.value)}/></label><label>تخصصك<input value={major} maxLength={100} onChange={e=>setMajor(e.target.value)}/></label><button disabled={busy||!name.trim()} onClick={()=>run(async()=>{await call('/api/v1/onboard','POST',{name,major});setWallet(await call('/api/v1/wallet','GET'))})}>حفظ وعرض الرصيد</button>{wallet&&<p className="cloud-balance">رصيد التجربة: {wallet.monthly_balance} كريدت</p>}</div>
        <div className="cloud-card"><small>02 — المادة</small><h2>أضف مادة</h2>{localCourses.length>0&&<label>من مواد منصتك<select value={localCourseId} onChange={e=>{const id=e.target.value;setLocalCourseId(id);setCourseName(localCourses.find(c=>c.id===id)?.name||'');setCourse(null);setMaterial(null);setMaterialName('');setText('');setSummary('');setSourceConsent(false)}}><option value="">مادة جديدة</option>{localCourses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}<label>اسم المادة<input value={courseName} maxLength={160} onChange={e=>setCourseName(e.target.value)} placeholder="مثلاً: الكيمياء العضوية"/></label><button disabled={busy||!wallet||!courseName.trim()} onClick={()=>run(async()=>{setCourse(await call<Course>('/api/v1/courses','POST',{name:courseName}));setMaterial(null);setSummary('');setRequestKey('');setSourceConsent(false)})}>تجهيز المادة سحابياً</button>{course&&<p>المادة المختارة: <b>{course.name}</b></p>}</div>
        <div className="cloud-card"><small>03 — المصدر</small><h2>نص المحاضرة</h2>{localCourseId&&<label>من مصادر منصتك<select value="" onChange={e=>{const source=localMaterials.find(m=>m.id===e.target.value);if(source){setMaterialName(source.name);setText(source.text);setMaterial(null);setSummary('');setSourceConsent(false)}}}><option value="">اختر مصدراً نصياً</option>{localMaterials.filter(m=>m.courseId===localCourseId&&m.text.trim().length>=100&&m.text.length<=30000).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>}<label>عنوان المحاضرة<input value={materialName} maxLength={160} onChange={e=>setMaterialName(e.target.value)}/></label><label>نص المحاضرة<textarea value={text} maxLength={30000} onChange={e=>setText(e.target.value)} placeholder="ألصق نصاً من 100 إلى 30000 حرف"/></label><button disabled={busy||!course||!materialName.trim()||text.trim().length<100} onClick={()=>run(async()=>{setMaterial(await call<Material>('/api/v1/materials/text','POST',{courseId:course!.id,name:materialName,text}));setSummary('');setRequestKey('');setSourceConsent(false)})}>حفظ النص سحابياً</button>{material&&<p>حُفظ المصدر: <b>{material.name}</b></p>}</div>
        <div className="cloud-card"><small>04 — الملخص</small><h2>أنشئ ملخصاً</h2><p>الطلب يستهلك كريدت واحد عند النجاح. إذا فشل المزوّد، يرجع الكريدت.</p><label className="cloud-consent"><input type="checkbox" checked={sourceConsent} onChange={e=>setSourceConsent(e.target.checked)}/><span>أوافق على إرسال نص هذه المحاضرة إلى مزوّد الذكاء الاصطناعي لإنشاء الملخص.</span></label><button disabled={busy||!material||!wallet||wallet.monthly_balance<1||!!summary||!sourceConsent} onClick={()=>run(async()=>{const keyForRequest=requestKey||crypto.randomUUID().replaceAll('-','');setRequestKey(keyForRequest);try{const result=await call<{summary?:string;status:string}>('/api/v1/summaries','POST',{materialId:material!.id,idempotencyKey:keyForRequest,sourceConsent});if(result.summary){setSummary(result.summary);onSummary?.(result.summary,localCourseId||undefined)}else if(result.status==='failed')setRequestKey('');else throw new Error('الطلب قيد المعالجة. أعد المحاولة بنفس الزر بعد قليل.');setWallet(await call('/api/v1/wallet','GET'))}catch(e){if((e as {code?:string}).code==='provider_failed')setRequestKey('');throw e}})}>{busy?'جاري التنفيذ…':'إنشاء الملخص'}</button>{wallet&&wallet.monthly_balance<1&&<p>لا يوجد كريدت تجريبي بعد. لا يمكن تشغيل العملية.</p>}</div>
      </section>
      {summary&&<section className="cloud-card cloud-result"><h2>الملخص</h2><p>{summary}</p><small>تحتاج مراجعة النتيجة مقابل نص المحاضرة الأصلي.</small></section>}
    </>}
    {error&&<div role="alert" className="cloud-error">{error}</div>}
  </div>;
}

const sharedAuth=apiBase&&authUrl?createPilotAuth(authUrl):null;
export default function CloudApp(props:CloudProps){
  if(!sharedAuth)return <div className="cloud-shell" dir="rtl"><section className="cloud-card"><h1>التلخيص السحابي غير متاح</h1><p>يلزم إعداد عنوان API وعنوان تسجيل الدخول.</p></section></div>;
  return <Pilot authClient={sharedAuth} {...props}/>;
}
