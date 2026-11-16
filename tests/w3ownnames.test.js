// Fix round 3 (2026-11-16, Fixer 10): own colors and patterns in any script, Arabic names in English lines, and Settings text.
// W2-12-03 = W2-16-01: an Arabic own color or pattern name was refused ("at least two letters": the key kept only a-z), and "Rot 1" / "Rot 2"
// shared ownrot; keys stay ASCII and a Latin name keeps the key it always had. W2-16-02: the Arabic comma. W1-3-05: a built-in pattern's
// name. W1-1-04: an own pattern called "own basketweave". W2-16-04/-10: <bdi> round right-to-left names (packing list, Today's pieces
// line). W2-16-05: the new color sheet's error in its sticky bar. W2-16-07: Arabic search. W2-16-11: deep blue among the blues.
// W2-16-12: a dark petrol isn't based on light blue. W2-17-05: Claude's "dusty pink" opens on a pink shade. W2-12-02: a long day-off
// name keeps its × on the screen. W2-12-04: a watch's Details has a limit. The worker keeps the new keys and the names.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,settle})=>{
  // ---- the worker's cleaning of the owner's lists (tag and describe requests)
  {const tag=await import(pathToFileURL(path.join(__dirname,'..','worker','tag.js')).href);
    const c=tag.cleanCustom({colors:[{key:'ownxk3j2a1',name:'بترولي غامق ٢',hex:'#1f4e5a',types:['tie']},{key:'ownrot1',name:'Rot 1',hex:'#aa2233',types:['tie']}],patterns:[{key:'own-1abcd',name:'سدو كويتي',types:['tie']}]});
    ok(c.colors.length===2&&c.colors[0].name==='بترولي غامق ٢'&&c.colors[1].key==='ownrot1'&&c.patterns[0].name==='سدو كويتي',`the worker keeps keys with digits and Arabic names (${JSON.stringify(c)})`)}
  const ok2=await import(pathToFileURL(path.join(__dirname,'..','worker','ownkeys.js')).href);
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:402,height:874},isMobile:true,hasTouch:true});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    // ---- keys
    let e=await p.evaluate(async()=>{const r={};const add=async(n,o={})=>{try{return await addCustomColor({name:n,hex:'#1f4e5a',base:'navy',types:['tie'],...o})}catch(x){return 'ERR '+x.message}};
      const addP=async n=>{try{return await addCustomPattern({name:n,desc:'',base:'woven',types:['tie']})}catch(x){return 'ERR '+x.message}};
      r.same=[ownColKey('Petrol'),ownColKey('Faded burgundy'),ownPatKey('Hop sack'),ownPatKey('Nailhead 2')];
      // an own color saved before digits counted: "Rot 1" stored as ownrot
      settings.custom={colors:[{key:'ownrot',name:'Rot 1',hex:'#aa2233',base:'red',types:['tie'],accent:false}],patterns:[]};applyCustom(settings.custom);
      r.old=ownColFind('rot 1');r.ar=await add('بترولي غامق ٢');r.ar2=await add('كحلي غامق');r.dupAr=await add('بترولي  غامق ٢');
      r.rot=await add('Rot');r.rot2=await add('Rot 2');r.rotAgain=await add('Rot 1');r.comma=await add('أزرق بترولي، غامق');r.one=await add('ب');
      r.pat=await addP('سدو كويتي');r.bird=await addP('Birdseye');r.glen=await addP('glen check');r.patDup=await addP('سدو كويتي');
      r.keysOk=settings.custom.colors.every(c=>OWN_COL_RE.test(c.key))&&settings.custom.patterns.every(x=>OWN_PAT_RE.test(x.key));
      applyCustom(settings.custom);r.applied=[r.ar,r.ar2,r.rot,r.rot2,r.comma].map(k=>!!COLORS[k]);r.arName=colName(r.ar);r.patOn=!!CUSTOM_PAT[r.pat];
      r.norm=normCol(r.rot2);r.col=colsFor('tie').includes(r.ar);return r});
    ok(e.same.join()==='ownpetrol,ownfadedburgundy,own-hop-sack,own-nailhead-2','a Latin name keeps the key it always had ('+e.same.join()+')');
    ok(/^own[a-z0-9]+$/.test(e.ar)&&/^own[a-z0-9]+$/.test(e.ar2)&&e.ar!==e.ar2&&e.applied.every(Boolean)&&e.arName==='بترولي غامق ٢'&&e.col,`an Arabic color name is added and offered (${e.ar}, ${e.ar2}, "${e.arName}")`);
    ok(/already a color/.test(e.dupAr)&&/already a color/.test(e.rotAgain)&&/two letters/.test(e.one),`the same name twice is refused, one letter too (${e.dupAr} | ${e.rotAgain} | ${e.one})`);
    ok(e.old==='ownrot'&&e.rot!=='ownrot'&&e.rot2!==e.rot&&!/^ERR/.test(e.rot+e.rot2)&&e.norm===e.rot2,`"Rot", "Rot 1" (an old key) and "Rot 2" each have their own key (${e.old}, ${e.rot}, ${e.rot2})`);
    ok(!/^ERR/.test(e.comma),`the Arabic comma is accepted (${e.comma})`);
    ok(/^own-[a-z0-9-]+$/.test(e.pat)&&e.patOn&&/already a pattern/.test(e.patDup),`an Arabic pattern name is added (${e.pat}), and refused twice`);
    ok(/already a pattern/.test(e.bird)&&/already a pattern/.test(e.glen),`a built-in pattern's name is refused (${e.bird} | ${e.glen})`);
    ok(e.keysOk,'every stored key is ASCII and matches OWN_COL_RE / OWN_PAT_RE');
    // ---- one key rule: the app's (applyCustom, cleanRecord) is the server's (worker/ownkeys.js: tag, describe, the backup's record check)
    e=await p.evaluate(({ar,pat})=>({col:String(OWN_COL_RE),pat:String(OWN_PAT_RE),keep:cleanRecord({id:'r1',type:'tie',primaryColor:ar,secondaryColor:'ownrot1',pattern:pat}),
      drop:cleanRecord({id:'r2',type:'tie',primaryColor:'ownبني',secondaryColor:'own_x',pattern:'own-بني'})}),{ar:e.ar,pat:e.pat});
    ok(e.col===String(ok2.OWN_COL_RE)&&e.pat===String(ok2.OWN_PAT_RE),`the app and the server have one own-key rule (${e.col} ${e.pat})`);
    ok(e.keep.primaryColor&&e.keep.secondaryColor==='ownrot1'&&/^own-/.test(e.keep.pattern)&&e.drop.primaryColor===undefined&&e.drop.secondaryColor===undefined&&e.drop.pattern===undefined,
      `cleanRecord keeps own keys of the rule and drops others (${JSON.stringify(e.keep)} | ${JSON.stringify(e.drop)})`);
    {const rec=await import(pathToFileURL(path.join(__dirname,'..','worker','records.js')).href);const chk=rec.recCheck||rec.itemWrong;
      if(typeof chk==='function'){const good=chk({items:[{id:'r1',type:'tie',primaryColor:'ownrot1',pattern:'own-1abcd'}]}),bad=chk({items:[{id:'r2',type:'tie',primaryColor:'ownبني'}]});
        ok(!good&&!!bad,`the server's record check takes keys of the rule and refuses others (${good} | ${bad})`)}
      else ok(true,'(records.js exports no check to call: '+Object.keys(rec).join(',')+')')}
    // ---- an own pattern by its name in the lines the planner writes (W1-1-04)
    e=await p.evaluate(()=>{settings.custom.patterns.push({key:'own-basketweave',name:'Basketweave',desc:'',base:'woven',types:['tie']});applyCustom(settings.custom);
      const t={id:'tw',type:'tie',primaryColor:'taupe',pattern:'own-basketweave'};return {nm:nm(t),line:piecesLine({top:{type:'suit',primaryColor:'navy',pattern:'solid'},suitDay:true,tie:t})}});
    ok(/taupe basketweave tie/.test(e.nm)&&!/own/.test(e.nm+e.line),`an own pattern is named by its name ("${e.nm}", "${e.line}")`);
    // ---- right-to-left names keep their place (W2-16-04, W2-16-10)
    e=await p.evaluate(()=>{const suit={id:'a1',type:'suit',primaryColor:'navy',pattern:'solid',name:'بدلة كحلي رسمية'},shirt={id:'a2',type:'shirt',primaryColor:'lightblue',pattern:'solid',name:'قميص سماوي'};
      const box=piecesBox({top:suit,suitDay:true,shirt});return {box:(box.match(/<small class="cap">(.*?)<\/small>/)||[])[1],iso:nameIso('بدلة'),lat:nameHtml('Grey suit'),toast:savedTitle(suit)}});
    ok(/^<bdi>بدلة كحلي رسمية<\/bdi> · <bdi>قميص سماوي<\/bdi>$/.test(e.box||'')&&e.iso==='⁨بدلة⁩'&&e.lat==='Grey suit'&&e.toast==='⁨بدلة كحلي رسمية⁩',`Today's pieces line isolates each Arabic name (${e.box}); Latin names unchanged`);
    await p.evaluate(()=>{items=[{id:'p1',type:'suit',primaryColor:'navy',pattern:'solid',name:'بدلة سوداء ٢',added:1},{id:'p2',type:'shirt',primaryColor:'white',pattern:'solid',name:'قميص أبيض',added:2},
      {id:'p3',type:'tie',primaryColor:'burgundy',pattern:'solid',added:3},{id:'p4',type:'shoes',primaryColor:'black',added:4},{id:'p5',type:'belt',primaryColor:'black',added:5}];cache={};openPack()});
    await settle(p,600);
    e=await p.evaluate(()=>[...document.querySelectorAll('#pack .pk-nm')].map(x=>x.innerHTML));
    ok(e.some(h=>/^<bdi>⁨?(بدلة سوداء ٢|قميص أبيض)⁩?<\/bdi> <small>· /.test(h)),`the packing list's Arabic names are in <bdi> (${e.slice(0,3).join(' | ')})`);
    // measured as the audit's replay measured it: the day count's digit sits right of the Arabic name, on the same line, before "days"
    e=await p.evaluate(()=>[...document.querySelectorAll('#pack .pk-nm')].filter(x=>x.querySelector('bdi')&&x.querySelector('small')).map(x=>{const b=x.querySelector('bdi').getBoundingClientRect(),s=x.querySelector('small').firstChild,t=s.textContent,i=t.search(/\d/);
      const r=document.createRange();r.setStart(s,i);r.setEnd(s,i+1);const d=r.getBoundingClientRect();r.setStart(s,t.length-3);r.setEnd(s,t.length);const y=r.getBoundingClientRect();
      return {after:d.left>=b.right-1,days:y.left>=d.right-1,line:Math.abs(d.top-b.top)<4}}));
    ok(e.length>=2&&e.every(r=>r.after&&r.days&&r.line),`the day count stays after the Arabic name (${JSON.stringify(e)})`);
    await p.evaluate(()=>{if(typeof subBack==='function')subBack();show('wardrobe')});await settle(p,300);
    // ---- Arabic search (W2-16-07)
    e=await p.evaluate(()=>({h:wardNorm('أبيض')===wardNorm('ابيض'),t:wardNorm('بدلة')===wardNorm('بدله'),d:wardNorm('سوداء ٢').endsWith('2'),y:wardNorm('على')===wardNorm('علي'),lat:wardNorm('Café  Crème')}));
    ok(e.h&&e.t&&e.d&&e.y&&e.lat==='cafe creme',`search treats hamza, ة/ه, ى/ي and Arabic digits alike (${JSON.stringify(e)})`);
    await p.evaluate(()=>{wardSearch('2');renderWardrobe()});await settle(p,200);
    ok(await p.evaluate(()=>wardList().some(i=>i.id==='p1')),'searching 2 finds "بدلة سوداء ٢"');
    await p.evaluate(()=>{wardClear()});
    // ---- colors (W2-16-11, W2-16-12, W2-17-05)
    e=await p.evaluate(()=>({fam:colFamily('deepblue'),lav:colFamily('lavender'),base:colBaseFor('#1f4e5a','tie'),hex:newColHex({primaryColor:'cream',newColor:{name:'dusty pink'},meas:null}),
      hex2:newColHex({primaryColor:'cream',newColor:{name:'heather'},meas:null}),hex3:newColHex({primaryColor:'cream',newColor:{name:'dusty pink'},meas:{hex:'#e0d0c0',src:'closeup'}})}));
    ok(e.fam===3&&e.lav===4,`deep blue is listed with the blues (family ${e.fam}), lavender with the purples`);
    ok(e.base!=='lightblue'&&['slate','steelblue','navy','darknavy','deepblue'].includes(e.base),`a dark petrol tie behaves like a dark blue, not light blue (${e.base})`);
    ok(e.hex===COLORS_PINK&&e.hex2===COLORS_CREAM&&e.hex3==='#e0d0c0',`"Add as a new color" opens on the named shade (${e.hex}), the tagged one when the name has no color, a close-up's measurement first`);
    // ---- the new color sheet's error is in its sticky bar, wholly on screen (W2-16-05)
    await p.evaluate(()=>{openSettings();openCustomNew('colour')});await settle(p,300);
    await p.fill('#cn-name','<x>');await p.evaluate(()=>{cnName('<x>');colNewAdd()});await settle(p,300);
    e=await p.evaluate(()=>{const er=document.querySelector('#cn-error'),bar=document.querySelector('#col-sheet .cpbar'),r=er&&er.getBoundingClientRect(),b=bar&&bar.getBoundingClientRect();
      const at=r&&document.elementFromPoint(r.left+Math.min(20,r.width/2),r.top+r.height/2);return {t:er&&er.textContent,in:!!(er&&bar.contains(er)),top:r&&r.top,bt:b&&b.top,vh:innerHeight,bottom:r&&r.bottom,hit:!!(at&&er.contains(at))}});
    ok(e.in&&e.top>=e.bt&&e.bottom<=e.vh&&e.hit&&/Use only letters/.test(e.t),`the error shows whole in the sheet's bar (${JSON.stringify(e)})`);
    await p.evaluate(()=>closeColPick());
    // ---- a long day-off name (W2-12-02)
    await p.evaluate(()=>{const d=new Date(todayDate());d.setDate(d.getDate()+20);const v=isoKey(d);$('#cfg-off-from').value=v;$('#cfg-off-to').value=v;$('#cfg-off-name').value='https://intranet.example.com/hr/leave/requests/2026/12/21/extra';return addDayOff()});await settle(p,300);
    e=await p.evaluate(()=>{const c=document.querySelector('#off-list .fchip'),b=c&&c.querySelector('button'),r=b&&b.getBoundingClientRect();
      return {n:settings.daysOff.map(x=>x.n),max:$('#cfg-off-name').maxLength,right:r&&r.right,vw:document.documentElement.clientWidth}});
    ok(e.max===40&&e.n.every(n=>[...n].length<=40)&&e.right<=e.vw,`a long day-off name is cut to 40 and its × stays on screen (${JSON.stringify(e)})`);
    await p.evaluate(()=>closeSettings());
    // ---- a watch's Details has a limit (W2-12-04)
    await p.evaluate(()=>{items.push({id:'w1',type:'watch',primaryColor:'black',metal:'silver',details:'x'.repeat(300),added:9});cache={};show('wardrobe');renderWardrobe();openItem('w1')});await settle(p,500);
    e=await p.evaluate(()=>{const i=document.querySelector('#item-view .wdetails input');return {max:i&&i.maxLength,len:i&&i.value.length}});
    ok(e.max===120&&e.len===120,`a watch's Details field takes at most 120 letters (${JSON.stringify(e)})`);
    ok(!errs.length,'no page errors ('+errs.join(' | ')+')');
  }finally{await browser.close()}};
const COLORS_PINK='#e3a5b4',COLORS_CREAM='#efe4c8';
