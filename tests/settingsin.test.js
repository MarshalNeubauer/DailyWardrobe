// Settings coming in (fix round A, 2026-11-17, the code review's Critical C1 = CR-2-02 + CR-4-01 + CR-7-02): a Restore file, a sync or a
// holiday list whose own color key or hex, holiday or day-off date or hidden What to buy key carries a quote ran as script in Settings and
// What to buy. Both locks are tested the way a person meets them: (1) core.js cleanSettings on every way in (the real Restore file input,
// the stored copy at start-up, the holiday list) leaves those entries out and keeps the person's own; (2) the three lists keep their values
// in data-* attributes, so even a value that got past the check runs nothing when its checkbox, × or button is tapped. Payloads call
// window.__rx(name), which only records the name; an <img data-rx> means markup got in.
module.exports=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},locale:'en-US'});
    await ctx.addInitScript(()=>{window.__rxs=[];window.__rx=n=>window.__rxs.push(String(n))});
    // Nager.Date's answer for any year: one crafted date, one good holiday on Dec 2
    await ctx.route('https://date.nager.at/**',r=>{const m=r.request().url().match(/PublicHolidays\/(\d+)\//),y=m?m[1]:'2026';
      r.fulfill({contentType:'application/json',body:JSON.stringify([{date:`${y}-12-01" onclick="__rx('nager')" x="`,name:'Bad Day',global:true,types:['Public']},{date:`${y}-12-02`,name:'Good Day <b>',global:true,types:['Public']}])})});
    await ctx.route('https://api.open-meteo.com/**',r=>r.abort());
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept().catch(()=>{}));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const iso=n=>{const d=new Date(Date.now()+n*864e5);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
    const H1=iso(30),D1=iso(40),T=Date.now()-864e5;
    const S=n=>`');__rx('${n}');('`,B=n=>`" onclick="__rx('${n}')" x="`,IMG=n=>`"><img data-rx src=x onerror="__rx('${n}')">`;
    const crafted=()=>({workdays:[0,1,2,3,4],blazerDays:[4],updated:T,
      custom:{colors:[{key:'ownplum',name:'Plum',hex:'#5b2a4a'+IMG('hex'),base:'purple',types:['tie'],accent:false},{key:'ownx'+IMG('key'),name:'Ex',hex:'#112233',base:'navy',types:['tie'],accent:false},
        {key:'ownsage',name:'Sage',hex:'#8a9a7b',base:'green',types:['tie'],accent:false}],
        patterns:[{key:'own-y'+IMG('patkey'),name:'Why',base:'solid',types:['tie'],desc:''},{key:'own-weave',name:'Weave',base:'solid',types:'tie',desc:'a fine weave'}]},
      holidays:{country:'KW',list:[{d:'2099-01-01'+B('holiday'),n:'Planted'},{d:H1,n:'National Day'}],skip:[],fetched:Date.now()},
      daysOff:[{d:'2099-02-02'+S('dayoff'),n:'Off'},{d:D1,n:'Trip'}],
      shopSkip:['suit|grey|plain'+S('shopskip'),'tie|green|plain'],
      tagStats:{n:IMG('stats'),wrong:{type:1}}});
    // ---- core.js cleanSettings: the app's own settings come out as the same object; crafted entries are left out, the rest kept
    const u=await p.evaluate(c=>{const own={workdays:[0,1,2,3,4],blazerDays:[4],units:'C',vestMode:'auto',updated:5,location:{name:'Kuwait City',lat:29.37,lon:47.98,cc:'KW'},
        custom:{colors:[{key:'ownsage',name:'Sage',hex:'#8a9a7b',base:'green',types:['tie','shirt'],accent:true}],patterns:[{key:'own-weave2',name:'Weave 2',base:'solid',types:['tie'],desc:'a fine weave',look:{layout:'texture',tr:3,tex:{grid:['1010','0101'],lighter:'second'}}}]},
        holidays:{country:'KW',list:[{d:'2026-12-01',n:'Eid al-Fitr, Arafat Day'}],skip:['2026-12-01'],fetched:1},daysOff:[{d:'2026-12-07',n:'Trip ‏'}],shopSkip:['tie|green|plain','shoes|oxblood|smooth'],
        ownMaterials:{shirt:['cupro']},tagStats:{n:3,wrong:{type:1}},tagFixes:[{field:'pattern',type:'tie',from:'solid',to:'woven',id:'a1',t:1}],care:{suit:5},dress:{jacket:true,tie:false},laundryDays:1,darkShirts:'some',pictures:'drawn',
        ks:{workdays:5},kh:{workdays:'abc'},kse:{shopSkip:{'':5}},khe:{shopSkip:{'#':'x'}}};
      const x=HOOK.cleanSettings(own),cs=HOOK.cleanSettings(c),st=HOOK.cleanState({items:[],days:[],tombstones:{},settings:c}).settings;
      let shown=null;const was=HOOK.settings;try{HOOK.settings=HOOK.takeSettings({...HOOK.settings,workdays:[0,1,2,3,4]},{workdays:'x<b>',custom:{colors:{}},updated:9});HOOK.applyCustom(HOOK.settings.custom);shown=JSON.stringify(HOOK.settings.workdays)}catch(e){shown='threw '+e.message}finally{HOOK.settings=was;HOOK.applyCustom(HOOK.settings.custom)}
      return {same:x===own,again:HOOK.cleanSettings(cs)===cs,state:JSON.stringify(st)===JSON.stringify(cs),cols:cs.custom.colors.map(c=>c.key).join(),pats:cs.custom.patterns.map(p=>p.key+':'+JSON.stringify(p.types)).join(),
        hol:cs.holidays.list.map(h=>h.d).join(),off:cs.daysOff.map(h=>h.d).join(),skip:cs.shopSkip.join(),n:cs.tagStats.n,upd:cs.updated,shown,
        markup:JSON.stringify(cs).includes('__rx')}},crafted());
    ok(u.same,'the app\'s own settings (own colors and patterns with a look, holidays, days off, hidden ideas, materials, stamps…) come out of cleanSettings as the same object: nothing is restamped');
    ok(u.again&&u.state,'a cleaned copy is clean (a second pass returns it as it is), and cleanState cleans a snapshot\'s settings the same way');
    ok(u.cols==='ownsage'&&u.pats==='own-weave:[]'&&u.hol===H1&&u.off===D1&&u.skip==='tie|green|plain'&&u.n===0&&u.upd===T&&!u.markup,
      `crafted entries are left out and the person's own kept: colors ${u.cols}, patterns ${u.pats}, holidays ${u.hol}, days off ${u.off}, hidden ${u.skip}, tagging count ${u.n}`);
    ok(u.shown==='[0,1,2,3,4]','a setting of the wrong shape coming in leaves the phone\'s own (workdays), and own colors that aren\'t a list no longer stop the start-up ('+u.shown+')');
    // ---- the real Restore file input, with a wardrobe big enough for What to buy
    const file=require('path').join(require('os').tmpdir(),'dw-settingsin-'+process.pid+'.json');
    let k=0;const I=(type,primaryColor,x={})=>({id:'r'+type+(k++),type,primaryColor,pattern:'solid',added:T,updated:T,...x});
    const its=[I('suit','navy'),I('suit','charcoal'),I('blazer','navy'),I('pants','grey'),I('shirt','lightblue'),I('shirt','pink'),I('shirt','white'),I('shirt','lavender'),I('shirt','white',{pattern:'stripe',secondaryColor:'blue'}),
      I('tie','burgundy'),I('tie','navy'),I('tie','green'),I('tie','silver'),I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
    require('fs').writeFileSync(file,JSON.stringify({app:'daily-wardrobe',version:1,items:its,days:[],tombstones:{},settings:crafted()}));
    await p.waitForSelector('#su-skip',{state:'visible',timeout:4000}).catch(()=>{});
    if(await p.locator('#su-skip').isVisible().catch(()=>false)){await p.click('#su-skip');await settle(p,400)}   // a fresh phone starts in the setup
    await p.click('button[aria-label="Settings"]');await settle(p,300);
    await p.click('#sc-backup .scat-head');await settle(p,300);
    await p.setInputFiles('#sp-backup input[type=file]',file);
    await p.waitForFunction(()=>/Restored/.test(document.querySelector('#toast').textContent)&&HOOK.settings.daysOff&&HOOK.settings.daysOff.length);require('fs').unlinkSync(file);
    await p.click('#sc-daysoff .scat-head');await settle(p,300);await p.click('#sc-tagging .scat-head');await settle(p,300);
    const r1=await p.evaluate(()=>({hits:[...new Set(__rxs)],marks:document.querySelectorAll('[data-rx]').length,hol:[...document.querySelectorAll('#holiday-list input')].map(c=>c.dataset.d),
      off:[...document.querySelectorAll('#off-list button')].map(b=>b.dataset.ds),cust:[...document.querySelectorAll('#custom-list .custrow')].map(r=>r.textContent.replace(/\s+/g,' ').trim()),
      inline:[...document.querySelectorAll('#holiday-list [onchange],#holiday-list [onclick],#off-list [onclick],#custom-list .custrow [onclick]')].length}));
    ok(!r1.hits.length&&!r1.marks,`after the Restore, Settings draws its lists and nothing runs (${r1.hits.join()||'no script'}, ${r1.marks} markup)`);
    ok(r1.hol.join()===H1&&r1.off.join()===D1&&r1.cust.length===2&&/Sage/.test(r1.cust[0])&&/Weave/.test(r1.cust[1])&&!r1.inline,
      `Days off lists the file's own holiday and day off, and Your colors & patterns its Sage and Weave, with no inline handler (${r1.cust.join(' | ')})`);
    // tapping them works as before
    await p.locator('#holiday-list input').first().uncheck();await p.waitForFunction(h=>HOOK.settings.holidays.skip.includes(h),H1);
    await p.click('#off-list .fchip button');await p.waitForFunction(()=>!(HOOK.settings.daysOff||[]).length);
    await p.click('#custom-list .custrow:has-text("Weave") button');await p.waitForFunction(()=>!HOOK.settings.custom.patterns.length);
    ok(await p.evaluate(()=>!__rxs.length&&HOOK.settings.custom.colors.length===1&&!!HOOK.COLORS.ownsage),'unticking the holiday, the day off\'s × and Remove do what they say (CR-7-02, CR-2-02)');
    // ---- What to buy: the file's hidden idea comes back with Show again
    await p.evaluate(()=>HOOK.closeSettings());await settle(p,300);await p.click('#n-stats');await settle(p,300);
    ok(await p.evaluate(()=>!__rxs.length&&!document.querySelector('#stats [data-rx]')&&/Photo tagging/.test(document.querySelector('#stats').textContent)),'Insights draws the tagging card from the file\'s settings with nothing running');
    await p.evaluate(()=>{const rec={key:'tie|green|plain',name:'green tie',tier:'variety',why:['Adds a color','And another'],items:[{id:'n1',type:'tie',primaryColor:'green',pattern:'solid'}],samples:[]};
      HOOK.shop={sig:HOOK.shopSig(),at:Date.now(),res:{v:2,cats:[{key:'tie',title:'Ties',verdict:'worth',own:null,notes:[],recs:[rec]}],top:[],occasions:[],base:{idle:[],days:100,avg:95,looks:10,problems:0,rest:0},months:6,checked:10,sims:3}}});
    await p.click('#shop-btn');await p.waitForSelector('#shop-c-hidden button');
    const hid=await p.evaluate(()=>[...document.querySelectorAll('#shop-c-hidden button')].map(b=>[b.dataset.unhide,b.getAttribute('onclick')]));
    await p.click('#shop-c-hidden button');await p.waitForFunction(()=>!(HOOK.settings.shopSkip||[]).length&&[...document.querySelectorAll('#shop-sheet .shop-rec')].some(e=>e.dataset.key==='tie|green|plain'));
    ok(JSON.stringify(hid)==='[["tie|green|plain",null]]'&&!await p.evaluate(()=>__rxs.length),`What to buy lists only the file's own hidden idea, and Show again brings it back (CR-4-01: ${JSON.stringify(hid)})`);
    // ---- the second lock: a value that got past the check (put straight into memory) runs nothing when tapped
    const lock=await p.evaluate(async([ks,hd,od])=>{const W=window.Worker;window.Worker=function(u,o){return /analysis-worker/.test(u)?{postMessage(){},terminate(){}}:new W(u,o)};   // (the real analyzeWardrobe runs; its worker is a stand-in that never answers)
      try{HOOK.settings.shopSkip=[ks];HOOK.renderShop();document.querySelector('#shop-c-hidden button').click();await new Promise(r=>setTimeout(r,200));
        const shopOut=!(HOOK.settings.shopSkip||[]).length;HOOK.closeShop();
        HOOK.settings.holidays={...HOOK.settings.holidays,list:[{d:hd,n:'Crafted'}],skip:[]};HOOK.settings.daysOff=[{d:od,n:'Crafted'}];
        HOOK.openSettings('daysoff');await new Promise(r=>setTimeout(r,300));document.querySelector('#holiday-list input').click();await new Promise(r=>setTimeout(r,200));
        const holSkip=HOOK.settings.holidays.skip[0]===hd;document.querySelector('#off-list button').click();await new Promise(r=>setTimeout(r,200));
        return {hits:__rxs.slice(),shopOut,holSkip,offOut:!HOOK.settings.daysOff.length}}finally{window.Worker=W;HOOK.shopWorker=null;HOOK.shopBusy=null;HOOK.closeSettings()}},['suit|grey|plain'+S('lock-shop'),H1+S('lock-hol'),H1+S('lock-off')]).catch(e=>({err:String(e)}));
    ok(lock&&!lock.err&&!(lock.hits||[]).length&&lock.shopOut&&lock.holSkip&&lock.offOut,'a crafted key or date in memory reaches its handler as plain data: nothing runs, and Show again, the checkbox and × act on that exact value ('+JSON.stringify(lock)+')');
    // ---- start-up: a copy stored before the check is cleaned once, its original kept, and the person told
    await p.evaluate(async c=>{const s={...HOOK.settings,...c,ks:undefined,kh:undefined,kse:undefined,khe:undefined};for(const k of ['ks','kh','kse','khe'])delete s[k];
      await HOOK.metaPut('settings',s);localStorage.removeItem('set_clean')},crafted());
    await p.reload();await p.waitForFunction(()=>window.appReady);
    await p.waitForFunction(()=>localStorage.getItem('set_clean')==='1',null,{timeout:10000});
    const st=await p.evaluate(async()=>{const s=await HOOK.metaGet('settings'),kept=await HOOK.metaGet('set_kept')||[];
      for(let i=0;i<40&&!/couldn’t be shown safely/.test(document.querySelector('#toast').textContent);i++)await new Promise(r=>setTimeout(r,100));
      return {stored:JSON.stringify(s).includes('__rx'),mem:JSON.stringify(HOOK.settings).includes('__rx'),kept:kept.length===1&&JSON.stringify(kept[0].rec).includes('__rx'),
        own:HOOK.settings.daysOff.map(d=>d.d).join()+'/'+HOOK.settings.custom.colors.map(c=>c.key).join(),toast:document.querySelector('#toast').textContent}});
    ok(!st.stored&&!st.mem&&st.kept,'at start-up the stored settings are cleaned once (memory and storage), the original kept on the phone (meta set_kept)');
    ok(st.own===D1+'/ownsage'&&/settings couldn’t be shown safely.*Nothing was deleted/.test(st.toast),`the person's own entries stay and a plain message says what happened (${st.own}; "${st.toast}")`);
    await p.click('button[aria-label="Settings"]');await settle(p,300);await p.click('#sc-daysoff .scat-head');await settle(p,300);await p.click('#sc-tagging .scat-head');await settle(p,300);
    ok(await p.evaluate(()=>!__rxs.length&&!document.querySelector('[data-rx]')),'after the reload Settings runs nothing (it did at every start: the stored copy came back each time)');
    // ---- the holiday list from outside: only dated, named holidays
    await p.selectOption('#cfg-country','US');await p.waitForFunction(()=>HOOK.settings.holidays&&HOOK.settings.holidays.country==='US'&&HOOK.settings.holidays.fetched>0,null,{timeout:8000});
    await p.waitForFunction(()=>document.querySelectorAll('#holiday-list .hrow').length===HOOK.settings.holidays.list.length,null,{timeout:5000}).catch(()=>{});   // (drawn just after the list is saved)
    const h=await p.evaluate(()=>({list:HOOK.settings.holidays.list.map(x=>x.d+' '+x.n),hits:__rxs.slice(),rows:document.querySelectorAll('#holiday-list .hrow').length}));
    ok(h.list.length&&h.list.every(x=>/^\d{4}-12-02 Good Day b$/.test(x))&&!h.hits.length&&h.rows===h.list.length,`a holiday list with a crafted date keeps only the good holidays, names cleaned (${h.list.join(' | ')})`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
