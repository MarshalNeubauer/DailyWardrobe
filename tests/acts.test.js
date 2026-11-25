// act.js: the markup's handlers through data-act and one delegated listener per event type (Round C, wave C2, 2026-11-18), in place of
// inline on…="…" handlers. Chromium and WebKit (Safari's engine), with touch.
// Part 1, the first controls moved over (Settings' Workdays and Blazer days buttons, the Outfit pictures choice, an occasion's ×, a
// city search result): tapped or changed as a person does, with the effect each had as an inline handler. This part reads no
// attribute of the handlers, so it passes unchanged on the app from before the move (run there to prove it).
// Part 2, the mechanism against inline handlers themselves: the same markup is built twice, once with inline handlers and once with
// data-act, the same clicks and keys go to both, and what ran, in which order, must be the same (nesting, stopPropagation,
// preventDefault, a handler that removes its element or throws, a disabled control, several event types on one element, the types
// that don't bubble). Then what is new: unknown and doubled names, actsFirst, and every name in the app's markup registered.
const fs=require('fs'),path=require('path');
module.exports=async({ok,chromium,engines,url,settle,ROOT})=>{
  for(const [eng,launch] of engines){let browser;
    try{browser=await launch()}catch(e){ok(false,`${eng}: the browser starts (${e.message.split('\n')[0]})`);continue}
    try{await run(eng,browser,{ok,url,settle,ROOT})}finally{await browser.close()}}
};
const CITIES=[{id:1,name:'Springfield',admin1:'Illinois',country_code:'US',latitude:39.8,longitude:-89.64},
  {id:2,name:'Springfield',admin1:'Missouri',country_code:'US',latitude:37.22,longitude:-93.3},
  {id:3,name:'Springfield',admin1:'Massachusetts',country_code:'US',latitude:42.1,longitude:-72.59}];
async function run(eng,browser,{ok,url,settle,ROOT}){
  const T=eng+': ';
  const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:eng==='Chromium',locale:'en-US'});
  const days=['2026-11-15','2026-11-16','2026-11-17','2026-11-18','2026-11-19','2026-11-20'];
  await ctx.route('https://archive-api.open-meteo.com/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{}'}));
  await ctx.route('https://api.open-meteo.com/**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({daily:{time:days,temperature_2m_max:[14,14,14,14,14,14],temperature_2m_min:[6,6,6,6,6,6],precipitation_probability_max:[0,0,0,0,0,0],precipitation_sum:[0,0,0,0,0,0],weather_code:[2,2,2,2,2,2]}})}));
  await ctx.route('https://geocoding-api.open-meteo.com/**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({results:CITIES})}));
  await ctx.addInitScript(()=>{localStorage.setItem('tour_seen','1');window.__werr=[];addEventListener('error',e=>window.__werr.push(String(e.message)))});
  const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));p.setDefaultTimeout(8000);
  await p.goto(url);await p.waitForFunction(()=>window.appReady);
  await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
    items=[I('suit','navy'),I('suit','charcoal'),I('blazer','navy'),I('pants','grey'),I('shirt','white'),I('shirt','lightblue'),I('tie','burgundy'),I('tie','navy'),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf'})];
    dayRecs={};TODAY_OVERRIDE='2026-11-15T12:00:00';settings.setupDone=1;settings.workdays=[0,1,2,3,4];settings.blazerDays=[4];settings.location=null;delete settings.pictures;
    cache={};sel=new Date(2026,10,16);view={y:2026,m:10};show('today')});
  await settle(p,300);
  const tap=async sel=>{const l=p.locator(sel).first();await l.scrollIntoViewIfNeeded();await l.tap()};
  const days7=box=>p.evaluate(b=>[...document.querySelectorAll(b+' .dtog')].map(x=>(x.getAttribute('aria-pressed')==='true'?1:0)+(x.classList.contains('on')?1:0)).join(''),box);

  /* ---- part 1: the controls moved over, by real taps ---- */
  await p.evaluate(()=>openSettings('schedule'));await settle(p,500);
  ok(await days7('#cfg-workdays')==='2222200'&&await days7('#cfg-blazer')==='0000200',T+'Settings shows Sunday to Thursday as workdays and Thursday as the blazer day');
  await tap('#cfg-workdays .dtog:nth-child(6)');await p.waitForFunction(()=>settings.workdays.includes(5)).catch(()=>{});
  ok(await p.evaluate(()=>settings.workdays.join()==='0,1,2,3,4,5')&&await days7('#cfg-workdays')==='2222220',T+'a tap on Workdays’ Friday button makes Friday a workday and shows it pressed');
  await p.waitForFunction(async()=>((await metaGet('settings'))||{}).workdays.join()==='0,1,2,3,4,5').catch(()=>{});
  ok(await p.evaluate(async()=>(await metaGet('settings')).workdays.join()==='0,1,2,3,4,5'),T+'and the choice is saved');
  await tap('#cfg-blazer .dtog:nth-child(1)');await p.waitForFunction(()=>settings.blazerDays.includes(0)).catch(()=>{});
  ok(await p.evaluate(()=>settings.blazerDays.join()==='0,4'&&settings.workdays.join()==='0,1,2,3,4,5')&&await days7('#cfg-blazer')==='2000200',T+'a tap on Blazer days’ Sunday button makes Sunday a blazer day, the workdays unchanged');
  await tap('#cfg-workdays .dtog:nth-child(1)');await p.waitForFunction(()=>!settings.workdays.includes(0)).catch(()=>{});
  ok(await p.evaluate(()=>settings.workdays.join()==='1,2,3,4,5'&&settings.blazerDays.join()==='4')&&await days7('#cfg-workdays')==='0222220'&&await days7('#cfg-blazer')==='0000200',T+'a second kind of tap, Sunday off the workdays, also takes it off the blazer days');
  await tap('#cfg-workdays .dtog:nth-child(6)');await p.waitForFunction(()=>!settings.workdays.includes(5)).catch(()=>{});
  ok(await p.evaluate(()=>settings.workdays.join()==='1,2,3,4'),T+'a tap on a pressed day button takes the day off again');
  await p.evaluate(()=>{settings.workdays=[2];settings.blazerDays=[];renderSettingsExtras()});
  await tap('#cfg-workdays .dtog:nth-child(3)');await p.waitForFunction(()=>/At least one workday/.test(document.querySelector('#toast').textContent)).catch(()=>{});
  ok(await p.evaluate(()=>settings.workdays.join()==='2'&&/At least one workday is needed/.test(document.querySelector('#toast').textContent)),T+'the last workday’s button keeps it and says why');
  await p.evaluate(()=>{settings.workdays=[0,1,2,3,4];settings.blazerDays=[4];renderSettingsExtras()});

  await p.evaluate(()=>openSettings('photos'));await settle(p,500);
  const pic0=await p.evaluate(()=>({v:document.querySelector('#cfg-pictures').value,h:document.querySelector('#pics-help').textContent.slice(0,16)}));
  await p.selectOption('#cfg-pictures','drawn');await p.waitForFunction(()=>settings.pictures==='drawn'&&/^Drawing only/.test(document.querySelector('#pics-help').textContent)).catch(()=>{});
  const pic1=await p.evaluate(()=>({s:settings.pictures,d:picsDrawn(),v:document.querySelector('#cfg-pictures').value,h:document.querySelector('#pics-help').textContent.slice(0,12),sum:document.querySelector('#sum-photos').textContent}));
  ok(pic0.v==='painted'&&/^Painted pictures/.test(pic0.h)&&pic1.s==='drawn'&&pic1.d&&pic1.v==='drawn'&&pic1.h==='Drawing only'&&/Drawing only/.test(pic1.sum),T+'choosing "Drawing only" in Outfit pictures switches the setting, the line under it and the summary ('+JSON.stringify(pic1)+')');
  await p.selectOption('#cfg-pictures','painted');await p.waitForFunction(()=>settings.pictures==='painted'&&/^Painted pictures/.test(document.querySelector('#pics-help').textContent)).catch(()=>{});   // (the line is redrawn once the choice is saved)
  ok(await p.evaluate(()=>settings.pictures==='painted'&&!picsDrawn()&&document.querySelector('#cfg-pictures').value==='painted'&&/^Painted pictures/.test(document.querySelector('#pics-help').textContent)),T+'and "Painted pictures" switches it back');

  await p.evaluate(()=>openSettings('daysoff'));await settle(p,500);
  await p.fill('#cfg-formal-date','2026-11-18');await tap('#occ-add');await p.waitForFunction(()=>document.querySelectorAll('#formal-list .fchip').length===1).catch(()=>{});
  await p.fill('#cfg-formal-date','2026-11-19');await tap('#occ-add');await p.waitForFunction(()=>document.querySelectorAll('#formal-list .fchip').length===2).catch(()=>{});
  ok(await p.evaluate(()=>!!(dayRecs['2026-11-18']&&dayRecs['2026-11-18'].formal&&dayRecs['2026-11-19']&&dayRecs['2026-11-19'].formal)&&document.querySelectorAll('#formal-list .fchip').length===2),T+'two formal days are listed under Occasions');
  await tap('#formal-list .fchip:nth-child(2) button');await p.waitForFunction(()=>document.querySelectorAll('#formal-list .fchip').length===1).catch(()=>{});
  ok(await p.evaluate(()=>!occOf(dayRecs['2026-11-19']||{})&&!!dayRecs['2026-11-18'].formal&&document.querySelectorAll('#formal-list .fchip').length===1&&/Nov 18/.test(document.querySelector('#formal-list').textContent)),T+'a tap on the second occasion’s × makes that day a regular day and keeps the other');
  await tap('#formal-list .fchip button');await p.waitForFunction(()=>/No occasions coming up/.test(document.querySelector('#formal-list').textContent)).catch(()=>{});
  ok(await p.evaluate(()=>!occOf(dayRecs['2026-11-18']||{})&&/No occasions coming up/.test(document.querySelector('#formal-list').textContent)),T+'and the last ×  leaves "No occasions coming up."');

  await p.evaluate(()=>openSettings('weather'));await settle(p,500);
  await p.fill('#cfg-city','Springfield');await tap('#sp-weather .sform button');await p.waitForFunction(()=>document.querySelectorAll('#city-results button').length===3).catch(()=>{});
  ok(await p.evaluate(()=>[...document.querySelectorAll('#city-results button')].map(b=>b.textContent).join('|'))==='Springfield, Illinois, US|Springfield, Missouri, US|Springfield, Massachusetts, US',T+'the city search lists three places');
  await tap('#city-results button:nth-child(2)');await p.waitForFunction(()=>settings.location&&Object.keys(weather).length>0).catch(()=>{});
  const loc=await p.evaluate(()=>({n:settings.location&&settings.location.name,lat:settings.location&&settings.location.lat,left:document.querySelectorAll('#city-results button').length,line:document.querySelector('#wx-loc').textContent.slice(0,40),wx:Object.keys(weather).length}));
  ok(loc.n==='Springfield, Missouri, US'&&loc.lat===37.22&&loc.left===0&&/^Weather for Springfield, Missouri, US/.test(loc.line)&&loc.wx>0,T+'a tap on the second place sets it as the location, clears the list and loads its forecast ('+JSON.stringify(loc)+')');
  await p.waitForFunction(()=>/Location set to Springfield, Missouri, US/.test(document.querySelector('#sr-live').textContent)).catch(()=>{});
  ok(await p.evaluate(()=>/Location set to Springfield, Missouri, US/.test(document.querySelector('#sr-live').textContent)),T+'and it is announced');
  await p.evaluate(()=>closeSettings());await settle(p,300);
  ok(!errs.length,T+'no page errors from the controls'+(errs.length?': '+errs.join(' | '):''));

  /* ---- part 2: the mechanism against inline handlers ---- */
  const has=await p.evaluate(()=>typeof acts==='function'&&'actsFirst' in HOOK&&typeof HOOK.actsFirst==='function'&&typeof ACTS==='object');
  ok(has,T+'act.js is loaded (acts, actsFirst, ACTS)');
  if(!has){await ctx.close();return}
  const own=await p.evaluate(()=>Object.keys(ACTS));
  await p.evaluate(()=>{
    window.__log=[];const L=(...a)=>{window.__log.push(a.join(':'))};
    /* what a test handler does: says who ran, then what its element asks (o) */
    window.__t=(n,el,ev,o)=>{L(n,el.className,ev.type);if(o==='stop')ev.stopPropagation();if(o==='prevent')ev.preventDefault();if(o==='gone')el.remove();if(o==='throw')throw new Error('act-test throw '+n);if(o==='false')return false};
    acts({tLog:(el,ev)=>window.__t(el.dataset.n,el,ev,el.dataset.o)});
    HOOK.actsFirst({tFirst:(el,ev)=>window.__t('first',el,ev,el.dataset.o)});
    const box=document.createElement('div');box.id='act-fx';box.style.cssText='position:fixed;left:0;top:0;width:390px;height:400px;z-index:99999;background:#fff;overflow:hidden';document.body.appendChild(box);
    const inFx=e=>e.target&&e.target.closest&&e.target.closest('#act-fx');
    for(const t of ['click','change','input','keydown','keyup','pointerdown']){document.addEventListener(t,e=>{if(inFx(e))L('doc','',e.type)});window.addEventListener(t,e=>{if(inFx(e))L('win','',e.type)})}
    /* a handler attribute of one kind: inline, or data-act */
    const H=(kind,type,n,o)=>kind==='inline'?` on${type}="${o==='retfalse'?`__t('${n}',this,event);return false`:`__t('${n}',this,event,'${o||''}')`}"`
      :` ${type==='click'?'data-act':'data-act-'+type}="tLog" data-n="${n}" data-o="${o==='retfalse'?'prevent':o||''}"`;
    const S='style="display:block;width:160px;height:36px;margin:2px"';
    window.__fx=(kind,name)=>{const h=(type,n,o)=>H(kind,type,n,o);window.__log.length=0;
      box.innerHTML={
        nested:`<div class="c-out"${h('click','outer')}><div class="c-mid"${h('click','mid')}><button type="button" class="c-in" ${S}${h('click','inner')}>x</button></div></div>`,
        stop:`<div class="c-out"${h('click','outer')}><div class="c-mid"${h('click','mid','stop')}><button type="button" class="c-in" ${S}${h('click','inner')}>x</button></div></div>`,
        prevent:`<div class="c-out"${h('click','outer')}><input type="checkbox" class="c-in" ${S}${h('click','cb','prevent')}></div>`,
        retfalse:`<div class="c-out"${h('click','outer')}><input type="checkbox" class="c-in" ${S}${h('click','cb','retfalse')}></div>`,
        gone:`<div class="c-out"${h('click','outer')}><div class="c-mid"${h('click','mid')}><button type="button" class="c-in" ${S}${h('click','inner','gone')}>x</button></div></div>`,
        throws:`<div class="c-out"${h('click','outer')}><button type="button" class="c-in" ${S}${h('click','inner','throw')}>x</button></div>`,
        disabled:`<div class="c-out"${h('click','outer')}><button type="button" disabled class="c-dis" ${S}${h('click','dis')}><span class="c-in" style="display:block;height:30px">x</span></button></div>`,
        types:`<div class="c-out"${h('click','outer')}${h('input','outer')}${h('keydown','outer')}${h('keyup','outer')}${h('change','outer')}><input type="text" class="c-in" ${S}${h('click','field')}${h('input','field')}${h('keydown','field')}${h('keyup','field')}${h('change','field')}><button type="button" class="c-nx" ${S}>next</button></div>`,
        pointer:`<div class="c-out"${h('pointerdown','outer')}><div class="c-in" ${S}${h('pointerdown','pad')}${h('click','padclick')}>x</div></div>`,
        focus:`<div class="c-out"${h('focus','outer')}><input type="text" class="c-in" ${S}${h('focus','field')}></div>`,
        toggle:`<div class="c-out"${h('toggle','outer')}><details class="c-de"${h('toggle','details')}><summary class="c-in" ${S}>s</summary>x</details></div>`,
        load:`<div class="c-out"${h('load','outer')}><img class="c-in" alt="" ${S}${h('load','img')} src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="></div>`,
      }[name]}});
  const log=()=>p.evaluate(()=>window.__log.slice());
  const center=async sel=>{const b=await p.locator(sel).first().boundingBox();return [b.x+b.width/2,b.y+b.height/2]};
  /* one scenario on both kinds: what ran with inline handlers, and with data-act */
  const both=async(name,doIt)=>{const out={};for(const kind of ['inline','act']){await p.evaluate(([k,n])=>window.__fx(k,n),[kind,name]);out[kind]=await doIt()}return out};
  const same=(r,want,what)=>ok(JSON.stringify(r.inline)===JSON.stringify(r.act)&&(!want||JSON.stringify(r.act)===JSON.stringify(want)),T+what+' (inline '+JSON.stringify(r.inline)+', data-act '+JSON.stringify(r.act)+')');
  const clickIn=async()=>{const [x,y]=await center('#act-fx .c-in');await p.mouse.click(x,y);await settle(p,60);return (await log()).filter(x=>!/^(doc|win)::pointerdown$/.test(x))};   // (the click's own pointerdown, which no handler here takes)

  same(await both('nested',clickIn),['inner:c-in:click','mid:c-mid:click','outer:c-out:click','doc::click','win::click'],
    'nested handlers run innermost first, each with its own element, before document’s and window’s listeners');
  same(await both('stop',clickIn),['inner:c-in:click','mid:c-mid:click'],'a handler’s stopPropagation keeps the outer handler and document’s and window’s listeners from running');
  same(await both('prevent',async()=>{const l=await clickIn();return [l,await p.evaluate(()=>document.querySelector('#act-fx .c-in').checked)]}),
    [['cb:c-in:click','outer:c-out:click','doc::click','win::click'],false],'a handler’s preventDefault keeps the checkbox unchecked, and the event goes on');
  same(await both('retfalse',async()=>{const l=await clickIn();return [l,await p.evaluate(()=>document.querySelector('#act-fx .c-in').checked)]}),
    [['cb:c-in:click','outer:c-out:click','doc::click','win::click'],false],'an inline "return false" and a handler calling ev.preventDefault() do the same');
  same(await both('gone',clickIn),['inner:c-in:click','mid:c-mid:click','outer:c-out:click'],'a handler that removes its own element doesn’t cut the outer handlers off');   // (the test's document listener no longer finds the target in the fixture)
  const werr0=await p.evaluate(()=>window.__werr.length),perr0=errs.length;
  same(await both('throws',clickIn),['inner:c-in:click','outer:c-out:click','doc::click','win::click'],'a handler that throws doesn’t stop the outer handlers');
  const thrown=await p.evaluate(n=>window.__werr.slice(n),werr0);
  ok(thrown.length===2&&thrown.every(m=>/act-test throw inner/.test(m)),T+'and its error is a page error both ways ('+thrown.join(' | ')+')');
  ok(errs.slice(perr0).filter(m=>/act-test throw inner/.test(m)).length===2,T+'which the test runner sees both ways too');
  same(await both('disabled',clickIn),null,'a click on a disabled button’s content runs the same handlers');
  same(await both('types',async()=>{await clickIn();await p.keyboard.type('a');await p.keyboard.press('Tab');await p.evaluate(()=>{const f=document.querySelector('#act-fx .c-in');if(document.activeElement===f)f.blur()});await settle(p,60);return log()}),null,
    'one element with a handler for click, input, keydown, keyup and change runs each for its own event only');
  const types=await log();
  ok(['field:c-in:click','outer:c-out:click','field:c-in:keydown','field:c-in:input','field:c-in:keyup','field:c-in:change','outer:c-out:change'].every(x=>types.includes(x))&&types.filter(x=>/^field:c-in:click$/.test(x)).length===1,
    T+'and with data-act each of the five ran ('+types.filter(x=>/^field/.test(x)).join(',')+')');
  same(await both('pointer',async()=>{await p.evaluate(()=>document.querySelector('#act-fx .c-in').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true})));return log()}),
    ['pad:c-in:pointerdown','outer:c-out:pointerdown','doc::pointerdown','win::pointerdown'],'a pointerdown handler runs for a pointerdown, not the click handler beside it');
  same(await both('focus',async()=>{await p.evaluate(()=>document.querySelector('#act-fx .c-in').focus());await settle(p,60);const l=await log();await p.evaluate(()=>document.activeElement.blur());return l}),
    ['field:c-in:focus'],'focus doesn’t bubble: only the focused field’s own handler runs');
  same(await both('toggle',async()=>{const [x,y]=await center('#act-fx .c-in');await p.mouse.click(x,y);await p.waitForFunction(()=>window.__log.some(x=>/toggle/.test(x)),null,{timeout:3000}).catch(()=>{});await settle(p,60);return (await log()).filter(x=>/toggle/.test(x))}),
    ['details:c-de:toggle'],'toggle doesn’t bubble: only the details’ own handler runs');
  same(await both('load',async()=>{await p.waitForFunction(()=>window.__log.some(x=>/load/.test(x)),null,{timeout:3000}).catch(()=>{});await settle(p,60);return log()}),
    ['img:c-in:load'],'a picture’s load handler runs when it has loaded, and not its container’s');

  /* what is new with data-act */
  const ret=await p.evaluate(()=>{window.__fx('act','prevent');document.querySelector('#act-fx .c-in').dataset.o='false';return 1});
  await clickIn();
  ok(ret&&await p.evaluate(()=>document.querySelector('#act-fx .c-in').checked),T+'a handler’s return value is ignored: returning false doesn’t prevent the default');
  const w1=await p.evaluate(()=>window.__werr.length);
  await p.evaluate(()=>{window.__fx('act','nested');document.querySelector('#act-fx .c-in').setAttribute('data-act','tNope')});
  const nope=await clickIn(),nopeErr=await p.evaluate(n=>window.__werr.slice(n),w1);
  ok(nopeErr.length===1&&/no handler named "tNope"/.test(nopeErr[0])&&JSON.stringify(nope)===JSON.stringify(['mid:c-mid:click','outer:c-out:click','doc::click','win::click']),T+'a name nothing registered is a page error, and the outer handlers still run ('+nopeErr.join(' | ')+')');
  const dup=await p.evaluate(()=>{const r=[];try{acts({tLog(){}})}catch(e){r.push(e.message)}try{acts({tNotFn:1})}catch(e){r.push(e.message)}try{HOOK.actsFirst({dayTap(){}})}catch(e){r.push(e.message)}return r.concat(typeof ACTS.tNotFn,String(HOOK.ACT_FIRST.has('dayTap')))});
  ok(dup.length===5&&/two handlers named "tLog"/.test(dup[0])&&/"tNotFn" is not a function/.test(dup[1])&&/two handlers named "dayTap"/.test(dup[2])&&dup[3]==='undefined'&&dup[4]==='false',T+'a name can’t be registered twice, and only a function can be ('+dup.join(' | ')+')');
  /* a listener on an element between the control and document: it runs before a data-act handler and can stop it (the one difference
     from an inline handler); a handler registered with actsFirst runs before it */
  const between=async(act,o)=>{await p.evaluate(([a,o])=>{window.__fx('act','nested');const b=document.querySelector('#act-fx .c-in'),m=document.querySelector('#act-fx .c-mid');
      m.removeAttribute('data-act');b.setAttribute('data-act',a);b.dataset.o=o;window.__log.length=0;
      m.addEventListener('click',e=>{window.__log.push('listener:c-mid:click');e.stopPropagation()})},[act,o]);return clickIn()};
  const plain=await between('tLog',''),first=await between('tFirst',''),firstStop=await between('tFirst','stop');
  ok(JSON.stringify(plain)===JSON.stringify(['listener:c-mid:click']),T+'a listener between the control and document that stops the click runs first and the data-act handler doesn’t run ('+plain.join(',')+')');
  ok(JSON.stringify(first)===JSON.stringify(['first:c-in:click','listener:c-mid:click']),T+'a handler registered with actsFirst runs before that listener ('+first.join(',')+')');
  ok(JSON.stringify(firstStop)===JSON.stringify(['first:c-in:click']),T+'and when it stops the click, the listener never sees it ('+firstStop.join(',')+')');
  await p.evaluate(()=>document.querySelector('#act-fx').remove());

  /* every handler name the app's markup uses is registered, and every registered one is used */
  const files=[...fs.readdirSync(ROOT).filter(f=>f.endsWith('.js')&&f!=='act.js'),'index.html'],used=new Set(),dyn=[];
  for(const f of files){const s=fs.readFileSync(path.join(ROOT,f),'utf8');
    for(const m of s.matchAll(/\sdata-act(?:-[a-z]+)?="([^"]*)"/g)){if(/^[A-Za-z_$][\w$]*$/.test(m[1]))used.add(m[1]);else dyn.push(f+': '+m[1])}}
  const missing=[...used].filter(n=>!own.includes(n)),idle=own.filter(n=>!used.has(n));
  ok(used.size>=4&&['dayTap','picsPick','occClear','cityPick'].every(n=>used.has(n)&&own.includes(n)),T+`the app's markup names ${used.size} handlers, the first four among them (${[...used].sort().join(', ')})`);
  ok(!missing.length&&!idle.length&&!dyn.length,T+'every name in the markup is registered, every registered name is in the markup, and no name is made up at run time'
    +(missing.length?'; not registered: '+missing.join(', '):'')+(idle.length?'; not used: '+idle.join(', '):'')+(dyn.length?'; made up: '+dyn.join(', '):''));
  const stray=errs.filter(m=>!/act-test throw inner|no handler named "tNope"/.test(m));
  ok(!stray.length,T+'no other page errors'+(stray.length?': '+stray.join(' | '):''));
  await ctx.close();
}
