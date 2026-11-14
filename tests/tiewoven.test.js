// Ties: a "woven" pattern for textured solids (basket / oxford weave, micro-check, grenadine). It draws as a fine two-tone
// weave in the tie's two colours, counts as a solid for outfit rules, and the tagger knows it.
const fs=require('fs'),path=require('path');
module.exports=async({ok,chromium,url,ROOT})=>{
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
    ok(/tonal-check \(a check or glen check woven in two close shades/.test(src)&&/'tonal-check'\]/.test(src),'the tagger is told about tonal checks and accepts them');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
