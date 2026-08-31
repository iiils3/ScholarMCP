import JSZip from 'jszip';
import { type AppState, safeFileName } from './lib';

function download(blob:Blob,name:string){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
function asText(value:unknown){if(typeof value==='string')return value;return JSON.stringify(value,null,2)}

export async function exportAcademicBag(state:AppState,courseId:string){
  const course=state.courses.find(c=>c.id===courseId);if(!course)throw new Error('المادة غير موجودة.');
  const zip=new JSZip();const root=zip.folder(safeFileName(course.name))!;
  const materials=state.materials.filter(m=>m.courseId===courseId);const artifacts=state.artifacts.filter(a=>a.courseId===courseId);const cards=state.flashcards.filter(c=>c.courseId===courseId);const topics=state.topics.filter(t=>t.courseId===courseId);const assignments=state.assignments.filter(a=>a.courseId===courseId);
  root.file('README.txt',`ScholarMCP — الحقيبة الأكاديمية الكاملة\nالمادة: ${course.name}\nتاريخ التصدير: ${new Date().toLocaleString('ar-IQ')}\n\nالمحتويات:\n- المصادر النصية المستخرجة\n- المخرجات الأكاديمية\n- بطاقات المراجعة\n- خريطة الإتقان\n- الواجبات\n`);
  const sources=root.folder('01-المصادر')!;for(const m of materials)sources.file(`${safeFileName(m.name)}.txt`,m.text||'');
  const outputs=root.folder('02-المخرجات')!;for(const a of artifacts)outputs.file(`${safeFileName(a.title)}-${a.type}.json`,JSON.stringify({title:a.title,type:a.type,truth:a.truth,coverage:a.coverage,data:a.data},null,2));
  const study=root.folder('03-المراجعة')!;study.file('flashcards.tsv',['السؤال\tالجواب\tالموضوع\tالمصدر',...cards.map(c=>[c.front,c.back,c.topic||'',c.sourceRef||''].map(x=>String(x).replace(/\t|\n/g,' ')).join('\t'))].join('\n'));study.file('mastery.json',JSON.stringify(topics,null,2));
  const work=root.folder('04-الواجبات')!;for(const a of assignments)work.file(`${safeFileName(a.title)}.txt`,[`العنوان: ${a.title}`,`التعليمات:\n${a.instructions}`,`Rubric:\n${a.rubric}`,`Outline:\n${a.outline||''}`,`Draft:\n${a.draft||''}`,`Assessment:\n${asText(a.assessment||{})}`].join('\n\n'));
  root.file('manifest.json',JSON.stringify({course,counts:{materials:materials.length,artifacts:artifacts.length,flashcards:cards.length,topics:topics.length,assignments:assignments.length}},null,2));
  const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});download(blob,`${safeFileName(course.name)}-ScholarMCP-Academic-Bag.zip`);return {size:blob.size,files:materials.length+artifacts.length+cards.length+topics.length+assignments.length};
}
