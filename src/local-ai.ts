type AnyObj=Record<string,any>;
type Block={source:string;page:number;text:string};
const MODEL='onnx-community/Qwen3-0.6B-ONNX';
let generatorPromise:Promise<any>|null=null;
let lastProgress=0;

function emit(status:string,progress?:number){
  if(typeof progress==='number')lastProgress=Math.max(0,Math.min(1,progress));
  window.dispatchEvent(new CustomEvent('scholar-ai-progress',{detail:{status,progress:lastProgress,model:MODEL,local:true}}));
}
function hasWebGPU(){return !!(navigator as any).gpu}
function deviceMemory(){return Number((navigator as any).deviceMemory)||0}

async function getGenerator(){
  if(generatorPromise)return generatorPromise;
  generatorPromise=(async()=>{
    emit('جاري تجهيز Scholar AI على جهازك…',.01);
    const {pipeline}=await import('@huggingface/transformers');
    const device=hasWebGPU()?'webgpu':'wasm';
    const dtype=device==='webgpu'?'q4f16':'q4';
    const gen=await pipeline('text-generation',MODEL,{device,dtype,progress_callback:(p:any)=>{
      const progress=typeof p?.progress==='number'?p.progress/100:undefined;
      emit(p?.status==='progress'?'تنزيل نموذج Scholar AI لأول مرة…':'جاري تجهيز Scholar AI المحلي…',progress);
    }} as any);
    emit('Scholar AI جاهز على جهازك',1);
    return gen;
  })().catch(e=>{generatorPromise=null;emit('تعذر تشغيل Scholar AI المحلي',0);throw e});
  return generatorPromise;
}

function stripThink(s:string){return s.replace(/<think>[\s\S]*?<\/think>/gi,'').replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim()}
function responseText(out:any){
  const x=Array.isArray(out)?out[0]?.generated_text:out?.generated_text??out;
  if(typeof x==='string')return stripThink(x);
  if(Array.isArray(x)){
    const last=[...x].reverse().find((m:any)=>m?.role==='assistant')||x[x.length-1];
    return stripThink(String(last?.content??last?.text??''));
  }
  return stripThink(String(x?.content??x??''));
}
function parseJson(text:string){
  const s=stripThink(text);
  try{return JSON.parse(s)}catch{}
  const a=s.indexOf('{'),b=s.lastIndexOf('}');
  if(a>=0&&b>a)try{return JSON.parse(s.slice(a,b+1))}catch{}
  throw new Error('Scholar AI رجع نتيجة غير منظمة. أعد المحاولة.');
}

function pageBlocks(raw:string):Block[]{
  const lines=raw.split(/\r?\n/);const out:Block[]=[];let source='المصدر';let page=1;let buf:string[]=[];
  const flush=()=>{const text=buf.join('\n').trim();if(text)out.push({source,page,text});buf=[]};
  for(const line of lines){
    const sm=line.match(/^SOURCE\s+(.+)$/i);if(sm){flush();source=sm[1].trim();continue}
    const pm=line.match(/^\[\[PAGE\s+(\d+)\]\]$/i);if(pm){flush();page=Number(pm[1]);continue}
    buf.push(line);
  }
  flush();return out;
}
function scoreBlock(b:Block,query:string){
  const q=query.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[];const t=b.text.toLowerCase();
  return q.reduce((n,w)=>n+(t.includes(w)?2:0),0)+Math.min(3,b.text.length/1200);
}
function printBlock(b:Block){return `[[SOURCE ${b.source}]] [[PAGE ${b.page}]]\n${b.text}`}
function selectContext(raw:string,action:string,payload:AnyObj){
  const blocks=pageBlocks(raw);if(!blocks.length)return raw.slice(0,26000);
  const query=String(payload.question||payload.prompt||payload.topic||payload.instructions||'');
  let picked=blocks;
  if(action==='chat'||action==='custom'||action==='assignment')picked=blocks.map(b=>({...b,s:scoreBlock(b,query)})).sort((a:any,b:any)=>b.s-a.s).slice(0,9);
  else if(blocks.length>12){const idx=new Set<number>();for(let i=0;i<12;i++)idx.add(Math.round(i*(blocks.length-1)/11));picked=[...idx].map(i=>blocks[i])}
  return picked.map(printBlock).join('\n\n').slice(0,30000);
}

const REF='اسم الملف — ص N';
const BASE=`أنت Scholar AI، المحرك الأكاديمي المحلي داخل ScholarMCP. كل المعالجة تتم داخل جهاز الطالب ولا يوجد مزود محادثة خارجي.
قواعد إلزامية:
- اعتمد على المصدر المرفوع فقط في المعلومات الأكاديمية. إذا المعلومة غير موجودة قل ذلك بوضوح.
- [[SOURCE name]] و[[PAGE N]] علامات مرجعية وليست مفاهيم علمية. كلمات source/page/pdf/docx/pptx/file ممنوع أن تصبح سؤالاً أو مفهوماً أو بطاقة.
- كل استشهاد يجب أن يكون بصيغة "${REF}" وباسم المصدر الظاهر في [[SOURCE]].
- حافظ على المصطلحات العلمية كما وردت، واشرح بالعربية الواضحة بدون حذف تفاصيل امتحانية.
- الاختبار يقيس الفهم والتذكر، لا أسماء الملفات أو علامات الصفحات.
- لا تختلق مراجع أو أسماء مؤلفين أو أرقام صفحات.
- عندما يطلب JSON أعد JSON صالحاً فقط بدون markdown أو مقدمة. /no_think`;

function taskInstruction(action:string,p:AnyObj){
  switch(action){
    case'chat':return`سؤال الطالب: ${p.question||''}\nأعد {"text":"جواب مباشر مفصل","truth":"supported|unverified","sourceRefs":["${REF}"]}.`;
    case'summary':return`أنشئ ملخص دراسة شامل ومنظم. أعد {"summary":"ملخص بعناوين ونقاط","keyConcepts":[{"title":"مفهوم علمي","definition":"شرح دقيق","sourceRef":"${REF}"}],"estimatedCoverage":0,"omitted":[],"examRisk":[]}. استخرج 8-15 مفهوماً حقيقياً.`;
    case'flashcards':return`أنشئ ${p.count||12} بطاقات قصيرة وفق minimum information principle. أعد {"cards":[{"front":"سؤال واحد واضح","back":"جواب دقيق غير متشعب","topic":"مفهوم","sourceRef":"${REF}"}]}.`;
    case'quiz':return`أنشئ ${p.count||8} MCQ امتحانية متنوعة. أعد {"questions":[{"question":"سؤال علمي مكتمل","choices":["أ","ب","ج","د"],"answerIndex":0,"explanation":"سبب الصحة وسبب رفض المشتتات عند الحاجة","sourceRef":"${REF}","topic":"مفهوم علمي","difficulty":"easy|medium|hard"}]}. وزع answerIndex ولا تجعل الصحيح أطول دائماً.`;
    case'mindmap':return`كوّن خريطة معرفة هرمية. أعد {"nodes":[{"id":"root","label":"الموضوع المركزي","definition":"...","sourceRef":"${REF}","parent":null},{"id":"n1","label":"مفهوم","definition":"...","sourceRef":"${REF}","parent":"root"}]}. 8-20 عقدة.`;
    case'study':return`ابن جلسة فعلية بنمط ${p.mode||'learn'} والامتحان بعد ${p.daysToExam??'غير محدد'} يوم. الضعف: ${(p.weakTopics||[]).join('، ')||'غير معروف'}. أعد {"steps":[{"title":"عنوان","detail":"محتوى شرح/مقارنة/استرجاع فعلي من المادة","sourceRefs":["${REF}"],"kind":"explain|recall|compare|quiz|memory"}]}. 5-7 خطوات.`;
    case'assignment':return`حلل الواجب. التعليمات: ${p.instructions||''}\nRubric: ${p.rubric||''}\nأعد {"checklist":[{"text":"متطلب","required":true}],"outline":"مخطط","draft":"مسودة من المصدر مع استشهادات الصفحات","assessment":{"criteria":[{"name":"معيار","score":0,"max":10,"note":"سبب"}],"missing":[]}}.`;
    case'package':return`أنشئ حزمة أكاديمية عن ${p.topic||'المادة'}. أعد {"title":"...","summary":"...","outline":["..."],"slides":[{"title":"عنوان","bullets":["نقطة"],"notes":"ملاحظات المتحدث"}],"references":["${REF}"]}.`;
    case'custom':return`${String(p.prompt||'نفّذ المهمة الأكاديمية المطلوبة.')}`;
    default:return`نفذ المهمة الأكاديمية ${action} من المصدر وأعد JSON.`;
  }
}

async function generate(messages:any[],max_new_tokens=900){
  const gen=await getGenerator();emit('Scholar AI يعالج المادة محليًا…',1);
  return responseText(await gen(messages,{max_new_tokens,do_sample:false,repetition_penalty:1.04,return_full_text:false} as any));
}
async function translateChunks(raw:string,target:string,glossaryLock:string[]=[]){
  const blocks=pageBlocks(raw),pieces:string[]=[];
  const locked=[...new Set(glossaryLock.map(x=>String(x).trim()).filter(Boolean))].slice(0,120);
  const lockRule=locked.length?`\nGlossary Lock إلزامي: اترك هذه المصطلحات حرفياً كما هي دون ترجمة أو تغيير تهجئة: ${locked.join(' | ')}.`:'';
  for(const b of blocks.length?blocks:[{source:'المصدر',page:1,text:raw}]){
    if(!b.text.trim())continue;
    for(let i=0;i<b.text.length;i+=6200){
      const chunk=b.text.slice(i,i+6200);
      const out=await generate([{role:'system',content:`ترجم أكاديميًا إلى ${target} ترجمة كاملة بلا تلخيص. حافظ على المصطلحات العلمية والمعنى وترتيب الفقرات.${lockRule} أعد الترجمة فقط. /no_think`},{role:'user',content:chunk}],1100);
      pieces.push(`SOURCE ${b.source}\n[[PAGE ${b.page}]]\n${out}`);
    }
  }
  return{text:pieces.join('\n\n'),glossary:locked.map(term=>({term,translation:term,locked:true})),glossaryLock:locked,complete:true};
}

export async function smartTask(action:string,payload:AnyObj){
  const raw=String(payload?.context||'');
  if(action==='translate')return translateChunks(raw,payload?.target||'العربية',Array.isArray(payload?.glossaryLock)?payload.glossaryLock:[]);
  const context=selectContext(raw,action,payload);
  const max=action==='summary'||action==='package'||action==='custom'?1500:950;
  const text=await generate([{role:'system',content:BASE},{role:'user',content:`${taskInstruction(action,payload)}\n\n--- المصدر ---\n${context}\n--- نهاية المصدر ---`}],max);
  return parseJson(text);
}
export async function customTask(prompt:string,context=''){
  return smartTask('custom',{prompt,context});
}
export async function localAIStatus(){return{webgpu:hasWebGPU(),model:MODEL,loaded:!!generatorPromise,deviceMemory:deviceMemory(),local:true}}
export async function disposeLocalAI(){try{const p:any=await generatorPromise;p?.dispose?.()}catch{}generatorPromise=null;lastProgress=0}
export function resetLocalAI(){generatorPromise=null;lastProgress=0}
