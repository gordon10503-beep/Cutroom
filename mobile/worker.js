importScripts('ffmpeg-core.js','fflate.js');
function audioFilter(key,speed,rate){
 const pitch=2**(Number(key)/12),tempo=Number(speed);
 if(!(pitch>0&&tempo>0&&Number.isFinite(pitch)&&Number.isFinite(tempo)))throw Error('Choose a finite pitch and positive tempo.');
 const filters=[];
 if(pitch!==1)filters.push('asetrate='+Math.round(rate*pitch),'aresample='+rate);
 let factor=tempo/pitch;
 while(factor<.5){filters.push('atempo=0.5');factor*=2}
 while(factor>2){filters.push('atempo=2');factor/=2}
 if(factor!==1)filters.push('atempo='+factor);
 return filters.join(',')||'anull';
}
self.onmessage=async({data})=>{
 try{const value=await processMedia(data);self.postMessage({value})}
 catch(error){self.postMessage({error:error.message||String(error)})}
};
async function processMedia({file,song,operation,options}){
 const core=await createFFmpegCore(),fs=core.FS;
 let lastError='';
 core.setLogger(({message})=>{lastError=message});
 function command(tool,args){
  core.reset();lastError='';
  const code=core[tool](...args.map(String));
  if(code!==0&&!(tool==='ffprobe'&&code===-1))throw Error(lastError||'Could not process this media.');
 }
 function mount(blob,dir){
  fs.mkdir(dir);fs.mount(fs.filesystems.WORKERFS,{blobs:[{name:'source',data:blob}]},dir);
  return dir+'/source';
 }
 const input=mount(file,'/input');
 function probe(...args){
  command('ffprobe',['-v','error',...args,'-of','json','-o','meta.json',input]);
  return JSON.parse(fs.readFile('meta.json',{encoding:'utf8'}));
 }
 const meta=probe('-show_streams','-show_format'),v=meta.streams.find(s=>s.codec_type==='video'&&!s.disposition?.attached_pic),a=meta.streams.find(s=>s.codec_type==='audio');
 const duration=Number(meta.format.duration)||0;
 if(operation==='probe')return {duration,width:v?.width||0,height:v?.height||0,audio:!!a};
 if(operation==='frames'){
  const {frames}=probe('-select_streams','V:0','-show_frames','-show_entries','frame=best_effort_timestamp_time');
  return {times:frames.map(f=>Number(f.best_effort_timestamp_time)-(Number(meta.format.start_time)||0))};
 }
 const d=options, encode=(...args)=>command('exec',['-v','error',...args]);
 const video=['-vf','pad=ceil(iw/2)*2:ceil(ih/2)*2','-c:v','libx264','-preset','ultrafast','-threads',1,'-pix_fmt','yuv420p','-c:a','aac'];
 function blob(name,type){return new Blob([fs.readFile(name)],{type})}
 let track=input;
 if(d.task==='loop'||d.task==='audio'){
  const audio=d.task==='loop'?mount(song,'/song'):input;
  let rate=Number(a?.sample_rate)||48000;
  // Normalize to a known rate before applying a pitch ratio.
  const filter='aresample='+rate+','+audioFilter(d.key,d.tempo,rate);
  track='edited.wav';encode('-i',audio,'-map','0:a:0','-af',filter,'-c:a','pcm_s24le',track);
  if(d.task==='loop'){
   command('ffprobe',['-v','error','-show_entries','format=duration','-of','json','-o','length.json',track]);
   const length=JSON.parse(fs.readFile('length.json',{encoding:'utf8'})).format.duration;
   encode('-stream_loop',-1,'-ignore_loop',1,'-i',input,'-i',track,'-map','0:v:0','-map','1:a:0','-t',length,'-vf','fps=30,pad=ceil(iw/2)*2:ceil(ih/2)*2',...video.slice(2),'cover.mp4');
   return blob('cover.mp4','video/mp4');
  }
  if(d.mode==='none')return blob(track,'audio/wav');
 }
 const chunks=[],bounds=d.boundaries;
 const zip=new fflate.Zip((error,bytes)=>{if(error)throw error;chunks.push(bytes)});
 for(let i=0;i<bounds.length-1;i++){
  const start=bounds[i],end=bounds[i+1],name='clip-'+String(i+1).padStart(3,'0');
  const output=name+(d.task==='story'?'.mp4':'.wav');
  if(d.task==='story'){
   if(d.mode==='custom'){
    const first=i?d.frames[i-1]:0, stop=d.frames[i];
    const trim='trim=start_frame='+first+(stop===undefined?'':':end_frame='+stop)+',setpts=PTS-STARTPTS,pad=ceil(iw/2)*2:ceil(ih/2)*2';
    encode('-i',input,'-map','0:V:0','-map','0:a:0?','-vf',trim,'-af','atrim=start='+start+':end='+end+',asetpts=PTS-STARTPTS','-vsync','vfr',...video.slice(2),output);
   }else encode('-ss',start,'-i',input,'-t',end-start,'-map','0:V:0','-map','0:a:0?',...video,output);
  }else{
   const rate=Number(a.sample_rate),first=Math.round(start*rate/d.tempo),stop=Math.round(end*rate/d.tempo);
   const trim=i===bounds.length-2?[]:['-af','atrim=end_sample='+(stop-first)];
   encode('-ss',first/rate,'-i',track,...trim,'-c:a','pcm_s24le',output);
  }
  const entry=new fflate.ZipPassThrough(output);zip.add(entry);
  entry.push(fs.readFile(output),true);fs.unlink(output);
 }
 zip.end();return new Blob(chunks,{type:'application/zip'});
}

