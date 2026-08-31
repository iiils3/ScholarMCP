import { ocrSource,disposeOCR } from './puter';

export type ParseResult={text:string;pages:number;error?:string};
async function canvasBlob(canvas:HTMLCanvasElement){return new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('تعذر تجهيز صورة الصفحة للـOCR')),'image/jpeg',0.9))}

export async function parseFile(file:File):Promise<ParseResult>{
 const ext=file.name.split('.').pop()?.toLowerCase()||'';
 try{
  if(ext==='txt'||ext==='md')return{text:`[[PAGE 1]]\n${await file.text()}`,pages:1};
  if(['jpg','jpeg','png','webp','bmp','gif'].includes(ext)||file.type.startsWith('image/')){const raw=await ocrSource(file);return raw?{text:`[[PAGE 1]]\n${raw}`,pages:1}:{text:'',pages:1,error:'لم أستطع قراءة نص واضح من الصورة.'}}
  if(ext==='docx'){const{default:mammoth}=await import('mammoth');const r=await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});const raw=r.value.trim();if(!raw)return{text:'',pages:0,error:'المستند لا يحتوي نصًا قابلًا للاستخراج.'};const pages=Math.max(1,Math.ceil(raw.length/2400));let text='';for(let p=1;p<=pages;p++)text+=`\n\n[[PAGE ${p}]]\n${raw.slice((p-1)*2400,p*2400)}`;return{text:text.trim(),pages}}
  if(ext==='pptx'){const{default:JSZip}=await import('jszip');const zip=await JSZip.loadAsync(await file.arrayBuffer());const names=Object.keys(zip.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a,b)=>Number(a.match(/\d+/)?.[0])-Number(b.match(/\d+/)?.[0]));let text='',p=1;for(const n of names){const xml=await zip.file(n)!.async('string');const parts=[...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map(m=>(m[1]||'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>'));text+=`\n\n[[PAGE ${p++}]]\n${parts.join('\n')}`}return text.trim()?{text:text.trim(),pages:names.length}:{text:'',pages:names.length,error:'الشرائح لا تحتوي نصًا قابلًا للاستخراج.'}}
  if(ext==='pdf'){
   const pdfjs=await import('pdfjs-dist');const workerUrl=(await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;pdfjs.GlobalWorkerOptions.workerSrc=workerUrl;const doc=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;let text='';const notes:string[]=[];
   for(let p=1;p<=doc.numPages;p++){const page=await doc.getPage(p);const content=await page.getTextContent();let pageText=content.items.map((i:any)=>i.str||'').join(' ').replace(/\s+/g,' ').trim();if(pageText.length<35){try{const viewport=page.getViewport({scale:1.7});const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw new Error('Canvas غير متاح');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);await page.render({canvasContext:ctx,viewport,canvas} as any).promise;pageText=await ocrSource(await canvasBlob(canvas));if(!pageText)notes.push(`الصفحة ${p}: OCR لم يجد نصاً واضحاً.`)}catch(e){notes.push(`الصفحة ${p}: تعذر OCR — ${(e as Error).message}`)}}text+=`\n\n[[PAGE ${p}]]\n${pageText}`}
   const body=text.replace(/\[\[PAGE \d+\]\]/g,'').trim();return{text:text.trim(),pages:doc.numPages,error:body.length<40?'لم أستطع استخراج نص كافٍ من الملف.':notes.length?notes.slice(0,3).join(' '):undefined};
  }
  return{text:'',pages:0,error:'الصيغة غير مدعومة. استخدم PDF/DOCX/PPTX/TXT/MD أو صورة JPG/PNG/WebP.'};
 }catch(e){return{text:'',pages:0,error:`تعذرت قراءة الملف: ${(e as Error).message}`}}
 finally{void disposeOCR()}
}
