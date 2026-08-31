type AnyObj=Record<string,any>;

const MODEL='onnx-community/Qwen3-0.6B-ONNX';
let generatorPromise:Promise<any>|null=null;
let lastProgress=0;

function emit(status:string,progress?:number){
  if(typeof progress==='number') lastProgress=Math.max(0,Math.min(1,progress));
  window.dispatchEvent(new CustomEvent('scholar-ai-progress',{detail:{status,progress:lastProgress,model:MODEL}}));
}

function hasWebGPU(){return !!(navigator as any).gpu}

async function getGenerator(){
  if(generatorPromise)return generatorPromise;
  generatorPromise=(async()=>{
    emit('جاري تجهيز محرك Scholar AI المحلي…',0.01);
    const {pipeline}=await import('@huggingface/transformers');
    const device=hasWebGPU()?'webgpu':'wasm';
    const dtype=device==='webgpu'?'q4f16':'q4';
    const gen=await pipeline('text-generation',MODEL,{device,dtype,progress_callback:(p:any)=>{
      const v=typeof p?.progress==='number'?p.progress/100:undefined;
      emit(p?.status==='progress'?'جاري تنزيل نموذج Scholar AI لأول مرة…':'جاري تجهيز Scholar AI…',v);
    }} as any);
    emit('Scholar AI جاهز على جهازك',1);
    return gen;
  })().catch(e=>{generatorPromise=null;emit('تعذر تشغيل Scholar AI المحلي',0);throw e});
  return generatorPromise;
}

function stripThink(s:string){return s.replace(/<think>[\s\S]*?<\/think>/gi,'').replace(/```(?:json)?/gi,'').replace(/```/g,'').trim()}
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
  if(a>=0&&b>a){try{return JSON.parse(s.slice(a,b+1))}catch{}}
  throw new Error('Scholar AI رجع نتيجة غير منظمة. أعد المحاولة.')
}

function cleanContext(raw:string){
  return raw.replace(/^SOURCE\s+/gmi,'## المصدر: ').replace(/\b(PDF|DOCX?|PPTX?|SOURCE|FILE)\b/gi,' ').replace(/[ \t]+/g,' ').trim();
}
function pageBlocks(raw:string){
  const parts=raw.split(/\[\[PAGE\s+(\d+)\]\]/i);const out:{page:number,text:string}[]=[];
  if(parts.length>1){for(let i=1;i<parts.length;i+=2){const text=(parts[i+1]||'').trim();if(text)out.push({page:Number(parts[i]),text})}}
  else if(raw.trim())out.push({page:1,text:raw.trim()});
  return out;
}
function scoreBlock(text:string,query:string){
  const q=query.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[];const t=text.toLowerCase();
  return q.reduce((n,w)=>n+(t.includes(w)?2:0),0)+Math.min(3,text.length/1200);
}
function selectContext(raw:string,action:string,payload:AnyObj){
  const blocks=pageBlocks(raw);if(!blocks.length)return cleanContext(raw).slice(0,22000);
  let picked=blocks;
  if(action==='chat')picked=blocks.map(b=>({...b,s:scoreBlock(b.text,String(payload.question||''))})).sort((a:any,b:any)=>b.s-a.s).slice(0,6).sort((a,b)=>a.page-b.page);
  else if(blocks.length>8){
    const idx=new Set<number>();for(let i=0;i<8;i++)idx.add(Math.round(i*(blocks.length-1)/7));picked=[...idx].map(i=>blocks[i]);
  }
  return picked.map(b=>`[[PAGE ${b.page}]]\n${b.text}`).join('\n\n').slice(0,26000);
}

const BASE=`أنت Scholar AI، المحرك الأكاديمي المحلي داخل منصة ScholarMCP. لا ترسل الطالب لأي موقع ولا تعتمد على معرفة خارج المصدر إلا إذا طُلب منك بحث عام.
قواعد إلزامية:
- اعتمد على النص المرفوع فقط في الدراسة والاختبارات. إذا المعلومة غير موجودة قل ذلك.
- [[PAGE N]] علامة صفحة وليست مفهوماً علمياً. كلمات source/page/pdf/docx/pptx/file ممنوع أن تصبح سؤالاً أو مفهوماً أو بطاقة.
- حافظ على المصطلحات العلمية كما وردت، ويمكن شرحها بالعربية الواضحة.
- لا تختصر معلومة امتحانية مهمة لمجرد جعل الناتج قصيراً.
- الأسئلة يجب أن تكون مفهومة بذاتها، وليست ألعاب كلمات. كل MCQ له جواب واحد واضح وتفسير ودليل صفحة.
- عندما يطلب JSON أعد JSON فقط بدون markdown.
- /no_think`;

function taskInstruction(action:string,p:AnyObj){
  switch(action){
    case 'chat':return `سؤال الطالب: ${p.question||''}\nأعد JSON بالشكل {"text":"جواب مباشر مفصل","truth":"supported|unverified","sourceRefs":["ص 1"]}.`;
    case 'summary':return `أنشئ ملخص دراسة شامل ومنظم. أعد JSON {"summary":"ملخص بعناوين ونقاط","keyConcepts":[{"title":"مفهوم علمي","definition":"شرح دقيق","sourceRef":"ص N"}],"estimatedCoverage":0,"omitted":[],"examRisk":[]}. استخرج 8-15 مفهوماً حقيقياً إن أمكن.`;
    case 'flashcards':return `أنشئ ${p.count||12} بطاقات فعالة للاسترجاع النشط من المصدر. أعد JSON {"cards":[{"front":"سؤال واضح","back":"جواب دقيق","topic":"مفهوم","sourceRef":"ص N"}]}. تجنب الأسئلة السطحية.`;
    case 'quiz':return `أنشئ ${p.count||8} أسئلة امتحانية متنوعة MCQ من المصدر. أعد JSON {"questions":[{"question":"السؤال","choices":["أ","ب","ج","د"],"answerIndex":0,"explanation":"لماذا هذه الإجابة صحيحة","sourceRef":"ص N","topic":"مفهوم علمي","difficulty":"easy|medium|hard"}]}. وزع answerIndex بين 0 و3 ولا تجعل الإجابة الصحيحة أطول دائماً.`;
    case 'mindmap':return `كوّن خريطة معرفة هرمية. أعد JSON {"nodes":[{"id":"root","label":"الموضوع المركزي","definition":"...","sourceRef":"ص N","parent":null},{"id":"n1","label":"مفهوم","definition":"...","sourceRef":"ص N","parent":"root"}]}. استخدم 8-20 عقدة حسب المحتوى.`;
    case 'study':return `ابن جلسة دراسة فعلية بنمط ${p.mode||'learn'} والامتحان بعد ${p.daysToExam??'غير محدد'} يوم. الضعف: ${(p.weakTopics||[]).join('، ')||'غير معروف'}. أعد JSON {"steps":[{"title":"عنوان","detail":"شرح/مقارنة/تعريفات أو سؤال استرجاع فعلي من المادة","sourceRefs":["ص N"],"kind":"explain|recall|compare|quiz|memory"}]}. 5-7 خطوات، ممنوع خطوات عامة مثل اقرأ الملزمة فقط.`;
    case 'assignment':return `حلل الواجب. التعليمات: ${p.instructions||''}\nRubric: ${p.rubric||''}\nأعد JSON {"checklist":[{"text":"متطلب","required":true}],"outline":"مخطط","draft":"مسودة من المصدر","assessment":{"criteria":[{"name":"معيار","score":0,"max":10,"note":"سبب"}],"missing":[]}}.`;
    case 'package':return `أنشئ حزمة أكاديمية عن ${p.topic||'المادة'}. أعد JSON {"title":"...","summary":"...","outline":["..."],"slides":[{"title":"عنوان","bullets":["نقطة"],"notes":"ملاحظات المتحدث"}],"references":["المصادر المرفوعة"]}.`;
    default:return `نفذ المهمة ${action} من المصدر وأعد JSON مناسب.`;
  }
}

async function generate(messages:any[],max_new_tokens=900){
  const gen=await getGenerator();emit('Scholar AI يفهم المادة…',1);
  const out=await gen(messages,{max_new_tokens,do_sample:false,repetition_penalty:1.04,return_full_text:false} as any);
  return responseText(out);
}

async function translateChunks(raw:string,target:string){
  const blocks=pageBlocks(raw);const pieces:string[]=[];
  for(const b of blocks.length?blocks:[{page:1,text:raw}]){
    const text=b.text.slice(0,6500);if(!text.trim())continue;
    const out=await generate([{role:'system',content:`أنت مترجم أكاديمي داخل ScholarMCP. ترجم إلى ${target} ترجمة كاملة بدون تلخيص، وحافظ على المصطلحات العلمية. /no_think`},{role:'user',content:text}],1000);
    pieces.push(`[[PAGE ${b.page}]]\n${out}`);
  }
  return {text:pieces.join('\n\n'),glossary:[]};
}

export async function smartTask(action:string,payload:AnyObj){
  const raw=String(payload?.context||'');
  if(action==='translate')return translateChunks(raw,payload?.target||'العربية');
  const context=selectContext(raw,action,payload);
  const text=await generate([{role:'system',content:BASE},{role:'user',content:`${taskInstruction(action,payload)}\n\n--- المصدر ---\n${context}\n--- نهاية المصدر ---`}],action==='summary'||action==='package'?1400:900);
  return parseJson(text);
}

export async function localAIStatus(){
  return {webgpu:hasWebGPU(),model:MODEL,loaded:!!generatorPromise};
}

export function resetLocalAI(){generatorPromise=null;lastProgress=0}
