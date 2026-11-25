// The code review's stylesheet and accessibility findings (CR-9-01..08, CR-9-12; 2026-11-17):
// the pages' base button and field rules weigh no more than a class, so a page's own class rule wins without !important;
// one [hidden] rule; no rule for a class the app no longer has; "Add without a photo", the import sheet and the tour hold the
// focus and Escape closes them; What to buy gives the focus back after Insights was drawn again; text over 4.5:1; 44px targets;
// the side safe areas of an iPhone on its side.
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
module.exports=async({ok,chromium,url,settle})=>{
  // ---- the stylesheet as written ----
  const css=fs.readFileSync(path.join(ROOT,'styles.css'),'utf8');
  const bare=css.replace(/\/\*[\s\S]*?\*\//g,'');
  ok(!bare.includes(':is(#wardrobe,#item-view,#add,#stats,#pack,#care,#settings-modal)'),'the design system\'s page prefix is :where(…), not :is(#…) (an id\'s weight)');
  const imp=['.phead .pback{','#add .paste-box .btn{','.addrow{','.shctl .shbtn{','.colbtn{'].filter(s=>{const i=bare.indexOf('\n'+s);return i<0||/!important/.test(bare.slice(i,bare.indexOf('}',i)))});
  ok(!imp.length,`the rules that fought the base button rule need no !important (${imp.join(' ')||'none'})`);
  const hid=bare.match(/[^\s{}]+\[hidden\]\{display:none(!important)?\}/g)||[];
  ok(/(^|\n)\[hidden\]\{display:none!important\}/.test(bare)&&!hid.filter(s=>s!=='[hidden]{display:none!important}').length,`one [hidden] rule for every element (${hid.join(' ')})`);
  // every class the stylesheet styles is written somewhere in the app (a class built from a prefix, like 'care-'+k, counts)
  const app=fs.readdirSync(ROOT).filter(f=>/\.(js|html)$/.test(f)&&f!=='eslint.config.mjs').map(f=>fs.readFileSync(path.join(ROOT,f),'utf8'))
    .concat(fs.readdirSync(path.join(ROOT,'mq')).filter(f=>f.endsWith('.js')).map(f=>fs.readFileSync(path.join(ROOT,'mq',f),'utf8'))).join('\n');
  const classes=new Set();let buf='';
  for(const c of bare){if(c==='{'){const s=buf.trim();if(s&&!s.startsWith('@')&&!/^(from|to|\d)/.test(s))for(const m of s.replace(/"[^"]*"|'[^']*'|\[[^\]]*\]/g,'').matchAll(/\.(-?[_a-zA-Z][\w-]*)/g))classes.add(m[1]);buf=''}else if(c==='}'||c===';')buf='';else buf+=c}
  const used=n=>new RegExp('(^|[^\\w-])'+n.replace(/-/g,'\\-')+'($|[^\\w-])').test(app)||n.split('-').slice(0,-1).some((_,k,a)=>{const p=a.slice(0,k+1).join('-')+'-';return app.includes("'"+p+"'+")||app.includes(p+'${')});
  const dead=[...classes].filter(n=>!used(n));
  ok(classes.size>500&&!dead.length,`every class styles.css styles is used by the app (${classes.size} classes; unused: ${dead.join(', ')||'none'})`);

  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:402,height:874},colorScheme:'light'});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      HOOK.items=[I('suit','navy'),I('suit','charcoal'),I('suit','grey'),I('shirt','white'),I('shirt','lightblue'),I('shirt','pink'),I('shirt','white'),I('shirt','lightblue'),
        I('tie','burgundy'),I('tie','navy'),I('tie','green'),I('tie','grey'),I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'}),I('socks','navy'),I('belt','black',{leather:'calf'})];
      settings.workdays=[0,1,2,3,4];HOOK.dayRecs={};HOOK.TODAY_OVERRIDE='2026-11-16T18:00:00';HOOK.sel=new Date(2026,10,16);HOOK.view={y:2026,m:10};HOOK.cache={};show('today')});
    await settle(p,300);
    const act=()=>p.evaluate(()=>{const a=document.activeElement;return !a||a===document.body?'BODY':a.tagName+(a.id?'#'+a.id:'')});
    const inside=q=>p.evaluate(q=>{const e=document.querySelector(q);return !!e&&e.contains(document.activeElement)},q);
    const tabs=async(q,n)=>{let out=0;for(let i=0;i<n;i++){await p.keyboard.press('Tab');if(!await inside(q))out++}return out};

    // CR-9-01: a class rule for a button on a page now wins over the base rule, by order, as for any element
    const probe=await p.evaluate(()=>{openAdd();const st=document.createElement('style');st.textContent='.f10probe{border-radius:0;min-height:0;background:rgb(255,0,0)}';document.head.appendChild(st);
      const b=document.createElement('button');b.className='f10probe';b.textContent='x';document.querySelector('#add').appendChild(b);const c=getComputedStyle(b);
      const r={radius:c.borderTopLeftRadius,min:c.minHeight,bg:c.backgroundColor};b.remove();st.remove();
      const a=getComputedStyle(document.querySelector('#add-import')),bk=document.querySelector('#add .pback').getBoundingClientRect(),bs=getComputedStyle(document.querySelector('#add .pback'));
      r.addrow={display:a.display,radius:a.borderTopLeftRadius,top:a.borderTopWidth,left:a.borderLeftWidth,bg:a.backgroundColor};r.back=[Math.round(bk.width),Math.round(bk.height),bs.borderTopLeftRadius].join(' ');
      const btn=getComputedStyle(document.querySelector('#add-photo-btn,#add .addpick .btn'));r.base={min:btn.minHeight,radius:btn.borderTopLeftRadius};return r});
    ok(probe.radius==='0px'&&probe.min==='0px'&&probe.bg==='rgb(255, 0, 0)',`a class rule on a button in Add takes effect (${JSON.stringify(probe)})`);
    ok(probe.addrow.display==='grid'&&probe.addrow.radius==='0px'&&probe.addrow.top==='1px'&&probe.addrow.left==='0px'&&probe.addrow.bg==='rgba(0, 0, 0, 0)'&&probe.back==='44 44 22px',
      `"Import from a spreadsheet" keeps its row look and ‹ its 44px circle without !important (${JSON.stringify(probe.addrow)}, ${probe.back})`);
    ok(probe.base.min==='44px'||+probe.base.min.replace('px','')>=44,`the page's buttons keep the base rule's 44px over the global button reset (${JSON.stringify(probe.base)})`);
    // CR-9-12: the hidden attribute hides an element even where a page rule gives it a display
    const hd=await p.evaluate(()=>{const b=document.createElement('button');b.className='addrow';b.hidden=true;document.querySelector('#add').appendChild(b);const d=getComputedStyle(b).display;b.remove();return d});
    ok(hd==='none',`a hidden button with a display rule stays hidden (${hd})`);

    // CR-9-02: "Add without a photo" from the keyboard: Tab stays in the sheet; Escape closes it; the focus comes back
    await p.focus('#add-manual');await p.keyboard.press('Enter');await settle(p,400);
    ok(await inside('#nps-sheet.on'),`"Add without a photo" opens with the focus in it (${await act()})`);
    const nOut=await tabs('#nps-sheet',30);
    ok(nOut===0,`30 Tabs stay inside "Add without a photo" (${nOut} outside)`);
    await p.keyboard.press('Escape');await settle(p,500);
    const nps=await p.evaluate(()=>({open:!!document.querySelector('#nps-sheet.on'),f:document.activeElement&&document.activeElement.id}));
    ok(!nps.open&&nps.f==='add-manual',`Escape after Tabbing round closes it and the focus is back on its button (${JSON.stringify(nps)})`);
    // CR-9-03: the import sheet takes the focus and holds it; Escape gives it back
    await p.focus('#add-import');await p.keyboard.press('Enter');await settle(p,400);
    ok(await inside('#kitsheet.on'),`the import sheet takes the focus (${await act()})`);
    const iOut=await tabs('#kitsheet',20);
    ok(iOut===0,`20 Tabs stay inside the import sheet (${iOut} outside)`);
    await p.keyboard.press('Escape');await settle(p,500);
    ok(await act()==='BUTTON#add-import',`Escape closes it and the focus is back on Import (${await act()})`);
    // the tour (from About in Settings)
    await p.evaluate(()=>{show('today');openSettings('about')});await settle(p,400);
    await p.focus('#settings-modal button[data-act="tourAgainTap"]');await p.keyboard.press('Enter');await settle(p,500);
    ok(await inside('#kitsheet.on'),`the tour opens with the focus in it (${await act()})`);
    const tOut=await tabs('#kitsheet',30);
    ok(tOut===0,`30 Tabs stay inside the tour (${tOut} outside)`);
    await p.keyboard.press('Escape');await settle(p,500);await p.evaluate(()=>{try{closeSettings()}catch{}});await settle(p,300);

    // CR-9-04: What to buy: Insights drawn again while it is up; Escape gives the focus to the new What to buy button
    await p.evaluate(()=>{show('stats');const cat=n=>({key:'c'+n,title:'Section '+n,verdict:'covered',own:null,notes:['A note'],recs:[]});
      HOOK.shop={sig:HOOK.shopSig(),at:Date.now(),res:{v:2,base:null,cats:[0,1].map(cat),top:[],occasions:[],checked:0,sims:1,months:6}};renderStats()});await settle(p,300);
    await p.evaluate(()=>{window.__f10b=document.querySelector('#shop-btn')});
    await p.focus('#shop-btn');await p.keyboard.press('Enter');await settle(p,400);
    await p.evaluate(()=>renderStats());   // what analyzeWardrobe does when it finishes while the sheet is up
    const gone=await p.evaluate(()=>!window.__f10b.isConnected&&!!document.querySelector('#shop-btn'));
    await p.keyboard.press('Escape');await settle(p,500);
    ok(gone&&await act()==='BUTTON#shop-btn',`What to buy closed by Escape: the focus is on the What to buy button drawn while it was up (${gone}, ${await act()})`);

    // and the real check: opened with nothing kept, closed while it still runs; when it finishes and draws the button again, the focus stays on it
    await p.evaluate(()=>{HOOK.shop=null;renderStats()});await settle(p,300);
    await p.focus('#shop-btn');await p.keyboard.press('Enter');
    await p.keyboard.press('Escape');
    const ran=await p.evaluate(()=>{window.__f10b=document.querySelector('#shop-btn');return !!HOOK.shopBusy});
    await p.waitForFunction(()=>!HOOK.shopBusy,null,{timeout:60000});await settle(p,300);
    const redrawn=await p.evaluate(()=>!window.__f10b.isConnected);
    ok(ran&&redrawn&&await act()==='BUTTON#shop-btn',`What to buy closed while it checks: when the check finishes and draws the button again, the focus is still on it (${ran}, ${redrawn}, ${await act()})`);

    // CR-9-05 contrast and CR-9-06 tap targets, in both themes
    await p.evaluate(()=>{window.__f10m=()=>{
      const cv=document.createElement('canvas').getContext('2d');
      const col=c=>{cv.clearRect(0,0,1,1);cv.fillStyle='#000';cv.fillStyle=c;cv.fillRect(0,0,1,1);const d=cv.getImageData(0,0,1,1).data;return [d[0],d[1],d[2],d[3]/255]};
      const lum=c=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(c[0])+.7152*f(c[1])+.0722*f(c[2])};
      const mix=(t,b)=>{const a=t[3];return [t[0]*a+b[0]*(1-a),t[1]*a+b[1]*(1-a),t[2]*a+b[2]*(1-a),1]};
      const ratio=el=>{let st=[],a=el;while(a){const b=col(getComputedStyle(a).backgroundColor);if(b[3]>0){st.push(b);if(b[3]>=.99)break}a=a.parentElement}
        let base=st.length&&st[st.length-1][3]>=.99?st.pop():col(getComputedStyle(document.body).backgroundColor);for(let i=st.length-1;i>=0;i--)base=mix(st[i],base);
        let fg=col(getComputedStyle(el).color),op=1;for(a=el;a;a=a.parentElement)op*=+getComputedStyle(a).opacity;fg=mix([fg[0],fg[1],fg[2],fg[3]*op],base);
        const x=lum(fg),y=lum(base);return +((Math.max(x,y)+.05)/(Math.min(x,y)+.05)).toFixed(2)};
      const hit=el=>{const r=el.getBoundingClientRect(),a=getComputedStyle(el,'::after'),bw=parseFloat(getComputedStyle(el).borderLeftWidth)||0,px=v=>parseFloat(v)||0;let w=r.width,h=r.height;
        if(a.content&&a.content!=='none'&&a.position==='absolute'){if(a.left!=='auto'&&a.right!=='auto')w=Math.max(w,r.width-2*bw-px(a.left)-px(a.right));if(a.top!=='auto'&&a.bottom!=='auto')h=Math.max(h,r.height-2*bw-px(a.top)-px(a.bottom))}
        return [Math.round(w),Math.round(h)]};
      const probe=(html,inside)=>{const d=document.createElement('div');d.innerHTML=html;const e=d.firstChild;document.querySelector(inside).appendChild(e);const r=ratio(e);e.remove();return r};
      const vis=q=>[...document.querySelectorAll(q)].filter(e=>e.getClientRects().length);
      return {ratio,hit,probe,vis}}});
    // each screen is opened, then measured once its page-in animation is over
    const step=async(open,read)=>{await p.evaluate(open);await settle(p,700);return p.evaluate(read)};
    const measure=async()=>{const m={c:{},t:{}};
      Object.assign(m.t,await step(()=>{show('today');for(const b of document.querySelectorAll('#today .ibox:not(.open) .month-link,#today .mbox:not(.open) .month-link'))try{b.click()}catch{}},
        ()=>{const {hit,vis}=__f10m(),wp=document.querySelector('#wpill'),sw=vis('#today .row .swap'),rt=vis('#today .rowtap');
          return {wpill:wp?hit(wp):null,swap:sw.length?[Math.min(...sw.map(e=>hit(e)[0])),Math.min(...sw.map(e=>hit(e)[1]))]:null,rowtap:rt.length?Math.min(...rt.map(e=>hit(e)[1])):null}}));
      m.t.sttype=await step(()=>show('stats'),()=>{const {hit,vis}=__f10m(),su=vis('#stats .st-type summary');return su.length?Math.min(...su.map(e=>hit(e)[1])):null});
      Object.assign(m.c,await step(()=>openAdd(),()=>{const {ratio,probe}=__f10m();
        return {addSub:ratio(document.querySelector('#add-manual .addlong-t small')),confMedium:probe('<span class="conf medium">Medium</span>','#add'),connTick:probe('<span class="conn-tick">✓</span>','#add')}}));
      Object.assign(m.c,await step(()=>{show('wardrobe');openItem(items[0].id)},()=>{const {probe}=__f10m();
        return {pill:probe('<span class="ivpill">Clean in 5 wears</span>','#item-view .ivpills,#item-view'),pillGood:probe('<span class="ivpill good">In rotation</span>','#item-view .ivpills,#item-view')}}));
      m.t.dtog=await step(()=>{HOOK.closeItem();openSettings('schedule')},()=>{const {hit,vis}=__f10m(),dt=vis('#settings-modal .dtog');return dt.length?Math.min(...dt.map(e=>hit(e)[1])):null});
      await p.evaluate(()=>{closeSettings();show('today')});await settle(p,400);return m};
    for(const theme of ['light','dark']){
      await p.emulateMedia({colorScheme:theme});await settle(p,200);
      const m=await measure();
      const lowC=Object.entries(m.c).filter(([,r])=>!(r>=4.5));
      ok(!lowC.length,`${theme}: the Add subtitle, the item sheet's pills, the medium confidence tag and the connected check are over 4.5:1 (${JSON.stringify(m.c)})`);
      const t=m.t;const small=[t.wpill&&t.wpill[1]<44&&'Wore pill',t.swap&&(t.swap[0]<44||t.swap[1]<44)&&'⇄/−',t.rowtap<44&&'piece row',t.sttype<44&&'Insights type row',t.dtog<44&&'Settings day'].filter(Boolean);
      ok(t.wpill&&t.swap&&t.rowtap&&t.sttype&&t.dtog&&!small.length,`${theme}: 44px to tap on the Wore pill, ⇄ and −, a piece's row, Insights' type rows and Settings' day buttons (${JSON.stringify(t)})`);
    }
    // R9 N1 (the 2026-11-24 review): the cost-per-wear money field is one field, the input's color inside its box with the $, and its edge
    // over 3:1 like every field's (it was a white box inside a gray one, its edge about 1.4:1 light and 1.3:1 dark)
    for(const theme of ['light','dark']){
      await p.emulateMedia({colorScheme:theme});await settle(p,200);
      const f=await p.evaluate(()=>{openSettings();const w=document.querySelector('#settings-modal .cpwin'),i=w&&w.querySelector('input');if(!i){closeSettings();return null}
        // its edge against the first solid background behind it (the Settings category may be folded: its opacity is left out)
        const rgb=c=>(c.match(/[\d.]+/g)||[]).map(Number),L=c=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(c[0])+.7152*f(c[1])+.0722*f(c[2])};
        let a=w.parentElement,bg=null;while(a&&!bg){const c=rgb(getComputedStyle(a).backgroundColor);if(c.length===3||(c.length===4&&c[3]>=.99))bg=c;a=a.parentElement}
        const x=L(rgb(getComputedStyle(w).borderTopColor)),y=L(bg||[255,255,255]),edge=+((Math.max(x,y)+.05)/(Math.min(x,y)+.05)).toFixed(2);
        const r={input:getComputedStyle(i).backgroundColor,box:getComputedStyle(w).backgroundColor,edge};closeSettings();return r});
      ok(f&&f.input===f.box&&f.edge>=3,`${theme}: the cost-per-wear field's box is the input's color and its edge is over 3:1 (${JSON.stringify(f)})`);
    }
    await p.emulateMedia({colorScheme:'light'});

    // CR-9-07: an iPhone on its side: the full-width bars keep clear of the side insets (WebKit and Chromium have none, so set them)
    const sa=await p.evaluate(()=>{const r=document.documentElement.style;r.setProperty('--sal','47px');r.setProperty('--sar','47px');tourOpen();
      const g=(q,k)=>{const e=document.querySelector(q);return e?parseFloat(getComputedStyle(e)[k]):-1};
      const o={header:[g('body>header','paddingLeft'),g('body>header','paddingRight')],nav:[g('body>nav','paddingLeft'),g('body>nav','paddingRight')],kit:[g('.kit-head','paddingLeft'),g('.kit-bar','paddingRight')]};
      kitClose();r.removeProperty('--sal');r.removeProperty('--sar');o.upright=[g('body>header','paddingLeft'),g('body>header','paddingRight')];return o});
    ok(sa.header.join()==='47,47'&&sa.nav.join()==='47,47'&&sa.kit.join()==='47,47'&&sa.upright.join()==='16,12',`the header, the tab bar and the tour keep clear of the side safe areas, and keep their padding upright (${JSON.stringify(sa)})`);
    ok(!errs.length,'no page errors'+(errs.length?': '+errs.join(' | '):''));
  }finally{await browser.close()}
};
