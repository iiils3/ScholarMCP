const CORE='https://scholarmcp-core-75hnna.v2.appdeploy.ai';
let lastStatus={stage:'cloud',progress:100,message:'Scholar AI الداخلي جاهز'};

async function corePost(path:string,body:unknown){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),120000);
  try{
    const res=await fetch(`${CORE}/api/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal,credentials:'omit'});
    const data=await res.json().catch(()=>({error:`HTTP ${res.status}`}));
    if(!res.ok)throw new Error(String(data?.error||data?.message||`تعذر تنفيذ الطلب (${res.status})`));
    return data;
  }catch(err){
    if((err as Error)?.name==='AbortError')throw new Error('انتهت مهلة Scholar AI. أعد المحاولة.');
    throw err;
  }finally{clearTimeout(timer)}
}

async function blobToBase64(blob:Blob){
  return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>{const value=String(reader.result||'');resolve(value.includes(',')?value.slice(value.indexOf(',')+1):value)};reader.onerror=()=>reject(reader.error||new Error('تعذر قراءة الملف'));reader.readAsDataURL(blob)});
}
async function sourceBlob(source:File|Blob|string){
  if(source instanceof Blob)return source;
  if(/^data:/i.test(source))return fetch(source).then(r=>r.blob());
  if(/^https?:/i.test(source)){const r=await fetch(source,{credentials:'omit'});if(!r.ok)throw new Error('تعذر قراءة المصدر');return r.blob()}
  return new Blob([source],{type:'text/plain'});
}

function translationChunks(raw:string,max=24000){
  const pageParts=raw.split(/(?=\[\[PAGE\s+\d+\]\])/g).filter(Boolean);
  const out:string[]=[];let current='';
  for(const part of pageParts){
    if(part.length>max){if(current.trim()){out.push(current);current=''}for(let i=0;i<part.length;i+=max)out.push(part.slice(i,i+max));continue}
    if(current&&current.length+part.length>max){out.push(current);current=part}else current+=part;
  }
  if(current.trim())out.push(current);
  return out.length?out:[raw];
}
async function translateLong(payload:any){
  const raw=String(payload?.context||'');const parts=translationChunks(raw);const texts:string[]=[];const glossary=new Map<string,string>();
  for(let i=0;i<parts.length;i++){
    lastStatus={stage:'translate',progress:Math.round((i/parts.length)*100),message:`ترجمة الجزء ${i+1} من ${parts.length}`};
    const data:any=await corePost('task',{action:'translate',payload:{...payload,context:parts[i]}});
    texts.push(String(data.text||''));
    for(const g of data.glossary||[]){const term=String(g.term||'').trim();if(term&&!glossary.has(term))glossary.set(term,String(g.translation||''))}
  }
  lastStatus={stage:'translate',progress:100,message:'اكتملت ترجمة الملف بالكامل'};
  return {text:texts.join('\n\n'),glossary:[...glossary.entries()].map(([term,translation])=>({term,translation})),parts:parts.length,complete:true};
}

export async function smartTask(action:string,payload:any){
  if(action==='translate'&&String(payload?.context||'').length>70000)return translateLong(payload);
  lastStatus={stage:'cloud',progress:35,message:'Scholar AI يعالج الطلب داخل المنصة'};
  const data=await corePost('task',{action,payload});
  lastStatus={stage:'cloud',progress:100,message:'اكتملت المعالجة'};
  return data;
}

export async function customTask(prompt:string,context=''){
  lastStatus={stage:'cloud',progress:35,message:'Scholar AI يعالج المهمة الأكاديمية'};
  const data=await corePost('task',{action:'custom',payload:{prompt,context}});
  lastStatus={stage:'cloud',progress:100,message:'اكتملت المهمة الأكاديمية'};
  return data;
}

export async function ocrSource(source:File|Blob|string){
  const blob=await sourceBlob(source);
  if(blob.size>6_000_000)throw new Error('الصورة كبيرة جداً للقراءة. قلل حجمها أو ارفعها كـPDF.');
  lastStatus={stage:'ocr',progress:25,message:'Scholar OCR يقرأ الصفحة داخل المنصة'};
  const data=await blobToBase64(blob);
  const result:any=await corePost('ocr',{data,mimeType:blob.type||'image/jpeg'});
  lastStatus={stage:'ocr',progress:100,message:'اكتملت قراءة الصفحة'};
  return String(result.text||'').trim();
}
export async function structuredOCR(source:File|Blob|string){const text=await ocrSource(source);return {text,provider:'scholarmcp-core',handwriting:true}}
export async function handwrittenOCR(source:File|Blob|string){
  const blob=await sourceBlob(source);const data=await blobToBase64(blob);
  const result:any=await corePost('ocr',{data,mimeType:blob.type||'image/jpeg',prompt:'اقرأ كل النص المكتوب في الصورة حرفياً. قد يكون عربياً أو إنكليزياً أو بخط اليد. لا تلخص ولا تشرح.'});
  return String(result.text||'').trim();
}
export function ocrCapabilities(){return {mode:'scholarmcp-core',printed:true,handwritten:true,multilingual:true,deviceCompute:false}}

export async function speechToText(source:File|Blob|string,_options:any={}){
  const blob=await sourceBlob(source);
  if(blob.size>4_000_000)throw new Error('التسجيل كبير جداً كقطعة واحدة. ScholarMCP سيقسّم المحاضرات الطويلة إلى مقاطع في التحديث التالي.');
  lastStatus={stage:'speech',progress:30,message:'تفريغ المحاضرة داخل ScholarMCP'};
  const data=await blobToBase64(blob);
  const result:any=await corePost('transcribe',{data,mimeType:blob.type||'audio/webm'});
  lastStatus={stage:'speech',progress:100,message:'اكتمل تفريغ المحاضرة'};
  return {text:String(result.text||''),segments:Array.isArray(result.segments)?result.segments:[]};
}

export async function textToSpeech(text:string,_options:any={}){
  if(!('speechSynthesis'in window))throw new Error('القراءة الصوتية غير مدعومة على هذا الجهاز.');
  window.speechSynthesis.cancel();
  const utterance=new SpeechSynthesisUtterance(text.slice(0,9000));utterance.lang=/[\u0600-\u06ff]/.test(text)?'ar-IQ':'en-US';utterance.rate=.95;window.speechSynthesis.speak(utterance);return true;
}
export async function generateStudyImage(_prompt:string,_options:any={}){throw new Error('مولد الرسوم الدراسية قيد الربط بالمحرك الداخلي.')}
export async function generateStudyVideo(_prompt:string,_options:any={}){throw new Error('مولد الفيديو الدراسي قيد الربط بالمحرك الداخلي.')}

export function localAIStatus(){return {...lastStatus,deviceCompute:false,provider:'scholarmcp-core'}}
export async function resetLocalAI(){lastStatus={stage:'cloud',progress:100,message:'Scholar AI الداخلي جاهز'}}
export async function disposeLocalAI(){return}
export async function disposeOCR(){return}
export async function aiAvailable(){try{const res=await fetch(`${CORE}/api/_healthcheck`,{credentials:'omit'});return res.ok}catch{return false}}
