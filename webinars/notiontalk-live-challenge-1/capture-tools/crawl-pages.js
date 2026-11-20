const {chromium}=require('playwright');const fs=require('fs');
const OUT=process.argv[3];
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1280,height:900},deviceScaleFactor:2});
const seen=new Set();const queue=[[process.argv[2],0,'00']];let n=0;const index=[];
while(queue.length){const [url,d,id]=queue.shift();const key=url.split('?')[0].split('#')[0];if(seen.has(key))continue;seen.add(key);
 const p=await ctx.newPage();try{await p.goto(url,{waitUntil:'domcontentloaded',timeout:60000});await p.waitForTimeout(7000);
 // expand toggles
 await p.evaluate(()=>document.querySelectorAll('.notion-toggle-block div[role=button]').forEach(e=>{if(e.getAttribute('aria-expanded')==='false')e.click()}));await p.waitForTimeout(1500);
 const title=await p.title();const text=await p.evaluate(()=>{const m=document.querySelector('.notion-page-content')||document.querySelector('main')||document.body;return m.innerText});
 const name=String(n).padStart(2,'0');n++;fs.writeFileSync(`${OUT}/${name}.txt`,url+'\n'+title+'\n'+text);
 // full-page screenshot by scrolling the scroller
 const H=await p.evaluate(()=>{const s=document.querySelector('.notion-frame .notion-scroller')||document.scrollingElement;return s.scrollHeight});
 await p.setViewportSize({width:1280,height:Math.min(Math.max(H+100,900),12000)});await p.waitForTimeout(2500);
 await p.screenshot({path:`${OUT}/${name}.png`});
 index.push(`${name}\t${d}\t${title}\t${url}`);
 if(d<2){const links=await p.evaluate(()=>[...document.querySelectorAll('a[href]')].map(a=>a.href).filter(h=>/notion\.site\/.*[0-9a-f]{32}/.test(h)));
  for(const l of links)queue.push([l,d+1]);}
 }catch(e){console.log('ERR',url,e.message)}await p.close();if(n>40)break;}
fs.writeFileSync(`${OUT}/index.tsv`,index.join('\n'));console.log(index.join('\n'));await b.close();})();
