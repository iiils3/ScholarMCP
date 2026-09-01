import React from 'react';
import {AbsoluteFill,Composition,interpolate,spring,useCurrentFrame,useVideoConfig} from 'remotion';

const palette={bg:'#07111f',panel:'#0d1b2f',text:'#f7fafc',muted:'#9fb3c8',accent:'#57e389',accent2:'#67b7ff'};

function sceneAtTime(scenes,time){
  return scenes.find((s)=>time>=s.startSec&&time<s.endSec)||scenes.at(-1)||{title:'ScholarMCP',narration:'',sourceRef:''};
}

function ScholarVideo({title='ScholarMCP',scenes=[]}){
  const frame=useCurrentFrame();
  const {fps,durationInFrames}=useVideoConfig();
  const time=frame/fps;
  const current=sceneAtTime(scenes,time);
  const local=Math.max(0,time-(current?.startSec||0));
  const duration=Math.max(.1,(current?.endSec||1)-(current?.startSec||0));
  const enter=spring({frame:Math.max(0,Math.round(local*fps)),fps,config:{damping:18,stiffness:110}});
  const fade=interpolate(local,[0,.35,Math.max(.4,duration-.35),duration],[0,1,1,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
  const progress=Math.min(1,frame/Math.max(1,durationInFrames-1));
  return <AbsoluteFill style={{background:palette.bg,color:palette.text,fontFamily:'Noto Sans Arabic, Noto Naskh Arabic, sans-serif',direction:'rtl'}}>
    <AbsoluteFill style={{background:'radial-gradient(circle at 20% 15%, rgba(103,183,255,.18), transparent 38%), radial-gradient(circle at 80% 82%, rgba(87,227,137,.16), transparent 40%)'}}/>
    <div style={{position:'absolute',top:42,right:56,left:56,display:'flex',alignItems:'center',justifyContent:'space-between',direction:'ltr'}}>
      <div style={{fontWeight:800,fontSize:26}}>Scholar<span style={{color:palette.accent}}>MCP</span></div>
      <div style={{fontSize:18,color:palette.muted,direction:'rtl'}}>{title}</div>
    </div>
    <div style={{position:'absolute',inset:'120px 70px 90px',display:'flex',alignItems:'center',justifyContent:'center',opacity:fade,transform:`translateY(${(1-enter)*28}px) scale(${.985+enter*.015})`}}>
      <div style={{width:'100%',maxWidth:1040,background:'rgba(13,27,47,.84)',border:'1px solid rgba(159,179,200,.18)',borderRadius:34,padding:'48px 54px',boxShadow:'0 28px 90px rgba(0,0,0,.28)'}}>
        <div style={{fontSize:20,color:palette.accent,fontWeight:800,marginBottom:16}}>الفكرة الحالية</div>
        <div style={{fontSize:48,lineHeight:1.35,fontWeight:900,marginBottom:24}}>{current?.title||'شرح المادة'}</div>
        <div style={{fontSize:28,lineHeight:1.8,color:'#e4edf7'}}>{current?.onScreen||current?.narration||''}</div>
        {current?.sourceRef&&<div style={{marginTop:30,fontSize:18,color:palette.muted,borderTop:'1px solid rgba(159,179,200,.16)',paddingTop:18}}>المصدر: {current.sourceRef}</div>}
      </div>
    </div>
    <div style={{position:'absolute',right:56,left:56,bottom:42,height:8,background:'rgba(255,255,255,.09)',borderRadius:999,overflow:'hidden'}}>
      <div style={{height:'100%',width:`${progress*100}%`,background:`linear-gradient(90deg, ${palette.accent2}, ${palette.accent})`}}/>
    </div>
  </AbsoluteFill>;
}

export const RemotionRoot=()=> <>
  <Composition
    id="ScholarVideo"
    component={ScholarVideo}
    width={1280}
    height={720}
    fps={30}
    durationInFrames={300}
    defaultProps={{title:'ScholarMCP',scenes:[]}}
    calculateMetadata={({props})=>({durationInFrames:Math.max(30,Math.ceil((Number(props.totalDurationSec)||10)*30))})}
  />
</>;
