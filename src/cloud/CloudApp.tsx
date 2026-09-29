import { useEffect, useState } from 'react';
import { ClerkProvider, SignInButton, SignUpButton, UserButton, useAuth, useUser } from '@clerk/react';
import './cloud.css';

const apiBase=String(import.meta.env.VITE_API_BASE_URL||'').replace(/\/$/,'');
const key=String(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY||'');
type Course={id:string;name:string};
type Material={id:string;name:string};
type Wallet={monthly_balance:number;topup_balance:number;plan_code:string};

function Pilot(){
  const {isLoaded,isSignedIn,getToken}=useAuth();
  const {user}=useUser();
  const [name,setName]=useState('');const [major,setMajor]=useState('');
  const [courseName,setCourseName]=useState('');const [course,setCourse]=useState<Course|null>(null);
  const [materialName,setMaterialName]=useState('');const [text,setText]=useState('');
  const [material,setMaterial]=useState<Material|null>(null);const [summary,setSummary]=useState('');
  const [requestKey,setRequestKey]=useState('');
  const [wallet,setWallet]=useState<Wallet|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');

  async function call<T>(path:string,method:'GET'|'POST'='POST',payload?:unknown):Promise<T>{
    const token=await getToken({template:'scholar-api'});
    if(!token)throw new Error('تعذر الحصول على جلسة API. تحقق من إعداد قالب JWT.');
    const response=await fetch(`${apiBase}${path}`,{method,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:payload===undefined?undefined:JSON.stringify(payload)});
    const result=await response.json();
    if(!response.ok){const error=new Error(result.message||result.error||'تعذر إكمال الطلب') as Error&{code?:string};error.code=result.error;throw error}
    return result as T;
  }
  async function run(task:()=>Promise<void>){setBusy(true);setError('');try{await task()}catch(e){setError(e instanceof Error?e.message:'حدث خطأ')}finally{setBusy(false)}}
  useEffect(()=>{if(isSignedIn)setName(user?.fullName||'')},[isSignedIn,user?.fullName]);
  if(!isLoaded)return <main className="cloud-shell"><p>جاري تجهيز الحساب…</p></main>;
  return <main className="cloud-shell" dir="rtl">
    <header><div><strong>ScholarMCP</strong><span>تجربة المسار السحابي</span></div><a href="/">العودة للنسخة الحالية</a>{isSignedIn&&<UserButton/>}</header>
    <section className="cloud-hero"><span>نسخة تجريبية محدودة</span><h1>من نص محاضرتك إلى ملخص محفوظ بحسابك</h1><p>الملخص مولّد آلياً ويحتاج مراجعة مقابل المصدر. هذه التجربة تقبل النص فقط، وتعرض الرصيد قبل كل طلب.</p></section>
    {!isSignedIn?<section className="cloud-card"><h2>ادخل بحسابك للتجربة</h2><div className="cloud-actions"><SignInButton mode="modal"><button>تسجيل الدخول</button></SignInButton><SignUpButton mode="modal"><button className="secondary">إنشاء حساب</button></SignUpButton></div></section>:<>
      <section className="cloud-grid">
        <div className="cloud-card"><small>01 — الملف الدراسي</small><h2>فعّل حسابك</h2><label>اسمك<input value={name} maxLength={100} onChange={e=>setName(e.target.value)}/></label><label>تخصصك<input value={major} maxLength={100} onChange={e=>setMajor(e.target.value)}/></label><button disabled={busy||!name.trim()} onClick={()=>run(async()=>{await call('/api/v1/onboard','POST',{name,major});setWallet(await call('/api/v1/wallet','GET'))})}>حفظ وعرض الرصيد</button>{wallet&&<p className="cloud-balance">رصيد التجربة: {wallet.monthly_balance} كريدت</p>}</div>
        <div className="cloud-card"><small>02 — المادة</small><h2>أضف مادة</h2><label>اسم المادة<input value={courseName} maxLength={160} onChange={e=>setCourseName(e.target.value)} placeholder="مثلاً: الكيمياء العضوية"/></label><button disabled={busy||!wallet||!courseName.trim()} onClick={()=>run(async()=>{setCourse(await call<Course>('/api/v1/courses','POST',{name:courseName}));setMaterial(null);setSummary('');setRequestKey('')})}>إنشاء المادة</button>{course&&<p>المادة المختارة: <b>{course.name}</b></p>}</div>
        <div className="cloud-card"><small>03 — المصدر</small><h2>ألصق نص المحاضرة</h2><label>عنوان المحاضرة<input value={materialName} maxLength={160} onChange={e=>setMaterialName(e.target.value)}/></label><label>نص المحاضرة<textarea value={text} maxLength={30000} onChange={e=>setText(e.target.value)} placeholder="ألصق نصاً من 100 إلى 30000 حرف"/></label><button disabled={busy||!course||!materialName.trim()||text.trim().length<100} onClick={()=>run(async()=>{setMaterial(await call<Material>('/api/v1/materials/text','POST',{courseId:course!.id,name:materialName,text}));setSummary('');setRequestKey('')})}>حفظ النص</button>{material&&<p>حُفظ المصدر: <b>{material.name}</b></p>}</div>
        <div className="cloud-card"><small>04 — الملخص</small><h2>أنشئ ملخصاً</h2><p>الطلب يستهلك كريدت واحد عند النجاح. إذا فشل المزوّد، يرجع الكريدت.</p><button disabled={busy||!material||!wallet||wallet.monthly_balance<1||!!summary} onClick={()=>run(async()=>{const keyForRequest=requestKey||crypto.randomUUID().replaceAll('-','');setRequestKey(keyForRequest);try{const result=await call<{summary?:string;status:string}>('/api/v1/summaries','POST',{materialId:material!.id,idempotencyKey:keyForRequest});if(result.summary)setSummary(result.summary);else if(result.status==='failed')setRequestKey('');else throw new Error('الطلب قيد المعالجة. أعد المحاولة بنفس الزر بعد قليل.');setWallet(await call('/api/v1/wallet','GET'))}catch(e){if((e as {code?:string}).code==='provider_failed')setRequestKey('');throw e}})}>{busy?'جاري التنفيذ…':'إنشاء الملخص'}</button>{wallet&&wallet.monthly_balance<1&&<p>لا يوجد كريدت تجريبي بعد. لا يمكن تشغيل العملية.</p>}</div>
      </section>
      {summary&&<section className="cloud-card cloud-result"><h2>الملخص</h2><p>{summary}</p><small>تحتاج مراجعة النتيجة مقابل نص المحاضرة الأصلي.</small></section>}
    </>}
    {error&&<div role="alert" className="cloud-error">{error}</div>}
  </main>;
}

export default function CloudApp(){
  if(!apiBase||!key)return <main className="cloud-shell" dir="rtl"><section className="cloud-card"><h1>التجربة السحابية غير مفعّلة</h1><p>يلزم إعداد عنوان API ومفتاح النشر الخاص بمزوّد تسجيل الدخول قبل فتحها.</p><a href="/">العودة للموقع</a></section></main>;
  return <ClerkProvider publishableKey={key}><Pilot/></ClerkProvider>;
}
