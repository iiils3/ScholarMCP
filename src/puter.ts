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

export async function smartTask(action:string,payload:any){
  lastStatus={stage:'local-ai',progress:10,message:'Scholar AI يعالج الطلب على جهازك'};
  try{
    const data=await runSmartTask(action,payload);
    lastStatus={stage:'local-ai',progress:100,message:'اكتملت المعالجة محليًا'};
    return data;
  }catch(e){
    lastStatus={stage:'local-ai',progress:0,message:'تعذر تشغيل المعالجة المحلية'};
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
    lastStatus={stage:'local-ai',progress:0,message:'تعذر تنفيذ المهمة المحلية'};
    throw e;
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
