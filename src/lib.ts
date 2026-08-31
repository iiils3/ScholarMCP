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

export const uid=()=>globalThis.crypto?.randomUUID?.()||`sch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
export const todayIso=()=>new Date().toISOString();
export function daysUntil(iso?:string){if(!iso)return undefined;return Math.ceil((new Date(iso).getTime()-Date.now())/86400000)}
export function fmtDate(iso?:string){if(!iso)return 'غير محدد';return new Intl.DateTimeFormat('ar-IQ',{year:'numeric',month:'short',day:'numeric'}).format(new Date(iso))}
export function humanSize(n:number){if(n<1024)return `${n} B`;if(n<1048576)return `${(n/1024).toFixed(1)} KB`;return `${(n/1048576).toFixed(1)} MB`}
export function safeFileName(v:string){return v.replace(/[\\/:*?"<>|]+/g,'-').slice(0,100)||'ScholarMCP'}
export function courseMastery(state:AppState,courseId:string){const t=state.topics.filter(x=>x.courseId===courseId&&x.attempts>0);return t.length?Math.round(t.reduce((a,x)=>a+x.mastery,0)/t.length):state.courses.find(c=>c.id===courseId)?.mastery||0}
export function riskScore(state:AppState,c:Course){const d=daysUntil(c.examDate);const m=courseMastery(state,c.id);const p=d===undefined?0.25:Math.max(0,Math.min(1,1-d/30));return Math.round((p*.65+(1-m/100)*.35)*100)}
export function weakest(state:AppState,courseId?:string){return state.topics.filter(t=>!courseId||t.courseId===courseId).slice().sort((a,b)=>a.mastery-b.mastery||b.attempts-a.attempts).slice(0,3)}

const EMPTY:AppState={profile:{name:'',studyLanguage:'ar',onboarded:false},courses:[],materials:[],topics:[],flashcards:[],deadlines:[],artifacts:[],assignments:[]};
const LOCAL_KEY='scholarmcp.github.v1';
function cloneState<T>(value:T):T{try{return structuredClone(value)}catch{return JSON.parse(JSON.stringify(value)) as T}}
const banned=(v?:string)=>/^(source|page|pdf|docx?|pptx?|file)$/i.test((v||'').trim());

export class LocalRepository{
  state:AppState;
  constructor(){try{this.state={...cloneState(EMPTY),...JSON.parse(localStorage.getItem(LOCAL_KEY)||'{}')} as AppState}catch{this.state=cloneState(EMPTY)}}
  persist(){localStorage.setItem(LOCAL_KEY,JSON.stringify(this.state));window.dispatchEvent(new Event('scholar-state'))}
  setProfile(p:Partial<Profile>){this.state.profile={...this.state.profile,...p};this.persist()}
  addCourse(name:string,examDate?:string){const c:Course={id:uid(),name,examDate:examDate||undefined,color:'#2563eb',mastery:0,createdAt:todayIso()};this.state.courses.push(c);if(examDate)this.state.deadlines.push({id:uid(),courseId:c.id,title:`امتحان ${name}`,kind:'exam',dueAt:examDate,done:false});this.persist();return c}
  updateCourse(id:string,patch:Partial<Course>){this.state.courses=this.state.courses.map(c=>c.id===id?{...c,...patch}:c);this.persist()}
  deleteCourse(id:string){this.state.courses=this.state.courses.filter(c=>c.id!==id);this.state.materials=this.state.materials.filter(x=>x.courseId!==id);this.state.topics=this.state.topics.filter(x=>x.courseId!==id);this.state.flashcards=this.state.flashcards.filter(x=>x.courseId!==id);this.state.deadlines=this.state.deadlines.filter(x=>x.courseId!==id);this.state.artifacts=this.state.artifacts.filter(x=>x.courseId!==id);this.state.assignments=this.state.assignments.filter(x=>x.courseId!==id);this.persist()}
  addMaterial(m:Omit<Material,'id'|'createdAt'>){const x={...m,id:uid(),createdAt:todayIso()};this.state.materials.unshift(x);this.persist();return x}
  deleteMaterial(id:string){this.state.materials=this.state.materials.filter(x=>x.id!==id);this.persist()}
  upsertTopics(courseId:string,items:Array<{title:string;sourceRef?:string}>){for(const i of items){const title=i.title?.trim();if(!title||banned(title)||this.state.topics.some(t=>t.courseId===courseId&&t.title===title))continue;this.state.topics.push({id:uid(),courseId,title,mastery:0,attempts:0,correct:0,incorrect:0,sourceRef:i.sourceRef})}this.persist()}
  recordTopic(courseId:string,title:string|undefined,correct:boolean){if(!title||banned(title))return;let t=this.state.topics.find(x=>x.courseId===courseId&&x.title===title);if(!t){t={id:uid(),courseId,title,mastery:0,attempts:0,correct:0,incorrect:0};this.state.topics.push(t)}t.attempts++;correct?t.correct++:t.incorrect++;t.mastery=Math.min(100,Math.max(0,Math.round((t.correct/t.attempts)*100*(1-Math.exp(-t.attempts/3))+(correct?4:0))));this.persist()}
  addArtifact(a:Omit<Artifact,'id'|'createdAt'>){const x={...a,id:uid(),createdAt:todayIso()};this.state.artifacts.unshift(x);this.persist();return x}
  addFlashcards(courseId:string,cards:Array<{front:string;back:string;topic?:string;sourceRef?:string}>){const made=cards.filter(c=>c.front&&c.back&&!banned(c.topic)&&!/\b(source|page|pdf|docx?|pptx?)\b/i.test(c.front)).map(c=>({...c,id:uid(),courseId,dueAt:todayIso(),interval:0}));this.state.flashcards.unshift(...made);this.persist();return made}
  reviewCard(id:string,good:boolean){const c=this.state.flashcards.find(x=>x.id===id);if(!c)return;c.interval=good?(c.interval?Math.min(60,Math.round(c.interval*2.2)):1):0;c.dueAt=new Date(Date.now()+Math.max(.25,c.interval)*86400000).toISOString();this.persist()}
  addAssignment(a:Omit<Assignment,'id'|'createdAt'>){const x={...a,id:uid(),createdAt:todayIso()};this.state.assignments.unshift(x);if(a.dueAt)this.state.deadlines.push({id:uid(),courseId:a.courseId,title:a.title,kind:'assignment',dueAt:a.dueAt,done:false});this.persist();return x}
}

export async function parseFile(file:File){return (await import('./parser')).parseFile(file)}

export function chunks(text:string,size=2600){const out:Array<{page:number;text:string}>=[];const parts=text.split(/\[\[PAGE (\d+)\]\]/);if(parts.length>1){for(let i=1;i<parts.length;i+=2){const page=Number(parts[i]);const body=(parts[i+1]||'').trim();for(let j=0;j<body.length;j+=size)out.push({page,text:body.slice(j,j+size)})}}else for(let j=0;j<text.length;j+=size)out.push({page:1,text:text.slice(j,j+size)});return out}
export function retrieve(materials:Material[],query:string,limit=8){const terms=query.toLowerCase().split(/\s+/).filter(x=>x.length>2);const scored=materials.flatMap(m=>chunks(m.text,1500).map(c=>({material:m.name,...c,score:terms.reduce((s,t)=>s+(c.text.toLowerCase().includes(t)?1:0),0)})));scored.sort((a,b)=>b.score-a.score);return (scored.filter(x=>x.score>0).length?scored.filter(x=>x.score>0):scored).slice(0,limit)}

function cleanAcademic(context:string){return context.replace(/^SOURCE[^\n]*$/gmi,' ').replace(/\[\[PAGE\s+\d+\]\]/gi,' ').replace(/\b(source|page|pdf|docx?|pptx?|file)\b/gi,' ').replace(/\s+/g,' ').trim()}
function sentences(context:string){return cleanAcademic(context).split(/(?<=[.!?؟])\s+|\n+/).map(x=>x.trim()).filter(x=>x.length>35)}
function keywords(context:string,limit=20){const stop=new Set('هذا هذه ذلك التي الذي من إلى في على عن مع ثم أو و هو هي تم يتم كما كان تكون يكون بين عند بعد قبل خلال ضمن حيث اذا إذا ما لا كل قد an the and of to in for on is are was were this that with from by as or source page pdf doc docx ppt pptx file'.split(/\s+/));const words=(cleanAcademic(context).match(/[\p{L}\p{N}][\p{L}\p{N}_-]{2,}/gu)||[]).map(x=>x.toLowerCase()).filter(x=>!stop.has(x)&&!/^\d+$/.test(x));const counts=new Map<string,number>();for(const w of words)counts.set(w,(counts.get(w)||0)+1);return [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,limit).map(x=>x[0])}
function pageRef(context:string,text:string){const i=context.indexOf(text);const ms=[...context.slice(0,Math.max(0,i)).matchAll(/\[\[PAGE (\d+)\]\]/g)];return `ص ${ms.length?ms[ms.length-1][1]:1}`}

async function localFallback(action:string,payload:any){
  const context=String(payload?.context||'').slice(0,120000);
  const ss=sentences(context), ks=keywords(context), top=ss.slice(0,18);
  if(action==='chat'){
    const terms=String(payload?.question||'').toLowerCase().split(/\s+/).filter((x:string)=>x.length>2);
    const hits=ss.map(text=>({text,score:terms.reduce((n:number,t:string)=>n+(text.toLowerCase().includes(t)?1:0),0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,4);
    return {text:hits.length?hits.map(x=>`${x.text} (${pageRef(context,x.text)})`).join('\n\n'):'غير موجود في المصدر بصيغة واضحة.',truth:hits.length?'supported':'unverified'};
  }
  if(action==='summary'){
    return {summary:top.join('\n\n'),keyConcepts:ks.slice(0,10).map(k=>{const s=ss.find(x=>x.toLowerCase().includes(k))||'';return {title:k,definition:s.slice(0,260),sourceRef:pageRef(context,s)}}),estimatedCoverage:Math.min(85,Math.max(35,Math.round(top.join(' ').length/Math.max(1,cleanAcademic(context).length)*400))),omitted:['هذه نتيجة محلية احتياطية؛ فعّل اتصال AI لملخص أدق.'],examRisk:ks.slice(0,5)};
  }
  if(action==='flashcards'){
    return {cards:ks.slice(0,Math.min(Number(payload?.count)||10,12)).map((k,i)=>{const s=ss.find(x=>x.toLowerCase().includes(k))||top[i%Math.max(1,top.length)]||k;return {front:`اشرح ${k} حسب المادة.`,back:s.slice(0,300),topic:k,sourceRef:pageRef(context,s)}})};
  }
  if(action==='quiz'){
    const pool=ks.slice(0,16);
    const questions=pool.slice(0,Math.min(Number(payload?.count)||6,8)).map((term,i)=>{
      const s=ss.find(x=>x.toLowerCase().includes(term))||top[i%Math.max(1,top.length)]||term;
      const distractors=pool.filter(x=>x!==term).slice(i+1).concat(pool).filter(x=>x!==term).slice(0,3);
      const answerIndex=i%4;const choices=[...distractors];while(choices.length<3)choices.push(`خيار ${choices.length+1}`);choices.splice(answerIndex,0,term);
      return {question:`أي مصطلح يرتبط مباشرة بهذه العبارة؟\n${s.slice(0,220)}`,choices,answerIndex,explanation:`المصطلح «${term}» ورد ضمن سياق العبارة في المصدر.`,sourceRef:pageRef(context,s),topic:term};
    });
    return {questions};
  }
  if(action==='mindmap'){
    return {nodes:[{id:'root',label:ks[0]||'المادة',definition:top[0]||'',sourceRef:'ص 1',parent:null},...ks.slice(1,12).map((k,i)=>{const s=ss.find(x=>x.toLowerCase().includes(k))||'';return {id:`n${i+1}`,label:k,definition:s.slice(0,180),sourceRef:pageRef(context,s),parent:'root'}})]};
  }
  if(action==='study') return {steps:top.slice(0,5).map((s,i)=>({title:['الفكرة الأساسية','شرح مركز','ربط المفاهيم','استرجاع نشط','تثبيت'][i]||`خطوة ${i+1}`,detail:s}))};
  if(action==='translate') return {text:'تعذر تشغيل مترجم AI. اتصل بالإنترنت وحاول مرة ثانية.',glossary:[]};
  if(action==='assignment'){
    const req=String(payload?.instructions||'').split(/\n|[.;]/).map((x:string)=>x.trim()).filter((x:string)=>x.length>10).slice(0,8);
    return {checklist:req.map((text:string)=>({text,required:true})),outline:ks.slice(0,6).map((k,i)=>`${i+1}. ${k}`).join('\n'),draft:top.slice(0,8).join('\n\n'),assessment:{criteria:[],missing:['تقييم AI غير متاح حالياً.']}};
  }
  if(action==='package') return {title:String(payload?.topic||'ScholarMCP Academic Package'),summary:top.slice(0,6).join('\n\n'),outline:ks.slice(0,8),slides:ks.slice(0,8).map((k,i)=>({title:k,bullets:(ss.filter(s=>s.toLowerCase().includes(k)).slice(0,3).length?ss.filter(s=>s.toLowerCase().includes(k)).slice(0,3):top.slice(i,i+2)).map(s=>s.slice(0,170)),notes:`راجع المصدر حول ${k}.`})),references:['المصادر المرفوعة داخل المادة']};
  return {text:'المعالجة المحلية الاحتياطية.'};
}

export async function aiTask(action:string,payload:any){
  try{return await (await import('./puter')).smartTask(action,payload)}
  catch(e){console.warn('ScholarMCP AI fallback:',e);return localFallback(action,payload)}
}

export async function researchCrossref(q:string){const r=await fetch(`https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(q)}&rows=10&select=DOI,title,author,issued,container-title,URL,type`);if(!r.ok)throw new Error('تعذر الاتصال بـ Crossref');const j=await r.json();return (j.message?.items||[]).map((p:any)=>{const title=p.title?.[0]||'';const authors=(p.author||[]).map((a:any)=>[a.given,a.family].filter(Boolean).join(' '));const year=p.issued?.['date-parts']?.[0]?.[0]||null;const journal=p['container-title']?.[0]||'';const doi=p.DOI||'';return {title,authors,year,journal,doi,url:doi?`https://doi.org/${doi}`:p.URL,citation:`${authors.join(', ')} (${year||'n.d.'}). ${title}. ${journal}${doi?`. https://doi.org/${doi}`:''}`}}).filter((x:any)=>x.title)}
export function youtubeUrl(q:string){return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`}
function saveBlob(blob:Blob,name:string){const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
export async function exportDocx(title:string,body:string){const {Document,HeadingLevel,Packer,Paragraph,TextRun,AlignmentType}=await import('docx');const lines=body.split('\n');const doc=new Document({sections:[{children:[new Paragraph({text:title,heading:HeadingLevel.TITLE,bidirectional:true,alignment:AlignmentType.RIGHT}),...lines.map(x=>new Paragraph({children:[new TextRun(x)],bidirectional:true,alignment:AlignmentType.RIGHT}))]}]});saveBlob(await Packer.toBlob(doc),`${safeFileName(title)}.docx`)}
export async function exportPptx(pack:{title:string;slides:Array<{title:string;bullets:string[];notes?:string}>}){const {default:PptxGenJS}=await import('pptxgenjs');const pptx=new PptxGenJS();pptx.layout='LAYOUT_WIDE';pptx.author='ScholarMCP';pptx.title=pack.title;for(const s of pack.slides){const slide=pptx.addSlide();slide.background={color:'F8FAFC'};slide.addText(s.title,{x:.7,y:.5,w:11.8,h:.6,fontFace:'Arial',fontSize:25,bold:true,align:'right',color:'0F1F3D'});slide.addText((s.bullets||[]).map(b=>`• ${b}`).join('\n'),{x:.9,y:1.45,w:11.2,h:4.9,fontFace:'Arial',fontSize:18,align:'right',valign:'top',color:'334155'});try{if(s.notes&&(slide as any).addNotes)(slide as any).addNotes(s.notes)}catch{}}await pptx.writeFile({fileName:`${safeFileName(pack.title)}.pptx`})}
