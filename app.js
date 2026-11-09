const $ = id => document.getElementById(id);
const paths = {
 scissors:'<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="m8 8 13 13M8 16 21 3"/>',
 grid:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 12h18M12 3v18"/>',
 loop:'<path d="m17 2 4 4-4 4M3 12V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-2v3a3 3 0 0 1-3 3H3"/>',
 audio:'<path d="M3 10v4m4-9v14m5-17v20m5-16v12m4-8v4"/>',
 monitor:'<rect x="2" y="4" width="20" height="14" rx="2"/><path d="M8 21h8m-4-3v3"/>',
 sliders:'<path d="M3 6h6m4 0h8M3 17h10m4 0h4"/><circle cx="11" cy="6" r="2"/><circle cx="15" cy="17" r="2"/>',
 layers:'<path d="m2 8 10-5 10 5-10 5zM2 12l10 5 10-5M2 16l10 5 10-5"/>',
 upload:'<path d="M12 16V3m-5 5 5-5 5 5M3 15v5h18v-5"/>',
 download:'<path d="M12 3v13m-5-5 5 5 5-5M3 16v5h18v-5"/>',
 film:'<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 4v16M2 9h5m-5 6h5"/>',
 play:'<path fill="currentColor" d="m7 4 13 8-13 8z"/>',pause:'<path stroke-width="4" d="M8 4v16m8-16v16"/>',
 volume:'<path d="M3 9h4l5-5v16l-5-5H3zM16 8q4 4 0 8m3-11q7 7 0 14"/>',
 mute:'<path d="M3 9h4l5-5v16l-5-5H3zM16 9l6 6m0-6-6 6"/>',
 full:'<path d="M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6"/>'
};
const icon = name => '<svg aria-hidden="true" viewBox="0 0 24 24">'+paths[name]+'</svg>';
const tools = {
 story:['Story splitter','Split a video into story-ready clips.','scissors','video','Split settings','Clip sequence','Export clips'],
 grid:['Photo grid','Divide a photo into tiles for your profile grid.','grid','image','Grid settings','Posting order','Export tiles'],
 loop:['GIF looper','Loop a GIF for the full length of your song.','loop','GIF','Loop settings','Video output','Export video'],
 audio:['Audio editor','Adjust pitch and tempo independently.','audio','audio','Audio settings','Audio output','Export audio']
};
const states = {
 story:{media:{id:'sample',name:'Alpine session.mp4',duration:134,width:1280,height:720,thumb:'/assets/alpine.jpg'},mode:'fixed',length:60,count:3,frames:[],past:[],future:[],selected:0},
 grid:{rows:3,cols:3,portrait:true,x:.5,y:.5,zoom:1},loop:{key:0,tempo:1},audio:{key:0,tempo:1,mode:'none',length:60,count:3,frames:[],past:[],future:[],selected:0}
};
let task='story', selectingSong=false;
const current=()=>states[task];
function isSplitter(){return task==='story'||isAudioEditor()}
function isAudioEditor(){return task==='audio'}
function timestamp(seconds){
 const ms=Math.round(seconds*1000);
 return fmt(ms/1000)+'.'+String(ms%1000).padStart(3,'0');
}
function lastPosition(m){return isAudioEditor()?Math.ceil(m.duration*1000)-1:m.times.length-1}
function positionTime(m,index){return isAudioEditor()?index/1000:m.times[index]}
function positionAt(m,time){return isAudioEditor()?Math.min(lastPosition(m),Math.max(0,Math.round(time*1000))):frameAt(m.times,time)}
const fmt=n=>Math.floor(n/60).toString().padStart(2,'0')+':'+Math.floor(n%60).toString().padStart(2,'0');
function button(id, name, label){return '<button class="iconbtn" id="'+id+'" aria-label="'+label+'">'+icon(name)+'</button>'}
function field(key,label,value,unit='',text=false){
 return '<label class="fieldlabel" for="'+key+'">'+label+'</label><div class="inputrow"><input id="'+key+'" type="'+(text?'text':'number')+'" step="any"><span class="unit">'+unit+'</span></div>';
}
let preview=null;
function setupPreview(media,state){
 const session={media,state,context:null,ready:null,node:null};
 preview=session;
 async function play(){
  if(!media.paused){media.pause();return}
  try{
   if(!session.context){
    const ctx=new AudioContext();session.context=ctx;
    session.ready=ctx.audioWorklet.addModule('assets/preview-pitch.js').then(()=>{
     if(preview!==session)return;
     const source=ctx.createMediaElementSource(media);
     session.node=new AudioWorkletNode(ctx,'preview-pitch');
     source.connect(session.node).connect(ctx.destination);
    });
   }
   await Promise.all([session.context.resume(),session.ready]);
   if(preview!==session)return;
   updatePreview();await media.play();
  }catch(error){if(preview===session)$('status').textContent='Preview: '+error.message}
 }
 return play;
}
function updatePreview(){
 if(!preview)return;
 const {media,state,node}=preview;
 const speed=Number(state.tempo),pitch=Number(state.key);
 if(Number.isFinite(speed)&&speed>0){
  try{media.preservesPitch=true;media.playbackRate=speed}
  catch{ $('status').textContent='This tempo exceeds the playback range of this device.' }
 }
 if(node&&Number.isFinite(pitch))node.parameters.get('semitones').value=pitch;
}
function render(){
 if(preview){preview.media.pause();preview.context?.close();preview=null}

 const t=tools[task], s=current();
 $('nav').innerHTML=Object.entries(tools).map(([k,v])=>'<button data-task="'+k+'" class="'+(k===task?'active':'')+'">'+icon(v[2])+v[0]+'</button>').join('');
 for(const b of $('nav').children)b.onclick=()=>{task=b.dataset.task;render()};
 $('title').textContent=$('crumb').textContent=t[0];$('subtitle').textContent=t[1];
 if(window.mobileMedia?.share&&!$('savedExports')){
  const b=document.createElement('button');b.className='secondary';b.id='savedExports';b.textContent='Saved exports';
  b.onclick=()=>listExports($('status')).catch(error=>{$('status').textContent=error.message});document.querySelector('.local').before(b);
 }
 $('import').innerHTML=icon('upload')+'Import '+t[3];$('settingsTitle').textContent=t[4];$('outputTitle').textContent=t[5];
 $('export').innerHTML=icon('download')+t[6];$('export').disabled=!!s.busy;
 $('status').textContent=s.message||'';if(s.download)showDownload(s);else if(s.busy&&s.progress)displayProgress(s,s.progress);
 renderMedia();renderSettings();renderResults();
}
function renderMedia(){
 const s=current(), m=s.media;
 $('resolution').textContent=m?.width?m.width+' × '+m.height:tools[task][3].toUpperCase();
 $('stage').innerHTML='';$('player').innerHTML='';$('source').innerHTML='';
 if(task==='loop'&&s.song){
  const audio=document.createElement('audio');audio.src=previewUrl(s.song.id);
  $('player').innerHTML='<div class="controls">'+button('songPlay','play','Play soundtrack preview')+' Soundtrack preview</div>';
  $('player').append(audio);$('songPlay').onclick=setupPreview(audio,s);
  audio.onplay=audio.onpause=()=>{if(audio.isConnected)$('songPlay').innerHTML=icon(audio.paused?'play':'pause')};
 }
 if(!m){$('stage').innerHTML='<div class="empty">'+icon(tools[task][2])+'Import '+(isAudioEditor()?'an audio file':task==='grid'?'a photo':'a GIF')+' to begin</div>';return}
 const url=previewUrl(m.id);
 if(isSplitter()){
  $('stage').innerHTML=isAudioEditor()?'<div class="empty">'+icon('audio')+'Audio preview<audio id="video" preload="auto"></audio></div>':'<video id="video" playsinline preload="auto"></video><span class="over">SOURCE PREVIEW</span>';
  const v=$('video');if(m.thumb)v.poster=m.thumb;v.src=url;
  $('player').innerHTML='<div class="controls">'+button('play','play','Play preview')+'<span class="time" id="clock"></span><input type="range" id="seek" aria-label="Seek media" min="0" step=".01">'+button('volume','volume','Toggle sound')+(isAudioEditor()?'':button('full','full','Fullscreen'))+'</div>';
  const sync=()=>{if(v!==$('video'))return;$('clock').textContent=fmt(v.currentTime)+' / '+fmt(m.duration);if(s.mode==='custom'&&(m.times||isAudioEditor())){syncCursor(positionAt(m,v.currentTime))}else{$('seek').value=v.currentTime}};
  $('seek').max=m.duration;sync();v.ontimeupdate=sync;
  v.onplay=v.onpause=()=>{if(!v.isConnected)return;$('play').innerHTML=icon(v.paused?'play':'pause');$('play').ariaLabel=v.paused?'Play preview':'Pause preview'};
  $('play').onclick=()=>v.paused?v.play().catch(()=>{$('status').textContent='Preview unavailable for this codec. Export is available.'}):v.pause();
  if(isAudioEditor())$('play').onclick=setupPreview(v,s);
  $('seek').oninput=e=>{if(s.mode==='custom'&&(m.times||isAudioEditor()))seekFrame(+e.target.value);else v.currentTime=+e.target.value};$('volume').onclick=()=>{v.muted=!v.muted;$('volume').innerHTML=icon(v.muted?'mute':'volume')};
  $('seek').oncontextmenu=e=>{
   if(s.mode!=='custom'||(!m.times&&!isAudioEditor()))return;
   e.preventDefault();const rect=$('seek').getBoundingClientRect();
   const frame=Math.round(clamp((e.clientX-rect.left-7)/Math.max(1,rect.width-14))* lastPosition(m));
   seekFrame(frame);addCut(frame);
  };
  v.oncontextmenu=e=>{if(s.mode==='custom'&&(m.times||isAudioEditor())){e.preventDefault();v.pause();addCut(positionAt(m,v.currentTime))}};
  if($('full'))$('full').onclick=()=>v.requestFullscreen();
  if(!isAudioEditor()&&!m.thumb)v.onloadeddata=()=>{try{const c=document.createElement('canvas');c.width=130;c.height=74;c.getContext('2d').drawImage(v,0,0,130,74);m.thumb=c.toDataURL();renderResults()}catch{}};
 }else if(task==='grid'){mountCrop(m)}
 else{$('stage').innerHTML='<img alt="Imported image preview"><span class="over">SOURCE PREVIEW</span>'; $('stage').querySelector('img').src=url}
 $('source').innerHTML='<div class="source"><div class="fileicon">'+icon(task==='story'?'film':tools[task][2])+'</div><div><div class="filename"></div><div class="meta"></div></div></div>';
 $('source').querySelector('.filename').textContent=m.name;
 $('source').querySelector('.meta').textContent=[m.duration?fmt(m.duration):'',m.width?m.width+' × '+m.height:'',m.name.split('.').pop().toUpperCase()].filter(Boolean).join('  ·  ');
}
function renderSettings(){
 const s=current(), box=$('settings');let html='', keys=[];
 if(task==='audio'||task==='loop'){
  html+='<div class="field">'+field('key','PITCH SHIFT',s.key,'semitones')+'</div><div class="field">'+field('tempo','TEMPO MULTIPLIER',s.tempo,'×')+'</div>';
  keys.push('key','tempo');
 }
 if(isSplitter()){
 const modes=[['fixed','Fixed duration','Set a length for each clip'],['equal','Equal parts','Divide into a set number of clips'],['custom','Custom cuts','Choose your own cut points']];
 if(isAudioEditor())modes.unshift(['none','No cut','Export the whole recording as one WAV']);
 html+='<div class="fieldlabel splitlabel">'+(isAudioEditor()?'AUDIO SPLITTING':'SPLIT MODE')+'</div>'+modes.map(([k,a,b])=>'<button class="option '+(s.mode===k?'active':'')+'" data-mode="'+k+'" aria-pressed="'+(s.mode===k)+'"><i class="radio"></i><span><strong>'+a+'</strong><small>'+b+'</small></span></button>').join('');
 if(s.mode==='custom'){
  html+='<div id="cutEditor"></div>';
 }else if(s.mode!=='none'){
  const k=s.mode==='fixed'?'length':'count';
  html+='<div class="field">'+field(k,k==='length'?'CLIP LENGTH':'NUMBER OF CLIPS',s[k],k==='length'?'sec':'clips')+'</div>';keys.push(k);
 }
 }else if(task==='grid'){
 html=field('rows','ROWS',s.rows)+'<div class="field">'+field('cols','COLUMNS',s.cols)+'</div><div class="field"><label class="fieldlabel" for="shape">TILE SHAPE</label><div class="inputrow"><select id="shape"><option value="portrait">Portrait · 3:4</option><option value="square">Square · 1:1</option></select></div></div>';keys=['rows','cols'];
 html+='<div class="field"><label class="fieldlabel" for="zoom">CROP ZOOM</label><input id="zoom" type="range" min="1" max="4" step=".01"><button class="textbtn" id="centerCrop">Reset framing</button></div>';

 }
 const audioImport=task==='loop'?'<button class="secondary" id="song">'+icon('audio')+'Import audio</button>':'';
 const imports='<div class="importgroup"><div class="fieldlabel">SOURCE MEDIA</div><div class="importbuttons"><button class="secondary" id="panelImport">'+icon('upload')+'Import '+tools[task][3]+'</button>'+audioImport+'</div></div>';
 box.innerHTML=imports+html;
 $('panelImport').onclick=()=>choose();
 if($('song')){
  $('song').onclick=()=>choose(true);
  if(s.song){
   const name=document.createElement('div');name.className='meta';name.textContent='Soundtrack · '+s.song.name;
   box.querySelector('.importgroup').append(name);
  }
 }
 if($('key')){
  for(const [step,label] of [[-1,'−'],[1,'+']]){
   const btn=document.createElement('button');btn.className='pitchStep';btn.textContent=label;
   btn.ariaLabel=step<0?'Lower pitch one semitone':'Raise pitch one semitone';
   btn.onclick=()=>{$('key').value=(Number($('key').value)||0)+step;$('key').dispatchEvent(new Event('input'))};
   const row=$('key').parentElement;if(step<0)row.prepend(btn);else row.append(btn);
  }
 }
 if($('tempo')){
  const range=document.createElement('input');range.type='range';range.id='tempoSlider';range.ariaLabel='Tempo multiplier';range.min='.25';range.max='4';range.step='.01';range.value=s.tempo;
  $('tempo').closest('.field').append(range);
  let dragging=false, heldStop=null;
  range.onpointerdown=event=>{
   if(event.isPrimary&&event.button===0){
    dragging=true;
    const start=Math.round(range.valueAsNumber*100);
    heldStop=start%5===0?start:null;
    range.setPointerCapture(event.pointerId);
   }
  };
  range.onlostpointercapture=()=>{dragging=false;heldStop=null};
  range.oninput=()=>{
   if(dragging){
    // Work in hundredths so both sides of a detent have identical thresholds.
    const raw=Math.round(range.valueAsNumber*100);
    const nearest=Math.round(raw/5)*5;
    if(heldStop!==null&&Math.abs(raw-heldStop)>2)heldStop=null;
    if(heldStop===null&&Math.abs(raw-nearest)<=1)heldStop=nearest;
    if(heldStop!==null)range.value=heldStop/100;
   }
   $('tempo').value=range.value;
   $('tempo').dispatchEvent(new Event('input'));
  };
 }
 if($('zoom')){$('zoom').value=s.zoom;$('zoom').oninput=e=>{s.zoom=+e.target.value;drawCrop()};$('centerCrop').onclick=()=>{Object.assign(s,{x:.5,y:.5,zoom:1});$('zoom').value=1;drawCrop()}}
 if(isSplitter()&&s.media)setupTimeline();
 for(const b of box.querySelectorAll('[data-mode]'))b.onclick=()=>{s.mode=b.dataset.mode;renderSettings();renderResults()};
 for(const k of keys){$(k).value=s[k];$(k).oninput=e=>{s[k]=e.target.value;if(k==='tempo')$('tempoSlider').value=s[k];if(k==='tempo'||k==='key')updatePreview();renderResults()}}
 if($('shape')){$('shape').value=s.portrait?'portrait':'square';$('shape').onchange=e=>{s.portrait=e.target.value==='portrait';renderResults()}}
}
function points(s){
 const d=s.media.duration;
 if(s.mode==='custom'){if(!isAudioEditor()&&!s.media.times)throw Error('Reading video frames…');return [0,...s.frames.map(i=>positionTime(s.media,i)),d]}
 const count=s.mode==='equal'?Number(s.count):Math.ceil(d/Number(s.length));
 if(!Number.isInteger(count)||count<1||count>1000)throw Error('Choose a positive length and between 1 and 1,000 clips.');
 return [...Array.from({length:count},(_,i)=>i*(s.mode==='equal'?d/count:Number(s.length))),d];
}
function renderResults(){
 const s=current(),box=$('results');$('outputCount').textContent='';box.innerHTML='';
 const splitting=isSplitter()&&s.mode!=='none';
 $('outputTitle').textContent=splitting?'Clip sequence':tools[task][5];
 $('export').innerHTML=icon('download')+(splitting?'Export clips':tools[task][6]);
 if(splitting){
 if(!s.media){box.className='note';box.textContent='Import audio to build the clip sequence.';return}
 try{const p=points(s);$('outputCount').textContent=(p.length-1)+(p.length===2?' clip':' clips');box.className='clips';
 p.slice(1).forEach((end,i)=>{const b=document.createElement('button');b.className='clip'+(i===s.selected?' selected':'');const n=String(i+1).padStart(2,'0');
 b.innerHTML='<div class="strip"><span class="num">'+n+'</span></div><div class="cliptext"><strong>Clip '+n+'</strong><span>'+(s.mode==='custom'&&!isAudioEditor()?'F'+((i?s.frames[i-1]:0)+1)+' – F'+(s.frames[i]??s.media.times.length):timestamp(p[i])+' – '+timestamp(end))+'</span></div>';
 if(s.media.thumb)b.firstChild.style.backgroundImage='url("'+s.media.thumb+'")';
 if(s.mode==='custom')bindSequenceCut(b,p,i);
 b.onclick=e=>{if(s.mode==='custom'&&e.detail)return;s.selected=i;$('video').currentTime=p[i];renderResults()};box.append(b)});
 }catch(e){box.className='note';box.textContent=e.message}
 }else if(task==='grid'){
 box.className='note';box.textContent='Upload the numbered tiles in ascending order, starting with post-001 at the bottom right.';
 const cols=Number(s.cols),rows=Number(s.rows),valid=[cols,rows].every(x=>Number.isInteger(x)&&x>=1&&x<=10);
 $('outputCount').textContent=valid?cols*rows+' tiles':'—';if(valid)drawCrop();
 }else{box.className='note';const d=(task==='loop'?s.song:s.media)?.duration;const speed=Number(s.tempo);
 box.textContent=task==='loop'?'The GIF repeats until the adjusted soundtrack ends.':'Export a WAV file with your pitch and tempo settings.';
 $('outputCount').textContent=(d&&speed>0?fmt(d/speed)+' · ':'')+(task==='loop'?'MP4':'WAV')}
}
function choose(song=false){selectingSong=song;$('file').accept=song||isAudioEditor()?'audio/*':task==='story'?'video/*':task==='grid'?'image/*':'image/gif';$('file').value='';$('file').click()}
function previewUrl(id){return window.mobileMedia?mobileMedia.preview(id):'/media/'+id}
async function request(path,body,headers={},onProgress){
 if(window.mobileMedia)return mobileMedia.request(path,body,headers,onProgress);
 const r=await fetch(path,{method:'POST',headers:{'X-Cutroom':'local',...headers},body});if(r.headers.get('content-type')?.includes('ndjson')){
  const reader=r.body.pipeThrough(new TextDecoderStream()).getReader();let pending='';
  while(true){
   const {value,done}=await reader.read();if(done)break;pending+=value;
   const lines=pending.split('\n');pending=lines.pop();
   for(const line of lines){
    if(!line)continue;const event=JSON.parse(line);
    if(event.error)throw Error(event.error);if(event.result)return event.result;onProgress?.(event);
   }
  }
  throw Error('Export connection closed before the file was saved.');
 }
 const data=await r.json();if(!r.ok)throw Error(data.error||'Request failed.');return data}
$('file').onchange=async()=>{
 const f=$('file').files[0];if(!f)return;const s=current(), song=selectingSong, kind=task;s.message='Importing '+f.name+'…';if(s.download?.blob)URL.revokeObjectURL(s.download.url);s.download=null;$('status').textContent=s.message;
 try{const m=await request('/upload',f,{'X-Tool':kind,'X-Extension':f.name.split('.').pop()});
 if((song||kind==='audio')&&!m.audio)throw Error('Choose a file with an audio track.');
 if(!song&&kind!=='audio'&&!m.width)throw Error('Choose a file with a visual track.');
 if(kind==='story'&&!(m.duration>0))throw Error('Choose a video with a known duration.');
 if(kind==='story'||kind==='audio')Object.assign(s,{frames:[],past:[],future:[]});
 if(kind==='audio')s.mode='none';
 if(kind==='grid')Object.assign(s,{x:.5,y:.5,zoom:1});
 window.mobileMedia?.release(s[song?'song':'media']?.id);m.name=f.name;s[song?'song':'media']=m;s.selected=0;s.message='';}catch(e){s.message=e.message}if(s===current())render();
};
function displayProgress(s,event){
 s.progress=event;
 if(s!==current())return;
 let bar=$('progressBar');
 if(!bar){
  $('status').innerHTML='<span id="progressLabel"></span><progress id="progressBar" aria-label="Export progress" class="exportProgress" max="1"></progress>';
  bar=$('progressBar');
 }
 if(Number.isFinite(event.fraction))bar.value=event.fraction;else bar.removeAttribute('value');
 $('progressLabel').textContent=event.label+(bar.hasAttribute('value')?' · '+Math.round(bar.value*100)+'%':'…');
}
function action(container,label,run){
 const btn=document.createElement('button');btn.className='secondary';btn.textContent=label;
 btn.onclick=async()=>{btn.disabled=true;try{await run()}catch(error){container.append(' '+error.message)}finally{btn.disabled=false}};
 container.append(btn);
}
async function listExports(container){
 container.querySelector('.exportList')?.remove();
 const list=document.createElement('div');list.className='exportList';container.append(list);
 const names=await mobileMedia.exportsList();if(!names.length)list.textContent='No saved exports yet.';
 list.scrollIntoView({block:'nearest'});
 for(const name of names)action(list,name,()=>mobileMedia.share({path:'Cutroom/'+name}));
}
function showDownload(s){
 const file=s.download,container=$('status');container.textContent='Export saved. ';
 if(file.path){
  action(container,'Share file',()=>mobileMedia.share(file));
  action(container,'Open export folder',()=>listExports(container));
 }else{
  const a=document.createElement('a');a.href=file.url;a.download=file.name;a.textContent='Download '+file.name;container.append(a);
  if(file.folderId)action(container,'Open export folder',()=>request('/open-folder',JSON.stringify({id:file.folderId})));
 }
}
$('export').onclick=async()=>{
 const s=current();if(s.busy)return;if(s.download?.blob)URL.revokeObjectURL(s.download.url);s.download=null;
 try{if(!s.media)throw Error('Import your '+tools[task][3]+' first.');if(task==='loop'&&!s.song)throw Error('Import a soundtrack first.');
 const data={task,id:s.media.id,mode:s.mode,length:s.length,count:s.count,rows:s.rows,cols:s.cols,portrait:s.portrait,x:s.x,y:s.y,zoom:s.zoom,key:s.key,tempo:s.tempo,song:s.song?.id};
 if(isSplitter()&&s.mode!=='none'){const boundaries=points(s);if(window.mobileMedia)data.boundaries=boundaries;if(s.mode==='custom'){if(isAudioEditor())data.points=boundaries.slice(1,-1);else data.frames=s.frames}}
 data.sourceDuration=(task==='loop'?s.song:s.media)?.duration;s.busy=true;s.message='Exporting…';$('export').disabled=true;displayProgress(s,{label:'Preparing export'});
 s.download=await request('/export',JSON.stringify(data),{'Content-Type':'application/json','Accept':'application/x-ndjson'},event=>displayProgress(s,event));s.message='';
 if(current()===s){showDownload(s);if(s.download.blob)$('status').querySelector('a').click()}
 }catch(e){s.message=e.message;if(s===current())$('status').textContent=e.message}
 finally{s.busy=false;if(s===current())$('export').disabled=false}
};
$('import').onclick=()=>choose();for(const id of ['monitor','sliders','layers'])$(id).innerHTML=icon(id);render();
function clamp(value){return Math.min(1,Math.max(0,value))}

function frameAt(times, time){
 let low=0,high=times.length;
 while(low+1<high){
  const mid=Math.floor((low+high)/2);
  if(times[mid]<=time)low=mid;else high=mid;
 }
 return low;
}

function syncCursor(index){
 $('seek').value=index;
 if($('playTime'))$('playTime').textContent=timestamp(positionTime(current().media,index));
 if($('frameNumber')&&document.activeElement!==$('frameNumber'))$('frameNumber').value=isAudioEditor()?index/1000:index+1;
}

function seekFrame(index){
 const {media}=current();
 if(!Number.isInteger(index)||index<0||index>lastPosition(media))return;
 const start=positionTime(media,index),end=isAudioEditor()?start:media.times[index+1]??media.duration;
 const video=$('video');video.pause();video.currentTime=start+Math.max(0,end-start)/2;
 syncCursor(index);
}

async function setupTimeline(){
 const s=current(),m=s.media,seek=$('seek');
 let marks=$('cutMarks');
 if(!marks){
  const wrap=document.createElement('div');wrap.className='seekwrap';
  seek.before(wrap);wrap.append(seek);marks=document.createElement('div');marks.id='cutMarks';wrap.append(marks);
 }
 marks.replaceChildren();
 if(s.mode!=='custom'){seek.max=m.duration;seek.step='.01';seek.value=$('video').currentTime;seek.disabled=false;return}
 if(!m.times&&!isAudioEditor()){
  $('cutEditor').textContent='Reading video frames…';seek.disabled=true;
  try{
   m.loading??=request('/frames',JSON.stringify({id:m.id})).then(result=>m.times=result.times);
   await m.loading;
  }catch(error){
   m.loading=null;
   if(current()===s&&s.media===m&&$('cutEditor'))$('cutEditor').textContent=error.message;
   return;
  }
  if(current()!==s||s.media!==m||!$('cutEditor'))return;
 }
 seek.disabled=false;seek.max=lastPosition(m);seek.step=1;
 $('cutEditor').innerHTML='<div class="cuthead"><label for="frameNumber" class="fieldlabel">PLAYHEAD FRAME</label><div><button class="textbtn history" id="undo" aria-label="Undo cut edit" title="Undo (Ctrl+Z)">↶</button><button class="textbtn history" id="redo" aria-label="Redo cut edit" title="Redo (Ctrl+Y)">↷</button></div></div><div class="cutrow"><div class="inputrow"><input id="frameNumber" type="number" min="1" step="1" aria-label="Playhead frame"><span class="unit"></span></div><button class="secondary" id="addCut">+ Add cut</button></div><div class="playtime">Cut time <output id="playTime"></output></div><p class="hint">Drag on a clip below and release to add a cut. Right-click also cuts at the pointer.</p><div id="cutList"></div>';
 const number=$('frameNumber'),audio=isAudioEditor();
 if(audio){
  number.min=0;number.step='.001';number.max=lastPosition(m)/1000;number.ariaLabel='Playhead seconds';
  document.querySelector('label[for=frameNumber]').textContent='PLAYHEAD TIME';number.nextElementSibling.textContent='sec';
 }else{
  const row=document.createElement('div');row.className='playtime';
  const output=document.createElement('output');row.append('Frame rate',output);
  if(m.times.length>1){
   const span=m.times.at(-1)-m.times[0],interval=span/(m.times.length-1);
   const variable=m.times.some((t,i)=>i>0&&Math.abs(t-m.times[i-1]-interval)>Math.max(.0011,interval*.015));
   output.textContent=Number((1/interval).toFixed(3))+' fps'+(variable?' (variable, average)':'');
  }else{output.textContent=m.fps?Number(m.fps.toFixed(3))+' fps (reported)':'Single frame'}
  $('playTime').parentElement.after(row);
  number.max=m.times.length;number.nextElementSibling.textContent='/ '+m.times.length}
 number.required=true;
 const enteredPosition=()=>audio?Math.round(+number.value*1000):+number.value-1;
 number.oninput=()=>{if(number.validity.valid)seekFrame(enteredPosition())};
 number.onkeydown=e=>{if(e.key==='Enter'&&number.reportValidity())addCut(enteredPosition())};
 $('addCut').onclick=()=>{if(number.reportValidity())addCut(enteredPosition())};
 $('undo').onclick=()=>cutHistory(false);$('redo').onclick=()=>cutHistory(true);
 syncCursor(positionAt(m,$('video').currentTime));paintCuts();renderResults();
}

function paintCuts(){
 const s=current();
 $('undo').disabled=!s.past.length;$('redo').disabled=!s.future.length;
 const list=$('cutList'),marks=$('cutMarks');list.replaceChildren();marks.replaceChildren();
 for(const frame of s.frames){
  const chip=document.createElement('div');chip.className='cutchip';
  const jump=document.createElement('button');jump.textContent=(isAudioEditor()?'':'F'+(frame+1)+' · ')+timestamp(positionTime(s.media,frame));jump.title='Seek to cut';jump.onclick=()=>seekFrame(frame);
  const remove=document.createElement('button');remove.textContent='×';remove.ariaLabel='Remove cut at '+jump.textContent;remove.onclick=()=>editCuts(s.frames.filter(f=>f!==frame));
  chip.append(jump,remove);list.append(chip);
  const tick=document.createElement('i');tick.style.left=100*frame/lastPosition(s.media)+'%';marks.append(tick);
 }
}
function editCuts(next){
 const s=current();s.past.push(s.frames);s.future=[];s.frames=next;
 $('status').textContent='';paintCuts();renderResults();
}
function addCut(frame){
 const s=current();
 if(frame<=0||frame>lastPosition(s.media)||!Number.isInteger(frame)){$('status').textContent=isAudioEditor()?'Choose a time inside the recording.':'Choose frame 2 or later to start a new clip.';return}
 if(s.frames.includes(frame)){$('status').textContent='A cut already starts at this frame.';return}
 editCuts([...s.frames,frame].sort((a,b)=>a-b));
}
function cutHistory(redo){
 const s=current(),from=redo?s.future:s.past,to=redo?s.past:s.future;
 if(!from.length)return;
 to.push(s.frames);s.frames=from.pop();paintCuts();renderResults();$('status').textContent='';
}
document.addEventListener('keydown',e=>{
 if(!$('undo')||!(e.ctrlKey||e.metaKey)||e.altKey)return;
 const key=e.key.toLowerCase();
 if(key==='z'||key==='y'){e.preventDefault();cutHistory(key==='y'||e.shiftKey)}
});

function mountCrop(media){
 const stage=$('stage');
 stage.innerHTML='<div id="cropWindow" tabindex="0" aria-label="Photo crop. Drag or use arrow keys to move the photo."><img draggable="false" alt="Selected photo crop"><div class="guide"></div></div>';
 const crop=$('cropWindow'),img=crop.querySelector('img'),s=states.grid;
 img.onload=drawCrop;img.src=previewUrl(media.id);
 let drag;
 crop.onpointerdown=e=>{if(e.button!==0)return;crop.setPointerCapture(e.pointerId);drag={x:s.x,y:s.y,left:e.clientX,top:e.clientY}};
 crop.onpointermove=e=>{
  if(!drag)return;
  const dx=img.getBoundingClientRect().width-crop.clientWidth,dy=img.getBoundingClientRect().height-crop.clientHeight;
  if(dx>0.1)s.x=clamp(drag.x-(e.clientX-drag.left)/dx);
  if(dy>0.1)s.y=clamp(drag.y-(e.clientY-drag.top)/dy);
  positionPhoto();
 };
 crop.onlostpointercapture=()=>drag=null;
 crop.onkeydown=e=>{
  const delta={ArrowLeft:[.025,0],ArrowRight:[-.025,0],ArrowUp:[0,.025],ArrowDown:[0,-.025]}[e.key];
  if(delta){e.preventDefault();s.x=clamp(s.x+delta[0]);s.y=clamp(s.y+delta[1]);positionPhoto()}
 };
 $('player').innerHTML='<p class="hint crophint">Drag the photo to frame your grid.</p>';
}
function positionPhoto(){
 const crop=$('cropWindow');if(!crop)return;
 const s=states.grid,img=crop.querySelector('img');
 img.style.left=s.x*100+'%';img.style.top=s.y*100+'%';img.style.transform='translate('+(-100*s.x)+'%, '+(-100*s.y)+'%)';
}
function drawCrop(){
 const crop=$('cropWindow');if(!crop)return;
 const s=states.grid,ratio=s.cols/s.rows*(s.portrait?.75:1),img=crop.querySelector('img');
 if(!(ratio>0)||!img.naturalWidth)return;
 crop.style.aspectRatio=ratio;crop.style.width=Math.min(100,ratio*100*9/16)+'%';
 const imageRatio=img.naturalWidth/img.naturalHeight;
 img.style.width=100*Math.max(1,imageRatio/ratio)*s.zoom+'%';img.style.height=100*Math.max(1,ratio/imageRatio)*s.zoom+'%';
 positionPhoto();
 const guide=crop.querySelector('.guide');guide.style.gridTemplateColumns='repeat('+s.cols+',1fr)';guide.style.gridTemplateRows='repeat('+s.rows+',1fr)';
 if(guide.children.length!==s.cols*s.rows)guide.innerHTML='<i></i>'.repeat(s.cols*s.rows);
}
function bindSequenceCut(card,boundaries,index){
 const media=current().media;
 card.classList.add('editable');
 card.title='Drag to preview a cut, then release to split';
 const marker=document.createElement('span');
 marker.className='sequenceMarker';card.append(marker);
 function preview(event){
  const rect=card.getBoundingClientRect();
  const ratio=clamp((event.clientX-rect.left)/rect.width);
  const start=boundaries[index],length=boundaries[index+1]-start;
  const position=positionAt(media,start+ratio*length);
  seekFrame(position);
  marker.style.left=100*clamp((positionTime(media,position)-start)/length)+'%';
  marker.dataset.time=timestamp(positionTime(media,position));
  marker.classList.toggle('nearEnd',ratio>.7);
  return position;
 }
 card.onpointerdown=event=>{
  if(event.button!==0)return;
  card.setPointerCapture(event.pointerId);
  card.classList.add('scrubbing');preview(event);
 };
 card.onpointermove=event=>{if(card.hasPointerCapture(event.pointerId))preview(event)};
 card.onpointerup=event=>{
  if(!card.hasPointerCapture(event.pointerId))return;
  card.releasePointerCapture(event.pointerId);card.classList.remove('scrubbing');
  addCut(preview(event));
 };
 card.onlostpointercapture=()=>card.classList.remove('scrubbing');
 card.oncontextmenu=event=>{event.preventDefault();addCut(preview(event))};
}
