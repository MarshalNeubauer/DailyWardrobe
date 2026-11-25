// Sock patterns (2026-11-17, the owner's ask "do the whole update"): the socks' patterns and their words (normPat), the tag's answer
// (a new worker's toeColor, an older worker's toe cap in secondaryColor), the Add card tagging an argyle sock through a mocked worker and
// saving it with its own toe cap, the item sheet's colour fields (Color, Second, Third, Toe cap), the description, every pattern drawn on
// the traced pair and its swatch in the item's colours, a plain sock drawn byte for byte as on main, the one-time move of the toe cap to
// toeColor (stamped field by field, idempotent, run again for a sock an older app syncs in), and the planner's rules (made-up wardrobes:
// a patterned sock is one more pattern, it may pick up the tie, formal days and funerals take plain dark socks, casual days suit it best,
// light socks with dark pants stay a real mistake). SOCK_SHOTS=<dir> keeps screenshots for the review page.
const fs=require('fs'),path=require('path');
module.exports=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();const HOST='https://w.test/';const shots=process.env.SOCK_SHOTS;
  let posts=[];const ARGYLE={type:'socks',primaryColor:'navy',secondaryColor:'burgundy',tertiaryColor:'gold',pattern:'argyle',toeColor:'lightgrey',metal:null,leather:null,dial:null,band:null,bezel:null,trouserKind:null,shoeStyle:null,
    confidence:{type:'high',primaryColor:'high',pattern:'high'},altColor:'darknavy',altPattern:'polka-dot',newColor:null,newPattern:null,clothBox:null,patternBox:null,weave:null,material:{key:'merino wool',confidence:'low',why:'A fine, soft knit.'},accents:[],model:'claude-test'};
  const route=async r=>{const q=r.request(),u=new URL(q.url()),cors={'access-control-allow-origin':'*','access-control-allow-headers':'*'};
    if(q.method()==='OPTIONS')return r.fulfill({status:204,headers:cors});
    if(q.method()==='POST'&&u.pathname==='/'){posts.push(JSON.parse(q.postData()));return r.fulfill({status:200,contentType:'application/json',headers:cors,body:JSON.stringify(ARGYLE)})}
    if(/list=1/.test(u.search))return r.fulfill({status:200,contentType:'application/json',headers:cors,body:'{"keys":[]}'});
    return r.fulfill({status:503,contentType:'application/json',headers:cors,body:'{"error":"off"}'})};
  const shot=async(p,name,sel)=>{if(!shots)return;fs.mkdirSync(shots,{recursive:true});const f=path.join(shots,name+'.png');try{if(sel)await (await p.$(sel)).screenshot({path:f});else await p.screenshot({path:f})}catch(e){console.log('shot',name,e.message)}};
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});await ctx.route(HOST+'**',route);
    const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    // ---- the patterns and their words
    const w=await p.evaluate(()=>({pats:PATS_BY.socks.join(),has:hasPat('socks'),
      words:['diamond','harlequin','striped','rugby stripe','polka','dots','pin dot','rib','ribbed knit',"bird's eye",'pinpoint','clocked','chevron','novelty','fair isle','plain','tartan','ARGYLE'].map(x=>normPat('socks',x)).join(),
      flag:tagExtras({}).types.includes('sockpat'),free:tagExtras({freeColors:true}).types.includes('sockpat')}));
    ok(w.pats==='solid,argyle,stripe,polka-dot,ribbed,birdseye,nailhead,clock,herringbone,other'&&w.has,`socks have patterns (${w.pats})`);
    ok(w.words==='argyle,argyle,stripe,stripe,polka-dot,polka-dot,polka-dot,ribbed,ribbed,birdseye,nailhead,clock,herringbone,other,other,solid,solid,argyle',`the words for them (${w.words})`);
    ok(w.flag&&!w.free,'the tag request names sockpat; the picker\'s calls (kept byte-identical) do not');
    // ---- the tag's answer: a new worker's toeColor; an older worker's toe cap in secondaryColor
    const t=await p.evaluate(a=>{const n=normTag(a,'m'),o=normTag({type:'socks',primaryColor:'black',secondaryColor:'lightgrey',tertiaryColor:'none',pattern:'solid'},'m'),tie=normTag({type:'tie',primaryColor:'navy',secondaryColor:'white',pattern:'stripe',toeColor:'none'},'m');
      return {n:[n.pattern,n.secondaryColor,n.tertiaryColor,n.toeColor].join(),o:[o.pattern,o.secondaryColor,o.tertiaryColor,o.toeColor].join(),tie:'toeColor' in tie}},ARGYLE);
    ok(t.n==='argyle,burgundy,gold,lightgrey'&&t.o==='solid,,,lightgrey'&&!t.tie,`an argyle answer keeps its colours and toe cap (${t.n}); an older worker's toe cap moves to toeColor (${t.o}); other types get none`);
    // ---- the Add card: a photo tagged as an argyle sock through the (mocked) worker
    await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','t')},HOST);await p.reload();await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{if(document.querySelector('#setup.on'))HOOK.setupClose();openAdd()});
    await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=c.height=480;const x=c.getContext('2d');x.fillStyle='#f2f0ec';x.fillRect(0,0,480,480);
      x.save();x.beginPath();x.moveTo(170,40);x.lineTo(300,40);x.lineTo(300,330);x.quadraticCurveTo(300,430,200,440);x.lineTo(90,440);x.quadraticCurveTo(60,380,170,330);x.closePath();x.clip();
      x.fillStyle='#1b2a4a';x.fillRect(0,0,480,480);for(let r=0;r<8;r++)for(let k=0;k<5;k++){const cx=150+k*40+(r%2)*20,cy=60+r*48;x.fillStyle='#6d1f2c';x.beginPath();x.moveTo(cx,cy-24);x.lineTo(cx+20,cy);x.lineTo(cx,cy+24);x.lineTo(cx-20,cy);x.fill()}
      x.fillStyle='#babdc2';x.fillRect(60,400,120,60);x.restore();
      const f=new File([await new Promise(r=>c.toBlob(r,'image/jpeg',.9))],'argyle.jpg',{type:'image/jpeg'});HOOK.queue=[];await addFiles([f])});
    await p.waitForFunction(()=>queue[0]&&queue[0].type==='socks'&&!queue[0].busy,null,{timeout:15000});await settle(p,500);
    const sentTypes=posts[0]&&posts[0].types||[];
    const card=await p.evaluate(()=>{const q=queue[0],txt=document.querySelector('#queue').textContent;return {q:[q.type,q.pattern,q.secondaryColor,q.tertiaryColor,q.toeColor].join(),toe:/Toe cap/.test(txt),second:/Second color/.test(txt),third:/Third color/.test(txt),pat:/Argyle/.test(txt),alt:/Polka dot/.test(txt)}});
    ok(sentTypes.includes('sockpat'),'the photo\'s tag request names sockpat');
    ok(card.q==='socks,argyle,burgundy,gold,lightgrey'&&card.toe&&card.second&&card.third&&card.pat&&card.alt,`the card: argyle, its diamonds and lines as Second and Third color, the Toe cap its own, Claude's runner-up pattern offered (${JSON.stringify(card)})`);
    await p.evaluate(()=>{const e=document.querySelector('#queue .card');if(e)e.scrollIntoView()});await shot(p,'add-card-argyle','#queue .card');
    await p.evaluate(()=>save(0));await p.waitForFunction(()=>items.some(i=>i.type==='socks'));
    const saved=await p.evaluate(async()=>{const i=items.find(x=>x.type==='socks'),d=(await tx('readonly',s=>s.getAll())).find(x=>x.id===i.id);return {m:[i.pattern,i.secondaryColor,i.tertiaryColor,i.toeColor].join(),d:[d.pattern,d.secondaryColor,d.tertiaryColor,d.toeColor].join(),desc:desc(i),id:i.id,title:itemTitle(i),nm:nm(i),toast:document.querySelector('#toast').textContent}});
    ok(saved.title==='Navy argyle'&&saved.nm==='navy argyle socks'&&/Saved: Navy argyle socks\./.test(saved.toast),`its title is short (${saved.title}; "${saved.toast}"; the planner says "${saved.nm}")`);
    ok(saved.m==='argyle,burgundy,gold,lightgrey'&&saved.d===saved.m,`saved with its pattern, pattern colours and toe cap, on disk too (${saved.d})`);
    ok(saved.desc==='navy & burgundy & gold argyle, light gray toe',`its description (${saved.desc})`);
    // ---- the item sheet's colour fields
    await p.evaluate(id=>openItem(id),saved.id);await settle(p,500);
    const sheet=await p.evaluate(()=>{const t=document.querySelector('#item-view').textContent;return {toe:/Toe cap/.test(t),second:/Second color/.test(t),third:/Third color/.test(t),pat:/Argyle/.test(t)}});
    ok(sheet.toe&&sheet.second&&sheet.third&&sheet.pat,`the item sheet: Pattern argyle, Second and Third color, Toe cap (${JSON.stringify(sheet)})`);
    if(shots){await p.evaluate(()=>{const b=[...document.querySelectorAll('#item-view button,#item-view [role=button]')].find(x=>/^Color/.test(x.textContent.trim()));if(b){b.click();b.scrollIntoView()}});await settle(p,500);await shot(p,'item-sheet-argyle')}
    ok(await p.evaluate(()=>/light gray toe/.test(document.querySelector('#item-view').textContent)),'the Color section\'s summary names the toe cap');
    // the toe cap picker: "Toe cap color", None keeps the field ('none', not missing)
    await p.evaluate(id=>{openColPick('e',id,'toeColor')},saved.id);await settle(p,300);
    const pk=await p.evaluate(()=>document.querySelector('#col-title').textContent);ok(pk==='Toe cap color',`the toe cap's picker (${pk})`);
    await shot(p,'toe-picker','#col-sheet');
    await p.evaluate(async id=>{closeColPick();await sete(id,'toeColor','none')},saved.id);
    const noToe=await p.evaluate(id=>{const i=items.find(x=>x.id===id);return {v:i.toeColor,toe:sockToe(i),desc:desc(i)}},saved.id);
    ok(noToe.v==='none'&&noToe.toe===null&&noToe.desc==='navy & burgundy & gold argyle',`None keeps the field as 'none' (a patterned sock's second colour is never read as a toe cap): ${JSON.stringify(noToe)}`);
    // a plain sock's fields: Color and Toe cap only; a ribbed one has no Second color; stripes three
    const f=await p.evaluate(()=>{const rows=i=>colRows('e','x',i).match(/<label class="colrow">[A-Za-z ]+/g).map(s=>s.replace('<label class="colrow">','').trim()).join('|');
      return {plain:rows({type:'socks',primaryColor:'navy',pattern:'solid',toeColor:'none'}),ribbed:rows({type:'socks',primaryColor:'navy',pattern:'ribbed',toeColor:'none'}),dot:rows({type:'socks',primaryColor:'navy',pattern:'polka-dot',toeColor:'none'}),stripe:rows({type:'socks',primaryColor:'navy',pattern:'stripe',toeColor:'none'}),
        legacy:rows({type:'socks',primaryColor:'black',secondaryColor:'lightgrey',pattern:'solid'})}});
    ok(f.plain==='Color|Toe cap'&&f.ribbed==='Color|Second color|Toe cap'&&f.dot==='Color|Second color|Toe cap'&&f.stripe==='Color|Second color|Third color|Toe cap'&&f.legacy==='Color|Toe cap',`colour fields by pattern: ${JSON.stringify(f)}`);
    // ---- drawing: every pattern on the traced pair, in the item's colours; a plain sock as on main
    const d=await p.evaluate(()=>{const out={};for(const pat of PATS_BY.socks){HOOK.thumbN=0;HOOK.swN=0;const i={id:'d'+pat,type:'socks',primaryColor:'navy',secondaryColor:'burgundy',tertiaryColor:'gold',pattern:pat,toeColor:'lightgrey'};
        out[pat]={th:itemThumb(i),sw:swatchSVG(i,true)}}
      const fnv=t=>{let h=0x811c9dc5;for(const c of new TextEncoder().encode(t))h=Math.imul(h^c,16777619)>>>0;return h.toString(16)};
      const legacy=[{id:'a',type:'socks',primaryColor:'navy',pattern:'solid'},{id:'b',type:'socks',primaryColor:'black',secondaryColor:'lightgrey',pattern:'solid'},{id:'c',type:'socks',primaryColor:'burgundy',secondaryColor:'grey',pattern:'solid',shade:-2}];
      const h=[];for(const i of legacy){HOOK.thumbN=0;HOOK.swN=0;h.push(fnv(itemThumb(i)),fnv(swatchSVG(i,true)),fnv(desc(i)))}
      // the same socks after the move of the toe cap: drawn the same
      const moved=[{id:'a',type:'socks',primaryColor:'navy',pattern:'solid',toeColor:'none'},{id:'b',type:'socks',primaryColor:'black',toeColor:'lightgrey',pattern:'solid'},{id:'c',type:'socks',primaryColor:'burgundy',toeColor:'grey',pattern:'solid',shade:-2}];
      const h2=[];for(const i of moved){HOOK.thumbN=0;HOOK.swN=0;h2.push(fnv(itemThumb(i)),fnv(swatchSVG(i,true)),fnv(desc(i)))}
      return {out,h:h.join(' '),h2:h2.join(' '),burg:COLORS.burgundy,gold:COLORS.gold,grey:COLORS.lightgrey}});
    const bold=['argyle','stripe','polka-dot','other'],all=Object.keys(d.out).filter(x=>x!=='solid');
    ok(all.every(x=>d.out[x].th!==d.out.solid.th)&&new Set(all.map(x=>d.out[x].th.replace(/d[a-z-]+|th\d+-/g,''))).size===all.length,'every pattern draws differently from plain and from each other');
    ok(bold.every(x=>d.out[x].th.includes(d.burg))&&d.out.argyle.th.includes(d.gold)&&d.out.clock.th.includes(d.burg)&&all.every(x=>d.out[x].th.includes(d.grey)&&/class="sock-toe"/.test(d.out[x].th)),'drawn in the sock\'s colours (the diamonds burgundy, the crossing lines gold, the clock burgundy), the toe cap kept');
    ok(all.every(x=>/<pattern id="[^"]+pf"/.test(d.out[x].th)&&/<pattern id="[^"]+pb"/.test(d.out[x].th)||x==='clock')&&/rotate\(-20\)/.test(d.out.argyle.th),'each sock has its pattern (the back one darker), tilted with the leg');
    ok(all.every(x=>d.out[x].sw!==d.out.solid.sw&&/<pattern|sockClock|<g transform/.test(d.out[x].sw)),'every pattern has its own swatch');
    // (hashes of main's drawing, swatch and words for these three socks, 2026-11-17 at 24e9035: a plain sock looks exactly as before)
    const MAIN='4bbf0e23 d29b618c a0fff1d1 fa226663 a975ff 17d19dff 93342286 89e3971d 78c36718';
    ok(d.h===MAIN,`a plain sock (with or without a toe cap, shaded) is drawn, swatched and named exactly as on main (${d.h})`);
    ok(d.h2===MAIN,`and the same once its toe cap has moved to toeColor (${d.h2})`);
    if(shots){const svgs=await p.evaluate(()=>{const C=[['navy','burgundy','gold'],['charcoal','red','white'],['olive','rust','cream'],['burgundy','navy','lightgrey']],sv=i=>`<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${itemThumb(i)}</svg>`;
        const pats={};for(const pt of PATS_BY.socks)pats[pt]=C.map(([a,b,c])=>({cols:[a,b,c],svg:sv({id:'x',type:'socks',primaryColor:a,secondaryColor:b,tertiaryColor:c,pattern:pt,toeColor:pt==='solid'?'lightgrey':'none'}),sw:swatchSVG({type:'socks',primaryColor:a,secondaryColor:b,tertiaryColor:c,pattern:pt},true)}));
        const others={tie:sv({id:'t',type:'tie',primaryColor:'burgundy',secondaryColor:'navy',pattern:'stripe'}),shoes:sv({id:'s',type:'shoes',primaryColor:'brown',leather:'calf'}),belt:sv({id:'b',type:'belt',primaryColor:'brown',leather:'calf',metal:'silver'}),shirt:sv({id:'h',type:'shirt',primaryColor:'white',pattern:'solid'})};
        const legacy={id:'L',type:'socks',primaryColor:'black',secondaryColor:'lightgrey',pattern:'solid'},moved={id:'L',type:'socks',primaryColor:'black',toeColor:'lightgrey',pattern:'solid'};
        return {pats,others,before:sv(legacy),after:sv(moved),beforeDesc:desc(legacy),afterDesc:desc(moved)}});
      fs.writeFileSync(path.join(shots,'svgs.json'),JSON.stringify(svgs))}
    // ---- the move of the toe cap: once, stamped field by field, idempotent, again for a sock an older app syncs in
    const m=await p.evaluate(async()=>{const mk=(id,x)=>({id,type:'socks',primaryColor:'black',pattern:'solid',added:1,updated:5,...x});
      const list=[mk('m1',{secondaryColor:'lightgrey'}),mk('m2',{}),mk('m3',{secondaryColor:'grey',tertiaryColor:'red'}),mk('m4',{toeColor:'none',pattern:'argyle',secondaryColor:'red'}),{id:'m5',type:'tie',primaryColor:'navy',secondaryColor:'white',pattern:'stripe',added:1,updated:5}];
      for(const i of list)await putRaw(i);HOOK.items=list.map(i=>({...i}));const fnv=i=>{HOOK.thumbN=0;return itemThumb(i)},before=items.slice(0,3).map(fnv);
      let syncs=0;const was=window.setTimeout;window.setTimeout=(f,...a)=>{if(f===syncNow){syncs++;return 0}return was.call(window,f,...a)};const n=await sockToeMigrate(),again=await sockToeMigrate();
      const st=await tx('readonly',s=>s.getAll()),g=id=>st.find(x=>x.id===id);const after=['m1','m2','m3'].map(id=>fnv(items.find(x=>x.id===id)));
      // a sock from an older app, synced in
      await putRaw(mk('m6',{secondaryColor:'navy',updated:9}));items.push(mk('m6',{secondaryColor:'navy',updated:9}));dressSynced({items:[mk('m6',{secondaryColor:'navy'})]});
      await new Promise(r=>setTimeout(r,400));const m6=(await tx('readonly',s=>s.getAll())).find(x=>x.id==='m6');window.setTimeout=was;
      return {n,again,syncs,m1:[g('m1').toeColor,'secondaryColor' in g('m1')].join(),m2:g('m2').toeColor,m3:[g('m3').toeColor,'tertiaryColor' in g('m3')].join(),m4:[g('m4').toeColor,g('m4').secondaryColor].join(),m5:'toeColor' in g('m5'),
        fs:g('m1').fs&&Object.keys(g('m1').fs.s||{}).sort().join(),stamped:g('m1').updated>5&&g('m4').updated===5,same:before.every((h,k)=>h===after[k]),m6:m6&&m6.toeColor}});
    ok(m.n===3&&m.m1==='lightgrey,false'&&m.m2==='none'&&m.m3==='grey,false',`the old socks' toe caps move to toeColor ('none' without one), their second and third colours go (${JSON.stringify(m)})`);
    ok(m.m4==='none,red'&&!m.m5&&m.again===0&&m.syncs>=1,'a sock already moved and other types are left alone; a second run does nothing; it syncs');
    ok(m.stamped&&/secondaryColor/.test(m.fs)&&/toeColor/.test(m.fs),`only the moved fields are stamped (${m.fs}), by the corrected clock`);
    ok(m.same,'the socks are drawn exactly the same before and after the move');
    ok(m.m6==='navy','a sock an older app syncs in is moved too (dressSynced)');
    // ---- the planner's rules (made-up outfits)
    const r=await p.evaluate(()=>{let n=0;const I=(type,primaryColor,x={})=>({id:type+(n++),type,primaryColor,pattern:'solid',added:1,...x});
      const chinos=I('pants','khaki',{trouserKind:'chinos'}),grey=I('pants','grey'),charcoal=I('pants','charcoal'),navySuit=I('suit','navy'),blazer=I('blazer','navy'),
        white=I('shirt','white'),stripeShirt=I('shirt','white',{pattern:'stripe',secondaryColor:'blue'}),burgTie=I('tie','burgundy'),paisley=I('tie','green',{pattern:'paisley',secondaryColor:'gold'}),foulard=I('tie','navy',{pattern:'foulard',secondaryColor:'red'}),
        brown=I('shoes','brown',{leather:'calf'}),black=I('shoes','black',{leather:'calf'}),
        plainBrown=I('socks','brown',{toeColor:'none'}),argyle=I('socks','brown',{pattern:'argyle',secondaryColor:'burgundy',tertiaryColor:'cream',toeColor:'none'}),argyleOff=I('socks','brown',{pattern:'argyle',secondaryColor:'green',tertiaryColor:'cream',toeColor:'none'}),
        dots=I('socks','navy',{pattern:'polka-dot',secondaryColor:'red',toeColor:'none'}),plainNavy=I('socks','navy',{toeColor:'none'}),creamArgyle=I('socks','cream',{pattern:'argyle',secondaryColor:'navy',toeColor:'none'});
      const sc=(s,o)=>sockScore(o.bot,o.shoes,s,sockEcho(o.shirt,o.tie),{top:o.top,bot:o.bot,shirt:o.shirt,tie:o.tie,formal:!!o.formal,occasion:o.occasion,season:o.season});
      const casual={top:blazer,bot:chinos,shirt:white,tie:burgTie,shoes:brown},formal={...casual,formal:true,occasion:'formal'},funeral={...casual,occasion:'funeral'},wedding={...casual,occasion:'wedding'},busy={...casual,shirt:stripeShirt,tie:paisley};
      const suit={top:navySuit,bot:navySuit,shirt:white,tie:foulard,shoes:black,suitDay:true};
      const rate=(o,s)=>rateOutfit({...o,socks:s,suitDay:!!o.suitDay,formal:!!o.formal,occasion:o.occasion||null});
      const ck=(o,s,l)=>{const c=rate(o,s).checks.find(x=>x.label===l);return c&&{pts:c.pts,max:c.max,why:c.why,hard:c.hard}};
      return {
        casual:[sc(argyle,casual),sc(plainBrown,casual),sc(argyleOff,casual)],
        formal:[sc(argyle,formal),sc(plainBrown,formal)],funeral:[sc(argyle,funeral),sc(plainBrown,funeral)],wedding:[sc(argyle,wedding),sc(plainBrown,wedding)],
        busy:[sc(argyle,busy),sc(plainBrown,busy)],
        suitDots:[sc(dots,suit),sc(plainNavy,suit)],
        plainSame:sc(plainBrown,casual)===sockScore(chinos,brown,plainBrown,sockEcho(white,burgTie))&&sc(plainNavy,suit)===sockScore(navySuit,black,plainNavy,sockEcho(white,foulard)),
        rCasual:ck(casual,argyle,'Socks'),rFormal:ck(formal,argyle,'Socks'),rBusy:ck(busy,argyle,'Patterns'),rSame:ck(suit,dots,'Patterns'),
        light:ck({...casual,bot:charcoal},creamArgyle,'Socks'),lightHard:rate({...casual,bot:charcoal},creamArgyle).hard.join(),
        plainPat:ck(casual,plainBrown,'Patterns'),rules:PLAN_RULES,
        // bright plain socks (the owner, 2026-11-17): marked down on formal days, weddings and funerals; dark ones are not
        bright:['red','pink','purple','gold','rust','blue','tan','khaki','burgundy','wine','navy','charcoal','brown','olive','green','grey','slate','deepblue'].map(c=>c+':'+(HOOK.sockBright({type:'socks',primaryColor:c})?1:0)).join(),
        redSuit:[sc(I('socks','red',{toeColor:'none'}),{...suit,formal:true,occasion:'formal'}),sc(plainNavy,{...suit,formal:true,occasion:'formal'}),sc(I('socks','red',{toeColor:'none'}),suit)],
        redCk:ck({...suit,formal:true,occasion:'formal'},I('socks','burgundy',{toeColor:'none'}),'Socks'),redCk2:ck({...suit,occasion:'funeral'},I('socks','red',{toeColor:'none'}),'Socks'),
        // the material by season
        mat:['cold','warm','mild'].map(se=>[I('socks','navy',{material:'merino wool',toeColor:'none'}),I('socks','navy',{material:'cotton',toeColor:'none'}),plainNavy].map(s=>sc(s,{...suit,season:se})).join('/')).join(' ')}});
    ok(r.casual[0]>r.casual[1]&&r.casual[0]>r.casual[2],`chinos with a burgundy tie: the brown argyle with burgundy diamonds is the best sock (${r.casual}); one with green diamonds picks nothing up`);
    ok(r.formal[0]<r.formal[1]&&r.funeral[0]<r.funeral[1]&&r.wedding[0]<r.wedding[1],`a formal day, a funeral and a wedding take the plain sock (formal ${r.formal}, funeral ${r.funeral}, wedding ${r.wedding})`);
    ok(r.busy[0]<r.busy[1],`a striped shirt and a paisley tie: no argyle on top (${r.busy})`);
    ok(r.suitDots[0]<r.suitDots[1],`dots under a foulard tie (one pattern type and scale) with a suit: the plain sock (${r.suitDots})`);
    ok(r.plainSame,'a plain sock scores exactly as before, whatever the outfit');
    ok(r.rCasual&&r.rCasual.pts===5&&r.rFormal&&r.rFormal.pts===2&&/formal day calls for plain dark socks/.test(r.rFormal.why),`the score: argyle picking up the tie ${r.rCasual&&r.rCasual.pts}/5; on a formal day ${r.rFormal&&r.rFormal.pts}/5 "${r.rFormal&&r.rFormal.why}"`);
    ok(r.rBusy&&r.rBusy.pts===4&&!r.rBusy.hard&&r.rSame&&r.rSame.pts===5&&/same kind of pattern as the tie/.test(r.rSame.why),`Patterns: argyle as a third pattern ${r.rBusy&&r.rBusy.pts}/10 (not a real mistake), dots repeating the foulard ${r.rSame&&r.rSame.pts}/10 "${r.rSame&&r.rSame.why}"`);
    ok(r.light&&r.light.pts===0&&r.light.hard&&/Socks/.test(r.lightHard),'a cream argyle with charcoal pants is still the real mistake "light socks with dark pants"');
    ok(r.plainPat&&r.plainPat.pts===10,'plain socks add no pattern');
    ok(r.bright==='red:1,pink:1,purple:1,gold:1,rust:1,blue:1,tan:1,khaki:1,burgundy:0,wine:0,navy:0,charcoal:0,brown:0,olive:0,green:0,grey:0,slate:0,deepblue:0',`bright socks: ${r.bright}`);
    ok(r.redSuit[0]<r.redSuit[1]&&r.redSuit[2]===r.redSuit[0]+25,`a red plain sock on a formal day loses to navy (${r.redSuit}); on an ordinary day it isn't marked down`);
    ok(r.redCk&&!/formal/.test(r.redCk.why)&&r.redCk2&&r.redCk2.pts===2&&/funeral calls for plain dark socks/.test(r.redCk2.why),`the score: burgundy on a formal day is fine (${r.redCk&&r.redCk.pts}/5); red at a funeral ${r.redCk2&&r.redCk2.pts}/5 "${r.redCk2&&r.redCk2.why}"`);
    {const [c,w,m]=r.mat.split(' ').map(x=>x.split('/').map(Number));ok(c[0]>c[2]&&c[2]>c[1]&&w[1]>w[2]&&w[2]>w[0]&&m[0]===m[2]&&m[1]===m[2],`merino wins in the cold, cotton in the heat, neither on a mild day; no material is neutral (${r.mat})`)}
    ok(r.rules>=25,`PLAN_RULES bumped (${r.rules})`);
    // ---- the planner over two months: a made-up wardrobe with a plain and an argyle pair
    const plan=await p.evaluate(()=>{let n=0;const I=(type,primaryColor,x={})=>({id:type+String(n++).padStart(2,'0'),type,primaryColor,pattern:'solid',added:1,...x});
      HOOK.items=[I('suit','navy'),I('suit','charcoal'),I('blazer','navy'),I('pants','khaki',{trouserKind:'chinos'}),I('pants','grey'),I('shirt','white'),I('shirt','lightblue'),I('shirt','white',{pattern:'stripe',secondaryColor:'blue'}),
        I('tie','burgundy'),I('tie','navy',{pattern:'polka-dot',secondaryColor:'white'}),I('tie','green',{pattern:'paisley',secondaryColor:'gold'}),
        I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'}),I('belt','black',{leather:'calf'}),I('belt','brown',{leather:'calf'}),
        I('socks','navy',{toeColor:'none'}),I('socks','charcoal',{toeColor:'none'}),I('socks','navy',{pattern:'argyle',secondaryColor:'burgundy',tertiaryColor:'gold',toeColor:'none',id:'argyle'})];
      settings.workdays=[0,1,2,3,4];settings.blazerDays=[3];settings.vestMode='never';settings.dress=undefined;HOOK.weather={};HOOK.TODAY_OVERRIDE='2026-11-09T12:00:00';
      HOOK.dayRecs={'2026-11-17':{date:'2026-11-17',occasion:'funeral'},'2026-11-18':{date:'2026-11-18',formal:true},'2026-11-24':{date:'2026-11-24',occasion:'wedding'}};HOOK.cache={};
      const P=planSim(new Date(2026,10,1)).upTo(new Date(2026,11,31)),days=Object.entries(P).filter(([,o])=>o.socks),arg=days.filter(([,o])=>o.socks.id==='argyle');
      const special=['2026-11-17','2026-11-18','2026-11-24'].map(k=>P[k]&&P[k].socks&&P[k].socks.id).join();
      const busy=arg.filter(([,o])=>HOOK.patsOf([[o.top,'top'],[o.suitDay?null:o.bot,'bot'],[o.shirt,'shirt'],[o.tie,'tie']]).length>=2).length;
      const hard=arg.filter(([,o])=>rateOutfit(o).hard.includes('Socks')).length,echo=arg.filter(([,o])=>HOOK.sockPatScore(o.socks,{top:o.top,bot:o.bot,shirt:o.shirt,tie:o.tie}).echo).length;
      HOOK.dayRecs={};HOOK.cache={};return {days:days.length,arg:arg.length,special,busy,hard,echo}});
    ok(plan.arg>0&&plan.arg<plan.days,`the argyle pair is planned on some days (${plan.arg} of ${plan.days}), ${plan.echo} of them picking up the tie or shirt`);
    ok(!plan.special.includes('argyle'),`never on the funeral, the formal day or the wedding (${plan.special})`);
    if(shots)fs.writeFileSync(path.join(shots,'plan.json'),JSON.stringify({r,plan}));
    ok(plan.busy===0&&plan.hard===0,`never under two bold patterns (${plan.busy}), never a real mistake (${plan.hard})`);
    // ---- What to buy: a patterned pair as an idea when it fits (chinos owned, ties to pick up, no bold pair yet)
    const shopR=await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++).toString().padStart(3,'0'),type,primaryColor,pattern:'solid',added:1,...x});
      const W=[I('suit','navy'),I('suit','charcoal'),I('blazer','navy'),I('blazer','tan'),I('pants','grey'),I('pants','khaki',{trouserKind:'chinos'}),I('pants','stone',{trouserKind:'chinos'}),
        I('shirt','white'),I('shirt','lightblue'),I('shirt','white',{pattern:'stripe',secondaryColor:'blue'}),I('shirt','pink'),I('shirt','lavender'),
        I('tie','burgundy'),I('tie','burgundy',{pattern:'stripe',secondaryColor:'navy'}),I('tie','green'),I('tie','navy',{pattern:'polka-dot',secondaryColor:'burgundy'}),I('tie','green',{pattern:'paisley',secondaryColor:'gold'}),
        I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('watch','grey',{metal:'silver'}),
        I('socks','navy',{toeColor:'none'}),I('socks','charcoal',{toeColor:'none'}),I('socks','brown',{toeColor:'none'})];
      settings.blazerDays=[3,4];HOOK.dayRecs={};settings.shopSkip=[];HOOK.TODAY_OVERRIDE='2026-11-15T12:00:00';
      const ideas=r=>r.cats.flatMap(c=>c.recs).filter(x=>x.type==='socks'&&x.items[0].pattern!=='solid').map(x=>({name:x.name,tier:x.tier,why:x.why.join(' ')}));
      const a=ideas(runAnalysis(W,todayDate())),b=ideas(runAnalysis(W.filter(i=>!i.trouserKind),todayDate()));settings.blazerDays=[3];return {a,b}});
    ok(shopR.a.length>=1&&shopR.a.every(x=>x.tier==='variety')&&/argyle|stripe/.test(shopR.a.map(x=>x.name).join())&&/picks? up your (burgundy|green) ties/.test(shopR.a[0].why),`What to buy suggests a patterned pair for the chinos days, as an idea (${JSON.stringify(shopR.a)})`);
    ok(shopR.b.length===0,'without chinos or jeans it suggests none');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
module.exports.realPlanner=true;   // the real planner picks the socks
