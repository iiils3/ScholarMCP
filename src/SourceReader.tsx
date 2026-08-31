import { useEffect,useRef,useState } from 'react';
import { ChevronLeft,ChevronRight,FileText,LoaderCircle,Search,ZoomIn,ZoomOut,X } from 'lucide-react';
import type { Material } from './lib';
import { getSourceBlob } from './blob-store';

function pageText(text:string,page:number){
  const re=new RegExp(`\\[\\[PAGE\\s+${page}\\]\\]([\\s\\S]*?)(?=\\[\\[PAGE\\s+\\d+\\]\\]|$)`,'i');
  return (text.match(re)?.[1]||'').trim();
}
function findPages(text:string,q:string){
  if(!q.trim())return [] as number[];const term=q.trim().toLowerCase();const parts=text.split(/\[\[PAGE\s+(\d+)\]\]/i);const out:number[]=[];
  for(let i=1;i<parts.length;i+=2)if((parts[i+1]||'').toLowerCase().includes(term))out.push(Number(parts[i]));return out;
}

export default function SourceReader({material,onClose,initialPage=1}:{material:Material;onClose:()=>void;initialPage?:number}){
  const canvas=useRef<HTMLCanvasElement>(null);const [blob,setBlob]=useState<Blob|null>(null);const [page,setPage]=useState(Math.min(Math.max(1,initialPage),Math.max(1,material.pages)));const [zoom,setZoom]=useState(1.15);const [busy,setBusy]=useState(true);const [err,setErr]=useState('');const [q,setQ]=useState('');const [pdf,setPdf]=useState<any>(null);const hits=findPages(material.text,q);
  useEffect(()=>{getSourceBlob(material.id).then(b=>{setBlob(b);setBusy(false)}).catch(e=>{setErr(String(e));setBusy(false)})},[material.id]);
  useEffect(()=>{if(!blob||material.ext!=='pdf')return;let active=true;(async()=>{try{setBusy(true);const pdfjs=await import('pdfjs-dist');const workerUrl=(await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;pdfjs.GlobalWorkerOptions.workerSrc=workerUrl;const doc=await pdfjs.getDocument({data:await blob.arrayBuffer()}).promise;if(active)setPdf(doc)}catch(e){if(active)setErr(`تعذر فتح PDF الأصلي: ${(e as Error).message}`)}finally{if(active)setBusy(false)}})();return()=>{active=false}},[blob,material.ext]);
  useEffect(()=>{if(!pdf||!canvas.current)return;let cancelled=false;(async()=>{try{setBusy(true);const p=await pdf.getPage(page);const viewport=p.getViewport({scale:zoom});const c=canvas.current!;const maxW=Math.max(280,Math.min(window.innerWidth-40,900));const fit=Math.min(1,maxW/viewport.width);const vp=p.getViewport({scale:zoom*fit});c.width=Math.ceil(vp.width*devicePixelRatio);c.height=Math.ceil(vp.height*devicePixelRatio);c.style.width=`${Math.ceil(vp.width)}px`;c.style.height=`${Math.ceil(vp.height)}px`;const ctx=c.getContext('2d',{alpha:false})!;ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);ctx.fillStyle='white';ctx.fillRect(0,0,vp.width,vp.height);await p.render({canvasContext:ctx,viewport:vp,canvas:c} as any).promise}catch(e){if(!cancelled)setErr((e as Error).message)}finally{if(!cancelled)setBusy(false)}})();return()=>{cancelled=true}},[pdf,page,zoom]);
  const imageUrl=blob&&material.mime.startsWith('image/')?URL.createObjectURL(blob):'';
  useEffect(()=>()=>{if(imageUrl)URL.revokeObjectURL(imageUrl)},[imageUrl]);
  function jump(dir:number){setPage(v=>Math.min(Math.max(1,v+dir),Math.max(1,material.pages)))}
  return <div className="modal source-reader-modal" onClick={onClose}><div className="source-reader" onClick={e=>e.stopPropagation()}>
    <header className="reader-head"><div><b>{material.name}</b><small>{material.pages} صفحة • القارئ الداخلي</small></div><button className="icon" onClick={onClose}><X/></button></header>
    <div className="reader-tools"><button onClick={()=>jump(-1)} disabled={page<=1}><ChevronRight/></button><span>صفحة {page} / {Math.max(1,material.pages)}</span><button onClick={()=>jump(1)} disabled={page>=material.pages}><ChevronLeft/></button><button onClick={()=>setZoom(z=>Math.max(.6,z-.15))}><ZoomOut/></button><button onClick={()=>setZoom(z=>Math.min(2.4,z+.15))}><ZoomIn/></button><div className="reader-search"><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="ابحث داخل المصدر"/></div></div>
    {q&&hits.length>0&&<div className="reader-hits">{hits.slice(0,20).map(p=><button key={p} onClick={()=>setPage(p)}>ص {p}</button>)}</div>}
    <div className="reader-split">
      <div className="reader-original">{busy&&<div className="reader-loading"><LoaderCircle className="spin"/> جاري فتح الصفحة…</div>}{err&&<div className="warning">{err}</div>}{material.ext==='pdf'&&<canvas ref={canvas}/>} {imageUrl&&<img src={imageUrl} alt={material.name}/>} {!blob&&<div className="empty-source"><FileText/><p>هذا المصدر رُفع قبل تفعيل حفظ الملف الأصلي. النص المستخرج موجود، ولعرض الصفحة نفسها أعد رفع الملف مرة واحدة.</p></div>}{blob&&material.ext!=='pdf'&&!imageUrl&&<div className="empty-source"><FileText/><p>المعاينة الأصلية لهذه الصيغة ليست بصرية؛ النص المستخرج ظاهر بجانبها.</p></div>}</div>
      <aside className="reader-text"><div className="reader-text-head"><b>النص الذي يفهمه ScholarMCP</b><small>ص {page}</small></div><pre>{pageText(material.text,page)||'لا يوجد نص مستخرج لهذه الصفحة.'}</pre></aside>
    </div>
  </div></div>
}
