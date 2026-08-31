type PuterLike={
  ai?:{
    chat?:(...args:any[])=>Promise<any>;
    img2txt?:(...args:any[])=>Promise<any>;
    speech2txt?:(...args:any[])=>Promise<any>;
    txt2speech?:(...args:any[])=>Promise<any>;
    txt2img?:(...args:any[])=>Promise<any>;
    txt2vid?:(...args:any[])=>Promise<any>;
  };
  auth?:{isSignedIn?:()=>boolean;signIn?:()=>Promise<any>};
};

declare global{interface Window{puter?:PuterLike}}

const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
let lastStatus={stage:'cloud',progress:100,message:'Scholar AI السحابي جاهز'};

async function getPuter(timeout=15000){
  const start=Date.now();
  while(Date.now()-start<timeout){
    if(window.puter?.ai?.chat)return window.puter;
    await sleep(120);
  }
  throw new Error('تعذر الاتصال بمحرك Scholar AI السحابي. تحقق من الإنترنت وأعد المحاولة.');
}

function responseText(value:any):string{
  if(typeof value==='string')return value;
  if(typeof value?.text==='string')return value.text;
  const content=value?.message?.content;
  if(typeof content==='string')return content;
  if(Array.isArray(content))return content.map((x:any)=>typeof x==='string'?x:(x?.text||'')).join('\n');
  if(typeof value?.message==='string')return value.message;
  return '';
}
function stripFence(text:string){return text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim()}
function parseJSON(text:string){
  const cleaned=stripFence(text);
  try{return JSON.parse(cleaned)}catch{}
  const a=cleaned.indexOf('{'),b=cleaned.lastIndexOf('}');
  if(a>=0&&b>a)try{return JSON.parse(cleaned.slice(a,b+1))}catch{}
  throw new Error('وصل رد غير منظم من Scholar AI. أعد المحاولة.');
}
function contextOf(payload:any){return String(payload?.context||'').slice(0,90000)}
function commonRules(){return `
أنت المحرك الأكاديمي الداخلي لمنصة ScholarMCP.
قواعد إلزامية:
1) اعتمد على SOURCE_CONTEXT فقط في أي معلومة تخص المادة. لا تخترع حقائق من خارج المصدر.
2) تجاهل كلمات البنية التقنية مثل SOURCE وPAGE وPDF وDOCX وPPTX كأنها مفاهيم دراسية.
3) عندما لا تجد المعلومة في المصدر قل إنها غير موجودة، ولا تخمّن.
4) حافظ على المصطلحات العلمية الأصلية كما وردت، مع شرح عربي واضح عند الحاجة.
5) أي سؤال أو بطاقة أو ملخص يجب أن يكون قابلاً للتتبع إلى صفحة/مرجع داخل المصدر إن أمكن.
6) أعد JSON صالحاً فقط بلا markdown وبلا مقدمة أو خاتمة.`}
function taskPrompt(action:string,payload:any){
  const ctx=contextOf(payload);
  const rules=commonRules();
  if(action==='chat')return `${rules}\nالمطلوب: أجب عن سؤال الطالب من المصدر حصراً.\nأعد {"text":"...","truth":"supported|unverified","sourceRefs":["ص 1"]}.\nQUESTION: ${String(payload?.question||'')}\nSOURCE_CONTEXT:\n${ctx}`;
  if(action==='summary')return `${rules}\nأنشئ ملخصاً دراسياً دقيقاً لا يختزل التفاصيل التي يمكن أن يأتي منها سؤال امتحان.\nأعد {"summary":"...","keyConcepts":[{"title":"...","definition":"...","sourceRef":"ص N"}],"estimatedCoverage":0,"omitted":[],"examRisk":["..."]}.\nSOURCE_CONTEXT:\n${ctx}`;
  if(action==='flashcards')return `${rules}\nأنشئ ${Math.max(6,Math.min(40,Number(payload?.count)||16))} بطاقة active-recall، كل بطاقة فكرة واحدة، بلا تكرار.\nأعد {"cards":[{"front":"...","back":"...","topic":"...","sourceRef":"ص N"}]}.\nSOURCE_CONTEXT:\n${ctx}`;
  if(action==='quiz')return `${rules}\nأنشئ ${Math.max(5,Math.min(30,Number(payload?.count)||10))} أسئلة امتحانية متنوعة من المصدر. الخيارات الأربعة يجب أن تكون معقولة، لا تجعل الصحيح مكشوفاً بالطول أو الصياغة.\nأعد {"questions":[{"question":"...","choices":["...","...","...","..."],"answerIndex":0,"explanation":"...","sourceRef":"ص N","topic":"...","difficulty":"easy|medium|hard"}]}.\nSOURCE_CONTEXT:\n${ctx}`;
  if(action==='mindmap')return `${rules}\nاستخرج خريطة مفاهيم هرمية حقيقية من المادة.\nأعد {"nodes":[{"id":"root","label":"...","definition":"...","sourceRef":"ص N","parent":null},{"id":"n1","label":"...","definition":"...","sourceRef":"ص N","parent":"root"}]}.\nSOURCE_CONTEXT:\n${ctx}`;
  if(action==='study')return `${rules}\nابنِ جلسة تعلم تفاعلية قصيرة، تبدأ بالفهم ثم الاسترجاع ثم التثبيت، ولا تكتف بملخص.\nأعد {"steps":[{"title":"...","detail":"...","sourceRef":"ص N","prompt":"سؤال استرجاع اختياري"}]}.\nSOURCE_CONTEXT:\n${ctx}`;
  if(action==='translate')return `${rules}\nترجم النص التالي بالكامل إلى ${String(payload?.target||'العربية')}. ممنوع الحذف أو التلخيص. احتفظ بأرقام الصفحات الظاهرة، وبالمصطلح العلمي الأصلي بين قوسين عندما تمنع ترجمته الغموض.\nأعد {"text":"...","glossary":[{"term":"...","translation":"..."}]}.\nSOURCE_CONTEXT:\n${ctx}`;
  if(action==='assignment')return `${rules}\nساعد الطالب على بناء العمل الأكاديمي من المصدر والتعليمات من دون اختلاق مراجع.\nINSTRUCTIONS: ${String(payload?.instructions||'')}\nRUBRIC: ${String(payload?.rubric||'')}\nأعد {"checklist":[{"text":"...","required":true}],"outline":"...","draft":"...","assessment":{"criteria":[{"name":"...","status":"ok|weak|missing","feedback":"..."}],"missing":[]}}.\nSOURCE_CONTEXT:\n${ctx}`;
  if(action==='package')return `${rules}\nحوّل المصدر إلى حزمة سيمنار/عرض أكاديمي قابلة للتعديل.\nأعد {"title":"...","summary":"...","outline":["..."],"slides":[{"title":"...","bullets":["..."],"notes":"..."}],"references":["..."]}. يجب أن تكون الشرائح مختصرة لكن Speaker Notes مفيدة.\nSOURCE_CONTEXT:\n${ctx}`;
  return `${rules}\nACTION: ${action}\nPAYLOAD: ${JSON.stringify({...payload,context:ctx})}`;
}

async function callChat(prompt:string){
  const p=await getPuter();
  lastStatus={stage:'cloud',progress:35,message:'Scholar AI يعالج الطلب على السحابة'};
  let result:any;
  try{result=await p.ai!.chat!(prompt,{model:'gpt-5-nano'})}
  catch(first){
    console.warn('ScholarMCP primary cloud model failed, retrying default',first);
    result=await p.ai!.chat!(prompt);
  }
  lastStatus={stage:'cloud',progress:100,message:'اكتملت المعالجة السحابية'};
  return responseText(result);
}

function translationChunks(raw:string,max=24000){
  const pageParts=raw.split(/(?=\[\[PAGE\s+\d+\]\])/g).filter(Boolean);
  const out:string[]=[];let current='';
  for(const part of pageParts){
    if(part.length>max){
      if(current.trim()){out.push(current);current=''}
      for(let i=0;i<part.length;i+=max)out.push(part.slice(i,i+max));
      continue;
    }
    if(current&&current.length+part.length>max){out.push(current);current=part}else current+=part;
  }
  if(current.trim())out.push(current);
  return out.length?out:[raw];
}
async function translateLong(payload:any){
  const raw=String(payload?.context||'');const parts=translationChunks(raw);const texts:string[]=[];const glossary=new Map<string,string>();
  for(let i=0;i<parts.length;i++){
    lastStatus={stage:'translate',progress:Math.round((i/parts.length)*100),message:`ترجمة الجزء ${i+1} من ${parts.length}`};
    const text=await callChat(taskPrompt('translate',{...payload,context:parts[i]}));
    if(!text)throw new Error(`تعذرت ترجمة الجزء ${i+1}.`);
    const data=parseJSON(text);texts.push(String(data.text||''));
    for(const g of data.glossary||[]){const term=String(g.term||'').trim();if(term&&!glossary.has(term))glossary.set(term,String(g.translation||''))}
  }
  lastStatus={stage:'translate',progress:100,message:'اكتملت ترجمة الملف بالكامل'};
  return {text:texts.join('\n\n'),glossary:[...glossary.entries()].map(([term,translation])=>({term,translation})),parts:parts.length,complete:true};
}

export async function smartTask(action:string,payload:any){
  if(action==='translate'&&String(payload?.context||'').length>70000)return translateLong(payload);
  const prompt=taskPrompt(action,payload);
  const text=await callChat(prompt);
  if(!text)throw new Error('لم يرجع Scholar AI نتيجة قابلة للقراءة.');
  return parseJSON(text);
}

export async function ocrSource(source:File|Blob|string){
  const p=await getPuter();
  lastStatus={stage:'ocr',progress:25,message:'قراءة الصفحة على السحابة'};
  try{
    const result=await p.ai!.img2txt!({source,provider:'mistral'});
    const text=typeof result==='string'?result:responseText(result);
    lastStatus={stage:'ocr',progress:100,message:'اكتملت قراءة الصفحة'};
    return text.trim();
  }catch(first){
    console.warn('Mistral OCR failed, using default OCR',first);
    const result=await p.ai!.img2txt!(source);
    const text=typeof result==='string'?result:responseText(result);
    lastStatus={stage:'ocr',progress:100,message:'اكتملت قراءة الصفحة'};
    return text.trim();
  }
}

export async function structuredOCR(source:File|Blob|string){
  const text=await ocrSource(source);
  return {text,provider:'cloud',handwriting:true};
}
export async function handwrittenOCR(source:File|Blob|string){
  const p=await getPuter();
  try{
    const result=await p.ai!.chat!('اقرأ كل النص المكتوب في هذه الصورة حرفياً. النص قد يكون عربياً أو إنكليزياً ومكتوباً باليد. لا تلخص ولا تشرح. أعد النص فقط.',source,{model:'gpt-5-nano'});
    const text=responseText(result).trim();
    return text||await ocrSource(source);
  }catch{return ocrSource(source)}
}
export function ocrCapabilities(){return {mode:'cloud',printed:true,handwritten:true,multilingual:true,deviceCompute:false}}

export async function speechToText(source:File|Blob|string,options:any={}){
  const p=await getPuter();
  if(!p.ai?.speech2txt)throw new Error('التفريغ الصوتي غير متاح حالياً.');
  lastStatus={stage:'speech',progress:30,message:'تفريغ المحاضرة على السحابة'};
  const result=await p.ai.speech2txt(source,{...options});
  lastStatus={stage:'speech',progress:100,message:'اكتمل تفريغ المحاضرة'};
  return typeof result==='string'?{text:result}:result;
}
export async function textToSpeech(text:string,options:any={}){
  const p=await getPuter();
  if(!p.ai?.txt2speech)throw new Error('الصوت السحابي غير متاح حالياً.');
  return p.ai.txt2speech(text.slice(0,2900),options);
}
export async function generateStudyImage(prompt:string,options:any={}){
  const p=await getPuter();
  if(!p.ai?.txt2img)throw new Error('توليد الصور غير متاح حالياً.');
  return p.ai.txt2img(prompt,options);
}
export async function generateStudyVideo(prompt:string,options:any={}){
  const p=await getPuter();
  if(!p.ai?.txt2vid)throw new Error('توليد الفيديو غير متاح حالياً.');
  return p.ai.txt2vid(prompt,options);
}

export function localAIStatus(){return {...lastStatus,deviceCompute:false}}
export async function resetLocalAI(){lastStatus={stage:'cloud',progress:100,message:'Scholar AI السحابي جاهز'}}
export async function disposeLocalAI(){return}
export async function disposeOCR(){return}
export async function aiAvailable(){try{await getPuter(2500);return true}catch{return false}}
