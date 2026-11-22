const {chromium}=require('playwright');
const [,,id,out,...titles]=process.argv;
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:2400},deviceScaleFactor:2});
await p.goto('https://judicious-ursinia-2c0.notion.site/'+id,{waitUntil:'domcontentloaded',timeout:60000});await p.waitForTimeout(8000);
for(let k=0;k<40;k++){await p.evaluate(()=>{const s=document.querySelector('.notion-frame .notion-scroller')||document.scrollingElement;s.scrollBy(0,1500)});await p.waitForTimeout(600);}
for(const [i,t] of titles.entries()){
 const ok=await p.evaluate((t)=>{const hs=[...document.querySelectorAll('.notion-page-content .notion-header-block, .notion-page-content .notion-sub_header-block, .notion-page-content .notion-sub_sub_header-block')];const h=hs.find(e=>e.innerText.includes(t));if(!h)return false;h.scrollIntoView({block:'start'});return true},t);
 if(!ok){console.log('nf',t);continue}
 await p.waitForTimeout(2000);
 const r=await p.evaluate((t)=>{const m=document.querySelector('.notion-page-content');const hs=[...m.querySelectorAll('.notion-header-block, .notion-sub_header-block, .notion-sub_sub_header-block')];const idx=hs.findIndex(e=>e.innerText.includes(t));const a=hs[idx].getBoundingClientRect();const nb=idx+1<hs.length?hs[idx+1].getBoundingClientRect().top:m.getBoundingClientRect().bottom;const r0=m.getBoundingClientRect();return {x:r0.left-10,w:r0.width+20,y:a.top-6,h:nb-a.top+12}},t);
 const h=Math.min(r.h,2400-Math.max(0,r.y));
 await p.screenshot({path:`${out}_${i}.png`,clip:{x:r.x,y:Math.max(0,r.y),width:r.w,height:h}});console.log('ok',t,r.h);}
await b.close();})();
