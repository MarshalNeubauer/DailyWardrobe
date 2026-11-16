// Fix round 3 (2026-11-16), accessibility and the older user (W2-19, W2-14): the focus kept after a redraw and the change said (#sr-live);
// the item sheet and the color sheet over it as dialogs; the color buttons' names; the tab, chip and day states; a faded toast gone for
// everyone; the dark red button, field edges, green words; Today's "Add one" for its type; the colors above the Keep button; the cleaning
// banner's way forward; the tour's double tap; the theme button's first tap; the weather that couldn't be read; the pieces legend; headings.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},colorScheme:'light'});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const build=()=>p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      items=[I('suit','navy',{pattern:'herringbone'}),I('suit','charcoal'),I('shirt','white'),I('shirt','lightblue'),I('tie','burgundy'),I('tie','navy'),I('shoes','black',{leather:'calf'}),I('socks','navy')];
      settings.workdays=[0,1,2,3,4];dayRecs={};TODAY_OVERRIDE='2026-11-16T09:00:00';sel=new Date(2026,10,16);view={y:2026,m:10};cache={};show('today')});
    await build();
    const live=()=>p.evaluate(()=>new Promise(r=>setTimeout(()=>r(document.querySelector('#sr-live').textContent),150)));
    const act=()=>p.evaluate(()=>{const a=document.activeElement;return !a||a===document.body?'BODY':(a.id?'#'+a.id:'')+(a.getAttribute('aria-label')||a.textContent||'').trim().slice(0,40)});

    // W2-19-01: Next day by keyboard keeps the focus on Next day and says the new day and outfit
    await p.focus('#today button[aria-label="Next day"]');await p.keyboard.press('Enter');await p.waitForTimeout(400);
    ok(await act()==='Next day',`Next day by keyboard: the focus stays on it after the redraw (${await act()})`);
    const said=await live();
    ok(/^Tuesday, November 17: \S/.test(said),`the new day and its outfit are said by the live region ("${said}")`);
    await p.focus('#today button[aria-label="Previous day"]');await p.keyboard.press('Enter');await p.waitForTimeout(400);
    // the Wore pill (today, Monday 16): the focus stays, a line says what changed (W2-14-09)
    await p.evaluate(()=>{TODAY_OVERRIDE='2026-11-16T18:00:00';cache={};renderToday()});
    await p.focus('#wpill');await p.keyboard.press('Enter');await p.waitForTimeout(400);
    const wp=await p.evaluate(()=>({f:document.activeElement&&document.activeElement.id,no:document.querySelector('#wpill').classList.contains('no'),t:document.querySelector('#toast').textContent,label:document.querySelector('#wpill').getAttribute('aria-label')}));
    ok(wp.f==='wpill'&&wp.no&&/not worn/.test(wp.t)&&wp.label==='Wore this outfit',`the Wore pill keeps the focus, says "Marked as not worn", and its name stays (${JSON.stringify(wp)})`);
    await p.keyboard.press('Enter');await p.waitForTimeout(300);

    // W2-19-05: the tab, the chip and the month's day are spoken states
    await p.evaluate(()=>show('wardrobe'));
    await p.evaluate(()=>{const c=[...document.querySelectorAll('#wardrobe .chip')].find(b=>/^Suit/.test(b.textContent));c.click()});
    const st=await p.evaluate(()=>({tab:document.querySelector('#n-wardrobe').getAttribute('aria-current'),other:document.querySelector('#n-today').getAttribute('aria-current'),
      chip:[...document.querySelectorAll('#wardrobe .chip')].filter(b=>b.getAttribute('aria-pressed')==='true').map(b=>b.textContent.trim())}));
    ok(st.tab==='page'&&st.other===null&&st.chip.length===1&&/^Suit/.test(st.chip[0]),`the tab is aria-current and the chip aria-pressed (${JSON.stringify(st)})`);
    await p.evaluate(()=>{flt='all';renderWardrobe()});

    // W2-19-02: the item sheet takes the focus and gives it back to the item's box
    const tile='#wardrobe .gi:nth-child(3) .giopen';
    await p.focus(tile);await p.keyboard.press('Enter');await p.waitForTimeout(500);
    const op=await p.evaluate(()=>({inside:document.querySelector('#item-view').contains(document.activeElement)}));
    ok(op.inside,'opening an item by keyboard moves the focus into the sheet');
    // W2-19-04: the color and pattern buttons say their values
    const names=await p.evaluate(()=>[...document.querySelectorAll('#item-view .colbtn')].map(b=>b.getAttribute('aria-label')));
    ok(names.some(n=>/^Color: \S/.test(n||''))&&names.some(n=>/^Pattern: \S/.test(n||'')),`the color and pattern buttons are named with their values (${names.join(' | ')})`);
    // W2-19-03: the color sheet over the item sheet: the item sheet is out of reach, Tab stays in, Escape gives the focus back
    await p.focus('#item-view .colbtn[data-k=primaryColor]');await p.keyboard.press('Enter');await p.waitForTimeout(400);
    ok(await p.evaluate(()=>document.querySelector('#item-view').inert&&document.querySelector('#col-sheet').contains(document.activeElement)),'the color sheet: the focus is in it and the item sheet behind is inert');
    let out=0;for(let i=0;i<30;i++){await p.keyboard.press('Tab');if(await p.evaluate(()=>!document.querySelector('#col-sheet').contains(document.activeElement)))out++}
    ok(out===0,`Tab stays inside the color sheet (${out} of 30 left it)`);
    await p.keyboard.press('Escape');await p.waitForTimeout(300);
    const ce=await p.evaluate(()=>({k:document.activeElement&&document.activeElement.dataset&&document.activeElement.dataset.k,inert:document.querySelector('#item-view').inert}));
    ok(ce.k==='primaryColor'&&!ce.inert,`Escape closes the color sheet and the focus is back on the Color button (${JSON.stringify(ce)})`);
    // picking a color: the sheet is drawn again, the focus comes back to the same field's button
    await p.focus('#item-view .colbtn[data-k=primaryColor]');await p.keyboard.press('Enter');await p.waitForTimeout(300);
    await p.evaluate(()=>{const t=[...document.querySelectorAll('#col-sheet .cptile')].find(b=>b.dataset.c&&b.dataset.c!==colPick.cur&&b.dataset.c!=='none');t.click()});
    await p.evaluate(()=>document.querySelector('#col-sheet .cpbar button').focus());await p.keyboard.press('Enter');await p.waitForTimeout(500);
    ok(await p.evaluate(()=>document.activeElement&&document.activeElement.dataset&&document.activeElement.dataset.k==='primaryColor'&&document.querySelector('#item-view').contains(document.activeElement)),'after Use, the focus is on the Color button of the item drawn again');
    await p.keyboard.press('Escape');await p.waitForTimeout(600);
    ok(await p.evaluate(()=>!editing&&!!document.activeElement.closest('.gi')),`Escape closes the item and the focus is on its box in the grid (${await act()})`);

    // W2-14-02: a color to pick shows above the Keep button, at the default and the largest text
    for(const ts of ['1','1.5']){
      const m=await p.evaluate(async ts=>{document.documentElement.style.setProperty('--tscale',ts);openItem(items[0].id);await new Promise(r=>setTimeout(r,200));
        document.querySelector('#item-view .colbtn[data-k=primaryColor]').click();await new Promise(r=>setTimeout(r,300));
        const sh=document.querySelector('#col-sheet'),bar=sh.querySelector('.cpbar').getBoundingClientRect().top;
        const first=[...sh.querySelectorAll('.cpgrid:not(.cnown) .cptile')][0].getBoundingClientRect();
        const own=sh.querySelector('#cn-open').getBoundingClientRect().top,std=first.top;closeColPick();closeItem();await new Promise(r=>setTimeout(r,500));
        document.documentElement.style.removeProperty('--tscale');return {bar:Math.round(bar),std:Math.round(std),bottom:Math.round(first.bottom),own:Math.round(own)}},ts);
      ok(m.bottom<=m.bar&&m.own>m.std,`text at ${ts}: the first color to pick is whole above the Keep button, "+ New color" after the list (${JSON.stringify(m)})`);
    }

    // W2-19-06: a faded toast is gone for the keyboard and VoiceOver
    const tt=await p.evaluate(async()=>{toast('Saved: test.',300,{label:'Undo',fn:()=>{window.__undone=1}});await new Promise(r=>setTimeout(r,TOAST_ACT_MS+800));const t=document.querySelector('#toast');
      return {text:t.textContent,btn:!!t.querySelector('button'),vis:getComputedStyle(t).visibility}});
    ok(tt.text===''&&!tt.btn&&tt.vis==='hidden',`a toast that has faded holds no words or Undo, and is hidden (${JSON.stringify(tt)})`);
    const tk=await p.evaluate(async()=>{toast('Saved: kept.',300,{label:'Undo',fn:()=>{}});document.querySelector('#toast button').focus();await new Promise(r=>setTimeout(r,TOAST_ACT_MS+800));
      const r=!!document.querySelector('#toast.on button');document.activeElement.blur();await new Promise(r=>setTimeout(r,2000));return {kept:r,gone:!document.querySelector('#toast button')}});
    ok(tk.kept&&tk.gone,`while the keyboard is on its Undo the toast stays, and goes once the focus leaves (${JSON.stringify(tk)})`);

    // W2-19-07, W2-19-08, W2-19-11: contrast in both themes
    const con=await p.evaluate(()=>{const cv=document.createElement('canvas').getContext('2d',{willReadFrequently:true}),P=s=>{cv.clearRect(0,0,1,1);cv.fillStyle='#000';cv.fillStyle=s;cv.fillRect(0,0,1,1);return [...cv.getImageData(0,0,1,1).data].slice(0,3)};
      const L=c=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(c[0])+.7152*f(c[1])+.0722*f(c[2])},R=(a,b)=>{const x=L(P(a)),y=L(P(b));return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
      const bgOf=e=>{for(let x=e.parentElement;x;x=x.parentElement){const c=getComputedStyle(x).backgroundColor;if(!/rgba\(.*, 0\)|transparent/.test(c))return c}return '#fff'};
      const out={};show('wardrobe');
      for(const t of ['light','dark']){document.documentElement.dataset.theme=t;
        askConfirm('Delete?',{ok:'Delete',danger:true});const b=document.querySelector('#ask-sheet .ask-danger'),cs=getComputedStyle(b);const d=R(cs.color,cs.backgroundColor);askAnswer(false);
        const fs=[...document.querySelectorAll('#wsearch,#wsort')].map(e=>R(getComputedStyle(e).borderTopColor,bgOf(e)));
        const g=document.createElement('span');g.className='fit best';document.querySelector('#wardrobe').append(g);const gr=R(getComputedStyle(g).color,bgOf(g));g.remove();
        out[t]={danger:+d.toFixed(2),field:+Math.min(...fs).toFixed(2),green:+gr.toFixed(2)}}
      delete document.documentElement.dataset.theme;return out});
    ok(['light','dark'].every(t=>con[t].danger>=4.5&&con[t].field>=3&&con[t].green>=4.5),`the danger button 4.5:1, field edges 3:1 and green words 4.5:1 in both themes (${JSON.stringify(con)})`);

    // W2-14-01: Today's "Add one" beside a belt opens Add for a belt, and "Add without a photo" starts as a belt
    await p.evaluate(()=>{show('today');if(!listOpen)toggleList()});await p.waitForTimeout(400);
    await p.evaluate(()=>document.querySelector('button.addone[aria-label^="Belt"]').click());await p.waitForTimeout(300);
    const af=await p.evaluate(()=>({add:!document.querySelector('#add').hidden,note:document.querySelector('#add-for').textContent,shown:!document.querySelector('#add-for').hidden}));
    ok(af.add&&af.shown&&/a belt/.test(af.note),`"Add one" beside Belt opens Add, which says a belt is being added (${JSON.stringify(af)})`);
    await p.evaluate(()=>addManual());await p.waitForTimeout(300);
    const ty=await p.evaluate(()=>{const q=queue.find(x=>x.id===npsId);return q&&q.type});
    ok(ty==='belt',`its card without a photo starts as a belt (${ty})`);
    await p.evaluate(()=>{npsClose();queue.splice(0,queue.length);show('today')});
    await p.evaluate(()=>openAdd());
    ok(await p.evaluate(()=>addFor===null&&document.querySelector('#add-for').hidden),"Add from the Wardrobe's + asks for no type");
    // W2-14-10: the pieces list says what ⇄ and − do
    await p.evaluate(()=>show('today'));
    ok(await p.evaluate(()=>{const l=document.querySelector('#today .plegend');return !!l&&/choose another/.test(l.textContent)&&l.getAttribute('aria-hidden')==='true'}),'the open pieces list has a line saying what ⇄ and − do');

    // W2-14-05: the cleaning banner leads somewhere: a tap asks, "Cleaned today" starts the count again
    const cb=await p.evaluate(async()=>{const o=planFor()[key(sel)];const id=o.top.id;const real=careCounts;window.careCounts=()=>({[id]:6});renderToday();
      const b=document.querySelector('#cband');const r={over:!!document.querySelector('.care-over'),role:b&&b.getAttribute('role')};b.querySelector('.ctxt').click();await new Promise(r=>setTimeout(r,100));
      r.ask=document.querySelector('#ask-sheet.on')?document.querySelector('#ask-ok').textContent:'';window.careCounts=real;askAnswer(false);return r});
    ok(cb.over&&cb.role==='button'&&cb.ask==='Cleaned today',`tapping the red "Overdue" banner asks, with "Cleaned today" (${JSON.stringify(cb)})`);

    // W2-14-14: a location set and no weather read: the line says so, with a retry
    await p.evaluate(()=>{settings.location={name:'Kuwait City',lat:29.37,lon:47.98};weather={};renderToday()});
    ok(await p.evaluate(()=>!!document.querySelector('#today .wxretry')),'a location with no forecast read says so, with a way to try again');
    await p.evaluate(()=>{settings.location=null;renderToday()});

    // W2-14-13: the theme button's first tap changes what is on screen and says so
    const th=await p.evaluate(()=>{try{localStorage.removeItem('theme')}catch{}applyTheme('auto');cycleTheme();const r={t:document.documentElement.dataset.theme,msg:document.querySelector('#toast').textContent};cycleTheme();r.t2=document.documentElement.dataset.theme;cycleTheme();r.t3=document.documentElement.dataset.theme||'auto';return r});
    ok(th.t==='dark'&&/Dark theme/.test(th.msg)&&th.t2==='light'&&th.t3==='auto',`on a light phone the first tap goes dark, then light, then automatic (${JSON.stringify(th)})`);

    // W2-14-06 and W2-14-07: a double tap on the tour's Next moves one card; after the setup the first card says what comes
    await p.evaluate(()=>tourOpen(()=>{},'Add my first item'));await p.waitForTimeout(200);
    ok(await p.evaluate(()=>/First, four quick cards/.test(document.querySelector('#kitsheet').textContent)),'the tour opened by "Add my first item" says so on its first card');
    await p.dblclick('#kit-next');await p.waitForTimeout(200);
    ok(await p.evaluate(()=>kit&&kit.at===1),`a double tap on Next moves one card (card ${await p.evaluate(()=>kit&&kit.at+1)})`);
    await p.waitForTimeout(400);await p.click('#kit-next');await p.waitForTimeout(150);
    ok(await p.evaluate(()=>kit&&kit.at===2),'a tap after the pause moves on again');
    await p.evaluate(()=>kitClose());

    // W2-19-16 and W2-19-10: Settings' categories are headings; the day rows are named groups
    const sg=await p.evaluate(()=>{openSettings();const r={h:document.querySelectorAll('#settings-modal h3.scat-h > .scat-head').length,g:[...document.querySelectorAll('#cfg-workdays,#cfg-blazer')].map(e=>e.getAttribute('role')+':'+e.getAttribute('aria-label'))};closeSettings();return r});
    ok(sg.h>=8&&sg.g.join()==='group:Workdays,group:Blazer days',`Settings' categories are headings and the day rows named groups (${JSON.stringify(sg)})`);
    ok(!errs.length,'no page errors'+(errs.length?': '+errs.join(' | '):''));
  }finally{await browser.close()}
};
