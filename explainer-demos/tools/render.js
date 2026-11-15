// node render.js <dir> [workers=3] [fps=30]  → <dir>/<dir>.mp4 (needs <dir>/index.html, audio.wav)
const { chromium } = require('playwright'); const fs=require('fs'), path=require('path'), {execSync,spawn}=require('child_process');
(async()=>{
 const dir=path.resolve(process.argv[2]), W=+(process.argv[3]||3), FPS=+(process.argv[4]||30);
 const url='file://'+dir+'/index.html?render=1';
 const fr=path.join(dir,'_frames'); fs.rmSync(fr,{recursive:true,force:true}); fs.mkdirSync(fr);
 const b0=await chromium.launch(); const p0=await b0.newPage({viewport:{width:1080,height:1920}}); await p0.goto(url); await p0.waitForFunction('window.__ready===true');
 const DUR=await p0.evaluate('window.SCRIPT.duration'); await b0.close();
 const total=Math.round(DUR*FPS); const per=Math.ceil(total/W);
 await Promise.all([...Array(W)].map(async(_,w)=>{
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1080,height:1920}}); await p.goto(url); await p.waitForFunction('window.__ready===true');
  for(let i=w*per;i<Math.min(total,(w+1)*per);i++){ await p.evaluate(t=>window.seek(t),i/FPS);
   await p.screenshot({path:`${fr}/f${String(i).padStart(5,'0')}.jpg`,type:'jpeg',quality:93}); }
  await b.close(); }));
 const out=path.join(dir,path.basename(dir)+'.mp4');
 execSync(`ffmpeg -y -loglevel error -framerate ${FPS} -i ${fr}/f%05d.jpg -i ${dir}/audio.wav -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart ${out}`);
 fs.rmSync(fr,{recursive:true,force:true}); console.log('rendered',out);
})();
