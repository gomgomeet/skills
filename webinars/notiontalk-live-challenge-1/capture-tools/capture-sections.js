const {chromium}=require('playwright');const fs=require('fs');
const pages={p00:'412c5f01a4a4804cabd3c294d5d93fc9',p02:'412c5f01a4a48023b99bc4783b3b17be',p03:'412c5f01a4a4800aab51c7ff0caed3a9',p04:'412c5f01a4a480818588e5954c3b7586',p05:'412c5f01a4a480b58bc8c7f73b66bb7c',p06:'c9c17a93b9cb4813bd0064b71de81c9b',p08:'1-de55b686c0ef4f268eb33f44d9252bb0',p09:'2-620be8d64cee45c2b4fc7fc182b9a437',p10:'4fac5f01a4a483eda753813104023e0b?v=418c5f01a4a480859bfd000c54de6885',p11:'de4bbbe8f1ba4c6c916156121dd85935',p33:'D-day-2a6c5f01a4a4837abda181dbd49da085'};
const OUT=process.argv[2];
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1280,height:900},deviceScaleFactor:2});
for(const [k,id] of Object.entries(pages)){const p=await ctx.newPage();
 await p.goto('https://judicious-ursinia-2c0.notion.site/'+id,{waitUntil:'domcontentloaded',timeout:60000});await p.waitForTimeout(7000);
 await p.evaluate(()=>document.querySelectorAll('.notion-toggle-block div[role=button][aria-expanded=false]').forEach(e=>e.click()));await p.waitForTimeout(1000);
 const H=await p.evaluate(()=>{const s=document.querySelector('.notion-frame .notion-scroller')||document.scrollingElement;return s.scrollHeight});
 await p.setViewportSize({width:1280,height:Math.min(H+50,16000)});await p.waitForTimeout(3000);
 const full=await p.evaluate(()=>{const m=document.querySelector('.notion-page-content');return m?m.innerText:document.body.innerText});fs.writeFileSync(`${OUT}/${k}.txt`,full);
 const secs=await p.evaluate(()=>{const m=document.querySelector('.notion-page-content');if(!m)return[];const r0=m.getBoundingClientRect();
  const hs=[...m.querySelectorAll('.notion-header-block, .notion-sub_header-block, .notion-sub_sub_header-block')].map(e=>({t:e.innerText.slice(0,40),y:e.getBoundingClientRect().top,lvl:e.className.includes('sub_sub')?3:e.className.includes('sub_header')?2:1}));
  const out=[];const bnds=[{t:'INTRO',y:r0.top,lvl:0},...hs];
  for(let i=0;i<bnds.length;i++){const y=bnds[i].y;const nb=i+1<bnds.length?bnds[i+1].y:r0.bottom;if(nb-y>20)out.push({title:bnds[i].t,lvl:bnds[i].lvl,y,b:nb});}
  return out.map(s=>({...s,x:r0.left-10,w:r0.width+20}))});
 // title area (header incl. cover/title) 
 const top=await p.evaluate(()=>{const m=document.querySelector('.notion-page-content');return m?m.getBoundingClientRect().top:0});
 const meta=[];secs.forEach((s,i)=>{meta.push({i,lvl:s.lvl,title:s.title,h:Math.round(s.b-s.y)})});
 const VH=p.viewportSize().height;for(const [i,s] of secs.entries()){const y0=Math.max(0,s.y-6),h=Math.min(s.b-s.y+12,VH-y0,6000);if(h<20)continue;try{await p.screenshot({path:`${OUT}/${k}_s${String(i).padStart(2,'0')}.png`,clip:{x:Math.max(0,s.x),y:y0,width:s.w,height:h}});}catch(e){console.log('skip',k,i,e.message.slice(0,60))}}
 await p.screenshot({path:`${OUT}/${k}_top.png`,clip:{x:0,y:0,width:1280,height:Math.min(top+0,1600)||900}});
 fs.writeFileSync(`${OUT}/${k}_secs.json`,JSON.stringify(meta));console.log(k,JSON.stringify(meta));await p.close();}
await b.close();})();
