export type ScholarVideo={id:string;title:string;author?:string;duration?:string;views?:string;thumbnail?:string;description?:string};
let clientPromise:Promise<any>|null=null;

async function client(){
  if(clientPromise)return clientPromise;
  clientPromise=(async()=>{const {Innertube}=await import('youtubei.js');return Innertube.create({lang:'ar',location:'IQ',retrieve_player:false,generate_session_locally:true} as any)})().catch(e=>{clientPromise=null;throw e});
  return clientPromise;
}
function text(x:any){return String(x?.text??x?.toString?.()??x??'')}
export async function searchVideos(query:string,limit=12):Promise<ScholarVideo[]>{
  const yt=await client();const result=await yt.search(query,{type:'video'});const items=(result?.videos||result?.results||[]).slice(0,limit);
  return items.map((v:any)=>({
    id:String(v.id||v.video_id||''),title:text(v.title),author:text(v.author?.name||v.author),duration:text(v.duration?.text||v.duration),views:text(v.view_count?.text||v.view_count),thumbnail:v.thumbnails?.at?.(-1)?.url||v.thumbnail?.[0]?.url||v.thumbnails?.[0]?.url,description:text(v.description_snippet||v.description)
  })).filter((v:ScholarVideo)=>v.id&&v.title)
}
export function embedUrl(id:string){return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&modestbranding=1`}
