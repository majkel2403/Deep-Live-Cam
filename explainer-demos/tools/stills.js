// node stills.js <dir> t1 t2 ... → <dir>/_stills/s-<t>.png
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
(async()=>{const dir=path.resolve(process.argv[2]);const out=path.join(dir,'_stills');fs.mkdirSync(out,{recursive:true});
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920}});
p.on('pageerror',e=>console.log('PAGEERR',e.message));p.on('console',m=>{if(m.type()=='error')console.log('CONSOLE',m.text())});
await p.goto('file://'+dir+'/index.html?render=1');await p.waitForFunction('window.__ready===true');
for(const t of process.argv.slice(3)){await p.evaluate(x=>window.seek(x),+t);await p.screenshot({path:`${out}/s-${t}.png`});}
await b.close();})();
