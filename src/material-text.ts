const KEY='scholarmcp.github.v1';

export function saveMaterialText(materialId:string,text:string){
  const raw=localStorage.getItem(KEY);if(!raw)throw new Error('بيانات ScholarMCP غير موجودة.');
  const state=JSON.parse(raw);const material=(state.materials||[]).find((m:any)=>m.id===materialId);if(!material)throw new Error('المصدر غير موجود.');
  material.text=text;material.status=text.trim()?'ready':'failed';material.error=text.trim()?undefined:'النص المستخرج فارغ.';
  localStorage.setItem(KEY,JSON.stringify(state));window.dispatchEvent(new Event('scholar-state'));
}
