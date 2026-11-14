// The day's watch painted over the masters' steel Seiko (asm-watch.js, 2026-11-14, the owner's gold watch on brown leather): only a
// watch that doesn't look like the master's is painted and puts a watch part in the look's key (the master's own: every key as before);
// the case takes the metal, the dial its colour, a leather strap the scanned grain; nothing outside the watch's square changes; the
// planner keeps gold clips off unless the watch and the buckle are gold too.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await browser.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(async()=>{const I=(type,primaryColor,x={})=>({id:type+Math.random(),type,primaryColor,pattern:'solid',...x});
      const seiko=I('watch','silver',{metal:'silver',dial:'white',band:'integrated'}),gold=I('watch','brown',{metal:'gold',dial:'charcoal',band:'leather'}),blackDial=I('watch','silver',{metal:'silver',dial:'black',band:'bracelet'});
      const paints=[asmWatchPaints(seiko),asmWatchPaints(gold),asmWatchPaints(blackDial),asmWatchPaints(null)];
      const o=w=>({top:I('suit','navy'),shirt:I('shirt','white'),tie:I('tie','burgundy'),watch:w,suitDay:true});
      const sig=w=>{const s=asmCmSig(o(w));return s};   // (asmCmKind needs a shirt; '' when there is no master for it)
      const sigS=asmCmSig({...o(seiko)}),sigG=asmCmSig({...o(gold)});
      // the painting, on the 512 px suit master (geometry in the 2048 frame, scaled)
      const M=await asmData('tests/fixtures/cm/suit/master.jpg'),S=M.width,before=Uint8ClampedArray.from(M.data),px=Uint8ClampedArray.from(M.data);
      const W=asmWatchJob(o(gold),'suit'),Wo=asmWatchJob(o(gold),'suit-open'),Wn=asmWatchJob(o(seiko),'suit');
      await asmWatchPaint({px,S},W);
      const f=S/2048,at=(x,y)=>{const q=4*(Math.round(y*f)*S+Math.round(x*f));return [px[q],px[q+1],px[q+2]]},was=(x,y)=>{const q=4*(Math.round(y*f)*S+Math.round(x*f));return [before[q],before[q+1],before[q+2]]};
      const g=ASM_WATCH_GEO.suit,lum=c=>(c[0]+c[1]+c[2])/3;
      const dial=at(g.cx,g.cy),bez=at(g.cx+58,g.cy+8),strapUp=at(g.cx+g.ax[0]*95,g.cy+g.ax[1]*95);
      let outside=0,inside=0;for(let y=0;y<S;y++)for(let x=0;x<S;x++){const q=4*(y*S+x),X=x/f,Y=y/f,inSq=X>=g.x-14&&X<g.x+g.n+14&&Y>=g.y-14&&Y<g.y+g.n+14,d=Math.abs(px[q]-before[q])+Math.abs(px[q+1]-before[q+1])+Math.abs(px[q+2]-before[q+2]);if(d){if(inSq)inside++;else outside++}}
      // the JPEG path: a picture as a data URL comes back painted, as a data URL
      const c=document.createElement('canvas');c.width=c.height=S;c.getContext('2d').putImageData(new ImageData(before,S,S),0,0);const r2=await asmWatchPaint({url:c.toDataURL('image/jpeg',.95)},W);
      const back=await asmData(r2.url),q2=4*(Math.round(g.cy*f)*S+Math.round(g.cx*f)),dial2=[back.data[q2],back.data[q2+1],back.data[q2+2]];
      // the planner: clips with a gold watch and a silver buckle, and with a gold buckle
      const cl=metal=>{const w=I('watch','brown',{metal:'gold',dial:'charcoal',band:'leather'}),belt=I('belt','brown',{leather:'calf',metal}),gc=I('tieclip','gold'),sc=I('tieclip','silver');
        items=[I('blazer','navy'),I('pants','grey'),I('shirt','white'),I('tie','burgundy'),I('shoes','brown',{leather:'calf'}),belt,I('socks','navy'),w,gc,sc];
        settings.workdays=[0,1,2,3,4];settings.blazerDays=[0,1,2,3,4];settings.vestMode='never';weather={};climate=null;dayRecs={};TODAY_OVERRIDE='2026-11-15T12:00:00';cache={};
        const n={};for(const [d,o2] of Object.entries(planMonth(2026,10)))if(keyDate(d)>=todayDate()&&o2.clip)n[o2.clip.primaryColor]=(n[o2.clip.primaryColor]||0)+1;return n};
      return {paints,sigS:/watch:/.test(sigS),sigG:/watch:/.test(sigG),sigGtxt:(sigG.match(/watch:[^|]*/)||[''])[0],Wo:Wo&&Wo.k,Wn,dial,bez,strapUp,wasDial:was(g.cx,g.cy),outside,inside,dial2,lumDial:lum(dial),
        silverBuckle:cl('silver'),goldBuckle:cl('gold')}});
    ok(r.paints.join()==='false,true,true,false','painted: the gold watch and a black dial; not the master\'s steel Seiko (silver, white, bracelet) or no watch');
    ok(!r.sigS&&r.sigG&&/gold\/charcoal\/leather\/#/.test(r.sigGtxt),`the look's key gets a watch part only for a painted watch (${r.sigGtxt}); the Seiko's keys stay as they were`);
    ok(r.Wo==='suit'&&r.Wn===null,'the open-collar master uses its buttoned master\'s watch; the Seiko makes no job');
    const gold=c=>c[0]>c[2]+40&&c[1]>c[2]+15;
    ok(r.lumDial<70&&r.wasDial[0]>150,`the white dial is charcoal now (${r.dial}, was ${r.wasDial})`);
    ok(gold(r.bez),`the bezel is gold (${r.bez})`);
    ok(r.strapUp[0]>r.strapUp[2]+15&&(r.strapUp[0]+r.strapUp[1]+r.strapUp[2])/3<150,`the strap above the case is brown leather (${r.strapUp})`);
    ok(r.outside===0&&r.inside>200,`nothing changes outside the watch's square (${r.outside} pixels outside, ${r.inside} inside)`);
    ok((r.dial2[0]+r.dial2[1]+r.dial2[2])/3<80,`a picture handed over as a JPEG comes back painted (${r.dial2})`);
    ok(!r.silverBuckle.gold&&r.silverBuckle.silver>0,`with the gold watch and silver buckles a gold clip is never planned (${JSON.stringify(r.silverBuckle)})`);
    ok(r.goldBuckle.gold>0,`with a gold watch and a gold buckle it can be (${JSON.stringify(r.goldBuckle)})`);
    const w=await p.evaluate(async()=>{const t=await (await fetch('asm-worker.js')).text(),a=await (await fetch('asm-watch.js')).text();
      // the worker really starts with it (it loads asm-watch.js without core.js: a core.js name read at load time killed it)
      const ready=await new Promise(res=>{const wk=new Worker('asm-worker.js');const tm=setTimeout(()=>{wk.terminate();res('no answer')},15000);wk.onerror=e=>{clearTimeout(tm);wk.terminate();res('error: '+(e.message||'?'))};wk.onmessage=e=>{if('ready' in (e.data||{})){clearTimeout(tm);wk.terminate();res(e.data.ready?'ready':'not ready')}}});
      return {imp:/importScripts\([^)]*asm-watch\.js/.test(t),dom:/document\.|window\./.test(a),ready}});
    ok(w.imp&&!w.dom&&w.ready==='ready',`the picture worker loads asm-watch.js and starts (${w.ready})`);
    ok(errs.length===0,'no page errors: '+errs.join(' | '));
  }finally{await browser.close()}
};
module.exports.realPlanner=true;   // the clip checks read what the planner chooses
