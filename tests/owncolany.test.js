// The owner's own colours for any kind of item (2026-11-16, the owner: "I want it to be coyote brown, so I ask Claude, but I can't pick it
// because it says I already have that color, but the color picker doesn't let me pick my added colors"): an own colour made for pants is
// not in a T-shirt's lists but is in its "Your other colors"; picking it sets the T-shirt's colour and offers the colour for T-shirts from
// then on (settings.custom, saved with a new stamp, Undo); New color's "Use Coyote brown" (Claude's /describe says you already have it,
// mocked: no paid call) and a typed name that is already an own colour do the same; a stripe colour turns on stripes and motifs; the new
// colour groups (casual tops, casual jackets, the pocket square with the tie); the existing kinds' lists are unchanged. 390 px.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const ctx=await browser.newContext({viewport:{width:390,height:844}});
  let reply=()=>[200,{}],bodies=[];
  await ctx.route('https://w.test/**',async route=>{const q=route.request(),u=new URL(q.url());
    if(u.pathname==='/describe'){const b=JSON.parse(q.postData()||'{}');bodies.push(b);const [s,j]=reply(b);return route.fulfill({status:s,headers:{'content-type':'application/json','access-control-allow-origin':'*'},body:JSON.stringify(j)})}
    if(q.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'content-type,x-app-token','access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS'}});
    return route.fulfill({status:503,headers:{'content-type':'application/json','access-control-allow-origin':'*'},body:'{"error":"server"}'})});
  await ctx.addInitScript(()=>{localStorage.setItem('worker_url','https://w.test/');localStorage.setItem('app_token','tok')});
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  const CB='owncoyotebrown',toastWait=re=>p.waitForFunction(s=>new RegExp(s).test(document.querySelector('#toast').textContent),re,{timeout:5000}).catch(()=>{});
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const before=await p.evaluate(()=>Object.fromEntries(['suit','blazer','pants','shirt','tie','socks','shoes','tee','chore','pocketsquare'].map(t=>[t,colsFor(t).join()+'|'+colsFor(t,true).join()])));
    await p.evaluate(async CB=>{rememberRole({role:'owner'});
      settings.custom={colors:[{key:CB,name:'Coyote brown',hex:'#81613c',base:'tan',types:['suit','blazer','pants'],accent:false}],patterns:[]};applyCustom(settings.custom);await saveUserSettings();
      items=[{id:'p1',type:'pants',primaryColor:'charcoal',pattern:'solid',added:1},{id:'tee1',type:'tee',primaryColor:'white',pattern:'solid',added:2},
        {id:'tee2',type:'tee',primaryColor:'navy',pattern:'stripe',secondaryColor:'white',added:3},{id:'po1',type:'polo',primaryColor:'navy',pattern:'solid',added:4}]},CB);
    // ---- the groups
    const g=await p.evaluate(()=>({tee:groupOf('tee'),hoodie:groupOf('hoodie'),chore:groupOf('chore'),cardigan:groupOf('cardigan'),ps:groupOf('pocketsquare'),tie:groupOf('tie'),suit:groupOf('suit'),shirt:groupOf('shirt'),fresh:groupOf('tee')!==groupOf('tee')}));
    ok(g.tee.join()==='tee,polo,henley,sweater,sweatshirt,hoodie,qzip'&&g.hoodie.join()===g.tee.join(),'a new color made on a casual top is offered for every casual top ('+g.tee+')');
    ok(g.chore.join()==='cardigan,chore,blouse'&&g.cardigan.join()==='cardigan,chore,blouse','… on a casual jacket for every casual jacket (the uniform blouse too)');
    ok(g.ps.join()==='tie,pocketsquare'&&g.tie.join()==='tie,pocketsquare','the pocket square goes with the tie');
    ok(g.suit.join()==='suit,blazer,pants'&&g.shirt.join()==='shirt'&&g.fresh,'the other groups are as before (and each call gives a copy, so "Offer it for" can\'t change the group)');
    // ---- the T-shirt's picker
    await p.evaluate(()=>openColPick('e','tee1','primaryColor'));
    let s=await p.evaluate(CB=>{const sh=document.querySelector('#col-sheet'),oth=sh.querySelector('.cpother');
      return {heads:[...sh.querySelectorAll('.cph')].map(h=>h.textContent),inOther:!!(oth&&oth.querySelector(`[data-c="${CB}"]`)),
        elsewhere:[...sh.querySelectorAll(`[data-c="${CB}"]`)].filter(b=>!b.closest('.cpother')).length,note:(sh.querySelector('.cpothx')||{}).textContent||'',
        listed:colsFor('tee').includes(CB),wide:document.documentElement.scrollWidth>innerWidth||sh.scrollWidth>sh.clientWidth}},CB);
    ok(!s.listed&&s.elsewhere===0,'Coyote brown (made for pants) is not in a T-shirt\'s colors');
    ok(s.inOther&&s.heads.includes('Your other colors')&&/offered for T-shirts too/.test(s.note),`… but is in the T-shirt's "Your other colors" (${s.heads.slice(0,3)}; ${s.note})`);
    ok(!s.wide,'the picker has no sideways scroll at 390 px');
    if(process.env.OWNCOL_SHOT){await p.evaluate(()=>{const h=document.querySelector('#cp-other-h');document.querySelector('#col-sheet').scrollTop=Math.max(0,h.offsetTop-260)});await p.waitForTimeout(300);await p.screenshot({path:process.env.OWNCOL_SHOT})}
    await p.evaluate(()=>closeColPick());
    await p.evaluate(()=>openColPick('e','p1','primaryColor'));
    ok(await p.evaluate(CB=>!document.querySelector('#col-sheet .cpother')&&!!document.querySelector(`#col-sheet .cnown [data-c="${CB}"]`),CB),'on pants it is in "Your colors" and there is no "Your other colors"');
    await p.evaluate(()=>closeColPick());
    // ---- picking it on the T-shirt
    const ks0=await p.evaluate(()=>+settings.ks.custom||0);
    await p.evaluate(()=>openColPick('e','tee1','primaryColor'));
    await p.click(`#col-sheet .cpother [data-c="${CB}"]`);
    ok(/Use Coyote brown/.test(await p.textContent('#col-sheet .cpbar button')),'picking it offers "Use Coyote brown"');
    await p.click('#col-sheet .cpbar button');
    await p.waitForFunction(CB=>items.find(x=>x.id==='tee1').primaryColor===CB,CB,{timeout:5000}).catch(()=>{});await toastWait('T-shirts too');
    let r=await p.evaluate(async CB=>{const st=await metaGet('settings'),c=settings.custom.colors[0],sc=st.custom.colors.find(x=>x.key===CB);
      return {col:items.find(x=>x.id==='tee1').primaryColor,types:c.types,stored:sc&&sc.types,listed:colsFor('tee').includes(CB),polo:colsFor('polo').includes(CB),ks:+settings.ks.custom||0,toast:document.querySelector('#toast').textContent,undo:!!document.querySelector('#toast button')}},CB);
    ok(r.col===CB,'the T-shirt is Coyote brown');
    ok(r.types.join()==='suit,blazer,pants,tee'&&r.stored&&r.stored.join()===r.types.join()&&r.listed&&!r.polo,`… and Coyote brown is offered for T-shirts from now on, saved (${r.types}; polo not: only the kind it was used for)`);
    ok(r.ks>ks0,`the settings change is stamped for sync (custom ${ks0} → ${r.ks})`);
    ok(/Coyote brown is now offered for T-shirts too\./.test(r.toast)&&r.undo,'the toast says so, with Undo: '+r.toast);
    await p.click('#toast button');
    await p.waitForFunction(CB=>!colsFor('tee').includes(CB),CB,{timeout:3000}).catch(()=>{});
    r=await p.evaluate(async CB=>{const st=await metaGet('settings');return {types:settings.custom.colors[0].types.join(),stored:st.custom.colors[0].types.join(),col:items.find(x=>x.id==='tee1').primaryColor}},CB);
    ok(r.types==='suit,blazer,pants'&&r.stored===r.types&&r.col===CB,`Undo takes T-shirts off it again (the T-shirt keeps its color) (${r.types})`);
    // ---- New color → Ask Claude: "You already have it" → Use Coyote brown
    reply=()=>[200,{kind:'colour',match:'existing',existing:CB,dE:1.4,name:'coyote brown',hex:'#7f5f3b',plansAs:'tan',fitsType:true,confidence:'high',why:'That is your coyote brown.',ask:null}];
    await p.evaluate(()=>{items.find(x=>x.id==='tee1').primaryColor='white';openColPick('e','tee1','primaryColor')});
    await p.click('#cn-open');await p.fill('#cn-text','coyote brown');await p.click('#cn-ask');await p.waitForSelector('#cn-res');
    s=await p.evaluate(()=>({text:document.querySelector('#cn-res').textContent,bar:document.querySelector('#cn-add').textContent}));
    ok(/You already have it/.test(s.text)&&s.bar==='Use Coyote brown'&&bodies.at(-1).type==='tee',`Claude says you already have it: "${s.bar}"`);
    await p.click('#cn-add');
    await p.waitForFunction(CB=>items.find(x=>x.id==='tee1').primaryColor===CB,CB,{timeout:5000}).catch(()=>{});await toastWait('T-shirts too');
    r=await p.evaluate(CB=>({col:items.find(x=>x.id==='tee1').primaryColor,listed:colsFor('tee').includes(CB),open:document.querySelector('#col-sheet').classList.contains('on'),toast:document.querySelector('#toast').textContent}),CB);
    ok(r.col===CB&&r.listed&&!r.open&&/offered for T-shirts too/.test(r.toast),`"Use Coyote brown" sets it on the T-shirt and offers it for T-shirts (${JSON.stringify(r)})`);
    // ---- New color with the name typed: the one already had is used, not refused
    await p.evaluate(()=>openColPick('e','po1','primaryColor'));await p.click('#cn-open');
    await p.fill('#cn-name','coyote Brown');await p.dispatchEvent('#cn-name','change');await p.click('#cn-add');
    await p.waitForFunction(CB=>items.find(x=>x.id==='po1').primaryColor===CB,CB,{timeout:5000}).catch(()=>{});
    r=await p.evaluate(CB=>({col:items.find(x=>x.id==='po1').primaryColor,n:settings.custom.colors.length,listed:colsFor('polo').includes(CB),err:(document.querySelector('#cn-error')||{}).textContent||''}),CB);
    ok(r.col===CB&&r.n===1&&r.listed&&!r.err,`a typed name of an own color uses it on the polo instead of "There is already a color with that name" (${JSON.stringify(r)})`);
    // ---- a stripe colour
    await p.evaluate(()=>openColPick('e','tee2','secondaryColor'));
    ok(await p.evaluate(CB=>!!document.querySelector(`#col-sheet .cpother [data-c="${CB}"]`)&&!colsFor('tee',true).includes(CB),CB),'for the stripe, Coyote brown (no stripes yet) is in "Your other colors"');
    await p.click(`#col-sheet .cpother [data-c="${CB}"]`);await p.click('#col-sheet .cpbar button');
    await p.waitForFunction(CB=>items.find(x=>x.id==='tee2').secondaryColor===CB,CB,{timeout:5000}).catch(()=>{});await toastWait('stripes and motifs');
    r=await p.evaluate(CB=>({col:items.find(x=>x.id==='tee2').secondaryColor,acc:settings.custom.colors[0].accent,a:colsFor('tee',true).includes(CB),toast:document.querySelector('#toast').textContent}),CB);
    ok(r.col===CB&&r.acc&&r.a&&/and their stripes and motifs too/.test(r.toast),`picked for the stripe it is set and offered for stripes and motifs (${r.toast})`);
    // ---- the picker's Ask Claude (the tagger's answer, stubbed): Claude names an own color made for another kind
    await p.evaluate(()=>{items.push({id:'hd1',type:'hoodie',primaryColor:'grey',pattern:'solid',added:5,texture:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='});
      colAsk['hd1|c']={primaryColor:'brown',secondaryColor:'none',tertiaryColor:'none',conf:{primaryColor:'high'},own:{primaryColor:{name:'coyote brown',hex:'#80603c'}}};openColPick('e','hd1','primaryColor')});
    ok(await p.evaluate(CB=>!!document.querySelector(`#col-sheet .cpai [data-c="${CB}"]`)&&!colsFor('hoodie').includes(CB),CB),'Claude reads a hoodie as coyote brown: "Your color" Coyote brown is offered beside its listed pick');
    await p.click(`#col-sheet .cpai [data-c="${CB}"]`);await p.click('#col-sheet .cpbar button');
    await p.waitForFunction(CB=>items.find(x=>x.id==='hd1').primaryColor===CB,CB,{timeout:5000}).catch(()=>{});await toastWait('hoodies too');
    r=await p.evaluate(CB=>({col:items.find(x=>x.id==='hd1').primaryColor,listed:colsFor('hoodie').includes(CB),toast:document.querySelector('#toast').textContent}),CB);
    ok(r.col===CB&&r.listed&&/offered for hoodies too/.test(r.toast),`… and using it sets it and offers it for hoodies (${r.toast})`);
    // ---- the other kinds' lists
    await p.evaluate(()=>{settings.custom={colors:[],patterns:[]};applyCustom(settings.custom)});
    const after=await p.evaluate(()=>Object.fromEntries(['suit','blazer','pants','shirt','tie','socks','shoes','tee','chore','pocketsquare'].map(t=>[t,colsFor(t).join()+'|'+colsFor(t,true).join()])));
    ok(JSON.stringify(after)===JSON.stringify(before),'every kind\'s own lists are as before');
    ok(!errs.length,'no page errors: '+errs.join(' | '));
  }finally{await browser.close()}};
