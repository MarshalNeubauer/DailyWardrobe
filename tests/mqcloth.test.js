// The painter's own cloth on Today's mannequin (draw.js figCloth, 2026-11-15, the owner approved the mockups in
// C:\code\audit-2026-11-13\mannequin-closeup\): a plain or fine-weave suit with a close-up takes the painter's block (asmCuTile), a
// herringbone the clean drawn herringbone H2, a near-black worsted the worsted tile B2, any dark non-striped cloth a lift of k x its
// tagged colour; a striped jacket is drawn exactly as before. The block is made in the background (drawn first, swapped after), written
// once per figure (pattern href inheritance), cached by item, colour, shade and close-up, and drawing only asks the network for nothing.
// Fixture close-up: tests/fixtures/suit-mink-closeup.png (as tests/twillswatch.test.js).
const fs=require('fs'),path=require('path');
const {pace}=require('./pace');
module.exports=async({ok,chromium,url})=>{
  const CU='data:image/png;base64,'+fs.readFileSync(path.join(__dirname,'fixtures','suit-mink-closeup.png')).toString('base64');
  const browser=await chromium.launch();const ctx=await browser.newContext({viewport:{width:390,height:900}});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(cu=>{let n=0;const I=(type,primaryColor,x={})=>({id:'q'+type+(n++),type,primaryColor,pattern:'solid',...x});
      const sett={v:2,a:0,bands:[['#211d26',.47],['#2d282f',.03],['#211d26',.47],['#421320',.03]],cross:null,cr:4,tr:22,src:'claude+pixels'},
        spec={across:{bands:[{role:'ground',hex:'#211d26',w:.47},{role:'line',hex:'#9a979e',w:.03},{role:'ground',hex:'#211d26',w:.47},{role:'line',hex:'#6e2a3c',w:.03}]}};
      window.__Q={tw:I('suit','deeptaupe',{pattern:'twill',texture:cu}),brown:I('suit','deeptaupe',{pattern:'twill',texture:cu,shade:-6}),hb:I('suit','charcoal',{pattern:'herringbone',texture:cu}),
        black:I('suit','black',{pattern:'twill',texture:cu}),pin:I('suit','navy',{pattern:'pinstripe',secondaryColor:'grey',sett,patternSpec:spec,texture:cu}),
        plain:I('suit','grey'),dark:I('pants','black'),light:I('pants','khaki',{texture:cu}),shirt:I('shirt','white'),tie:I('tie','burgundy')}},CU);
    // the rule per item
    const way=await p.evaluate(()=>{const Q=__Q,w=(i,z)=>{const r=HOOK.figWay(i,z);return r.way+(r.k!==1?'@'+r.k.toFixed(2):'')};
      return {tw:w(Q.tw,'jacket'),brown:w(Q.brown,'jacket'),hb:w(Q.hb,'jacket'),black:w(Q.black,'jacket'),pin:w(Q.pin,'jacket'),plain:w(Q.plain,'jacket'),dark:w(Q.dark,'trousers'),light:w(Q.light,'trousers'),
        y:{tw:HOOK.figLum(Q.tw),brown:HOOK.figLum(Q.brown),hb:HOOK.figLum(Q.hb),black:HOOK.figLum(Q.black)},url:HOOK.figWay({...Q.tw,texture:'tests/fixtures/suit-mink-closeup.png'},'jacket').way}});
    ok(way.tw==='block'&&way.light==='block',`a plain or fine-weave twill suit and plain trousers with a close-up take the painter's block (${way.tw}, ${way.light})`);
    ok(/^block@/.test(way.brown)&&way.y.brown<.035,`a dark one takes the block lifted (${way.brown}, tagged luminance ${way.y.brown.toFixed(4)})`);
    ok(/^hb/.test(way.hb),`a herringbone with a close-up takes the clean herringbone H2 (${way.hb})`);
    ok(/^wt@2\.[56]/.test(way.black),`a near-black worsted (its close-up turned down) takes the worsted tile B2, lifted about 2.6x (${way.black})`);
    ok(way.pin==='drawn'&&way.plain==='drawn',`a pinstripe (with a close-up) and a mid grey plain suit with none stay drawn (${way.pin}, ${way.plain})`);
    ok(/^lift@2\.[56]/.test(way.dark),`black trousers with no close-up keep the drawn tile, lifted (${way.dark})`);
    ok(way.url==='drawn',`a close-up that is not the item's own data (a link) is never fetched: drawn (${way.url})`);
    // the lift's k: linear between the calibration points, none from the painter's dark threshold
    const ks=await p.evaluate(()=>[.004,.008,.0155,.023,.030,.0325,.035,.2].map(y=>+HOOK.figLiftK(y).toFixed(3)));
    ok(ks.join()==='2.6,2.6,2.05,1.5,1.35,1.175,1,1',`the dark-cloth lift k: ${ks.join(', ')} (2.6 at .008, 1.5 at .023, 1.35 at .030, 1 from .035)`);
    // a striped jacket's figure is byte-identical to before (the drawn path, as figureSvg was)
    const same=await p.evaluate(()=>{const Q=__Q,old=(o,prefix)=>{const label=`Torso wearing ${[o.top&&nm(o.top)+(o.vest?' with matching vest':''),o.shirt&&nm(o.shirt)+(o.top?'':', no jacket')+(o.tie?'':', open collar'),o.tie&&nm(o.tie)].filter(Boolean).join(', ')}`;
        const clip=o.clip&&!o.vest?{color:colOf(o.clip)}:null,kind=HOOK.figKind(o),top=o.top&&HOOK.figStripeLift(o.top),bot=!o.top&&o.bot&&HOOK.figStripeLift(o.bot),shirt=HOOK.figFabric(o.shirt,'shirt')||HOOK.FIG_NO_SHIRT;
        const k=i=>{const s=i&&usableSett(i);return s&&s.bands&&s.bands.length>1&&STRIPE_PATS.includes(patBase(i.pattern))?1.6:1};
        return outfitMannequinSvg({kind,suit:top?HOOK.figFabric(top,'top'):shirt,shirt,tie:HOOK.figFabric(o.tie,'tie'),bot:bot?HOOK.figFabric(bot,'bot'):{color:'#4A4E55'},beltColor:o.belt?colOf(o.belt):'#3A2A22',vest:!!(o.vest&&o.top),clip,shirtColor:o.shirt?colOf(o.shirt):HOOK.FIG_NO_SHIRT.color,bg:HOOK.figBg(),idPrefix:prefix,ariaLabel:label,fab:{suit:k(top),shirt:1,tie:1,bot:k(bot)}})};
      const a={suitDay:true,top:Q.pin,bot:Q.pin,shirt:Q.shirt,tie:Q.tie,vest:true},b={suitDay:true,top:Q.plain,bot:Q.plain,shirt:Q.shirt,tie:Q.tie},c={suitDay:false,top:null,bot:Q.plain,shirt:Q.shirt,tie:Q.tie};
      return [a,b,c].map((o,i)=>figureSvg(o,'s'+i+'-')===old(o,'s'+i+'-'))});
    ok(same.every(Boolean),`a striped jacket (and a plain cloth with no close-up) draws byte-identical to before (${same.join()})`);
    // drawn first, in a millisecond or so; the block made in the background; the figure then written with it, the image once
    const k=await pace(p);   // (the 50 ms is at this machine's pace: tests/pace.js)
    const bg=await p.evaluate(async()=>{const Q=__Q,o={suitDay:true,top:Q.tw,bot:Q.tw,shirt:Q.shirt,tie:Q.tie,vest:true},t0=performance.now(),first=figureSvg(o,'b-'),ms=performance.now()-t0;
      const e=[...HOOK.FIG_CU.values()].pop();await e.p;const then=figureSvg(o,'b-'),d=document.createElement('div');d.innerHTML=then;
      const base=d.querySelector('pattern#b-cuT'),kids=[...d.querySelectorAll('pattern[href="#b-cuT"]')].length,G=mqData(HOOK.figKind(o));
      return {ms,first:!/cuT/.test(first)&&/id="b-suitB"/.test(first),imgs:(then.match(/<image href="data:image\/jpeg/g)||[]).length,base:!!(base&&base.querySelector('image')),kids,parts:G.parts.length+(G.parts.some(p=>p.id==='lapL')?0:2)+1,
        W:e.blk&&e.blk.W,N:e.blk&&e.blk.N,suitB:d.querySelector('#b-suitB').getAttribute('href'),bytes:e.blk&&e.blk.url.length}});
    ok(bg.first&&bg.ms<50*k,`the first drawing is the drawn tile, at once (${bg.ms.toFixed(1)} ms, ${(50*k).toFixed(0)} allowed at this machine's pace ×${k.toFixed(2)}; the block is not waited for)`);
    ok(bg.base&&bg.imgs===1&&bg.kids===bg.parts&&bg.suitB==='#b-cuT',`once made, one base pattern holds the block and every piece's pattern (${bg.kids} of ${bg.parts}: body, lapels, sleeves) inherits it: the image is written once (${bg.imgs}, ${(bg.bytes/1024).toFixed(1)} KB)`);
    ok(bg.W>40&&bg.W<120&&bg.N>=16&&bg.N<=256,`at the painter's repeat (${bg.W&&bg.W.toFixed(1)} units, ${bg.N} px from the figure's real width x DPR)`);
    // herringbone: two images (body and sleeves); its tile is the clean herringbone at the tagged colour's lifted mean
    const hb=await p.evaluate(async()=>{const Q=__Q,o={suitDay:true,top:Q.hb,bot:Q.hb,shirt:Q.shirt,tie:Q.tie};figureSvg(o,'h-');const e=[...HOOK.FIG_CU.values()].pop();await e.p;const s=figureSvg(o,'h-');
      const T=await asmCuTile(Q.hb),k=HOOK.figWay(Q.hb,'jacket').k,H=HOOK.figHbTile(T,k),n=H.TW*H.TH;let m=0;for(let j=0;j<n;j++)m+=HOOK.figY(H.t[3*j],H.t[3*j+1],H.t[3*j+2]);
      const W=asmWorstedTile(Q.black),kb=HOOK.figWay(Q.black,'jacket').k,B=HOOK.figNorm(W,kb);let mb=0;for(let j=0;j<n;j++)mb+=HOOK.figY(B.t[3*j],B.t[3*j+1],B.t[3*j+2]);
      return {imgs:(s.match(/<image href="data:image\/jpeg/g)||[]).length,sl:/id="h-cuTs"/.test(s),mean:m/n/HOOK.figLum(Q.hb)/k,bmean:mb/n/HOOK.figLum(Q.black)/kb,ribs:H.t[0]!==T.t[0]}});
    ok(hb.imgs===2&&hb.sl,`a herringbone writes two images: the body's and the sleeves' softer one (${hb.imgs})`);
    ok(Math.abs(hb.mean-1)<.01&&Math.abs(hb.bmean-1)<.01,`H2's and B2's tile means are held at k x the tagged colour (${hb.mean.toFixed(3)}, ${hb.bmean.toFixed(3)})`);
    // the cache keys follow the colour, the shade and the close-up (and the block variant)
    const keys=await p.evaluate(()=>{const Q=__Q,K=i=>{const w=HOOK.figWay(i,'jacket');return HOOK.figCuKey(i,w.way,w.k,1,3)},a=K(Q.tw);
      return {colour:K({...Q.tw,primaryColor:'brown'})!==a,shade:K({...Q.tw,shade:2})!==a,cu:K({...Q.tw,texture:Q.tw.texture+'AAAA'})!==a,same:K({...Q.tw})===a,v:a.includes(JSON.stringify(ASM_CU.v))}});
    ok(keys.colour&&keys.shade&&keys.cu&&keys.same,`a block's cache key changes with the colour, the shade and the close-up, not otherwise (${JSON.stringify(keys)})`);
    // rendered: the block's chest is the cloth's colour, not empty
    const px=await p.evaluate(async()=>{const Q=__Q,o={suitDay:true,top:Q.tw,bot:Q.tw,shirt:Q.shirt,tie:Q.tie,vest:true},s=figureSvg(o,'r-').replace('width="100%"','width="390" height="390"');
      const im=new Image();im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(s);await im.decode();const c=document.createElement('canvas');c.width=c.height=390;const g=c.getContext('2d');g.drawImage(im,0,0);
      const d=g.getImageData(250,160,20,20).data;let m=[0,0,0];for(let j=0;j<400;j++)for(let q=0;q<3;q++)m[q]+=d[4*j+q]/400;return m.map(Math.round)});
    ok(px.every(v=>v>8&&v<250),`the figure drawn as an image shows the block's cloth (chest ${px.join(',')})`);
    // the browser renders pattern href inheritance (size and image from the base; run under WebKit too, npm run test:webkit)
    const inh=await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=c.height=8;const g=c.getContext('2d');g.fillStyle='#ff0000';g.fillRect(0,0,8,8);g.fillStyle='#0000ff';g.fillRect(0,0,4,4);
      const s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><pattern id="b" width="20" height="20" patternUnits="userSpaceOnUse"><image href="${c.toDataURL('image/jpeg',.95)}" width="20" height="20" preserveAspectRatio="none"/></pattern><pattern id="k" href="#b" patternTransform="scale(1)"/></defs><rect width="100" height="100" fill="url(#k)"/></svg>`;
      const im=new Image();im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(s);await im.decode();const cv=document.createElement('canvas');cv.width=cv.height=100;const x=cv.getContext('2d');x.drawImage(im,0,0);
      const at=(X,Y)=>Array.from(x.getImageData(X,Y,1,1).data.slice(0,3));return {blue:at(25,5),red:at(35,15)}});
    ok(inh.blue[2]>200&&inh.blue[0]<60&&inh.red[0]>200&&inh.red[2]<60,`pattern href inheritance renders: the copy repeats the base's image at the base's size (${JSON.stringify(inh)})`);
    // Today: drawn first, then swapped in place once the block is made (drawing only: no request at all)
    const reqs=[];
    const td=await p.evaluate(()=>{const Q=__Q;HOOK.items=[Q.brown,Q.shirt,Q.tie,{id:'qshoes',type:'shoes',primaryColor:'black',leather:'calf'},{id:'qbelt',type:'belt',primaryColor:'black',leather:'calf',metal:'silver'},{id:'qsocks',type:'socks',primaryColor:'navy'}];
      settings.pictures='drawn';settings.workdays=[0,1,2,3,4];settings.blazerDays=[];settings.vestMode='never';HOOK.dayRecs={};HOOK.weather={};HOOK.TODAY_OVERRIDE='2026-11-16T12:00:00';HOOK.cache={};HOOK.sel=new Date(2026,10,16);HOOK.view={y:2026,m:10};
      HOOK.FIG_CU.clear();show('today');const c=document.querySelector('#mannequin-container'),s=c&&c.querySelector(':scope > svg');return {top:(planFor()[key(sel)]||{}).top&&planFor()[key(sel)].top.id,svg:!!s,cu:!!(s&&s.querySelector('pattern[id$="cuT"]'))}});
    p.on('request',r=>{if(!/^(data|blob):/.test(r.url()))reqs.push(r.url())});
    await p.waitForFunction(()=>{const s=document.querySelector('#mannequin-container > svg');return s&&s.querySelector('pattern#fig-cuT')},null,{timeout:15000}).catch(()=>{});
    const td2=await p.evaluate(()=>{const s=document.querySelector('#mannequin-container > svg');return {cu:!!(s&&s.querySelector('pattern#fig-cuT image')),one:s?s.querySelectorAll('pattern image').length:0}});
    ok(td.top==='qsuit1'&&td.svg&&!td.cu,`Today draws the mannequin at once with the drawn tile (lifted), not waiting (${td.top})`);
    ok(td2.cu&&td2.one===1,'then the figure is drawn again in place with the painter\'s block, once it is made');
    ok(!reqs.length,`drawing only: making and showing the block asks the network for nothing (${reqs.slice(0,3).join(', ')})`);
    // with Settings open the swap waits for it to close (todayStale)
    const st=await p.evaluate(async()=>{HOOK.FIG_CU.clear();renderToday();openSettings();const e=[...HOOK.FIG_CU.values()].pop();if(e)await e.p;const s=document.querySelector('#mannequin-container > svg'),was=!!(s&&s.querySelector('pattern#fig-cuT')),stale=HOOK.todayStale;
      closeSettings();const s2=document.querySelector('#mannequin-container > svg');return {was,stale,after:!!(s2&&s2.querySelector('pattern#fig-cuT'))}});
    ok(!st.was&&st.stale&&st.after,`with Settings open the figure is left alone and drawn with the block when Settings closes (${JSON.stringify(st)})`);
    ok(!errs.length,'no page errors: '+errs.join('; '));
  }finally{await browser.close()}
};
