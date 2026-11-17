// Tie weaves.
// Joined by feature from 2 files (Round B, 2026-11-17: the code review's CR-10-14); each part below is one old file, its checks unchanged.
const fs=require('fs'),path=require('path');

/* ---- was tests/tieweave.test.js ---- */
// A tie tagged woven or tonal check can be read by Claude (claudeOnly): the item sheet offers "Read pattern from photo", and a motif
// reading paints it (the owner's charcoal & grey woven tie, a grid of tiny light dots, was painted plain, 2026-11-13).
const tieweave=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  const PH='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(()=>({tie:[claudeOnly('tie','woven'),claudeOnly('tie','tonal-check'),readable('tie','woven')],
      shirt:claudeOnly('shirt','woven'),solid:claudeOnly('tie','solid'),suit:claudeOnly('suit','tweed')}));
    ok(r.tie.every(Boolean)&&r.shirt&&!r.solid&&!r.suit,'a woven or tonal-check tie is read by Claude; a plain tie and other items are unchanged');
    const btn=await p.evaluate(ph=>{localStorage.setItem('worker_url',location.origin+'/w/');localStorage.setItem('app_token','t');
      items=[{id:'t1',type:'tie',primaryColor:'charcoal',secondaryColor:'grey',pattern:'woven',photo:ph,texture:ph,added:1}];flt='all';editing='t1';show('wardrobe');
      const b=document.querySelector('#readpat-btn');return b&&b.textContent},PH);
    ok(btn==='Read pattern from photo','the item sheet offers to read the woven tie\'s pattern');
    // a motif reading (as Claude gave it for the owner's tie) gives the tie painter a tile
    const m=await p.evaluate(async()=>{const t=items[0];t.sett={v:3,motif:{grid:'diagonal',ground:'#20222b',figs:[{shape:'square',place:'cell',size:.5,cols:['#898d96']}]},cr:36,tr:40,a:45,src:'claude+pixels'};
      const f=await asmTieFor(t);return {usable:!!usableSett(t),motif:f.motif,tile:!!f.c&&f.TW>0,across:f.across}});
    ok(m.usable&&m.motif&&m.tile&&m.across===40,`with the reading the tie is painted from its motif (${JSON.stringify(m)})`);
    // the weave itself (a texture reading): kept and painted on a woven or tonal-check tie, a little stronger than on a shirt
    const x=await p.evaluate(async()=>{const tex={v:4,tex:{kind:'diamond',grid:['00011000','00100100','01000010','10000001','10000001','01000010','00100100','00011000'],aspect:1,lighter:true,contrast:'medium',rel:.35},a:0,cr:40,tr:32,src:'claude+pixels'};
      const tc={id:'tc',type:'tie',primaryColor:'black',secondaryColor:'charcoal',pattern:'tonal-check',sett:tex},st={id:'st',type:'tie',primaryColor:'navy',pattern:'stripe',sett:tex},
        sh={id:'sh',type:'shirt',primaryColor:'white',pattern:'dobby',sett:tex};
      const f=await asmTieFor(tc),spec={layout:'texture',texture:{kind:'diamond',grid:tex.tex.grid,raised:{hex:'#333333'},ground:{hex:'#111111'},contrast:'medium',aspect:1},repeatsInCloseup:40,repeatsAcrossItem:32};
      const fromSpec=specSett(spec,{type:'tie'}),dTie=fabricDef('a',tc,'tie','asmtie'),dPlain=fabricDef('b',tc,'tie');
      const tone=d=>(d.match(/fill="(#[0-9a-f]{6})"/)||[])[1];
      return {usable:[!!usableSett(tc),!!usableSett(st),!!usableSett(sh)],tile:!!f.c&&f.TW>0&&f.across===Math.min(32,ASM_TIE_FIG_MAX),spec:!!(fromSpec&&fromSpec.tex),
        stronger:tone(dTie)!==tone(dPlain),sig:asmTieSig(tc)!==asmTieSig({...tc,sett:null})}});
    ok(x.usable.join()==='true,false,true','a tonal-check tie keeps a weave reading; a striped tie does not (a shirt still does)');
    ok(x.spec&&x.tile,'Claude\'s weave answer becomes a tie reading, and the tie painter gets a tile repeated across the tie');
    ok(x.stronger&&x.sig,'on the model the weave is drawn stronger than in the app\'s swatch, and the reading is in the picture\'s key');
    // a twill (drawn by fabricDef's own twill branch) is strengthened on a tie too, and its ribs are no finer than ASM_TIE_TEX_MAX across
    const tw=await p.evaluate(async()=>{const s={v:4,tex:{kind:'twill',grid:['0001','0010','0100','1000'],aspect:1,lighter:true,contrast:'low',rel:.35},a:0,cr:60,tr:80,src:'claude+pixels'};
      const t={id:'bt',type:'tie',primaryColor:'burgundy',pattern:'woven',sett:s},op=d=>+((d.match(/stroke-opacity="([\d.]+)"/)||[])[1]||0);
      const f=await asmTieFor(t);return {stronger:op(fabricDef('a',t,'tie','asmtie'))>op(fabricDef('b',t,'tie')),across:f.across,max:ASM_TIE_TEX_MAX}});
    ok(tw.stronger&&tw.across===tw.max&&tw.max<80,`a twill tie's ribs are drawn stronger on the model and capped at ${tw.max} across (Claude counted 80)`);
    // on a phone the picture is shrunk ~1.75x: a figured weave repeats at most ASM_TIE_FIG_MAX across (a twill keeps ASM_TIE_TEX_MAX), and a
    // very dark tie's figured weave is drawn TIE_DARK_X stronger (the owner's black tonal check read flat black, 2026-11-13)
    const ph=await p.evaluate(async()=>{const dia={kind:'diamond',grid:['00011000','00100100','01000010','10000001','10000001','01000010','00100100','00011000'],aspect:1,lighter:true,contrast:'low',rel:.35};
      const black={id:'bk',type:'tie',primaryColor:'black',pattern:'tonal-check',sett:{v:4,tex:dia,a:0,cr:40,tr:32,src:'claude+pixels'}},grey={...black,id:'gy',primaryColor:'silver'};
      const tw={id:'tw',type:'tie',primaryColor:'black',pattern:'woven',sett:{v:4,tex:{...dia,kind:'twill',grid:['0001','0010','0100','1000']},a:0,cr:60,tr:80,src:'claude+pixels'}};
      const fb=await asmTieFor(black),ft=await asmTieFor(tw),lo=(i,ctx)=>(fabricDef('t',i,'tie',ctx).match(/fill="(#[0-9a-f]{6})"/)||[])[1];
      // the ground tone drawn on the model against the one each strength gives (the weave's light tone is inside the tile image)
      const want=(i,k)=>texTones(colOf(i),i.sett.tex,k)[0];
      return {fig:fb.across,twill:ft.across,max:[ASM_TIE_FIG_MAX,ASM_TIE_TEX_MAX],darkBoost:lo(black,'asmtie')===want(black,TIE_TEX_K*TIE_DARK_X)&&lo(black,'asmtie')!==want(black,TIE_TEX_K),lightPlain:lo(grey,'asmtie')===want(grey,TIE_TEX_K)}});
    ok(ph.fig===ph.max[0]&&ph.twill===ph.max[1]&&ph.max[0]<32,`a figured weave repeats at most ${ph.max[0]} times across a tie on the model (a twill ${ph.max[1]})`);
    ok(ph.darkBoost&&ph.lightPlain,"a very dark tie's weave is drawn stronger (TIE_DARK_X); a light tie's keeps the tie strength");
    ok(!errs.length,'no page errors: '+errs.join('; '));
  }finally{await browser.close()}
};

/* ---- was tests/tiewoven.test.js ---- */
// Ties: a "woven" pattern for textured solids (basket / oxford weave, micro-check, grenadine). It draws as a fine two-tone
// weave in the tie's two colours, counts as a solid for outfit rules, and the tagger knows it.
const tiewoven=async({ok,chromium,url,ROOT})=>{
  const browser=await chromium.launch();const p=await browser.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(()=>{const T=x=>({id:'t',type:'tie',primaryColor:'navy',secondaryColor:'blue',pattern:'solid',...x});
      const w=fabricDef('a',T({pattern:'woven'}),'tie'),s=fabricDef('b',T(),'tie'),w1=fabricDef('c',T({pattern:'woven',secondaryColor:null}),'tie');
      return {list:PATS_BY.tie.includes('woven'),alias:['Textured','basket weave','Basketweave','oxford','grenadine','micro check','woven'].map(x=>normPat('tie',x)).join(),
        draws:w!==s&&w.includes(COLORS.blue)&&w.includes(COLORS.navy),one:w1!==s&&!w1.includes(COLORS.blue),solidRule:patInfo(T({pattern:'woven'}),'tie')===null,
        lum:Math.round(tieLum(T({pattern:'woven'})))===Math.round(LUM(T())),label:desc(T({pattern:'woven'}))}});
    ok(r.list,'ties can be tagged woven');
    ok(r.alias==='woven,woven,woven,woven,woven,woven,woven',`textured, basket weave, oxford, grenadine and micro-check ties map to woven (${r.alias})`);
    ok(r.draws,'a woven tie with a second colour draws as a two-tone weave in both colours');
    ok(r.one,'without a second colour it draws a tone-on-tone weave');
    ok(r.solidRule&&r.lum,'for outfit rules it counts as a solid (no pattern clash, its brightness is the main colour)');
    ok(/woven/i.test(r.label),`it is named woven (${r.label})`);
    const src=require('./workersrc.js')();
    ok(/tie:\n\s*solid, woven \(a textured solid/.test(src),'the tagger is told about woven ties');
    // tonal check (e.g. black on charcoal glen check)
    const t=await p.evaluate(()=>{const T=x=>({id:'t',type:'tie',primaryColor:'black',secondaryColor:'charcoal',pattern:'tonal-check',...x});
      const d=fabricDef('d',T(),'tie'),chk=fabricDef('e',T({pattern:'check'}),'tie'),pi=patInfo(T(),'tie');
      return {list:PATS_BY.tie.includes('tonal-check'),alias:['tonal','Tone on tone','tonal glen check'].map(x=>normPat('tie',x)).join(),draws:d.includes(COLORS.charcoal)&&d!==chk,
        rule:pi&&pi.type==='check'&&pi.scale===1,label:desc(T())}});
    ok(t.list&&t.alias==='tonal-check,tonal-check,tonal-check','ties can be tagged tonal check (tonal, tone on tone, tonal glen check map to it)');
    ok(t.draws,'a tonal check draws as a tone-on-tone glen check in its two shades, unlike a plain check');
    ok(t.rule,'for outfit rules it is a small, subtle check (so it still avoids clashing checks)');
    ok(/tonal check/i.test(t.label),`it is named tonal check (${t.label})`);
    ok(/tonal-check \(a check or glen check woven in two close shades/.test(src)&&/PATTERN_LIST = \[[^\]]*'tonal-check'/.test(src),'the tagger is told about tonal checks and accepts them');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};

// the parts run one after another; one that throws is reported and the rest still run (each was its own file)
module.exports=async t=>{for(const [name,part] of [['tieweave',tieweave],['tiewoven',tiewoven]]){try{await part(t)}catch(e){t.ok(false,`threw (${name}): ${e.message}`)}}};
