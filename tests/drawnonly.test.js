// Settings → Outfit pictures → "Drawing only" (settings.pictures 'drawn'; photos.js picsDrawn, 2026-11-14, the owner: "build an option in
// settings to let the user turn off the painter and only use the mannequin"). The default is painted; with drawing only Today shows the
// traced mannequin (no painted picture, no kept outfit photo, no swatches), nothing is asked of the server for the pictures (watched on the
// network, from start-up too) and nothing is painted; switching back paints the day on screen at once and building ahead resumes; the
// choice syncs to a second device; the row reads well at 390 px in both themes.
// Fixtures: the colour-coded suit master and its masks at 512 (tests/fixtures/cm/suit/).
const fs=require('fs'),path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,settle})=>{
  const HOST='https://w.test/',FIX=path.join(__dirname,'fixtures','cm','suit');
  const browser=await chromium.launch();
  try{
    /* ---- one device, a mocked server holding the suit master ---- */
    const ctx=await browser.newContext({viewport:{width:390,height:844}});const log=[];let served={};
    await ctx.addInitScript(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','owner');self.ASM_CM_SIZE=512},HOST);
    await ctx.route(HOST+'**',route=>{const u=new URL(route.request().url()),k=u.searchParams.get('key');
      if(u.pathname==='/render'||u.pathname==='/blob')log.push(u.pathname+u.search);
      const j=(b,s=200)=>route.fulfill({status:s,contentType:'application/json',body:JSON.stringify(b)});
      if(u.pathname==='/render'&&u.searchParams.get('list'))return j({keys:Object.keys(served)});
      if(u.pathname==='/render'&&k)return served[k]?j(served[k]):j({error:'not found'},404);
      if(u.pathname==='/me')return j({id:'owner',role:'owner',name:'Owner',caps:null,used:{}});
      if(u.pathname==='/sync')return j({error:'busy'},503);   // (no sync: it would merge the in-memory wardrobe away)
      return j({ok:true})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const files=fs.readdirSync(FIX),names=files.map(f=>f.replace(/\.(png|jpg)$/,'').replace(/^mask-/,'mask/').replace(/^part-/,'part/'));
    const ck=await p.evaluate(ns=>ns.map(n=>HOOK.asmCmKey('suit',n)),names);
    files.forEach((f,i)=>{served[ck[i]]={sig:'asm/cm test',img:`data:image/${f.endsWith('.jpg')?'jpeg':'png'};base64,`+fs.readFileSync(path.join(FIX,f)).toString('base64'),model:'colormaster',t:1000}});
    // the default: painted pictures, and the start-up look at the server happens (the network watch sees it)
    await p.waitForFunction(()=>!HOOK.asmSyncing,null,{timeout:10000}).catch(()=>{});
    const d0=await p.evaluate(()=>({pictures:HOOK.settings.pictures,drawn:HOOK.picsDrawn()}));
    ok(d0.pictures===undefined&&d0.drawn===false&&log.some(l=>/list=1/.test(l)),`the default is painted pictures, and painted, start-up reads the server's list of pictures (${log.length} picture requests)`);
    // a suit wardrobe, its day's look painted on the suit master; an outfit photo kept for that very look from the retired photo path
    const wardrobe=()=>p.evaluate(()=>{let n=0;const I=(type,primaryColor,x={})=>({id:type+(n++),type,primaryColor,pattern:'solid',...x});
      HOOK.items=[I('watch','silver',{metal:'silver'}),I('suit','navy'),I('shirt','white'),I('tie','burgundy'),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
      for(const i of HOOK.items)if(HOOK.ITEM_PIC_TYPES.includes(i.type))HOOK.renderTried.add(HOOK.itemKey(i));   // (item pictures are their own feature, not the painter's)
      HOOK.settings.workdays=[1,2,3,4,5];HOOK.settings.blazerDays=[];HOOK.settings.vestMode='never';HOOK.dayRecs={};HOOK.weather={};HOOK.TODAY_OVERRIDE='2026-11-10T12:00:00';HOOK.cache={};HOOK.sel=new Date(2026,10,10);HOOK.view={y:2026,m:10};
      const o=HOOK.planFor()[HOOK.key(HOOK.sel)];HOOK.renders[HOOK.comboKey(o)]={sig:HOOK.comboSig(o),img:'data:image/jpeg;base64,/9j/KEPTPHOTO',model:'gpt',t:500};   // (older than the master: painting wins)
      window.__paint=0;window.__ahead=0;if(!window.__P0){window.__P0=HOOK.asmPhoto;window.__A0=HOOK.asmAhead}
      HOOK.asmPhoto=async(...a)=>{__paint++;return __P0(...a)};HOOK.asmAhead=async()=>{__ahead++};   // (building ahead counted, not run)
      HOOK.show('today')});
    // Settings (the wardrobe comes after the switch: painted, its first drawing would start painting): the choice is there for everyone, outside the Advanced fold
    await p.evaluate(()=>{document.body.classList.add('owner');HOOK.openSettings('photos')});await settle(p,300);
    const s1=await p.evaluate(()=>{const s=document.querySelector('#cfg-pictures');return {vis:!!(s&&s.offsetParent),inAdv:!!(s&&s.closest('.adv')),val:s&&s.value,opts:s&&[...s.options].map(o=>o.textContent).join('|'),
      help:document.querySelector('#pics-help').textContent,sum:document.querySelector('#sum-photos').textContent,adv:getComputedStyle(document.querySelector('#adv-photos')).display!=='none'}});
    ok(s1.vis&&!s1.inAdv&&s1.val==='painted'&&s1.opts==='Painted pictures|Drawing only'&&/^Painted pictures:/.test(s1.help)&&s1.sum==='Painted pictures'&&s1.adv,`Settings → Outfit pictures: "Painted pictures" or "Drawing only", for everyone (not in Advanced), painted chosen (${s1.opts}; “${s1.help}”)`);
    await p.selectOption('#cfg-pictures','drawn');await p.waitForFunction(()=>HOOK.settings.pictures==='drawn');await settle(p,200);
    const s2=await p.evaluate(async()=>({help:document.querySelector('#pics-help').textContent,sum:document.querySelector('#sum-photos').textContent,adv:getComputedStyle(document.querySelector('#adv-photos')).display,
      grp:document.querySelector('#asm-group').hidden,saved:((await HOOK.metaGet('settings'))||{}).pictures,stamp:!!(HOOK.settings.ks&&HOOK.settings.ks.pictures)}));
    ok(s2.help==='Drawing only: the outfit is drawn, nothing is downloaded or painted; faster and uses less data.'&&s2.sum==='Drawing only',`"Drawing only" says what it does in one line (“${s2.help}”), and the summary follows`);
    ok(s2.adv==='none'&&s2.grp,'the painter\'s own controls (Pictures ahead, Painted plain, the graphics-chip switch and its line) are hidden with it');
    ok(s2.saved==='drawn'&&s2.stamp,'the choice is saved with the settings and stamped for syncing setting by setting');
    // Today: the mannequin on its background, no kept photo, no swatches; nothing asked of the server, nothing painted
    log.length=0;await p.evaluate(()=>HOOK.closeSettings());await wardrobe();
    const t1=await p.evaluate(()=>{const c=document.querySelector('#mannequin-container');return {svg:!!c.querySelector(':scope > svg'),img:!!c.querySelector(':scope > img'),photo:c.classList.contains('photo'),sw:!!document.querySelector('.swstack'),share:!!document.querySelector('.wshare'),kept:!!HOOK.renders[HOOK.comboKey(HOOK.planFor()[HOOK.key(HOOK.sel)])]}});
    ok(t1.svg&&!t1.img&&!t1.photo&&!t1.sw&&t1.kept,`Today shows the traced mannequin, not the outfit photo kept for this look (still kept on the device), and no swatches (${JSON.stringify(t1)})`);
    ok(!t1.share,'there is no share button on Today to send anything else (it was removed 2026-11-14: a screenshot shares what is shown)');
    await p.evaluate(async()=>{HOOK.stepDay(1);HOOK.stepDay(1);HOOK.stepDay(-2);await HOOK.asmSync(true);await __A0();await HOOK.prefetchRenders();await HOOK.asmEnsure(HOOK.planFor()[HOOK.key(HOOK.sel)]);document.dispatchEvent(new Event('visibilitychange'))});
    await new Promise(r=>setTimeout(r,2500));   // (waiting to see that nothing happens)
    const t2=await p.evaluate(()=>({paint:__paint,ahead:__ahead,shown:!!HOOK.renderFor(HOOK.planFor()[HOOK.key(HOOK.sel)]),svg:!!document.querySelector('#mannequin-container > svg'),gap:HOOK.asmGapNote({type:'blazer',pattern:'other',primaryColor:'navy'})}));
    ok(t2.gap==='','the item sheet has no "Outfit pictures: painted plain" line either');
    ok(!log.length&&t2.paint===0&&!t2.shown&&t2.svg,`swiping, building ahead, the server look and prefetching ask the server for nothing and paint nothing (${log.length} requests: ${log.slice(0,3).join(' ')}; ${t2.paint} painted)`);
    // a restart with drawing only: not one picture request from start-up on
    log.length=0;await p.reload();await p.waitForFunction(()=>window.appReady);await new Promise(r=>setTimeout(r,2500));
    const r1=await p.evaluate(()=>({drawn:HOOK.picsDrawn()}));
    ok(r1.drawn&&!log.length,`after a restart it is still drawing only and start-up asks the server for no picture (${log.length}: ${log.slice(0,3).join(' ')})`);
    // back to painted pictures: the day on screen is painted at once (while Settings is still open), Today shows it when Settings closes,
    // building ahead starts again
    await wardrobe();log.length=0;
    await p.evaluate(()=>{document.body.classList.add('owner');HOOK.openSettings('photos')});await settle(p,300);
    await p.selectOption('#cfg-pictures','painted');
    await p.waitForFunction(()=>!!HOOK.asmFor(HOOK.planFor()[HOOK.key(HOOK.sel)]),null,{timeout:60000,polling:250});
    const b1=await p.evaluate(()=>({open:HOOK.settingsOpen(),pictures:HOOK.settings.pictures,adv:getComputedStyle(document.querySelector('#adv-photos')).display!=='none',help:document.querySelector('#pics-help').textContent,paint:__paint}));
    ok(b1.open&&b1.pictures==='painted'&&b1.adv&&/^Painted pictures:/.test(b1.help)&&b1.paint>=1&&log.some(l=>/key=/.test(l)),`switching back paints the day on screen at once, before Settings closes (${b1.paint} painted, ${log.length} picture requests); its controls come back`);
    await p.evaluate(()=>HOOK.closeSettings());
    const b2=await p.evaluate(()=>{const c=document.querySelector('#mannequin-container');return {img:!!c.querySelector(':scope > img'),src:(c.querySelector(':scope > img')||{}).src||'',sw:!!document.querySelector('.swstack')}});
    ok(b2.img&&/^blob:/.test(b2.src)&&b2.sw,`and Today shows the painted picture, with its swatches, as soon as Settings closes (no reload) (${b2.src.slice(0,5)})`);
    await p.waitForFunction(()=>__ahead>0,null,{timeout:5000}).catch(()=>{});
    ok(await p.evaluate(()=>__ahead>0),'building ahead starts again');
    ok(!errs.length,'no page errors: '+errs.join(' | '));
    await ctx.close();

    /* ---- two devices through the real worker: the choice follows the person ---- */
    const worker=(await import(pathToFileURL(path.join(__dirname,'..','worker.js')).href)).default;
    const store=new Map(),meta=new Map();
    const KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,put:async(k,v,o)=>{store.set(k,v);meta.set(k,o&&o.metadata)},delete:async k=>{store.delete(k)},
      list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name,metadata:meta.get(name)})),list_complete:true})};
    const env={APP_TOKEN:'secret',WARDROBE:KV},SRV='https://wardrobevision.test/';
    const device=async()=>{const c=await browser.newContext({viewport:{width:390,height:844}});
      await c.addInitScript(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','secret')},SRV);
      await c.route(SRV+'**',async route=>{const r=route.request();
        const res=await worker.fetch(new Request(r.url(),{method:r.method(),headers:r.headers(),body:['GET','HEAD'].includes(r.method())?undefined:r.postData()}),env);
        await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:await res.text()})});
      const q=await c.newPage();q.errs=[];q.on('pageerror',e=>q.errs.push(e.message));await q.goto(url);await q.waitForFunction(()=>window.appReady);return {c,q}};
    const A=await device(),B=await device(),sync=d=>d.q.evaluate(()=>HOOK.syncNow());
    await sync(A);await sync(B);
    await A.q.evaluate(()=>{HOOK.openSettings('photos')});await A.q.selectOption('#cfg-pictures','drawn');await A.q.waitForFunction(()=>HOOK.settings.pictures==='drawn');
    await A.q.evaluate(()=>HOOK.closeSettings());await sync(A);await sync(B);
    const sb=await B.q.evaluate(()=>{HOOK.openSettings('photos');const r={drawn:HOOK.picsDrawn(),val:document.querySelector('#cfg-pictures').value,sum:document.querySelector('#sum-photos').textContent};HOOK.closeSettings();return r});
    ok(sb.drawn&&sb.val==='drawn'&&sb.sum==='Drawing only',`"Drawing only" chosen on one device reaches the second one with a sync (${JSON.stringify(sb)})`);
    await B.q.evaluate(()=>{HOOK.settings.units='C';return HOOK.saveUserSettings()});await A.q.evaluate(()=>HOOK.setPictures('painted'));
    await sync(B);await sync(A);await sync(B);
    const both=await Promise.all([A,B].map(d=>d.q.evaluate(()=>[HOOK.settings.pictures,HOOK.settings.units].join())));
    ok(both[0]==='painted,C'&&both[1]==='painted,C',`switching back on the first device while the second changed another setting: both end painted and keep the other change (${both.join(' / ')})`);
    ok(!A.q.errs.length&&!B.q.errs.length,'no page errors on either device: '+[...A.q.errs,...B.q.errs].join(' | '));
    await A.c.close();await B.c.close();

    /* ---- the row at 390 px, light and dark ---- */
    const L=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),lp=await L.newPage();
    await lp.goto(url);await lp.waitForFunction(()=>window.appReady);
    const look=[];for(const theme of ['light','dark']){
      await lp.evaluate(t=>{document.documentElement.dataset.theme=t;HOOK.openSettings('photos')},theme);await settle(lp,400);
      look.push(await lp.evaluate(t=>{const lum=c=>{const [r,g,b]=c.match(/[\d.]+/g).slice(0,3).map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4});return .2126*r+.7152*g+.0722*b};
        const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)},bgOf=e=>{for(;e;e=e.parentElement){const c=getComputedStyle(e).backgroundColor;if(!/rgba\(0, 0, 0, 0\)|transparent/.test(c))return c}return 'rgb(255,255,255)'};
        const box=document.querySelector('#pics-box'),s=box.querySelector('select'),h=box.querySelector('#pics-help'),pan=document.querySelector('#sp-photos').getBoundingClientRect(),sr=s.getBoundingClientRect();
        return {t,first:box.parentElement.firstElementChild===box,h:Math.round(sr.height),inside:sr.left>=pan.left-1&&sr.right<=pan.right+1,wide:[...box.querySelectorAll('*')].filter(x=>x.getBoundingClientRect().right>innerWidth+1).length,
          over:document.querySelector('#settings-modal').scrollWidth-document.querySelector('#settings-modal').clientWidth,help:+ratio(getComputedStyle(h).color,bgOf(h)).toFixed(2),sel:+ratio(getComputedStyle(s).color,bgOf(s)).toFixed(2)}},theme))}
    const bad=look.filter(x=>!x.first||x.h<44||!x.inside||x.wide||x.over>0||x.help<4.5||x.sel<4.5);
    ok(!bad.length,`390 px, light and dark: the choice is the first row of Outfit pictures, a 44 px dropdown inside the card, nothing sideways, its text at least 4.5:1 (${look.map(x=>`${x.t} ${x.help}/${x.sel}`).join(', ')})${bad.length?' — '+JSON.stringify(bad[0]):''}`);
    await L.close();
  }finally{await browser.close()}
};
module.exports.assembled=true;   // tests assembled pictures (assemble.js): with them off there would be nothing to turn off
