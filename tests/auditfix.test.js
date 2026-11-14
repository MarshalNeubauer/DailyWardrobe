// Quick bugs from the 2026-11-13 audit: an item photo at PH_MAX (not the 800 px measuring copy), Confirm / Save all wait while Claude
// reads a card and no pattern call for a card that left the queue, the reminder's title, the sharp close-ups pruned, one Generate tap
// is one request, the Backup line inside agrees with its summary, the trousers row of the checklist, the Days off summary follows a
// change, the schedule summary from the week's first day.
const fs=require('fs'),path=require('path');
module.exports=async({ok,chromium,url})=>{
  const sw=fs.readFileSync(path.join(__dirname,'..','sw.js'),'utf8'),ac=fs.readFileSync(path.join(__dirname,'..','asm-color.js'),'utf8');
  ok(sw.includes("'Today’s outfit'")&&!/â€/.test(sw)&&/\$\{asmGapRun\.n\}…</.test(ac),'the reminder reads "Today’s outfit" (no garbled "â€" in sw.js) and Settings\' "Reading 1 of 3…" has its ellipsis');
  const browser=await chromium.launch();
  try{
    const p=await browser.newPage({viewport:{width:390,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    // the photo from the sharp copy
    const dims=await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=3000;c.height=2000;const x=c.getContext('2d');x.fillStyle='#345';x.fillRect(0,0,3000,2000);
      const q={raw:{big:shrink(c,800),full:shrink(c,TAG_MAX)},wb:null};cardPics(q);const im=new Image();im.src=q.photo;await im.decode();return [im.width,im.height,PH_MAX]});
    ok(dims[0]===dims[2]&&dims[1]===1024,`a new item's photo is ${dims[2]} px across, not the 800 px measuring copy (${dims[0]}×${dims[1]})`);
    // Confirm and Save all wait for Claude
    const r=await p.evaluate(async()=>{show('add');addManual();addManual();queue[0].refining=1;renderAdd();
      const conf=[...document.querySelectorAll('#add .btns button.pri')].map(b=>b.disabled),all=document.querySelector('#save-all button');
      const before=items.length;await save(0);await saveAll();const kept=queue.length,after=items.length;
      let called=0;const was=window.claudePattern;window.claudePattern=async()=>{called++;return null};
      const q={...queue[1],raw:{tex:document.createElement('canvas')},tagImg:'data:x',type:'tie',pattern:'stripe'};localStorage.setItem('worker_url','https://w.test/');
      await readPatternWithClaude(q);window.claudePattern=was;localStorage.removeItem('worker_url');
      queue[0].refining=0;renderAdd();const conf2=document.querySelector('#add .btns button.pri').disabled;queue.length=0;renderAdd();
      return {conf,all:all&&all.disabled,before,after,kept,called,conf2}});
    ok(r.conf[0]===true&&r.conf[1]===false&&r.all===true,`while Claude reads a card its Confirm and Save all are switched off, the other card's Confirm not (${JSON.stringify(r)})`);
    ok(r.before===r.after&&r.kept===2&&r.conf2===false,'save() and saveAll() save nothing meanwhile, and Confirm comes back once the reading is in');
    ok(r.called===0,'a card no longer in the queue (saved or skipped) sends no pattern request');
    // the kept sharp close-ups of deleted items go too
    const pr=await p.evaluate(async()=>{const was=items;items=[{id:'keep1',type:'tie',primaryColor:'navy',pattern:'solid'}];const c=await caches.open(TAGIMG_CACHE);for(const n of ['tagimg/gone1','closeimg/gone2','closeimg/keep1'])await c.put(new Request(n),new Response('x'));
      const n=await pruneTagImgs();items=was;const left=(await c.keys()).map(k=>k.url.replace(/^.*\/(\w+img\/)/,'$1'));return {n,left}});
    ok(pr.n===2&&pr.left.includes('closeimg/keep1')&&!pr.left.some(u=>/gone/.test(u)),`kept close-ups of deleted items are removed with the tagging copies (${JSON.stringify(pr)})`);
    // one Generate tap, one request
    let posts=0;await p.route('https://w.test/**',route=>{if(route.request().method()==='POST'){posts++;return route.fulfill({status:501,contentType:'application/json',body:JSON.stringify({error:'Add an OPENAI_API_KEY secret to the worker to generate realistic photos.'})})}return route.fulfill({status:404,contentType:'application/json',body:'{"error":"none"}'})});
    const g=await p.evaluate(async()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      items=[I('suit','navy'),I('shirt','lightblue'),I('tie','burgundy'),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
      const was=[typeof TODAY_OVERRIDE==='undefined'?undefined:TODAY_OVERRIDE,sel];
      settings.workdays=[0,1,2,3,4];dayRecs={};localStorage.setItem('worker_url','https://w.test/');localStorage.setItem('app_token','t');TODAY_OVERRIDE='2026-11-15T12:00:00';sel=new Date(2026,10,16);cache={};
      await generateRender();const out={msg:renderMsg.t,o:!!planFor()[key(sel)]};items=[];TODAY_OVERRIDE=was[0];sel=was[1];cache={};localStorage.removeItem('worker_url');return out});
    ok(posts===1,`a Generate tap that the server can't serve sends one request, not two (${posts}; "${g.msg}")`);
    await p.unroute('https://w.test/**');
    // the Backup line inside Settings while a backup runs
    const b=await p.evaluate(()=>{localStorage.setItem('worker_url','https://w.test/');localStorage.setItem('app_token','t');localStorage.setItem('last_sync',String(Date.now()));localStorage.removeItem('sync_status');syncing=true;openSettings('backup');const a=document.querySelector('#sync-status').textContent,s=document.querySelector('#sum-backup').textContent;
      syncing=false;localStorage.setItem('sync_status','Syncing…');showSyncStatus();const c=document.querySelector('#sync-status').textContent;for(const k of ['sync_status','worker_url','app_token','last_sync'])localStorage.removeItem(k);closeSettings();return {a,s,c}});
    ok(/^Backed up /.test(b.a)&&/^Backed up today$/.test(b.s)&&/^Backed up .* · syncing…$/.test(b.c),`the Backup line inside agrees with its summary while a backup runs (${JSON.stringify(b)})`);
    // the checklist's trousers row with jackets on and no suit
    const t=await p.evaluate(()=>{const was=items;items=[];const h=setupToday();items=was;const d=document.createElement('div');d.innerHTML=h;const li=d.querySelector('[data-need="pants"]');return li&&li.textContent});
    ok(/not needed with a suit/.test(t)&&/If no suit/.test(t)&&!/Needed/.test(t),`the trousers row isn't marked "Needed" beside "not needed with a suit" (${t})`);
    // the Days off summary follows an added day; the schedule summary starts with the week's first day
    const o=await p.evaluate(async()=>{openSettings('daysoff');const s0=document.querySelector('#sum-daysoff').textContent;const T=todayDate(),d=new Date(T.getFullYear(),T.getMonth(),T.getDate()+3);
      document.querySelector('#cfg-off-from').value=isoKey(d);await addDayOff();const s1=document.querySelector('#sum-daysoff').textContent;
      const w=settings.workdays;settings.workdays=[0,1,2,3,4];settingsSummaries();const a=document.querySelector('#sum-schedule').textContent;settings.workdays=[6,0];settingsSummaries();const c=document.querySelector('#sum-schedule').textContent;
      settings.workdays=[1,3,5];settingsSummaries();const e=document.querySelector('#sum-schedule').textContent;settings.workdays=w;closeSettings();return {s0,s1,a,c,e}});
    ok(/0 days off/.test(o.s0)&&/1 day off/.test(o.s1),`the Days off summary follows a day added (${o.s0} → ${o.s1})`);
    ok(/^Sun–Thu/.test(o.a)&&/^Sat, Sun/.test(o.c)&&/^Mon, Wed, Fri/.test(o.e),`the schedule summary starts with the week's first day (${o.a} | ${o.c} | ${o.e})`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
