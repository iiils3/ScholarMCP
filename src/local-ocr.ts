let doclingPromise:Promise<{processor:any;model:any}>|null=null;
let trocrPromise:Promise<any>|null=null;

function emit(status:string,progress?:number){window.dispatchEvent(new CustomEvent('scholar-ocr-progress',{detail:{status,progress}}))}
function webgpu(){return !!(navigator as any).gpu}

async function blobUrl<T>(blob:Blob,fn:(url:string)=>Promise<T>){const u=URL.createObjectURL(blob);try{return await fn(u)}finally{URL.revokeObjectURL(u)}}

async function getDocling(){
  if(doclingPromise)return doclingPromise;
  doclingPromise=(async()=>{
    emit('جاري تجهيز قارئ المستندات المحلي…',0.02);
    const {AutoProcessor,AutoModelForVision2Seq}=await import('@huggingface/transformers');
    const id='onnx-community/granite-docling-258M-ONNX';
    const processor=await AutoProcessor.from_pretrained(id,{progress_callback:(p:any)=>emit('جاري تنزيل نموذج OCR لأول مرة…',typeof p?.progress==='number'?p.progress/100:undefined)} as any);
    const model=await AutoModelForVision2Seq.from_pretrained(id,{device:webgpu()?'webgpu':'wasm',dtype:'q4',progress_callback:(p:any)=>emit('جاري تجهيز OCR المحلي…',typeof p?.progress==='number'?p.progress/100:undefined)} as any);
    emit('قارئ OCR المحلي جاهز',1);return {processor,model};
  })().catch(e=>{doclingPromise=null;throw e});
  return doclingPromise;
}

function doctagsToText(raw:string){return raw.replace(/<loc_\d+>/g,' ').replace(/<[^>]+>/g,'\n').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim()}

export async function structuredOCR(blob:Blob){
  const {processor,model}=await getDocling();
  return blobUrl(blob,async url=>{
    const {load_image}=await import('@huggingface/transformers');const image=await load_image(url);
    const messages=[{role:'user',content:[{type:'image'},{type:'text',text:'Convert this page to docling.'}]}];
    const prompt=processor.apply_chat_template(messages,{add_generation_prompt:true});const inputs=await processor(prompt,[image],{do_image_splitting:false});
    emit('أقرأ الصفحة وأحافظ على ترتيبها…',1);const ids:any=await model.generate({...inputs,max_new_tokens:2600,do_sample:false});const promptLength=(inputs.input_ids as any).dims?.at(-1)||0;
    let trimmed=ids;try{trimmed=ids.slice(null,[promptLength,null])}catch{}const decoded=processor.batch_decode(trimmed,{skip_special_tokens:true});return doctagsToText(String(decoded?.[0]||''));
  });
}

async function canvasToBlob(canvas:HTMLCanvasElement){return new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('تعذر تجهيز صورة OCR')),'image/jpeg',0.92))}
async function splitHandwrittenLines(blob:Blob){
  const bitmap=await createImageBitmap(blob);const scale=Math.min(1,1600/bitmap.width);const w=Math.max(1,Math.round(bitmap.width*scale)),h=Math.max(1,Math.round(bitmap.height*scale));const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d',{willReadFrequently:true})!;ctx.fillStyle='white';ctx.fillRect(0,0,w,h);ctx.drawImage(bitmap,0,0,w,h);bitmap.close();
  const img=ctx.getImageData(0,0,w,h).data;const active:boolean[]=[];for(let y=0;y<h;y++){let ink=0;for(let x=0;x<w;x+=3){const i=(y*w+x)*4;const gray=.299*img[i]+.587*img[i+1]+.114*img[i+2];if(gray<205)ink++}active[y]=ink>Math.max(2,w/130)}
  const ranges:Array<[number,number]>=[];let start=-1,gap=0;for(let y=0;y<h;y++){if(active[y]){if(start<0)start=y;gap=0}else if(start>=0){gap++;if(gap>7){const end=y-gap;if(end-start>7)ranges.push([Math.max(0,start-5),Math.min(h,end+6)]);start=-1;gap=0}}}if(start>=0)ranges.push([Math.max(0,start-5),h]);
  const usable=ranges.filter(([a,b])=>b-a>9).slice(0,80);if(!usable.length)return[blob];const out:Blob[]=[];for(const[a,b]of usable){const line=document.createElement('canvas');line.width=w;line.height=b-a;line.getContext('2d')!.drawImage(c,0,a,w,b-a,0,0,w,b-a);out.push(await canvasToBlob(line))}return out;
}

async function getTrocr(){if(trocrPromise)return trocrPromise;trocrPromise=(async()=>{const {pipeline}=await import('@huggingface/transformers');emit('جاري تجهيز قارئ الخط اليدوي…',0.05);const p=await pipeline('image-to-text','Xenova/trocr-small-handwritten',{device:webgpu()?'webgpu':'wasm',dtype:webgpu()?'fp16':'q8',progress_callback:(x:any)=>emit('جاري تنزيل قارئ الخط اليدوي لأول مرة…',typeof x?.progress==='number'?x.progress/100:undefined)} as any);emit('قارئ الخط اليدوي جاهز',1);return p})().catch(e=>{trocrPromise=null;throw e});return trocrPromise}
function generatedText(result:any){const item=Array.isArray(result)?result[0]:result;return String(item?.generated_text??item?.text??'').trim()}
export async function handwrittenOCR(blob:Blob){const lines=await splitHandwrittenLines(blob);const pipe=await getTrocr();const text:string[]=[];let n=0;for(const line of lines){n++;emit(`قراءة سطر يدوي ${n} من ${lines.length}`,n/lines.length);const result:any=await blobUrl<any>(line,async url=>await(pipe as any)(url,{max_new_tokens:128}));const x=generatedText(result);if(x)text.push(x)}return text.join('\n').trim()}
export async function ocrSource(blob:Blob,mode:'auto'|'document'|'handwriting'='auto'){if(mode==='handwriting'){try{const hand=await handwrittenOCR(blob);if(hand.length>12)return hand}catch{}return structuredOCR(blob)}const structured=await structuredOCR(blob);if(mode==='document'||structured.length>35)return structured;try{const hand=await handwrittenOCR(blob);return hand.length>structured.length?hand:structured}catch{return structured}}

export async function disposeOCR(){
  try{const d=await doclingPromise;d?.model?.dispose?.()}catch{}
  try{const t=await trocrPromise;t?.dispose?.()}catch{}
  doclingPromise=null;trocrPromise=null;emit('تم تحرير ذاكرة OCR',1);
}
export function ocrCapabilities(){return{webgpu:webgpu(),structured:'Granite Docling 258M',handwriting:'TrOCR small handwritten',local:true}}
