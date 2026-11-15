// Shared deterministic engine. A video defines window.SCRIPT (script.js), window.TIMING (timing.js) and calls
// Engine.start(update) where update(t) is a PURE function of time t (seconds) that mutates the DOM/SVG/canvas.
(function(){
 const E = window.Engine = {};
 E.clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
 E.ease={ lin:x=>x, out:x=>1-Math.pow(1-x,3), in:x=>x*x*x, io:x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2,
   back:x=>{const c=1.70158;return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2)}, expo:x=>x==1?1:1-Math.pow(2,-10*x),
   elastic:x=>x==0?0:x==1?1:Math.pow(2,-10*x)*Math.sin((x*10-.75)*(2*Math.PI)/3)+1, bounce:x=>{const n=7.5625,d=2.75;
    if(x<1/d)return n*x*x; if(x<2/d)return n*(x-=1.5/d)*x+.75; if(x<2.5/d)return n*(x-=2.25/d)*x+.9375; return n*(x-=2.625/d)*x+.984375}};
 // progress of t over [a,b] with easing → 0..1
 E.p=(t,a,b,f='out')=>E.ease[f](E.clamp((t-a)/(b-a)));
 E.lerp=(a,b,k)=>a+(b-a)*k;
 E.rnd=(s)=>{s=Math.sin(s*127.1+311.7)*43758.5453;return s-Math.floor(s)}; // deterministic noise
 E.fmt=n=>Math.round(n).toLocaleString('pl-PL');
 // captions from TIMING: word-by-word highlight, ≤2 lines
 E.captions=(el,t)=>{ const T=window.TIMING||[]; const L=T.find(l=>t>=l.t-.05&&t<=l.end+.35);
  if(!L){el.style.opacity=0;return;} const words=L.text.split(' '); const tot=words.join('').length||1; let acc=0, cur=0;
  const dur=L.end-L.t; const idx=words.map(w=>{const s=acc/tot;acc+=w.length;return s});
  const k=(t-L.t)/dur; cur=Math.max(0,idx.filter(s=>s<=k).length-1);
  const per=6; const g=Math.floor(cur/per); const chunk=words.slice(g*per,g*per+per);
  el.style.opacity=1; el.innerHTML=chunk.map((w,i)=>`<span class="${g*per+i===cur?'on':(g*per+i<cur?'past':'')}">${w}</span>`).join(' '); };
 E.start=(update)=>{ const q=new URLSearchParams(location.search); const D=window.SCRIPT.duration;
  window.seek=(t)=>{update(Math.min(D,Math.max(0,t)));};
  if(q.has('t')) window.seek(+q.get('t'));
  else if(!q.has('render')){ const t0=performance.now(); const f=n=>{window.seek(((n-t0)/1000)%D);requestAnimationFrame(f)}; requestAnimationFrame(f);}
  else window.seek(0);
  const fit=()=>{ if(q.has('render'))return; const s=Math.min(innerWidth/1080,innerHeight/1920); document.getElementById('stage').style.transform=`scale(${s})`; };
  addEventListener('resize',fit); fit();
  (document.fonts?document.fonts.ready:Promise.resolve()).then(()=>{window.__ready=true;});
 };
})();
