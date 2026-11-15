const { chromium } = require('playwright');const fs=require('fs');
(async()=>{const dir=process.argv[2],ts=process.argv.slice(3).map(Number);fs.mkdirSync(dir+'/_stills',{recursive:true});
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920}});
p.on('pageerror',e=>console.log('ERR',e.message));p.on('console',m=>m.type()==='error'&&console.log('CON',m.text()));
await p.goto('file://'+require('path').resolve(dir)+'/index.html?render=1');await p.waitForFunction('window.__ready===true');
for(const t of ts){await p.evaluate(t=>window.seek(t),t);await p.screenshot({path:`${dir}/_stills/s${String(t).padStart(5,'0')}.png`});}
await b.close()})();
