// The final UI pass (ui.js): the app's own question sheet instead of browser dialogs, Settings wording and its Advanced folds,
// the accent's contrast as text, buttons that need a connection, the first-outfit checklist above the figure, Refresh on the
// Laundry page, and the new pages' sizes at 320/390/626px in both themes.
const fs=require('fs'),path=require('path');
module.exports=async({ok,chromium,url,WARDROBES,settle,ROOT})=>{
  const browser=await chromium.launch();
  const SRV='https://wardrobe-server.test/';
  const open=async(vp={width:390,height:844},o={})=>{const ctx=await browser.newContext({viewport:vp,isMobile:true,hasTouch:true}),p=await ctx.newPage(),errs=[],dialogs=[];
    p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>{dialogs.push(d.message());d.dismiss()});
    await p.route(SRV+'**',r=>r.fulfill({status:503,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:'{}'}));   // a server that answers nothing: no sync merges the wardrobe away
    if(o.setup)await p.addInitScript(()=>{window.SETUP_AUTO=true});
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{TODAY_OVERRIDE='2026-11-11T12:00:00';sel=new Date(2026,10,11);view={y:2026,m:10};settings.workdays=[1,2,3,4,5];settings.blazerDays=[4];settings.setupDone=1;cache={}});
    return {p,ctx,errs,dialogs}};
  const fill=(p,which)=>p.evaluate(`(()=>{const W=${WARDROBES};items=${which};cache={};flt='all';show('today')})()`);
  try{
    /* ---- no browser dialogs left in the app's scripts ---- */
    {const files=fs.readdirSync(ROOT).filter(f=>/\.js$/.test(f)&&f!=='worker.js').concat('index.html'),hits=[];
      for(const f of files){const t=fs.readFileSync(path.join(ROOT,f),'utf8');for(const m of t.matchAll(/(^|[^.\w$])(confirm|alert|prompt)\s*\(/g))hits.push(f+': '+t.slice(m.index,m.index+50).replace(/\s+/g,' '))}
      ok(!hits.length,`no confirm(), alert() or prompt() in the app's scripts${hits.length?' ('+hits.slice(0,3).join(' | ')+')':''}`);
      ok(/'ui\.js'/.test(fs.readFileSync(path.join(ROOT,'sw.js'),'utf8'))&&/<script src="ui\.js">/.test(fs.readFileSync(path.join(ROOT,'index.html'),'utf8')),'ui.js is loaded by the page and kept by the service worker')}

    const {p,ctx,errs,dialogs}=await open();
    await fill(p,'W.realistic');
    /* ---- askConfirm ---- */
    const ask=async(how,opt)=>{await p.evaluate(o=>{window._ans=undefined;askConfirm('Do the thing?\n\nIt can be undone.',o).then(v=>{window._ans=v})},opt||{});
      await p.waitForFunction(()=>document.querySelector('#ask-sheet.on'));await settle(p,400);const before=await p.evaluate(()=>window._ans);
      if(how==='esc')await p.keyboard.press('Escape');else if(how==='back')await p.evaluate(()=>document.querySelector('#ask-backdrop').click());else await p.click(how);
      await p.waitForFunction(()=>window._ans!==undefined);return {before,ans:await p.evaluate(()=>window._ans),shut:await p.evaluate(()=>!document.querySelector('#ask-sheet').classList.contains('on')&&!document.querySelector('#ask-backdrop').classList.contains('on'))}};
    await p.evaluate(()=>{askConfirm('Do the thing?\n\nIt can be undone.',{ok:'Do it',danger:true})});await p.waitForFunction(()=>document.querySelector('#ask-sheet.on'));await settle(p,400);
    const sh=await p.evaluate(()=>{const s=document.querySelector('#ask-sheet'),r=s.getBoundingClientRect(),b=[...s.querySelectorAll('button')];
      return {bottom:Math.round(r.bottom),w:Math.round(r.width),q:s.querySelector('.ask-q').textContent,more:s.querySelector('.ask-more').textContent,btn:b.map(x=>x.textContent+':'+Math.round(x.getBoundingClientRect().height)).join(),
        z:+getComputedStyle(s).zIndex,set:+getComputedStyle(document.querySelector('#settings-modal')).zIndex,role:s.getAttribute('role'),focus:document.activeElement.id,red:getComputedStyle(s.querySelector('#ask-ok')).backgroundColor}});
    ok(sh.bottom===844&&sh.w===390&&sh.q==='Do the thing?'&&sh.more==='It can be undone.'&&sh.role==='alertdialog',`askConfirm shows a sheet at the bottom of the screen with the question and its explanation`);
    ok(sh.btn==='Cancel:44,Do it:44'&&sh.z>sh.set&&sh.focus==='ask-cancel'&&/19[0-9], 7\d, 6\d/.test(sh.red),`two 44px buttons, above Settings; a destructive one is red and the focus starts on Cancel (${sh.btn}, ${sh.red})`);
    await p.evaluate(()=>askAnswer(false));
    const a1=await ask('#ask-ok'),a2=await ask('#ask-cancel'),a3=await ask('esc'),a4=await ask('back');
    ok(a1.before===undefined&&a1.ans===true&&a1.shut&&a2.ans===false&&a3.ans===false&&a4.ans===false&&a4.shut,'it answers true on OK, false on Cancel, Escape and a tap outside, and closes');
    await p.evaluate(()=>{tell('That file is not a Daily Wardrobe backup.')});
    ok(await p.evaluate(()=>{const t=document.querySelector('#toast');return t.classList.contains('on')&&/not a Daily Wardrobe backup/.test(t.textContent)&&+getComputedStyle(t).zIndex>+getComputedStyle(document.querySelector('#settings-modal')).zIndex&&t.getBoundingClientRect().height<50}),'tell() is a toast, on one line, shown above Settings too');
    // forgetting what the planner learned: done at once, with Undo
    await p.evaluate(()=>{settings.learn={p:{'a|b':-2},i:{}};openStats();forgetLearned()});
    await p.waitForFunction(()=>settings.learn===null&&document.querySelector('#toast.act button'));
    await p.click('#toast button');await p.waitForFunction(()=>settings.learn&&settings.learn.p['a|b']===-2);
    ok(true,'"Forget everything" on the stats page forgets at once and offers Undo, which brings it back');

    /* ---- Settings: wording, the top group, Advanced folds ---- */
    await p.evaluate(()=>{show('today');openSettings();renderAbout()});await settle(p,400);
    const st=await p.evaluate(()=>{const m=document.querySelector('#settings-modal'),bad=/worker|cloudflare|\bKV\b|token|benchmark/i;
      for(const k of SET_CATS)setCatOpen(k,true,true);for(const f of m.querySelectorAll('.adv'))f.classList.add('open');
      const text=m.innerText+' '+[...m.querySelectorAll('[placeholder],[title],[aria-label]')].map(e=>(e.placeholder||'')+' '+(e.title||'')+' '+(e.getAttribute('aria-label')||'')).join(' ');
      const hit=bad.exec(text);for(const f of m.querySelectorAll('.adv'))f.classList.remove('open');for(const k of SET_CATS)setCatOpen(k,false,true);
      const links=m.querySelector('#slinks'),first=m.querySelector('.sbody').firstElementChild;
      return {hit:hit?text.slice(Math.max(0,hit.index-30),hit.index+30):'',sums:SET_CATS.map(k=>document.querySelector('#sum-'+k).textContent),
        links:[...links.querySelectorAll('.slink b')].map(b=>b.textContent).join(),one:links.querySelectorAll('.slink').length===links.children.length,head:first.textContent,
        gaps:[...links.querySelectorAll('.slink')].map(b=>Math.round(b.getBoundingClientRect().height)),radius:getComputedStyle(links).borderTopLeftRadius}});
    ok(!st.hit,`nothing in Settings says worker, Cloudflare, KV, token or benchmark${st.hit?' (“…'+st.hit+'…”)':''}`);
    ok(st.sums[4]==='Needs a connection'&&/^Your own colours & patterns$/.test(st.sums[5])&&/needs a connection/.test(st.sums[6])&&st.sums[7]==='Not connected'&&st.sums.every(t=>t.length>4),`every category's summary reads sensibly with nothing connected (${st.sums.slice(4,8).join(' | ')})`);
    ok(st.links==='Packing list,Laundry & cleaning'&&st.one&&st.head==='Your wardrobe'&&st.radius==='14px'&&st.gaps.every(h=>h>=44),`the page links at the top of Settings are one card under a heading (${st.gaps} px rows)`);
    const adv=await p.evaluate(()=>{const inAdv=s=>{const e=document.querySelector(s);return !!(e&&e.closest('.adv-in'))};
      return {ids:[...document.querySelectorAll('#settings-modal .adv')].map(a=>a.id).join(),shut:[...document.querySelectorAll('#settings-modal .adv')].every(a=>!a.classList.contains('open')&&getComputedStyle(a.querySelector('.adv-in')).display==='none'&&a.querySelector('.adv-head').getAttribute('aria-expanded')==='false'),
        inside:['#cfg-url','#cfg-token','#replan-btn','#weave-box','#bench-box','#asm-group'].every(inAdv),out:['#cfg-workdays','#regen-btn','#custom-list','#snap-list','#conn-box','#acct-box'].every(s=>!inAdv(s)),
        label:document.querySelector('#adv-connection .adv-head').innerText.replace(/\s+/g,' ')}});
    ok(adv.ids==='adv-schedule,adv-photos,adv-tagging,adv-connection'&&adv.shut,'Schedule, Realistic photos, Photo tagging and Connection each have an Advanced fold, closed when Settings opens');
    ok(adv.inside&&adv.out&&/^Advanced For the person who runs the server/.test(adv.label),'the server address and code, re-plan, shirt weaves, the accuracy check and the item-photo tools are inside them; the everyday controls are not');
    await p.evaluate(()=>openSettings('connection'));await settle(p,300);
    ok(!(await p.isVisible('#cfg-url'))&&await p.isVisible('#conn-link'),'Connection shows a field for the invite link; the address and code stay folded away');
    await p.click('#adv-connection .adv-head');
    const ao=await p.evaluate(()=>({vis:!!document.querySelector('#cfg-url').offsetParent,exp:document.querySelector('#adv-connection .adv-head').getAttribute('aria-expanded'),h:Math.round(document.querySelector('#adv-connection .adv-head').getBoundingClientRect().height),
      labels:[...document.querySelectorAll('#advin-connection label')].map(l=>l.firstChild.textContent.trim()).join()}));
    ok(ao.vis&&ao.exp==='true'&&ao.h>=44&&ao.labels==='Server address,Code',`a tap unfolds it (${ao.labels}; a ${ao.h}px row)`);
    await p.evaluate(()=>{closeSettings();openSettings('connection')});
    ok(await p.evaluate(()=>!document.querySelector('#settings-modal .adv.open')),'opening Settings again folds it');
    await p.fill('#conn-link','not a link');await p.click('#conn-go');await p.waitForFunction(()=>/didn’t work/.test(document.querySelector('#conn-msg').textContent));
    ok(await p.evaluate(()=>!localStorage.getItem('worker_url')),'a link that is no invite link says so and connects nothing');

    /* ---- what needs a connection: not shown until the app is connected (a switched-off button looked broken) ---- */
    await p.evaluate(()=>{openSettings('photos')});await settle(p,300);
    const off=await p.evaluate(()=>({vis:['#regen-btn','#itempic-btn'].map(s=>!!document.querySelector(s).offsetParent),note:document.querySelector('#photos-conn').textContent,noteVis:!!document.querySelector('#photos-conn').offsetParent,
      go:!!document.querySelector('#photos-conn button'),backup:(openSettings('backup'),{sync:!!document.querySelector('#sp-backup button[onclick="syncNow()"]').offsetParent,snaps:!!document.querySelector('#snap-list').offsetParent,file:!!document.querySelector('#sp-backup button[onclick="downloadBackup()"]').offsetParent,note:document.querySelector('#backup-conn').textContent})}));
    ok(off.vis.every(v=>!v)&&/^Making outfit photos needs a connection/.test(off.note)&&off.noteVis&&off.go,`not connected: Realistic photos shows one line saying what connecting turns on, with a Connect button, and none of its buttons (“${off.note}”)`);
    ok(!off.backup.sync&&!off.backup.snaps&&off.backup.file&&/^Backing up and syncing needs a connection/.test(off.backup.note),'Backup: no Sync now or daily backups; the backup file still works');
    await p.evaluate(()=>{openSettings('photos');document.querySelector('#photos-conn button').click()});await settle(p,600);
    ok(await p.evaluate(()=>document.querySelector('#sc-connection').classList.contains('open')&&document.activeElement===document.querySelector('#conn-link')),'Connect opens Connection with the cursor in the invite-link field');
    await p.evaluate(()=>{closeSettings();show('today')});
    const g0=await p.evaluate(()=>({btn:!!document.querySelector('.render-btn'),msg:document.querySelector('#render-msg').textContent,refresh:!!document.querySelector('#refresh-btn').offsetParent}));
    ok(!g0.btn&&!g0.msg&&!g0.refresh,'Today: no Generate button and no "needs a connection" under the figure; no Refresh in the header');
    await p.evaluate(()=>openAdd());
    ok(await p.evaluate(()=>!document.querySelector('#add-group').offsetParent&&!!document.querySelector('#add-one').offsetParent),'Add: "Several items" is not shown; "One item" is');
    await p.evaluate(()=>{const s=items.find(i=>i.type==='shirt');s.pattern='herringbone';s.texture='data:image/png;base64,iVBORw0KGgo=';show('wardrobe');openItem(s.id)});await settle(p,500);
    ok(await p.evaluate(()=>!document.querySelector('#readpat-btn')&&!document.querySelector('.ivpat .connnote')),'the item sheet: no "Read pattern from photo" for a weave only the server can read');
    await p.evaluate(()=>closeItem());
    // connected: everything is there again
    await p.evaluate(s=>{localStorage.setItem('worker_url',s);localStorage.setItem('app_token','tok-1');closeSettings();show('today')},SRV);
    const on=await p.evaluate(()=>{const b=document.querySelector('.render-btn');openSettings('photos');const r={gen:!b&&!document.querySelector('#regen-btn').disabled,msg:document.querySelector('#render-msg').textContent,
      batch:!document.querySelector('#batch-btn'),regen:!!document.querySelector('#regen-btn').offsetParent,note:document.querySelector('#photos-conn').textContent,sum:document.querySelector('#sum-photos').textContent,conn:document.querySelector('#sum-connection').textContent};
      closeSettings();openAdd();r.group=!!document.querySelector('#add-group').offsetParent&&!document.querySelector('#add-group input').disabled;return r});
    ok(on.gen&&!on.msg&&on.batch&&on.regen&&!on.note&&on.group&&/This day’s photo/.test(on.sum)&&/^Connected/.test(on.conn),`connected: the buttons are there and work, a day's photo from Settings only (${on.conn})`);
    await p.evaluate(()=>{localStorage.removeItem('worker_url');localStorage.removeItem('app_token')});

    /* ---- the accent as text ---- */
    await p.evaluate(()=>{settings.location=null;show('today');toggleMonth()});await settle(p,600);
    const contrast=theme=>p.evaluate(theme=>{document.documentElement.dataset.theme=theme;
      const lum=c=>{const [r,g,b]=c.match(/[\d.]+/g).slice(0,3).map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4});return .2126*r+.7152*g+.0722*b};
      const probe=v=>{const d=document.createElement('i');d.style.color=v;document.body.append(d);const c=getComputedStyle(d).color;d.remove();return c};
      const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
      const bg=probe('var(--bg)'),card=probe('var(--card)'),acc=probe('var(--acc)'),out={acc:+Math.min(ratio(acc,bg),ratio(acc,card)).toFixed(2),els:{}};
      for(const [s,on] of [['.day h2 .wx a',bg],['.mhead .eyebrow',card],['#care .linkbtn',bg],['.sicw',card]]){const e=document.querySelector(s);if(e)out.els[s]={r:+ratio(getComputedStyle(e).color,on).toFixed(2),same:getComputedStyle(e).color===acc}}
      return out},theme);
    await p.evaluate(()=>{careShow('care')});
    const cl=await contrast('light'),cd=await contrast('dark');
    ok(cl.acc<4.5&&Object.keys(cl.els).length>=3&&Object.values(cl.els).every(e=>e.r>=4.5),`light theme: accent-coloured text is at least 4.5:1 on its background (${Object.entries(cl.els).map(([s,e])=>s+' '+e.r).join(', ')}; the fill colour itself is ${cl.acc})`);
    ok(Object.values(cd.els).every(e=>e.same&&e.r>=4.5),`dark theme: it stays the accent colour (${Object.values(cd.els).map(e=>e.r).join(', ')}:1)`);
    await p.evaluate(()=>{document.documentElement.dataset.theme='light';careShow('today')});

    /* ---- the checklist comes first with a partial wardrobe ---- */
    await fill(p,'[W.realistic.find(i=>i.type==="shirt")]');
    const fr=await p.evaluate(()=>{const f=document.querySelector('#firstrun'),g=document.querySelector('#mannequin-container');return f&&g?{first:!!(f.compareDocumentPosition(g)&Node.DOCUMENT_POSITION_FOLLOWING),top:f.getBoundingClientRect().top<g.getBoundingClientRect().top,stage:!!f.closest('#stage'),n:document.querySelectorAll('#firstrun').length}:null});
    ok(fr&&fr.first&&fr.top&&fr.stage&&fr.n===1,'one shirt: "Get your first outfit" sits above the drawn figure');
    await p.evaluate(()=>{sel=new Date(2026,10,14);show('today')});
    ok(await p.evaluate(()=>{const f=document.querySelector('#firstrun'),e=document.querySelector('#stage .empty');return !!f&&!!e&&f.getBoundingClientRect().top<e.getBoundingClientRect().top}),'on a day off it is above the day\'s note too');
    await p.evaluate(()=>{sel=new Date(2026,10,11)});await fill(p,'W.realistic');
    ok(await p.evaluate(()=>!document.querySelector('#firstrun')&&!!document.querySelector('#mannequin-container')),'gone once an outfit can be planned');
    await p.evaluate(()=>{items=[];cache={};show('wardrobe')});
    ok(await p.evaluate(()=>!!document.querySelector('#wempty')&&!document.querySelector('#wardrobe .wfind')&&!document.querySelector('#wardrobe .chips')),'an empty Wardrobe shows its empty card without the search field and the type chips');

    /* ---- Refresh stays on the Laundry page ---- */
    await fill(p,'W.realistic');await p.evaluate(()=>openCare());
    await p.evaluate(()=>refreshAll());
    ok(await p.evaluate(()=>!document.querySelector('#care').hidden&&document.querySelector('#today').hidden&&document.querySelector('#care h2').textContent==='Laundry & cleaning'),'Refresh on Laundry & cleaning stays there');
    ok(!errs.length&&!dialogs.length,`no page errors and no browser dialog (${errs.concat(dialogs).slice(0,2).join(' | ')})`);
    await ctx.close();

    /* ---- the new pages: sizes and no sideways scroll at 320 / 390 / 626, both themes ---- */
    for(const w of [320,390,626]){const {p,ctx,errs}=await open({width:w,height:844});
      await fill(p,'W.realistic');
      await p.evaluate(()=>{const T=todayDate(),P=planFor();for(const [k,o] of Object.entries(P))if(keyDate(k)<T&&o&&o.shirt)dayRecs[k]={date:k,worn:true,ids:lockIds(o)};
        settings.care={suit:2,blazer:2,pants:2,shirt:1};items[1].away={why:'cleaner',since:'2026-11-09',back:'2026-11-13'};Object.assign(items[0],{name:'A suit with quite a long name that has to wrap or be cut somewhere'})});
      const out=[];
      for(const pg of ['pack','care'])for(const theme of ['light','dark']){
        await p.evaluate(([pg,theme])=>{document.documentElement.dataset.theme=theme;show(pg)},[pg,theme]);await settle(p,300);
        out.push(await p.evaluate(pg=>{const el=document.querySelector('#'+pg),b=[...el.querySelectorAll('button:not(.linkbtn):not(.pback)')].filter(x=>x.offsetParent),i=[...el.querySelectorAll('select,input[type=date],input[type=text]')].filter(x=>x.offsetParent),card=el.querySelector('.card');
          const cs=getComputedStyle(card),probe=v=>{const d=document.createElement('i');d.style.color=v;document.body.append(d);const c=getComputedStyle(d).color;d.remove();return c};
          return {pg,n:b.length,btn:[...new Set(b.map(x=>Math.round(x.getBoundingClientRect().height)))].join(),rad:[...new Set(b.map(x=>getComputedStyle(x).borderTopLeftRadius))].join(),inp:[...new Set(i.map(x=>Math.round(x.getBoundingClientRect().height)))].join(),
            h2:getComputedStyle(el.querySelector('.phead h2')).fontSize,back:Math.round(el.querySelector('.pback').getBoundingClientRect().width),card:cs.borderTopLeftRadius+' '+(cs.backgroundColor===probe('var(--card)'))+' '+(cs.borderTopColor===probe('var(--line)')),
            over:document.documentElement.scrollWidth-document.documentElement.clientWidth,wide:[...el.querySelectorAll('*')].filter(x=>x.getBoundingClientRect().right>innerWidth+1).length}},pg))}
      const bad=out.filter(o=>o.n<2||o.btn!=='44'||o.rad!=='12px'||(o.inp&&o.inp!=='44')||o.h2!=='22px'||o.back!==44||o.card!=='14px true true'||o.over>0||o.wide>0);
      ok(!bad.length,`${w}px: the Packing list and Laundry pages use 44px buttons and inputs, 12px corners, 14px bordered cards, a 22px title, and nothing scrolls sideways, light and dark${bad.length?' — '+JSON.stringify(bad[0]):''}`);
      // the item sheet's new fields and Care card
      await p.evaluate(()=>{document.documentElement.dataset.theme='light';show('wardrobe');openItem(items[0].id)});await settle(p,600);
      const iv=await p.evaluate(()=>{const v=document.querySelector('#item-view'),b=v.querySelector('#ivbody');return {h:[...v.querySelectorAll('.ivsec h3')].map(x=>x.textContent).join(),over:b.scrollWidth-b.clientWidth,
        btn:[...new Set([...v.querySelectorAll('.ivcare button')].map(x=>Math.round(x.getBoundingClientRect().height)))].join(),fld:[...new Set([...v.querySelectorAll('.wfld')].map(x=>Math.round(x.getBoundingClientRect().height)))].join()}});
      ok(/Care/.test(iv.h)&&iv.over<=0&&iv.btn==='44'&&iv.fld==='44',`${w}px: the item sheet's name and brand fields and its Care buttons are 44px and it doesn't scroll sideways (${iv.h})`);
      ok(!errs.length,`${w}px: no page errors ${errs.slice(0,2).join(' | ')}`);
      await ctx.close();
      // the setup flow, every step
      const s=await open({width:w,height:844},{setup:true});await s.p.evaluate(()=>{items=[];delete settings.setupDone;setupOpen(false)});const sb=[];
      for(const k of ['welcome','week','wear','weather','connect','done'])for(const theme of ['light','dark']){
        await s.p.waitForFunction(k=>document.querySelector('#su-step')&&document.querySelector('#su-step').dataset.step===k,k);
        sb.push(await s.p.evaluate(([k,theme])=>{document.documentElement.dataset.theme=theme;const el=document.querySelector('#setup'),b=[...el.querySelectorAll('button')].filter(x=>x.offsetParent),i=[...el.querySelectorAll('select,input[type=text]')].filter(x=>x.offsetParent),body=el.querySelector('.su-body');
          const lum=c=>{const [r,g,bl]=c.match(/[\d.]+/g).slice(0,3).map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4});return .2126*r+.7152*g+.0722*bl};
          const r={k,theme,min:Math.min(...b.map(x=>Math.round(x.getBoundingClientRect().height))),minw:Math.min(...b.map(x=>Math.round(x.getBoundingClientRect().width))),inp:[...new Set(i.map(x=>Math.round(x.getBoundingClientRect().height)))].join(),h2:getComputedStyle(el.querySelector('h2')).fontSize,
            over:body.scrollWidth-body.clientWidth,wide:[...el.querySelectorAll('*')].filter(x=>x.getBoundingClientRect().right>el.getBoundingClientRect().right+1).length,dark:lum(getComputedStyle(el).backgroundColor)<.2};
          if(theme==='dark'&&k!=='done')document.querySelector('#su-next').click();return r},[k,theme]))}
      const sbad=sb.filter(o=>o.min<44||o.minw<44||(o.inp&&o.inp!=='44')||o.h2!=='22px'||o.over>0||o.wide>0||o.dark!==(o.theme==='dark'));
      ok(sb.length===12&&!sbad.length,`${w}px: every setup step has 44px controls, a 22px title, follows the theme and doesn't scroll sideways${sbad.length?' — '+JSON.stringify(sbad[0]):''}`);
      if(w===390)ok(await s.p.evaluate(()=>{document.documentElement.dataset.theme='light';setupGo(-3);const k=document.querySelector('.su-sw[aria-checked=true] .su-knob'),d=document.createElement('i');d.style.color='var(--ink)';document.body.append(d);const ink=getComputedStyle(d).color;d.remove();return !!k&&getComputedStyle(k).backgroundColor===ink}),'the setup\'s switches are ink when on, like the dress-code switches in Settings');
      await s.ctx.close()}
  }finally{await browser.close()}
};
