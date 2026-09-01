import fs from 'node:fs/promises';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {renderMedia,selectComposition} from '@remotion/renderer';

const [propsPath,outputPath]=process.argv.slice(2);
if(!propsPath||!outputPath){
  console.error('Usage: node render.mjs <props.json> <output.mp4>');
  process.exit(2);
}

const inputProps=JSON.parse(await fs.readFile(propsPath,'utf8'));
const serveUrl=await bundle({entryPoint:path.resolve('/video/src/index.jsx')});
const composition=await selectComposition({serveUrl,id:'ScholarVideo',inputProps});
await renderMedia({
  composition,
  serveUrl,
  codec:'h264',
  outputLocation:outputPath,
  inputProps,
  concurrency:1,
  chromiumOptions:{enableMultiProcessOnLinux:false},
  logLevel:'warn'
});
console.log(JSON.stringify({ok:true,frames:composition.durationInFrames,fps:composition.fps,outputPath}));
