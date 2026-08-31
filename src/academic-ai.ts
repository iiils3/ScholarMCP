import { customTask } from './puter';

const ground='أنت وكيل أكاديمي داخل ScholarMCP. لا تخترع بيانات غير موجودة في المصدر. أعد JSON صالحاً فقط بلا markdown. إذا كانت قيمة غير موجودة ضع null أو مصفوفة فارغة.';

export async function analyzeSyllabus(text:string){
  return customTask(`${ground}\nحلل هذا السيلابس/وصف المقرر. استخرج اسم المادة، المواعيد، الامتحانات، الواجبات، السيمنارات، توزيع الدرجات، المواضيع الأسبوعية، وأي تعليمات مهمة. التواريخ يجب أن تكون YYYY-MM-DD إذا أمكن.\nأعد بالضبط: {"courseName":"","instructor":null,"term":null,"grading":[{"name":"","weight":0}],"deadlines":[{"title":"","kind":"exam|assignment|presentation|other","dueAt":"YYYY-MM-DD"}],"weeks":[{"week":1,"topics":[""]}],"rules":[""],"warnings":[""]}.`,text.slice(0,100000));
}
export async function analyzeExamDNA(text:string){
  return customTask(`${ground}\nهذه مجموعة امتحانات أو أسئلة سابقة. حلل النمط فقط ولا تدّعِ توقع الأسئلة المستقبلية. استخرج أنواع الأسئلة وتكرار المواضيع والصعوبة وصياغة المدرس والمهارات المطلوبة.\nأعد {"questionTypes":[{"type":"","share":0}],"repeatedTopics":[{"topic":"","frequency":0}],"difficulty":"easy|medium|hard|mixed","styleNotes":[""],"skills":["recall|understanding|application|analysis"],"recommendations":[""],"sampleBlueprint":{"mcq":0,"trueFalse":0,"shortAnswer":0,"essay":0,"case":0}}.`,text.slice(0,100000));
}
export async function buildSeminarRehearsal(title:string,slides:Array<{title:string;bullets?:string[];notes?:string}>){
  return customTask(`${ground}\nجهز الطالب للدفاع عن سيمنار بعنوان ${title}. بناءً على الشرائح التالية، ولّد أسئلة محتملة من المدرس، أجوبة قصيرة موثوقة من محتوى العرض، ونقاط يجب أن ينتبه لها أثناء الإلقاء.\nأعد {"questions":[{"question":"","answer":"","slide":1}],"deliveryTips":[""],"opening":"","closing":""}.`,JSON.stringify(slides).slice(0,70000));
}
