import {Zip,ZipPassThrough} from 'fflate';
import {Capacitor} from '@capacitor/core';
import {Filesystem, Directory} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';

const sources=new Map();
function job(operation,payload,onProgress){
 return new Promise((resolve,reject)=>{
  const worker=new Worker('worker.js');
  worker.onmessage=({data})=>{if(data.progress){onProgress?.(data.progress);return}worker.terminate();if(data.error)reject(Error(data.error));else resolve(data.value)};
  worker.onerror=e=>{worker.terminate();reject(Error(e.message||'The media worker stopped.'))};
  worker.postMessage({operation,...payload});
 });
}
function preview(id){return id==='sample'?'assets/alpine-session.mp4':sources.get(id).url}
async function grid(file,options,onProgress){
 const img=await createImageBitmap(file);
 try{
  const {rows,cols,portrait,x,y,zoom}=options;
  if(![rows,cols].every(n=>Number.isInteger(+n)&&n>=1&&n<=10))throw Error('Choose 1–10 rows and columns.');
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=portrait?1440:1080;
  const ctx=canvas.getContext('2d',{alpha:false});
  const scale=Math.min(img.width/(cols*canvas.width),img.height/(rows*canvas.height))/zoom;
  const w=canvas.width*scale,h=canvas.height*scale;
  const left=(img.width-cols*w)*x,top=(img.height-rows*h)*y;
  const chunks=[];const zip=new Zip((error,bytes)=>{if(error)throw error;chunks.push(bytes)});
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
   onProgress?.({label:"Tile "+(r*cols+c+1)+" of "+rows*cols,fraction:(r*cols+c)/(rows*cols)});
   ctx.drawImage(img,left+w*c,top+h*r,w,h,0,0,canvas.width,canvas.height);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.95));
   const entry=new ZipPassThrough('post-'+String(rows*cols-r*cols-c).padStart(3,'0')+'.jpg');
   zip.add(entry);entry.push(new Uint8Array(await blob.arrayBuffer()),true);
  }
  zip.end();return new Blob(chunks,{type:'application/zip'});
 } finally{img.close()}
}
async function request(route,body,headers,onProgress){
 if(route==='/upload'){
  const id=crypto.randomUUID(),file=body;
  let meta;
  if(headers['X-Tool']==='grid'){
   const img=await createImageBitmap(file);meta={width:img.width,height:img.height};img.close();
  }else meta=await job('probe',{file});
  sources.set(id,{file,url:URL.createObjectURL(file)});return {...meta,id};
 }
 const options=JSON.parse(body);
 const file=sources.get(options.id)?.file??new File([await (await fetch('assets/alpine-session.mp4')).blob()],'sample.mp4');
 if(route==='/frames')return job('frames',{file});
 const {task}=options;
 const blob=task==='grid'?await grid(file,options,onProgress):await job('export',{file,song:sources.get(options.song)?.file,options},onProgress);
 const name=task==='grid'?'profile-grid.zip':task==='story'?'story-clips.zip':task==='loop'?'cover-loop.mp4':options.mode==='none'?'audio-mix.wav':'audio-clips.zip';
 if(!Capacitor.isNativePlatform())return {url:URL.createObjectURL(blob),name,blob};
 const stamp=new Date().toISOString().replace(/[:.]/g,'-');
 const finalName=stamp+'-'+name,path='Cutroom/'+finalName,temp=path+'.partial';
 try{
  for(let offset=0;offset<blob.size;offset+=786432){
   onProgress?.({label:'Saving export',fraction:offset/blob.size});
   const chunk=blob.slice(offset,offset+786432);
   const encoded=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(reader.error);reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(chunk)});
   const args={path:temp,directory,data:encoded,recursive:true};
   if(offset===0)await Filesystem.writeFile(args);else await Filesystem.appendFile(args);
  }
  await Filesystem.rename({from:temp,to:path,directory});
 }catch(error){
  await Filesystem.deleteFile({path:temp,directory}).catch(()=>{});
  throw Error('Could not save export: '+error.message);
 }
 return {name:finalName,path};
}
const directory=Capacitor.getPlatform()==='android'?Directory.External:Directory.Documents;
async function share({path}){
 const {uri}=await Filesystem.getUri({path,directory});
 try{await Share.share({files:[uri]})}catch(e){if(!/cancel/i.test(e.message))throw e}
}
async function exportsList(){
 await Filesystem.mkdir({path:'Cutroom',directory,recursive:true}).catch(()=>{});
 const {files}=await Filesystem.readdir({path:'Cutroom',directory});
 return files.filter(f=>f.type==='file'&&!f.name.endsWith('.partial')).map(f=>f.name).sort().reverse();
}
window.mobileMedia={request,preview,exportsList,share:Capacitor.isNativePlatform()?share:null,release(id){
 const source=sources.get(id);if(source){URL.revokeObjectURL(source.url);sources.delete(id)}
}};

