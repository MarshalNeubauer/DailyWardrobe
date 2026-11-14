// The traced mannequins (mannequin.js, one pose per colour-coded master in mq/<kind>.js, made by tools/mq-trace.py): Today's figure
// takes the master of the day (asmCmKind) and draws it with the outfit's own fabrics, per part; the watch is always the master's steel
// watch; a striped jacket's lines get the painter's lift; no tie clip on a waistcoat day; WebKit-safe; about as quick to draw as the
// earlier figure; shipped in the app's cache (sw.js ASSETS), nothing fetched.
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const KINDS=['vest','suit','suit-open','shirt-tie','shirt-open'];   // the poses whose mannequin has shipped
module.exports=async({ok,chromium,url,ROOT})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(url);await p.waitForFunction(()=>window.appReady);
  try{
    await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      const sett={v:2,a:0,bands:[['#211d26',.47],['#2d282f',.03],['#211d26',.47],['#421320',.03]],cross:null,cr:4,tr:22,src:'claude+pixels'},
        spec={across:{bands:[{role:'ground',hex:'#211d26',w:.47},{role:'line',hex:'#9a979e',w:.03},{role:'ground',hex:'#211d26',w:.47},{role:'line',hex:'#6e2a3c',w:.03}]}};
      items=[I('suit','navy',{pattern:'pinstripe',secondaryColor:'grey',sett,patternSpec:spec}),I('shirt','pink'),I('tie','burgundy',{pattern:'polka-dot',secondaryColor:'white'}),I('tieclip','gold',{metal:'gold'}),
        I('watch','brown',{metal:'gold',band:'leather'}),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'gold'}),I('socks','navy'),I('pants','grey')];
      settings.workdays=[0,1,2,3,4];settings.blazerDays=[];settings.vestMode='always';weather={};dayRecs={};TODAY_OVERRIDE='2026-11-15T12:00:00';cache={};sel=new Date(2026,10,16);view={y:2026,m:10};show('today')});
    const outfit=k=>p.evaluate(k=>{const g=t=>items.find(i=>i.type===t),top=g('suit');
      return ({vest:{suitDay:true,top,bot:top,shirt:g('shirt'),tie:g('tie'),clip:g('tieclip'),watch:g('watch'),belt:g('belt'),vest:true},
        suit:{suitDay:true,top,bot:top,shirt:g('shirt'),tie:g('tie'),clip:g('tieclip'),watch:g('watch'),belt:g('belt'),vest:false},
        'suit-open':{suitDay:true,top,bot:top,shirt:g('shirt'),tie:null,clip:null,watch:g('watch'),belt:g('belt'),vest:false},
        'shirt-tie':{suitDay:false,top:null,bot:g('pants'),shirt:g('shirt'),tie:g('tie'),clip:g('tieclip'),watch:g('watch'),belt:g('belt'),vest:false},
        'shirt-open':{suitDay:false,top:null,bot:g('pants'),shirt:g('shirt'),tie:null,clip:null,watch:g('watch'),belt:g('belt'),vest:false}})[k]},k);
    for(const kind of KINDS){
      const o=await outfit(kind);
      const r=await p.evaluate(([o,kind])=>{const d=document.createElement('div');d.style.cssText='position:absolute;left:0;top:0;width:390px';d.innerHTML=figureSvg(o,'k-');document.body.appendChild(d);
        const s=d.querySelector('svg'),G=mqData(kind),pat=id=>s.querySelector(`pattern[id="k-${id}"]`),hasCol=(id,c)=>!!pat(id)&&pat(id).outerHTML.toLowerCase().includes(String(c).toLowerCase());
        const lap=G.parts.find(x=>x.id==='lapL'),watchFill=[...s.querySelectorAll('.fig-watch path')].map(e=>e.getAttribute('fill'));
        const out={kind:asmCmKind(o),vb:s.getAttribute('viewBox'),skin:!!s.querySelector('.fig-skin path'),handsOld:!!s.querySelector('.fig-hand-l,.fig-hand-r'),
          shirt:hasCol('shirt',colOf(o.shirt)),tie:!o.tie||(hasCol('tie',colOf(o.tie))&&!!s.querySelector('use[href="#k-bladeP"]')),
          suit:!o.top||hasCol('suitB','#211d26'),lapel:!lap||(pat('suitL')&&pat('suitL').getAttribute('patternTransform').includes(`rotate(${lap.rot})`)),
          watch:watchFill.length>3&&watchFill.every(c=>G.watch.some(b=>b.c===c))&&!s.innerHTML.includes(METAL_TONES.gold[1]),
          vest:!!s.querySelector('.fig-vest')===!!o.vest,clip:!!s.querySelector('.fig-clip')===!!(o.clip&&o.tie&&!o.vest&&G.clip),
          useInClip:!!s.querySelector('clipPath use'),fade:!!s.querySelector('[id$="gFade"]'),shade:!!s.querySelector('image.fig-shade'),
          legs:!G.legs||(G.legs.length===2&&G.legs.every((l,i)=>hasCol('leg'+i,colOf(o.bot))&&pat('leg'+i).getAttribute('patternTransform').includes(`rotate(${l.rot})`))&&!!s.querySelector('.fig-belt')&&s.querySelector('.fig-belt').getAttribute('fill')===colOf(o.belt)&&s.querySelectorAll('.fig-buckle path').length>2),
          open:!/-open$/.test(kind)||(!!s.querySelector('.fig-open')&&G.btn.length>0&&s.querySelectorAll('.fig-shirtbtn circle').length===G.btn.length*7),
          label:s.getAttribute('aria-label'),h:Math.round(s.getBoundingClientRect().height)};
        d.remove();return out},[o,kind]);
      ok(r.kind===kind&&r.vb==='0 0 390 390'&&r.h===390&&r.skin&&!r.handsOld&&r.shade&&!r.fade,`${kind}: the day's master is drawn as its traced mannequin, square like the painted picture (390x390, traced skin, no bottom fade)`);
      ok(r.suit&&r.shirt&&r.tie,`${kind}: every garment piece takes the item's own fabric (pattern ids kept; the tie's blade is bladeP)`);
      ok(r.lapel,`${kind}: the lapel's cloth is turned along the traced lapel`);
      ok(r.watch,`${kind}: the watch is the master's steel watch, whatever the item's metal (the painted picture's rule)`);
      ok(r.vest&&r.clip,`${kind}: the waistcoat shows on a waistcoat day, and the tie clip only off one (the painter's rule)`);
      ok(r.legs,`${kind}: the trousers take their cloth turned down each leg (the painter's leg flow), the belt its colour, the buckle the master's metal`);
      ok(r.open,`${kind}: an open collar is the master's own (.fig-open), its placket buttons drawn where the painter draws them`);
      ok(!r.useInClip,`${kind}: no <use> inside <clipPath> (WebKit-safe)`);
      ok(/^Torso wearing /.test(r.label),`${kind}: labelled with the outfit (${r.label})`);
      // the crop at the neck is clean (the owner, 2026-11-14: thin spikes stuck out sideways along the top edge, where a traced curve
      // overshot its corner): drawn at 2x on a magenta page, no row of the top 12 is wider than row 30, and the figure's edge only widens
      // going down
      const top=await p.evaluate(async kind=>{const svg=outfitMannequinSvg({kind,suit:{color:'#808080'},shirt:{color:'#c0c0c0'},tie:{color:'#404040'},bot:{color:'#606060'},bg:'#ff00ff',idPrefix:'t'+kind.replace(/-/g,'')+'-'})
          .replace('width="100%"','width="780" height="780"');
        const im=new Image();im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);await im.decode();const c=document.createElement('canvas');c.width=c.height=780;const g=c.getContext('2d');g.drawImage(im,0,0);
        const d=g.getImageData(0,0,780,40).data,span=y=>{let a=-1,b=-1;for(let x=0;x<780;x++){const o=(y*780+x)*4,bg=d[o]>200&&d[o+1]<60&&d[o+2]>200;if(!bg){if(a<0)a=x;b=x}}return [a,b]};
        const rows=[];for(let y=0;y<=30;y++)rows.push(span(y));const ref=rows[30];
        return {ok:rows.slice(0,12).every(([a,b])=>a>=ref[0]&&b<=ref[1])&&rows.every((r,y)=>y===0||(r[0]<=rows[y-1][0]+1&&r[1]>=rows[y-1][1]-1)),rows:[rows[0],rows[6],rows[30]].map(r=>r.join('-')).join(' ')}},kind);
      ok(top.ok,`${kind}: the figure leaves the top of the frame cleanly, no spikes along the crop (left-right at rows 0, 6, 30: ${top.rows})`);
      const gz=zlib.gzipSync(fs.readFileSync(path.join(ROOT,'mq',kind+'.js'))).length;
      ok(gz<48000,`${kind}: the pose ships at about 40 KB gzip (${(gz/1024).toFixed(1)} KB)`);
    }
    // the painter's stripe lift: the line takes Claude's named colour part of the way from the ground
    const lift=await p.evaluate(()=>{const s=items[0],l=figStripeLift(s),lum=h=>{const v=[1,3,5].map(k=>parseInt(h.slice(k,k+2),16));return .2126*v[0]+.7152*v[1]+.0722*v[2]};
      const o={suitDay:true,top:s,bot:s,shirt:items[1],tie:items[2],belt:items[6],vest:true},svg=figureSvg(o,'l-');
      return {grey:l.sett.bands[1][0],was:s.sett.bands[1][0],brighter:lum(l.sett.bands[1][0])>lum(s.sett.bands[1][0])+20&&lum(l.sett.bands[3][0])>lum(s.sett.bands[3][0]),ground:l.sett.bands[0][0]===s.sett.bands[0][0],
        inFig:svg.toLowerCase().includes(l.sett.bands[1][0]),plain:figStripeLift(items[1])===items[1]}});
    ok(lift.brighter&&lift.ground&&lift.inFig&&lift.plain,`a pinstripe's lines are lifted toward the reading's named colours as the painter draws them (${lift.was} -> ${lift.grey}); the ground and other cloths are unchanged`);
    // Today: a waistcoat day shows the mannequin when no painted picture is ready
    const t=await p.evaluate(()=>{const P=planFor();const k=Object.keys(P).find(k=>keyDate(k)>=new Date(2026,10,16)&&P[k].suitDay&&P[k].vest);sel=keyDate(k);renderToday();
      const c=document.querySelector('#mannequin-container');return {svg:!!c.querySelector(':scope > svg .fig-skin'),vest:!!c.querySelector('.fig-vest'),ids:new Set([...c.querySelectorAll('[id]')].map(e=>e.id)).size===c.querySelectorAll('[id]').length}});
    ok(t.svg&&t.vest&&t.ids,'Today draws a waistcoat day as the waistcoat mannequin');
    // two on a page don't share ids
    ok(await p.evaluate(()=>{const o=planFor()[key(sel)],a=figureSvg(o,'a-'),b=figureSvg(o,'b-'),A=new Set([...a.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));return ![...b.matchAll(/id="([^"]+)"/g)].some(m=>A.has(m[1]))}),'two figures on a page use distinct ids');
    // a day with no colour-coded master still gets the nearest mannequin (the earlier drawing is gone): no belt on a shirt day, no shirt
    const nm0=await p.evaluate(()=>{const g=t=>items.find(i=>i.type===t),r={};
      const a={suitDay:false,top:null,bot:g('pants'),shirt:g('shirt'),tie:null,belt:null,watch:g('watch')},b={suitDay:true,top:g('suit'),bot:g('suit'),shirt:null,tie:g('tie'),vest:false};
      for(const [n,o] of [['noBelt',a],['noShirt',b]]){const s=figureSvg(o,'n'+n+'-');r[n]={master:asmCmKind(o),kind:figKind(o),sq:/viewBox="0 0 390 390"/.test(s)&&s.includes('fig-skin')}}
      r.old=typeof outfitFigureSvg==='undefined';return r});
    ok(nm0.noBelt.master===null&&nm0.noBelt.kind==='shirt-open'&&nm0.noBelt.sq&&nm0.noShirt.master===null&&nm0.noShirt.kind==='suit'&&nm0.noShirt.sq&&nm0.old,
      `an outfit with no colour-coded master is drawn on the nearest mannequin (${JSON.stringify(nm0)}); the earlier drawing is gone`);
    // quick to draw: decoded and drawn on a 1170-pixel canvas (390 css px at 3x), median of 5, against the earlier figure's 25 ms here
    // (measured 2026-11-14 on this machine: the mannequin 24 ms; on a 4x-throttled phone 95-101 ms against the earlier figure's 107-124 ms)
    const sp=await p.evaluate(async()=>{const o=planFor()[key(sel)],neu=figureSvg(o,'s-');
      const t=async s=>{const c=document.createElement('canvas');c.width=1170;c.height=1200;const g=c.getContext('2d');const r=[];
        for(let i=0;i<5;i++){const x=s.replace('width="100%"','width="1170"').replace(/(id="|url\(#|href="#)([a-z]+-)/g,(m,a,b)=>a+'r'+i+b),t0=performance.now(),im=new Image();im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(x);await im.decode();g.drawImage(im,0,0);g.getImageData(0,0,1,1);r.push(performance.now()-t0)}
        return r.sort((a,b)=>a-b)[2]};
      const b0=performance.now(),built=figureSvg(o,'z-'),bms=performance.now()-b0;return {neu:await t(neu),bms}});
    ok(sp.neu<150&&sp.bms<20,`it draws within its budget (${sp.neu.toFixed(0)} ms, 150 allowed; its SVG built in ${sp.bms.toFixed(1)} ms)`);
    // shipped with the app: in the cache list and the page, nothing fetched for it
    const sw=fs.readFileSync(path.join(ROOT,'sw.js'),'utf8'),html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
    ok(['mannequin.js',...KINDS.map(k=>`mq/${k}.js`)].every(f=>sw.includes(`'${f}'`)&&html.includes(`src="${f}"`)),'the renderer and every shipped pose are app files (sw.js ASSETS, index.html)');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
module.exports.realPlanner=true;   // a waistcoat day from the real planner (vestMode 'always')
