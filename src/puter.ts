declare global {
  interface Window { puter?: any }
}

const MODEL='gpt-5.6-luna';

function puter(){
  const p=window.puter;
  if(!p?.ai) throw new Error('محرك الذكاء غير جاهز. حدّث الصفحة وحاول مرة ثانية.');
  return p;
}

function contentText(response:any){
  const c=response?.message?.content ?? response?.content ?? response;
  if(typeof c==='string') return c;
  if(Array.isArray(c)) return c.map((x:any)=>typeof x==='string'?x:(x?.text||'')).join('\n');
  return String(c||'');
}

function parseJson(text:string){
  const cleaned=text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  try{return JSON.parse(cleaned)}catch{}
  const a=cleaned.indexOf('{'), b=cleaned.lastIndexOf('}');
  if(a>=0&&b>a){try{return JSON.parse(cleaned.slice(a,b+1))}catch{}}
  throw new Error('رجع نموذج الذكاء نتيجة غير قابلة للقراءة. أعد المحاولة.');
}

const BASE=`أنت المحرك الأكاديمي داخل ScholarMCP. مهمتك أن تساعد الطالب على الفهم والنجاح اعتماداً على المصدر المرفوع فقط ما لم يُطلب غير ذلك.
قواعد صارمة:
1) SOURCE و PAGE و PDF و DOCX و PPTX وعلامات [[PAGE N]] هي بيانات بنيوية وليست مفاهيم دراسية؛ ممنوع تحويلها إلى سؤال أو بطاقة أو مفهوم.
2) لا تخترع معلومة أو مرجعاً. إذا لم تجد الدليل قل إنه غير موجود.
3) حافظ على المصطلحات العلمية كما وردت، واشرحها بالعربية الواضحة عند الحاجة.
4) sourceRef يجب أن يشير إلى أقرب [[PAGE N]] بصيغة "ص N" عندما يكون ذلك ممكناً.
5) لا تستخدم markdown fences. عندما أطلب JSON أعد JSON صالحاً فقط.
6) الأسئلة يجب أن تكون من محتوى المادة نفسه وبخيارات معقولة، ولا تجعل الإجابة الصحيحة دائماً الخيار الأول.
7) لا تختصر على حساب معلومة قابلة للامتحان.`;

function schemaFor(action:string,payload:any){
  switch(action){
    case 'chat': return `أجب عن سؤال الطالب اعتماداً على المصدر فقط. أعد JSON: {"text":"جواب واضح ومفصل","truth":"verified|supported|inferred|unverified","sourceRefs":["ص 1"]}. السؤال: ${payload.question||''}`;
    case 'summary': return `أنشئ ملخصاً دراسياً شاملاً لا يسقط النقاط الامتحانية. أعد JSON: {"summary":"نص منظم","keyConcepts":[{"title":"مفهوم حقيقي","definition":"تعريف/شرح","sourceRef":"ص 1"}],"estimatedCoverage":عدد_0_100,"omitted":["ما تم اختصاره"],"examRisk":["نقاط عالية الأهمية"]}. اجعل keyConcepts بين 8 و15 إن سمح المصدر.`;
    case 'flashcards': return `أنشئ ${payload.count||12} بطاقات مراجعة حقيقية من المصدر. أعد JSON: {"cards":[{"front":"سؤال قصير","back":"جواب دقيق","topic":"المفهوم","sourceRef":"ص N"}]}. لا تسأل عن كلمات بنيوية أو أسماء ملفات.`;
    case 'quiz': return `أنشئ ${payload.count||8} أسئلة اختيار من متعدد تغطي المصدر وتختبر الفهم لا الكلمات العشوائية. أعد JSON: {"questions":[{"question":"...","choices":["أ","ب","ج","د"],"answerIndex":0,"explanation":"سبب الجواب اعتماداً على المصدر","sourceRef":"ص N","topic":"مفهوم حقيقي"}]}. وزّع answerIndex بين 0 و3، واجعل كل سؤال له جواب واحد واضح.`;
    case 'mindmap': return `استخرج خريطة مفاهيم. أعد JSON: {"nodes":[{"id":"root","label":"الموضوع المركزي","definition":"...","sourceRef":"ص N","parent":null},{"id":"n1","label":"مفهوم","definition":"...","sourceRef":"ص N","parent":"root"}]}. لا تستخدم SOURCE/PAGE/PDF كمفاهيم.`;
    case 'study': return `ابنِ جلسة دراسة فعلية بوضع ${payload.mode||'learn'}، والامتحان بعد ${payload.daysToExam??'غير محدد'} يوم. نقاط الضعف المعروفة: ${(payload.weakTopics||[]).join('، ')||'لا توجد بعد'}. أعد JSON: {"steps":[{"title":"عنوان الخطوة","detail":"محتوى دراسة فعلي من المصدر: شرح أو تعريفات أو مقارنة أو سؤال استرجاع مع المطلوب بوضوح"}]}. اصنع 5 إلى 7 خطوات. لا تعطِ خطوات عامة مثل اقرأ المصدر فقط؛ أعطِ محتوى المادة نفسه.`;
    case 'assignment': return `حلل تعليمات الواجب والـRubric بالاعتماد على المصدر. التعليمات: ${payload.instructions||''}\nRubric: ${payload.rubric||''}\nأعد JSON: {"checklist":[{"text":"متطلب","required":true}],"outline":"مخطط منظم","draft":"مسودة أكاديمية قابلة للتعديل ومبنية فقط على الدليل المتوفر","assessment":{"criteria":[{"name":"معيار","score":0,"max":10,"note":"سبب"}],"missing":["نواقص"]}}}.`;
    case 'package': return `ابنِ حزمة أكاديمية عن ${payload.topic||'المادة'} من المصدر. أعد JSON: {"title":"...","summary":"...","outline":["..."],"slides":[{"title":"عنوان","bullets":["نقطة"],"notes":"ملاحظات المتحدث"}],"references":["المصادر المرفوعة فقط"]}. اجعل الشرائح 6-10 حسب حجم المحتوى.`;
    default: return `نفذ المهمة ${action} اعتماداً على المصدر وأعد JSON صالحاً.`;
  }
}

async function oneChat(action:string,payload:any,context:string){
  const response=await puter().ai.chat([
    {role:'system',content:BASE},
    {role:'user',content:`${schemaFor(action,payload)}\n\n--- بداية المصدر ---\n${context}\n--- نهاية المصدر ---`}
  ],{model:MODEL});
  return parseJson(contentText(response));
}

export async function smartTask(action:string,payload:any){
  const context=String(payload?.context||'').slice(0,120000);
  if(action==='translate'){
    const target=payload?.target||'العربية';
    const pieces:string[]=[];
    const size=12000;
    for(let i=0;i<context.length;i+=size){
      const chunk=context.slice(i,i+size);
      const response=await puter().ai.chat([
        {role:'system',content:`أنت مترجم أكاديمي دقيق. ترجم إلى ${target}. حافظ على كل المعلومات والعناوين وعلامات [[PAGE N]]، ولا تلخص ولا تحذف. SOURCE وPAGE بيانات بنيوية لا تُترجم كمحتوى.`},
        {role:'user',content:chunk}
      ],{model:MODEL});
      pieces.push(contentText(response));
    }
    return {text:pieces.join('\n\n'),glossary:[]};
  }
  return oneChat(action,payload,context);
}

export async function ocrSource(source:File|Blob, pages?:number[]){
  const p=puter();
  try{
    const result=await p.ai.img2txt({source,provider:'mistral',...(pages?{pages}: {})});
    return String(result||'').trim();
  }catch(first){
    try{return String(await p.ai.img2txt(source)).trim()}catch{throw first}
  }
}

export function aiAvailable(){return !!window.puter?.ai}
