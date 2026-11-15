(function(){
const E=Engine,p=E.p,cl=E.clamp,rnd=E.rnd;
const U=window.USERS[window.SCRIPT.user], ACC=U.accent;
if(location.search.includes('render'))document.body.classList.add('render');
document.documentElement.style.setProperty('--accent',ACC);
const ST=[0,6,13,21,31,41,48,53.4], WIPE=.85, FREEZE=57.7, N=ST.length;
const $=s=>document.querySelector(s);
function hex(h){return [1,3,5].map(i=>parseInt(h.slice(i,i+2),16))}
function mix(a,b,k){const A=hex(a),B=hex(b);return '#'+A.map((v,i)=>Math.round(v+(B[i]-v)*k).toString(16).padStart(2,'0')).join('')}
const ACCD=mix(ACC,'#13342a',.62), ACCM=mix(ACC,'#13342a',.35);
// ---------- art ----------
const elf=(w,hat=ACC)=>`<svg viewBox="0 0 200 270" width="${w}" height="${w*1.35}">
 <ellipse cx="100" cy="258" rx="58" ry="9" fill="#000" opacity=".25"/>
 <path d="M62 150 Q100 135 138 150 L150 238 Q100 256 50 238Z" fill="#6bbf59"/><path d="M62 150 Q100 135 138 150 L142 172 Q100 160 58 172Z" fill="#4fa046"/>
 <rect x="82" y="208" width="36" height="9" rx="4" fill="#7a4e2d"/><circle cx="100" cy="212" r="6" fill="#ffc94d"/>
 <path d="M52 108 L18 90 L50 130Z" fill="#f3c9a0"/><path d="M148 108 L182 90 L150 130Z" fill="#f3c9a0"/>
 <circle cx="100" cy="112" r="50" fill="#f6d2ae"/><circle cx="76" cy="126" r="9" fill="#ff9a8a" opacity=".6"/><circle cx="124" cy="126" r="9" fill="#ff9a8a" opacity=".6"/>
 <circle cx="82" cy="110" r="6.5" fill="#13342a"/><circle cx="118" cy="110" r="6.5" fill="#13342a"/><circle cx="84" cy="107" r="2.2" fill="#fff"/><circle cx="120" cy="107" r="2.2" fill="#fff"/>
 <path d="M84 132 Q100 146 116 132" stroke="#13342a" stroke-width="5" fill="none" stroke-linecap="round"/>
 <path d="M44 88 Q100 -10 160 70 Q176 86 150 82 Q100 66 44 88Z" fill="#e8453c"/><path d="M40 88 Q100 66 156 84 Q174 90 160 100 Q100 78 44 104Z" fill="#fff4dc"/>
 <path d="M150 52 Q192 20 186 -6 Q168 20 140 44Z" fill="${hat}"/></svg>`;
const acorn=(s,c='#7a4e2d')=>`<svg viewBox="0 0 60 70" width="${s}" height="${s*1.16}"><path d="M10 30 Q30 62 50 30Z" fill="#c8892f"/><path d="M6 30 Q30 4 54 30 Q30 38 6 30Z" fill="${c}"/><rect x="28" y="2" width="5" height="9" rx="2" fill="${c}"/><path d="M14 22 Q30 12 46 22" stroke="#fff4dc" stroke-width="2" opacity=".35" fill="none"/></svg>`;
const patch=(s)=>`<svg viewBox="0 0 60 60" width="${s}" height="${s}"><rect x="5" y="5" width="50" height="50" rx="10" fill="#6bbf59"/><path d="M5 5 L55 55 M55 5 L5 55" stroke="#4fa046" stroke-width="4"/><g stroke="#fff4dc" stroke-width="2.5" stroke-dasharray="4 4" fill="none"><rect x="9" y="9" width="42" height="42" rx="7"/></g></svg>`;
const lamp=(s)=>`<svg viewBox="0 0 60 70" width="${s}" height="${s*1.16}"><rect x="22" y="2" width="16" height="8" rx="3" fill="#7a4e2d"/><path d="M14 20 Q30 6 46 20 L50 54 Q30 64 10 54Z" fill="#ffc94d"/><circle cx="30" cy="38" r="9" fill="#fff4dc"/><circle cx="30" cy="38" r="18" fill="#fff4dc" opacity=".25"/></svg>`;
const ICON={acorn,patch,lamp}[U.hero.icon];
const shroom=(s)=>`<svg viewBox="0 0 200 200" width="${s}" height="${s}"><rect x="70" y="100" width="60" height="80" rx="24" fill="#fff4dc"/><path d="M12 112 Q18 20 100 18 Q182 20 188 112 Q100 132 12 112Z" fill="#e8453c"/><circle cx="58" cy="76" r="15" fill="#fff4dc"/><circle cx="112" cy="52" r="12" fill="#fff4dc"/><circle cx="150" cy="86" r="14" fill="#fff4dc"/><circle cx="96" cy="96" r="9" fill="#fff4dc"/></svg>`;
const pines=(fill,o)=>{let s='';for(let i=0;i<9;i++){const x=i*140-30,h=180+rnd(i+3)*140;s+=`<path d="M${x} 400 L${x+70} ${400-h} L${x+140} 400Z" fill="${fill}" opacity="${o}"/>`}return `<svg viewBox="0 0 1080 400" width="1080" height="400" preserveAspectRatio="none">${s}</svg>`};
const moon=(r)=>`<svg viewBox="-150 -150 300 300" width="${r*3}" height="${r*3}"><circle r="140" fill="#fff4dc" opacity=".08"/><circle r="110" fill="#fff4dc" opacity=".1"/><circle r="80" fill="#fff4dc"/><circle cx="26" cy="-14" r="70" fill="#1b2a4a"/><circle cx="-30" cy="20" r="9" fill="#e6d9b8" opacity=".0"/></svg>`;
// ---------- DOM ----------
const stage=$('#stage');
const SCN=['intro','nights','month','friends','hero','pct','persona','share'];
const bgs=[
 `radial-gradient(900px 900px at 80% 20%,${ACC}55,transparent 60%),linear-gradient(170deg,#0e1a2b,#13342a)`,
 `linear-gradient(180deg,#0b1428,#1b2a4a 70%,#27375f)`,
 `radial-gradient(800px 800px at 20% 90%,${ACC}33,transparent 60%),linear-gradient(180deg,#1f5a43,#13342a)`,
 `radial-gradient(900px 700px at 50% 15%,${ACC}44,transparent 65%),linear-gradient(180deg,#13342a,#0e1a2b)`,
 `linear-gradient(180deg,${ACCD},#0e1a2b)`,
 `linear-gradient(180deg,#0e1a2b,#0f4a45)`,
 `linear-gradient(160deg,${ACCM},#13342a)`,
 `radial-gradient(1000px 1000px at 50% 30%,${ACC}66,transparent 65%),linear-gradient(180deg,#1f5a43,#0e1a2b)`];
let html='';
SCN.forEach((n,i)=>html+=`<div class="scene" id="s${i}" style="z-index:${i+1}"><div class="bg" style="background:${bgs[i]}"></div><div class="deco" id="d${i}"></div></div>`);
html+=`<div id="ff" style="position:absolute;inset:0;z-index:30;pointer-events:none"></div><div id="cap" style="z-index:50"></div>`;
stage.innerHTML=html;
const S=i=>$('#s'+i);
const add=(i,h)=>S(i).insertAdjacentHTML('beforeend',h);
// fireflies
let ff='';for(let i=0;i<34;i++)ff+=`<div class="f" style="position:absolute;width:${6+rnd(i)*9}px;height:${6+rnd(i)*9}px;border-radius:50%;background:${i%3?'#ffe9a0':ACC};box-shadow:0 0 18px 6px ${i%3?'#ffe9a066':ACC+'66'}"></div>`;
$('#ff').innerHTML=ff;const FF=[...document.querySelectorAll('.f')];
// pine silhouettes on scenes
[0,3,5,6,7].forEach(i=>add(i,`<div style="position:absolute;left:0;bottom:0;width:1080px;height:400px;opacity:.55" data-pine="1">${pines('#0b2a21',.9)}</div><div style="position:absolute;left:-60px;bottom:-60px;width:1200px;height:400px;opacity:.9">${pines('#071c16',1)}</div>`));
// ---- scene 0 intro
const nm=[...U.name].map((c,i)=>`<span class="L" style="display:inline-block">${c}</span>`).join('');
add(0,`<div class="a kick" id="i-k" style="top:262px">Elfikopki Wrapped 2026</div>
<div class="a" id="i-m" style="top:340px">${elf(270)}</div>
<div class="a num" id="i-n" style="top:745px;font-size:215px;letter-spacing:-6px">${nm}</div>
<div class="a lbl" id="i-s" style="top:985px;font-size:66px">oto Twój rok w kopce</div>
<div class="a" id="i-p" style="top:1110px"><span class="pill">${U.role}</span></div>
<div id="i-sp"></div>`);
let sp='';for(let i=0;i<10;i++)sp+=`<svg class="sp" viewBox="-20 -20 40 40" width="${40+rnd(i+9)*40}" height="${40+rnd(i+9)*40}" style="position:absolute;left:${80+rnd(i)*850}px;top:${280+rnd(i+30)*820}px"><path d="M0 -18 Q2 -2 18 0 Q2 2 0 18 Q-2 2 -18 0 Q-2 -2 0 -18Z" fill="${i%2?ACC:'#fff4dc'}"/></svg>`;
$('#i-sp').innerHTML=sp;
// ---- scene 1 nights
let dots='';const COLS=29;for(let i=0;i<365;i++){dots+=`<div class="dt" style="position:absolute;left:${(i%COLS)*29}px;top:${Math.floor(i/COLS)*29}px;width:20px;height:20px;border-radius:50%"></div>`}
let stars='';for(let i=0;i<26;i++)stars+=`<div class="st" style="position:absolute;left:${rnd(i)*1080}px;top:${240+rnd(i+50)*600}px;width:${3+rnd(i+7)*5}px;height:${3+rnd(i+7)*5}px;border-radius:50%;background:#fff4dc"></div>`;
add(1,`${stars}<div class="a kick" id="n-k" style="top:262px">${U.ctx.kick}</div>
<div class="a" id="n-m" style="top:310px">${moon(100)}</div>
<div class="a num" id="n-n" style="top:560px;font-size:250px">0</div>
<div class="a lbl" id="n-l" style="top:830px;font-size:60px;padding:0 70px;line-height:1.15">${U.ctx.label}</div>
<div id="n-g" style="position:absolute;left:119px;top:960px;width:841px;height:377px">${dots}</div>`);
// ---- scene 2 month
let bars='';const MO=['S','L','M','K','M','C','L','S','W','P','L','G'],MV=U.mid.months,MX=Math.max(...MV),PK=MV.indexOf(MX);
for(let i=0;i<12;i++)bars+=`<div class="br" style="position:absolute;left:${i*74}px;bottom:44px;width:56px;height:${MV[i]/MX*430}px;border-radius:16px 16px 6px 6px;transform-origin:bottom;background:${i==PK?ACC:'rgba(255,244,220,.28)'}"></div><div style="position:absolute;left:${i*74}px;bottom:0;width:56px;text-align:center;font-weight:800;font-size:30px;color:${i==PK?ACC:'rgba(255,244,220,.6)'}">${MO[i]}</div>`;
add(2,`<div class="a kick" id="m-k" style="top:262px">${U.mid.kick}</div>
<div class="a num" id="m-n" style="top:330px;font-size:230px">0</div>
<div class="a lbl" id="m-l" style="top:590px;font-size:56px;padding:0 70px">${U.mid.label}</div>
<div class="a lbl" id="m-t" style="top:700px;font-size:54px;color:${ACC}"><span style="text-transform:capitalize">${U.mid.peak}</span> to Twój miesiąc!</div>
<div id="m-c" style="position:absolute;left:96px;top:800px;width:888px;height:520px">${bars}</div>`);
// ---- scene 3 friends
const F=U.friends,FY=[330,690,940],FH=[330,230,230];
let fr='';F.forEach((f,i)=>{const big=i==0,H=FH[i],md=big?190:140;
 fr+=`<div class="row ${big?'first':''} fr" id="f${i}" style="top:${FY[i]}px;height:${H}px">
 <div class="medal" style="left:34px;top:${(H-md)/2}px;width:${md}px;height:${md}px;background:${big?ACC:'#fff4dc'};font-size:${big?100:74}px">${i+1}</div>
 <div style="position:absolute;left:${md+74}px;top:${H/2-(big?70:52)}px"><div style="font-weight:900;font-size:${big?92:68}px;line-height:1">${f.name}</div>
 <div class="mut" style="font-size:${big?44:36}px;margin-top:8px;text-transform:capitalize">${f.species}</div></div>
 <div style="position:absolute;right:36px;top:${H/2-(big?52:40)}px;text-align:right"><div class="num" style="font-size:${big?100:70}px;color:${big?ACC:'#fff4dc'};letter-spacing:-2px">${f.nights}</div><div class="mut" style="font-size:28px">wspólnych nocy</div></div>
 ${big?`<div style="position:absolute;left:30px;top:-38px;transform:rotate(-8deg) scale(.5);transform-origin:left bottom">${shroom(120)}</div>`:''}</div>`});
add(3,`<div class="a kick" id="f-k" style="top:262px">Twoja trójka z lasu</div>${fr}<div class="a mut" id="f-f" style="top:1215px;font-size:40px">razem ${F.reduce((a,b)=>a+b.nights,0)} wspólnych nocy</div>`);
// ---- scene 4 hero
let rays='';for(let i=0;i<16;i++)rays+=`<div style="position:absolute;left:540px;top:760px;width:2200px;height:150px;margin:-75px 0 0 0;transform-origin:0 50%;transform:rotate(${i*22.5}deg);background:linear-gradient(90deg,${ACC}55,transparent 70%);clip-path:polygon(0 50%,100% 0,100% 100%)"></div>`;
const PILE=[6,5,4,3,2,1];let pile='',pc=0;PILE.forEach((n,r)=>{for(let j=0;j<n;j++){const x=540-(n*100)/2+j*100+6+(rnd(pc+1)-.5)*8,y=1385-(r+1)*76-(rnd(pc+2)*8);pile+=`<div class="pa" style="position:absolute;left:${x}px;top:${y}px;transform:rotate(${(rnd(pc+3)-.5)*40}deg)">${ICON(84)}</div>`;pc++}});
add(4,`<div id="h-r" style="position:absolute;inset:0;opacity:.5">${rays}</div>
<div class="a kick" id="h-k" style="top:262px">${U.hero.kick}</div>
<div class="a num" id="h-n" style="top:380px;font-size:310px;color:var(--cream)">0</div>
<div class="a lbl" id="h-l" style="top:722px;font-size:84px;color:${ACC}">${U.hero.label}</div>
<div class="a mut" id="h-s" style="top:850px;font-size:48px">średnio ${Math.round(U.hero.value/U.ctx.value)} na każdą noc</div>${pile}
<div id="h-fall"></div>`);
let fall='';for(let i=0;i<14;i++)fall+=`<div class="fa" style="position:absolute;left:${70+rnd(i+40)*900}px;top:0">${ICON(46+rnd(i)*26)}</div>`;$('#h-fall').innerHTML=fall;
// ---- scene 5 percentile
let pd='';for(let i=0;i<100;i++)pd+=`<div class="pd" style="position:absolute;left:${(i%10)*46}px;top:${Math.floor(i/10)*46}px;width:36px;height:36px;border-radius:50%"></div>`;
add(5,`<div class="a kick" id="p-k" style="top:262px">A teraz porównanie</div>
<div class="a lbl" id="p-a" style="top:340px;font-size:62px">Więcej niż</div>
<div class="a num" id="p-n" style="top:400px;font-size:340px;color:${ACC}">0%</div>
<div class="a lbl" id="p-b" style="top:760px;font-size:56px">wszystkich elfikopków</div>
<div id="p-g" style="position:absolute;left:310px;top:880px;width:460px;height:460px">${pd}</div>
<div id="p-t" style="position:absolute;left:760px;top:830px;transform:rotate(10deg)"><span class="pill" style="font-size:50px;border:6px solid #13342a">TOP ${100-U.percentile}%</span></div>`);
// ---- scene 6 persona
add(6,`<div id="c-c" class="card">
 <div class="a" id="c-m" style="top:-190px">${elf(230)}</div>
 <div class="a kick" style="top:290px;font-size:36px;color:#7a4e2d;letter-spacing:10px">Twój typ</div>
 <div class="a num" id="c-p" style="top:360px;font-size:${U.persona.length>16?102:118}px;color:#13342a;letter-spacing:-3px;line-height:1.02;padding:0 40px;text-shadow:none">${U.persona.replace(' ','<br>')}</div>
 <div class="a" id="c-r" style="top:690px"><span class="pill">${U.role}</span></div>
 <div class="a" id="c-t" style="top:800px;padding:0 50px">${U.traits.map(t=>`<span class="chip">${t}</span>`).join('')}</div>
 <div class="a mut" id="c-f" style="top:955px;font-size:34px;color:#7a4e2d">Top ${100-U.percentile}% elfikopków</div></div>`);
// ---- scene 7 share
add(7,`<div class="a" id="x-m" style="top:330px">${shroom(190)}</div>
<div class="a kick" id="x-k" style="top:545px;font-size:38px">Elfikopki Wrapped 2026</div>
<div class="a num" id="x-n" style="top:615px;font-size:200px;letter-spacing:-6px">${U.name}</div>
<div class="a lbl" id="x-p" style="top:860px;font-size:76px;color:${ACC}">${U.persona}</div>
<div class="a lbl" id="x-h" style="top:985px;font-size:58px">${E.fmt(U.hero.value)} ${U.hero.label}</div>
<div class="a" id="x-t" style="top:1095px"><span class="pill" style="font-size:46px">TOP ${100-U.percentile}%</span></div>
<div class="a mut" id="x-u" style="top:1225px;font-size:50px;color:var(--cream)">${U.handle}</div>
<div class="a mut" id="x-g" style="top:1300px;font-size:42px">#MałyElfWielkiLas</div>`);
// ---------- helpers
const el={};const g=id=>el[id]||(el[id]=document.getElementById(id));
function set(id,o){const e=g(id);if(!e)return;e.style.opacity=o.o===undefined?1:o.o;
 e.style.transform=`translate(${o.x||0}px,${o.y||0}px) scale(${o.s===undefined?1:o.s}) rotate(${o.r||0}deg)`}
const pop=(l,a,b=.55)=>p(l,a,a+b,'back'), fade=(l,a,b=.4)=>p(l,a,a+b,'out');
const WP=[[540,960],[1000,300],[80,1500],[540,1700],[1000,900],[60,300],[540,960],[540,1000]];
// ---------- update
function update(t){
 const tt=Math.min(t,FREEZE);
 // scene visibility + iris wipes
 for(let i=0;i<N;i++){const s=S(i),st=ST[i],nx=i<N-1?ST[i+1]+WIPE+.05:1e9;
  if(t<st||t>=nx){s.style.display='none';continue}s.style.display='block';
  const k=i==0?1:p(t,st,st+WIPE,'io'); s.style.clipPath=i==0||k>=1?'none':`circle(${(k*2300).toFixed(1)}px at ${WP[i][0]}px ${WP[i][1]}px)`;}
 // fireflies (frozen at end)
 FF.forEach((f,i)=>{const x=(rnd(i+1)*1080+Math.sin(tt*.4+i*1.7)*70+tt*(8+rnd(i)*12))%1080,y=(rnd(i+80)*1920+Math.cos(tt*.35+i)*90-tt*(10+rnd(i+5)*14)+1920*3)%1920;
  f.style.transform=`translate(${x}px,${y}px)`;f.style.opacity=(.35+.55*Math.abs(Math.sin(tt*1.3+i*2.1))).toFixed(3)});
 // ===== S0 intro
 {const l=t-ST[0];
  set('i-k',{o:fade(l,0),y:(1-p(l,.1,.6))*-40});
  set('i-m',{o:fade(l,.2,.3),s:.4+.6*pop(l,.2,.8),y:(1-pop(l,.2,.8))*140+Math.sin(l*3)*8,r:Math.sin(l*2.2)*3});
  document.querySelectorAll('#i-n .L').forEach((c,i)=>{const k=pop(l,.15+i*.08,.6);c.style.opacity=cl(k*3);c.style.transform=`translateY(${(1-k)*160}px) rotate(${(1-k)*(i%2?-18:18)}deg) scale(${.4+.6*k})`});
  set('i-s',{o:fade(l,1.5),y:(1-p(l,1.5,2.1))*50});
  set('i-p',{o:fade(l,2.3,.3),s:.5+.5*pop(l,2.3,.6)});
  document.querySelectorAll('.sp').forEach((s,i)=>{const k=p(l,.7+rnd(i)*2,1.5+rnd(i)*2,'back'),tw=.5+.5*Math.sin(tt*3+i*2);s.style.opacity=k*(.4+.6*tw);s.style.transform=`scale(${k*(.6+.5*tw)}) rotate(${tt*40+i*30}deg)`});}
 // ===== S1 nights
 {const l=t-ST[1],c=p(l,.9,3.6,'io'),v=Math.round(U.ctx.value*c);
  set('n-k',{o:fade(l,.8),y:(1-p(l,.8,1.3))*-30});
  set('n-m',{o:fade(l,.9,.5),s:.5+.5*pop(l,.9,.9),y:Math.sin(tt*1.5)*10});
  set('n-n',{o:fade(l,1,.2),s:.7+.3*pop(l,1,.8)});g('n-n').textContent=E.fmt(v);
  set('n-l',{o:fade(l,1.8,.5),y:(1-p(l,1.8,2.3))*40});
  document.querySelectorAll('.st').forEach((s,i)=>{s.style.opacity=(.3+.7*Math.abs(Math.sin(tt*1.6+i*3)))*fade(l,.6,.8)});
  const n=Math.round(U.ctx.value*c);
  document.querySelectorAll('.dt').forEach((d,i)=>{const on=i<n,rv=fade(l,3.0+(i%COLS)*.012+Math.floor(i/COLS)*.025,.35);
   d.style.background=on?ACC:'rgba(255,244,220,.16)';d.style.boxShadow=on?`0 0 10px ${ACC}88`:'none';d.style.opacity=rv;d.style.transform=`scale(${.4+.6*rv})`});}
 // ===== S2 month
 {const l=t-ST[2],c=p(l,.8,3.6,'io');
  set('m-k',{o:fade(l,.7),y:(1-p(l,.7,1.2))*-30});
  set('m-n',{o:fade(l,.8,.2),s:.7+.3*pop(l,.8,.8)});g('m-n').textContent=E.fmt(U.mid.value*c);
  set('m-l',{o:fade(l,1.4),y:(1-p(l,1.4,1.9))*40});
  set('m-t',{o:fade(l,4.0,.5),s:.7+.3*pop(l,4.0,.7)});
  document.querySelectorAll('.br').forEach((b,i)=>{const k=p(l,2.0+i*.12,2.9+i*.12,'back');b.style.transform=`scaleY(${Math.max(0,k)})`;
   if(i==PK){const q=.5+.5*Math.sin(tt*5);b.style.boxShadow=`0 0 ${20+q*30}px ${ACC}aa`;b.style.opacity=1}});}
 // ===== S3 friends
 {const l=t-ST[3];set('f-k',{o:fade(l,.8),y:(1-p(l,.8,1.3))*-30});
  const T=[5.3,3.3,1.3];F.forEach((f,i)=>{const k=pop(l,T[i],.8);set('f'+i,{o:cl(k*3),x:(1-k)*(i%2?-700:700),s:1});
   if(i==0)g('f0').style.boxShadow=`0 0 ${40+30*Math.sin(tt*4)}px ${ACC}88`});
  set('f-f',{o:fade(l,6.4,.6)});}
 // ===== S4 hero
 {const l=t-ST[4],c=p(l,1.2,5.3,'io');
  g('h-r').style.transform=`rotate(${tt*6}deg)`;g('h-r').style.opacity=fade(l,.2,1)*.55;
  set('h-k',{o:fade(l,.5),y:(1-p(l,.5,1))*-30});
  const sc=1+(l>5.3?0:Math.sin(c*Math.PI)*.05)+(1-p(l,5.3,5.8,'out'))*0;
  set('h-n',{o:fade(l,.6,.2),s:(.5+.5*pop(l,.6,.9))*(l>5.3?1+.14*Math.max(0,1-(l-5.3)*3)*Math.sin((l-5.3)*14):1)});g('h-n').textContent=E.fmt(U.hero.value*c);
  set('h-l',{o:fade(l,1.4,.5),y:(1-p(l,1.4,2))*50});
  set('h-s',{o:fade(l,6.0,.6),y:(1-p(l,6,6.6))*30});
  document.querySelectorAll('.pa').forEach((a,i)=>{const k=p(l,1.3+i*.12,1.9+i*.12,'back');a.style.opacity=cl(k*3);a.style.transform+=''; a.style.scale=k;});
  document.querySelectorAll('.fa').forEach((a,i)=>{const per=2.4+rnd(i+3)*.8,ph=((l-1+rnd(i)*per)%per)/per,live=l>1&&l<5.4;a.style.opacity=live?1:0;a.style.transform=`translateY(${ph*1300}px) rotate(${ph*240+i*30}deg)`});}
 // ===== S5 percentile
 {const l=t-ST[5],c=p(l,1.4,4.3,'io');
  set('p-k',{o:fade(l,.8),y:(1-p(l,.8,1.3))*-30});
  set('p-a',{o:fade(l,.9),y:(1-p(l,.9,1.5))*30});
  set('p-n',{o:fade(l,1.1,.2),s:.6+.4*pop(l,1.1,.9)});g('p-n').textContent=Math.round(U.percentile*c)+'%';
  set('p-b',{o:fade(l,1.9,.5)});
  const n=Math.round(U.percentile*c);document.querySelectorAll('.pd').forEach((d,i)=>{const row=Math.floor(i/10),idx=(9-row)*10+(i%10),on=idx<n,rv=fade(l,1.2+(i%10)*.02+row*.05,.3);
   d.style.background=on?ACC:'rgba(255,244,220,.18)';d.style.boxShadow=on?`0 0 8px ${ACC}99`:'none';d.style.opacity=rv;d.style.transform=`scale(${.3+.7*rv})`});
  set('p-t',{o:fade(l,4.5,.2),s:.2+.8*p(l,4.5,5.2,'elastic'),r:10});}
 // ===== S6 persona
 {const l=t-ST[6],k=p(l,.5,1.5,'back');
  set('c-c',{o:cl(k*4),s:1,y:(1-k)*900});g('c-c').style.transform=`translateY(${(1-k)*900}px) rotateY(${(1-p(l,.5,1.6,'out'))*80}deg) rotateZ(${(1-k)*6-1.5*Math.sin(tt*1.6)*p(l,1.6,2)}deg)`;g('c-c').style.perspective='1200px';
  set('c-m',{o:fade(l,1.0,.4),s:.6+.4*pop(l,1,.8),y:Math.sin(tt*2.4)*7});
  set('c-p',{o:fade(l,1.3,.3),s:.6+.4*pop(l,1.3,.8)});
  set('c-r',{o:fade(l,1.9,.3),s:.5+.5*pop(l,1.9,.6)});
  set('c-t',{o:fade(l,2.4,.5),y:(1-p(l,2.4,3))*30});set('c-f',{o:fade(l,3.0,.5)});}
 // ===== S7 share  (still from FREEZE)
 {const l=Math.min(t-ST[7],FREEZE-ST[7]);
  set('x-m',{o:fade(l,.4,.3),s:.4+.6*pop(l,.4,.8),r:(1-pop(l,.4,.8))*-25});
  set('x-k',{o:fade(l,.9)});set('x-n',{o:fade(l,1.0,.3),s:.6+.4*pop(l,1,.8)});
  set('x-p',{o:fade(l,1.6),y:(1-p(l,1.6,2.2))*30});set('x-h',{o:fade(l,2.0),y:(1-p(l,2,2.6))*30});
  set('x-t',{o:fade(l,2.4,.3),s:.5+.5*pop(l,2.4,.6)});set('x-u',{o:fade(l,2.9)});set('x-g',{o:fade(l,3.1)});}
 // captions
 E.captions(document.getElementById('cap'),t);if(t>57.95)document.getElementById('cap').style.opacity=0;
}
E.start(update);
})();
