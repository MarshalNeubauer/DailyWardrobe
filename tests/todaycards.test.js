// Today's cards (score, pieces, month plan) are one size with their text in one column, the below-the-waist tiles are short,
// and everything on Today is spaced evenly: picture (a day with a photo), tiles, cards. The score card unfolds like the others (chevron turns).
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  try{
    for(const [name,w] of [['phone',390],['Duo folded',466]]){
      const p=await (await browser.newContext({viewport:{width:w,height:1400}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
      await p.goto(url);await p.waitForFunction(()=>window.appReady);
      const r=await p.evaluate(async()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',added:1,...x});
        items=[I('suit','deeptaupe'),I('suit','navy'),I('shirt','lightblue'),I('shirt','white'),I('tie','brown',{pattern:'stripe',secondaryColor:'cream'}),I('tie','burgundy'),
          I('shoes','brown',{leather:'calf'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('socks','brown'),I('watch','silver',{metal:'silver'})];
        settings.workdays=[1,2,3,4,5];TODAY_OVERRIDE='2026-11-10T12:00:00';dayRecs={};cache={};sel=new Date(2026,10,10);view={y:2026,m:10};listOpen=false;monthOpen=false;
        const o=planFor()[key(sel)];renderTried.add(comboKey(o));renders[comboKey(o)]={sig:'x',img:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#5f5449"/></svg>'),model:'x',t:1};show('today');
        await new Promise(r=>setTimeout(r,300));
        const R=s=>document.querySelector(s).getBoundingClientRect(),seq=['#mannequin-container','.below','.score','#ibox','#mbox'].map(R);
        const cards=['.score','#ibox','#mbox'].map(R),text=[...document.querySelectorAll('.score .lbl,#ibox .mltxt,#mbox .mltxt')].map(e=>Math.round(e.getBoundingClientRect().left));
        const slots=['.score .num','#ibox .pstrip','#mbox .mlstrip'].map(s=>Math.round(R(s).width)),tile=R('.below .tile');
        return {gaps:seq.slice(1).map((b,i)=>Math.round(b.top-seq[i].bottom)),hs:cards.map(c=>Math.round(c.height)),ws:cards.map(c=>Math.round(c.width)),text,slots,tileH:tile.height,tileW:tile.width}});
      ok(new Set(r.hs).size===1&&new Set(r.ws).size===1&&r.hs[0]<=80,`${name}: score, pieces and month cards are the same size (${r.hs.join('/')}px tall)`);
      ok(new Set(r.text).size===1&&new Set(r.slots).size===1,`${name}: their pictures share one width and their text starts in one column (${r.slots}; ${r.text})`);
      ok(r.gaps.every(g=>g===r.gaps[0])&&r.gaps[0]===12,`${name}: even spacing between the picture, the tiles and each card (${r.gaps.join(', ')})`);
      ok(r.tileH<r.tileW*1.1,`${name}: tiles are short (${Math.round(r.tileH)}px tall, ${Math.round(r.tileW)}px wide)`);
      const o=await p.evaluate(async()=>{const d=document.querySelector('.score'),h=d.getBoundingClientRect().height;d.open=true;await new Promise(r=>setTimeout(r,400));
        return {grew:d.getBoundingClientRect().height>h+40,turned:getComputedStyle(d.querySelector('.chev')).transform!=='none'}});
      ok(o.grew&&o.turned,`${name}: the score card opens with its chevron turned, like the other cards`);
      // an unfolded tile photo is spaced like everything else; folded it takes no space
      const b=await p.evaluate(async()=>{pickPiece('belt');await new Promise(r=>setTimeout(r,500));const t=document.querySelector('.below').getBoundingClientRect(),x=document.querySelector('#bbox').getBoundingClientRect();return Math.round(x.top-t.bottom)});
      ok(b===12,`${name}: an unfolded tile photo sits the same 12px below the tiles (${b})`);
      ok(errs.length===0,`${name}: no page errors (${errs.join('; ')})`);
    }
  }finally{await browser.close()}
};
