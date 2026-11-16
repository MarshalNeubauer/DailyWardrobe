// Accents (2026-11-16, the owner's approved job "keep an item's extra colors"): item.accents holds up to 4 colours beyond the three (core.js
// accentsOf). The Add card's and the item sheet's Colors section show "Also has" chips with × and "+ Add a color" (the colour sheet), the
// summary says "also red, gold"; Claude's tag fills them (app.js normTag / fill); the spreadsheet import reads an "Also has" column; search
// finds an item by an accent; the planner weighs them less than the three (ACC_ECHO, ENAMEL_MINOR; PLAN_RULES 19); sync's field merge keeps
// them; a camouflage is drawn in all its colours (detect.js camoLook); the close-up reader's colour half of kind pattern is "several colors",
// not a failure, and its colours are offered as Also has. No paid calls (nothing reaches a worker).
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844}}),p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);await p.evaluate(()=>{CK_OPEN['*']=true;if(document.querySelector('#setup.on'))setupClose()});
    // ---- the Add card
    await p.evaluate(()=>{openAdd();addManual();setq(0,'type','tie');Object.assign(queue[0],{primaryColor:'navy',secondaryColor:'white',tertiaryColor:null,pattern:'paisley',accents:['red','gold']});renderAdd()});
    let s=await p.evaluate(()=>{const sec=document.querySelector('#nps-q .cks[data-ck="colors"]');return {chips:[...sec.querySelectorAll('.accrow .accchip')].map(x=>x.dataset.c),add:!!sec.querySelector('.accrow .accadd'),sum:sec.querySelector('.ckh small').textContent}});
    ok(s.chips.join()==='red,gold'&&s.add,'the Add card\'s Colors section shows "Also has" chips (red, gold) and "+ Add a color" ('+s.chips+')');
    ok(/Navy · white · also red, gold/.test(s.sum),'its summary mentions them ('+s.sum+')');
    await p.click('#nps-q .accchip[data-c="red"] .accx');
    s=await p.evaluate(()=>({q:queue[0].accents,chips:[...document.querySelectorAll('#nps-q .accrow .accchip')].map(x=>x.dataset.c),chk:queue[0].checked&&queue[0].checked.colors}));
    ok(JSON.stringify(s.q)==='["gold"]'&&s.chips.join()==='gold'&&s.chk,'× takes red off (and checks Colors)');
    await p.click('#nps-q .accadd');await p.waitForSelector('#col-sheet.on');
    s=await p.evaluate(()=>({title:document.querySelector('#col-title').textContent,none:!!document.querySelector('#col-sheet .cptile[data-c="none"]'),main:!!document.querySelector('#col-sheet .cptile[data-c="navy"]'),had:!!document.querySelector('#col-sheet .cptile[data-c="gold"]'),off:document.querySelector('#acc-use').disabled,ask:!!document.querySelector('#col-sheet .cpask')}));
    ok(s.title==='Add a color it also has'&&!s.none&&!s.main&&!s.had&&s.off&&!s.ask,'"Add a color" opens the colour sheet: no None, not its main colours or accents already, no Ask Claude, Add off until a colour is picked');
    await p.click('#col-sheet .cptile[data-c="green"]');ok(await p.evaluate(()=>document.querySelector('#acc-use').textContent==='Add Green'),'picked: "Add Green"');
    await p.click('#acc-use');
    s=await p.evaluate(()=>({q:queue[0].accents,open:document.querySelector('#col-sheet').classList.contains('on')}));
    ok(JSON.stringify(s.q)==='["gold","green"]'&&!s.open,'Add puts it at the end and closes the sheet ('+JSON.stringify(s.q)+')');
    await p.evaluate(()=>{queue[0].accents=['gold','green','red','pink'];renderAdd()});
    ok(await p.evaluate(()=>!document.querySelector('#nps-q .accadd')),'with 4, no "+ Add a color"');
    // Confirm saves them on the item
    const n0=await p.evaluate(()=>items.length);await p.click('#qconf-0');await p.waitForFunction(n=>items.length===n+1,n0);
    ok(await p.evaluate(()=>JSON.stringify(items[items.length-1].accents)==='["gold","green","red","pink"]'),'Confirm keeps them on the saved item');
    // ---- the item sheet
    await p.evaluate(async()=>{const t={id:'acc-tie',type:'tie',primaryColor:'navy',secondaryColor:'burgundy',pattern:'paisley',accents:['gold','navy','red','teal'],added:1};items=[t];await put(t);cache={};npsClose();show('wardrobe');openItem('acc-tie')});
    await p.waitForSelector('#item-view .cks[data-ck="color"] .accrow');
    s=await p.evaluate(()=>{const sec=document.querySelector('#item-view .cks[data-ck="color"]');return {chips:[...sec.querySelectorAll('.accchip')].map(x=>x.dataset.c),sum:sec.querySelector('.ckh small').textContent}});
    ok(s.chips.join()==='gold,red'&&/also gold, red/.test(s.sum),'the item sheet shows its accents as read (a main colour and an unknown key left out) and says them in the summary ('+s.chips+' | '+s.sum+')');
    await p.click('#item-view .accchip[data-c="gold"] .accx');await p.waitForFunction(()=>items[0].accents&&items[0].accents.join()==='red');
    ok(await p.evaluate(async()=>{const d=await tx('readonly',x=>x.get('acc-tie'));return d&&d.accents.join()==='red'}),'× on the sheet saves the item without it');
    await p.click('#item-view .accadd');await p.waitForSelector('#col-sheet.on');await p.click('#col-sheet .cptile[data-c="gold"]');await p.click('#acc-use');
    await p.waitForFunction(()=>items[0].accents&&items[0].accents.join()==='red,gold');
    ok(await p.waitForFunction(()=>[...document.querySelectorAll('#item-view .accchip')].map(x=>x.dataset.c).join()==='red,gold',null,{timeout:3000}).then(()=>true,()=>false),'"Add a color" on the sheet adds and redraws');
    await p.evaluate(()=>{closeColPick();if(typeof closeItem==='function')closeItem()});
    // ---- search
    s=await p.evaluate(async()=>{const o={id:'acc-plain',type:'tie',primaryColor:'navy',pattern:'solid',added:2};items.push(o);await put(o);cache={};show('wardrobe');wardSearch('gold');
      const ids=[...document.querySelectorAll('#wardrobe [data-id]')].map(e=>e.dataset.id);wardSearch('');return {ids,m:wardMatch(items[0],'gold'),n:wardMatch(o,'gold')}});
    ok(s.m&&!s.n,'search: "gold" finds the tie with a gold accent, not the plain one');
    // ---- Claude's tag and the import fill them
    s=await p.evaluate(()=>{const t=normTag({type:'tie',primaryColor:'navy',secondaryColor:'white',tertiaryColor:'none',pattern:'paisley',accents:['red','navy','gold']},'m'),q={id:'q1'};fill(q,t);
      const r=kitRead('Type,Color,Second color,Also has\nTie,Navy,White,"Red, gold, navy, xyzzy"\nShirt,White,,');return {q:q.accents,old:(()=>{const q2={id:'q2'};fill(q2,normTag({type:'tie',primaryColor:'navy',pattern:'solid'},'m'));return 'accents' in q2})(),
        k:r.rows[0].card.accents,probs:r.rows[0].probs,k2:'accents' in r.rows[1].card,item:kitItem(r.rows[0].card).accents}});
    ok(JSON.stringify(s.q)==='["red","gold"]'&&!s.old,'Claude\'s accents fill the card (its main colours left out); an older worker\'s tag leaves none');
    ok(JSON.stringify(s.k)==='["red","gold"]'&&s.probs.some(x=>/also-has color “xyzzy” left out/.test(x))&&!s.k2&&JSON.stringify(s.item)==='["red","gold"]','the spreadsheet import reads an "Also has" column (its main colours and unknown words left out, said) and the item keeps it ('+JSON.stringify([s.k,s.probs,s.k2,s.item])+')');
    // ---- the planner: weaker than the three
    s=await p.evaluate(()=>{const red={type:'cufflinks',primaryColor:'red',metal:'silver'},tie={type:'tie',primaryColor:'navy',pattern:'paisley',secondaryColor:'gold'};
      const sh={type:'shirt',primaryColor:'white',secondaryColor:'red',pattern:'stripe'},top={type:'suit',primaryColor:'charcoal',pattern:'solid'};
      return {rules:PLAN_RULES,clash:enamelPref(red,tie),minor:enamelPref(red,{...tie,accents:['red']}),full:enamelPref(red,{...tie,secondaryColor:'red'}),
        t0:tieScore(top,sh,tie),ta:tieScore(top,sh,{...tie,accents:['red']}),t2:tieScore(top,sh,{...tie,secondaryColor:'red'}),
        back:tieScore(top,{...sh,secondaryColor:null,pattern:'solid',accents:['gold']},tie)-tieScore(top,{...sh,secondaryColor:null,pattern:'solid'},tie)}});
    ok(s.rules===19,'PLAN_RULES is 19 (planned days re-plan once)');
    ok(s.clash===-5&&s.minor===4&&s.full===11,`red cufflinks with a navy paisley tie: clash ${s.clash}; with a red accent ${s.minor}; with red as its second colour ${s.full} (an accent counts, weaker)`);
    ok(s.ta-s.t0===1&&s.t2-s.t0===3&&s.back===1,`a tie whose red accent echoes the shirt's red stripe +${s.ta-s.t0} (a red second colour +${s.t2-s.t0}); a shirt's gold accent echoing the tie's gold +${s.back}`);
    // ---- sync: the field merge keeps accents changed on one phone and a name on another
    s=await p.evaluate(()=>{const cur={id:'m1',type:'tie',primaryColor:'navy',pattern:'paisley',added:1,updated:100};
      const a=itemFields({...cur,accents:['red'],updated:200},cur),b=itemFields({...cur,name:'Paisley',updated:300},cur),m=mergeItem(a,b),m2=mergeItem(b,a);
      const c=cleanRecord({...cur,accents:['red','light blue',7,'<x>']});return {m:m.accents,n:m.name,m2:m2.accents,c:c.accents,again:JSON.stringify(cleanRecord(c))===JSON.stringify(c)}});
    ok(JSON.stringify(s.m)==='["red"]'&&s.n==='Paisley'&&JSON.stringify(s.m2)==='["red"]','sync\'s field merge keeps accents from one phone and the name from the other');
    ok(JSON.stringify(s.c)==='["red","lightblue","x"]'||JSON.stringify(s.c)==='["red","lightblue"]','cleanRecord keeps accents as colour keys ('+JSON.stringify(s.c)+')');
    ok(s.again,'and is idempotent on them');
    // ---- camouflage in all its colours
    s=await p.evaluate(async()=>{const it={id:'cm-acc',type:'pants',primaryColor:'khaki',secondaryColor:'brown',tertiaryColor:'olive',pattern:'camouflage',accents:['cream','black']},plain={...it,id:'cm-plain',accents:undefined};
      const st=usableSett(it),sp=usableSett(plain),url=camoTileUrl(st.camo),im=await new Promise((r,j)=>{const x=new Image();x.onload=()=>r(x);x.onerror=j;x.src=url});
      const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const x=c.getContext('2d');x.drawImage(im,0,0);const d=x.getImageData(0,0,c.width,c.height).data,n=d.length/4;
      const want=['khaki','brown','olive','cream','black'].map(k=>hexRgb(COLORS[k])),cnt=want.map(()=>0);
      for(let k=0;k<d.length;k+=4)want.forEach((w,j)=>{if(Math.abs(d[k]-w[0])+Math.abs(d[k+1]-w[1])+Math.abs(d[k+2]-w[2])<12)cnt[j]++});
      return {want:['khaki','brown','olive','cream','black'].map(k=>COLORS[k]).join(),cols:st.camo.cols,shares:st.camo.shares,frac:cnt.map(v=>+(v/n).toFixed(3)),pl:sp.camo.cols.length,pl0:sp.camo.cols[0]===colOf(plain),pl1:sp.camo.cols[1]===COLORS.brown,sw:/<image href="data:image\/png/.test(swatchSVG(it,true))}});
    ok(s.cols.join()===s.want&&s.shares[0]===Math.max(...s.shares)&&s.shares.every((v,k)=>!k||v<=s.shares[k-1]),'a camouflage with 2 accents takes 5 real colours: the ground the largest share, each further one smaller ('+s.shares.join(', ')+')');
    ok(s.frac.every(v=>v>.02)&&s.sw,'its swatch draws all 5 distinct colours (share of pixels: '+s.frac.join(', ')+')');
    ok(s.pl===5&&s.pl0&&s.pl1,'one without accents is drawn as before');
    // ---- the close-up reader: a colour half of kind pattern is several colours, not a failure; several offers the main colour and accents
    s=await p.evaluate(async()=>{const it={id:'rd-camo',type:'pants',primaryColor:'khaki',pattern:'camouflage',added:3};items=[it];await put(it);cache={};
      const col={kind:'pattern',ask:'That sounds like a pattern.',accents:['olive','brown','black']};
      rd={src:'e',id:'rd-camo',run:7,state:'result',c:rdColOf(col),p:{na:'fail'},m:null,a:rdAccOf(it,col),sent:{wb:true}};rdOpen();rdRender(true);
      const t=document.querySelector('#rd-sheet').textContent;return {sev:!!document.querySelector('#rd-several'),fail:/couldn’t read the color/.test(t),chips:[...document.querySelectorAll('#rd-acc .accchip')].length,bar:document.querySelector('#rd-both').textContent}});
    ok(s.sev&&!s.fail,'a colour half that says "pattern" shows "This cloth has several colors", not "couldn\'t read the color"');
    ok(s.chips===3&&s.bar==='Use these colors','its colours are offered as Also has, with their own Use ('+s.bar+')');
    await p.click('#rd-ause');await p.waitForFunction(()=>items[0].accents&&items[0].accents.length===3);
    ok(await p.evaluate(()=>items[0].accents.join()==='olive,brown,black'&&items[0].primaryColor==='khaki'),'Use sets them; the main colour stays');
    s=await p.evaluate(async()=>{const it=items[0];delete it.accents;await put(it);
      const col={kind:'several',existing:'tan',dE:1.2,name:'coyote',hex:'#b8946a',plansAs:'tan',confidence:'high',why:'',ask:'x',accents:['olive','brown']};
      rd={src:'e',id:'rd-camo',run:8,state:'result',c:rdColOf(col),p:{na:'fail'},m:null,a:rdAccOf(it,col),sent:{wb:true}};rdOpen();rdRender(true);
      return {col:!!document.querySelector('#rd-col #rd-cuse'),acc:[...document.querySelectorAll('#rd-acc .accchip')].length,bar:document.querySelector('#rd-both').textContent}});
    ok(s.col&&s.acc===2&&s.bar==='Use both','a several answer offers its main colour (Use) and the others as Also has; "Use both" takes both');
    await p.click('#rd-both');await p.waitForFunction(()=>items[0].accents&&items[0].accents.length===2);
    ok(await p.evaluate(()=>items[0].primaryColor==='tan'&&items[0].accents.join()==='olive,brown'),'Use both sets the main colour and the accents');
    await p.waitForFunction(()=>!rd&&rdLast&&rdLast.a&&rdLast.c);await p.evaluate(()=>rdUndoAll());await p.waitForFunction(()=>!items[0].accents&&items[0].primaryColor==='khaki');
    ok(true,'Undo puts both back');
    ok(!errs.length,'no page errors: '+errs.join(' | '));
  }finally{await browser.close()}};
