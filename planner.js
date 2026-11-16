/* Daily Wardrobe: outfit rules, planning and scoring (no DOM access; also loaded by the analysis worker) */
/* colour families for the rules: dark grey behaves like charcoal, light grey like grey, oxblood like burgundy */
const FAM={stone:'tan',denim:'blue',mint:'green',paleyellow:'cream',ivory:'cream',beige:'tan',khaki:'tan',taupe:'tan',deeptaupe:'brown',rust:'brown',periwinkle:'blue',darkgrey:'charcoal',lightgrey:'grey',midgrey:'grey',oxblood:'burgundy',wine:'burgundy',steelblue:'blue',deepblue:'navy',darknavy:'navy',slate:'charcoal',rosegold:'gold',gunmetal:'charcoal'},fam=c=>FAM[c]||c;
/* colRun: an item's colour family and colours, kept for one planning run (planSim's upTo, runAnalysis; withColRun): the scoring asks
   for them millions of times. Only while a run lasts, when the wardrobe and settings can't change (a run never edits an item) */
let colRun=null;
const withColRun=f=>{if(colRun)return f();colRun={p:new WeakMap(),c:new WeakMap()};try{return f()}finally{colRun=null}};
const pcol=i=>{if(!colRun||!i)return fam(planCol(i));let v=colRun.p.get(i);if(v===undefined){v=fam(planCol(i));colRun.p.set(i,v)}return v};
/* acceptable shoe colours for each trouser colour, best first */
const SH={black:['black'],charcoal:['black','burgundy','brown'],grey:['black','brown','burgundy'],navy:['brown','burgundy','black','tan'],brown:['brown','tan','burgundy'],tan:['brown','tan','burgundy'],olive:['brown','tan','burgundy'],blue:['brown','black','burgundy']};
/* ---- clothing rules (suit/blazer, trousers, shirt, tie) ----
   Every candidate outfit gets one score from these rules; the planner picks among the best-scoring outfits. */
/* (a black, charcoal, grey or silver tie is a quiet neutral: right with navy, charcoal and grey suits, and charcoal or grey with brown and tan) */
const HARM={navy:['burgundy','red','gold','grey','lightblue','green','purple','pink','brown','charcoal','black','silver','blue'],charcoal:['burgundy','red','purple','navy','lightblue','pink','green','gold','black','grey','silver','blue'],grey:['navy','burgundy','blue','purple','pink','green','black','charcoal','silver','red'],black:['red','grey','burgundy','purple','silver','navy','green','charcoal'],brown:['green','gold','navy','tan','burgundy','cream','olive','grey','charcoal'],tan:['navy','brown','burgundy','green','olive','charcoal','blue'],olive:['brown','burgundy','navy','gold','cream','tan'],blue:['navy','burgundy','grey','gold','brown','charcoal','silver'],green:['tan','brown','burgundy','gold','navy']};
/* good tie colours on each shirt colour (white takes almost anything) */
const TIE_ON_SHIRT={mint:['navy','burgundy','brown','green','olive','charcoal','purple','grey'],ivory:['navy','burgundy','brown','green','olive','gold','charcoal','red','grey'],paleyellow:['navy','burgundy','brown','green','purple','charcoal','blue'],lavender:['navy','purple','burgundy','charcoal','grey','black','pink'],periwinkle:['navy','burgundy','charcoal','gold','brown','red','grey','black'],beige:['brown','navy','green','olive','burgundy','tan'],lightblue:['navy','burgundy','red','gold','brown','green','purple','charcoal','grey','black'],pink:['navy','burgundy','grey','charcoal','purple','blue','green','black'],cream:['brown','green','burgundy','olive','navy','gold','tan','charcoal'],lightgrey:['navy','burgundy','black','purple','charcoal','pink','red'],blue:['navy','burgundy','gold','brown','charcoal','red','black'],grey:['navy','burgundy','black','purple','red','charcoal']};
/* good trousers for each odd jacket, best first */
const BLAZER_TROUSERS={navy:['grey','charcoal','tan','cream','olive'],tan:['navy','brown','charcoal','olive','blue'],brown:['grey','charcoal','tan','navy','cream','blue'],olive:['tan','brown','charcoal','cream'],grey:['charcoal','navy','black','blue'],charcoal:['grey','tan','navy'],black:['grey','charcoal'],green:['tan','grey','brown','cream'],burgundy:['grey','charcoal','navy'],blue:['grey','tan','navy','cream']};
const colsOf0=i=>i?[planCol(i),i.secondaryColor,i.tertiaryColor].filter(c=>c&&COLORS[c]).map(c=>fam(colBase(c))):[];
const colsOf=i=>{if(!colRun||!i)return colsOf0(i);let v=colRun.c.get(i);if(v===undefined){v=colsOf0(i);colRun.c.set(i,v)}return v};   // (callers only read the list)
const lumOf=lumCol;

/* dark shirts (navy, charcoal, black, burgundy...) are worn under light jackets (light/mid grey, tan) with a tie lighter
   than the shirt: a modern, less formal look. With any other jacket the classic rule applies: shirt lighter than jacket.
   (Steel blue, a dusty mid blue, is not one of them: it is worn like a blue shirt, under a darker jacket with a darker tie.) */
const darkShirt=s=>!!s&&lumOf(primaryCol(s))<95,lightTop=t=>!!t&&LUM(t)>=130;
/* settings.darkShirts: 'some' (the default: only under a light jacket, and a light shirt is preferred), 'often' (the owner wears them:
   as good as a white shirt, and also under a mid-tone jacket that is clearly lighter than the shirt) or 'never' */
const darkMode=()=>settings.darkShirts||'some';
const darkUnderLight=(t,s)=>darkShirt(s)&&!!t&&darkMode()!=='never'&&(lightTop(t)||(darkMode()==='often'&&LUM(t)>=80&&LUM(t)-LUM(s)>=40));
/* how light a tie reads overall: a patterned tie's stripes, checks or dots lighten (or darken) it */
const tieLum=x=>{const acc=x&&patOf(x)&&!['solid','knit','woven'].includes(patOf(x))?[x.secondaryColor,x.tertiaryColor].filter(c=>c&&COLORS[c]):[];
  return acc.length?LUM(x)*.65+acc.reduce((a,c)=>a+lumOf(c),0)/acc.length*.35:LUM(x)};
/* shirt against the jacket: light, quiet shirts read as professional; the shirt should be lighter than the jacket */
function shirtScore(t,s){
  const raw=planCol(s),pc=pcol(s);
  if(darkUnderLight(t,s))return darkMode()==='often'?5:3;
  if(darkShirt(s)&&darkMode()==='never')return -40;
  let v=({white:5,ivory:4,lightblue:4,pink:2,cream:2,paleyellow:1,lavender:1,lightgrey:1,periwinkle:0,beige:0,mint:0,midgrey:-2,blue:0,steelblue:0})[raw]??(['navy','black','charcoal','brown','burgundy','green','olive','red'].includes(pc)?-10:-5);
  if(!t)return v;const tc=pcol(t);
  if(pc===tc)v-=25;
  if(lumOf(raw)<LUM(t)+20)v-=15;
  if(tc==='black'&&raw!=='white')v-=['lightblue','lightgrey','lavender','ivory'].includes(raw)?2:8;   // a black suit: white first, other pale, quiet shirts fine
  return v;
}
/* tie against shirt and jacket */
function tieScore(t,sh,x){
  let v=0;const xc=pcol(x),acc=colsOf(x).slice(1);
  if(sh){const sc=pcol(sh),raw=planCol(sh),d=LUM(sh)-LUM(x);
    if(xc===sc)v-=15;
    if(xc==='blue'&&raw==='lightblue')v-=6;
    if(darkShirt(sh)){const u=tieLum(x)-LUM(sh);if(u<25)v-=12;else if(u>60)v+=3}   // on a dark shirt the tie is clearly lighter
    else if(d<25)v-=12;else if(d>60)v+=3;                  // otherwise the tie should be clearly darker than the shirt
    const ts=darkShirt(sh)?null:TIE_ON_SHIRT[raw]||TIE_ON_SHIRT[sc];if(raw!=='white'&&ts)v+=ts.includes(xc)?3:-4;
    if(raw==='pink'&&['red','pink'].includes(xc))v-=10;
  }
  if(t){const tc=pcol(t);
    if(xc===tc)v+=tc==='black'?-15:(pw(x)>0||LUM(x)<LUM(t)-15?1:-4);   // tonal (navy on navy) is fine if it reads as a separate layer
    else if(HARM[tc])v+=HARM[tc].includes(xc)?5:-2;
  }
  // accent colours: echoing the shirt or jacket ties the outfit together
  const echo=[...colsOf(sh),...colsOf(t)];
  if(acc.some(c=>echo.includes(c)))v+=3;
  return v;
}
/* trousers for an odd jacket */
function pairScore(t,p){
  if(!t)return 0;const tc=pcol(t),pc=pcol(p);let v=0;
  if(pc===tc)v-=30;
  const list=BLAZER_TROUSERS[tc];
  if((tc==='black')!==(pc==='black')&&!(list&&list.includes(pc)))v-=20;   // black with another colour only where the jacket's own list has it (black trousers under a grey jacket)
  if(list){const k=list.indexOf(pc);v+=k<0?-10:8-k*2}
  else if(!['grey','charcoal','tan','navy','olive','brown','black','cream'].includes(pc))v-=20;
  if(Math.abs(LUM(t)-LUM(p))<35)v-=6;else v+=3;           // jacket and trousers need visible contrast
  return v;
}
/* pattern mixing: one bold pattern is always fine; two are fine if they differ in type or scale; never three */
const PAT_TYPE={stripe:'stripe',pinstripe:'stripe','fine-stripe':'stripe','chalk-stripe':'stripe',check:'check',gingham:'check',tattersall:'check',windowpane:'check','glen-check':'check',houndstooth:'check','polka-dot':'motif',paisley:'motif',foulard:'motif','tonal-check':'check'};
function patInfo(i,role){
  const p=i&&patOf(i);if(!p||!PAT_TYPE[p])return null;     // solids and fine weaves don't count
  const scale=role==='tie'?({stripe:3,check:2,'tonal-check':1,'polka-dot':2,paisley:2,foulard:1})[p]??2
    :role==='shirt'?({pinstripe:1,'fine-stripe':1,houndstooth:1})[p]??2
    :({pinstripe:1,windowpane:3})[p]??2;
  return {type:PAT_TYPE[p],scale};
}
function patternScore(parts){
  const P=parts.map(([i,r])=>patInfo(i,r)).filter(Boolean);let v=0;
  if(P.length>=3)v-=60;
  for(let a=0;a<P.length;a++)for(let b=a+1;b<P.length;b++){
    if(P[a].type===P[b].type)v+=P[a].scale===P[b].scale?-30:-4;else v-=2;
  }
  return v;
}
/* whole outfit: not too many main colours, no single-colour outfits */
function outfitScore(o){
  const main=[o.top,o.suitDay?null:o.bot,o.shirt,o.tie].filter(Boolean).map(pcol);
  let v=0;const n=new Set(main).size;
  if(n>4)v-=10;
  if(o.shirt&&o.tie&&o.top&&pcol(o.shirt)===pcol(o.tie)&&pcol(o.tie)===pcol(o.top))v-=25;
  if(o.tie&&patOf(o.tie)==='knit'&&o.suitDay)v-=4;         // knit ties are a touch casual for a suit
  return v;
}
/* formal days: dark solid suits, white shirts (French cuffs welcome), quiet ties */
function formalTop(i){const c=pcol(i),p=patOf(i)||'solid';let v=['navy','charcoal','black'].includes(c)?30:c==='grey'?8:-25;
  if(['windowpane','glen-check','houndstooth','check','tweed'].includes(p))v-=30;else if(p==='chalk-stripe')v-=10;else if(p==='pinstripe')v-=4;return v}
// the shirt's colour and pattern count FORMAL_SHIRT_K times in clothesScore (French cuffs once): at once, a French-cuff light blue shirt
// under a dark navy suit outscored a white one, which the score (Formality: "white is the formal shirt") then marked down
const FORMAL_SHIRT_K=3;
function formalShirt(s,k=1){let v=k*(({white:6,lightblue:2})[planCol(s)]??-8);if(patInfo(s,'shirt'))v-=6*k;if(s.cuff==='french')v+=4;return v}
function formalTie(t){let v=0;const pi=patInfo(t,'tie');if(pi&&pi.scale>=2)v-=6;if(patOf(t)==='knit')v-=12;
  v+=['burgundy','navy','grey','charcoal','black','purple','silver'].includes(pcol(t))?3:-3;return v}
/* ---- other occasions ----
   funeral: the darkest plain suit (black first), a white shirt, a black tie (the darkest, plainest one otherwise).
   wedding (as a guest): a lighter or brighter suit than for business, never black; a light shirt; a lively tie, never black.
   Each returns points added to the usual rules, like the formal ones above. */
const OCC={
  funeral:{
    top(i){const c=planCol(i),p=patOf(i)||'solid';let v=c==='black'?40:c==='charcoal'||c==='darknavy'?28:c==='navy'||c==='darkgrey'||c==='slate'?18:-40;
      if(['windowpane','glen-check','houndstooth','check','tweed','chalk-stripe'].includes(p))v-=25;else if(p==='pinstripe')v-=8;return v},
    shirt(s){let v=({white:10,ivory:3})[planCol(s)]??-20;if(patInfo(s,'shirt'))v-=8;return v},
    // (a dotted, paisley or foulard tie reads cheerful: below a stripe of the same colour, the audit's funeral with no black tie
    // took a navy polka dot over a navy stripe)
    tie(t){const c=pcol(t),pi=patInfo(t,'tie');let v=c==='black'?22:c==='charcoal'?12:c==='navy'?6:c==='grey'?2:-25;
      if(pi&&pi.scale>=2)v-=8;if(pi&&pi.type==='motif')v-=6;if(patOf(t)==='knit')v-=6;if((patOf(t)||'solid')==='solid')v+=4;return v}},
  wedding:{
    top(i,season){const c=pcol(i),raw=planCol(i),p=patOf(i)||'solid';
      let v=c==='black'?-30:c==='navy'||c==='blue'?14:c==='grey'?14:c==='charcoal'?(raw==='darkgrey'?10:6):c==='tan'||c==='cream'?(season==='warm'?12:2):c==='brown'||c==='olive'||c==='green'?-4:4;
      if(raw==='lightgrey'&&season==='warm')v+=4;if(['windowpane','houndstooth','tweed'].includes(p))v-=6;return v},
    shirt(s){const raw=planCol(s);let v=({white:8,ivory:6,lightblue:5,pink:5,lavender:4,cream:3})[raw]??(darkShirt(s)?-25:-4);if(s.cuff==='french')v+=2;return v},
    tie(t){const c=pcol(t),raw=planCol(t);let v=c==='black'?-30:c==='charcoal'?-8:({silver:8,pink:7,lavender:7,lightblue:6,purple:5,gold:4,burgundy:4,wine:4,blue:4,steelblue:4,grey:4,green:3,navy:2,deepblue:3})[raw]??1;
      if(['paisley','foulard','polka-dot','stripe','woven'].includes(patOf(t)))v+=3;return v}}};
function clothesScore(top,bot,shirt,tie,suitDay,day){
  let v=0;
  if(day){const s=day.clim.season;v+=(suitDay?0:seasonFit(bot,s))+seasonFit(shirt,s)+seasonFit(tie,s);
    if(day.formal){if(shirt)v+=formalShirt(shirt,FORMAL_SHIRT_K);if(tie)v+=formalTie(tie)}
    const oc=OCC[day.occ];if(oc){if(shirt)v+=oc.shirt(shirt);if(tie)v+=oc.tie(tie);
      if(day.occ==='funeral'&&tie&&top&&pcol(tie)==='black'&&pcol(top)==='black')v+=15}   // black on black is right here (it is penalised on other days)
    // no jacket: the shirt is judged against the trousers instead: not the same colour, and a visible contrast
    if((day.occ==='casual'||day.nojkt)&&shirt&&bot){if(pcol(shirt)===pcol(bot))v-=25;v+=Math.abs(LUM(shirt)-LUM(bot))<35?-8:3}
    if(shirt&&shirt.cuff==='french'&&!day.hasLinks)v-=12;}     // French cuffs need cufflinks
  if(!suitDay&&bot)v+=pairScore(top,bot);
  if(shirt)v+=shirtScore(top,shirt);
  if(tie)v+=tieScore(top,shirt,tie);
  v+=patternScore([[top,'top'],[suitDay?null:bot,'bot'],[shirt,'shirt'],[tie,'tie']]);
  v+=outfitScore({top,bot,shirt,tie,suitDay});
  return v;
}
const WARM=['brown','tan','olive'];
/* a shoe's style against the trousers: an oxford goes with anything; derbies and loafers a little less with a suit; boots and sneakers
   only with chinos or jeans (with a suit or dress trousers they score as shoes that don't suit, -50 or worse) */
const SHOE_FIT={oxford:{suit:0,dress:0,casual:0},derby:{suit:-4,dress:0,casual:0},loafer:{suit:-8,dress:-2,casual:0},boot:{suit:-60,dress:-20,casual:0},sneaker:{suit:-60,dress:-60,casual:0}};
const shoeCtx=b=>b.type==='suit'?'suit':trouserKind(b)==='dress'?'dress':'casual';
const SNEAKER_COLS=['white','cream','grey','black','navy','brown','tan'];
const shoeScore=(t,b,s)=>{if(!b)return 0;const sc=pcol(s),bc=pcol(b),tc=t?pcol(t):'';const k=(SH[bc]||['black','brown']).indexOf(sc);let v=k<0?-50:6-k*2;
  if(k<0&&shoeStyle(s)==='sneaker'&&shoeCtx(b)==='casual'&&SNEAKER_COLS.includes(sc))v=4;   /* a white or neutral sneaker goes with any chinos or jeans */if(t&&((WARM.includes(tc)&&sc==='black')||(tc==='black'&&sc!=='black')))v-=50;return v+SHOE_FIT[shoeStyle(s)][shoeCtx(b)]};
/* socks: the trousers' colour first, then the shoes', then a sock that picks up the shirt's or the tie's colour (echo: their colour groups,
   from sockEcho), then a quiet neutral */
const sockEcho=(shirt,tie)=>[shirt&&shirtGroup(shirt),tie&&tieGroup(tie)].filter(g=>g&&!['white','black','grey','navy','brown'].includes(g));
const sockScore=(bot,sh,s,echo)=>{const sc=pcol(s),botc=bot?pcol(bot):'',shc=sh?pcol(sh):'';let v=patOf(s)==='solid'?2:0;if(bot&&sc===botc)v+=8;else if(sh&&sc===shc)v+=4;else if(bot&&echo&&echo.includes(TIE_GROUP[planCol(s)]||sc))v+=4;else if(bot)v+=(WARM.includes(botc)?['brown','tan','olive']:['black','navy','charcoal','grey']).includes(sc)?3:-8;if(bot&&['white','cream','pink','lightblue'].includes(planCol(s)))v-=10;return v};

/* ---- leather goods ----
   Belt and shoes must be the same colour group (black / brown / tan / burgundy-oxblood) and a compatible finish:
   suede with suede, smooth with smooth or grain. Patent is black-tie only. Metals (buckle, watch, tie clip) should agree. */
const leatherGroup=c=>({black:'black',brown:'brown',tan:'tan',khaki:'tan',burgundy:'burgundy',oxblood:'burgundy',wine:'burgundy'})[c]||c;
const finish=l=>l==='suede'||l==='nubuck'?'suede':l==='patent'?'patent':l==='pebble-grain'||l==='scotch-grain'?'grain':l==='canvas'||l==='knit'?'textile':'smooth';   // (nubuck: a napped leather, as suede; a braided belt is smooth leather)
const metalOf=i=>i&&i.type==='tieclip'?clipMetal(i):i&&i.type==='cufflinks'&&i.metal==='silk'?null:i&&i.metal||'silver';   // a tie clip by its colour: null (enamel) goes with any metal; silk knots too
/* two metals that agree: the same, or a two-tone (steel and gold) with either (2026-11-15) */
const metalSame=(a,b)=>a===b||(a==='two-tone'&&(b==='gold'||b==='silver'))||(b==='two-tone'&&(a==='gold'||a==='silver'));
/* an enamel clip (black, red, blue, navy: clipMetal null) by the tie it is worn on (2026-11-14, the owner: 7 of his 9 clips were never
   planned; an enamel clip scored 0 against a matching metal's 9, so it never won): picking up an accent of the tie (its second or third
   colour, by family) ENAMEL_ACCENT (11, above a clip matching the watch and the buckle, 9); the tie's own colour or its close relative
   (red with burgundy, blue with navy) ENAMEL_TONE (8, just under: it comes round when silver has been worn); anything else ENAMEL_CLASH
   (-5). Gold and gunmetal clips still lose to a silver watch and buckle (metalPref) */
/* a gold, rose gold or gunmetal clip is planned only when the watch and the belt's buckle are that metal too (the owner, 2026-11-14:
   "keep gold off", also on a day with his gold watch: his buckles are silver); one picked by hand stays */
const CLIP_OFF=['gold','other'];
const clipAllowed=(c,watch,belt)=>{const m=metalOf(c);return !CLIP_OFF.includes(m)||(!!watch&&metalOf(watch)===m&&!!belt&&metalOf(belt)===m)};
const ENAMEL_ACCENT=11,ENAMEL_TONE=8,ENAMEL_CLASH=-5,ENAMEL_NEAR={red:['burgundy'],burgundy:['red'],blue:['navy'],navy:['blue']};
const enamelPref=(c,tie)=>{if(!tie)return 0;const f=fam(colBase(planCol(c))),t=colsOf(tie);if(!t.length)return 0;
  if(t.slice(1).includes(f))return ENAMEL_ACCENT;if(t[0]===f||(ENAMEL_NEAR[f]||[]).includes(t[0]))return ENAMEL_TONE;return ENAMEL_CLASH};
function beltFit(shoe,belt){
  if(shoeStyle(shoe)==='sneaker')return 0;   // sneakers don't call for a matching belt: any belt will do
  if(leatherGroup(planCol(belt))!==leatherGroup(planCol(shoe)))return null;
  const fs=finish(shoe.leather),fb=finish(belt.leather);
  if(fs===fb)return 3;
  if((fs==='smooth'&&fb==='grain')||(fs==='grain'&&fb==='smooth')||(fb==='textile'&&fs==='suede'))return 0;   // (a canvas belt goes with casual suede)
  return null; // suede vs smooth, patent vs anything else
}
/* shoes the planner keeps back because belts are owned and none matches them (a belt that doesn't match is a real mistake and no belt
   is a last resort): the belt they wait for ("black smooth leather belt"), else ''. The audit: black oxfords and only a brown belt, the
   black pair never planned and nothing said why (the score's Variety line and Insights now say it) */
const beltWait=s=>{if(!s||s.type!=='shoes'||shoeStyle(s)==='sneaker'||!inRotation(s))return '';const B=items.filter(b=>b.type==='belt'&&inRotation(b));
  if(!B.length||B.some(b=>beltFit(s,b)!==null))return '';return `${leatherGroup(planCol(s))} ${finish(s.leather)==='suede'?'suede':'smooth leather'} belt`};
function shoeFormality(shoe,suitDay){
  const f=finish(shoe.leather);
  if(f==='patent')return -200;               // evening wear: only if nothing else exists
  if(f==='suede')return suitDay?-15:0;       // fine with a blazer, too casual with a suit
  if(f==='grain')return suitDay?-8:0;
  return 2;                                  // smooth calf / cordovan
}
function watchFit(w,shoe,belt){
  let v=0;const o=watchOpts(w);
  if(o.band==='leather'&&shoe)v+=leatherGroup(planCol(w))===leatherGroup(planCol(shoe))?8:-20;
  if(belt)v+=metalSame(metalOf(w),metalOf(belt))?6:-6;
  return v;
}

/* bump PLAN_RULES whenever the planning rules change: on the next start the app re-plans every future day (swaps on days
   after today are released: the week's locks go, the owner's own picks (force, skip, the vest) stay, see replanFuture in app.js) */
const PLAN_RULES=16;   // 16: materials (2026-11-15): seasons from tropical wool, cashmere, moleskin, melton and wool ties; nubuck as suede; a canvas belt with suede; two-tone metal; silk-knot cufflinks; 15: fix round 2 (2026-11-15): no real mistake while a clean outfit exists (clothesHard, jacketClean, shoes that don't suit lose to no belt), the day before's tie (TIE_NEXT); 14: the new-user audit (2026-11-15): no shoes that suit the trousers or suit (NO_SHOES), the jacket worn the workday before (JKT_AGAIN), no days before the wardrobe began, stale locks, the oldest wash, funeral motifs, seasons from material; 13: gunmetal jackets are grey; two very dark jackets running read as "dark again" (2026-11-14); 12: the next 3 fixed days' ties and shirts, the ties' capped creep, formal days' narrow window, "Not worn" days (and the 2026-11-13 changes that skipped a bump)
const QWIN=8,SH_CAP=45;   // outfits within this many points of the best one take turns (rest decides among them)
const FORMAL_QWIN=3;   // a formal day or a funeral: only outfits this close to the best one take turns, so the white shirt (formalShirt) isn't traded for rest
const TIE_CREEP=.03,TIE_CREEP_MAX=9;   // a tie's rest keeps creeping after 30 days, capped well under TIE_GAP so a tie never repeats for it
/* jacket colour groups, as the eye reads them: every grey from light grey to charcoal is one look, two navies are one look. A jacket in the same
   group as the previous workday's (weekends and days off skipped) loses about 8 days of rest; a near group or the workday
   before that counts less. Rest still decides when every choice repeats a colour. */
const JKT_GROUP={lightgrey:'grey',midgrey:'grey',grey:'grey',silver:'grey',charcoal:'grey',darkgrey:'grey',gunmetal:'grey',slate:'charcoal',black:'black',
  navy:'navy',darknavy:'navy',deepblue:'navy',blue:'blue',steelblue:'blue',lightblue:'blue',brown:'brown',taupe:'brown',deeptaupe:'brown',rust:'brown',tan:'tan',khaki:'tan',cream:'tan',
  olive:'green',green:'green',burgundy:'red',wine:'red',oxblood:'red'};
const JKT_NEAR=[['grey','charcoal'],['charcoal','black'],['navy','blue'],['navy','charcoal'],['brown','tan']];
const jacketGroup=i=>{const c=planCol(i);return JKT_GROUP[c]||fam(c)};
const groupsNear=(a,b)=>JKT_NEAR.some(([x,y])=>(x===a&&y===b)||(x===b&&y===a));
// prev: the previous workdays' groups (latest first); next: the next workday's group when that day is already fixed
// (worn, or a jacket the user picked), so a pinned day is not crowded either
const DARK_JKT=['black','charcoal','darkgrey'];
/* a and b: {g: group, c: colour}. Black next to charcoal or dark grey also reads as "dark again", and so do any two very dark jackets
   (brightness under JKT_VDARK of 255: black 22, dark navy 31; navy 37 and charcoal 62 are not), whatever their groups (2026-11-14: the
   owner's ink aubergine pinstripe, based on dark navy, then his black suit; and his "mid grey worsted", based on gunmetal, sat in the
   charcoal group, only near the greige melange's grey, so the two greys ran back to back: gunmetal is grey now) */
/* the same group as the workday before (or the next fixed one) costs JKT_SAME (60, was 40: on the owner's wardrobe a well-rested grey suit
   followed a grey blazer, 19 then 22 Nov; measured over his next 124 workdays: 40 gave 1 jacket-group repeat and 1 tie-colour repeat, 60
   and 80 none, scores and the 12 jackets worn unchanged; 80 broke the test wardrobe's tie colours (3 repeats in six months), 60 doesn't) */
const JKT_SAME=60;
const JKT_VDARK=34,darkJkt=c=>DARK_JKT.includes(c)||lumCol(c)<JKT_VDARK;
const nearCost=(a,b)=>a.g!==b.g&&darkJkt(a.c)&&darkJkt(b.c)?26:groupsNear(a.g,b.g)?6:0;
const colourRepeat=(i,prev,next,gw)=>{const me={g:jacketGroup(i),c:planCol(i)},w=gw?gw(me.g):1;let v=0;
  (prev||[]).slice(0,2).forEach((p,n)=>{if(!p||!p.g)return;v+=p.g===me.g?Math.round((n?12:JKT_SAME)*w):n?Math.round(nearCost(p,me)/3):nearCost(p,me)});
  if(next&&next.g)v+=next.g===me.g?Math.round(JKT_SAME*w):nearCost(next,me);return v};
/* how avoidable a repeat of group g is among the jackets the day can take (topGw): the other jackets over the group's own, at most 1. A
   wardrobe with three grey suits and one brown one can't avoid a grey after a grey without brown every other day: there a grey repeat
   costs (1/3)³ of JKT_SAME, about 2, and the four suits rotate evenly (2026-11-14, the audit's walkthrough: brown 35 of 94 suit days, the
   greys 19-20; now 23-24 each). Measured with a suit every workday (tests/jacketshare.test.js): a third (20) left brown on 40% of the suit
   days, squared (7) 31%, cubed 25%, each suit 31 of 124, a grey after a grey on 61 of 124 days, the fewest even rotation allows. Cubed
   leaves the full cost to a balanced wardrobe (no group bigger than the rest together: the owner's, unchanged) */
/* the very jacket worn on the workday before costs JKT_AGAIN more (2026-11-15, the audit: a wedding's suit deleted, the wedding took the
   suit locked for the day before, two days running scored 99): rest alone was outweighed by an occasion's preference; a funeral's black
   suit or a formal day's dark one still wins by more */
const JKT_AGAIN=30;
/* a day without any shoes that suit the trousers (or the suit) is a real mistake (rateOutfit: Shoes, hard): trousers or a suit with
   none in the day's shoes cost NO_SHOES, so they are planned only when nothing else can be (the audit: stone trousers with black shoes
   every other day while charcoal trousers were free) */
const NO_SHOES=40;
/* the week's locks are let go once the wardrobe has grown past a type it was locked with too few of (fewer than LOCK_THIN in rotation
   when the lock was made, rec.lockAt): a new wardrobe is built one item at a time and its first week was locked from one suit (the
   audit: the navy suit on all 7 locked days, its blazer day too, after a second suit and a blazer were added). Locks from before
   lockAt existed, and a wardrobe with LOCK_THIN of each, keep them */
const LOCK_THIN=3,LOCK_TYPES=['suit','blazer','pants','shirt','tie','shoes','belt'];
const lockStale=(rec,pool)=>{const at=rec&&rec.lock&&+rec.lockAt;if(!at)return false;
  return LOCK_TYPES.some(t=>{let old=0,nu=false;for(const i of pool(t)){if((+i.added||0)>at)nu=true;else old++}return nu&&old<LOCK_THIN})};
/* a day's recorded pieces written ahead of the day by a hand pick or "Suggest another" of an earlier version (fix round 3, W2-17-01):
   they were the outfit from before the change, and once the day was past without the app being opened on it they stood as worn in place
   of the pick. Told apart by the record: a pick or swap (force, skip) last saved before the day began, not corrected (edited), not marked
   worn by hand and not recorded by the app afterwards (auto). Such pieces are not the day's: it is planned from its picks and recorded
   again (history.js recordDays) */
const idsAhead=r=>{if(!(r&&r.ids&&(r.force||r.skip)&&!r.edited&&!r.auto&&r.worn!==true))return false;const [y,m,d]=String(r.date).split('-').map(Number);return typeof r.updated==='number'&&r.updated<+new Date(y,m-1,d)};   // (no stamp: a hand-made record, kept)
/* the day the wardrobe began: the first item's `added` (null when an item has none, from before it existed). The simulation doesn't plan
   the days before it: their made-up outfits counted as worn ("This suit was worn 1 day ago" on a new wardrobe, the first outfit marked
   down for "the same shirt as two workdays ago", the audit) */
const wardStart=()=>{let s=Infinity;for(const i of items){if(!i.added)return null;if(i.added<s)s=i.added}if(!isFinite(s))return null;const d=new Date(s);d.setHours(0,0,0,0);return d};
const topGw=pl=>{const c={};for(const i of pl){const g=jacketGroup(i);c[g]=(c[g]||0)+1}return g=>Math.min(1,((pl.length-(c[g]||0))/Math.max(1,c[g]||0))**3)};
/* shirts and ties get the same treatment, with their own groups. White and light blue are the staples: a repeat of those costs
   little. These penalties only choose among outfits that already score within QWIN of the best one. */
const SHIRT_GROUP={white:'white',ivory:'white',cream:'white',lightblue:'lightblue',periwinkle:'blue',blue:'blue',steelblue:'blue',lavender:'purple',pink:'pink',
  paleyellow:'yellow',beige:'beige',mint:'green',lightgrey:'grey',midgrey:'grey',grey:'grey',darkgrey:'grey',charcoal:'grey',slate:'grey',navy:'navy',darknavy:'navy',black:'black',burgundy:'red'};
const TIE_GROUP={navy:'navy',darknavy:'navy',deepblue:'navy',blue:'blue',steelblue:'blue',lightblue:'blue',slate:'blue',black:'black',charcoal:'black',grey:'grey',silver:'grey',
  burgundy:'red',wine:'red',red:'red',oxblood:'red',pink:'pink',purple:'purple',lavender:'purple',green:'green',olive:'green',brown:'brown',tan:'brown',rust:'brown',gold:'gold',cream:'cream'};
const shirtGroup=i=>{const c=planCol(i);return SHIRT_GROUP[c]||fam(c)},tieGroup=i=>{const c=planCol(i);return TIE_GROUP[c]||fam(c)};
const comboRepeat=(sh,x,hist)=>{if(!hist||!hist.length)return 0;const sc=sh?shirtGroup(sh):null;let v=0;
  hist.slice(0,2).forEach((h,n)=>{if(!h)return;if(x&&h.tie===x.id)v+=n?3:7;if(x&&h.tie===x.id&&sc&&h.sc===sc)v+=n?4:8;
    else if(sc&&h.sc===sc&&sc!=='white'&&sc!=='lightblue')v+=n?1:2});return v};
/* how a shirt and a tie read at a glance: every dark shirt (black, charcoal, navy, slate, burgundy...) is one "dark shirt" look,
   and black, charcoal, grey and silver ties are one "monochrome" look. Used for repeats, never for matching */
const shirtLook=sh=>sh?darkShirt(sh)?'dark':shirtGroup(sh):null;
const MONO_TIE=['black','grey'];
const tieLook=x=>{if(!x)return null;const g=tieGroup(x);return MONO_TIE.includes(g)?'mono':g};
const shirtRepeat=(sh,prev)=>{if(!sh||!prev)return 0;const g=shirtGroup(sh),l=shirtLook(sh),staple=g==='white'||g==='lightblue';let v=0;
  prev.slice(0,2).forEach((p,n)=>{if(!p)return;if(p.sg===g)v+=staple?(n?0:2):(n?3:8);else if(l==='dark'&&p.sl==='dark')v+=n?2:6});return v};
/* the same tie within three workdays costs as much as the day before's (the owner's choice, 2026-11-13: one tie on Dec 6 and Dec 8, two
   workdays apart, cost only 4); third: the summary of the workday three back. Tie colours keep their two-day rule */
const TIE_GAP=18;   // the same tie on any of the last three workdays (the day before included)
/* the very tie of the workday before costs TIE_NEXT more (the re-audit, 2026-11-15: with three ties every tie is within three workdays,
   all cost TIE_GAP alike and rest (under 2 points) decided, so the day before's tie came back on 33 of 101 workdays). Two and three back keep TIE_GAP (the owner's choice) */
const TIE_NEXT=20;   // measured on the tester's 3 ties over 101 workdays: next-day repeats 33 → 1, average score 95.9 either way (12 left 3)
const tieRepeat=(x,prev,third)=>{if(!x||!prev)return 0;const g=tieGroup(x),l=tieLook(x);let v=0;
  prev.slice(0,2).forEach((p,n)=>{if(!p)return;if(p.tid===x.id)v+=TIE_GAP+(n?0:TIE_NEXT);else if(p.tg===g)v+=n?2:15;else if(l==='mono'&&p.tl==='mono')v+=n?1:8});if(third&&third.tid===x.id)v+=TIE_GAP;return v};
/* the ties and shirts already fixed on the next 3 workdays (fixedAhead's fx: picked, moved there, worn or locked as shown; w = 0, 1, 2
   workdays ahead, n its day number) are avoided as the last three workdays are: the next one as the day before, then as two and
   three back. NEXT_SHIRT: the very shirt fixed for a day within the wash cycle (settings.laundryDays calendar days; the next
   workday always) is kept for it, as the laundry rule keeps yesterday's (a staple white shirt's repeat is only 2) */
const NEXT_SHIRT=40;
const aheadTie=(x,fx)=>{if(!x||!fx||!fx.length)return 0;let v=0;for(const f of fx)v+=f.w===0?tieRepeat(x,[f]):f.w===1?tieRepeat(x,[null,f]):tieRepeat(x,[],f);return v};
const aheadShirt=(sh,fx,n)=>{if(!sh||!fx||!fx.length)return 0;const LD=Math.max(0,+(settings.laundryDays??1)||0);let v=0;
  for(const f of fx){v+=f.w===0?shirtRepeat(sh,[f]):f.w===1?shirtRepeat(sh,[null,f]):0;if(sh.id===f.sid&&LD>0&&(f.w===0||f.n-n<=LD))v+=NEXT_SHIRT}return v};
/* the whole look: the same jacket colour group with the same shirt look and tie look as one of the last two workdays
   (light grey blazer, dark shirt, grey tie two days after a grey suit, black shirt, black tie) reads as the same outfit again.
   Same jacket colour and shirt look with a different tie still costs a little, unless the shirt is a white or light blue staple */
const lookRepeat=(top,sh,x,prev)=>{if(!top||!prev)return 0;const jg=jacketGroup(top),sl=shirtLook(sh),tl=tieLook(x);let v=0;
  prev.slice(0,2).forEach((p,n)=>{if(!p||p.jg!==jg||p.sl!==sl)return;
    if(p.tl===tl)v+=n?20:25;else if(sl!=='white'&&sl!=='lightblue')v+=n?8:10});return v};   // same jacket colour and shirt look, another tie: half a repeat
/* the clothes make a real mistake: the hard checks of rateOutfit that the jacket, trousers, shirt and tie decide (three bold patterns or
   two of one type and scale; the shirt the jacket's colour, or a dark shirt under a dark jacket; a tie the shirt's colour with no
   contrast; a black tie on a black suit, except at a funeral; trousers the odd jacket's colour; jacket, shirt and tie one colour), and
   trousers with no shoes of the day that suit them (shoeOk from outfit). Keep in step with rateOutfit */
function clothesHard(t,b,sh,x,sd,day,shoeOk){
  const P=[[t,'top'],[sd?null:b,'bot'],[sh,'shirt'],[x,'tie']].map(([i,r])=>patInfo(i,r)).filter(Boolean);
  if(P.length>=3||(P.length===2&&P[0].type===P[1].type&&P[0].scale===P[1].scale))return true;
  if(t&&sh&&!darkUnderLight(t,sh)&&(pcol(sh)===pcol(t)||darkShirt(sh)))return true;
  if(sh&&x&&pcol(x)===pcol(sh)&&(darkShirt(sh)?tieLum(x)-LUM(sh)<25:LUM(sh)-LUM(x)<25))return true;
  if(t&&x&&pcol(t)==='black'&&pcol(x)==='black'&&!(day&&day.occ==='funeral'))return true;
  if(!sd&&t&&b&&pcol(b)===pcol(t))return true;
  if(t&&sh&&x&&pcol(t)===pcol(sh)&&pcol(sh)===pcol(x))return true;
  if(shoeOk&&(b||t)&&!shoeOk(t,sd?t:b))return true;
  return false}
function outfit(suitDay,n,by,last,rec,day){day=day||{formal:false,clim:{season:'mild',rain:false,cold:false},hasLinks:false};
const casual=day.occ==='casual',occ=OCC[day.occ];if(casual)suitDay=false;   // no jacket and no tie: trousers and a shirt
// the dress code (settings.dress): without jackets every workday is planned like that occasion, with a tie if ties are worn; without
// ties none is picked. A formal day, a wedding or a funeral is still dressed in full from what is owned
const full=day.formal||!!occ,noJ=casual||(!full&&!wearsJacket()),noT=casual||(!full&&!wearsTie());if(noJ&&!casual){suitDay=false;day={...day,nojkt:true}}
// no blazer in the wardrobe on a blazer day (or no suit on a suit day): wear the other kind rather than no jacket
if(!noJ&&!by(suitDay?'suit':'blazer').length&&by(suitDay?'blazer':'suit').length)suitDay=!suitDay;
// no jacket of either kind in the wardrobe: trousers, a shirt and a tie rather than a suit day with nothing below the waist
if(!noJ&&suitDay&&!by('suit').length&&!by('blazer').length)suitDay=false;
// rest: days since the piece was worn. Each rest bonus rises quickly at first (rb: over 10 days; a shirt over 45, trousers over 60) and
// then keeps creeping up (over()), so a piece that is always one point short of another still comes round instead of never being worn
const since=i=>n-(last[i.id]??-1e5),rest=i=>Math.min(since(i),60),over=(i,from)=>Math.min(Math.max(0,since(i)-from),300);
const rb=i=>Math.min(rest(i),10)*.4+over(i,10)*.01;
// a day's record can pin pieces (force) or rule them out (skip) after the user swaps something; a day the app has locked (rec.lock:
// the pieces it showed for one of the coming days) keeps them, so a change on one day doesn't reshuffle the days already shown.
// The lock is dropped as a whole when one of its pieces is gone (deleted, taken out of rotation) or the forecast has turned against
// it: suede shoes on a rainy day, a cold-weather piece on a warm day.
const force=rec&&rec.force||{},skip=rec&&rec.skip||{};
const LT={top:suitDay?'suit':'blazer',bot:suitDay?null:'pants',shirt:'shirt',tie:'tie',shoes:'shoes',belt:'belt',socks:'socks',watch:'watch',clip:'tieclip',links:'cufflinks'};
let lock=rec&&rec.lock||null;
// the washing cycle (settings.laundryDays, default 1): a shirt worn within that many days is in the wash, so it is left out of the
// day's shirts unless there is no other; a lock holding such a shirt (it was worn on a day before, by hand) lets go. Not on a
// formal day, a wedding or a funeral: the occasion's shirt outweighs the washing, as its suit outweighs rotation
// every shirt in the wash: the one washed longest ago, never yesterday's for its colour (the audit: three shirts, laundry 3 days, the
// white shirt two workdays running)
const LD=day.formal||(day.occ&&!casual)?0:Math.max(0,+(settings.laundryDays??1)||0),washing=i=>LD>0&&since(i)<=LD,washed=l=>{const f=l.filter(i=>!washing(i));if(f.length)return f;
  let m=-Infinity;for(const i of l)m=Math.max(m,since(i));return l.filter(i=>since(i)===m)};
if(lock)for(const sl in LT){const id=lock[sl],t=LT[sl];if(!id||!t||force[sl]||(skip[sl]||[]).includes(id))continue;const x=by(t).find(i=>i.id===id);
  if(!x||(sl==='shoes'&&day.clim.rain&&finish(x.leather)==='suede')||seasonFit(x,day.clim.season)<=-15||(sl==='shirt'&&washing(x)&&by(t).some(i=>!washing(i)))){lock=null;break}}
const pool=(type,slot)=>{const all=by(type),f=force[slot];if(f){const x=all.find(i=>i.id===f);if(x)return [x]}
  const s=skip[slot]||[],l=lock&&lock[slot];if(l&&!s.includes(l)){const x=all.find(i=>i.id===l);if(x)return [x]}
  const left=all.filter(i=>!s.includes(i.id)),any=left.length?left:all;if(slot==='bot'){const ok=any.filter(botFits);return ok.length?ok:any}return slot==='shirt'?washed(any):any};
// the trousers a day allows: dress trousers only on a formal day, a wedding or a funeral; jeans with a blazer only when the dress code
// says so (settings.dress.jeans); chinos with a blazer, and anything on a day without a jacket
const botFits=i=>{const k=trouserKind(i);if(full&&!casual)return k==='dress';if(!suitDay&&!noJ&&k==='jeans')return !!(settings.dress&&settings.dress.jeans);return true};
const was={},take=b=>{if(!b)return null;const c={...b,rest:rest(b)};if(!(b.id in was))was[b.id]=last[b.id];last[b.id]=n;return c};
// a piece taken off for the day (rec.off) was not worn: its rest goes back to what it was
const untake=b=>{if(!b||!(b.id in was))return;if(was[b.id]===undefined)delete last[b.id];else last[b.id]=was[b.id]};
const best=(arr,sc)=>{let b=null,bs=-1e9;for(const i of arr){const s=sc(i)+rb(i);if(s>bs){bs=s;b=i}}return take(b)};
// suits rotate (least recently worn first); season and formality can override a few days of rest
// a suit whose only shoes were worn yesterday (a black suit the day after black shoes) waits a day when another suit can go first
const shoeBound=i=>{if(i.type!=='suit'||day.formal||occ)return false;const ok=by('shoes').filter(s=>finish(s.leather)!=='patent'&&shoeScore(i,i,s)>-50);return ok.length>0&&ok.every(s=>since(s)<=1)};
// a cold-weather suit on a warm day (or a summer one on a cold day) only when there is no other
const offSeason=i=>seasonFit(i,day.clim.season)<=-15?200:0;
const S=pool('shoes','shoes'),shoeOk=(t,b)=>!S.length||S.some(s=>finish(s.leather)!=='patent'&&shoeScore(t,b,s)>-50);
const noShoes=i=>{if(i.type==='suit')return !shoeOk(i,i);const P=pool('pants','bot');return P.length>0&&!P.some(pt=>shoeOk(i,pt))};
const againJ=i=>day.prev&&day.prev[0]&&day.prev[0].jid===i.id?JKT_AGAIN:0;
const tpl=noJ?[]:pool(suitDay?'suit':'blazer','top'),tgw=topGw(tpl);
// a real mistake in the clothes (clothesHard) is not planned while another jacket avoids it (H7, the re-audit: a pinstripe suit with
// the only clean shirt a stripe and the only tie a stripe, the plain suit free): the jacket rotation would choose takes its turn
// only when some trousers, shirt and tie of the day make a clean outfit with it (jacketClean, stopping at the first one found)
const Tday=noT?[null]:pool('tie','tie'),Shday=pool('shirt','shirt');
const jacketClean=j=>{const P=suitDay?[j]:pool('pants','bot');for(const b of P.length?P:[null])for(const sh of Shday.length?Shday:[null])for(const x of Tday.length?Tday:[null])if(!clothesHard(j,b,sh,x,suitDay,day,shoeOk))return true;return false};
const jscore=i=>-(noShoes(i)?NO_SHOES:0)-againJ(i)+Math.min(rest(i),14)*3+Math.max(0,rest(i)-14)+over(i,60)*.2-offSeason(i)-(shoeBound(i)?10:0)+seasonFit(i,day.clim.season)*2+(day.formal?formalTop(i)*2:0)+(occ?occ.top(i,day.clim.season)*3:0)-colourRepeat(i,day.prev&&day.prev.map(p=>p&&{g:p.jg,c:p.jc}),day.ahead&&day.ahead.next,tgw)-(day.ahead&&day.ahead.soft&&!day.ahead.next?Math.round(colourRepeat(i,null,day.ahead.soft,tgw)/2):0)-(day.ahead&&day.ahead.ids.includes(i.id)?100:0);
const argBest=(arr,sc)=>{let b=null,bs=-1e9;for(const i of arr){const s=sc(i)+rb(i);if(s>bs){bs=s;b=i}}return b};
let tcands=tpl;if(tpl.length>1&&!jacketClean(argBest(tpl,jscore))){const ok=tpl.filter(jacketClean);if(ok.length)tcands=ok}
const top=noJ?null:best(tcands,jscore);
// vest: part of a three-piece suit; worn per the user's setting unless the day overrides it
const vm=settings.vestMode||'auto',vov=rec&&typeof rec.vest==='boolean'?rec.vest:null;
const vest=!!(suitDay&&hasVest(top)&&(vov!==null?vov:vm==='always'||(vm==='auto'&&(day.formal||day.occ==='wedding'||day.clim.season!=='warm'))));
// trousers, shirt and tie are scored together as one outfit. Rotation only chooses among outfits within QWIN points
// of the best one, so variety never costs a clearly better combination.
// Large wardrobes: keep only the 6 best trousers and 16 best shirts for this jacket (rotation included), then try every tie.
const topN=(arr,n,f)=>arr.length<=n?arr:arr.map(i=>[f(i)+rb(i),i]).sort((a,b)=>b[0]-a[0]).slice(0,n).map(x=>x[1]);
// shirts are many and low-stakes: how long one has rested counts for more, so every acceptable shirt comes around
const shRest=sh=>Math.min(rest(sh),SH_CAP)*.5+over(sh,SH_CAP)*.05;
// odd trousers come round once a week at most, so their rest counts over months, not days: every pair that suits the jacket gets worn
const ptRest=pt=>Math.min(rest(pt),60)*.2+over(pt,60)*.05;
const ptNo=pt=>shoeOk(top,pt)?0:NO_SHOES;
const Ps=suitDay?[null]:topN(pool('pants','bot'),6,pt=>pairScore(top,pt)+patternScore([[top,'top'],[pt,'bot']])+ptRest(pt)-ptNo(pt)),Ss=topN(pool('shirt','shirt'),16,sh=>shirtScore(top,sh)+patternScore([[top,'top'],[sh,'shirt']])+shRest(sh)+(occ?occ.shirt(sh):0)+(day.formal?formalShirt(sh,FORMAL_SHIRT_K):0)),Ts=noT?[]:pool('tie','tie'),cands=[];
// each piece's own terms are worked out once (P, S, X), not once per combination, and the rotation part (r) only for the outfits
// inside the window; the sums are in the same order as before, so the plans are identical
const fx=day.ahead&&day.ahead.fx,hk=top&&day.hist&&day.hist[top.id];
const P1=pt=>({pt,no:pt?ptNo(pt):0,rb:pt?rb(pt):0,pr:pt?ptRest(pt):0});
const S1=sh=>({sh,rs:sh?shRest(sh):0,rep:shirtRepeat(sh,day.prev),ah:day.ahead?aheadShirt(sh,fx,n):0});
const X1=x=>({x,r10:x?Math.min(rest(x),10)*.4:0,r30:x?Math.min(rest(x),30)*.25+Math.min(TIE_CREEP_MAX,over(x,30)*TIE_CREEP):0,rep:tieRepeat(x,day.prev,day.prev3),ah:day.ahead?aheadTie(x,fx):0});
const PP=(Ps.length?Ps:[null]).map(P1),SS=(Ss.length?Ss:[null]).map(S1),XX=(Ts.length?Ts:[null]).map(X1);
for(const P of PP)for(const S of SS)for(const X of XX){const {pt}=P,{sh}=S,{x}=X;
  const q=clothesScore(top,suitDay?top:pt,sh,x,suitDay,day)-P.no;   // trousers no shoes of the day suit
  cands.push({q,pt,sh,x,P,S,X});
}
const rOf=({pt,sh,x,P,S,X})=>1.5*(P.rb+X.r10)+P.pr+X.r30+S.rs-S.rep-X.rep-(day.ahead?S.ah+X.ah:0)-lookRepeat(top,sh,x,day.prev)-comboRepeat(sh,x,hk);
const choose=cs=>{let qmax=-Infinity;for(const c of cs)if(c.q>qmax)qmax=c.q;
  const win=cs.filter(c=>c.q>=qmax-(day.formal||day.occ==='funeral'?FORMAL_QWIN:QWIN));for(const c of win)c.r=rOf(c);
  return win.sort((a,b)=>(b.q+b.r)-(a.q+a.r))[0]};
const hardC=c=>clothesHard(top,suitDay?top:c.pt,c.sh,c.x,suitDay,day,shoeOk);
let pick1=choose(cands);
// the best outfit for this jacket is a real mistake: the best clean one, if there is any, however far down (H7)
if(hardC(pick1)){const clean=cands.filter(c=>!hardC(c));if(clean.length)pick1=choose(clean)}
const bot=suitDay?top:take(pick1.pt),shirt=take(pick1.sh),tie=take(pick1.x);
// shoes, belt and watch are chosen together so the belt always matches the shoes and the metals agree
const B=pool('belt','belt'),W=pool('watch','watch');let pick=null;
for(const s of S.length?S:[null])for(const b of [...B,null])for(const w of W.length?W:[null]){
  let t=0;
  // shoes that don't suit (a real mistake) cost NO_SHOES more, so they lose to a pair with no matching belt (30, not a mistake): the
  // re-audit's blazer day, khaki chinos and black calf shoes at 69 while the oxblood loafers suited them
  if(s){const ss=shoeScore(top,bot,s);t+=ss-(ss<=-50?NO_SHOES:0)+shoeFormality(s,suitDay)+rb(s)-(rest(s)<=1&&!day.formal&&day.occ!=='funeral'?7:0);   // leather shoes want a day to dry: not yesterday's pair when another suits
    if(day.clim.rain&&finish(s.leather)==='suede')t-=25;             // suede and rain don't mix
    if(day.formal||day.occ==='funeral'){const g=leatherGroup(planCol(s)),f=finish(s.leather);t+=(f==='suede'||f==='grain')?-20:g==='black'?(day.occ==='funeral'?20:8):g==='burgundy'?3:-4}
    if(day.occ==='wedding'&&finish(s.leather)==='suede')t-=15}
  if(b){if(!s)continue;const f=beltFit(s,b);if(f===null)continue;t+=12+f+rb(b)}else if(B.length&&s)t-=30; // no matching belt: allowed, but last resort
  if(w)t+=watchFit(w,s,b)+rb(w);
  if(!pick||t>pick.t)pick={t,s,b,w};
}
const shoes=take(pick&&pick.s),belt=take(pick&&pick.b),watch=take(pick&&pick.w);
const socks=best(pool('socks','socks'),s=>sockScore(bot,shoes,s,sockEcho(shirt,tie)));
const metalPref=c=>metalOf(c)===null?enamelPref(c,tie):(watch?(metalSame(metalOf(c),metalOf(watch))?6:-4):0)+(belt?(metalSame(metalOf(c),metalOf(belt))?3:-2):0);
const clipPool=pool('tieclip','clip').filter(c=>force.clip===c.id||clipAllowed(c,watch,belt));
const clip=vest||!tie?null:best(clipPool,metalPref);   // the vest holds the tie: no clip
// cufflinks only (and always) with French cuffs
const french=shirt&&shirt.cuff==='french',links=french?best(pool('cufflinks','links'),metalPref):null;
// coat when the forecast (or the season) calls for one: raincoat for rain unless it's very cold, otherwise an overcoat
const clim=day.clim,needCoat=clim.cold||clim.rain,prefer=clim.rain&&!clim.veryCold?'raincoat':'overcoat';
const coat=needCoat?best([...pool('overcoat','coat'),...pool('raincoat','coat')],c=>(c.type===prefer?10:0)+seasonFit(c,clim.season)+(['navy','charcoal','tan','grey','black'].includes(pcol(c))?3:0)+(shoes&&pcol(c)==='black'&&leatherGroup(planCol(shoes))!=='black'?-4:0)):null;
// say so when the wardrobe can't make a correct combination, instead of silently mismatching
const notes=[];
// clothing: only reached when the wardrobe had no compliant combination for this jacket
if(shirt&&tie&&darkShirt(shirt)&&tieLum(tie)-LUM(shirt)<25)notes.push(`The ${nm(tie)} isn't lighter than the ${nm(shirt)}; on a dark shirt a lighter tie reads better.`);
if(shirt&&tie&&!darkShirt(shirt)&&LUM(shirt)-LUM(tie)<25)notes.push(`The ${nm(tie)} isn't darker than the ${nm(shirt)}; no darker tie suited this outfit. A darker tie would look sharper.`);
if(top&&shirt&&!darkUnderLight(top,shirt)&&LUM(shirt)<LUM(top)+20)notes.push(`The ${nm(shirt)} is darker than the jacket. A lighter shirt would look more professional.`);
if([[top,'top'],[suitDay?null:bot,'bot'],[shirt,'shirt'],[tie,'tie']].filter(([i,r])=>patInfo(i,r)).length>=3)notes.push('Three bold patterns today; there was no quieter combination. A solid shirt or tie would calm it down.');
if(shoes&&bot&&shoeScore(top,bot,shoes)<=-50)notes.push(`None of your shoes suit ${colName(planCol(bot))} pants.`);
if(shoes&&finish(shoes.leather)==='patent')notes.push('Only patent shoes were available. Patent is for black tie.');
if(shoes&&B.length&&!belt)notes.push(`None of your belts match the ${desc(shoes)} shoes. Add a ${leatherGroup(planCol(shoes))} ${finish(shoes.leather)==='suede'?'suede':'smooth leather'} belt.`);
if(watch&&belt&&!metalSame(metalOf(watch),metalOf(belt)))notes.push(`The watch (${metalOf(watch)}) and belt buckle (${metalOf(belt)}) are different metals.`);
if(french&&!links)notes.push('French-cuff shirt, but no cufflinks in your wardrobe. Add a pair.');
if(clim.rain&&shoes&&finish(shoes.leather)==='suede')notes.push('Rain is forecast and only suede shoes suited this outfit. Smooth leather would hold up better.');
if(needCoat&&!coat)notes.push(clim.rain?'Rain is forecast and there is no raincoat in your wardrobe.':'It will be cold and there is no overcoat in your wardrobe.');
if(day.occ==='funeral'&&tie&&pcol(tie)!=='black')notes.push(patInfo(tie,'tie')?'No black tie in your wardrobe for a funeral: the most sober one you have was chosen. A plain black tie is right for a funeral.':'No black tie in your wardrobe for a funeral: the darkest, plainest one was chosen.');
if(day.occ==='funeral'&&top&&occ.top(top)<18)notes.push('No black, charcoal or navy suit for a funeral: the darkest one was chosen.');
if(day.occ==='wedding'&&top&&pcol(top)==='black')notes.push('Only a black suit was available: black is usually avoided at a daytime wedding.');
if(noJ&&!bot)notes.push('No separate pants in your wardrobe for a day without a jacket. Add a pair of pants.');
if(top&&seasonFit(top,clim.season)<-10)notes.push(`The ${nm(top)} is a ${itemSeason(top)}-weather piece on a ${clim.season} day; no better suit was available.`);
// no waistcoat without a tie (the owner, 2026-11-13: "No one should ever wear a vest and no tie"): a day planned without a tie (the dress
// code, a casual day) has none, whatever the vest setting or the day's own choice
const o={suitDay,top,bot,shirt,tie,shoes,belt,socks,watch,clip,links,coat,vest:vest&&!!tie,vestOverride:vov!==null,notes:notes.map(prettyCols),clim,formal:!!day.formal,occasion:day.occ||(day.formal?'formal':null)};
return takeOff(o,rec&&rec.off,untake)}
/* Pieces taken off for the day (the owner's ask, 2026-11-13: Today's "Take off" on the jacket or the tie; rec.off = {top, tie}). The
   outfit is planned as usual (the day's other pieces are pinned by force when it is set) and then the piece comes off:
   - the jacket: on a suit day the suit's trousers stay (o.bot is the suit, o.suitDay false, o.suitBot true) and the waistcoat goes with
     the jacket (no picture has a waistcoat without its jacket); a blazer is not counted as worn
   - the tie: the tie clip and the waistcoat go with it (no waistcoat without a tie, the owner's rule); neither is counted as worn
   o.off says what came off (o.offKind 'suit' or 'blazer'), so Today can put it back; the score asks for neither (needsJacket/needsTie) */
function takeOff(o,off,untake){if(!off||!(off.top||off.tie))return o;const r={...o,off:{top:!!(off.top&&o.top),tie:!!(off.tie&&o.tie)}};
  if(r.off.top){r.offKind=o.suitDay?'suit':'blazer';if(o.suitDay){r.bot=o.top;r.suitDay=false;r.suitBot=true}else if(untake)untake(o.top);r.top=null;r.vest=false;
    r.notes=r.notes.filter(t=>!/jacket|suit|blazer/i.test(t))}
  if(r.off.tie){if(untake){untake(o.tie);if(o.clip)untake(o.clip)}r.tie=null;r.clip=null;r.vest=false;r.notes=r.notes.filter(t=>!/\btie\b/i.test(t))}
  return r}
/* ---- outfit score ----
   A readable 0-100 rating of an outfit against the same rules the planner uses.
   Each check earns points out of a maximum; checks that don't apply (no belt owned, suit days have no separate trousers)
   are left out, and the score is the share of available points earned.
   Points are lost for things that can be put right, not for taste: a pink shirt scores like a white one, brown shoes like
   black where both suit the trousers. A real mistake (a check marked hard: black shoes with a brown suit, three bold patterns,
   a belt that doesn't match the shoes, a cold-weather suit on a hot day, a missing piece) caps the score at HARD_CAP, so an
   outfit with one can never read as good however well the rest matches.
   o.ctx (from planSim: the last two workdays) adds the Variety check. */
const HARD_CAP=69;
const QUIET_SHIRTS=['white','lightblue','ivory','pink','cream','lightgrey','paleyellow','lavender','periwinkle','mint','beige','blue','steelblue','midgrey'];
function rateOutfit(o){
  const nice=prettyCols;
  const C=[],add=(label,pts,max,why,hard)=>{const p=Math.max(0,Math.min(max,pts));C.push({label,pts:p,max,why:p<max?nice(why):'',hard:!!hard&&p<max})};
  const {top,shirt,tie,shoes,belt,socks,watch,clip}=o,bot=o.suitDay?null:o.bot,trousers=o.bot||top,casual=o.occasion==='casual';
  // a piece is missing: not a styling fault, but not an outfit either
  // (o.gone: a past day's piece deleted from the wardrobe since; it was worn, so it isn't missing)
  {const miss=[],G=o.gone||{};if(!shirt&&!G.shirt)miss.push('shirt');if(!trousers&&!G.bot&&!(o.suitDay&&G.top))miss.push('pants');if(!top&&!G.top&&needsJacket(o))miss.push('jacket');if(!tie&&!G.tie&&needsTie(o))miss.push('tie');if(!shoes&&!G.shoes)miss.push('shoes');
    if(miss.length)add('Complete outfit',0,10,'no '+miss.join(', no ')+' for this day',true)}
  if(shirt){const raw=planCol(shirt);let v=10,why='',hard=false;
    if(darkUnderLight(top,shirt)){}
    else if(top&&pcol(shirt)===pcol(top)){v=0;why='shirt is the same color as the jacket';hard=true}
    else if(top&&darkShirt(shirt)){v=2;why='a dark shirt wants a clearly lighter jacket';hard=true}
    else if(top&&LUM(shirt)<LUM(top)+20){v=5;why='shirt is darker than the jacket'}
    else if(!QUIET_SHIRTS.includes(raw)&&!darkShirt(shirt)){v=5;why=`a ${raw} shirt is a strong color for business`}
    if(shirt.cuff==='french'&&!o.links){v-=5;why=(why?why+'; ':'')+'French cuffs without cufflinks'}
    add('Shirt',v,10,why,hard)}
  if(shirt&&tie){const raw=planCol(shirt),d=LUM(shirt)-LUM(tie);let v=0,why=[],flat=false;
    if(darkShirt(shirt)){if(tieLum(tie)-LUM(shirt)>=25)v+=8;else{flat=true;why.push('tie is not lighter than the dark shirt')}}
    else if(d>=25)v+=8;else{flat=true;why.push('tie is not darker than the shirt')}
    const same=pcol(tie)===pcol(shirt);if(!same)v+=2;else why.push('tie and shirt are the same color');
    const ts=darkShirt(shirt)?null:TIE_ON_SHIRT[raw]||TIE_ON_SHIRT[pcol(shirt)];
    if(raw==='pink'&&['red','pink'].includes(pcol(tie))){why.push(`a ${planCol(tie)} tie clashes with a pink shirt`)}
    else if(raw==='white'||!ts||ts.includes(pcol(tie)))v+=5;else{v+=1;why.push(`${planCol(tie)} is an unusual tie color on a ${raw} shirt`)}
    add('Tie and shirt',v,15,why.join('; '),flat&&same)}   // the same colour and no contrast: the tie disappears
  if(tie&&top){const tc=pcol(top),xc=pcol(tie);let v,why='',hard=false;
    if(o.occasion==='funeral'&&xc==='black')v=10;   // a black tie is right at a funeral, whatever the suit
    else if(xc===tc){if(tc==='black'){v=0;why='black tie on a black suit reads as funeral wear';hard=true}else if(pw(tie)>0||LUM(tie)<LUM(top)-15)v=10;else{v=7;why='tonal tie blends into the jacket'}}
    else if(!HARM[tc]||HARM[tc].includes(xc))v=10;else{v=5;why=`${planCol(tie)} is not a classic partner for a ${planCol(top)} jacket`}
    add('Tie and jacket',v,10,why,hard)}
  {const parts=[[top,'top'],[bot,'bot'],[shirt,'shirt'],[tie,'tie']],P=parts.map(([i,r])=>patInfo(i,r)).filter(Boolean);let v=10,why='',hard=false;
    if(P.length>=3){v=0;why='three bold patterns compete';hard=true}
    else if(P.length===2&&P[0].type===P[1].type){if(P[0].scale!==P[1].scale){v=8;why='two patterns of the same type (different scale)'}else{v=3;why='two patterns of the same type and scale';hard=true}}
    if(top||shirt||tie)add('Patterns',v,10,why,hard)}
  if(bot&&top){const list=BLAZER_TROUSERS[pcol(top)];let v=10,why='',hard=false;const k=list?list.indexOf(pcol(bot)):-1;
    if(pcol(bot)===pcol(top)){v=0;why='jacket and pants are the same color: neither a suit nor a contrast';hard=true}
    else{if(k<0){v=4;why=`${planCol(bot)} pants are not a classic match for a ${planCol(top)} jacket`}
      if(Math.abs(LUM(top)-LUM(bot))<35){v-=4;why=(why?why+'; ':'')+'jacket and pants lack contrast'}}
    add('Pants',v,10,why,hard)}
  if(shoes&&trousers){const s=shoeScore(top,trousers,shoes),k=(SH[pcol(trousers)]||['black','brown']).indexOf(pcol(shoes));
    add('Shoes',s<=-50?0:10,10,k<0?`${planCol(shoes)} shoes don't suit ${planCol(trousers)} pants`:top&&pcol(top)==='black'?'a black suit needs black shoes':`black shoes don't suit a ${top?planCol(top):''} jacket`,true)}
  if(shoes&&items.some(i=>i.type==='belt'&&inRotation(i))){const f=belt?beltFit(shoes,belt):null;
    add('Belt',!belt?0:f===null?0:f>0?10:8,10,!belt?'no belt matches the shoes':f===null?'belt does not match the shoes':'belt finish differs slightly from the shoes',!!belt&&f===null)}
  if(shoes){const f=finish(shoes.leather);let v=5,why='';
    if(f==='patent'){v=0;why='patent shoes are for black tie'}else if(f==='suede'&&o.suitDay){v=2;why='suede is casual for a suit'}else if(f==='grain'&&o.suitDay){v=3;why='grain leather is casual for a suit'}
    add('Leather formality',v,5,why,f==='patent')}
  {const ms=[watch,belt,clip].filter(Boolean).map(metalOf).filter(Boolean);
    if(ms.length>=2)add('Metals',ms.every(a=>ms.every(b=>metalSame(a,b)))?5:2,5,clip||wearsTie()?'watch, buckle and tie clip metals differ':'watch and buckle metals differ');}
  if(watch&&shoes&&watchOpts(watch).band==='leather'){const g=leatherGroup(planCol(watch)),sg=leatherGroup(planCol(shoes));
    add('Watch strap',g===sg?5:2,5,`a ${planCol(watch)} leather strap with ${planCol(shoes)} shoes`)}
  if(socks&&trousers){const v0=sockScore(trousers,shoes,socks,sockEcho(shirt,tie))-(patOf(socks)==='solid'?2:0);let v,why='',hard=false;
    if(['white','cream','pink','lightblue'].includes(planCol(socks))&&LUM(trousers)<120){v=0;why='light socks with dark pants';hard=true}
    else if(v0>=8||(shoes&&pcol(socks)===pcol(shoes)))v=5;
    else if(v0>=3){v=4;why=v0>=4?'socks pick up the shirt or tie rather than the pants':'socks are a neutral, not the pants\' color'}
    else{v=2;why='socks don\'t match the pants'}
    add('Socks',v,5,why,hard)}
  {const main=[top,bot,shirt,tie].filter(Boolean).map(pcol),n=new Set(main).size;let v=5,why='',hard=false;
    if(top&&shirt&&tie&&pcol(top)===pcol(shirt)&&pcol(shirt)===pcol(tie)){v=0;why='jacket, shirt and tie are all one color';hard=true}else if(n>4){v=2;why='more than four main colors'}
    if(main.length)add('Overall harmony',v,5,why,hard)}
  if(o.formal){let v=0;const why=[];
    if(top&&formalTop(top)>=25)v+=3;else why.push('a darker solid suit is more formal');
    if(shirt&&planCol(shirt)==='white')v+=3;else if(shirt&&planCol(shirt)==='lightblue'){v+=1;why.push('white is the formal shirt')}else why.push('white is the formal shirt');
    if(tie&&formalTie(tie)>=0)v+=2;else why.push('a quieter tie is more formal');
    if(shoes&&leatherGroup(planCol(shoes))==='black'&&finish(shoes.leather)==='smooth')v+=2;else why.push('black smooth-leather shoes are the formal choice');
    add('Formality',v,10,why.join('; '))}
  if(!top&&!needsJacket(o)&&shirt&&o.bot){let v=10,why=[];
    if(pcol(shirt)===pcol(o.bot)){v-=6;why.push('shirt and pants are the same color')}
    if(Math.abs(LUM(shirt)-LUM(o.bot))<35){v-=3;why.push('shirt and pants lack contrast')}
    add('Shirt and pants',v,10,why.join('; '))}
  if(o.occasion==='funeral'){let v=0;const why=[];
    if(top&&OCC.funeral.top(top)>=18)v+=3;else why.push('a black, charcoal or navy plain suit is right for a funeral');
    if(shirt&&planCol(shirt)==='white')v+=3;else why.push('a white shirt is right for a funeral');
    if(tie&&pcol(tie)==='black')v+=2;else why.push('a black tie is right for a funeral');
    if(shoes&&leatherGroup(planCol(shoes))==='black')v+=2;else why.push('black shoes are right for a funeral');
    add('Funeral',v,10,why.join('; '))}
  if(o.occasion==='wedding'){let v=0;const why=[];
    if(top&&pcol(top)!=='black')v+=3;else why.push('black suits are usually avoided at a wedding');
    if(shirt&&!darkShirt(shirt)&&OCC.wedding.shirt(shirt)>=3)v+=3;else why.push('a white or pale shirt suits a wedding');
    if(tie&&OCC.wedding.tie(tie)>=3)v+=2;else why.push('a livelier tie (silver, pastel or patterned) suits a wedding');
    if(shoes&&finish(shoes.leather)!=='suede'&&finish(shoes.leather)!=='patent')v+=2;else why.push('smooth leather shoes suit a wedding');
    add('Wedding',v,10,why.join('; '))}
  if(o.clim){const c=o.clim,s=c.season;let v=5;const why=[],worn=[top,o.suitDay?null:o.bot,shirt,tie].filter(Boolean);
    const off=worn.filter(i=>seasonFit(i,s)<-10),mild=worn.filter(i=>{const f=seasonFit(i,s);return f<0&&f>=-10});
    if(off.length){v=0;why.push(`${off.map(nm).join(', ')}: ${off.map(itemSeason).filter((x,n,a)=>a.indexOf(x)===n).join(' and ')}-weather on a ${s} day`)}
    if(mild.length){v-=1;why.push(`${mild.map(nm).join(', ')} ${mild.length>1?'are':'is'} made for ${mild.map(itemSeason).filter((x,n,a)=>a.indexOf(x)===n).join(' and ')} weather`)}
    if((c.cold||c.rain)&&!o.coat&&items.some(i=>(i.type==='overcoat'||i.type==='raincoat')&&inRotation(i))){v-=2;why.push('no coat for the weather')}
    if(c.rain&&shoes&&finish(shoes.leather)==='suede'){v-=2;why.push('suede shoes in the rain')}
    if(c.wx||c.norm||off.length||mild.length)add('Weather',v,5,why.join('; '),off.length>0)}
  // variety: against the last two workdays (and yesterday's shoes)
  if(o.ctx&&o.ctx.prev&&o.ctx.prev[0]){const P=o.ctx.prev.filter(Boolean),ago=p=>{const w=o.ctx.prev.indexOf(p);return w?'two workdays ago':'the workday before'};let v=5;const why=[];
    const jg=top?jacketGroup(top):null,sl=shirtLook(shirt),tl=tieLook(tie),look=top&&P.find(p=>p.jg===jg&&p.sl===sl&&p.tl===tl);
    if(look){v-=3;why.push(`the same look as ${ago(look)} (jacket color, shirt and tie)`)}
    const st=tie&&P.find(p=>p.tid===tie.id);if(st){v-=2;why.push(`the same tie as ${ago(st)}`)}else if(tie&&o.ctx.prev3&&o.ctx.prev3.tid===tie.id){v-=1;why.push('the same tie as three workdays ago')}else if(tie&&P[0]===o.ctx.prev[0]&&P[0].tg===tieGroup(tie)&&!look){v-=1;why.push('the same tie color as the workday before')}
    const ss=shirt&&P.find(p=>p.sid===shirt.id);if(ss){v-=2;why.push(`the same shirt as ${ago(ss)}`)}
    if(top&&o.ctx.prev[0].jid===top.id){v-=2;why.push(`the same ${top.type==='suit'?'suit':'blazer'} as the workday before`)}
    if(shoes&&o.ctx.prev[0].sh===shoes.id&&o.ctx.n-o.ctx.prev[0].n===1){v-=1;const w=items.find(x=>x.type==='shoes'&&x.id!==shoes.id&&beltWait(x));
      why.push('the same shoes as yesterday: leather likes a day\'s rest'+(w?` (your ${nm(w)} wait for a ${beltWait(w)} to match them)`:''))}
    add('Variety',v,5,why.join('; '))}
  const max=C.reduce((a,c)=>a+c.max,0),got=C.reduce((a,c)=>a+c.pts,0),raw=max?Math.round(100*got/max):0,hard=C.filter(c=>c.hard);
  const score=hard.length?Math.min(raw,HARD_CAP):raw;
  const label=C.some(c=>c.label==='Complete outfit')?'Incomplete':score>=90?'Excellent':score>=80?'Very good':score>=70?'Good':score>=55?'Fair':'Needs work';
  return {score,label,checks:C,raw,hard:hard.map(c=>c.label)};
}
/* What the wardrobe could do better on this day, keeping the jacket: single swaps that raise the score.
   pool(slot) -> the items that could be worn in that slot (app.js: slotPool). Returns
   fixes: up to 3 swaps, best first [{slot, item, gain, score}] (new shoes bring their best belt);
   best: the score reached by taking the best swap again and again (the wardrobe's best with this jacket);
   stuck: the labels of the checks that lost points and that no single swap improves (the wardrobe can't do better there). */
const ADVICE_SLOTS=['shirt','tie','bot','shoes','belt','socks','watch','clip'];
function scoreAdvice(o,pool){
  const swap=(cur,slot,it)=>{const a={...cur,[slot]:it};
    if(slot==='shoes'){let bb=null,bf=-1;for(const b of pool('belt')){const f=beltFit(it,b);if(f!==null&&f>bf){bf=f;bb=b}}a.belt=bb}
    return a};
  const tries=cur=>{const out=[];for(const slot of ADVICE_SLOTS){if((slot==='bot'&&(cur.suitDay||cur.suitBot))||(slot==='clip'&&(cur.vest||!cur.tie))||(slot!=='clip'&&slot!=='belt'&&!cur[slot]))continue;
    for(const it of pool(slot)){if(cur[slot]&&cur[slot].id===it.id)continue;const a=swap(cur,slot,it);out.push({slot,item:it,o:a,r:rateOutfit(a)})}}return out};
  const base=rateOutfit(o),T=tries(o),seen={},fixes=[];
  for(const t of T.filter(t=>t.r.score>base.score).sort((a,b)=>b.r.score-a.r.score||(a.item.id<b.item.id?-1:1))){if(seen[t.slot])continue;seen[t.slot]=1;fixes.push({slot:t.slot,item:t.item,gain:t.r.score-base.score,score:t.r.score})}
  const stuck=base.checks.filter(c=>c.pts<c.max&&!T.some(t=>{const d=t.r.checks.find(x=>x.label===c.label);return d?d.pts>c.pts:false})).map(c=>c.label);
  let cur=o,best=base.score;for(let n=0;n<6;n++){const b=(n?tries(cur):T).reduce((m,t)=>t.r.score>(m?m.r.score:best)?t:m,null);if(!b)break;cur=b.o;best=b.r.score}
  return {score:base.score,fixes:fixes.slice(0,3),best,stuck};
}
/* A saved day: past days (and any day marked worn) are frozen to what was shown, so wardrobe changes never rewrite history.
   Rotation counts frozen days unless they're marked "didn't wear". */
function frozenOutfit(rec,n,last){
  const o={suitDay:!!rec.suitDay,frozen:true,worn:rec.worn,formal:!!rec.formal,occasion:occOf(rec),notes:[]};
  for(const s of SLOTS){const id=rec.ids[s],it=id&&items.find(i=>i.id===id);o[s]=it?{...it,rest:Math.min(n-(last[it.id]??-1e5),60)}:null;
    if((id&&!it)||(rec.gone&&rec.gone[s]))(o.gone||(o.gone={}))[s]=true}   // a piece deleted since: the day is rated without it (rateOutfit), not as "Incomplete" (rec.gone: a removed sample piece's slot, kit.js kitSampleDay)
  o.vest=!!(rec.vestOn&&o.suitDay&&hasVest(o.top));
  // a piece taken off that day (rec.off, see takeOff): the record already holds the outfit without it
  if(rec.off&&(rec.off.top||rec.off.tie)){o.off={top:!!rec.off.top&&!o.top,tie:!!rec.off.tie&&!o.tie};o.suitBot=!!(o.bot&&o.bot.type==='suit');if(o.off.top)o.offKind=o.suitBot?'suit':'blazer'}
  if(rec.worn!==false)for(const s of SLOTS)if(o[s])last[o[s].id]=n;
  return o;
}
/* One simulation, resumable: planSim(start).upTo(day) plans every workday from start to that day and can be asked again
   for a later day, continuing where it stopped (the app keeps one for all the months it shows, so stepping to another
   month only plans the days that are new). The wardrobe, history and settings must not change in between: start a new one. */
function planSim(start){const lists={},by=t=>lists[t]||(lists[t]=items.filter(i=>i.type===t&&(!i.paused||arriveN(i)!=null)).sort((a,b)=>a.id<b.id?-1:1)),last={},plan={},T=todayDate();
const hasLinks=by('cufflinks').length>0,W0=wardStart();let prev=[],prev3=null;
const lockOf=(r,n)=>r&&r.lock&&!lockStale(r,byOn(n))?r.lock:null;   // a day's lock, unless the wardrobe has outgrown it (lockStale)   // prev3: the workday before those two (only its tie is used: tieRepeat)   // the previous workdays (latest first): jacket, shirt and tie colour groups, and the tie
// jackets already fixed on the next workdays (worn, or picked by the user): the next one's colour group, and the ids of
// those within the next 3 workdays, which are held back so a pinned jacket is not worn just before its day
const fixedAhead=d=>{const x=new Date(d),ids=[],fx=[];let next=null,soft=null,w=0;for(let g=0;g<10&&w<3;g++){x.setDate(x.getDate()+1);if(!isWorkday(x))continue;
    const r=dayRecs[key(x)];
    // the tie and shirt of each of the next 3 workdays when they are fixed (picked, a whole outfit moved there, worn or shown): avoided
    // as the last three workdays' are (fx: sumUps with w and n, see aheadTie/aheadShirt), so a day planned afresh doesn't take the tie
    // or shirt already fixed a day or three later (2026-11-13: an outfit moved from Nov 23 to Nov 24, and Nov 23 took the same black
    // tie and check shirt; the audit: a tie swapped today took a tie locked two or three workdays later)
    const lk=lockOf(r,di(x)),rids=r&&r.ids&&(x<T||r.worn===true)&&!idsAhead(r)?r.ids:null;
    if(r&&r.worn!==false){const pk=s=>r.force&&r.force[s]||(rids&&rids[s])||(lk&&lk[s]),ti=pk('tie')&&items.find(i=>i.id===pk('tie')),si=pk('shirt')&&items.find(i=>i.id===pk('shirt'));
      if(ti||si)fx.push({tid:ti?ti.id:null,tg:ti?tieGroup(ti):null,tl:ti?tieLook(ti):null,sg:si?shirtGroup(si):null,sl:si?shirtLook(si):null,sid:si?si.id:null,w,n:di(x)})}
    const id=r&&(r.force&&r.force.top||(rids&&rids.top)||(lk&&lk.top)),it=id&&items.find(i=>i.id===id);
    if(it){ids.push(it.id);if(!w)next={g:jacketGroup(it),c:planCol(it)}}
    // an occasion coming up (funeral, wedding, formal): the one suit that is clearly right for it is kept for that day
    else if(occOf(r)&&occOf(r)!=='casual'){const oc=occOf(r),sc=j=>oc==='formal'?formalTop(j):OCC[oc].top(j,dayClimate(x).season),ranked=by('suit').map(j=>[sc(j),j]).sort((a,b)=>b[0]-a[0]);
      if(ranked.length>1&&ranked[0][0]>ranked[1][0])ids.push(ranked[0][1].id)}
    // not fixed and the next day is a blazer day: the blazer due (longest rested) is the likely pick, so the suit before it
    // avoids that colour (only this way round: suits are many, blazers few and must keep rotating)
    else if(!w&&settings.blazerDays.includes(x.getDay())&&!settings.blazerDays.includes(d.getDay())&&!occOf(r)){
      const pool=by('blazer');let due=null,dr=-1;for(const j of pool){const rr=di(x)-(last[j.id]??-1e5);if(rr>dr){dr=rr;due=j}}
      if(due)soft={g:jacketGroup(due),c:planCol(due)}}
    w++}return {next,ids,soft,fx}};
const hist={},remember=o=>{if(!o.top)return;const h=hist[o.top.id]||(hist[o.top.id]=[]);h.unshift({tie:o.tie?o.tie.id:null,sc:o.shirt?shirtGroup(o.shirt):null});h.length=Math.min(h.length,2)};
const sumUp=(o,n)=>({jid:o.top?o.top.id:null,jg:o.top?jacketGroup(o.top):null,jc:o.top?planCol(o.top):null,sg:o.shirt?shirtGroup(o.shirt):null,tg:o.tie?tieGroup(o.tie):null,tid:o.tie?o.tie.id:null,sl:shirtLook(o.shirt),tl:tieLook(o.tie),sid:o.shirt?o.shirt.id:null,sh:o.shoes?o.shoes.id:null,n});
const d=new Date(start);
// the pool for one day: items in rotation that day (one on its way joins the day after it arrives)
const arriving=items.some(i=>i.paused&&arriveN(i)!=null),byOn=n=>arriving?(t=>by(t).filter(i=>inRotation(i,n))):by;
const upTo0=end=>{
for(const E=di(end);di(d)<=E;d.setDate(d.getDate()+1)){const w=d.getDay();   // (day numbers: where the clocks change at midnight, the date after it sits at 01:00)
 if(!isWorkday(d))continue;   // weekends, public holidays and days off
  const k=key(d);let rec=dayRecs[k];
  if(rec&&rec.ids&&(d<T||rec.worn===true)&&!idsAhead(rec)){plan[k]=frozenOutfit(rec,di(d),last);plan[k].ctx={prev,prev3,n:di(d)};if(rec.worn!==false&&(plan[k].top||!wearsJacket())){prev3=prev[1]||null;prev=[sumUp(plan[k],di(d)),prev[0]];remember(plan[k])}continue}   // (a day without a jacket leaves the jacket history alone; a day marked "Not worn" is not the previous workday for repeats either)
  if(W0&&d<W0&&d<T)continue;   // before the wardrobe began (wardStart): nothing was worn then
  if(rec&&rec.noOutfit&&d<T)continue;   // a past day dressed only from the sample wardrobe, since removed (kit.js kitSampleDay): no outfit recorded
  if(rec&&rec.lock&&!lockOf(rec,di(d))){rec={...rec};delete rec.lock}
  const occ=occOf(rec),formal=occ==='formal',lt=rec&&rec.lock&&!(rec.force&&rec.force.top)&&rec.lock.top&&items.find(i=>i.id===rec.lock.top),o=outfit(lt&&!rec.kind&&!(occ==='casual')?lt.type==='suit':rec&&rec.kind?rec.kind==='suit':!!(occ&&occ!=='casual')||!settings.blazerDays.includes(w),di(d),byOn(di(d)),last,rec,{formal,occ:occ&&occ!=='formal'?occ:null,clim:dayClimate(d),hasLinks,prev,prev3,ahead:fixedAhead(d),hist});o.overrides=!!(rec&&(rec.force||rec.skip));o.worn=rec&&rec.worn;o.ctx={prev,prev3,n:di(d)};plan[k]=o;if(o.top||!wearsJacket()){prev3=prev[1]||null;prev=[sumUp(o,di(d)),prev[0]];remember(o)}}
return plan};
return {plan,upTo:end=>withColRun(()=>upTo0(end))}}
/* every month from two months back onward is simulated from one shared start, so neighbouring months agree on the days they
   share (the plan depends on what came before: rest and the previous workdays' jacket colours) */
const planStart=(y,m)=>{const T=todayDate();return new Date(Math.min(+new Date(y,m,-13),+new Date(T.getFullYear(),T.getMonth()-2,-13)))};
function buildPlan(y,m){return planSim(planStart(y,m)).upTo(new Date(y,m+1,0))}

