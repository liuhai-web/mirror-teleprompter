const $ = (id) => document.getElementById(id);
const state = { stream:null, recorder:null, chunks:[], facing:'user', playing:false, recording:false, offset:0, lastTime:0, startedAt:0, timer:0 };
const els = Object.fromEntries(['editor','camera','scriptInput','charCount','fontSize','fontValue','speed','speedValue','countdown','mirrorText','startButton','cameraPreview','closeButton','flipButton','promptViewport','promptText','countdownOverlay','progressBar','slowerButton','playButton','playIcon','fasterButton','recordButton','speedLabel','recordStatus','timeLabel'].map(id => [id, $(id)]));

function updateCount(){ els.charCount.textContent = `${els.scriptInput.value.replace(/\s/g,'').length} 字`; localStorage.setItem('teleprompterScript', els.scriptInput.value); }
function syncSettings(){ els.fontValue.textContent=els.fontSize.value; els.speedValue.textContent=els.speed.value; els.speedLabel.textContent=`${els.speed.value}×`; els.promptText.style.fontSize=`${els.fontSize.value}px`; }
function formatTime(sec){ return `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`; }
function setPlay(value){ state.playing=value; els.playIcon.textContent=value?'Ⅱ':'▶'; els.playButton.setAttribute('aria-label', value?'暂停':'播放'); state.lastTime=performance.now(); }
function resetPrompt(){ state.offset=0; els.promptText.style.translate='0 0'; els.progressBar.style.width='0%'; setPlay(false); }

async function openCamera(){
  if(!navigator.mediaDevices?.getUserMedia){ alert('当前浏览器不支持相机调用，请使用 Safari 或 Chrome 打开。'); return; }
  els.promptText.textContent=els.scriptInput.value.trim() || '请先输入拍摄脚本';
  els.promptText.classList.toggle('mirrored', els.mirrorText.checked);
  syncSettings(); resetPrompt(); els.editor.hidden=true; els.camera.hidden=false;
  try { state.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:state.facing},width:{ideal:1920},height:{ideal:1080}},audio:true}); els.cameraPreview.srcObject=state.stream; await els.cameraPreview.play(); }
  catch(err){ els.editor.hidden=false; els.camera.hidden=true; alert(`无法打开相机：${err.message}`); }
}
function closeCamera(){ if(state.recording) stopRecording(); state.stream?.getTracks().forEach(t=>t.stop()); state.stream=null; clearInterval(state.timer); els.camera.hidden=true; els.editor.hidden=false; resetPrompt(); }
async function flipCamera(){ state.facing=state.facing==='user'?'environment':'user'; state.stream?.getTracks().forEach(t=>t.stop()); try { state.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:state.facing}},audio:true}); els.cameraPreview.srcObject=state.stream; await els.cameraPreview.play(); els.cameraPreview.style.transform=state.facing==='user'?'scaleX(-1)':'none'; } catch(e){ alert('切换镜头失败'); } }

function animate(now){
  if(state.playing){ const max=Math.max(0,els.promptText.scrollHeight-els.promptViewport.clientHeight*.52); state.offset=Math.min(max,state.offset+(now-state.lastTime)*Number(els.speed.value)*0.012); els.promptText.style.translate=`0 -${state.offset}px`; els.progressBar.style.width=`${max?state.offset/max*100:0}%`; if(state.offset>=max) setPlay(false); }
  state.lastTime=now; requestAnimationFrame(animate);
}
async function countdownAndPlay(){ const seconds=Number(els.countdown.value); if(!seconds){setPlay(!state.playing);return;} if(state.playing){setPlay(false);return;} els.countdownOverlay.hidden=false; for(let i=seconds;i>0;i--){els.countdownOverlay.textContent=i; await new Promise(r=>setTimeout(r,1000));} els.countdownOverlay.hidden=true; setPlay(true); }
function changeSpeed(delta){ els.speed.value=Math.max(1,Math.min(6,Number(els.speed.value)+delta)); syncSettings(); }

function startRecording(){
  if(!state.stream || typeof MediaRecorder==='undefined'){ alert('当前浏览器不支持网页录制，你仍可以使用系统录屏功能。'); return; }
  const preferred=['video/mp4','video/webm;codecs=vp9,opus','video/webm']; const mimeType=preferred.find(x=>MediaRecorder.isTypeSupported(x));
  try { state.chunks=[]; state.recorder=new MediaRecorder(state.stream, mimeType?{mimeType}:undefined); state.recorder.ondataavailable=e=>{if(e.data.size)state.chunks.push(e.data)}; state.recorder.onstop=saveRecording; state.recorder.start(1000); state.recording=true; state.startedAt=Date.now(); els.recordButton.classList.add('recording'); els.recordStatus.textContent='录制中'; state.timer=setInterval(()=>els.timeLabel.textContent=formatTime(Math.floor((Date.now()-state.startedAt)/1000)),1000); }
  catch(e){ alert(`无法开始录制：${e.message}`); }
}
function stopRecording(){ state.recorder?.stop(); state.recording=false; clearInterval(state.timer); els.recordButton.classList.remove('recording'); els.recordStatus.textContent='正在保存'; }
function saveRecording(){ const type=state.recorder?.mimeType||'video/webm'; const ext=type.includes('mp4')?'mp4':'webm'; const url=URL.createObjectURL(new Blob(state.chunks,{type})); const a=document.createElement('a'); a.href=url; a.download=`提词拍摄-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.${ext}`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),3000); els.recordStatus.textContent='已保存'; }

const saved=localStorage.getItem('teleprompterScript'); if(saved) els.scriptInput.value=saved;
els.scriptInput.addEventListener('input',updateCount); els.fontSize.addEventListener('input',syncSettings); els.speed.addEventListener('input',syncSettings);
els.startButton.addEventListener('click',openCamera); els.closeButton.addEventListener('click',closeCamera); els.flipButton.addEventListener('click',flipCamera);
els.playButton.addEventListener('click',countdownAndPlay); els.slowerButton.addEventListener('click',()=>changeSpeed(-1)); els.fasterButton.addEventListener('click',()=>changeSpeed(1));
els.recordButton.addEventListener('click',()=>state.recording?stopRecording():startRecording());
els.promptViewport.addEventListener('click',()=>setPlay(!state.playing));
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.playing)setPlay(false)});
updateCount(); syncSettings(); requestAnimationFrame(animate);
if('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js');
