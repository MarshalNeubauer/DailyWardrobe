/* Daily Wardrobe: outfit rules, planning and scoring (no DOM access; also loaded by the analysis worker) */
/* colour families for the rules: dark grey behaves like charcoal, light grey like grey, oxblood like burgundy */
const FAM={stone:'tan',denim:'blue',mint:'green',paleyellow:'cream',ivory:'cream',beige:'tan',khaki:'tan',taupe:'tan',deeptaupe:'brown',coyote:'brown',rust:'brown',periwinkle:'blue',darkgrey:'charcoal',lightgrey:'grey',midgrey:'grey',oxblood:'burgundy',wine:'burgundy',steelblue:'blue',deepblue:'navy',darknavy:'navy',slate:'charcoal',rosegold:'gold',gunmetal:'charcoal'},fam=c=>FAM[c]||c;
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
  else if(accFams(x).some(c=>echo.includes(c))||acc.some(c=>accFams(sh).includes(c)||accFams(t).includes(c)))v+=ACC_ECHO;   // an accent's echo, weaker
  return v;
}
/* (2026-11-16, accents: core.js accentsOf) an item's accents as colour families. They count where colours are matched, always weaker than
   the three main colours: a tie whose accent echoes the shirt or jacket (or whose second colour echoes one of theirs) +ACC_ECHO where a
   second or third colour's echo is +3; cufflinks picking up a tie's accent ENAMEL_MINOR, between a tone (ENAMEL_TONE) and a clash */
const ACC_ECHO=1;
const accFams=i=>i&&i.accents?accentsOf(i).map(c=>fam(colBase(c))):[];
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
const PAT_TYPE={stripe:'stripe',pinstripe:'stripe','fine-stripe':'stripe','chalk-stripe':'stripe',check:'check',gingham:'check',tattersall:'check',windowpane:'check','glen-check':'check',houndstooth:'check','polka-dot':'motif',paisley:'motif',foulard:'motif','tonal-check':'check',camouflage:'camo'};   // (camouflage: bold and large, its own kind, 2026-11-16)
function patInfo(i,role){
  const p=i&&patOf(i);if(!p||!PAT_TYPE[p])return null;     // solids and fine weaves don't count
  const scale=role==='tie'?({stripe:3,check:2,'tonal-check':1,'polka-dot':2,paisley:2,foulard:1})[p]??2
    :role==='shirt'?({pinstripe:1,'fine-stripe':1,houndstooth:1,camouflage:3})[p]??2
    :({pinstripe:1,windowpane:3,camouflage:3})[p]??2;
  return {type:PAT_TYPE[p],scale};
}
/* a uniform (the owner, 2026-11-16: "the military requires you to wear both together"): camouflage pieces worn together are one pattern,
   not a clash (patsOf), and a camouflage shirt or pants with the other kind of piece, or a camouflage shirt under a jacket that isn't,
   costs UNIFORM_SPLIT, so they are planned together */
const UNIFORM_SPLIT=40,isCamo=i=>!!i&&patOf(i)==='camouflage';
const camoUniform=(sh,b)=>isCamo(sh)&&isCamo(b),uniformSplit=(sh,b)=>!!sh&&!!b&&isCamo(sh)!==isCamo(b);
function patsOf(parts){let c=false;return parts.map(([i,r])=>patInfo(i,r)).filter(p=>p&&(p.type!=='camo'||(!c&&(c=true))))}
function patternScore(parts){
  const P=patsOf(parts);let v=0;
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
  if(p==='camouflage')v-=60;else if(['windowpane','glen-check','houndstooth','check','tweed'].includes(p))v-=30;else if(p==='chalk-stripe')v-=10;else if(p==='pinstripe')v-=4;return v}
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
      if(p==='camouflage')v-=60;else if(['windowpane','glen-check','houndstooth','check','tweed','chalk-stripe'].includes(p))v-=25;else if(p==='pinstripe')v-=8;return v},
    shirt(s){let v=({white:10,ivory:3})[planCol(s)]??-20;if(patInfo(s,'shirt'))v-=8;return v},
    // (a dotted, paisley or foulard tie reads cheerful: below a stripe of the same colour, the audit's funeral with no black tie
    // took a navy polka dot over a navy stripe)
    tie(t){const c=pcol(t),pi=patInfo(t,'tie');let v=c==='black'?22:c==='charcoal'?12:c==='navy'?6:c==='grey'?2:-25;
      if(pi&&pi.scale>=2)v-=8;if(pi&&pi.type==='motif')v-=6;if(patOf(t)==='knit')v-=6;if((patOf(t)||'solid')==='solid')v+=4;return v}},
  wedding:{
    top(i,season){const c=pcol(i),raw=planCol(i),p=patOf(i)||'solid';
      let v=c==='black'?-30:c==='navy'||c==='blue'?14:c==='grey'?14:c==='charcoal'?(raw==='darkgrey'?10:6):c==='tan'||c==='cream'?(season==='warm'?12:2):c==='brown'||c==='olive'||c==='green'?-4:4;
      if(raw==='lightgrey'&&season==='warm')v+=4;if(p==='camouflage')v-=40;else if(['windowpane','houndstooth','tweed'].includes(p))v-=6;return v},
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
    if((day.occ==='casual'||day.nojkt)&&shirt&&bot&&!camoUniform(shirt,bot)){if(pcol(shirt)===pcol(bot))v-=25;v+=Math.abs(LUM(shirt)-LUM(bot))<35?-8:3}
    if(shirt&&shirt.cuff==='french'&&!day.hasLinks)v-=12;}     // French cuffs need cufflinks
  if(!suitDay&&bot)v+=pairScore(top,bot);
  if(uniformSplit(shirt,suitDay?null:bot)||(isCamo(shirt)&&top&&!isCamo(top)))v-=UNIFORM_SPLIT;   // (a camouflage shirt under a suit or blazer too)
  if(shirt)v+=shirtScore(top,shirt);
  if(tie)v+=tieScore(top,shirt,tie);
  v+=patternScore([[top,'top'],[suitDay?null:bot,'bot'],[shirt,'shirt'],[tie,'tie']]);
  v+=outfitScore({top,bot,shirt,tie,suitDay});
  return v;
}
const WARM=['brown','tan','olive'];
/* a shoe's style against the trousers: an oxford goes with anything; derbies and loafers a little less with a suit; boots and sneakers
   only with chinos or jeans (with a suit or dress trousers they score as shoes that don't suit, -50 or worse) */
const SHOE_FIT={oxford:{suit:0,dress:0,casual:0},derby:{suit:-4,dress:0,casual:0},loafer:{suit:-8,dress:-2,casual:0},boot:{suit:-60,dress:-20,casual:0},sneaker:{suit:-60,dress:-60,casual:0},combat:{suit:-60,dress:-60,casual:0}};
/* combat boots (2026-11-17, the owner: "only with camouflage pants"): never planned (core.js isHandPick); picked by hand they suit
   camouflage pants (core.js camoPants) and nothing else, a shoe that doesn't suit (SHOE_LINE) with any other pants or a suit */
const COMBAT_FIT=6;
const shoeCtx=b=>b.type==='suit'?'suit':trouserKind(b)==='dress'?'dress':'casual';
const SNEAKER_COLS=['white','cream','grey','black','navy','brown','tan'];
/* black shoes under a brown, tan or olive jacket, or other shoes with a black suit: a real mistake whatever the trousers say. It costs
   SHOE_CLASH (60, was 50), more than the trousers' best shoe points (6), so it always reaches the -50 line the score (rateOutfit: Shoes,
   hard), shoeOk, clothesHard and NO_SHOES use (the code review, CR-3-08: -44 to -48 never did, so the score gave such shoes full marks) */
const SHOE_CLASH=60;
const shoeClash=(t,s)=>{if(!t||!s)return false;const sc=pcol(s),tc=pcol(t);return (WARM.includes(tc)&&sc==='black')||(tc==='black'&&sc!=='black')};
const shoeScore=(t,b,s)=>{if(!b)return 0;if(shoeStyle(s)==='combat')return camoPants(b)?COMBAT_FIT:SHOE_LINE-10;const sc=pcol(s),bc=pcol(b);const k=(SH[bc]||['black','brown']).indexOf(sc);let v=k<0?-50:6-k*2;
  if(k<0&&shoeStyle(s)==='sneaker'&&shoeCtx(b)==='casual'&&SNEAKER_COLS.includes(sc))v=4;   /* a white or neutral sneaker goes with any chinos or jeans */if(shoeClash(t,s))v-=SHOE_CLASH;return v+SHOE_FIT[shoeStyle(s)][shoeCtx(b)]};
/* socks: the trousers' colour first, then the shoes', then a sock that picks up the shirt's or the tie's colour (echo: their colour groups,
   from sockEcho), then a quiet neutral */
const sockEcho=(shirt,tie)=>[shirt&&shirtGroup(shirt),tie&&tieGroup(tie)].filter(g=>g&&!['white','black','grey','navy','brown'].includes(g));
/* (2026-11-17) ctx: the outfit around the socks ({top, bot, shirt, tie, formal, occasion}: sockPatScore's patterned-sock rules); a plain sock
   scores exactly as before */
const sockScore=(bot,sh,s,echo,ctx)=>{const sc=pcol(s),botc=bot?pcol(bot):'',shc=sh?pcol(sh):'';let v=patOf(s)==='solid'?2:0;if(bot&&sc===botc)v+=8;else if(sh&&sc===shc)v+=4;else if(bot&&echo&&echo.includes(TIE_GROUP[planCol(s)]||sc))v+=4;else if(bot)v+=(WARM.includes(botc)?['brown','tan','olive']:['black','navy','charcoal','grey']).includes(sc)?3:-8;if(bot&&['white','cream','pink','lightblue'].includes(planCol(s)))v-=10;return v+(ctx?(sockPatterned(s)?sockPatScore(s,ctx).v:0)+sockDayScore(s,ctx):0)};
/* (2026-11-17, the owner's answers on the sock review) a bright sock that is not a bold pattern (a plain or quiet-knit red, pink, purple,
   gold, a vivid blue or rust, a light tan or khaki: sockBright) is marked down on a formal day, a wedding or a funeral like a bold pattern
   (SOCK_FORMAL); burgundy, wine, navy, the grays, browns, olive and green are dark enough. And a sock's material follows the season
   (SOCK_MAT: merino, wool and cashmere blends in the cold, cotton, bamboo and silk blends in the heat, +-SOCK_MAT_PTS; a sock with no
   material, or another, is neutral; mild days neither) */
const SOCK_BRIGHT_FAM=['red','pink','purple','gold'],SOCK_QUIET_FAM=['burgundy','black','charcoal','grey','navy','brown','olive','green'];
const sockBright=s=>{const c=planCol(s),f=fam(c);if(SOCK_BRIGHT_FAM.includes(f))return true;const [L,a,b]=labOf(c),C=Math.hypot(a,b);
  if(f!=='burgundy'&&C>40)return true;if(SOCK_QUIET_FAM.includes(f))return false;return L>62&&C>12};   // (a vivid rust or blue by its chroma; wine is a burgundy)
const SOCK_MAT={cold:['merino wool','wool blend','cashmere blend'],warm:['cotton','mercerized cotton','bamboo','silk blend']},SOCK_MAT_PTS=2;
const sockMatFit=(s,season)=>{const m=String(s&&s.material||'').toLowerCase().trim();if(!m||!SOCK_MAT[season])return 0;
  return SOCK_MAT[season].includes(m)?SOCK_MAT_PTS:SOCK_MAT[season==='cold'?'warm':'cold'].includes(m)?-SOCK_MAT_PTS:0};
const sockDayScore=(s,c)=>(sockFormalDay(c)&&!sockBold(s)&&sockBright(s)?-SOCK_FORMAL:0)+sockMatFit(s,c.season);
/* ---- patterned socks (2026-11-17, the owner's sock patterns) ----
   A bold sock (argyle, stripes, dots, another design: SOCK_BOLD) is one more pattern in the outfit: with two bold patterns above it already
   (a patterned shirt and a busy tie) it costs SOCK_BUSY, and beside one of its own type it costs SOCK_SAME (same scale) or SOCK_NEAR. Its
   second and third colours may pick up the tie (SOCK_ECHO_TIE: an argyle whose diamonds are the tie's burgundy) or the shirt's colour
   (SOCK_ECHO_SHIRT; white and black left out). It is for casual days: chinos, jeans or a casual day SOCK_CASUAL, a suit SOCK_SUIT less; a
   formal day, a wedding or a funeral takes plain dark socks (SOCK_FORMAL less for a bold one; the quiet knits are fine there). A quiet knit
   (ribbed, birdseye, nailhead, herringbone, clock) reads plain from a step away: no pattern, no echo, no rule. Light socks with dark pants
   stay the hard mistake they were (by the sock's ground colour). A plain sock is untouched: the plan of a wardrobe with only plain socks is
   byte for byte the same (tests/dress.test.js GOLD) */
const SOCK_BOLD={argyle:{type:'argyle',scale:2},stripe:{type:'stripe',scale:2},'polka-dot':{type:'motif',scale:1},other:{type:'motif',scale:2}};
const SOCK_BUSY=14,SOCK_SAME=10,SOCK_NEAR=3,SOCK_ECHO_TIE=5,SOCK_ECHO_SHIRT=3,SOCK_CASUAL=4,SOCK_SUIT=3,SOCK_FORMAL=25;
const sockBold=s=>sockPatterned(s)?SOCK_BOLD[patOf(s)]||null:null;
const sockFormalDay=c=>!!c&&(c.formal||c.occasion==='formal'||c.occasion==='wedding'||c.occasion==='funeral');
/* the patterned sock against its outfit: {v: points, why: [reasons], echo: 'tie'|'shirt'|'', clash: true when it makes a third pattern or
   repeats one} */
function sockPatScore(s,c){const b=sockBold(s),out={v:0,why:[],echo:'',clash:false};if(!b)return out;
  const parts=[[c.top,'top'],[c.bot&&c.bot.type!=='suit'?c.bot:null,'bot'],[c.shirt,'shirt'],[c.tie,'tie']],P=patsOf(parts);
  if(P.length>=2){out.v-=SOCK_BUSY;out.clash=true;out.why.push('patterned socks with two patterns above them')}
  for(const [i,role] of parts){const p=patInfo(i,role);if(!p||p.type!==b.type)continue;
    if(p.scale===b.scale){out.v-=SOCK_SAME;out.clash=true;out.why.push(`socks in the same kind of pattern as the ${({top:'jacket',bot:'pants'})[role]||role}`)}else out.v-=SOCK_NEAR}
  const mine=[...colsOf(s).slice(1),...accFams(s)].filter(x=>x!=='white'&&x!=='black'),tieC=c.tie?[...colsOf(c.tie),...accFams(c.tie)]:[],shC=c.shirt?colsOf(c.shirt).filter(x=>x!=='white'):[];
  if(mine.some(x=>tieC.includes(x))){out.v+=SOCK_ECHO_TIE;out.echo='tie'}else if(mine.some(x=>shC.includes(x))){out.v+=SOCK_ECHO_SHIRT;out.echo='shirt'}
  if(sockFormalDay(c)){out.v-=SOCK_FORMAL;out.why.push(c.occasion==='funeral'?'a funeral calls for plain dark socks':c.occasion==='wedding'?'plain dark socks suit a wedding':'a formal day calls for plain dark socks')}
  else if(c.occasion==='casual'||(c.bot&&c.bot.type==='pants'&&['chinos','jeans'].includes(trouserKind(c.bot))))out.v+=SOCK_CASUAL;
  else if(c.bot&&c.bot.type==='suit')out.v-=SOCK_SUIT;
  return out}

/* ---- leather goods ----
   Belt and shoes must be the same colour group (black / brown / tan / burgundy-oxblood) and a compatible finish:
   suede with suede, smooth with smooth or grain. Patent is black-tie only. Metals (buckle, watch, tie clip) should agree. */
const leatherGroup=c=>({black:'black',brown:'brown',coyote:'brown',tan:'tan',khaki:'tan',burgundy:'burgundy',oxblood:'burgundy',wine:'burgundy'})[c]||c;
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
const ENAMEL_ACCENT=11,ENAMEL_TONE=8,ENAMEL_MINOR=4,ENAMEL_CLASH=-5,ENAMEL_NEAR={red:['burgundy'],burgundy:['red'],blue:['navy'],navy:['blue']};
const enamelPref=(c,tie)=>{if(!tie)return 0;const f=fam(colBase(planCol(c))),t=colsOf(tie);if(!t.length)return 0;
  if(t.slice(1).includes(f))return ENAMEL_ACCENT;if(t[0]===f||(ENAMEL_NEAR[f]||[]).includes(t[0]))return ENAMEL_TONE;return accFams(tie).includes(f)?ENAMEL_MINOR:ENAMEL_CLASH};
/* ---- pocket squares (2026-11-16, the owner's approved feature: "a square fold, a bit out of the pocket") ----
   Worn only with a jacket on (a suit or a blazer; never on a day without one, and it comes off with the jacket: takeOff). The rules:
   - never the tie's own colour and pattern (psSameTie: the classic rule, complement it, don't match it); a square in the tie's colour with
     another pattern reads as a set, PS_TONE less than an echo
   - a square that picks up a colour of the outfit: its colours (main, second, third, accents) against the tie's (accents too), the shirt's
     and the jacket's (accents too), white left out (it would always echo a white shirt): PS_ECHO, PS_ECHO_ACC more when it picks up the
     tie's second or third colour or an accent (the classic match)
   - white (or cream) in a plain, bordered or woven square is the safe default that goes with everything: PS_WHITE, just under an echo
   - anything else PS_CLASH; a square is planned only when its score is at least PS_MIN (a white one, or one that echoes), so with only
     coloured squares that pick nothing up the day has none; with a white one owned every jacket day has one
   - a formal day: white first (PS_FORMAL either way); a funeral: a plain white square or none (others are never planned there);
     a wedding: as any day, white welcome
   - rotation: rest (rb) and PS_AGAIN for yesterday's square, like the other accessories; a pick or a lock is worn whatever its score */
const PS_ECHO=8,PS_ECHO_ACC=2,PS_TONE=3,PS_WHITE=6,PS_CLASH=-6,PS_MIN=0,PS_FORMAL=8,PS_AGAIN=4,PS_NEVER=-100;
const psWhite=p=>!!p&&['white','cream'].includes(planCol(p))&&['solid','border','woven'].includes(patBase(p.pattern)||'solid');
const psSameTie=(p,x)=>!!p&&!!x&&pcol(p)===pcol(x)&&(patOf(p)||'solid')===(patOf(x)||'solid');
/* the outfit's colours a square can pick up (families, white left out): {all, tieAcc (the tie's second, third and accents)} */
const psTargets=(top,shirt,tie)=>{const ok=c=>c&&c!=='white',tc=colsOf(tie),ta=[...tc.slice(1),...accFams(tie)].filter(ok);
  return {all:new Set([...tc,...accFams(tie),...colsOf(shirt),...colsOf(top),...accFams(top)].filter(ok)),tieAcc:new Set(ta)}};
const psEcho=(p,top,shirt,tie)=>{const T=psTargets(top,shirt,tie),mine=[...colsOf(p),...accFams(p)].filter(c=>c!=='white');
  return {hit:mine.some(c=>T.all.has(c)),acc:mine.some(c=>T.tieAcc.has(c))}};
function pocketScore(p,top,shirt,tie,day){const occ=day&&day.occ;
  if(psSameTie(p,tie))return PS_NEVER;
  if(occ==='funeral')return psWhite(p)&&(patBase(p.pattern)||'solid')!=='border'?PS_WHITE:PS_NEVER;
  const e=psEcho(p,top,shirt,tie),white=psWhite(p);let v=e.hit?PS_ECHO+(e.acc?PS_ECHO_ACC:0)-(tie&&pcol(p)===pcol(tie)?PS_TONE:0):white?PS_WHITE:PS_CLASH;
  if(white&&e.hit)v=Math.max(v,PS_WHITE);
  if(day&&day.formal)v+=white?PS_FORMAL:-PS_FORMAL;
  return v}
function beltFit(shoe,belt){
  if(shoeStyle(shoe)==='sneaker'||shoeStyle(shoe)==='combat')return 0;   // sneakers and combat boots don't call for a matching belt: any belt will do
  if(leatherGroup(planCol(belt))!==leatherGroup(planCol(shoe)))return null;
  const fs=finish(shoe.leather),fb=finish(belt.leather);
  if(fs===fb)return 3;
  if((fs==='smooth'&&fb==='grain')||(fs==='grain'&&fb==='smooth')||(fb==='textile'&&fs==='suede'))return 0;   // (a canvas belt goes with casual suede)
  return null; // suede vs smooth, patent vs anything else
}
/* shoes the planner keeps back because belts are owned and none matches them (a belt that doesn't match is a real mistake and no belt
   is a last resort): the belt they wait for ("black smooth leather belt"), else ''. The audit: black oxfords and only a brown belt, the
   black pair never planned and nothing said why (the score's Variety line and Insights now say it) */
const beltWait=s=>{if(!s||s.type!=='shoes'||shoeStyle(s)==='sneaker'||shoeStyle(s)==='combat'||!inRotation(s))return '';const B=items.filter(b=>b.type==='belt'&&inRotation(b));
  if(!B.length||B.some(b=>beltFit(s,b)!==null))return '';return `${leatherGroup(planCol(s))} ${finish(s.leather)==='suede'?'suede':'smooth leather'} belt`};
function shoeFormality(shoe,suitDay){
  const f=finish(shoe.leather);
  if(f==='patent')return -200;               // evening wear: only if nothing else exists
  if(f==='suede')return suitDay?-SUIT_SUEDE:0;   // fine with a blazer, too casual with a suit
  if(f==='grain')return suitDay?-8:0;
  return 2;                                  // smooth calf / cordovan
}
/* with a suit, formality wins (the owner's decision, fix round 3, 2026-11-16): suede costs SUIT_SUEDE (30, was 15), and the watch's strap and
   metal count SHOE_WATCH (half) in the shoe choice, so a brown strap and a gold buckle no longer put casual suede loafers with a suit most days
   (the audit: suede on 82 of 101 suit days, +8 strap +6 metal against -20 -6 for oxblood calf; the score's Watch strap check takes 3 of 5).
   Leather shoes want a day to dry: yesterday's pair costs SHOE_AGAIN (25, was 7) when another pair suits, more than the halved strap and
   metal swing (20), less than no matching belt (30) (the audit: one pair 87 times two days running) */
const SUIT_SUEDE=30,SHOE_WATCH=.5,SHOE_AGAIN=25;
/* rain wins (the owner, 2026-11-17, on the code review's CR-3-02): suede (and nubuck) is never planned on a rainy day while another pair is
   left, even when that means yesterday's pair again; it was -25, the same as SHOE_AGAIN, so resting yesterday's calf pair put suede in the rain */
const RAIN_SUEDE=1000;
function watchFit(w,shoe,belt){
  let v=0;const o=watchOpts(w);
  if(o.band==='leather'&&shoe)v+=leatherGroup(planCol(w))===leatherGroup(planCol(shoe))?8:-20;
  if(belt)v+=metalSame(metalOf(w),metalOf(belt))?6:-6;
  return v;
}

/* bump PLAN_RULES whenever the planning rules change: on the next start the app re-plans the days after today (the week's locks and
   the app's own recorded pieces go; the owner's swaps and picks (force, skip, the vest) and a kept trip stay: replanFuture(true) in history.js) */
const PLAN_RULES=28;   // what each number changed: CLAUDE.md, "PLAN_RULES history" (add the next one there)
/* ---- favorites (2026-11-18, the owner's approved design, option B): settings.fav = {looks:[{j,sh,tie,at}], items:[id]}, marked by hand
   only (fav.js). A favorite look is the day's jacket, shirt and tie by id (j null on a day without a jacket, tie null without a tie). The
   planner brings a favorite look back on its own (favDue in planSim) and gives favorite pieces a rest target shorter by a fifth (FAV_REST_K)
   and the win when outfits tie (FAV_TIE). With no favorites nothing here changes a plan. */
const FAV_REST_K=1.25;   // a favorite piece's rest counts a quarter more: its rest target is a fifth shorter (a tie's 25 days, 20)
const FAV_TIE=1;   // a favorite piece wins when two choices score the same, or within a point (.01 moved too little: on the bench wardrobes a favorite tie 0-18% more wears, now 7-50%)
const FAV_LOOK_REST=15;   // workdays a favorite look rests before the planner brings it back (about three weeks)
const FAV_WEEK=7;   // at most one favorite look in any 7 days (worn, picked or planned)
let favMemo={f:undefined,looks:[],items:null};
const favRead=()=>{const f=typeof settings!=='undefined'&&settings?settings.fav:undefined;if(favMemo.f===f)return favMemo;
  const L=f&&Array.isArray(f.looks)?f.looks.filter(l=>l&&typeof l.sh==='string'&&(l.j||l.tie)):[],I=f&&Array.isArray(f.items)?f.items.filter(x=>typeof x==='string'):[];
  return favMemo={f,looks:L,items:I.length?new Set(I):null}};
const favKey=(j,sh,tie)=>(j||'-')+'|'+(sh||'-')+'|'+(tie||'-');
const favLookKey=l=>favKey(l.j,l.sh,l.tie);
const favLooks=()=>favRead().looks;
const favItemSet=()=>favRead().items;
const isFavItem=id=>{const s=favRead().items;return !!s&&s.has(id)};
/* the favorite look an outfit is (its jacket, shirt and tie), or null */
const favLookOf=o=>{const L=favRead().looks;if(!L.length||!o||!o.shirt)return null;const k=favKey(o.top&&o.top.id,o.shirt.id,o.tie&&o.tie.id);return L.find(l=>favLookKey(l)===k)||null};
/* a shirt and tie the owner loves together: Harmony doesn't mark that pairing down (dialHarmony) */
const favPair=(sh,x)=>{const L=favRead().looks;return !!L.length&&!!sh&&!!x&&L.some(l=>l.sh===sh.id&&l.tie===x.id)};
const QWIN=8,SH_CAP=45;   // outfits within this many points of the best one take turns (rest decides among them)
const LOOK_PAIR=3,LOOK_K=2,LOOK_FREE=3,LOOK_RESTED=.75;   // the look in the clothes choice (chooseClothes): points per point of dialLook short of each piece's own best outfit, and of the best rested one's
const FORMAL_QWIN=3;   // a formal day, a wedding or a funeral: only outfits this close to the best one take turns, so the white shirt (formalShirt) isn't traded for rest
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
   greys 19-20; now 23-24 each). Measured with a suit every workday (tests/jacketcolour.test.js): a third (20) left brown on 40% of the suit
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
const COMBO_CAP=12;   // comboRepeat at most this for a tie other than the workday before's (outfit's comboCost, the code review CR-3-03)
const comboRepeat=(sh,x,hist)=>{if(!hist||!hist.length)return 0;const sc=sh?shirtGroup(sh):null;let v=0;
  hist.slice(0,2).forEach((h,n)=>{if(!h)return;if(x&&h.tie===x.id)v+=n?3:7;if(x&&h.tie===x.id&&sc&&h.sc===sc)v+=n?4:8;
    else if(sc&&h.sc===sc&&sc!=='white'&&sc!=='lightblue')v+=n?1:2});return v};
/* the same tie with the same shirt colour within the last PAIR_DAYS workdays, under any jacket, costs PAIR_GAP (the owner, 2026-11-16:
   a pink shirt and the black-and-pink tie on 15 Nov came back on 24 Nov under another suit: comboRepeat only knows each jacket's own
   last two outfits, the other repeats two or three workdays). Every shirt colour, white and light blue too (the owner's manager's choice).
   pairs: the latest workdays' {tie, sc} (planSim), latest first; measured on the owner's plan to 31 Jan: such repeats 6 → 0, scores unchanged */
const PAIR_GAP=5,PAIR_DAYS=10;
const pairRepeat=(sh,x,pairs)=>{if(!sh||!x||!pairs||!pairs.length)return 0;const sc=shirtGroup(sh);return pairs.some(p=>p&&p.tie===x.id&&p.sc===sc)?PAIR_GAP:0};
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
/* ---- the real mistakes, each written once (the code review, CR-3-13) ----
   Each rule the jacket, pants, shirt, tie and shoes can break is one test here. The planner (clothesHard, jacketClean, the shoe choice),
   the score (rateOutfit's hard checks) and the day's notes all read these, so they can't drift apart; the points and the words stay with
   each reader. Callers check that the pieces exist */
const SHOE_LINE=-50;   // shoeScore at or under this: shoes that don't suit the pants or suit (rateOutfit: Shoes, hard)
const shoeSuits=(t,b,s)=>shoeScore(t,b,s)>SHOE_LINE;
const patsHard=P=>P.length>=3||(P.length===2&&P[0].type===P[1].type&&P[0].scale===P[1].scale);   // three bold patterns, or two of one type and scale
/* the shirt the jacket's color, or a dark shirt under a dark jacket (a casual top picked by hand, a navy sweater under a charcoal blazer,
   is no dark dress shirt: the code review, CR-3-09) */
const shirtJacketHard=(t,sh)=>!!(t&&sh&&!darkUnderLight(t,sh)&&(pcol(sh)===pcol(t)||(darkShirt(sh)&&!CASUAL_TOPS.includes(sh.type))));
const tieFlat=(sh,x)=>darkShirt(sh)?tieLum(x)-LUM(sh)<25:LUM(sh)-LUM(x)<25;   // no contrast: on a dark shirt not lighter, else not darker
const tieAsShirt=(sh,x)=>pcol(x)===pcol(sh);
const tieShirtHard=(sh,x)=>tieAsShirt(sh,x)&&tieFlat(sh,x);   // the tie disappears into the shirt
const blackOnBlack=(t,x,occ)=>pcol(t)==='black'&&pcol(x)==='black'&&occ!=='funeral';   // a black tie on a black suit reads as funeral wear
const pantsAsJacket=(t,b)=>pcol(b)===pcol(t);   // odd pants the jacket's color: neither a suit nor a contrast
const oneColor=(t,sh,x)=>pcol(t)===pcol(sh)&&pcol(sh)===pcol(x);   // jacket, shirt and tie all one color
/* the clothes make a real mistake: the rules above that the jacket, trousers, shirt and tie decide, and trousers with no shoes of the day
   that suit them (shoeOk from outfit) */
function clothesHard(t,b,sh,x,sd,day,shoeOk){
  if(patsHard(patsOf([[t,'top'],[sd?null:b,'bot'],[sh,'shirt'],[x,'tie']])))return true;
  if(shirtJacketHard(t,sh))return true;
  if(sh&&x&&tieShirtHard(sh,x))return true;
  if(t&&x&&blackOnBlack(t,x,day&&day.occ))return true;
  if(!sd&&t&&b&&pantsAsJacket(t,b))return true;
  if(t&&sh&&x&&oneColor(t,sh,x))return true;
  if(shoeOk&&(b||t)&&!shoeOk(t,sd?t:b))return true;
  return false}
/* a tie clip's or cufflinks' metal against the watch and the buckle (an enamel clip by the tie: enamelPref); outfit() and the tests'
   fixed plan (history.js fitRule) */
const accMetal=(c,tie,watch,belt)=>metalOf(c)===null?enamelPref(c,tie):(watch?(metalSame(metalOf(c),metalOf(watch))?6:-4):0)+(belt?(metalSame(metalOf(c),metalOf(belt))?3:-2):0);
/* how right a jacket is for an occasion ('formal' or an OCC key): jscore in outfit() and fixedAhead in planSim */
const occTop=(oc,j,season)=>oc==='formal'?formalTop(j):OCC[oc].top(j,season);
/* ---- one day's outfit ----
   outfit() dresses one day in order: the day's pools (dayPools), the jacket (chooseJacket), the waistcoat, the pants, shirt and tie
   (chooseClothes), the shoes, belt and watch (chooseLeather), the rest (chooseAccessories) and what the day should be told (outfitNotes).
   Each step takes the pieces it wears (take), so the order is the planner's: rest counts the earlier steps' pieces as worn. The steps
   share the day through the context dayPools returns (c) */
function outfit(suitDay,n,by,last,rec,day){
const c=dayPools(suitDay,n,by,last,rec,day);suitDay=c.suitDay;day=c.day;
const top=chooseJacket(c);
// vest: part of a three-piece suit; worn per the user's setting unless the day overrides it
const vm=settings.vestMode||'auto',vov=rec&&typeof rec.vest==='boolean'?rec.vest:null;
const vest=!!(suitDay&&hasVest(top)&&(vov!==null?vov:vm==='always'||(vm==='auto'&&(day.formal||day.occ==='wedding'||day.clim.season!=='warm'))));
const {bot,shirt,tie}=chooseClothes(c,top);
const {shoes,belt,watch,B}=chooseLeather(c,top,bot);
const {socks,clip,links,pocket,coat,french,needCoat}=chooseAccessories(c,{top,bot,shirt,tie,shoes,belt,watch,vest});
const {notes,jn}=outfitNotes(c,{top,bot,shirt,tie,shoes,belt,watch,links,coat,french,needCoat,B});
const clim=day.clim,force=c.force;
// no waistcoat without a tie (the owner, 2026-11-13: "No one should ever wear a vest and no tie"): a day planned without a tie (the dress
// code, a casual day) has none, whatever the vest setting or the day's own choice
const o={suitDay,top,bot,shirt,tie,shoes,belt,socks,watch,clip,links,coat,pocket,vest:vest&&!!tie,vestOverride:vov!==null,notes:notes.map(prettyCols),clim,formal:!!day.formal,occasion:day.occ||(day.formal?'formal':null)};Object.defineProperty(o,'jn',{value:jn.map(prettyCols)});   // (not enumerable: no copy of the outfit carries it)
// the suit jacket taken off and other pants picked for the day (force.bot, a pair of pants: Today's ⇄ on the suit's pants, the owner's
// ask 2026-11-16): those pants are worn and the suit is not
const sep=suitDay&&top&&rec&&rec.off&&rec.off.top&&force.bot&&(by('pants').find(i=>i.id===force.bot)||c.hpBotAny)||null;
const r=takeOff(o,rec&&rec.off,c.untake,sep&&c.take(sep));
// those pants worn: the day's notes are made again for what is worn (no jacket, those pants, the same shirt, tie, shoes and belt), so
// none speaks of the suit's trousers (the owner, 2026-11-17: "None of your shoes suit mid gray worsted pants." under multicam pants)
if(sep&&r.offSuit&&r.bot!==top)r.notes=sepNotes(c,r,top,{links,coat,french,needCoat,B});
return r}
/* the notes of a suit day worn with other pants (takeOff's sep): outfitNotes for the pieces worn, as a day without the suit; a packed
   suit's own note goes with it */
function sepNotes(c,r,suit,{links,coat,french,needCoat,B}){
  const {notes}=outfitNotes({...c,suitDay:false,tripOff:c.tripOff.filter(x=>x.id!==suit.id)},{top:null,bot:r.bot,shirt:r.shirt,tie:r.tie,shoes:r.shoes,belt:r.belt,watch:r.watch,links,coat,french,needCoat,B});
  return notes.map(prettyCols)}
/* the day as the steps see it: the dress code and occasion, rest, the day's picks, skips and lock, the wash, and each slot's pool */
function dayPools(suitDay,n,by,last,rec,day){day=day||{formal:false,clim:{season:'mild',rain:false,cold:false},hasLinks:false};
const casual=day.occ==='casual',occ=OCC[day.occ];if(casual)suitDay=false;   // no jacket and no tie: trousers and a shirt
// the dress code (settings.dress): without jackets every workday is planned like that occasion, with a tie if ties are worn; without
// ties none is picked. A formal day, a wedding or a funeral is still dressed in full from what is owned
// a casual top picked by hand for the shirt slot (core.js CASUAL_TOPS): the top layer in place of the shirt, so no tie and no tie clip
const casPick=!!(rec&&rec.force&&rec.force.shirt&&CASUAL_TOPS.includes((items.find(i=>i.id===rec.force.shirt)||{}).type));
const full=day.formal||!!occ,noJ=casual||(!full&&!wearsJacket()),noT=casual||casPick||(!full&&!wearsTie());if(noJ&&!casual){suitDay=false;day={...day,nojkt:true}}
// no blazer in the wardrobe on a blazer day (or no suit on a suit day): wear the other kind rather than no jacket
if(!noJ&&!by(suitDay?'suit':'blazer').length&&by(suitDay?'blazer':'suit').length)suitDay=!suitDay;
// no jacket of either kind in the wardrobe: trousers, a shirt and a tie rather than a suit day with nothing below the waist
if(!noJ&&suitDay&&!by('suit').length&&!by('blazer').length)suitDay=false;
// rest: days since the piece was worn. Each rest bonus rises quickly at first (rb: over 10 days; a shirt over 45, trousers over 60) and
// then keeps creeping up (over()), so a piece that is always one point short of another still comes round instead of never being worn
// a piece never worn yet has full rest (it comes round soon) but creeps only from the day it was added (fresh): it counted as rested
// a year, 63 points over a jacket rested six weeks, so two new brown suits outweighed JKT_SAME and ran back to back (2026-11-16, 22-23 Nov)
const fresh=i=>{if(last[i.id]!=null||!i.added)return null;const a=new Date(i.added);return n-di(new Date(a.getFullYear(),a.getMonth(),a.getDate()))};
// a favorite piece (settings.fav.items) counts its rest a quarter longer, so its rest target is a fifth shorter (FAV_REST_K); since stays
// the real days, for the wash and the shoes worn yesterday
const fv=favItemSet(),fk=i=>fv&&fv.has(i.id)?FAV_REST_K:1;
const since=i=>n-(last[i.id]??-1e5),rest=i=>Math.min(since(i)*fk(i),60),over=(i,from)=>Math.min(Math.max(0,(fresh(i)??since(i))*fk(i)-from),300);
const rb=i=>Math.min(rest(i),10)*.4+over(i,10)*.01;
// a day's record can pin pieces (force) or rule them out (skip) after the user swaps something; a day the app has locked (rec.lock:
// the pieces it showed for one of the coming days) keeps them, so a change on one day doesn't reshuffle the days already shown.
// The lock is dropped as a whole when one of its pieces is gone (deleted, taken out of rotation) or the forecast has turned against
// it: suede shoes on a rainy day, a cold-weather piece on a warm day.
// (day.fav: a favorite look due on a day not yet locked or picked, planSim's favDue: its jacket, shirt and tie pinned like a pick)
const force=day.fav?{...(rec&&rec.force||{}),...day.fav}:rec&&rec.force||{},skip=rec&&rec.skip||{};
// a piece the planner never plans (core.js isHandPick: a casual top, a cardigan or chore jacket, cargo pants) is worn only when the day's
// pick names it for its own slot and it is in rotation that day; a casual jacket makes the day a blazer day (odd pants)
const hp=s=>{const id=force[s],x=id&&items.find(i=>i.id===id);return x&&handPickSlot(x)===s&&inRotation(x,n)?x:null};
const hpTop=noJ?null:hp('top'),hpShirt=hp('shirt'),hpBotAny=hp('bot'),hpShoes=hp('shoes');if(hpTop)suitDay=false;const hpBot=suitDay?null:hpBotAny;
const LT={top:suitDay?'suit':'blazer',bot:suitDay?null:'pants',shirt:'shirt',tie:'tie',shoes:'shoes',belt:'belt',socks:'socks',watch:'watch',clip:'tieclip',links:'cufflinks',pocket:'pocketsquare'};
let lock=rec&&rec.lock||null;
// the washing cycle (settings.laundryDays, default 1): a shirt worn within that many days is in the wash, so it is left out of the
// day's shirts unless there is no other; a lock holding such a shirt (it was worn on a day before, by hand) lets go. Not on a
// formal day, a wedding or a funeral: the occasion's shirt outweighs the washing, as its suit outweighs rotation
// every shirt in the wash: the one washed longest ago, never yesterday's for its colour (the audit: three shirts, laundry 3 days, the
// white shirt two workdays running)
const LD=day.formal||(day.occ&&!casual)?0:Math.max(0,+(settings.laundryDays??1)||0),washing=i=>LD>0&&since(i)<=LD,washed=l=>{const f=l.filter(i=>!washing(i));if(f.length)return f;
  let m=-Infinity;for(const i of l)m=Math.max(m,since(i));return l.filter(i=>since(i)===m)};
/* a kept trip (pack.js "Keep these outfits", rec.trip: "These outfits stay as shown", its suitcase may be packed) keeps its lock (the code
   review, CR-3-01): a piece gone lets go of its own slot only (shoes take their belt and socks with them), and the forecast or the wash
   changes nothing; the day's notes say so (tripOff) */
const trip=!!(rec&&rec.trip),tripOff=[];
if(lock)for(const sl in LT){const id=lock[sl],t=LT[sl];if(!id||!t||force[sl]||(skip[sl]||[]).includes(id))continue;const x=by(t).find(i=>i.id===id);
  const wet=!!x&&sl==='shoes'&&day.clim.rain&&finish(x.leather)==='suede',season=!!x&&seasonFit(x,day.clim.season)<=-15;
  if(!x||wet||season||(sl==='shirt'&&washing(x)&&by(t).some(i=>!washing(i)))){if(!trip){lock=null;break}
    if(!x){lock={...lock};for(const s of sl==='shoes'?['shoes','belt','socks']:[sl])delete lock[s]}else if(season)tripOff.push(x)}}
const pool=(type,slot)=>{const h=slot==='top'?hpTop:slot==='shirt'?hpShirt:slot==='bot'?hpBot:null;if(h)return [h];
  const all=by(type),f=force[slot];if(f){const x=all.find(i=>i.id===f);if(x)return [x]}
  const s=skip[slot]||[],l=lock&&lock[slot];if(l&&!s.includes(l)){const x=all.find(i=>i.id===l);if(x)return [x]}
  const left=all.filter(i=>!s.includes(i.id)),any=left.length?left:all;if(slot==='bot'){const ok=any.filter(botFits);return ok.length?ok:any}return slot==='shirt'?washed(any):any};
// the trousers a day allows: dress trousers only on a formal day, a wedding or a funeral; jeans with a blazer only when the dress code
// says so (settings.dress.jeans); chinos with a blazer, and anything on a day without a jacket
const botFits=i=>{const k=trouserKind(i);if(full&&!casual)return k==='dress';if(!suitDay&&!noJ&&k==='jeans')return !!(settings.dress&&settings.dress.jeans);return true};
const was={},take=b=>{if(!b)return null;const c={...b,rest:Math.min(since(b),60)};if(!(b.id in was))was[b.id]=last[b.id];last[b.id]=n;return c};
// a piece taken off for the day (rec.off) was not worn: its rest goes back to what it was
const untake=b=>{if(!b||!(b.id in was))return;if(was[b.id]===undefined)delete last[b.id];else last[b.id]=was[b.id]};
const argBest=(arr,sc)=>{let b=null,bs=-1e9;for(const i of arr){const s=sc(i)+rb(i)+(fv&&fv.has(i.id)?FAV_TIE:0);if(s>bs){bs=s;b=i}}return b},best=(arr,sc)=>take(argBest(arr,sc));
// the day's shoes, and whether any of them suit the jacket and pants (not patent: a last resort)
const S=pool('shoes','shoes'),shoeOk=(t,b)=>!S.length||S.some(s=>finish(s.leather)!=='patent'&&shoeSuits(t,b,s));
return {day,suitDay,n,by,last,rec,casual,occ,full,noJ,noT,force,lock,trip,tripOff,hpTop,hpBotAny,hpShoes,since,rest,over,rb,pool,take,untake,argBest,best,S,shoeOk,fv}}
/* the jacket (null on a day without one) */
function chooseJacket(c){const {day,suitDay,by,occ,noJ,noT,since,rest,over,pool,argBest,best,shoeOk}=c;
// suits rotate (least recently worn first); season and formality can override a few days of rest
// a suit whose only shoes were worn yesterday (a black suit the day after black shoes) waits a day when another suit can go first
const shoeBound=i=>{if(i.type!=='suit'||day.formal||occ)return false;const ok=by('shoes').filter(s=>finish(s.leather)!=='patent'&&shoeSuits(i,i,s));return ok.length>0&&ok.every(s=>since(s)<=1)};
// a cold-weather suit on a warm day (or a summer one on a cold day) only when there is no other
const offSeason=i=>seasonFit(i,day.clim.season)<=-15?200:0;
const noShoes=i=>{if(i.type==='suit')return !shoeOk(i,i);const P=pool('pants','bot');return P.length>0&&!P.some(pt=>shoeOk(i,pt))};
const againJ=i=>day.prev&&day.prev[0]&&day.prev[0].jid===i.id?JKT_AGAIN:0;
const tpl=noJ?[]:pool(suitDay?'suit':'blazer','top'),tgw=topGw(tpl);
// a real mistake in the clothes (clothesHard) is not planned while another jacket avoids it (H7, the re-audit: a pinstripe suit with
// the only clean shirt a stripe and the only tie a stripe, the plain suit free): the jacket rotation would choose takes its turn
// only when some trousers, shirt and tie of the day make a clean outfit with it (jacketClean, stopping at the first one found)
const Tday=noT?[null]:pool('tie','tie'),Shday=pool('shirt','shirt');
/* speed (the code review, CR-3-06: a wardrobe with no clean outfit tried every pants x shirt x tie, 6.5x slower): the parts of clothesHard
   that the jacket and one other piece decide alone are checked once, outside the loop (the shirt against the jacket; the pants' color and
   their shoes), so the plans are identical */
const jacketClean=j=>{const P=suitDay?[j]:pool('pants','bot'),Sh=(Shday.length?Shday:[null]).filter(sh=>!shirtJacketHard(j,sh));if(!Sh.length)return false;
  for(const b of P.length?P:[null]){if((b||j)&&!shoeOk(j,suitDay?j:b))continue;if(!suitDay&&b&&pantsAsJacket(j,b))continue;
    for(const sh of Sh)for(const x of Tday.length?Tday:[null])if(!clothesHard(j,b,sh,x,suitDay,day,shoeOk))return true}return false};
const jscore=i=>-(noShoes(i)?NO_SHOES:0)-againJ(i)+Math.min(rest(i),14)*3+Math.max(0,rest(i)-14)+over(i,60)*.2-offSeason(i)-(shoeBound(i)?10:0)+seasonFit(i,day.clim.season)*2+(day.formal?occTop('formal',i)*2:0)+(occ?occTop(day.occ,i,day.clim.season)*3:0)-colourRepeat(i,day.prev&&day.prev.map(p=>p&&{g:p.jg,c:p.jc}),day.ahead&&day.ahead.next,tgw)-(day.ahead&&day.ahead.soft&&!day.ahead.next?Math.round(colourRepeat(i,null,day.ahead.soft,tgw)/2):0)-(day.ahead&&day.ahead.ids.includes(i.id)?100:0);
let tcands=tpl;if(tpl.length>1&&!jacketClean(argBest(tpl,jscore))){const ok=tpl.filter(jacketClean);if(ok.length)tcands=ok}
return noJ?null:best(tcands,jscore)}
/* the pants (the suit on a suit day), shirt and tie, scored together as one outfit for this jacket */
function chooseClothes(c,top){const {day,suitDay,n,occ,noT,rest,over,rb,pool,take,shoeOk,fv}=c;
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
// comboRepeat is capped at COMBO_CAP for a tie that isn't the workday before's (CR-3-03): with two suits and two ties it fell on the other tie
// and outweighed TIE_NEXT, so the day before's tie came back on 41 of 103 workdays (A A B B)
const prevTie=day.prev&&day.prev[0]&&day.prev[0].tid,comboCost=(sh,x)=>{const v=comboRepeat(sh,x,hk);return x&&x.id!==prevTie?Math.min(v,COMBO_CAP):v};
const P1=pt=>({pt,no:pt?ptNo(pt):0,rb:pt?rb(pt):0,pr:pt?ptRest(pt):0});
const S1=sh=>({sh,rs:sh?shRest(sh):0,rep:shirtRepeat(sh,day.prev),ah:day.ahead?aheadShirt(sh,fx,n):0});
const X1=x=>({x,r10:x?Math.min(rest(x),10)*.4:0,r30:x?Math.min(rest(x),30)*.25+Math.min(TIE_CREEP_MAX,over(x,30)*TIE_CREEP):0,rep:tieRepeat(x,day.prev,day.prev3),ah:day.ahead?aheadTie(x,fx):0});
const PP=(Ps.length?Ps:[null]).map(P1),SS=(Ss.length?Ss:[null]).map(S1),XX=(Ts.length?Ts:[null]).map(X1);
for(const P of PP)for(const S of SS)for(const X of XX){const {pt}=P,{sh}=S,{x}=X;
  const q=clothesScore(top,suitDay?top:pt,sh,x,suitDay,day)-P.no;   // trousers no shoes of the day suit
  cands.push({q,pt,sh,x,P,S,X});
}
const rOf=({pt,sh,x,P,S,X})=>1.5*(P.rb+X.r10)+P.pr+X.r30+S.rs-S.rep-X.rep-(day.ahead?S.ah+X.ah:0)-lookRepeat(top,sh,x,day.prev)-comboCost(sh,x)-pairRepeat(sh,x,day.pairs);
/* the look (2026-11-17, the owner: a planned outfit ranked 457th of 507 on the score card, "picked because the pink tie had rested 25 days"):
   dialLook (Harmony + Texture + Occasion, the rank's own value: planLook) counts among the outfits inside the window that repeat nothing
   (realRep), in two parts, beyond LOOK_FREE points:
   - each piece's own best (LOOK_PAIR per point): an outfit costs what it falls short of the best outfit any one of its pieces makes, so
     the pieces rest brings round are worn the best way they can be (the pink tie with the shirt it suits), and no piece is held back for
     looking plainer than another: with the whole look's shortfall alone, a white woven shirt took 12 of 40 workdays (tests/rotation-pause)
   - the best rested outfit (LOOK_K per point): the best look among the outfits whose tie, shirt and pants have all rested LOOK_RESTED of
     their type's turn (pieces in rotation x 7 / workdays a week: 8 shirts at five a week, 11 days), so the piece just worn doesn't set
     the bar and come straight back; the cost fades for an outfit with a piece rested over its turn, to nothing at two turns (due), so
     every piece still comes round
   rest and the softer repeats then choose as before. When every outfit in the window repeats something, and on a formal day, a wedding or a
   funeral (the occasion's own rules: a navy tie was taken to a wedding for its contrast), the window is chosen as before, without the
   look; a wedding's window is FORMAL_QWIN now, as a formal day's (a well-rested navy tie still won it within QWIN) */
const realRep=(()=>{const w=Ss.length>3?2:1,sids=[...(day.prev||[]).slice(0,w),...(day.ahead&&day.ahead.fx||[]).filter(f=>f.w<w)].map(p=>p&&p.sid).filter(Boolean);
  // the same tie within three workdays or its color the workday before (tieRepeat 15 and more), the shirt of the workday before or after
  // (the two before and after with more than three shirts), a tie or shirt fixed on the next workdays, the same tie with that shirt color
  // within PAIR_DAYS, the whole look of the last two workdays, this jacket's last tie with that shirt color (comboRepeat)
  return ({sh,x,S,X})=>X.rep>=15||(!!sh&&sids.includes(sh.id))||(!!day.ahead&&(X.ah>=TIE_GAP||S.ah>=NEXT_SHIRT))||pairRepeat(sh,x,day.pairs)>0||lookRepeat(top,sh,x,day.prev)>=20||comboRepeat(sh,x,hk)>=15})();
const wk=Math.max(1,settings.workdays.length),bzWk=Math.max(1,settings.blazerDays.filter(d=>settings.workdays.includes(d)).length);
const turn={x:Math.max(7,c.by('tie').length*7/wk),sh:Math.max(7,c.by('shirt').length*7/wk),pt:Math.max(7,c.by('pants').length*7/(c.by('suit').length&&!c.noJ?bzWk:wk))};
const fade=(i,t)=>i?1-Math.min(1,Math.max(0,c.over(i,0)-t)/t):1,due=({pt,sh,x})=>Math.min(fade(x,turn.x),fade(sh,turn.sh),suitDay?1:fade(pt,turn.pt));
const look=planLook(day,suitDay,c.by('shoes'),c.by('belt'),c.by('watch')),lookC=k=>k.L??(k.L=look(top,suitDay?top:k.pt,k.sh,k.x));
const rested=({pt,sh,x})=>[[x,turn.x],[sh,turn.sh],[suitDay?null:pt,turn.pt]].every(([i,t])=>!i||c.over(i,0)>=LOOK_RESTED*t);
const lookCost=win=>{let lm=-Infinity;const best=new Map(),up=(p,v)=>{if(p&&!(best.get(p)>=v))best.set(p,v)};
  let lr=-Infinity;for(const c of win){lm=Math.max(lm,lookC(c));up(c.sh,c.L);up(c.x,c.L);up(c.pt,c.L);if(rested(c))lr=Math.max(lr,c.L)}if(lr>-Infinity)lm=lr;
  return c=>{let own=Infinity;for(const p of [c.sh,c.x,c.pt])if(p)own=Math.min(own,best.get(p));if(own===Infinity)own=c.L;
    return LOOK_PAIR*Math.max(0,own-LOOK_FREE-c.L)+LOOK_K*Math.max(0,lm-LOOK_FREE-c.L)*due(c)}};
const choose=cs=>{let qmax=-Infinity;for(const c of cs)if(c.q>qmax)qmax=c.q;
  let win=cs.filter(c=>c.q>=qmax-(day.formal||day.occ==='funeral'||day.occ==='wedding'?FORMAL_QWIN:QWIN));
  const fresh=occ||day.formal?[]:win.filter(c=>!realRep(c));   // (a formal day, a wedding or a funeral: its own rules choose, as before)
  if(fresh.length){win=fresh;const lc=lookCost(win);for(const c of win)c.r=rOf(c)-lc(c)}else for(const c of win)c.r=rOf(c);
  if(fv)for(const k of win)for(const i of [k.pt,k.sh,k.x])if(i&&fv.has(i.id))k.r+=FAV_TIE;   // (a favorite piece wins a tie)
  return win.sort((a,b)=>(b.q+b.r)-(a.q+a.r))[0]};
const hardC=c=>clothesHard(top,suitDay?top:c.pt,c.sh,c.x,suitDay,day,shoeOk);
let pick1=choose(cands);
// the best outfit for this jacket is a real mistake: the best clean one, if there is any, however far down (H7)
if(hardC(pick1)){const clean=cands.filter(c=>!hardC(c));if(clean.length)pick1=choose(clean)}
const bot=suitDay?top:take(pick1.pt),shirt=take(pick1.sh),tie=take(pick1.x);
return {bot,shirt,tie}}
/* shoes, belt and watch are chosen together so the belt always matches the shoes and the metals agree (B: the day's belts) */
// (combat boots picked by hand, c.hpShoes: worn whatever the clothes; the clothes were chosen against the planner's own shoes, c.S)
function chooseLeather(c,top,bot){const {day,suitDay,rest,rb,pool,take}=c,S=c.hpShoes?[c.hpShoes]:c.S;
const B=pool('belt','belt'),W=pool('watch','watch');let pick=null;
for(const s of S.length?S:[null])for(const b of [...B,null])for(const w of W.length?W:[null]){
  let t=0;
  // shoes that don't suit (a real mistake) cost NO_SHOES more, so they lose to a pair with no matching belt (30, not a mistake): the
  // re-audit's blazer day, khaki chinos and black calf shoes at 69 while the oxblood loafers suited them
  if(s){const ss=shoeScore(top,bot,s);t+=ss-(ss<=SHOE_LINE?NO_SHOES:0)+shoeFormality(s,suitDay)+rb(s)-(rest(s)<=1&&!day.formal&&day.occ!=='funeral'?SHOE_AGAIN:0);   // leather shoes want a day to dry: not yesterday's pair when another suits
    if(day.clim.rain&&finish(s.leather)==='suede')t-=RAIN_SUEDE;     // suede and rain don't mix: never, while any other pair is left
    if(day.formal||day.occ==='funeral'){const g=leatherGroup(planCol(s)),f=finish(s.leather);t+=(f==='suede'||f==='grain')?-20:g==='black'?(day.occ==='funeral'?20:8):g==='burgundy'?3:-4}
    if(day.occ==='wedding'&&finish(s.leather)==='suede')t-=15}
  if(b){if(!s)continue;const f=beltFit(s,b);if(f===null)continue;t+=12+f+rb(b)}else if(B.length&&s)t-=30; // no matching belt: allowed, but last resort
  if(w)t+=watchFit(w,s,b)*SHOE_WATCH+rb(w);
  if(!pick||t>pick.t)pick={t,s,b,w};
}
const shoes=take(pick&&pick.s),belt=take(pick&&pick.b),watch=take(pick&&pick.w);
return {shoes,belt,watch,B}}
/* socks, tie clip, cufflinks, pocket square and coat */
function chooseAccessories(c,{top,bot,shirt,tie,shoes,belt,watch,vest}){const {day,force,lock,hpTop,rest,pool,best}=c;
const sctx={top,bot,shirt,tie,formal:!!day.formal,occasion:day.occ||(day.formal?'formal':null),season:day.clim&&day.clim.season};   // (a patterned sock's outfit: sockPatScore)
const socks=best(pool('socks','socks'),s=>sockScore(bot,shoes,s,sockEcho(shirt,tie),sctx));
const metalPref=c=>accMetal(c,tie,watch,belt);
const clipPool=pool('tieclip','clip').filter(c=>force.clip===c.id||clipAllowed(c,watch,belt));
const clip=vest||!tie?null:best(clipPool,metalPref);   // the vest holds the tie: no clip
// cufflinks only (and always) with French cuffs
const french=shirt&&shirt.cuff==='french',links=french?best(pool('cufflinks','links'),metalPref):null;
// a pocket square only with a jacket (pocketScore): one whose score is at least PS_MIN, or the one picked or locked for the day
const PQ=top&&!hpTop?pool('pocketsquare','pocket'):[],   // (none with a cardigan or chore jacket picked by hand, 2026-11-16)
psPinned=p=>force.pocket===p.id||!!(lock&&lock.pocket===p.id);
const psOk=PQ.filter(p=>psPinned(p)||pocketScore(p,top,shirt,tie,day)>=PS_MIN);
const pocket=psOk.length?best(psOk,p=>pocketScore(p,top,shirt,tie,day)-(rest(p)<=1?PS_AGAIN:0)):null;
// coat when the forecast (or the season) calls for one: raincoat for rain unless it's very cold, otherwise an overcoat
const clim=day.clim,needCoat=clim.cold||clim.rain,prefer=clim.rain&&!clim.veryCold?'raincoat':'overcoat';
const coat=needCoat?best([...pool('overcoat','coat'),...pool('raincoat','coat')],c=>(c.type===prefer?10:0)+seasonFit(c,clim.season)+(['navy','charcoal','tan','grey','black'].includes(pcol(c))?3:0)+(shoes&&pcol(c)==='black'&&leatherGroup(planCol(shoes))!=='black'?-4:0)):null;
return {socks,clip,links,pocket,coat,french,needCoat}}
/* say so when the wardrobe can't make a correct combination, instead of silently mismatching: the day's notes, and jn, those about the
   jacket (dropped when it is taken off: takeOff; the code review CR-3-07: a word filter also took "None of your shoes suit brown pants.") */
function outfitNotes(c,{top,bot,shirt,tie,shoes,belt,watch,links,coat,french,needCoat,B}){const {day,suitDay,occ,noJ,force,lock,trip,tripOff}=c,clim=day.clim;
const notes=[],jn=[],jnote=t=>{notes.push(t);jn.push(t)};
// clothing: only reached when the wardrobe had no compliant combination for this jacket
if(shirt&&tie&&tieFlat(shirt,tie))notes.push(darkShirt(shirt)?`The ${nm(tie)} isn't lighter than the ${nm(shirt)}; on a dark shirt a lighter tie reads better.`
  :`The ${nm(tie)} isn't darker than the ${nm(shirt)}; no darker tie suited this outfit. A darker tie would look sharper.`);
if(top&&shirt&&!darkUnderLight(top,shirt)&&LUM(shirt)<LUM(top)+20)jnote(`The ${nm(shirt)} is darker than the jacket. A lighter shirt would look more professional.`);
if(patsOf([[top,'top'],[suitDay?null:bot,'bot'],[shirt,'shirt'],[tie,'tie']]).length>=3)notes.push('Three bold patterns today; there was no quieter combination. A solid shirt or tie would calm it down.');
if(shoes&&bot&&!shoeSuits(top,bot,shoes)){if(shoeSuits(null,bot,shoes))jnote(`None of your shoes suit the ${colName(spokenCol(top))} ${top.type==='suit'?'suit':'jacket'}.`);else notes.push(`None of your shoes suit ${colName(spokenCol(bot))} pants.`)}
if(shoes&&finish(shoes.leather)==='patent')notes.push('Only patent shoes were available. Patent is for black tie.');
if(shoes&&B.length&&!belt)notes.push(`None of your belts match the ${desc(shoes)} shoes. Add a ${leatherGroup(planCol(shoes))} ${finish(shoes.leather)==='suede'?'suede':'smooth leather'} belt.`);
if(watch&&belt&&!metalSame(metalOf(watch),metalOf(belt)))notes.push(`The ${metalWord(metalOf(watch))} watch and the ${metalWord(metalOf(belt))} belt buckle are different metals.`);   // ("other" is gunmetal: core.js metalWord; "The watch (silver) and belt buckle (other)" read badly, the owner 2026-11-17)
if(french&&!links)notes.push('French-cuff shirt, but no cufflinks in your wardrobe. Add a pair.');
// suede in the rain, said from the real reason (the code review, CR-3-02): picked by hand, packed, or the only shoes left (RAIN_SUEDE keeps
// it off otherwise)
if(clim.rain&&shoes&&finish(shoes.leather)==='suede')
  notes.push(force.shoes===shoes.id?`Rain is forecast and the ${nm(shoes)} picked for the day are suede. Smooth leather would hold up better.`
    :trip&&lock&&lock.shoes===shoes.id?`Rain is forecast and the packed ${nm(shoes)} are suede. Smooth leather would hold up better.`
    :'Rain is forecast and suede shoes are the only ones you have for today. A smooth leather pair would hold up better in the rain.');
for(const x of tripOff)(x===top?jnote:t=>notes.push(t))(`The packed ${nm(x)} is a ${itemSeason(x)}-weather piece on a ${clim.season} day.`);
if(needCoat&&!coat)notes.push(clim.rain?'Rain is forecast and there is no raincoat in your wardrobe.':'It will be cold and there is no overcoat in your wardrobe.');
if(day.occ==='funeral'&&tie&&pcol(tie)!=='black')notes.push(patInfo(tie,'tie')?'No black tie in your wardrobe for a funeral: the most sober one you have was chosen. A plain black tie is right for a funeral.':'No black tie in your wardrobe for a funeral: the darkest, plainest one was chosen.');
if(day.occ==='funeral'&&top&&occ.top(top)<18)jnote(['black','charcoal','darknavy','navy','darkgrey','slate'].includes(planCol(top))?'No plain black, charcoal or navy suit for a funeral: the plainest dark one was chosen.':'No black, charcoal or navy suit for a funeral: the darkest one was chosen.');   // (a charcoal glen check is dark, only not plain: W2-17-09)
if(day.occ==='wedding'&&top&&pcol(top)==='black')jnote('Only a black suit was available: black is usually avoided at a daytime wedding.');
if(noJ&&!bot)notes.push('No separate pants in your wardrobe for a day without a jacket. Add a pair of pants.');
if(top&&seasonFit(top,clim.season)<-10&&!tripOff.includes(top))jnote(`The ${nm(top)} is a ${itemSeason(top)}-weather piece on a ${clim.season} day; no better suit was available.`);
return {notes,jn}}
/* Pieces taken off for the day (the owner's ask, 2026-11-13: Today's "Take off" on the jacket or the tie; rec.off = {top, tie}). The
   outfit is planned as usual (the day's other pieces are pinned by force when it is set) and then the piece comes off:
   - the jacket: on a suit day the suit's trousers stay (o.bot is the suit, o.suitDay false, o.suitBot true) and the waistcoat goes with
     the jacket (no picture has a waistcoat without its jacket); a blazer is not counted as worn
   - the tie: the tie clip and the waistcoat go with it (no waistcoat without a tie, the owner's rule); neither is counted as worn
     unless other pants were picked for the day (sep, already counted as worn): then those are worn, the suit is not (untake), and
     o.suitBot stays false; o.offSuit is the suit either way, so Today's pants picker can offer its own pants back
   o.off says what came off (o.offKind 'suit' or 'blazer'), so Today can put it back; the score asks for neither (needsJacket/needsTie) */
/* (2026-11-16) the pocket square comes off with the jacket, and alone (rec.off.pocket: Today's − on it); either way it is not counted as
   worn; o.off.pocket is set only when it was taken off by itself */
function takeOff(o,off,untake,sep){if(!off||!(off.top||off.tie||off.pocket))return o;const r={...o,off:{top:!!(off.top&&o.top),tie:!!(off.tie&&o.tie),...(off.pocket&&o.pocket&&!(off.top&&o.top)?{pocket:true}:{})}};
  if(o.pocket&&(r.off.top||r.off.pocket)){if(untake)untake(o.pocket);r.pocket=null}
  if(r.off.top){r.offKind=o.suitDay?'suit':'blazer';
    if(o.suitDay){r.offSuit=o.top;r.suitDay=false;if(sep){r.bot=sep;if(untake)untake(o.top)}else{r.bot=o.top;r.suitBot=true}}else if(untake)untake(o.top);r.top=null;r.vest=false;
    const jn=o.jn||[];r.notes=r.notes.filter(t=>!jn.includes(t))}
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
/* a piece's color in words: its own color (an owner's color by its own name), never the color it behaves like (planCol): a "Dusty pink"
   suit based on tan was a "tan jacket" in the reasons (W2-17-04). prettyCols turns the key into its name */
const spokenCol=i=>primaryCol(i);
/* the Metals reason names only the pieces worn with a metal: "watch, buckle and tie clip" named a clip on vest days (W2-17-10) */
const metalsWhy=(watch,belt,clip)=>{const n=[watch&&metalOf(watch)&&'watch',belt&&metalOf(belt)&&'buckle',clip&&metalOf(clip)&&'tie clip'].filter(Boolean);
  return (n.length>2?n.slice(0,-1).join(', ')+' and '+n[n.length-1]:n.join(' and '))+' metals differ'};
const QUIET_SHIRTS=['white','lightblue','ivory','pink','cream','lightgrey','paleyellow','lavender','periwinkle','mint','beige','blue','steelblue','midgrey'];
function rateOutfit(o){
  const nice=prettyCols;
  const C=[],add=(label,pts,max,why,hard)=>{const p=Math.max(0,Math.min(max,pts));C.push({label,pts:p,max,why:p<max?nice(why):'',hard:!!hard&&p<max})};
  const {top,shirt,tie,shoes,belt,socks,watch,clip}=o,bot=o.suitDay?null:o.bot,trousers=o.bot||top,casual=o.occasion==='casual';
  // a piece is missing: not a styling fault, but not an outfit either
  // (o.gone: a past day's piece deleted from the wardrobe since; it was worn, so it isn't missing)
  {const miss=[],G=o.gone||{};if(!shirt&&!G.shirt)miss.push('shirt');if(!trousers&&!G.bot&&!(o.suitDay&&G.top))miss.push('pants');if(!top&&!G.top&&needsJacket(o))miss.push('jacket');if(!tie&&!G.tie&&needsTie(o))miss.push('tie');if(!shoes&&!G.shoes)miss.push('shoes');
    if(miss.length)add('Complete outfit',0,10,'no '+miss.join(', no ')+' for this day',true)}
  // a casual top picked by hand (a T-shirt, a sweater) is judged only by "the same color as the jacket": the dress shirt's dark-shirt and
  // strong-color rules made a navy sweater under a charcoal blazer a real mistake (the code review, CR-3-09)
  if(shirt){const raw=planCol(shirt),cas=CASUAL_TOPS.includes(shirt.type),hard=shirtJacketHard(top,shirt);let v=10,why='';
    if(darkUnderLight(top,shirt)){}
    else if(top&&pcol(shirt)===pcol(top)){v=0;why=cas?'top is the same color as the jacket':'shirt is the same color as the jacket'}
    else if(cas){}
    else if(top&&darkShirt(shirt)){v=2;why='a dark shirt wants a clearly lighter jacket'}
    else if(top&&LUM(shirt)<LUM(top)+20){v=5;why='shirt is darker than the jacket'}
    else if(!QUIET_SHIRTS.includes(raw)&&!darkShirt(shirt)){v=5;why=`a ${spokenCol(shirt)} shirt is a strong color for business`}
    if(shirt.cuff==='french'&&!o.links){v-=5;why=(why?why+'; ':'')+'French cuffs without cufflinks'}
    add('Shirt',v,10,why,hard)}
  if(shirt&&tie){const raw=planCol(shirt),flat=tieFlat(shirt,tie),same=tieAsShirt(shirt,tie);let v=0,why=[];
    if(!flat)v+=8;else why.push(darkShirt(shirt)?'tie is not lighter than the dark shirt':'tie is not darker than the shirt');
    if(!same)v+=2;else why.push('tie and shirt are the same color');
    const ts=darkShirt(shirt)?null:TIE_ON_SHIRT[raw]||TIE_ON_SHIRT[pcol(shirt)];
    if(raw==='pink'&&['red','pink'].includes(pcol(tie))){why.push(`a ${spokenCol(tie)} tie clashes with a ${spokenCol(shirt)} shirt`)}
    else if(raw==='white'||!ts||ts.includes(pcol(tie)))v+=5;else{v+=1;why.push(`${spokenCol(tie)} is an unusual tie color on a ${spokenCol(shirt)} shirt`)}
    add('Tie and shirt',v,15,why.join('; '),flat&&same)}   // the same colour and no contrast: the tie disappears (tieShirtHard)
  if(tie&&top){const tc=pcol(top),xc=pcol(tie),hard=blackOnBlack(top,tie,o.occasion);let v,why='';
    if(o.occasion==='funeral'&&xc==='black')v=10;   // a black tie is right at a funeral, whatever the suit
    else if(xc===tc){if(hard){v=0;why='black tie on a black suit reads as funeral wear'}else if(pw(tie)>0||LUM(tie)<LUM(top)-15)v=10;else{v=7;why='tonal tie blends into the jacket'}}
    else if(!HARM[tc]||HARM[tc].includes(xc))v=10;else{v=5;why=`${spokenCol(tie)} is not a classic partner for a ${spokenCol(top)} jacket`}
    add('Tie and jacket',v,10,why,hard)}
  {const P=patsOf([[top,'top'],[bot,'bot'],[shirt,'shirt'],[tie,'tie']]),hard=patsHard(P);let v=10,why='';
    if(P.length>=3){v=0;why='three bold patterns compete'}
    else if(P.length===2&&P[0].type===P[1].type){if(P[0].scale!==P[1].scale){v=8;why='two patterns of the same type (different scale)'}else{v=3;why='two patterns of the same type and scale'}}
    // a bold patterned sock (2026-11-17) is one more pattern: a third one, or one repeating a pattern of the outfit, takes points, but is
    // never a real mistake (socks show only when seated; the planner keeps them apart: sockPatScore)
    if(v===10&&socks&&sockBold(socks)&&trousers){const sp=sockPatScore(socks,{top,bot:o.bot,shirt,tie});if(sp.clash){v=P.length>=2?4:5;why=sp.why[0]}}
    if(top||shirt||tie)add('Patterns',v,10,why,hard)}
  if(bot&&top){const list=BLAZER_TROUSERS[pcol(top)],hard=pantsAsJacket(top,bot);let v=10,why='';const k=list?list.indexOf(pcol(bot)):-1;
    if(hard){v=0;why='jacket and pants are the same color: neither a suit nor a contrast'}
    else{if(k<0){v=4;why=`${spokenCol(bot)} pants are not a classic match for a ${spokenCol(top)} jacket`}
      if(Math.abs(LUM(top)-LUM(bot))<35){v-=4;why=(why?why+'; ':'')+'jacket and pants lack contrast'}}
    add('Pants',v,10,why,hard)}
  if(shoes&&trousers){const s=shoeScore(top,trousers,shoes),k=(SH[pcol(trousers)]||['black','brown']).indexOf(pcol(shoes));
    // the reason: a black suit's clash first (its own pants would say "brown shoes don't suit black pants"), then the pants', then a warm
    // jacket's clash, then the style's
    add('Shoes',s<=SHOE_LINE?0:10,10,shoeStyle(shoes)==='combat'?'combat boots go with camouflage pants':shoeClash(top,shoes)&&(pcol(top)==='black'||k>=0)?pcol(top)==='black'?'a black suit needs black shoes':`black shoes don't suit a ${spokenCol(top)} jacket`:k<0?`${spokenCol(shoes)} shoes don't suit ${spokenCol(trousers)} pants`:`${shoeStyle(shoes)}s don't go with ${shoeCtx(trousers)==='suit'?'a suit':'dress pants'}`,true)}
  // (no belt you own matches the shoes: the check is left out, as with no belt at all; adding a belt that suits none of the shoes took 15
  // points off every day, W2-14-08. The planner's note still says which belt would match)
  if(shoes&&items.some(i=>i.type==='belt'&&inRotation(i)&&(beltFit(shoes,i)!==null||(belt&&belt.id===i.id)))){const f=belt?beltFit(shoes,belt):null;
    add('Belt',!belt?0:f===null?0:f>0?10:8,10,!belt?'no belt matches the shoes':f===null?'belt does not match the shoes':'belt finish differs slightly from the shoes',!!belt&&f===null)}
  if(shoes){const f=finish(shoes.leather);let v=5,why='';
    if(f==='patent'){v=0;why='patent shoes are for black tie'}else if(f==='suede'&&o.suitDay){v=0;why='suede is casual for a suit'}else if(f==='grain'&&o.suitDay){v=3;why='grain leather is casual for a suit'}
    add('Leather formality',v,5,why,f==='patent')}   // (suede with a suit 0, was 2: formality outweighs a matching strap and buckle, the owner's decision 2026-11-16)
  {const ms=[watch,belt,clip].filter(Boolean).map(metalOf).filter(Boolean);
    if(ms.length>=2)add('Metals',ms.every(a=>ms.every(b=>metalSame(a,b)))?5:2,5,metalsWhy(watch,belt,clip));}
  // the pocket square (2026-11-16): only when one is worn with the jacket (pocketScore's rules)
  if(o.pocket&&top){const p=o.pocket,e=psEcho(p,top,shirt,tie);let v=5,why='';
    if(psSameTie(p,tie)){v=1;why='the pocket square repeats the tie: it should complement it, not match it'}
    else if(o.occasion==='funeral'&&!psWhite(p)){v=2;why='a plain white pocket square, or none, is right at a funeral'}
    else if(!e.hit&&!psWhite(p)){v=3;why='the pocket square picks up no color of the tie, shirt or jacket'}
    add('Pocket square',v,5,why)}
  if(watch&&shoes&&watchOpts(watch).band==='leather'){const g=leatherGroup(planCol(watch)),sg=leatherGroup(planCol(shoes));
    add('Watch strap',g===sg?5:o.suitDay?4:2,5,`a ${spokenCol(watch)} leather strap with ${spokenCol(shoes)} shoes`)}
  if(socks&&trousers){const v0=sockScore(trousers,shoes,socks,sockEcho(shirt,tie))-(patOf(socks)==='solid'?2:0);let v,why='',hard=false;
    if(['white','cream','pink','lightblue'].includes(planCol(socks))&&LUM(trousers)<120){v=0;why='light socks with dark pants';hard=true}
    else if(v0>=8||(shoes&&pcol(socks)===pcol(shoes)))v=5;
    else if(v0>=3){v=4;why=v0>=4?'socks pick up the shirt or tie rather than the pants':'socks are a neutral, not the pants\' color'}
    else{v=2;why='socks don\'t match the pants'}
    // a bold patterned sock (2026-11-17): plain dark socks on a formal day, a wedding or a funeral; one whose pattern picks up the tie or
    // the shirt is matched to the outfit, not the pants
    if(!hard&&sockBold(socks)){const sp=sockPatScore(socks,{top,bot:o.bot,shirt,tie,formal:o.formal,occasion:o.occasion});
      if(sockFormalDay(o)){v=Math.min(v,2);why=sp.why[sp.why.length-1]}else if(sp.echo&&v<5){v=5;why=''}}
    // a bright plain sock (or quiet knit) on a formal day, a wedding or a funeral (the owner, 2026-11-17)
    else if(!hard&&sockFormalDay(o)&&sockBright(socks)){v=Math.min(v,2);why=o.occasion==='funeral'?'a funeral calls for plain dark socks':o.occasion==='wedding'?'dark socks suit a wedding':'a formal day calls for plain dark socks'}
    add('Socks',v,5,why,hard)}
  {const main=[top,bot,shirt,tie].filter(Boolean).map(pcol),n=new Set(main).size,hard=!!(top&&shirt&&tie&&oneColor(top,shirt,tie));let v=5,why='';
    if(hard){v=0;why='jacket, shirt and tie are all one color'}else if(n>4){v=2;why='more than four main colors'}
    if(main.length)add('Overall harmony',v,5,why,hard)}
  if(o.formal){let v=0;const why=[];
    if(top&&formalTop(top)>=25)v+=3;else why.push('a darker solid suit is more formal');
    if(shirt&&planCol(shirt)==='white')v+=3;else if(shirt&&planCol(shirt)==='lightblue'){v+=1;why.push('white is the formal shirt')}else why.push('white is the formal shirt');
    if(tie&&formalTie(tie)>=0)v+=2;else why.push('a quieter tie is more formal');
    if(shoes&&leatherGroup(planCol(shoes))==='black'&&finish(shoes.leather)==='smooth')v+=2;else why.push('black smooth-leather shoes are the formal choice');
    add('Formality',v,10,why.join('; '))}
  if(!top&&!needsJacket(o)&&shirt&&o.bot&&!camoUniform(shirt,o.bot)){let v=10,why=[];
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
/* ---- the score dials (2026-11-17, the owner's approved design: C:\code\audit-2026-11-13\score-ideas\score-dials.html) ----
   Today's score card reads an outfit on five dials, 0-100 each: Harmony (the colors together), Texture (cloth surfaces and pattern
   scales), Freshness (each piece's rest against how often its type comes round), Variety (the look against the last PAIR_DAYS workdays)
   and Occasion (the right polish for the day). rateOutfit's pass/fail checks were nearly always 99-100 on a planned day (the planner
   optimizes them); the dials read continuous values (lightness gaps, rest ratios) instead. Display only: the planner never reads them.
   Each returns {v, why}: the value and one sentence. A broken rule (a hard check of rateOutfit) rings the dial it belongs to
   (DIAL_OF_CHECK). dialLook (Harmony + Texture + Occasion) ranks the outfits a day allows (rankLooks, run in analysis-worker.js) */
const dLin=(x,a,b)=>Math.max(0,Math.min(1,(x-a)/(b-a)));
const DIAL_KEYS=['h','t','f','v','o','i'],DIAL_NAMES={h:'Harmony',t:'Texture',f:'Freshness',v:'Variety',o:'Occasion',i:'Interest'};
const DIAL_OF_CHECK={'Complete outfit':'o',Shirt:'h','Tie and shirt':'h','Tie and jacket':'h',Patterns:'t',Pants:'h',Shoes:'o',Belt:'o','Leather formality':'o',Socks:'h','Overall harmony':'h',Weather:'o',Variety:'v','Shirt and pants':'h'};
/* the rules: rateOutfit's checks that can be broken, as the card names them ('Complete outfit' always counts; the others when the check applies) */
const DIAL_RULES=[['Complete outfit','Complete outfit'],['Shirt','Shirt lighter than the jacket'],['Tie and shirt','Tie stands out from the shirt'],['Tie and jacket','Not a black tie on a black suit'],
  ['Patterns','No clashing patterns'],['Pants','Pants unlike the jacket'],['Shoes','Shoes suit the pants'],['Belt','Belt matches the shoes'],['Leather formality','No patent leather by day'],
  ['Socks','Socks not lighter than the pants'],['Overall harmony','Not all one color'],['Weather','Clothes suit the season']];
const dCol=i=>i?colName(spokenCol(i)):'';
const dJacket=o=>o.top&&o.top.type==='suit'?'suit':'jacket';
const dPiece=(i,o)=>!i?'':i===o.top?dJacket(o):i.type==='pants'||(o.bot===i&&i.type==='suit')?'pants':i.type==='tie'?'tie':i.type==='shirt'?'shirt':(TYPES[i.type]||i.type).toLowerCase();
/* how much an item's surface catches the light (0 smooth worsted, poplin or silk; 1 a knit or grenadine tie, tweed): its weave pattern or
   its material, whichever is rougher. Items with no material count as smooth */
const SURF_PAT={knit:1,tweed:1,woven:.7,'royal-oxford':.55,oxford:.5,textured:.5,'fine-texture':.4,chambray:.4,'end-on-end':.4,herringbone:.45,birdseye:.4,nailhead:.4,sharkskin:.35,dobby:.35,pinpoint:.3,twill:.2};
const SURF_MAT={tweed:1,corduroy:.9,seersucker:.8,velvet:.8,flannel:.7,linen:.7,'linen blend':.6,denim:.6,'stretch denim':.6,hopsack:.5,'camel hair':.5,moleskin:.5,cashmere:.35,'mohair blend':.35,'tropical wool':.15};
const SURF_TIE={grenadine:1,wool:.8,'wool blend':.7,cashmere:.8,linen:.8,cotton:.5,shantung:.6};
const surfOf=i=>{if(!i)return 0;const m=String(i.material||'').toLowerCase().trim();return Math.max(SURF_PAT[patOf(i)]||0,(i.type==='tie'&&SURF_TIE[m])||SURF_MAT[m]||0)};
const surfWord=i=>{const m=String(i.material||'').toLowerCase().trim(),p=patOf(i);return (i.type==='tie'&&SURF_TIE[m])||SURF_MAT[m]?m:SURF_PAT[p]?patName(p):''};
/* Harmony: shirt against the jacket, tie against shirt and jacket, and the rest (pants, pocket square, socks, metals, how many colors).
   core: leave out the pieces the rank doesn't choose (pocket square, socks, tie clip) */
/* calibration: a dial's raw share is stretched down from the top (100 - (100 - raw) * k), so a planned month on a realistic wardrobe spreads
   over about 40-100 instead of 80-100 (measured on tests/run.js's realistic and awkward wardrobes, November 2026: DIAL_K) */
const DIAL_K={h:2,o:1.8,f:1.4};
const dStretch=(raw,k)=>Math.round(Math.max(0,Math.min(100,100-(100-raw)*k)));
/* a dial's parts: [weight, 0-1, good words, weak words] (the words are functions, made only for the card, never in a rank run: fast);
   its value and its reasons (the weakest part under .6, else the strongest) */
function dialSum(P,k,fast){if(!P.length)return {v:0,why:''};let W=0,S=0;for(const p of P){W+=p[0];S+=p[0]*p[1]}const v=dStretch(100*S/W,k);if(fast)return {v};
  let lo=P[0],hi=P[0];for(const p of P){if(p[1]<lo[1])lo=p;if(p[0]*p[1]>hi[0]*hi[1])hi=p}
  const weak=lo[1]<.6?lo[3]():'',good=hi[2]();return {v,why:sentence((weak||good)+'.'),good:sentence(good),weak}}
function dialHarmony(o,core){const {top,shirt,tie}=o,bot=o.suitDay?null:o.bot,P=[],jw=top&&dJacket(o);
  if(shirt&&top){const dk=darkUnderLight(top,shirt),g=dk?dLin(LUM(top)-LUM(shirt),20,110):dLin(LUM(shirt)-LUM(top),0,150);let v=.65*g+.35*dLin(shirtScore(top,shirt),-15,5);
    if(shirtJacketHard(top,shirt))v=Math.min(v,.1);P.push([25,v,()=>`the ${dCol(shirt)} shirt stands clear of the ${dCol(top)} ${jw}`,()=>`the ${dCol(shirt)} shirt sits close to the ${dCol(top)} ${jw}`])}
  else if(shirt&&o.bot&&!top){const v=pcol(shirt)===pcol(o.bot)?.1:dLin(Math.abs(LUM(shirt)-LUM(o.bot)),10,120);P.push([25,v,()=>`the ${dCol(shirt)} shirt stands clear of the ${dCol(o.bot)} pants`,()=>`the ${dCol(shirt)} shirt sits close to the ${dCol(o.bot)} pants`])}
  if(shirt&&tie){const d=darkShirt(shirt)?tieLum(tie)-LUM(shirt):LUM(shirt)-tieLum(tie),raw=planCol(shirt),ts=TIE_ON_SHIRT[raw]||TIE_ON_SHIRT[pcol(shirt)];
    let fit=raw==='white'?.85:darkShirt(shirt)?.7:ts?(ts.includes(pcol(tie))?1:.35):.7;if(raw==='pink'&&['red','pink'].includes(pcol(tie)))fit=.1;
    const c=dLin(d,10,120);let v=.65*c+.35*fit;if(tieShirtHard(shirt,tie))v=Math.min(v,.1);else if(favPair(shirt,tie))v=1;   // (a favorite look's pair: known good, never marked down)
    P.push([25,v,()=>`the ${dCol(tie)} tie stands out well on the ${dCol(shirt)} shirt`,()=>c<=fit?`the ${dCol(tie)} tie is close in lightness to the ${dCol(shirt)} shirt`:`${dCol(tie)} is an unusual tie color on a ${dCol(shirt)} shirt`])}
  if(tie&&top){const tc=pcol(top),xc=pcol(tie),acc=colsOf(tie).slice(1),echo=acc.length>0&&acc.some(c=>colsOf(shirt).includes(c)||colsOf(top).includes(c));
    const base=xc===tc?(blackOnBlack(top,tie,o.occasion)?0:pw(tie)>0||LUM(tie)<LUM(top)-15?.6:.3):!HARM[tc]?.75:HARM[tc].includes(xc)?1:.4;
    const v=Math.min(1,.6*base+.25*dLin(Math.abs(LUM(tie)-LUM(top)),5,90)+(echo?.25:.1));
    P.push([22,v,()=>echo?`the ${dCol(tie)} tie picks up a color of the ${xc===tc?'shirt':jw}`:`${dCol(tie)} is a good partner for the ${dCol(top)} ${jw}`,()=>xc===tc?`the ${dCol(tie)} tie sits close to the ${dCol(top)} ${jw} and fades into it`:`${dCol(tie)} is not a classic partner for a ${dCol(top)} ${jw}`])}
  if(bot&&top)P.push([12,dLin(pairScore(top,bot),-20,14),()=>`the ${dCol(bot)} pants suit the ${dCol(top)} jacket`,()=>`the ${dCol(bot)} pants are a weak match for the ${dCol(top)} jacket`]);
  if(!core&&o.pocket&&top){const p=o.pocket,e=psEcho(p,top,shirt,tie);P.push([6,psSameTie(p,tie)?.1:e.hit?1:psWhite(p)?.85:.4,()=>'the pocket square picks up the outfit',()=>'the pocket square picks up no color of the outfit'])}
  // socks: the planner's sockScore (the pants' color, a patterned pair's rules), and a patterned pair's second or third color picking up the
  // shirt, tie or jacket (2026-11-17, with the sock patterns: colsOf(s).slice(1))
  if(!core&&o.socks&&(o.bot||top)){const s=o.socks,acc=colsOf(s).slice(1),echo=acc.length>0&&acc.some(c=>colsOf(shirt).includes(c)||colsOf(tie).includes(c)||colsOf(top).includes(c));
    P.push([5,Math.min(1,dLin(sockScore(o.bot||top,o.shoes,s,sockEcho(shirt,tie),{top,bot:o.bot||top,shirt,tie,formal:!!o.formal,occasion:o.occasion,season:o.clim&&o.clim.season}),-10,10)+(echo?.25:0)),()=>echo?'the socks pick up a color of the outfit':'the socks continue the pants',()=>'the socks don\'t continue the pants'])}
  {const a=o.watch&&metalOf(o.watch),b=o.belt&&metalOf(o.belt),c=!core&&o.clip&&metalOf(o.clip),ms=[a,b,c].filter(Boolean);if(ms.length>=2)P.push([5,ms.every(x=>ms.every(y=>metalSame(x,y)))?1:.3,()=>'the metals agree',()=>'the metals differ'])}
  {const main=[top,bot,shirt,tie].filter(Boolean).map(pcol),n=new Set(main).size;if(main.length)P.push([8,top&&shirt&&tie&&oneColor(top,shirt,tie)?0:n<=3?1:n===4?.8:.4,()=>'the colors are few and clear',()=>'too many colors compete'])}
  return dialSum(P,DIAL_K.h,core)}
/* Texture: how the cloth surfaces differ (a knit tie on smooth worsted high, all smooth low) and how the patterns sit together (two of one
   kind at the same scale low, patternScore's rule); fast: the value only (a rank run) */
function dialTexture(o,fast){const parts=[[o.top,'top'],[o.suitDay?null:o.bot,'bot'],[o.shirt,'shirt'],[o.tie,'tie']].filter(p=>p[0]);if(!parts.length)return {v:0,why:''};
  let hi=null,lo=null,hs=-1,ls=2;for(const [i] of parts){const s=surfOf(i);if(s>hs){hs=s;hi=i}if(s<ls){ls=s;lo=i}}
  let camo=false;const B=[];for(const [i,r] of parts){const p=patInfo(i,r);if(!p)continue;if(p.type==='camo'){if(camo)continue;camo=true}B.push({i,p})}
  // a bold pair of socks (argyle, stripes, dots: sockBold) is one more pattern; the quiet knits (ribbed, birdseye, herringbone…) count as plain
  {const sb=o.socks&&sockBold(o.socks);if(sb)B.push({i:o.socks,p:sb})}
  const n=B.length,a=n&&B[0].p,b=n>1&&B[1].p,pat=n>=3?-40:n===2?(a.type===b.type?(a.scale===b.scale?-30:6):(a.scale===b.scale?16:24)):n===1?18:0;
  const v=Math.round(Math.max(0,Math.min(100,42+40*(hs-ls)+20*hs+pat)));if(fast)return {v};
  const nmP=x=>`${patName(patOf(x.i))} ${dPiece(x.i,o)}`;
  const pw2=n>=3?'Three bold patterns compete.':n===2?(a.type===b.type?(a.scale===b.scale?`The ${nmP(B[0])} and the ${nmP(B[1])} are the same kind of pattern at the same scale: they compete.`:`The ${nmP(B[0])} and the ${nmP(B[1])} share a kind of pattern at different scales.`)
    :`The ${nmP(B[0])} and the ${nmP(B[1])} differ in kind${a.scale===b.scale?'':' and scale'}, so they sit well together.`):n===1?`The ${nmP(B[0])} ${B[0].i.type==='socks'||dPiece(B[0].i,o)==='pants'?'are':'is'} the one pattern, against plain cloth.`:'';
  let why;if(pat<0)why=pw2;else if(hs>=.4&&hs-ls>=.3)why=`The ${surfWord(hi)} ${dPiece(hi,o)} catches the light against the smooth ${dPiece(lo,o)}.`+(pw2?' '+pw2:'');
  else if(!n&&hs<.3)why='Smooth cloth throughout and no pattern: nothing catches the light differently.';else why=pw2+(hs<.3?' A textured tie or shirt would add depth.':'');
  return {v,why:why.trim()}}
/* Occasion: the right polish for the day: the shoes (finish, style, color for the pants), the belt, the tie and jacket (an occasion's own
   rules on a formal day, a wedding or a funeral), and the season of what is worn; fast: the value only */
function dialOccasion(o,fast){const {top,shirt,tie,shoes,belt}=o,legs=o.bot||top,P=[],s=o.clim&&o.clim.season,occ=OCC[o.occasion]?o.occasion:null,formal=!!o.formal||o.occasion==='formal',sd=!!o.suitDay;
  if(shoes){const st=shoeStyle(shoes),fit=legs?SHOE_FIT[st][shoeCtx(legs)]:0,f=finish(shoes.leather),w=()=>`${dCol(shoes)} ${f==='suede'?'suede ':f==='grain'?'grain ':''}${st==='oxford'?'oxfords':typeWord(shoes)}`;
    P.push([20,dLin(shoeFormality(shoes,sd)+fit,-30,2),()=>`${w()} have the right polish`,()=>`${w()} are a step down for ${sd?'a suit':'the outfit'}`]);
    if(legs){const k=(SH[pcol(legs)]||['black','brown']).indexOf(pcol(shoes));P.push([18,shoeClash(top,shoes)||!shoeSuits(top,legs,shoes)?0:st==='combat'?1:k<0?.4:[1,.85,.7,.55][k]??.5,()=>`${dCol(shoes)} shoes suit the ${dCol(legs)} ${sd?'suit':'pants'}`,()=>`${dCol(shoes)} shoes don't suit the ${dCol(legs)} ${sd?'suit':'pants'}`])}}
  if(shoes&&belt&&shoeStyle(shoes)!=='sneaker'&&shoeStyle(shoes)!=='combat'){const f=beltFit(shoes,belt);P.push([10,f===null?0:f>0?1:.65,()=>'the belt matches the shoes',()=>`a ${dCol(belt)} belt with ${dCol(shoes)} shoes`])}
  if(tie){const v=formal?dLin(formalTie(tie),-15,3):occ?dLin(OCC[occ].tie(tie),-25,10):dLin(formalTie(tie),-12,3);P.push([14,v,()=>`the ${dCol(tie)} tie suits the day`,()=>`the ${dCol(tie)} tie is a touch casual for the day`])}
  if(top){const v=formal?dLin(formalTop(top),-25,30):occ?dLin(occTop(occ,top,s),-30,30):sd?(isCamo(top)?0:Math.max(.85,dLin(formalTop(top),-25,30))):.85;/* (an ordinary suit day: any suit suits it, a dark one fully; only camouflage, the uniform, doesn't; the strict dark-suit scale is for formal days and occasions: the owner, 2026-11-17, "a warm taupe suit isn't formal as a suit?") */P.push([14,v,()=>`the ${dCol(top)} ${dJacket(o)} suits the day`,()=>`the ${dCol(top)} ${dJacket(o)} is less formal than ${sd?'a suit day':'the day'} wants`])}
  if(shirt&&(formal||occ)){const v=formal?dLin(formalShirt(shirt),-14,10):dLin(OCC[occ].shirt(shirt),-20,10);P.push([10,v,()=>`the ${dCol(shirt)} shirt suits the day`,()=>`the ${dCol(shirt)} shirt is not the shirt for the day`])}
  if(s){let f=0,bad=null;for(const i of [top,sd?null:o.bot,shirt,tie]){if(!i)continue;const x=seasonFit(i,s);if(x<f){f=x;bad=i}}
    P.push([16,f<=-15?0:f<0?.65:1,()=>`the cloth suits a ${s} day`,()=>bad?`the ${dCol(bad)} ${dPiece(bad,o)} is ${itemSeason(bad)}-weather cloth on a ${s} day`:''])}
  const r=dialSum(P,DIAL_K.o,fast);if(fast||!r.why)return r;
  const lead=formal?'A formal day: ':occ==='funeral'?'A funeral: ':occ==='wedding'?'A wedding: ':o.occasion==='casual'?'A day without a jacket: ':'';
  return lead?{...r,why:lead+lowFirstD(r.why)}:r}
const lowFirstD=t=>t?t[0].toLowerCase()+t.slice(1):t;
/* Freshness: each piece's rest (o[slot].rest, days since it was last worn, as the planner counts it, at most 60) against how often its
   type comes round (cyc(type): the calendar days a piece of that type usually waits, from how many are in rotation) */
const FRESH_FULL={shirt:14,tie:14,suit:14,blazer:14,pants:14,shoes:7,other:14};   // calendar days of rest that count as fully fresh
function dialFreshness(o,cyc){const P=[[o.top,30],[o.suitDay?null:o.bot,10],[o.shirt,25],[o.tie,25],[o.shoes,10]].filter(([i])=>i&&typeof i.rest==='number');
  if(!P.length)return {v:100,why:'Every piece is fresh.'};
  // a piece that rested FRESH_FULL days is fully fresh however many of its type are owned (2026-11-17, the owner: a shirt worn 12 days ago
  // scored a quarter fresh with 35 shirts, a 49-day turn); fewer pieces than that still count against their own shorter turn
  const r=P.map(([i,w])=>{const c=Math.max(1,Math.min(cyc?cyc(i.type):7,FRESH_FULL[i.type]||FRESH_FULL.other));return {i,w,q:Math.min(1,i.rest/c),c}});
  const v=dStretch(100*r.reduce((a,x)=>a+x.w*x.q,0)/r.reduce((a,x)=>a+x.w,0),DIAL_K.f);
  const days=n=>n>=60?'60+ days':n===1?'1 day':n+' days',clothes=r.filter(x=>x.i.type!=='shoes'),sh=r.find(x=>x.i.type==='shoes');
  const why=clothes.map((x,k)=>k?`${dPiece(x.i,o)} ${days(x.i.rest)}`:`${sentence(dPiece(x.i,o))} rested ${days(x.i.rest)}`).join(', ')+'.'+(sh?` Shoes ${days(sh.i.rest)}.`:'');
  const most=r.filter(x=>x.i.type!=='shoes').reduce((m,x)=>!m||x.i.rest/x.c>m.i.rest/m.c?x:m,null);
  return {v,why,most:most&&{piece:`${dCol(most.i)} ${dPiece(most.i,o)}`,rest:most.i.rest}}}
/* Variety: the look against the latest workdays before it (recent: [{d, o}], latest first, at most PAIR_DAYS): the same shirt color with
   the same tie (the planner's pairRepeat), the same jacket, tie or look soon after, a run of one shirt color; each costs less the further back */
const dWhen=(d,i)=>`${i===0?'the workday before':i===1?'two workdays ago':`${i+1} workdays ago`}`+(d?` (${d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})})`:'');
function dialVariety(o,recent){const {top,shirt,tie}=o;recent=(recent||[]).slice(0,PAIR_DAYS);let v=100,worst={p:0,why:''};
  const hit=(p,why)=>{v-=p;if(p>worst.p)worst={p,why}};
  const sg=shirt&&shirtGroup(shirt),jg=top&&jacketGroup(top),staple=sg==='white'||sg==='lightblue',sl=shirtLook(shirt),tl=tieLook(tie);
  recent.forEach(({d,o:p},i)=>{if(!p)return;const fade=1-i/(PAIR_DAYS*1.6);
    if(tie&&shirt&&p.tie&&p.shirt&&p.tie.id===tie.id&&shirtGroup(p.shirt)===sg)hit(34*fade,`You wore a ${dCol(shirt)} shirt with this ${dCol(tie)} tie ${dWhen(d,i)}.`);
    else if(tie&&p.tie&&p.tie.id===tie.id&&i<3)hit(i?12:18,`The same tie as ${dWhen(d,i)}.`);
    else if(tie&&p.tie&&tieGroup(p.tie)===tieGroup(tie))hit(i?2*fade:8,`${sentence(dCol(tie))} was the tie color ${dWhen(d,i)} too.`);
    if(top&&p.top&&p.top.id===top.id&&i<5)hit((i?14:24)*(1-i/6),`The same ${dJacket(o)} as ${dWhen(d,i)}.`);
    else if(top&&p.top&&jacketGroup(p.top)===jg&&i<2)hit(i?4:9,`A ${dCol(top)} ${dJacket(o)} ${dWhen(d,i)} too.`);
    if(top&&p.top&&i<4&&jacketGroup(p.top)===jg&&shirtLook(p.shirt)===sl&&tieLook(p.tie)===tl)hit(20*(1-i/5),`The same look as ${dWhen(d,i)}: jacket color, shirt and tie.`);
    if(shirt&&p.shirt&&shirtGroup(p.shirt)===sg)hit(staple?(i?.6:3):(i?2*fade:8),`A ${dCol(shirt)} shirt ${dWhen(d,i)} too.`)});
  let run=0;for(const {o:p} of recent){if(p&&p.shirt&&shirt&&shirtGroup(p.shirt)===sg)run++;else break}
  if(run>=2)hit((staple?4:7)*run,`A ${dCol(shirt)} shirt ${run+1} workdays running.`);
  v=Math.round(Math.max(0,Math.min(100,v)));
  return {v,why:worst.p>=3?worst.why:recent.length?`Nothing repeats from the last ${recent.length} workday${recent.length===1?'':'s'}.`:'Nothing to compare with yet.'}}
/* the same shirt color and tie as one of the recent workdays (the calendar's gold border; the planner's pairRepeat rule, PAIR_DAYS window):
   the index of that day in recent, or -1 */
const pairSeen=(o,recent)=>{if(!o||!o.shirt||!o.tie)return -1;const sg=shirtGroup(o.shirt);return (recent||[]).slice(0,PAIR_DAYS).findIndex(x=>x&&x.o&&x.o.tie&&x.o.shirt&&x.o.tie.id===o.tie.id&&shirtGroup(x.o.shirt)===sg)};
/* Interest (2026-11-18, the owner: the rank's #1 was "the most basic possible suit"; his choice from mockups, C:\code\audit-2026-11-13\interest\):
   the deliberate choices the other dials don't reward, each part 0-1 with a weight, no stretch:
   - a color echo (30): one of the tie's colors (its own, second, third; chroma over 9) within INT_ECHO ΔE00 of the jacket's, its second
     color or the shirt's (chroma over 7), at most INT_ECHO_L lightness apart (a dark navy tie doesn't pick up a periwinkle shirt);
   - two patterns working together (25): patsOf (the rules already keep out a clash), one pattern half, none .15;
   - a jacket with character (20): a color other than navy, charcoal, gray or black 1, a patterned basic .7, a plain basic .25;
   - a shirt beyond plain white (15): a color or a pattern 1, a white weave .5, plain white .2;
   - the shoes (10): brown, oxblood or any not black 1, black with a black or charcoal jacket .6, else .35 */
const INT_ECHO=[12,18],INT_ECHO_L=20,INT_WEAVES=['dobby','woven','oxford','herringbone','twill','royal-oxford','end-on-end','pinpoint','textured','fine-texture'];
const intHx=k=>!k||k==='none'?null:(COLORS[k]||(typeof CUSTOM_COL!=='undefined'&&CUSTOM_COL[k]&&CUSTOM_COL[k].hex)||null),intChr=l=>Math.hypot(l[1],l[2]);
/* an item's colors in Lab for the echo: [main, second, third] (null where none); kept for a planning or rank run (colRun.il), where the same
   pieces are met thousands of times (a 36,750-outfit rank at 4x CPU took 988 ms without it) */
function intLabs(i){const run=typeof colRun!=='undefined'&&colRun,m=run&&(run.il||(run.il=new Map()));let v=m&&m.get(i);if(v)return v;
  const lab=h=>h?rgbLab(...hexRgb(h)):null;v=[lab(colOf(i)),lab(intHx(i.secondaryColor)),lab(intHx(i.tertiaryColor))];if(m)m.set(i,v);return v}
function dialInterest(o,fast){const {top,shirt,tie,shoes}=o,P=[];
  if(tie){const tc=intLabs(tie).filter(l=>l&&intChr(l)>9),J=top?intLabs(top):[],S=shirt?intLabs(shirt):[];
    const tg=[[top,J[0]],[top,J[1]],[shirt,S[0]]].filter(([i,l])=>i&&l&&intChr(l)>7);
    let best=null;for(const a of tc)for(const [i,l] of tg){if(Math.abs(a[0]-l[0])>INT_ECHO_L)continue;const d=dE00(a,l);if(!best||d<best.d)best={d,i}}
    const v=!best?.15:best.d<INT_ECHO[0]?1:best.d<INT_ECHO[1]?.6:.2;
    P.push([30,v,()=>best&&best.d<INT_ECHO[1]?`the tie picks up the ${dCol(best.i)} of the ${best.i===top?dJacket(o):'shirt'}`:'the tie stands on its own',()=>`nothing in the tie picks up another piece's color`])}
  const n=patsOf([[top,'top'],[o.suitDay?null:o.bot,'bot'],[shirt,'shirt'],[tie,'tie']]).length;
  P.push([25,n>=2?1:n===1?.5:.15,()=>'two patterns work together',()=>n===1?'only one pattern':'no pattern anywhere']);
  if(top){const basic=['navy','charcoal','grey','black'].includes(pcol(top)),pat=!!patInfo(top,'top');
    P.push([20,!basic?1:pat?.7:.25,()=>!basic?`the ${dCol(top)} ${dJacket(o)} has character`:`the patterned ${dJacket(o)}`,()=>`a standard ${dCol(top)} ${dJacket(o)}`])}
  if(shirt){const w=planCol(shirt)==='white',pat=!!patInfo(shirt,'shirt'),wv=INT_WEAVES.includes(patOf(shirt));
    P.push([15,!w||pat?1:wv?.5:.2,()=>!w||pat?`the ${dCol(shirt)} shirt adds life`:'the woven white shirt',()=>'a plain white shirt'])}
  if(shoes&&top){const bl=leatherGroup(planCol(shoes))==='black',dark=['black','charcoal'].includes(pcol(top));
    P.push([10,!bl?1:dark?.6:.35,()=>`${dCol(shoes)} shoes warm it up`,()=>'black shoes, the safe choice'])}
  return dialSum(P,1,fast)}
/* the look's rank value: Harmony + Texture + Occasion + half of Interest (Freshness and Variety stay out, or the planned outfit would always
   be first). Interest counts only as Harmony allows (INT_GATE: none at 65, all from 80), so an outfit that sits badly together can't climb
   on interest; the planner's look term (planLook, chooseClothes) reads the same value */
const INT_W=.5,INT_GATE=[65,80];
const dialLook=o=>{const h=dialHarmony(o,true).v;return h+dialTexture(o,true).v+dialOccasion(o,true).v+INT_W*dLin(h,INT_GATE[0],INT_GATE[1])*dialInterest(o,true).v};
/* Rank the outfits a day allows (the score card's "38th best of 296 outfits today"): every jacket of the day's kind in rotation x pants
   (the suit's own on a suit day) x shirt x tie, the shoes, belt and watch chosen for each jacket and pants as the planner's chooseLeather
   does (without rest); only the combinations that break no rule count (clothesHard, shoes that suit, the season). pools: {top, bot, shirt,
   tie, shoes, belt, watch} item lists; cur: the day's outfit (with suitDay, clim, formal, occasion). Returns {n, rank, swaps: [{slot, id,
   rank, fix}]}: single swaps (shirt, tie, pants, shoes, belt) that rank higher, or with a broken rule those that mend it. Runs in
   analysis-worker.js (history.js rankFor) */
/* the shoes, belt and watch a look is judged with: for each jacket and pants the best of the day's pairs as chooseLeather picks them,
   without rest (S, B, W: the day's shoes, belts and watches; sd: a suit day). Used by rankLooks and the planner's look term (planLook) */
function lookLeather(S,B,W,sd,rain){const lmemo=new Map();return (t,b)=>{const k=(t?t.id:'-')+'|'+(b?b.id:'-');let r=lmemo.get(k);if(r)return r;let pick=null;
    for(const x of S.length?S:[null])for(const be of [...B,null])for(const w of W.length?W:[null]){let v=0;
      if(x){const ss=shoeScore(t,b,x);v+=ss-(ss<=SHOE_LINE?NO_SHOES:0)+shoeFormality(x,sd);if(rain&&finish(x.leather)==='suede')v-=RAIN_SUEDE}
      if(be){if(!x)continue;const f=beltFit(x,be);if(f===null)continue;v+=12+f}else if(B.length&&x)v-=30;
      if(w)v+=watchFit(w,x,be)*SHOE_WATCH;if(!pick||v>pick.v)pick={v,shoes:x,belt:be,watch:w}}
    r=pick||{shoes:null,belt:null,watch:null};lmemo.set(k,r);return r}}
/* the planner's look term (chooseClothes): a function giving dialLook, the rank's own value, of a jacket, pants, shirt and tie on the day,
   with the shoes, belt and watch lookLeather gives them from the day's pools (S, B, W: all in rotation, as the rank counts them). Both are
   kept for the planning run (colRun.lw by the pools, colRun.look by the outfit and the day's season and occasion): an outfit comes back on
   many days, and a look is worked out once (the 149-item test wardrobe: 8 months plan in about 1.3x the time) */
function planLook(day,sd,S,B,W){const rain=!!(day.clim&&day.clim.rain),occ=day.occ||(day.formal?'formal':null),base={suitDay:sd,clim:day.clim,formal:!!day.formal,occasion:occ};
  const val=(lw,top,bot,shirt,tie)=>{const L=lw(top,bot);return dialLook({...base,top,bot,shirt,tie,shoes:L.shoes,belt:L.belt,watch:L.watch})};
  if(!colRun){const lw=lookLeather(S,B,W,sd,rain);return (top,bot,shirt,tie)=>val(lw,top,bot,shirt,tie)}
  const R=colRun.lw||(colRun.lw=new Map()),memo=colRun.look||(colRun.look=new Map()),sig=(sd?'S':'B')+(rain?'r':'')+'|'+S.map(i=>i.id).join()+'|'+B.map(i=>i.id).join()+'|'+W.map(i=>i.id).join();
  let e=R.get(sig);if(!e){e={lw:lookLeather(S,B,W,sd,rain),n:R.size};R.set(sig,e)}const pre=e.n+'|'+(day.clim&&day.clim.season)+'|'+occ+'|';
  return (top,bot,shirt,tie)=>{const k=pre+(top?top.id:'-')+'|'+(bot?bot.id:'-')+'|'+(shirt?shirt.id:'-')+'|'+(tie?tie.id:'-');let v=memo.get(k);if(v===undefined){v=val(e.lw,top,bot,shirt,tie);memo.set(k,v)}return v}}
function rankLooks(pools,cur){return withColRun(()=>{const t0=Date.now(),sd=!!cur.suitDay,day={formal:!!cur.formal,occ:cur.occasion&&cur.occasion!=='formal'?cur.occasion:null,clim:cur.clim||{season:'mild'}};
  const base={suitDay:sd,clim:cur.clim,formal:cur.formal,occasion:cur.occasion},S=pools.shoes||[],B=pools.belt||[],W=pools.watch||[],s=day.clim.season;
  const shoeOk=(t,b)=>!S.length||S.some(x=>finish(x.leather)!=='patent'&&shoeSuits(t,b,x));
  const leather=lookLeather(S,B,W,sd,day.clim.rain);
  const seasonBad=o=>!!s&&[o.top,o.suitDay?null:o.bot,o.shirt,o.tie].some(i=>i&&seasonFit(i,s)<-10);
  const hard=o=>clothesHard(o.top,sd?o.top:o.bot,o.shirt,o.tie,sd,day,shoeOk)||(o.shoes&&(o.bot||o.top)&&!shoeSuits(o.top,o.bot||o.top,o.shoes))||(o.shoes&&finish(o.shoes.leather)==='patent')||(o.shoes&&o.belt&&beltFit(o.shoes,o.belt)===null)||seasonBad(o);
  const tops=cur.top?(pools.top&&pools.top.length?pools.top:[cur.top]):[null],ties=cur.tie?(pools.tie&&pools.tie.length?pools.tie:[cur.tie]):[null],shirts=cur.shirt?(pools.shirt&&pools.shirt.length?pools.shirt:[cur.shirt]):[null];
  const bots=t=>sd?[t]:cur.bot?(pools.bot&&pools.bot.length?pools.bot:[cur.bot]):[null];
  const scores=[];
  for(const t of tops)for(const b of bots(t)){const L=leather(t,b);for(const sh of shirts)for(const x of ties){const o={...base,top:t,bot:b,shirt:sh,tie:x,shoes:L.shoes,belt:L.belt,watch:L.watch};
    if(hard(o))continue;scores.push(dialLook(o))}}
  scores.sort((a,b)=>b-a);const above=v=>{let lo=0,hi=scores.length;while(lo<hi){const m=(lo+hi)>>1;if(scores[m]>v+1e-9)lo=m+1;else hi=m}return lo};
  const strip=o=>({...base,top:o.top,bot:o.bot,shirt:o.shirt,tie:o.tie,shoes:o.shoes,belt:o.belt,watch:o.watch});
  const me=strip(cur),meV=dialLook(me),rank=above(meV)+1,broken=typeof rateOutfit==='function'?rateOutfit(cur).hard:[],swaps=[];
  const trySwap=(slot,it)=>{const a={...cur,[slot]:it};if(slot==='shoes'){let bb=null,bf=-1;for(const be of B){const f=beltFit(it,be);if(f!==null&&f>bf){bf=f;bb=be}}a.belt=bb}
    const fixes=broken.length>0&&!rateOutfit(a).hard.length,okA=!hard(strip(a));if(!okA&&!fixes)return;const r=above(dialLook(strip(a)))+1;
    if(broken.length?fixes:r<rank)swaps.push({slot,id:it.id,rank:r,fix:broken.length>0})};
  for(const slot of ['shirt','tie','bot','shoes','belt','socks']){if(slot==='bot'&&(sd||cur.suitBot))continue;if(slot!=='belt'&&slot!=='socks'&&!cur[slot])continue;if((slot==='belt'||slot==='socks')&&!broken.length)continue;
    for(const it of pools[slot]||[]){if(cur[slot]&&cur[slot].id===it.id)continue;trySwap(slot,it)}}
  const seen={},best=[];for(const w of swaps.sort((a,b)=>a.rank-b.rank||(a.id<b.id?-1:1))){if(seen[w.slot])continue;seen[w.slot]=1;best.push(w)}
  // (the day's own outfit counts among them when it breaks no rule: its shoes or belt may differ from those chosen above)
  return {n:broken.length?scores.length:Math.max(scores.length,rank),rank,look:meV,broken,swaps:best.slice(0,3),ms:Date.now()-t0}})}
/* A saved day: past days (and any day marked worn) are frozen to what was shown, so wardrobe changes never rewrite history.
   Rotation counts frozen days unless they're marked "didn't wear". */
function frozenOutfit(rec,n,last){
  const o={suitDay:!!rec.suitDay,frozen:true,worn:rec.worn,formal:!!rec.formal,occasion:occOf(rec),notes:[]};
  for(const s of SLOTS){const id=rec.ids[s],it=id&&items.find(i=>i.id===id);o[s]=it?{...it,rest:Math.min(n-(last[it.id]??-1e5),60)}:null;
    if((id&&!it)||(rec.gone&&rec.gone[s]))(o.gone||(o.gone={}))[s]=true}   // a piece deleted since: the day is rated without it (rateOutfit), not as "Incomplete" (rec.gone: a removed sample piece's slot, kit.js kitSampleDay)
  o.vest=!!(rec.vestOn&&o.suitDay&&hasVest(o.top));
  // a piece taken off that day (rec.off, see takeOff): the record already holds the outfit without it
  if(rec.off&&(rec.off.top||rec.off.tie||rec.off.pocket)){o.off={top:!!rec.off.top&&!o.top,tie:!!rec.off.tie&&!o.tie,...(rec.off.pocket&&!o.pocket&&o.top?{pocket:true}:{})};o.suitBot=!!(o.bot&&o.bot.type==='suit');if(o.off.top)o.offKind=o.suitBot||rec.kind==='suit'?'suit':'blazer'}   // (rec.kind: a suit taken off with other pants picked)
  if(rec.worn!==false)for(const s of SLOTS)if(o[s])last[o[s].id]=n;
  return o;
}
/* One simulation, resumable: planSim(start).upTo(day) plans every workday from start to that day and can be asked again
   for a later day, continuing where it stopped (the app keeps one for all the months it shows, so stepping to another
   month only plans the days that are new). The wardrobe, history and settings must not change in between: start a new one. */
function planSim(start){const lists={},by=t=>lists[t]||(lists[t]=items.filter(i=>i.type===t&&!isHandPick(i)&&(!i.paused||arriveN(i)!=null)).sort((a,b)=>a.id<b.id?-1:1)),last={},plan={},T=todayDate();   // (never a hand-pick piece: core.js isHandPick; outfit() takes one only from the day's pick)
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
    else if(occOf(r)&&occOf(r)!=='casual'){const oc=occOf(r),sc=j=>occTop(oc,j,oc==='formal'?null:dayClimate(x).season),ranked=by('suit').map(j=>[sc(j),j]).sort((a,b)=>b[0]-a[0]);
      if(ranked.length>1&&ranked[0][0]>ranked[1][0])ids.push(ranked[0][1].id)}
    // not fixed and the next day is a blazer day: the blazer due (longest rested) is the likely pick, so the suit before it
    // avoids that colour (only this way round: suits are many, blazers few and must keep rotating)
    else if(!w&&settings.blazerDays.includes(x.getDay())&&!settings.blazerDays.includes(d.getDay())&&!occOf(r)){
      const pool=by('blazer');let due=null,dr=-1;for(const j of pool){const rr=di(x)-(last[j.id]??-1e5);if(rr>dr){dr=rr;due=j}}
      if(due)soft={g:jacketGroup(due),c:planCol(due)}}
    w++}return {next,ids,soft,fx}};
const pairs=[],hist={},remember=o=>{pairs.unshift({tie:o.tie?o.tie.id:null,sc:o.shirt?shirtGroup(o.shirt):null});if(pairs.length>PAIR_DAYS)pairs.length=PAIR_DAYS;if(!o.top)return;const h=hist[o.top.id]||(hist[o.top.id]=[]);h.unshift({tie:o.tie?o.tie.id:null,sc:o.shirt?shirtGroup(o.shirt):null});h.length=Math.min(h.length,2)};
const sumUp=(o,n)=>({jid:o.top?o.top.id:null,jg:o.top?jacketGroup(o.top):null,jc:o.top?planCol(o.top):null,sg:o.shirt?shirtGroup(o.shirt):null,tg:o.tie?tieGroup(o.tie):null,tid:o.tie?o.tie.id:null,sl:shirtLook(o.shirt),tl:tieLook(o.tie),sid:o.shirt?o.shirt.id:null,sh:o.shoes?o.shoes.id:null,n});
const d=new Date(start);
// the pool for one day: items in rotation that day (one on its way joins the day after it arrives)
const arriving=items.some(i=>i.paused&&arriveN(i)!=null),byOn=n=>arriving?(t=>by(t).filter(i=>inRotation(i,n))):by;
/* favorite looks (settings.fav.looks, the owner's design 2026-11-18): each comes back on its own about every three weeks. favW holds each
   look's last appearance (worn, picked or planned) as a workday count (wn), favN the day number of the last day any favorite look was. A
   look is due after FAV_LOOK_REST workdays, at most one in FAV_WEEK days, only on a workday from today on that nothing pins (no lock,
   pick, skip, occasion, kind, trip or piece taken off: a locked or picked day is never moved), and only when all its pieces are in rotation,
   the shirt out of the wash, each piece suits the weather, the day is of its jacket's kind and nothing repeats by the usual rules
   (favPick); the day is then planned with the three pinned, and kept only when that breaks no rule (favDay) */
const FL=favLooks(),favW={};let wn=0,favN=-1e9;
const favNote=(o,n)=>{if(!FL.length||!o)return;const l=favLookOf(o);if(l){favW[favLookKey(l)]=wn;favN=n}};
const favFree=(rec,d)=>+d>=+T&&!(rec&&(rec.ids||rec.lock||rec.force||rec.skip||rec.kind||rec.trip||rec.off||rec.formal||rec.occasion||typeof rec.vest==='boolean'||rec.worn===false));
const favAhead=d=>{const x=new Date(d);for(let g=1;g<FAV_WEEK;g++){x.setDate(x.getDate()+1);const r=dayRecs[key(x)];if(!r||r.worn===false)continue;
    const pk=s=>(r.force&&r.force[s])||(r.lock&&r.lock[s])||null;if(FL.some(l=>favLookKey(l)===favKey(pk('top'),pk('shirt'),pk('tie'))))return true}return false};
const favPick=(d,n,sd,day)=>{if(day.formal||day.occ||n-favN<FAV_WEEK)return null;
  const due=FL.filter(l=>wn-(favW[favLookKey(l)]??-1e9)>=FAV_LOOK_REST);if(!due.length||favAhead(d))return null;
  const B=byOn(n),LD=Math.max(0,+(settings.laundryDays??1)||0),noJ=!wearsJacket(),noT=!wearsTie(),pv=day.prev||[],ah=day.ahead||{ids:[],fx:[]},fx=ah.fx||[],kind=sd?'suit':'blazer';
  due.sort((a,b)=>(favW[favLookKey(a)]??-1e9)-(favW[favLookKey(b)]??-1e9)||(favLookKey(a)<favLookKey(b)?-1:1));   // the longest rested first
  for(const l of due){const j=l.j?B(kind).find(i=>i.id===l.j):null,sh=B('shirt').find(i=>i.id===l.sh),x=l.tie?B('tie').find(i=>i.id===l.tie):null;
    if(!sh||(l.j?noJ||!j:!noJ)||(l.tie?noT||!x:!noT))continue;   // a piece out of rotation, or a look of the other kind of day
    if([j,sh,x].some(i=>i&&seasonFit(i,day.clim.season)<=-15))continue;   // a piece out of season
    if(LD>0&&n-(last[sh.id]??-1e5)<=LD)continue;   // the shirt is in the wash
    if(j&&((pv[0]&&pv[0].jid===j.id)||ah.ids.includes(j.id)||colourRepeat(j,pv.map(p=>p&&{g:p.jg,c:p.jc}),ah.next,topGw(B(kind)))>=JKT_SAME/2))continue;
    if(x&&(tieRepeat(x,pv,day.prev3)>=15||aheadTie(x,fx)>=TIE_GAP))continue;
    const w2=B('shirt').length>3?2:1;if(pv.slice(0,w2).some(p=>p&&p.sid===sh.id)||fx.some(f=>f.w<w2&&f.sid===sh.id)||aheadShirt(sh,fx,n)>=NEXT_SHIRT)continue;
    if(j&&lookRepeat(j,sh,x,pv)>=20)continue;   // (not comboRepeat: the jacket's own last outfit is often this very look, which is the point)
    return {l,force:{...(j?{top:j.id}:{}),shirt:sh.id,...(x?{tie:x.id}:{})}}}
  return null};
const upTo0=end=>{
for(const E=di(end);di(d)<=E;d.setDate(d.getDate()+1)){const w=d.getDay();   // (day numbers: where the clocks change at midnight, the date after it sits at 01:00)
 if(!isWorkday(d))continue;   // weekends, public holidays and days off
  wn++;const k=key(d);let rec=dayRecs[k];
  if(rec&&rec.ids&&(d<T||rec.worn===true)&&!idsAhead(rec)){plan[k]=frozenOutfit(rec,di(d),last);plan[k].ctx={prev,prev3,n:di(d)};if(rec.worn!==false){prev3=prev[1]||null;prev=[sumUp(plan[k],di(d)),prev[0]];remember(plan[k]);favNote(plan[k],di(d))}continue}   // (a day marked "Not worn" is not the previous workday for repeats; a day without a jacket is, see below)
  if(W0&&d<W0&&d<T)continue;   // before the wardrobe began (wardStart): nothing was worn then
  if(rec&&rec.noOutfit&&d<T)continue;   // a past day dressed only from the sample wardrobe, since removed (kit.js kitSampleDay): no outfit recorded
  /* every worn workday is the previous workday for repeats, one without a jacket too (the jacket taken off, a casual day: the code review,
     CR-3-04: the next day could repeat its tie and shirt): its summary has no jacket group (colourRepeat, lookRepeat skip it), and
     remember() keeps the jackets' own history (hist) to days with a jacket */
  const o=planDay(d,rec,true);plan[k]=o;prev3=prev[1]||null;prev=[sumUp(o,di(d)),prev[0]];remember(o);favNote(o,di(d))}
return plan};
// one workday planned with this record (a day not frozen): the loop above, and peek (fav: the loop, which may bring a favorite look back)
const planDay=(d,rec,fav)=>{const w=d.getDay();if(rec&&rec.lock&&!lockOf(rec,di(d))){rec={...rec};delete rec.lock}
  const occ=occOf(rec),formal=occ==='formal',lt=rec&&rec.lock&&!(rec.force&&rec.force.top)&&rec.lock.top&&items.find(i=>i.id===rec.lock.top),n=di(d);
  const sd=lt&&!rec.kind&&!(occ==='casual')?lt.type==='suit':rec&&rec.kind?rec.kind==='suit':!!(occ&&occ!=='casual')||!settings.blazerDays.includes(w);
  const day={formal,occ:occ&&occ!=='formal'?occ:null,clim:dayClimate(d),hasLinks,prev,prev3,ahead:fixedAhead(d),hist,pairs};
  const o=(fav&&FL.length&&favFree(rec,d)&&favDay(d,n,sd,rec,day))||outfit(sd,n,byOn(n),last,rec,day);
  o.overrides=!!(rec&&(rec.force||rec.skip));o.worn=rec&&rec.worn;o.ctx={prev,prev3,n};return o};
/* a favorite look due on day d (favPick), planned with its pieces pinned; null (rest counts put back) when none is due or the day it makes
   breaks a rule. The outfit carries favDue (the look), not enumerable */
const favDay=(d,n,sd,rec,day)=>{const f=favPick(d,n,sd,day);if(!f)return null;const keep={...last};
  const o=outfit(sd,n,byOn(n),last,rec,{...day,fav:f.force});o.ctx={prev,prev3,n};
  const got=favLookOf(o);if(got&&favLookKey(got)===favLookKey(f.l)&&!rateOutfit(o).hard.length){Object.defineProperty(o,'favDue',{value:f.l});return o}  for(const x of Object.keys(last))if(!(x in keep))delete last[x];Object.assign(last,keep);return null};
/* peek(k, rec): the outfit day k would get with this record, nothing kept (the piece picker's labels and Suggest another, history.js
   pickScores): the days before k are planned once, then each try plans k alone and puts the rest counts back. A sim that has peeked
   plans on only up to k (use a sim of its own) */
const peek=(k,rec)=>withColRun(()=>{const t=keyDate(k);upTo0(new Date(t.getFullYear(),t.getMonth(),t.getDate()-1));const keep={...last};
  try{return planDay(t,rec)}finally{for(const x of Object.keys(last))if(!(x in keep))delete last[x];Object.assign(last,keep)}});
return {plan,upTo:end=>withColRun(()=>upTo0(end)),peek}}
/* every month from two months back onward is simulated from one shared start, so neighbouring months agree on the days they
   share (the plan depends on what came before: rest and the previous workdays' jacket colours) */
const planStart=(y,m)=>{const T=todayDate();return new Date(Math.min(+new Date(y,m,-13),+new Date(T.getFullYear(),T.getMonth()-2,-13)))};
function buildPlan(y,m){return planSim(planStart(y,m)).upTo(new Date(y,m+1,0))}

