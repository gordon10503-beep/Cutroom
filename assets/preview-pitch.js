/* Two overlapping delay windows resample the signal without moving the source playhead. */
class PreviewPitch extends AudioWorkletProcessor {
 static get parameterDescriptors(){return [{name:'semitones',defaultValue:0,automationRate:'k-rate'}]}
 constructor(){super();this.buffers=[];this.cursor=0;this.phase=0}
 process(inputs,outputs,parameters){
  const input=inputs[0],output=outputs[0],window=Math.round(sampleRate*.05);
  const ratio=2**(parameters.semitones[0]/12);
  for(let c=this.buffers.length;c<output.length;c++)this.buffers.push(new Float32Array(window+4));
  for(let i=0;i<output[0].length;i++){
   const a=this.phase,b=(a+.5)%1,weight=.5-.5*Math.cos(a*2*Math.PI);
   for(let c=0;c<output.length;c++){
    const buf=this.buffers[c],n=buf.length,sample=input[c]?.[i]??0;
    buf[this.cursor]=sample;
    if(ratio===1){output[c][i]=sample;continue}
    const x=(this.cursor+n-1-a*window)%n,y=(this.cursor+n-1-b*window)%n;
    const xi=Math.floor(x),yi=Math.floor(y);
    output[c][i]=weight*(buf[xi]+(x-xi)*(buf[(xi+1)%n]-buf[xi]))+(1-weight)*(buf[yi]+(y-yi)*(buf[(yi+1)%n]-buf[yi]));
   }
   this.phase=((a+(1-ratio)/window)%1+1)%1;
   this.cursor=(this.cursor+1)%this.buffers[0].length;
  }
  return true;
 }
}
registerProcessor('preview-pitch',PreviewPitch);
