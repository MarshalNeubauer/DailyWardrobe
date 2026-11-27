// The traced mannequins (mannequin.js, one pose per colour-coded master in mq/<kind>.js, made by tools/mq-trace.py): Today's figure
// takes the master of the day (asmCmKind) and draws it with the outfit's own fabrics, per part; the watch is always the master's steel
// watch; a striped jacket's lines get the painter's lift; no tie clip on a waistcoat day; WebKit-safe; about as quick to draw as the
// earlier figure; shipped in the app's cache (sw.js ASSETS), nothing fetched.
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const {pace}=require('./pace');
const KINDS=['vest','suit','suit-open','shirt-tie','shirt-open'];   // the poses whose mannequin has shipped
module.exports=async({ok,chromium,url,ROOT})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(url);await p.waitForFunction(()=>window.appReady);
  try{
    await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      const sett={v:2,a:0,bands:[['#211d26',.47],['#2d282f',.03],['#211d26',.47],['#421320',.03]],cross:null,cr:4,tr:22,src:'claude+pixels'},
        spec={across:{bands:[{role:'ground',hex:'#211d26',w:.47},{role:'line',hex:'#9a979e',w:.03},{role:'ground',hex:'#211d26',w:.47},{role:'line',hex:'#6e2a3c',w:.03}]}};
      HOOK.items=[I('suit','navy',{pattern:'pinstripe',secondaryColor:'grey',sett,patternSpec:spec}),I('shirt','pink'),I('tie','burgundy',{pattern:'polka-dot',secondaryColor:'white'}),I('tieclip','gold',{metal:'gold'}),
        I('watch','brown',{metal:'gold',band:'leather'}),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'gold'}),I('socks','navy'),I('pants','grey')];
      HOOK.settings.workdays=[0,1,2,3,4];HOOK.settings.blazerDays=[];HOOK.settings.vestMode='always';HOOK.weather={};HOOK.dayRecs={};HOOK.TODAY_OVERRIDE='2026-11-15T12:00:00';HOOK.cache={};HOOK.sel=new Date(2026,10,16);HOOK.view={y:2026,m:10};HOOK.show('today')});
    const outfit=k=>p.evaluate(k=>{const g=t=>HOOK.items.find(i=>i.type===t),top=g('suit');
      return ({vest:{suitDay:true,top,bot:top,shirt:g('shirt'),tie:g('tie'),clip:g('tieclip'),watch:g('watch'),belt:g('belt'),vest:true},
        suit:{suitDay:true,top,bot:top,shirt:g('shirt'),tie:g('tie'),clip:g('tieclip'),watch:g('watch'),belt:g('belt'),vest:false},
        'suit-open':{suitDay:true,top,bot:top,shirt:g('shirt'),tie:null,clip:null,watch:g('watch'),belt:g('belt'),vest:false},
        'shirt-tie':{suitDay:false,top:null,bot:g('pants'),shirt:g('shirt'),tie:g('tie'),clip:g('tieclip'),watch:g('watch'),belt:g('belt'),vest:false},
        'shirt-open':{suitDay:false,top:null,bot:g('pants'),shirt:g('shirt'),tie:null,clip:null,watch:g('watch'),belt:g('belt'),vest:false}})[k]},k);
    for(const kind of KINDS){
      const o=await outfit(kind);
      const r=await p.evaluate(([o,kind])=>{const d=document.createElement('div');d.style.cssText='position:absolute;left:0;top:0;width:390px';d.innerHTML=HOOK.figureSvg(o,'k-');document.body.appendChild(d);
        const s=d.querySelector('svg'),G=mqData(kind),pat=id=>s.querySelector(`pattern[id="k-${id}"]`),hasCol=(id,c)=>!!pat(id)&&pat(id).outerHTML.toLowerCase().includes(String(c).toLowerCase());
        const lap=G.parts.find(x=>x.id==='lapL'),watchFill=[...s.querySelectorAll('.fig-watch path')].map(e=>e.getAttribute('fill'));
        const out={kind:HOOK.asmCmKind(o),vb:s.getAttribute('viewBox'),skin:!!s.querySelector('.fig-skin path'),handsOld:!!s.querySelector('.fig-hand-l,.fig-hand-r'),
          shirt:hasCol('shirt',HOOK.colOf(o.shirt)),tie:!o.tie||(hasCol('tie',HOOK.colOf(o.tie))&&!!s.querySelector('use[href="#k-bladeP"]')),
          suit:!o.top||hasCol('suitB','#211d26'),lapel:!lap||(pat('suitL')&&pat('suitL').getAttribute('patternTransform').includes(`rotate(${lap.rot})`)),
          watch:watchFill.length>3&&watchFill.every(c=>G.watch.some(b=>b.c===c))&&!s.innerHTML.includes(HOOK.METAL_TONES.gold[1]),
          vest:!!s.querySelector('.fig-vest')===!!o.vest,clip:!!s.querySelector('.fig-clip')===!!(o.clip&&o.tie&&!o.vest&&G.clip),
          useInClip:!!s.querySelector('clipPath use'),fade:!!s.querySelector('[id$="gFade"]'),shade:!!s.querySelector('image.fig-shade'),
          legs:!G.legs||(G.legs.length===2&&G.legs.every((l,i)=>hasCol('leg'+i,HOOK.colOf(o.bot))&&pat('leg'+i).getAttribute('patternTransform').includes(`rotate(${l.rot})`))&&!!s.querySelector('.fig-belt')&&s.querySelector('.fig-belt').getAttribute('fill')===HOOK.colOf(o.belt)&&s.querySelectorAll('.fig-buckle path').length>2),
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
    const lift=await p.evaluate(()=>{const s=HOOK.items[0],l=HOOK.figStripeLift(s),lum=h=>{const v=[1,3,5].map(k=>parseInt(h.slice(k,k+2),16));return .2126*v[0]+.7152*v[1]+.0722*v[2]};
      const o={suitDay:true,top:s,bot:s,shirt:HOOK.items[1],tie:HOOK.items[2],belt:HOOK.items[6],vest:true},svg=HOOK.figureSvg(o,'l-');
      return {grey:l.sett.bands[1][0],was:s.sett.bands[1][0],brighter:lum(l.sett.bands[1][0])>lum(s.sett.bands[1][0])+20&&lum(l.sett.bands[3][0])>lum(s.sett.bands[3][0]),ground:l.sett.bands[0][0]===s.sett.bands[0][0],
        inFig:svg.toLowerCase().includes(l.sett.bands[1][0]),plain:HOOK.figStripeLift(HOOK.items[1])===HOOK.items[1]}});
    ok(lift.brighter&&lift.ground&&lift.inFig&&lift.plain,`a pinstripe's lines are lifted toward the reading's named colours as the painter draws them (${lift.was} -> ${lift.grey}); the ground and other cloths are unchanged`);
    // Today: a waistcoat day shows the mannequin when no painted picture is ready
    const t=await p.evaluate(()=>{const P=HOOK.planFor();const k=Object.keys(P).find(k=>HOOK.keyDate(k)>=new Date(2026,10,16)&&P[k].suitDay&&P[k].vest);HOOK.sel=HOOK.keyDate(k);HOOK.renderToday();
      const c=document.querySelector('#mannequin-container');return {svg:!!c.querySelector(':scope > svg .fig-skin'),vest:!!c.querySelector('.fig-vest'),ids:new Set([...c.querySelectorAll('[id]')].map(e=>e.id)).size===c.querySelectorAll('[id]').length}});
    ok(t.svg&&t.vest&&t.ids,'Today draws a waistcoat day as the waistcoat mannequin');
    // two on a page don't share ids
    ok(await p.evaluate(()=>{const o=HOOK.planFor()[HOOK.key(HOOK.sel)],a=HOOK.figureSvg(o,'a-'),b=HOOK.figureSvg(o,'b-'),A=new Set([...a.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));return ![...b.matchAll(/id="([^"]+)"/g)].some(m=>A.has(m[1]))}),'two figures on a page use distinct ids');
    // a day with no colour-coded master still gets the nearest mannequin (the earlier drawing is gone): no belt on a shirt day, no shirt
    const nm0=await p.evaluate(()=>{const g=t=>HOOK.items.find(i=>i.type===t),r={};
      const a={suitDay:false,top:null,bot:g('pants'),shirt:g('shirt'),tie:null,belt:null,watch:g('watch')},b={suitDay:true,top:g('suit'),bot:g('suit'),shirt:null,tie:g('tie'),vest:false};
      for(const [n,o] of [['noBelt',a],['noShirt',b]]){const s=HOOK.figureSvg(o,'n'+n+'-');r[n]={master:HOOK.asmCmKind(o),kind:HOOK.figKind(o),sq:/viewBox="0 0 390 390"/.test(s)&&s.includes('fig-skin')}}
      r.old=typeof outfitFigureSvg==='undefined';return r});
    ok(nm0.noBelt.master===null&&nm0.noBelt.kind==='shirt-open'&&nm0.noBelt.sq&&nm0.noShirt.master===null&&nm0.noShirt.kind==='suit'&&nm0.noShirt.sq&&nm0.old,
      `an outfit with no colour-coded master is drawn on the nearest mannequin (${JSON.stringify(nm0)}); the earlier drawing is gone`);
    // quick to draw: decoded and drawn on a 1170-pixel canvas (390 css px at 3x), median of 5, against the earlier figure's 25 ms here
    // (measured 2026-11-14 on this machine: the mannequin 24 ms; on a 4x-throttled phone 95-101 ms against the earlier figure's 107-124 ms)
    // (the office is in the pose's data, so the SVG drawn as an image has it: its decode is part of the time)
    // (the 150 ms is this machine's when quiet; times how much slower the machine running it is right now, tests/pace.js: GitHub's 4-core
    // runner took 217 ms against a flat 150, CR-10-03)
    const k=await pace(p);
    const sp=await p.evaluate(async()=>{const o=HOOK.planFor()[HOOK.key(HOOK.sel)],neu=HOOK.figureSvg(o,'s-');
      const t=async s=>{const c=document.createElement('canvas');c.width=1170;c.height=1200;const g=c.getContext('2d');const r=[];
        for(let i=0;i<5;i++){const x=s.replace('width="100%"','width="1170"').replace(/(id="|url\(#|href="#)([a-z]+-)/g,(m,a,b)=>a+'r'+i+b),t0=performance.now(),im=new Image();im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(x);await im.decode();g.drawImage(im,0,0);g.getImageData(0,0,1,1);r.push(performance.now()-t0)}
        return r.sort((a,b)=>a-b)[2]};
      const b0=performance.now(),built=HOOK.figureSvg(o,'z-'),bms=performance.now()-b0;return {neu:await t(neu),bms}});
    ok(sp.neu<150*k&&sp.bms<20*k,`it draws within its budget (${sp.neu.toFixed(0)} ms, ${(150*k).toFixed(0)} allowed: 150 at this machine's pace ×${k.toFixed(2)}; its SVG built in ${sp.bms.toFixed(1)} ms)`);
    // the office behind the figure, as in the painted pictures (the owner, 2026-11-14): a small copy of the painter's background with the
    // pose's own soft wall shadow baked in, and nothing of the mannequin's own on the wall (its shading used to tint it); both themes
    const bg=await p.evaluate(async kinds=>{const out={},px={};
      const load=src=>new Promise(r=>{const im=new Image();im.onload=()=>r(im);im.onerror=()=>r(null);im.src=src});
      const pixels=im=>{const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const g=c.getContext('2d');g.drawImage(im,0,0);return g.getImageData(0,0,c.width,c.height).data};
      for(const kind of kinds){const G=mqData(kind),svg=outfitMannequinSvg({kind,suit:{color:'#808080'},shirt:{color:'#c0c0c0'},tie:{color:'#404040'},bot:{color:'#606060'},idPrefix:'w'+kind.replace(/-/g,'')+'-'});
        const d=new DOMParser().parseFromString(svg,'image/svg+xml').documentElement,top=[...d.children].filter(e=>e.tagName!=='defs');
        const off=await load(G.office);if(off)px[kind]=pixels(off);
        // the wall only: the figure without the office, drawn on a canvas: its corners (wall) stay clear
        const bare=svg.replace(/<image class="fig-office"[^>]*\/>/,'').replace('width="100%"','width="390" height="390"');
        const im=await load('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(bare));const c=document.createElement('canvas');c.width=c.height=390;const g=c.getContext('2d');g.drawImage(im,0,0);
        const wall=[[4,4],[385,4],[4,200],[385,200]].map(([x,y])=>g.getImageData(x,y,1,1).data[3]);
        out[kind]={first:!!off&&off.naturalWidth===200&&G.office.length<6000&&top[0]&&top[0].getAttribute('class')==='fig-office'&&top[0].getAttribute('href')===G.office,
          noWall:!top.some(e=>e.tagName==='rect')&&wall.every(a=>a===0),wall:wall.join(',')}}
      // the shadow follows the pose: two poses' offices match far from both figures (top left) and differ where one throws its shadow
      const a=px.vest,b=px['shirt-tie'];let corner=0,most=0;
      for(let y=0;y<200;y++)for(let x=0;x<200;x++){const i=4*(y*200+x),dd=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);if(x<12&&y<12)corner=Math.max(corner,dd);most=Math.max(most,dd)}
      out.shadow={corner,most,depth:kinds.map(k=>mqData(k).wallShadow)};return out},KINDS);
    for(const kind of KINDS){ok(bg[kind].first,`${kind}: the office is behind the figure, a 200-pixel picture in the pose's data (no fetch: offline with the pose)`);
      ok(bg[kind].noWall,`${kind}: the mannequin itself has no opaque wall layer: outside the figure it is clear (corner alpha ${bg[kind].wall})`)}
    ok(bg.shadow.corner<=12&&bg.shadow.most>=30&&bg.shadow.depth.every(v=>v>.18&&v<=.22),`each pose's soft wall shadow is in its office (22% deep as the painter's: ${bg.shadow.depth}; poses differ by up to ${bg.shadow.most}, top left ${bg.shadow.corner})`);
    const dk=await p.evaluate(async()=>{const was=document.documentElement.dataset.theme;document.documentElement.dataset.theme='dark';HOOK.figBgMemo=null;HOOK.renderToday();
      const c=document.querySelector('#mannequin-container'),im=c&&c.querySelector(':scope > svg image.fig-office'),dark=getComputedStyle(document.body).backgroundColor;
      document.documentElement.dataset.theme=was||'';HOOK.figBgMemo=null;HOOK.renderToday();return {office:!!im&&/^data:image\/jpeg/.test(im.getAttribute('href')),dark}});
    ok(dk.office,`the dark theme shows the office too, as the painted pictures do (page ${dk.dark})`);
    // shipped with the app: in the cache list and the page, nothing fetched for it
    const sw=fs.readFileSync(path.join(ROOT,'sw.js'),'utf8'),html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
    ok(['mannequin.js',...KINDS.map(k=>`mq/${k}.js`)].every(f=>sw.includes(`'${f}'`)&&html.includes(`src="${f}"`)),'the renderer and every shipped pose are app files (sw.js ASSETS, index.html)');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
module.exports.realPlanner=true;   // a waistcoat day from the real planner (vestMode 'always')
