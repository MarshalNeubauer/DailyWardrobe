/* Daily Wardrobe: outfit rules, planning and scoring (no DOM access; also loaded by the analysis worker) */
/* colour families for the rules: dark grey behaves like charcoal, light grey like grey, oxblood like burgundy */
const FAM={mint:'green',paleyellow:'cream',ivory:'cream',beige:'tan',khaki:'tan',taupe:'tan',rust:'brown',periwinkle:'blue',darkgrey:'charcoal',lightgrey:'grey',midgrey:'grey',oxblood:'burgundy',wine:'burgundy',steelblue:'blue',deepblue:'navy',darknavy:'navy',slate:'charcoal'},fam=c=>FAM[c]||c,pcol=i=>fam(primaryCol(i));
/* acceptable shoe colours for each trouser colour, best first */
const SH={black:['black'],charcoal:['black','burgundy','brown'],grey:['black','brown','burgundy'],navy:['brown','burgundy','black','tan'],brown:['brown','tan','burgundy'],tan:['brown','tan','burgundy'],olive:['brown','tan','burgundy'],blue:['brown','black','burgundy']};
/* ---- clothing rules (suit/blazer, trousers, shirt, tie) ----
   Every candidate outfit gets one score from these rules; the planner picks among the best-scoring outfits. */
const HARM={navy:['burgundy','red','gold','grey','lightblue','green','purple','pink','brown'],charcoal:['burgundy','red','purple','navy','lightblue','pink','green','gold'],grey:['navy','burgundy','blue','purple','pink','green','black'],black:['red','grey','burgundy','purple','silver'],brown:['green','gold','navy','tan','burgundy','cream','olive'],tan:['navy','brown','burgundy','green','olive'],olive:['brown','burgundy','navy','gold','cream','tan'],blue:['navy','burgundy','grey','gold','brown'],green:['tan','brown','burgundy','gold','navy']};
/* good tie colours on each shirt colour (white takes almost anything) */
const TIE_ON_SHIRT={mint:['navy','burgundy','brown','green','olive','charcoal','purple','grey'],ivory:['navy','burgundy','brown','green','olive','gold','charcoal','red','grey'],paleyellow:['navy','burgundy','brown','green','purple','charcoal','blue'],lavender:['navy','purple','burgundy','charcoal','grey','black','pink'],periwinkle:['navy','burgundy','charcoal','gold','brown','red','grey'],beige:['brown','navy','green','olive','burgundy','tan'],lightblue:['navy','burgundy','red','gold','brown','green','purple','charcoal','grey','black'],pink:['navy','burgundy','grey','charcoal','purple','blue','green'],cream:['brown','green','burgundy','olive','navy','gold','tan'],lightgrey:['navy','burgundy','black','purple','charcoal','pink','red'],blue:['navy','burgundy','gold','brown','charcoal','red'],grey:['navy','burgundy','black','purple','red']};
/* good trousers for each odd jacket, best first */
const BLAZER_TROUSERS={navy:['grey','charcoal','tan','cream','olive'],tan:['navy','brown','charcoal','olive'],brown:['grey','charcoal','tan','navy','cream'],olive:['tan','brown','charcoal','cream'],grey:['charcoal','navy','black'],charcoal:['grey','tan','navy'],black:['grey','charcoal'],green:['tan','grey','brown','cream'],burgundy:['grey','charcoal','navy'],blue:['grey','tan','navy','cream']};
const colsOf=i=>i?[primaryCol(i),i.secondaryColor,i.tertiaryColor].filter(c=>c&&COLORS[c]).map(fam):[];
const lumOf=c=>{const h=COLORS[c];return h?parseInt(h.slice(1,3),16)*.3+parseInt(h.slice(3,5),16)*.59+parseInt(h.slice(5,7),16)*.11:128};

/* dark shirts (navy, charcoal, black, burgundy...) are worn under light jackets (light/mid grey, tan) with a tie lighter
   than the shirt: a modern, less formal look. With any other jacket the classic rule applies: shirt lighter than jacket. */
const darkShirt=s=>!!s&&lumOf(primaryCol(s))<100,lightTop=t=>!!t&&LUM(t)>=130,darkUnderLight=(t,s)=>darkShirt(s)&&lightTop(t);
/* how light a tie reads overall: a patterned tie's stripes, checks or dots lighten (or darken) it */
const tieLum=x=>{const acc=x&&x.pattern&&!['solid','knit'].includes(x.pattern)?[x.secondaryColor,x.tertiaryColor].filter(c=>c&&COLORS[c]):[];
  return acc.length?LUM(x)*.65+acc.reduce((a,c)=>a+lumOf(c),0)/acc.length*.35:LUM(x)};
/* shirt against the jacket: light, quiet shirts read as professional; the shirt should be lighter than the jacket */
function shirtScore(t,s){
  const raw=primaryCol(s),pc=pcol(s);
  if(darkUnderLight(t,s))return 3;
  let v=({white:5,ivory:4,lightblue:4,pink:2,cream:2,paleyellow:1,lavender:1,lightgrey:1,periwinkle:0,beige:0,mint:0,midgrey:-2,blue:0})[raw]??(['navy','black','charcoal','brown','burgundy','green','olive','red'].includes(pc)?-10:-5);
  if(!t)return v;const tc=pcol(t);
  if(pc===tc)v-=25;
  if(lumOf(raw)<LUM(t)+20)v-=15;
  if(tc==='black'&&raw!=='white')v-=8;
  return v;
}
/* tie against shirt and jacket */
function tieScore(t,sh,x){
  let v=0;const xc=pcol(x),acc=colsOf(x).slice(1);
  if(sh){const sc=pcol(sh),raw=primaryCol(sh),d=LUM(sh)-LUM(x);
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
  if((tc==='black')!==(pc==='black'))v-=20;
  const list=BLAZER_TROUSERS[tc];
  if(list){const k=list.indexOf(pc);v+=k<0?-10:8-k*2}
  else if(!['grey','charcoal','tan','navy','olive','brown','black','cream'].includes(pc))v-=20;
  if(Math.abs(LUM(t)-LUM(p))<35)v-=6;else v+=3;           // jacket and trousers need visible contrast
  return v;
}
/* pattern mixing: one bold pattern is always fine; two are fine if they differ in type or scale; never three */
const PAT_TYPE={stripe:'stripe',pinstripe:'stripe','fine-stripe':'stripe','chalk-stripe':'stripe',check:'check',gingham:'check',tattersall:'check',windowpane:'check','glen-check':'check',houndstooth:'check','polka-dot':'motif',paisley:'motif',foulard:'motif'};
function patInfo(i,role){
  const p=i&&i.pattern;if(!p||!PAT_TYPE[p])return null;     // solids and fine weaves don't count
  const scale=role==='tie'?({stripe:3,check:2,'polka-dot':2,paisley:2,foulard:1})[p]??2
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
  if(o.tie&&o.tie.pattern==='knit'&&o.suitDay)v-=4;         // knit ties are a touch casual for a suit
  return v;
}
/* formal days: dark solid suits, white shirts (French cuffs welcome), quiet ties */
function formalTop(i){const c=pcol(i),p=i.pattern||'solid';let v=['navy','charcoal','black'].includes(c)?30:c==='grey'?8:-25;
  if(['windowpane','glen-check','houndstooth','check','tweed'].includes(p))v-=30;else if(p==='chalk-stripe')v-=10;else if(p==='pinstripe')v-=4;return v}
function formalShirt(s){let v=({white:6,lightblue:2})[primaryCol(s)]??-8;if(patInfo(s,'shirt'))v-=6;if(s.cuff==='french')v+=4;return v}
function formalTie(t){let v=0;const pi=patInfo(t,'tie');if(pi&&pi.scale>=2)v-=6;if(t.pattern==='knit')v-=12;
  v+=['burgundy','navy','grey','charcoal','black','purple','silver'].includes(pcol(t))?3:-3;return v}
function clothesScore(top,bot,shirt,tie,suitDay,day){
  let v=0;
  if(day){const s=day.clim.season;v+=(suitDay?0:seasonFit(bot,s))+seasonFit(shirt,s)+seasonFit(tie,s);
    if(day.formal){if(shirt)v+=formalShirt(shirt);if(tie)v+=formalTie(tie)}
    if(shirt&&shirt.cuff==='french'&&!day.hasLinks)v-=12;}     // French cuffs need cufflinks
  if(!suitDay&&bot)v+=pairScore(top,bot);
  if(shirt)v+=shirtScore(top,shirt);
  if(tie)v+=tieScore(top,shirt,tie);
  v+=patternScore([[top,'top'],[suitDay?null:bot,'bot'],[shirt,'shirt'],[tie,'tie']]);
  v+=outfitScore({top,bot,shirt,tie,suitDay});
  return v;
}
const WARM=['brown','tan','olive'];
const shoeScore=(t,b,s)=>{if(!b)return 0;const sc=pcol(s),bc=pcol(b),tc=t?pcol(t):'';const k=(SH[bc]||['black','brown']).indexOf(sc);let v=k<0?-50:6-k*2;if(t&&((WARM.includes(tc)&&sc==='black')||(tc==='black'&&sc!=='black')))v-=50;return v};
const sockScore=(bot,sh,s)=>{const sc=pcol(s),botc=bot?pcol(bot):'',shc=sh?pcol(sh):'';let v=s.pattern==='solid'?2:0;if(bot&&sc===botc)v+=8;else if(sh&&sc===shc)v+=4;else if(bot)v+=(WARM.includes(botc)?['brown','tan','olive']:['black','navy','charcoal','grey']).includes(sc)?3:-8;if(bot&&['white','cream','pink','lightblue'].includes(primaryCol(s)))v-=10;return v};

/* ---- leather goods ----
   Belt and shoes must be the same colour group (black / brown / tan / burgundy-oxblood) and a compatible finish:
   suede with suede, smooth with smooth or grain. Patent is black-tie only. Metals (buckle, watch, tie clip) should agree. */
const leatherGroup=c=>({black:'black',brown:'brown',tan:'tan',khaki:'tan',burgundy:'burgundy',oxblood:'burgundy',wine:'burgundy'})[c]||c;
const finish=l=>l==='suede'?'suede':l==='patent'?'patent':l==='pebble-grain'||l==='scotch-grain'?'grain':'smooth';
const metalOf=i=>i&&i.metal||'silver';
function beltFit(shoe,belt){
  if(leatherGroup(primaryCol(belt))!==leatherGroup(primaryCol(shoe)))return null;
  const fs=finish(shoe.leather),fb=finish(belt.leather);
  if(fs===fb)return 3;
  if((fs==='smooth'&&fb==='grain')||(fs==='grain'&&fb==='smooth'))return 0;
  return null; // suede vs smooth, patent vs anything else
}
function shoeFormality(shoe,suitDay){
  const f=finish(shoe.leather);
  if(f==='patent')return -200;               // evening wear: only if nothing else exists
  if(f==='suede')return suitDay?-15:0;       // fine with a blazer, too casual with a suit
  if(f==='grain')return suitDay?-8:0;
  return 2;                                  // smooth calf / cordovan
}
function watchFit(w,shoe,belt){
  let v=0;const o=watchOpts(w);
  if(o.band==='leather'&&shoe)v+=leatherGroup(primaryCol(w))===leatherGroup(primaryCol(shoe))?8:-20;
  if(belt)v+=metalOf(w)===metalOf(belt)?6:-6;
  return v;
}

/* bump PLAN_RULES whenever the planning rules change: on the next start the app re-plans every future day (swaps on days
   after today are cleared; formal days, today and the past stay) */
const PLAN_RULES=3;
const QWIN=8,SH_CAP=45;   // outfits within this many points of the best one take turns (rest decides among them)
/* jacket colour groups, as the eye reads them: every grey from light grey to charcoal is one look, two navies are one look. A jacket in the same
   group as the previous workday's (weekends and days off skipped) loses about 8 days of rest; a near group or the workday
   before that counts less. Rest still decides when every choice repeats a colour. */
const JKT_GROUP={lightgrey:'grey',midgrey:'grey',grey:'grey',silver:'grey',charcoal:'grey',darkgrey:'grey',slate:'charcoal',black:'black',
  navy:'navy',darknavy:'navy',deepblue:'navy',blue:'blue',steelblue:'blue',lightblue:'blue',brown:'brown',taupe:'brown',rust:'brown',tan:'tan',khaki:'tan',cream:'tan',
  olive:'green',green:'green',burgundy:'red',wine:'red',oxblood:'red'};
const JKT_NEAR=[['grey','charcoal'],['charcoal','black'],['navy','blue'],['navy','charcoal'],['brown','tan']];
const jacketGroup=i=>{const c=primaryCol(i);return JKT_GROUP[c]||fam(c)};
const groupsNear=(a,b)=>JKT_NEAR.some(([x,y])=>(x===a&&y===b)||(x===b&&y===a));
// prev: the previous workdays' groups (latest first); next: the next workday's group when that day is already fixed
// (worn, or a jacket the user picked), so a pinned day is not crowded either
const DARK_JKT=['black','charcoal','darkgrey'];
// a and b: {g: group, c: colour}. Black next to charcoal or dark grey also reads as "dark again"
const nearCost=(a,b)=>DARK_JKT.includes(a.c)&&DARK_JKT.includes(b.c)?26:groupsNear(a.g,b.g)?6:0;
const colourRepeat=(i,prev,next)=>{const me={g:jacketGroup(i),c:primaryCol(i)};let v=0;
  (prev||[]).slice(0,2).forEach((p,n)=>{if(!p||!p.g)return;v+=p.g===me.g?(n?12:40):n?Math.round(nearCost(p,me)/3):nearCost(p,me)});
  if(next&&next.g)v+=next.g===me.g?40:nearCost(next,me);return v};
/* shirts and ties get the same treatment, with their own groups. White and light blue are the staples: a repeat of those costs
   little. These penalties only choose among outfits that already score within QWIN of the best one. */
const SHIRT_GROUP={white:'white',ivory:'white',cream:'white',lightblue:'lightblue',periwinkle:'blue',blue:'blue',steelblue:'blue',lavender:'purple',pink:'pink',
  paleyellow:'yellow',beige:'beige',mint:'green',lightgrey:'grey',midgrey:'grey',grey:'grey',darkgrey:'grey',charcoal:'grey',slate:'grey',navy:'navy',darknavy:'navy',black:'black',burgundy:'red'};
const TIE_GROUP={navy:'navy',darknavy:'navy',deepblue:'navy',blue:'blue',steelblue:'blue',lightblue:'blue',slate:'blue',black:'black',charcoal:'black',grey:'grey',silver:'grey',
  burgundy:'red',wine:'red',red:'red',oxblood:'red',pink:'pink',purple:'purple',lavender:'purple',green:'green',olive:'green',brown:'brown',tan:'brown',rust:'brown',gold:'gold',cream:'cream'};
const shirtGroup=i=>{const c=primaryCol(i);return SHIRT_GROUP[c]||fam(c)},tieGroup=i=>{const c=primaryCol(i);return TIE_GROUP[c]||fam(c)};
const shirtRepeat=(sh,prev)=>{if(!sh||!prev)return 0;const g=shirtGroup(sh),staple=g==='white'||g==='lightblue';let v=0;
  prev.slice(0,2).forEach((p,n)=>{if(p&&p.sg===g)v+=staple?(n?0:2):(n?3:8)});return v};
const tieRepeat=(x,prev)=>{if(!x||!prev)return 0;const g=tieGroup(x);let v=0;
  prev.slice(0,2).forEach((p,n)=>{if(!p)return;if(p.tid===x.id)v+=n?4:12;else if(p.tg===g)v+=n?2:8});return v};
function outfit(suitDay,n,by,last,rec,day){day=day||{formal:false,clim:{season:'mild',rain:false,cold:false},hasLinks:false};const rest=i=>Math.min(n-(last[i.id]??-1e5),60),rb=i=>Math.min(rest(i),10)*.4;
// a day's record can pin pieces (force) or rule them out (skip) after the user swaps something
const force=rec&&rec.force||{},skip=rec&&rec.skip||{};
const pool=(type,slot)=>{const all=by(type),f=force[slot];if(f){const x=all.find(i=>i.id===f);if(x)return [x]}
  const s=skip[slot]||[],left=all.filter(i=>!s.includes(i.id));return left.length?left:all};
const take=b=>{if(!b)return null;const c={...b,rest:rest(b)};last[b.id]=n;return c};
const best=(arr,sc)=>{let b=null,bs=-1e9;for(const i of arr){const s=sc(i)+rb(i);if(s>bs){bs=s;b=i}}return take(b)};
// suits rotate (least recently worn first); season and formality can override a few days of rest
const top=best(pool(suitDay?'suit':'blazer','top'),i=>Math.min(rest(i),14)*3+Math.max(0,rest(i)-14)+seasonFit(i,day.clim.season)*2+(day.formal?formalTop(i)*2:0)-colourRepeat(i,day.prev&&day.prev.map(p=>p&&{g:p.jg,c:p.jc}),day.ahead&&day.ahead.next)-(day.ahead&&day.ahead.soft&&!day.ahead.next?Math.round(colourRepeat(i,null,day.ahead.soft)/2):0)-(day.ahead&&day.ahead.ids.includes(i.id)?100:0));
// vest: part of a three-piece suit; worn per the user's setting unless the day overrides it
const vm=settings.vestMode||'auto',vov=rec&&typeof rec.vest==='boolean'?rec.vest:null;
const vest=!!(suitDay&&hasVest(top)&&(vov!==null?vov:vm==='always'||(vm==='auto'&&(day.formal||day.clim.season!=='warm'))));
// trousers, shirt and tie are scored together as one outfit. Rotation only chooses among outfits within 5 points
// of the best one, so variety never costs a clearly better combination.
// Large wardrobes: keep only the 4 best trousers and 10 best shirts for this jacket (rotation included), then try every tie.
const topN=(arr,n,f)=>arr.length<=n?arr:arr.map(i=>[f(i)+rb(i),i]).sort((a,b)=>b[0]-a[0]).slice(0,n).map(x=>x[1]);
// shirts are many and low-stakes: how long one has rested counts for more, so every acceptable shirt comes around
const shRest=sh=>Math.min(rest(sh),SH_CAP)*.5;
const Ps=suitDay?[null]:topN(pool('pants','bot'),4,pt=>pairScore(top,pt)),Ss=topN(pool('shirt','shirt'),16,sh=>shirtScore(top,sh)+patternScore([[top,'top'],[sh,'shirt']])+shRest(sh)),Ts=pool('tie','tie'),cands=[];
for(const pt of Ps.length?Ps:[null])for(const sh of Ss.length?Ss:[null])for(const x of Ts.length?Ts:[null]){
  const q=clothesScore(top,suitDay?top:pt,sh,x,suitDay,day);
  cands.push({q,pt,sh,x,r:1.5*((pt?rb(pt):0)+(x?rb(x):0))+(x?Math.min(rest(x),30)*.25:0)+(sh?shRest(sh):0)-shirtRepeat(sh,day.prev)-tieRepeat(x,day.prev)});
}
const qmax=Math.max(...cands.map(c=>c.q)),pick1=cands.filter(c=>c.q>=qmax-QWIN).sort((a,b)=>(b.q+b.r)-(a.q+a.r))[0];
const bot=suitDay?top:take(pick1.pt),shirt=take(pick1.sh),tie=take(pick1.x);
// shoes, belt and watch are chosen together so the belt always matches the shoes and the metals agree
const S=pool('shoes','shoes'),B=pool('belt','belt'),W=pool('watch','watch');let pick=null;
for(const s of S.length?S:[null])for(const b of [...B,null])for(const w of W.length?W:[null]){
  let t=0;
  if(s){t+=shoeScore(top,bot,s)+shoeFormality(s,suitDay)+rb(s);
    if(day.clim.rain&&finish(s.leather)==='suede')t-=25;             // suede and rain don't mix
    if(day.formal){const g=leatherGroup(primaryCol(s)),f=finish(s.leather);t+=(f==='suede'||f==='grain')?-20:g==='black'?8:g==='burgundy'?3:-4}}
  if(b){if(!s)continue;const f=beltFit(s,b);if(f===null)continue;t+=12+f+rb(b)}else if(B.length&&s)t-=30; // no matching belt: allowed, but last resort
  if(w)t+=watchFit(w,s,b)+rb(w);
  if(!pick||t>pick.t)pick={t,s,b,w};
}
const shoes=take(pick&&pick.s),belt=take(pick&&pick.b),watch=take(pick&&pick.w);
const socks=best(pool('socks','socks'),s=>sockScore(bot,shoes,s));
const metalPref=c=>(watch?(metalOf(c)===metalOf(watch)?6:-4):0)+(belt?(metalOf(c)===metalOf(belt)?3:-2):0);
const clip=vest?null:best(pool('tieclip','clip'),metalPref);   // the vest holds the tie: no clip
// cufflinks only (and always) with French cuffs
const french=shirt&&shirt.cuff==='french',links=french?best(pool('cufflinks','links'),metalPref):null;
// coat when the forecast (or the season) calls for one: raincoat for rain unless it's very cold, otherwise an overcoat
const clim=day.clim,needCoat=clim.cold||clim.rain,prefer=clim.rain&&!clim.veryCold?'raincoat':'overcoat';
const coat=needCoat?best([...pool('overcoat','coat'),...pool('raincoat','coat')],c=>(c.type===prefer?10:0)+seasonFit(c,clim.season)+(['navy','charcoal','tan','grey','black'].includes(pcol(c))?3:0)+(shoes&&pcol(c)==='black'&&leatherGroup(primaryCol(shoes))!=='black'?-4:0)):null;
// say so when the wardrobe can't make a correct combination, instead of silently mismatching
const notes=[];
// clothing: only reached when the wardrobe had no compliant combination for this jacket
if(shirt&&tie&&darkShirt(shirt)&&tieLum(tie)-LUM(shirt)<25)notes.push(`The ${nm(tie)} isn't lighter than the ${nm(shirt)}; on a dark shirt a lighter tie reads better.`);
if(shirt&&tie&&!darkShirt(shirt)&&LUM(shirt)-LUM(tie)<25)notes.push(`The ${nm(tie)} isn't darker than the ${nm(shirt)}; no darker tie suited this outfit. A darker tie would look sharper.`);
if(top&&shirt&&!darkUnderLight(top,shirt)&&LUM(shirt)<LUM(top)+20)notes.push(`The ${nm(shirt)} is darker than the jacket. A lighter shirt would look more professional.`);
if([[top,'top'],[suitDay?null:bot,'bot'],[shirt,'shirt'],[tie,'tie']].filter(([i,r])=>patInfo(i,r)).length>=3)notes.push('Three bold patterns today; there was no quieter combination. A solid shirt or tie would calm it down.');
if(shoes&&bot&&shoeScore(top,bot,shoes)<=-50)notes.push(`None of your shoes suit ${primaryCol(bot)} trousers.`);
if(shoes&&finish(shoes.leather)==='patent')notes.push('Only patent shoes were available. Patent is for black tie.');
if(shoes&&B.length&&!belt)notes.push(`None of your belts match the ${desc(shoes)} shoes. Add a ${leatherGroup(primaryCol(shoes))} ${finish(shoes.leather)==='suede'?'suede':'smooth leather'} belt.`);
if(watch&&belt&&metalOf(watch)!==metalOf(belt))notes.push(`The watch (${metalOf(watch)}) and belt buckle (${metalOf(belt)}) are different metals.`);
if(french&&!links)notes.push('French-cuff shirt, but no cufflinks in your wardrobe. Add a pair.');
if(clim.rain&&shoes&&finish(shoes.leather)==='suede')notes.push('Rain is forecast and only suede shoes suited this outfit. Smooth leather would hold up better.');
if(needCoat&&!coat)notes.push(clim.rain?'Rain is forecast and there is no raincoat in your wardrobe.':'It will be cold and there is no overcoat in your wardrobe.');
if(top&&seasonFit(top,clim.season)<-10)notes.push(`The ${nm(top)} is a ${itemSeason(top)}-weather piece on a ${clim.season} day; no better suit was available.`);
return{suitDay,top,bot,shirt,tie,shoes,belt,socks,watch,clip,links,coat,vest,vestOverride:vov!==null,notes:notes.map(prettyCols),clim,formal:!!day.formal}}
/* ---- outfit score ----
   A readable 0-100 rating of the planned outfit against the same rules the planner uses.
   Each check earns points out of a maximum; checks that don't apply (no belt owned, suit days have no separate trousers)
   are left out, and the score is the share of available points earned. */
function rateOutfit(o){
  const nice=prettyCols;
  const C=[],add=(label,pts,max,why)=>C.push({label,pts:Math.max(0,Math.min(max,pts)),max,why:pts<max?nice(why):''});
  const {top,shirt,tie,shoes,belt,socks,watch,clip}=o,bot=o.suitDay?null:o.bot,trousers=o.bot||top;
  if(shirt){const raw=primaryCol(shirt);let v=({white:10,lightblue:10,ivory:9,pink:8,cream:8,lightgrey:7,paleyellow:7,lavender:7,periwinkle:7,mint:6,blue:6,beige:6,midgrey:6})[raw]??2,why=v<10?`a ${raw} shirt is less classic than white or light blue`:'';
    if(darkUnderLight(top,shirt)){v=7;why='a dark shirt under a light jacket is a modern, less formal look'}
    else if(top&&pcol(shirt)===pcol(top)){v=0;why='shirt is the same colour as the jacket'}
    else if(top&&LUM(shirt)<LUM(top)+20){v-=5;why='shirt is darker than the jacket'}
    if(shirt.cuff==='french'&&!o.links){v-=5;why=(why?why+'; ':'')+'French cuffs without cufflinks'}
    add('Shirt',v,10,why)}
  if(shirt&&tie){const raw=primaryCol(shirt),d=LUM(shirt)-LUM(tie);let v=0,why=[];
    if(darkShirt(shirt)){if(tieLum(tie)-LUM(shirt)>=25)v+=8;else why.push('tie is not lighter than the dark shirt')}
    else if(d>=25)v+=8;else why.push('tie is not darker than the shirt');
    if(pcol(tie)!==pcol(shirt))v+=2;else why.push('tie and shirt are the same colour');
    const ts=darkShirt(shirt)?null:TIE_ON_SHIRT[raw]||TIE_ON_SHIRT[pcol(shirt)];if(raw==='white'||!ts||ts.includes(pcol(tie)))v+=5;else{v+=1;why.push(`${primaryCol(tie)} is an unusual tie colour on a ${raw} shirt`)}
    add('Tie and shirt',v,15,why.join('; '))}
  if(tie&&top){const tc=pcol(top),xc=pcol(tie);let v,why='';
    if(xc===tc){if(tc==='black'){v=0;why='black tie on a black suit reads as funeral wear'}else if(pw(tie)>0||LUM(tie)<LUM(top)-15)v=10;else{v=6;why='tonal tie blends into the jacket'}}
    else if(!HARM[tc]||HARM[tc].includes(xc))v=10;else{v=4;why=`${primaryCol(tie)} is not a classic partner for a ${primaryCol(top)} jacket`}
    add('Tie and jacket',v,10,why)}
  {const parts=[[top,'top'],[bot,'bot'],[shirt,'shirt'],[tie,'tie']],P=parts.map(([i,r])=>patInfo(i,r)).filter(Boolean);let v=10,why='';
    if(P.length>=3){v=0;why='three bold patterns compete'}
    else if(P.length===2){if(P[0].type!==P[1].type){v=9;why='two different patterns: fine, slightly busier than one'}else if(P[0].scale!==P[1].scale){v=7;why='two patterns of the same type (different scale)'}else{v=3;why='two patterns of the same type and scale'}}
    if(top||shirt||tie)add('Patterns',v,10,why)}
  if(bot&&top){const list=BLAZER_TROUSERS[pcol(top)];let v,why='';const k=list?list.indexOf(pcol(bot)):-1;
    v=k===0?10:k===1?9:k===2?8:k>2?7:3;why=k<0?`${primaryCol(bot)} trousers are not a classic match for a ${primaryCol(top)} jacket`:`${primaryCol(bot)} trousers work, but ${list[0]} is the classic first choice with a ${primaryCol(top)} jacket`;
    if(Math.abs(LUM(top)-LUM(bot))<35){v-=4;why=(why?why+'; ':'')+'jacket and trousers lack contrast'}
    add('Trousers',v,10,why)}
  if(shoes&&trousers){const s=shoeScore(top,trousers,shoes),k=(SH[pcol(trousers)]||['black','brown']).indexOf(pcol(shoes));
    add('Shoes',s<=-50?0:k===0?10:k===1?9:k===2?8:7,10,s<=-50?`${primaryCol(shoes)} shoes don't suit ${primaryCol(trousers)} trousers`:`${primaryCol(shoes)} shoes are a good but not the first choice with ${primaryCol(trousers)}`)}
  if(shoes&&items.some(i=>i.type==='belt')){const f=belt?beltFit(shoes,belt):null;
    add('Belt',!belt?0:f===null?0:f>0?10:8,10,!belt?'no belt matches the shoes':f===null?'belt does not match the shoes':'belt finish differs slightly from the shoes')}
  if(shoes){const f=finish(shoes.leather);let v=5,why='';
    if(f==='patent'){v=0;why='patent shoes are for black tie'}else if(f==='suede'&&o.suitDay){v=2;why='suede is casual for a suit'}else if(f==='grain'&&o.suitDay){v=3;why='grain leather is casual for a suit'}
    add('Leather formality',v,5,why)}
  {const ms=[watch,belt,clip].filter(Boolean).map(metalOf);
    if(ms.length>=2)add('Metals',new Set(ms).size===1?5:2,5,'watch, buckle and tie clip metals differ');}
  if(socks&&trousers){const sc=pcol(socks),bc=pcol(trousers);let v,why='';
    if(sc===bc)v=5;else if(shoes&&sc===pcol(shoes)){v=4;why='socks match the shoes rather than the trousers'}
    else if(['white','cream','pink','lightblue'].includes(primaryCol(socks))&&LUM(trousers)<120){v=0;why='light socks with dark trousers'}
    else{v=3;why='socks don\'t match the trousers'}
    add('Socks',v,5,why)}
  {const main=[top,bot,shirt,tie].filter(Boolean).map(pcol),n=new Set(main).size;let v=5,why='';
    if(top&&shirt&&tie&&pcol(top)===pcol(shirt)&&pcol(shirt)===pcol(tie)){v=0;why='jacket, shirt and tie are all one colour'}else if(n>4){v=2;why='more than four main colours'}
    if(main.length)add('Overall harmony',v,5,why)}
  if(o.formal){let v=0;const why=[];
    if(top&&formalTop(top)>=25)v+=3;else why.push('a darker solid suit is more formal');
    if(shirt&&primaryCol(shirt)==='white')v+=3;else if(shirt&&primaryCol(shirt)==='lightblue'){v+=1;why.push('white is the formal shirt')}else why.push('white is the formal shirt');
    if(tie&&formalTie(tie)>=0)v+=2;else why.push('a quieter tie is more formal');
    if(shoes&&leatherGroup(primaryCol(shoes))==='black'&&finish(shoes.leather)==='smooth')v+=2;else why.push('black smooth-leather shoes are the formal choice');
    add('Formality',v,10,why.join('; '))}
  if(o.clim){const c=o.clim,s=c.season;let v=5;const why=[];
    if((c.cold||c.rain)&&!o.coat&&items.some(i=>i.type==='overcoat'||i.type==='raincoat')){v-=2;why.push('no coat for the weather')}
    if(c.rain&&shoes&&finish(shoes.leather)==='suede'){v-=2;why.push('suede shoes in the rain')}
    const off=[top,o.suitDay?null:o.bot,shirt,tie].filter(i=>i&&seasonFit(i,s)<-10);if(off.length){v-=2;why.push(`${off.map(nm).join(', ')} out of season`)}
    if(c.wx||off.length)add('Weather',v,5,why.join('; '))}
  const max=C.reduce((a,c)=>a+c.max,0),got=C.reduce((a,c)=>a+c.pts,0),score=max?Math.round(100*got/max):0;
  const label=score>=90?'Excellent':score>=80?'Very good':score>=70?'Good':score>=55?'Fair':'Needs work';
  return {score,label,checks:C};
}
/* A saved day: past days (and any day marked worn) are frozen to what was shown, so wardrobe changes never rewrite history.
   Rotation counts frozen days unless they're marked "didn't wear". */
function frozenOutfit(rec,n,last){
  const o={suitDay:!!rec.suitDay,frozen:true,worn:rec.worn,formal:!!rec.formal,notes:[]};
  for(const s of SLOTS){const id=rec.ids[s],it=id&&items.find(i=>i.id===id);o[s]=it?{...it,rest:Math.min(n-(last[it.id]??-1e5),60)}:null}
  o.vest=!!(rec.vestOn&&o.suitDay&&hasVest(o.top));
  if(rec.worn!==false)for(const s of SLOTS)if(o[s])last[o[s].id]=n;
  return o;
}
function buildPlan(y,m){const by=t=>items.filter(i=>i.type===t).sort((a,b)=>a.id<b.id?-1:1),last={},plan={},T=todayDate();
const hasLinks=by('cufflinks').length>0;let prev=[];   // the previous workdays (latest first): jacket, shirt and tie colour groups, and the tie
// jackets already fixed on the next workdays (worn, or picked by the user): the next one's colour group, and the ids of
// those within the next 3 workdays, which are held back so a pinned jacket is not worn just before its day
const fixedAhead=d=>{const x=new Date(d),ids=[];let next=null,soft=null,w=0;for(let g=0;g<10&&w<3;g++){x.setDate(x.getDate()+1);if(!settings.workdays.includes(x.getDay()))continue;
    const r=dayRecs[key(x)],id=r&&(r.force&&r.force.top||(r.ids&&(x<T||r.worn===true)&&r.ids.top)),it=id&&items.find(i=>i.id===id);
    if(it){ids.push(it.id);if(!w)next={g:jacketGroup(it),c:primaryCol(it)}}
    // not fixed and the next day is a blazer day: the blazer due (longest rested) is the likely pick, so the suit before it
    // avoids that colour (only this way round: suits are many, blazers few and must keep rotating)
    else if(!w&&settings.blazerDays.includes(x.getDay())&&!settings.blazerDays.includes(d.getDay())&&!(r&&r.formal)){
      const pool=by('blazer');let due=null,dr=-1;for(const j of pool){const rr=di(x)-(last[j.id]??-1e5);if(rr>dr){dr=rr;due=j}}
      if(due)soft={g:jacketGroup(due),c:primaryCol(due)}}
    w++}return {next,ids,soft}};
const sumUp=o=>({jg:o.top?jacketGroup(o.top):null,jc:o.top?primaryCol(o.top):null,sg:o.shirt?shirtGroup(o.shirt):null,tg:o.tie?tieGroup(o.tie):null,tid:o.tie?o.tie.id:null});
// every month from two months back onward is simulated from one shared start, so neighbouring months agree on the days they
// share (the plan depends on what came before: rest and the previous workdays' jacket colours)
const from=new Date(Math.min(+new Date(y,m,-13),+new Date(T.getFullYear(),T.getMonth()-2,-13)));
for(const d=from;d<=new Date(y,m+1,0);d.setDate(d.getDate()+1)){const w=d.getDay();if(!settings.workdays.includes(w))continue;
  const k=key(d),rec=dayRecs[k];
  if(rec&&rec.ids&&(d<T||rec.worn===true)){plan[k]=frozenOutfit(rec,di(d),last);if(plan[k].top)prev=[sumUp(plan[k]),prev[0]];continue}
  const formal=!!(rec&&rec.formal),o=outfit(formal||!settings.blazerDays.includes(w),di(d),by,last,rec,{formal,clim:dayClimate(d),hasLinks,prev,ahead:fixedAhead(d)});o.overrides=!!(rec&&(rec.force||rec.skip));o.worn=rec&&rec.worn;plan[k]=o;if(o.top)prev=[sumUp(o),prev[0]]}
return plan}

