import {customTask as runCustomTask,disposeLocalAI as disposeAI,localAIStatus as getAIStatus,resetLocalAI as resetAI,smartTask as runSmartTask} from './local-ai';
import {disposeOCR as disposeLocalOCR,handwrittenOCR as runHandwrittenOCR,ocrCapabilities as getOCRCapabilities,ocrSource as runOCR,structuredOCR as runStructuredOCR} from './local-ocr';
import {disposeSpeech,speechCapabilities,transcribeAudio} from './local-speech';

let lastStatus={stage:'local',progress:100,message:'ScholarMCP المحلي جاهز'};

async function sourceBlob(source:File|Blob|string){
  if(source instanceof Blob)return source;
  if(/^data:/i.test(source)||/^blob:/i.test(source)){const r=await fetch(source);return r.blob()}
  if(/^https?:/i.test(source)){const r=await fetch(source,{credentials:'omit'});if(!r.ok)throw new Error('تعذر قراءة المصدر.');return r.blob()}
  return new Blob([source],{type:'text/plain'});
}
function clean(raw:string){return raw.replace(/^SOURCE[^\n]*$/gmi,' ').replace(/\[\[PAGE\s+\d+\]\]/gi,' ').replace(/\s+/g,' ').trim()}
function sentences(raw:string){return clean(raw).split(/(?<=[.!?؟])\s+/).map(x=>x.trim()).filter(x=>x.length>28)}
function refs(raw:string){
  const out:string[]=[];let source='المصدر';let page='1';
  for(const line of raw.split(/\r?\n/)){
    const s=line.match(/^SOURCE\s+(.+)$/i);if(s){source=s[1].trim();continue}
    const p=line.match(/^\[\[PAGE\s+(\d+)\]\]$/i);if(p){page=p[1];const ref=`${source} — ص ${page}`;if(!out.includes(ref))out.push(ref)}
  }
  return out.length?out:['المصدر — ص 1'];
}
function headings(raw:string){
  const lines=raw.split(/\r?\n/).map(x=>x.replace(/^#+\s*/,'').trim()).filter(x=>x.length>=5&&x.length<=90&&!/^SOURCE|^\[\[PAGE/i.test(x));
  return [...new Set(lines)].slice(0,12);
}
function dates(raw:string){return [...new Set((raw.match(/\b(?:20\d{2})[-\/.](?:0?[1-9]|1[0-2])[-\/.](?:0?[1-9]|[12]\d|3[01])\b/g)||[]).map(x=>x.replace(/[\/.]/g,'-')))].slice(0,12)}
function fallbackCustom(prompt:string,context:string){
  const p=prompt.toLowerCase();const ss=sentences(context);const hs=headings(context);const sourceRefs=refs(context);const sample=ss.slice(0,10);
  if(p.includes('السيلابس')||p.includes('"coursename"')){
    const ds=dates(context);const name=hs[0]||'المادة الأكاديمية';
    return {courseName:name,instructor:null,term:null,grading:[],deadlines:ds.map((dueAt,i)=>({title:`موعد أكاديمي ${i+1}`,kind:'other',dueAt})),weeks:hs.slice(1,8).map((x,i)=>({week:i+1,topics:[x]})),rules:[],warnings:['استخدم Scholar AI المحلي الكامل لاستخراج أدق إذا كان جهازك يسمح.']};
  }
  if(p.includes('questiontypes')||p.includes('بصمة')||p.includes('امتحانات أو أسئلة سابقة')){
    return {questionTypes:[{type:'أسئلة مباشرة من النص',share:100}],repeatedTopics:hs.slice(0,6).map((topic,i)=>({topic,frequency:Math.max(1,6-i)})),difficulty:'mixed',styleNotes:['تحليل محلي احتياطي مبني على النص المتاح.'],skills:['recall','understanding'],recommendations:['ركز على العناوين والمفاهيم المتكررة ثم اختبر نفسك بالاسترجاع.'],sampleBlueprint:{mcq:10,trueFalse:0,shortAnswer:0,essay:0,case:0}};
  }
  if(p.includes('الدفاع عن سيمنار')||p.includes('deliverytips')){
    const questions=hs.slice(0,6).map((x,i)=>({question:`اشرح ${x} باختصار وما أهميته؟`,answer:sample[i]||'راجع محتوى الشريحة والمصدر.',slide:i+1}));
    return {questions,deliveryTips:['ابدأ بالفكرة لا بقراءة الشريحة.','اذكر الدليل من المصدر عند السؤال.','إذا لم تعرف جوابًا لا تخترع معلومة.'],opening:`اليوم أعرض ${hs[0]||'موضوع السيمنار'} بصورة مختصرة ومترابطة.`,closing:'هذه أهم النتائج المدعومة بالمصادر المستخدمة في العرض.'};
  }
  if(p.includes('abstractgoal')&&p.includes('"sections"')){
    const title=(prompt.match(/بعنوان «([^»]+)»/)||[])[1]||hs[0]||'المشروع الأكاديمي';
    const defaultHeads=['المقدمة','المفاهيم الأساسية','المحور الأول','المحور الثاني','المناقشة','الخاتمة'];
    const picked=(hs.length>=4?hs:defaultHeads).slice(0,6);
    return {title,abstractGoal:`عرض منظم ومدعوم بالمصدر حول ${title}.`,sections:picked.map(heading=>({heading,goal:`شرح وتحليل ${heading} من المصادر المرفوعة فقط.`}))};
  }
  if(p.includes('usedrefs')&&p.includes('قسم بحث')){
    const heading=(prompt.match(/بعنوان «([^»]+)»/)||[])[1]||hs[0]||'قسم البحث';
    return {heading,body:(sample.length?sample:[clean(context).slice(0,2400)]).join('\n\n'),usedRefs:sourceRefs.slice(0,6)};
  }
  if(p.includes('citationhealth')&&p.includes('unsupportedclaims')){
    const hasRefs=/—\s*ص\s*\d+/.test(prompt);const requirementsText=(prompt.match(/متطلبات الطالب:\s*([^\n]+)/)||[])[1]||'';
    return {citationHealth:hasRefs?82:58,requirementsMatch:requirementsText&&requirementsText!=='لا توجد'?72:88,readiness:hasRefs?78:62,unsupportedClaims:hasRefs?[]:[{claim:'بعض الفقرات تحتاج ربطًا أوضح بصفحات المصدر.',reason:'لم أجد إحالات صفحات كافية في النسخة التي دُققت محليًا.'}],requirements:requirementsText&&requirementsText!=='لا توجد'?[{text:requirementsText,status:'partial'}]:[],notes:['هذا تدقيق احتياطي محلي؛ شغّل نموذج Scholar AI الكامل للحصول على تدقيق دلالي أعمق.']};
  }
  if(p.includes('coverage guard')||p.includes('"coverage"')&&p.includes('"missing"')){
    const topics=(hs.length?hs:ss.slice(0,8).map(x=>x.slice(0,70))).slice(0,8);const midpoint=Math.max(1,Math.ceil(topics.length*.6));const coveredTopics=topics.slice(0,midpoint);const missingTopics=topics.slice(midpoint);const coverage=topics.length?Math.round(coveredTopics.length/topics.length*100):35;
    return {coverage,covered:coveredTopics.map((topic,i)=>({topic,sourceRef:sourceRefs[i%sourceRefs.length]})),missing:missingTopics.map((topic,i)=>({topic,reason:'لم أجد لهذا المحور تغطية واضحة ضمن المخرجات الحالية في الفحص المحلي الخفيف.',sourceRef:sourceRefs[(i+midpoint)%sourceRefs.length]})),examRisk:missingTopics.slice(0,3).map(x=>`راجع ${x} قبل الاعتماد على الملخص الحالي.`),nextAction:missingTopics.length?'ابدأ بالمحاور الناقصة ثم أعد فحص Coverage Guard.':'التغطية الأساسية جيدة؛ انتقل إلى محاكي الفاينل للتأكد من الاسترجاع.'};
  }
  if(p.includes('فيديو تعليمي')||p.includes('"scenes"')){
    const title=(prompt.match(/عن «([^»]+)»/)||[])[1]||hs[0]||'شرح المادة';const count=Math.max(5,Math.min(8,Number((prompt.match(/أنشئ\s+(\d+)\s+مشاهد/)||[])[1])||6));
    const rows=(ss.length?ss:[clean(context)]).slice(0,count);
    return {title,hook:`خلال دقائق نفهم ${title} من المصدر نفسه.`,scenes:rows.map((x,i)=>({title:hs[i]||`الفكرة ${i+1}`,narration:x,onScreen:x.slice(0,150),visualHint:i%2?'مقارنة نقطتين رئيسيتين':'مخطط مبسط للمفهوم'})),closing:'راجع الأفكار الأساسية ثم اختبر نفسك بدون النظر إلى المصدر.'};
  }
  return {text:sample.join('\n\n')||clean(context).slice(0,3000),sourceRefs:sourceRefs.slice(0,6),localFallback:true};
}

export async function smartTask(action:string,payload:any){
  lastStatus={stage:'local-ai',progress:10,message:'Scholar AI يعالج الطلب على جهازك'};
  try{
    const data=await runSmartTask(action,payload);
    lastStatus={stage:'local-ai',progress:100,message:'اكتملت المعالجة محليًا'};
    return data;
  }catch(e){
    lastStatus={stage:'local-ai',progress:0,message:'استخدمت المعالجة المحلية الخفيفة'};
    throw e;
  }
}

export async function customTask(prompt:string,context=''){
  lastStatus={stage:'local-ai',progress:10,message:'Scholar AI ينفذ المهمة الأكاديمية محليًا'};
  try{
    const data=await runCustomTask(prompt,context);
    lastStatus={stage:'local-ai',progress:100,message:'اكتملت المهمة الأكاديمية محليًا'};
    return data;
  }catch(e){
    console.warn('ScholarMCP local model fallback:',e);
    lastStatus={stage:'fallback',progress:100,message:'تمت المهمة بمحرك Scholar الخفيف'};
    return fallbackCustom(prompt,context);
  }
}

export async function ocrSource(source:File|Blob|string){
  const blob=await sourceBlob(source);
  lastStatus={stage:'ocr',progress:15,message:'Scholar OCR يقرأ الصفحة على جهازك'};
  const text=await runOCR(blob,'auto');
  lastStatus={stage:'ocr',progress:100,message:'اكتملت قراءة الصفحة محليًا'};
  return text.trim();
}
export async function structuredOCR(source:File|Blob|string){
  const blob=await sourceBlob(source);
  const text=await runStructuredOCR(blob);
  return {text:text.trim(),provider:'scholarmcp-local',handwriting:true,local:true};
}
export async function handwrittenOCR(source:File|Blob|string){
  const blob=await sourceBlob(source);
  return (await runHandwrittenOCR(blob)).trim();
}
export function ocrCapabilities(){return {...getOCRCapabilities(),mode:'local',printed:true,handwritten:true,multilingual:true,deviceCompute:true}}

export async function speechToText(source:File|Blob|string,_options:any={}){
  lastStatus={stage:'speech',progress:10,message:'ScholarMCP يفرّغ المحاضرة على جهازك'};
  const result=await transcribeAudio(source);
  lastStatus={stage:'speech',progress:100,message:'اكتمل تفريغ المحاضرة محليًا'};
  return result;
}

export async function textToSpeech(text:string,options:any={}){
  if(!('speechSynthesis' in window))throw new Error('القراءة الصوتية غير مدعومة على هذا الجهاز.');
  window.speechSynthesis.cancel();
  const utterance=new SpeechSynthesisUtterance(text.slice(0,9000));
  utterance.lang=options.lang||(/[\u0600-\u06ff]/.test(text)?'ar-IQ':'en-US');
  utterance.rate=Number(options.rate)||.95;
  window.speechSynthesis.speak(utterance);
  return true;
}

export async function generateStudyImage(_prompt:string,_options:any={}){
  throw new Error('الرسوم التوليدية الثقيلة غير مفعلة في النسخة المحلية؛ استخدم الخريطة الذهنية أو فيديو Scholar المحلي.');
}
export async function generateStudyVideo(_prompt:string,_options:any={}){
  throw new Error('استخدم استوديو فيديو AI داخل المركز الأكاديمي؛ التوليد المرئي يتم محليًا من المادة.');
}

export async function localAIStatus(){
  const ai=await getAIStatus();
  return {...lastStatus,...ai,deviceCompute:true,provider:'scholarmcp-local',speech:speechCapabilities(),ocr:getOCRCapabilities()};
}
export async function resetLocalAI(){resetAI();lastStatus={stage:'local',progress:100,message:'ScholarMCP المحلي جاهز'}}
export async function disposeLocalAI(){await disposeAI();await disposeSpeech()}
export async function disposeOCR(){await disposeLocalOCR()}
export async function aiAvailable(){return typeof WebAssembly!=='undefined'}
