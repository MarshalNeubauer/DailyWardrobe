// Every pattern Claude can tag reaches a painter (asm-color.js: asmCmRoute), the owner's rule of 2026-11-13: for each item type and
// each of its patterns, with no reading it is painted, or waits for its reading, or is on the short list of patterns with no painter
// yet (ASM_NO_PAINTER); with a reading every readable pattern is painted. A pattern added to the tagger's list fails here until it has
// a way to be painted (or is put on the no-painter list on purpose, which changes the snapshot below).
const fs=require('fs'),path=require('path');
module.exports=async({ok,chromium,url})=>{
  const src=fs.readFileSync(path.join(__dirname,'..','worker.js'),'utf8'),m=src.match(/const PATTERN_LIST = \[([^\]]*)\]/);
  const tagged=m?[...m[1].matchAll(/'([^']+)'/g)].map(x=>x[1]):[];
  const browser=await chromium.launch();const p=await (await browser.newContext()).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(tagged=>{
      const BANDS={v:2,a:0,bands:[['#22252b',.9],['#cfd2d6',.1]],tr:20,cr:5,src:'claude+pixels'},
        MOTIF={v:3,a:0,motif:{grid:'square',ground:'#22252b',figs:[{shape:'dot',place:'centre',size:.3,cols:['#cfd2d6']}]},tr:10,cr:10,src:'claude+pixels'},
        TEX={v:4,tex:{kind:'dobby',grid:[[1,0],[0,1]],lighter:true,contrast:.3,rel:.05},cr:20,tr:60,src:'claude+pixels'};
      const zone=ASM_CM_ZONE,out={missing:tagged.filter(t=>!Object.values(PATS_BY).some(l=>l.includes(t))),bad:[],afterRead:[],painter:[],reading:[]};
      for(const [type,pats] of Object.entries(PATS_BY)){const z=zone[type];if(!z)continue;
        for(const pat of pats){const it={id:'x',type,primaryColor:'navy',pattern:pat},rt=asmCmRoute(it,z),key=`${type}/${pat}`;
          if(rt.gap==='painter'){if(!ASM_NO_PAINTER[z==='waistcoat'?'jacket':z].includes(pat))out.bad.push(key+': '+rt.why);out.painter.push(key)}
          else if(rt.gap==='reading'){if(!readable(type,pat,null))out.bad.push(key+' waits for a reading it can never get');out.reading.push(key)}
          else if(rt.how==='plain')out.bad.push(key+' plain with no reason');
          if(rt.gap&&!rt.why)out.bad.push(key+' gives no reason');
          // read: what the reader would give it
          if(readable(type,pat,null)){const s=motifPat(pat)?MOTIF:(texPat(type,pat)||tieWeave(type,pat))?TEX:BANDS,rr=asmCmRoute({...it,sett:s},z);
            if(rr.gap)out.afterRead.push(`${key}: ${rr.why}`)}}}
      return out},tagged);
    ok(tagged.length>20&&!r.missing.length,`every pattern the tagger can answer is listed for some item type (${tagged.length}; missing: ${r.missing.join(', ')||'none'})`);
    ok(!r.bad.length,`every pattern of every type goes to a painter, waits for a reading it can get, or is on the no-painter list (${r.bad.join('; ')||'all'})`);
    ok(!r.afterRead.length,`once read, every readable pattern is painted (${r.afterRead.join('; ')||'all'})`);
    // the snapshot: the patterns with no painter yet; a change here is a decision, not an accident
    const NOPAINT='blazer/birdseye,blazer/houndstooth,blazer/nailhead,blazer/other,blazer/sharkskin,pants/birdseye,pants/houndstooth,pants/nailhead,pants/other,pants/sharkskin,suit/birdseye,suit/houndstooth,suit/nailhead,suit/other,suit/sharkskin,tie/knit,tie/paisley';
    ok(r.painter.sort().join()===NOPAINT,`the patterns with no painter yet are the known ones (${r.painter.sort().join(', ')})`);
    // the trousers' weaves are painted with the jacket's cloths; the owner's own pattern named twill and drawn like solid gets the ribs
    const tr=await p.evaluate(()=>['twill','herringbone','tweed','windowpane'].map(pat=>asmCmRoute({id:'t',type:'pants',primaryColor:'grey',pattern:pat},'trousers')).map(x=>x.how+(x.gap?'/'+x.gap:'')));
    ok(tr.join()==='twill,herringbone,tweed,plain/reading',`trousers in twill, herringbone and tweed are painted; a windowpane waits for its reading (${tr})`);
    // the item sheet says so, and Settings lists it with one tap to read
    const ui=await p.evaluate(()=>{items=[{id:'g1',type:'suit',primaryColor:'navy',pattern:'pinstripe'},{id:'g2',type:'tie',primaryColor:'navy',pattern:'paisley'},{id:'g3',type:'suit',primaryColor:'navy',pattern:'solid'}];
      const note=asmGapNote(items[0]),none=asmGapNote(items[2]),gaps=asmCmGaps().map(x=>x.i.id+':'+x.r.gap);
      const host=document.createElement('div');host.id='asm-group';document.body.appendChild(host);asmCmUI();const html=$('#cm-gaps').innerHTML;host.remove();
      return {note,none,gaps,list:/Painted plain \(2\)/.test(html),btn:/Read 1 pattern/.test(html)}});
    ok(/Read pattern from photo/.test(ui.note)&&ui.none===''&&ui.gaps.join()==='g1:reading,g2:painter',`the item sheet says why a piece is painted plain ("${ui.note.replace(/<[^>]+>/g,'')}"), and only for such a piece`);
    ok(ui.list&&ui.btn,'Settings lists the pieces painted plain, with one button to read the readable ones');
    // a new pattern's "drawn like" follows the words in its name
    const g=await p.evaluate(()=>[guessPatBase('Fine worsted twill','','suit','solid'),guessPatBase('Two-colour pinstripe on twill','','suit','solid'),guessPatBase('Melange plain weave','','suit','solid'),
      guessPatBase('Prince of Wales','','suit','solid'),guessPatBase('Tonal herringbone twill','','shirt','solid'),guessPatBase('Fresco crosshatch','','pants','solid')]);
    ok(g.join()==='twill,pinstripe,solid,glen-check,herringbone,solid',`a new pattern is drawn like the pattern its name says (${g})`);
    ok(!errs.length,'no page errors: '+errs.join(' | '));
  }finally{await browser.close()}};
module.exports.assembled=true;
