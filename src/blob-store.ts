const DB_NAME='scholarmcp-files';
const STORE='sources';
const VERSION=1;

function openDB(){
  return new Promise<IDBDatabase>((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,VERSION);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE)};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
}

async function tx<T>(mode:IDBTransactionMode,fn:(store:IDBObjectStore,resolve:(v:T)=>void,reject:(e:any)=>void)=>void){
  const db=await openDB();return new Promise<T>((resolve,reject)=>{const tr=db.transaction(STORE,mode);const store=tr.objectStore(STORE);fn(store,resolve,reject);tr.oncomplete=()=>db.close();tr.onerror=()=>{db.close();reject(tr.error)}});
}

export async function putSourceBlob(id:string,blob:Blob){return tx<void>('readwrite',(s,res,rej)=>{const r=s.put(blob,id);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
export async function getSourceBlob(id:string){return tx<Blob|null>('readonly',(s,res,rej)=>{const r=s.get(id);r.onsuccess=()=>res(r.result instanceof Blob?r.result:null);r.onerror=()=>rej(r.error)})}
export async function deleteSourceBlob(id:string){return tx<void>('readwrite',(s,res,rej)=>{const r=s.delete(id);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
export async function sourceBlobExists(id:string){return !!(await getSourceBlob(id))}

export async function storageEstimate(){
  const e=await navigator.storage?.estimate?.();return {usage:e?.usage||0,quota:e?.quota||0,persisted:await navigator.storage?.persisted?.()||false};
}
export async function requestPersistentStorage(){try{return !!(await navigator.storage?.persist?.())}catch{return false}}
