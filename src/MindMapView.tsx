import { useMemo } from 'react';
import { Background,Controls,MiniMap,ReactFlow,type Edge,type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

export default function MindMapView({nodes:data}:{nodes:any[]}){
  const {nodes,edges}=useMemo(()=>{
    const input=Array.isArray(data)?data:[];const byParent=new Map<string,number>();
    const nodes:Node[]=input.map((n:any,i:number)=>{
      const parent=n.parent||null;const level=parent?1:0;const slot=byParent.get(parent||'root')||0;byParent.set(parent||'root',slot+1);
      return {id:String(n.id||`n${i}`),position:{x:parent?80+(slot%3)*280:360,y:parent?160+Math.floor(slot/3)*150:20},data:{label:<div dir="rtl" className="mind-node"><b>{n.label}</b>{n.definition&&<small>{n.definition}</small>}{n.sourceRef&&<em>{n.sourceRef}</em>}</div>},style:{width:240,borderRadius:16,border:'1px solid #dbe4f2',padding:10,background:parent?'#fff':'#173b6d',color:parent?'#10213f':'#fff'}};
    });
    const ids=new Set(nodes.map(n=>n.id));const root=nodes[0]?.id;const edges:Edge[]=input.slice(1).map((n:any,i:number)=>({id:`e${i}`,source:ids.has(String(n.parent))?String(n.parent):root,target:String(n.id||`n${i+1}`),animated:false,style:{stroke:'#8aa9d9'}})).filter(e=>e.source&&e.target) as Edge[];
    return {nodes,edges};
  },[data]);
  return <div className="mind-flow" dir="rtl"><ReactFlow nodes={nodes} edges={edges} fitView fitViewOptions={{padding:.2}} nodesDraggable={true} nodesConnectable={false}><MiniMap pannable zoomable/><Controls/><Background gap={22}/></ReactFlow></div>
}
