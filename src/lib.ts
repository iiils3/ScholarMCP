import JSZip from 'jszip';
import mammoth from 'mammoth';
import { Document, HeadingLevel, Packer, Paragraph, TextRun, AlignmentType } from 'docx';
import PptxGenJS from 'pptxgenjs';

export type Truth='verified'|'supported'|'inferred'|'unverified';
export type Course={id:string;name:string;examDate?:string;color:string;mastery:number;createdAt:string};
export type Material={id:string;courseId:string;name:string;mime:string;ext:string;size:number;pages:number;status:'pending'|'ready'|'failed';error?:string;text:string;storagePath?:string;createdAt:string};
export type Topic={id:string;courseId:string;title:string;mastery:number;attempts:number;correct:number;incorrect:number;sourceRef?:string};
export type Flashcard={id:string;courseId:string;front:string;back:string;topic?:string;sourceRef?:string;dueAt:string;interval:number};
export type Deadline={id:string;courseId?:string;title:string;kind:'exam'|'assignment'|'presentation'|'other';dueAt:string;done:boolean};
export type Artifact={id:string;courseId:string;type:string;title:string;truth:Truth;coverage?:number;data:any;createdAt:string};
export type Assignment={id:string;courseId:string;title:string;instructions:string;rubric:string;dueAt?:string;checklist:any[];outline?:string;draft?:string;assessment?:any;createdAt:string};
export type Profile={name:string;major?:string;studyLanguage:'ar'|'en';onboarded:boolean};
export type AppState={profile:Profile;courses:Course[];materials:Material[];topics:Topic[];flashcards:Flashcard[];deadlines:Deadline[];artifacts:Artifact[];assignments:Assignment[]};

export const uid=()=>crypto.randomUUID();
export const todayIso=()=>new Date().toISOString();
export function daysUntil(iso?:string){if(!iso)return undefined;return Math.ceil((new Date(iso).getTime()-Date.now())/86400000)}
export function fmtDate(iso?:string){if(!iso)return 'غير محدد';return new Intl.DateTimeFormat('ar-IQ',{year:'numeric',month:'short',day:'numeric'}).format(new Date(iso))}
export function humanSize(n:number){if(n<1024)return `${n} B`;if(n<1048576)return `${(n/1024).toFixed(1)} KB`;return `${(n/1048576).toFixed(1)} MB`}
export function safeFileName(v:string){return v.replace(/[\\/:*?"<>|]+/g,'-').slice(0,100)||'ScholarMCP'}
export function courseMastery(state:AppState,courseId:string){const t=state.topics.filter(x=>x.courseId===courseId&&x.attempts>0);return t.length?Math.round(t.reduce((a,x)=>a+x.mastery,0)/t.length):state.courses.find(c=>c.id===courseId)?.mastery||0}
export function riskScore(state:AppState,c:Course){const d=daysUntil(c.examDate);const m=courseMastery(state,c.id);const p=d===undefined?.25:Math.max(0,Math.min(1,1-d/30));return Math.round((p*.65+(1-m/100)*.35)*100)}
export function weakest(state:AppState,courseId?:string){return state.topics.filter(t=>!courseId||t.courseId===courseId).slice().sort((a,b)=>a.mastery-b.mastery||b.attempts-a.attempts).slice(0,3)}

const EMPTY:AppState={profile:{name:'',studyLanguage:'ar',onboarded:false},courses:[],materials:[],topics:[],flashcards:[],deadlines:[],artifacts:[],assignments:[]};
const LOCAL_KEY='scholarmcp.github.v1';
export class LocalRepository{
  state:AppState;
  constructor(){try{this.state={...EMPTY,...JSON.parse(localStorage.getItem(LOCAL_KEY)||'{}')} as AppState}catch{this.state=structuredClone(EMPTY)}}
  persist(){localStorage.setItem(LOCAL_KEY,JSON.stringify(this.state));window.dispatchEvent(new Event('scholar-state'))}
  setProfile(p:Partial<Profile>){this.state.profile={...this.state.profile,...p};this.persist()}
  addCourse(name:string,examDate?:string){const c:Course={id:uid(),name,examDate:examDate||undefined,color:'#2563eb',mastery:0,createdAt:todayIso()};this.state.courses.push(c);if(examDate)this.state.deadlines.push({id:uid(),courseId:c.id,title:`امتحان ${name}`,kind:'exam',dueAt:examDate,done:false});this.persist();return c}
  updateCourse(id:string,patch:Partial<Course>){this.state.courses=this.state.courses.map(c=>c.id===id?{...c,...patch}:c);this.persist()}
  deleteCourse(id:string){this.state.courses=this.state.courses.filter(c=>c.id!==id);this.state.materials=this.state.materials.filter(x=>x.courseId!==id);this.state.topics=this.state.topics.filter(x=>x.courseId!==id);this.state.flashcards=this.state.flashcards.filter(x=>x.courseId!==id);this.state.deadlines=this.state.deadlines.filter(x=>x.courseId!==id);this.state.artifacts=this.state.artifacts.filter(x=>x.courseId!==id);this.state.assignments=this.state.assignments.filter(x=>x.courseId!==id);this.persist()}
  addMaterial(m:Omit<Material,'id'|'createdAt'>){const x={...m,id:uid(),createdAt:todayIso()};this.state.materials.unshift(x);this.persist();return x}
  deleteMaterial(id:string){this.state.materials=this.state.materials.filter(x=>x.id!==id);this.persist()}
  upsertTopics(courseId:string,items:Array<{title:string;sourceRef?:string}>){for(const i of items){if(!i.title.trim()||this.state.topics.some(t=>t.courseId===courseId&&t.title===i.title))continue;this.state.topics.push({id:uid(),courseId,title:i.title,mastery:0,attempts:0,correct:0,incorrect:0,sourceRef:i.sourceRef})}this.persist()}
  recordTopic(courseId:string,title:string|undefined,correct:boolean){if(!title)return;let t=this.state.topics.find(x=>x.courseId===courseId&&x.title===title);if(!t){t={id:uid(),courseId,title,mastery:0,attempts:0,correct:0,incorrect:0};this.state.topics.push(t)}t.attempts++;correct?t.correct++:t.incorrect++;t.mastery=Math.min(100,Math.max(0,Math.round((t.correct/t.attempts)*100*(1-Math.exp(-t.attempts/3))+(correct?4:0))));this.persist()}
  addArtifact(a:Omit<Artifact,'id'|'createdAt'>){const x={...a,id:uid(),createdAt:todayIso()};this.state.artifacts.unshift(x);this.persist();return x}
  addFlashcards(courseId:string,cards:Array<{front:string;back:string;topic?:string;sourceRef?:string}>){const made=cards.map(c=>({...c,id:uid(),courseId,dueAt:todayIso(),interval:0}));this.state.flashcards.unshift(...made);this.persist();return made}
  reviewCard(id:string,good:boolean){const c=this.state.flashcards.find(x=>x.id===id);if(!c)return;c.interval=good?(c.interval?Math.min(60,Math.round(c.interval*2.2)):1):0;c.dueAt=new Date(Date.now()+Math.max(.25,c.interval)*86400000).toISOString();this.persist()}
  addAssignment(a:Omit<Assignment,'id'|'createdAt'>){const x={...a,id:uid(),createdAt:todayIso()};this.state.assignments.unshift(x);if(a.dueAt)this.state.deadlines.push({id:uid(),courseId:a.courseId,title:a.title,kind:'assignment',dueAt:a.dueAt,done:false});this.persist();return x}
}

// Cloud boundary. GitHub Pages runs local-first while Neon Auth/Data API is wired.
export const cloudConfigured=false;
export const supabase:any=null;
export async function currentUser(){return null}
export async function signIn(){throw new Error('تسجيل الدخول السحابي سيُفعّل بعد ربط Neon Auth.')}
export async function signUp(){throw new Error('إنشاء الحساب السحابي سيُفعّل بعد ربط Neon Auth.')}
export async function signOut(){return}
export async function loadCloudState():Promise<AppState>{throw new Error('Neon cloud adapter غير مفعّل بعد.')}
export async function cloudSaveProfile(){throw new Error('Neon cloud adapter غير مفعّل بعد.')}
export async function cloudAddCourse(){throw new Error('Neon cloud adapter غير مفعّل بعد.')}
export async function cloudUpdateCourse(){throw new Error('Neon cloud adapter غير مفعّل بعد.')}
export async function cloudDeleteCourse(){throw new Error('Neon cloud adapter غير مفعّل بعد.')}
export async function cloudAddMaterial(){throw new Error('Neon cloud adapter غير مفعّل بعد.')}
export async function cloudDeleteMaterial(){throw new Error('Neon cloud adapter غير مفعّل بعد.')}
export async function cloudMaterialSignedUrl(){return null}
export async function cloudMaterialText(m:Material){return m.text}
export async function cloudAddArtifact(){throw new Error('Neon cloud adapter غير مفعّل بعد.')}
export async function cloudAddTopics(){throw new Error('Neon cloud adapter غير مفعّل بعد.')}
export async function cloudRecordTopic(){throw new Error('Neon cloud adapter غير مفعّل بعد.')}
export async function cloudAddFlashcards(){throw new Error('Neon cloud adapter غير مفعّل بعد.')}
export async function cloudReviewCard(){throw new Error('Neon cloud adapter غير مفعّل بعد.')}
export async function cloudAddAssignment(){throw new Error('Neon cloud adapter غير مفعّل بعد.')}

export type ParseResult={text:string;pages:number;error?:string};
export async function parseFile(file:File):Promise<ParseResult>{const ext=file.name.split('.').pop()?.toLowerCase()||'';try{
  if(ext==='txt'||ext==='md')return {text:await file.text(),pages:1};
  if(ext==='docx'){const r=await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});const raw=r.value.trim();if(!raw)return {text:'',pages:0,error:'المستند لا يحتوي نصًا قابلًا للاستخراج.'};const pages=Math.max(1,Math.ceil(raw.length/2400));let text='';for(let p=1;p<=pages;p++)text+=`\n\n[[PAGE ${p}]]\n\n${raw.slice((p-1)*2400,p*2400)}`;return {text:text.trim(),pages}}
  if(ext==='pptx'){const zip=await JSZip.loadAsync(await file.arrayBuffer());const names=Object.keys(zip.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a,b)=>Number(a.match(/\d+/)?.[0])-Number(b.match(/\d+/)?.[0]));let text='';let p=1;for(const n of names){const xml=await zip.file(n)!.async('string');const parts=[...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map(m=>(m[1]||'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>'));text+=`\n\n[[PAGE ${p++}]]\n\n${parts.join('\n')}`};return text.trim()?{text:text.trim(),pages:names.length}:{text:'',pages:names.length,error:'الشرائح لا تحتوي نصًا قابلًا للاستخراج.'}}
  if(ext==='pdf'){const pdfjs=await import('pdfjs-dist');const workerUrl=(await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;pdfjs.GlobalWorkerOptions.workerSrc=workerUrl;const doc=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;let text='';for(let p=1;p<=doc.numPages;p++){const page=await doc.getPage(p);const content=await page.getTextContent();const pageText=content.items.map((i:any)=>i.str||'').join(' ').replace(/\s+/g,' ').trim();text+=`\n\n[[PAGE ${p}]]\n\n${pageText}`};const body=text.replace(/\[\[PAGE \d+\]\]/g,'').trim();return body.length<40?{text:text.trim(),pages:doc.numPages,error:'يبدو الملف ممسوحًا ضوئيًا ولا يحتوي نصًا كافيًا. يحتاج OCR.'}:{text:text.trim(),pages:doc.numPages}}
  return {text:'',pages:0,error:'الصيغة غير مدعومة. استخدم PDF/DOCX/PPTX/TXT/MD.'};
}catch(e){return {text:'',pages:0,error:`تعذرت قراءة الملف: ${(e as Error).message}`}}}
export function chunks(text:string,size=2600){const out:Array<{page:number;text:string}>=[];const parts=text.split(/\[\[PAGE (\d+)\]\]/);if(parts.length>1){for(let i=1;i<parts.length;i+=2){const page=Number(parts[i]);const body=(parts[i+1]||'').trim();for(let j=0;j<body.length;j+=size)out.push({page,text:body.slice(j,j+size)})}}else for(let j=0;j<text.length;j+=size)out.push({page:1,text:text.slice(j,j+size)});return out}
export function retrieve(materials:Material[],query:string,limit=8){const terms=query.toLowerCase().split(/\s+/).filter(x=>x.length>2);const scored=materials.flatMap(m=>chunks(m.text,1500).map(c=>({material:m.name,...c,score:terms.reduce((s,t)=>s+(c.text.toLowerCase().includes(t)?1:0),0)})));scored.sort((a,b)=>b.score-a.score);return (scored.filter(x=>x.score>0).length?scored.filter(x=>x.score>0):scored).slice(0,limit)}

function sentences(context:string){return context.replace(/\[\[PAGE \d+\]\]/g,' ').replace(/SOURCE\s+[^\n]+/g,' ').split(/(?<=[.!?؟])\s+|\n+/).map(x=>x.trim()).filter(x=>x.length>35)}
function keywords(context:string,limit=16){const stop=new Set('هذا هذه ذلك التي الذي من إلى في على عن مع ثم أو و هو هي تم يتم كما كان تكون يكون بين عند بعد قبل خلال ضمن حيث اذا إذا ما لا كل قد an the and of to in for on is are was were this that with from by as or'.split(/\s+/));const words=(context.match(/[\p{L}\p{N}][\p{L}\p{N}_-]{2,}/gu)||[]).map(x=>x.toLowerCase()).filter(x=>!stop.has(x));const counts=new Map<string,number>();for(const w of words)counts.set(w,(counts.get(w)||0)+1);return [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,limit).map(x=>x[0])}
function ref(context:string,text:string){const i=context.indexOf(text);const ms=[...context.slice(0,Math.max(0,i)).matchAll(/\[\[PAGE (\d+)\]\]/g)];return `ص ${ms.length?ms[ms.length-1][1]:1}`}
export async function aiTask(action:string,payload:any){const context=String(payload?.context||'').slice(0,120000);const ss=sentences(context);const ks=keywords(context);const top=ss.slice(0,Math.min(16,ss.length));
 if(action==='chat'){const terms=String(payload?.question||'').toLowerCase().split(/\s+/).filter((x:string)=>x.length>2);const hits=ss.map(text=>({text,score:terms.reduce((n:number,t:string)=>n+(text.toLowerCase().includes(t)?1:0),0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,4);return {text:hits.length?hits.map(x=>`${x.text} (${ref(context,x.text)})`).join('\n\n'):'غير موجود في المصادر المرفوعة بصيغة واضحة. جرّب سؤالًا أدق أو افتح Source Lens.',truth:hits.length?'supported':'unverified'}}
 if(action==='summary')return {summary:top.join('\n\n'),keyConcepts:ks.slice(0,10).map(k=>({title:k,definition:ss.find(s=>s.toLowerCase().includes(k))?.slice(0,220)||'مفهوم متكرر في المصدر.',sourceRef:ref(context,ss.find(s=>s.toLowerCase().includes(k))||'')})),estimatedCoverage:Math.min(90,Math.max(45,Math.round(top.join(' ').length/Math.max(1,context.length)*400))),omitted:['قد تُحذف أمثلة وتكرارات منخفضة الأهمية في الوضع المحلي.'],examRisk:ks.slice(0,5)};
 if(action==='translate')return {text:`[ترجمة ذكية كاملة تحتاج مزود AI. هذه معاينة للمصدر]\n\n${context.slice(0,30000)}`,glossary:ks.slice(0,10).map(k=>({term:k,translation:k}))};
 if(action==='mindmap')return {nodes:[{id:'root',label:ks[0]||'المادة',definition:'المفهوم المركزي',sourceRef:'ص 1',parent:null},...ks.slice(1,14).map((k,i)=>({id:`n${i+1}`,label:k,definition:ss.find(s=>s.toLowerCase().includes(k))?.slice(0,180)||'',sourceRef:ref(context,ss.find(s=>s.toLowerCase().includes(k))||''),parent:'root'}))]};
 if(action==='flashcards')return {cards:ks.slice(0,Math.min(Number(payload?.count)||10,12)).map((k,i)=>{const s=ss.find(x=>x.toLowerCase().includes(k))||top[i%Math.max(1,top.length)]||k;return {front:`ما المقصود بـ ${k} حسب المصدر؟`,back:s.slice(0,260),topic:k,sourceRef:ref(context,s)}})};
 if(action==='quiz'){const pool=ks.length?ks:['المفهوم'];return {questions:Array.from({length:Math.min(Number(payload?.count)||6,8)},(_,i)=>{const topic=pool[i%pool.length];const s=ss.find(x=>x.toLowerCase().includes(topic))||top[i%Math.max(1,top.length)]||topic;const d=pool.filter(x=>x!==topic).slice(0,3);while(d.length<3)d.push(`خيار ${d.length+2}`);return {question:`أي عبارة ترتبط أكثر بمفهوم «${topic}» حسب المصدر؟`,choices:[s.slice(0,150),...d.map(x=>`مفهوم مختلف: ${x}`)],answerIndex:0,explanation:'الإجابة الأولى مأخوذة من سياق المصدر.',sourceRef:ref(context,s),topic}})}};
 if(action==='study')return {steps:[{title:'استرجاع من الذاكرة',detail:`اكتب ما تتذكره عن ${(payload?.weakTopics||[])[0]||ks[0]||'الموضوع الأساسي'} بدون فتح المصدر.`},{title:'مراجعة الدليل',detail:'راجع الصفحة الأصلية وحدد ما نسيته.'},{title:'اختبار قصير',detail:'أنشئ اختبارًا من المادة وأجب قبل رؤية التفسير.'},{title:'تصحيح الأخطاء',detail:'راجع فقط أخطاء الاختبار.'},{title:'تثبيت',detail:'أنشئ بطاقات للمفاهيم الضعيفة.'}]};
 if(action==='assignment'){const req=String(payload?.instructions||'').split(/\n|[.;]/).map((x:string)=>x.trim()).filter((x:string)=>x.length>10).slice(0,8);return {checklist:req.map((text:string)=>({text,required:true})),outline:ks.slice(0,6).map((k,i)=>`${i+1}. ${k}`).join('\n'),draft:`مسودة أولية مبنية من المصادر:\n\n${top.slice(0,8).join('\n\n')}`,assessment:{criteria:[{name:'تغطية التعليمات',score:req.length?6:3,max:10,note:'تقييم محلي مبدئي.'}],missing:req.length?[]:['التعليمات غير كافية.']}}}
 if(action==='package')return {title:String(payload?.topic||'ScholarMCP Academic Package'),summary:top.slice(0,6).join('\n\n'),outline:ks.slice(0,8),slides:ks.slice(0,8).map((k,i)=>({title:k,bullets:(ss.filter(s=>s.toLowerCase().includes(k)).slice(0,4).length?ss.filter(s=>s.toLowerCase().includes(k)).slice(0,4):top.slice(i,i+3)).map(s=>s.slice(0,170)),notes:`راجع المصدر حول ${k}.`})),references:['المصادر المرفوعة داخل المادة']};
 return {text:'المعالجة المحلية جاهزة. مزود AI سيضيف تحليلًا أعمق.'}}

export async function researchCrossref(q:string){const r=await fetch(`https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(q)}&rows=10&select=DOI,title,author,issued,container-title,URL,type`);if(!r.ok)throw new Error('تعذر الاتصال بـ Crossref');const j=await r.json();return (j.message?.items||[]).map((p:any)=>{const title=p.title?.[0]||'';const authors=(p.author||[]).map((a:any)=>[a.given,a.family].filter(Boolean).join(' '));const year=p.issued?.['date-parts']?.[0]?.[0]||null;const journal=p['container-title']?.[0]||'';const doi=p.DOI||'';return {title,authors,year,journal,doi,url:doi?`https://doi.org/${doi}`:p.URL,citation:`${authors.join(', ')} (${year||'n.d.'}). ${title}. ${journal}${doi?`. https://doi.org/${doi}`:''}`}}).filter((x:any)=>x.title)}
export function youtubeUrl(q:string){return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`}
function saveBlob(blob:Blob,name:string){const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
export async function exportDocx(title:string,body:string){const lines=body.split('\n');const doc=new Document({sections:[{children:[new Paragraph({text:title,heading:HeadingLevel.TITLE,bidirectional:true,alignment:AlignmentType.RIGHT}),...lines.map(x=>new Paragraph({children:[new TextRun(x)],bidirectional:true,alignment:AlignmentType.RIGHT}))]}]});saveBlob(await Packer.toBlob(doc),`${safeFileName(title)}.docx`)}
export async function exportPptx(pack:{title:string;slides:Array<{title:string;bullets:string[];notes?:string}>}){const pptx=new PptxGenJS();pptx.layout='LAYOUT_WIDE';pptx.author='ScholarMCP';pptx.title=pack.title;for(const s of pack.slides){const slide=pptx.addSlide();slide.background={color:'F8FAFC'};slide.addText(s.title,{x:.7,y:.5,w:11.8,h:.6,fontFace:'Arial',fontSize:25,bold:true,align:'right',color:'0F1F3D'});slide.addText(s.bullets.map(b=>`• ${b}`).join('\n'),{x:.9,y:1.45,w:11.2,h:4.9,fontFace:'Arial',fontSize:18,align:'right',valign:'top',color:'334155'});try{if(s.notes&&(slide as any).addNotes)(slide as any).addNotes(s.notes)}catch{}}await pptx.writeFile({fileName:`${safeFileName(pack.title)}.pptx`})}
