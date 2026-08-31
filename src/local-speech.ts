const MODEL='Xenova/whisper-tiny';
let pipePromise:Promise<any>|null=null;
let lastProgress=0;

function emit(status:string,progress?:number){
  if(typeof progress==='number')lastProgress=Math.max(0,Math.min(1,progress));
  window.dispatchEvent(new CustomEvent('scholar-speech-progress',{detail:{status,progress:lastProgress,model:MODEL}}));
}
function webgpu(){return !!(navigator as any).gpu}

async function blobUrl<T>(blob:Blob,fn:(url:string)=>Promise<T>){
  const url=URL.createObjectURL(blob);
  try{return await fn(url)}finally{URL.revokeObjectURL(url)}
}
async function sourceBlob(source:File|Blob|string){
  if(source instanceof Blob)return source;
  if(/^data:/i.test(source)){const r=await fetch(source);return r.blob()}
  if(/^blob:/i.test(source)){const r=await fetch(source);return r.blob()}
  if(/^https?:/i.test(source)){const r=await fetch(source,{credentials:'omit'});if(!r.ok)throw new Error('تعذر قراءة التسجيل.');return r.blob()}
  throw new Error('صيغة التسجيل غير مدعومة.');
}

async function getPipe(){
  if(pipePromise)return pipePromise;
  pipePromise=(async()=>{
    emit('جاري تجهيز محرك تفريغ المحاضرات المحلي…',.02);
    const {pipeline}=await import('@huggingface/transformers');
    const device=webgpu()?'webgpu':'wasm';
    const dtype=device==='webgpu'?'fp16':'q8';
    const pipe=await pipeline('automatic-speech-recognition',MODEL,{device,dtype,progress_callback:(p:any)=>{
      const progress=typeof p?.progress==='number'?p.progress/100:undefined;
      emit(p?.status==='progress'?'تنزيل نموذج التفريغ لأول مرة…':'تجهيز التفريغ المحلي…',progress);
    }} as any);
    emit('محرك تفريغ المحاضرات جاهز على جهازك',1);
    return pipe;
  })().catch(e=>{pipePromise=null;emit('تعذر تشغيل التفريغ المحلي',0);throw e});
  return pipePromise;
}

function normalize(result:any){
  const text=String(result?.text??result?.generated_text??'').trim();
  const chunks=Array.isArray(result?.chunks)?result.chunks:[];
  const segments=chunks.map((c:any)=>{
    const ts=Array.isArray(c?.timestamp)?c.timestamp:Array.isArray(c?.timestamps)?c.timestamps:[];
    return {start:Number(ts?.[0])||0,end:Number(ts?.[1])||undefined,text:String(c?.text||'').trim()};
  }).filter((x:any)=>x.text);
  return {text,segments};
}

export async function transcribeAudio(source:File|Blob|string){
  const blob=await sourceBlob(source);
  if(!blob.size)throw new Error('التسجيل فارغ.');
  emit('ScholarMCP يفرّغ المقطع على جهازك…',.2);
  const pipe=await getPipe();
  const result=await blobUrl(blob,async url=>await pipe(url,{chunk_length_s:30,stride_length_s:5,return_timestamps:true} as any));
  const out=normalize(result);
  if(!out.text)throw new Error('ما قدرت أستخرج كلام واضح من هذا المقطع.');
  emit('اكتمل تفريغ المقطع محليًا',1);
  return out;
}

export function speechCapabilities(){return {local:true,model:MODEL,webgpu:webgpu(),uploadedAudio:true,longLectureSegments:true}}
export async function disposeSpeech(){try{const p:any=await pipePromise;p?.dispose?.()}catch{}pipePromise=null;lastProgress=0}
