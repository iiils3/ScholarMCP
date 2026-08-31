import { getSourceBlob,putSourceBlob } from './blob-store';
import type { AppState } from './lib';

const STATE_KEY='scholarmcp.github.v1';
function saveBlob(blob:Blob,name:string){const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1500)}
export async function exportFullBackup(state:AppState){
  const {default:JSZip}=await import('jszip');const zip=new JSZip();zip.file('state.json',JSON.stringify({version:1,exportedAt:new Date().toISOString(),state},null,2));
  const folder=zip.folder('sources')!;for(const m of state.materials){const b=await getSourceBlob(m.id);if(b)folder.file(`${m.id}.bin`,b)}
  const out=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:4}});saveBlob(out,`ScholarMCP-backup-${new Date().toISOString().slice(0,10)}.zip`);return state.materials.length;
}
export async function restoreFullBackup(file:File){
  const {default:JSZip}=await import('jszip');const zip=await JSZip.loadAsync(await file.arrayBuffer());const raw=await zip.file('state.json')?.async('string');if(!raw)throw new Error('الملف ليس نسخة ScholarMCP صالحة.');const parsed=JSON.parse(raw);const state:AppState=parsed.state;if(!state?.profile||!Array.isArray(state?.courses))throw new Error('بنية النسخة الاحتياطية غير صالحة.');
  for(const m of state.materials||[]){const f=zip.file(`sources/${m.id}.bin`);if(f)await putSourceBlob(m.id,await f.async('blob'))}
  localStorage.setItem(STATE_KEY,JSON.stringify(state));return state;
}
