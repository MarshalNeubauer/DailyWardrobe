/* Daily Wardrobe: outfit rules, planning and scoring (no DOM access; also loaded by the analysis worker) */
/* colour families for the rules: dark grey behaves like charcoal, light grey like grey, oxblood like burgundy */
const FAM={darkgrey:'charcoal',lightgrey:'grey',oxblood:'burgundy'},fam=c=>FAM[c]||c,pcol=i=>fam(primaryCol(i));
/* acceptable shoe colours for each trouser colour, best first */
const SH={black:['black'],charcoal:['black','burgundy','brown'],grey:['black','brown','burgundy'],navy:['brown','burgundy','black','tan'],brown:['brown','tan','burgundy'],tan:['brown','tan','burgundy'],olive:['brown','tan','burgundy'],blue:['brown','black','burgundy']};
/* ---- clothing rules (suit/blazer, trousers, shirt, tie) ----
   Every candidate outfit gets one score from these rules; the planner picks among the best-scoring outfits. */
const HARM={navy:['burgundy','red','gold','grey','lightblue','green','purple','pink','brown'],charcoal:['burgundy','red','purple','navy','lightblue','pink','green','gold'],grey:['navy','burgundy','blue','purple','pink','green','black'],black:['red','grey','burgundy','purple','silver'],brown:['green','gold','navy','tan','burgundy','cream','olive'],tan:['navy','brown','burgundy','green','olive'],olive:['brown','burgundy','navy','gold','cream','tan'],blue:['navy','burgundy','grey','gold','brown'],green:['tan','brown','burgundy','gold','navy']};
/* good tie colours on each shirt colour (white takes almost anything) */
const TIE_ON_SHIRT={lightblue:['navy','burgundy','red','gold','brown','green','purple','charcoal','grey','black'],pink:['navy','burgundy','grey','charcoal','purple','blue','green'],cream:['brown','green','burgundy','olive','navy','gold','tan'],lightgrey:['navy','burgundy','black','purple','charcoal','pink','red'],blue:['navy','burgundy','gold','brown','charcoal','red'],grey:['navy','burgundy','black','purple','red']};
/* good trousers for each odd jacket, best first */
const BLAZER_TROUSERS={navy:['grey','charcoal','tan','cream','olive'],tan:['navy','brown','charcoal','olive'],brown:['grey','charcoal','tan','navy','cream'],olive:['tan','brown','charcoal','cream'],grey:['charcoal','navy','black'],charcoal:['grey','tan','navy'],black:['grey','charcoal'],green:['tan','grey','brown','cream'],burgundy:['grey','charcoal','navy'],blue:['grey','tan','navy','cream']};
const colsOf=i=>i?[primaryCol(i),i.secondaryColor,i.tertiaryColor].filter(c=>c&&COLORS[c]).map(fam):[];
const lumOf=c=>{const h=COLORS[c];return h?parseInt(h.slice(1,3),16)*.3+parseInt(h.slice(3,5),16)*.59+parseInt(h.slice(5,7),16)*.11:128};

/* shirt against the jacket: light, quiet shirts read as professional; the shirt should be lighter than the jacket */
function shirtScore(t,s){
  const raw=primaryCol(s),pc=pcol(s);
  let v=({white:5,lightblue:4,pink:2,cream:2,lightgrey:1,blue:0})[raw]??(['navy','black','charcoal','brown','burgundy','oxblood','green','olive','red','darkgrey'].includes(raw)?-10:-5);
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
    if(d<25)v-=12;else if(d>60)v+=3;                       // the tie should be clearly darker than the shirt
    if(raw!=='white'&&TIE_ON_SHIRT[raw])v+=TIE_ON_SHIRT[raw].includes(xc)?3:-4;
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
const PAT_TYPE={stripe:'stripe',pinstripe:'stripe','chalk-stripe':'stripe',check:'check',gingham:'check',tattersall:'check',windowpane:'check','glen-check':'check',houndstooth:'check','polka-dot':'motif',paisley:'motif',foulard:'motif'};
function patInfo(i,role){
  const p=i&&i.pattern;if(!p||!PAT_TYPE[p])return null;     // solids and fine weaves don't count
  const scale=role==='tie'?({stripe:3,check:2,'polka-dot':2,paisley:2,foulard:1})[p]??2
    :role==='shirt'?({pinstripe:1})[p]??2
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
const leatherGroup=c=>({black:'black',brown:'brown',tan:'tan',burgundy:'burgundy',oxblood:'burgundy'})[c]||c;
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

function outfit(suitDay,n,by,last,rec,day){day=day||{formal:false,clim:{season:'mild',rain:false,cold:false},hasLinks:false};const rest=i=>Math.min(n-(last[i.id]??-1e5),60),rb=i=>Math.min(rest(i),10)*.4;
// a day's record can pin pieces (force) or rule them out (skip) after the user swaps something
const force=rec&&rec.force||{},skip=rec&&rec.skip||{};
const pool=(type,slot)=>{const all=by(type),f=force[slot];if(f){const x=all.find(i=>i.id===f);if(x)return [x]}
  const s=skip[slot]||[],left=all.filter(i=>!s.includes(i.id));return left.length?left:all};
const take=b=>{if(!b)return null;const c={...b,rest:rest(b)};last[b.id]=n;return c};
const best=(arr,sc)=>{let b=null,bs=-1e9;for(const i of arr){const s=sc(i)+rb(i);if(s>bs){bs=s;b=i}}return take(b)};
// suits rotate (least recently worn first); season and formality can override a few days of rest
const top=best(pool(suitDay?'suit':'blazer','top'),i=>Math.min(rest(i),14)*3+seasonFit(i,day.clim.season)*2+(day.formal?formalTop(i)*2:0));
// trousers, shirt and tie are scored together as one outfit. Rotation only chooses among outfits within 5 points
// of the best one, so variety never costs a clearly better combination.
// Large wardrobes: keep only the 4 best trousers and 10 best shirts for this jacket (rotation included), then try every tie.
const topN=(arr,n,f)=>arr.length<=n?arr:arr.map(i=>[f(i)+rb(i),i]).sort((a,b)=>b[0]-a[0]).slice(0,n).map(x=>x[1]);
const Ps=suitDay?[null]:topN(pool('pants','bot'),4,pt=>pairScore(top,pt)),Ss=topN(pool('shirt','shirt'),10,sh=>shirtScore(top,sh)+patternScore([[top,'top'],[sh,'shirt']])),Ts=pool('tie','tie'),cands=[];
for(const pt of Ps.length?Ps:[null])for(const sh of Ss.length?Ss:[null])for(const x of Ts.length?Ts:[null]){
  const q=clothesScore(top,suitDay?top:pt,sh,x,suitDay,day);
  cands.push({q,pt,sh,x,r:(pt?rb(pt):0)+(sh?rb(sh):0)+(x?rb(x):0)});
}
const qmax=Math.max(...cands.map(c=>c.q)),pick1=cands.filter(c=>c.q>=qmax-5).sort((a,b)=>(b.q+1.5*b.r)-(a.q+1.5*a.r))[0];
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
const clip=best(pool('tieclip','clip'),metalPref);
// cufflinks only (and always) with French cuffs
const french=shirt&&shirt.cuff==='french',links=french?best(pool('cufflinks','links'),metalPref):null;
// coat when the forecast (or the season) calls for one: raincoat for rain unless it's very cold, otherwise an overcoat
const clim=day.clim,needCoat=clim.cold||clim.rain,prefer=clim.rain&&!clim.veryCold?'raincoat':'overcoat';
const coat=needCoat?best([...pool('overcoat','coat'),...pool('raincoat','coat')],c=>(c.type===prefer?10:0)+seasonFit(c,clim.season)+(['navy','charcoal','tan','grey','black'].includes(pcol(c))?3:0)+(shoes&&pcol(c)==='black'&&leatherGroup(primaryCol(shoes))!=='black'?-4:0)):null;
// say so when the wardrobe can't make a correct combination, instead of silently mismatching
const notes=[];
// clothing: only reached when the wardrobe had no compliant combination for this jacket
if(shirt&&tie&&LUM(shirt)-LUM(tie)<25)notes.push(`The ${nm(tie)} isn't darker than the ${nm(shirt)}; no darker tie suited this outfit. A darker tie would look sharper.`);
if(top&&shirt&&LUM(shirt)<LUM(top)+20)notes.push(`The ${nm(shirt)} is darker than the jacket. A lighter shirt would look more professional.`);
if([[top,'top'],[suitDay?null:bot,'bot'],[shirt,'shirt'],[tie,'tie']].filter(([i,r])=>patInfo(i,r)).length>=3)notes.push('Three bold patterns today; there was no quieter combination. A solid shirt or tie would calm it down.');
if(shoes&&bot&&shoeScore(top,bot,shoes)<=-50)notes.push(`None of your shoes suit ${primaryCol(bot)} trousers.`);
if(shoes&&finish(shoes.leather)==='patent')notes.push('Only patent shoes were available. Patent is for black tie.');
if(shoes&&B.length&&!belt)notes.push(`None of your belts match the ${desc(shoes)} shoes. Add a ${leatherGroup(primaryCol(shoes))} ${finish(shoes.leather)==='suede'?'suede':'smooth leather'} belt.`);
if(watch&&belt&&metalOf(watch)!==metalOf(belt))notes.push(`The watch (${metalOf(watch)}) and belt buckle (${metalOf(belt)}) are different metals.`);
if(french&&!links)notes.push('French-cuff shirt, but no cufflinks in your wardrobe. Add a pair.');
if(clim.rain&&shoes&&finish(shoes.leather)==='suede')notes.push('Rain is forecast and only suede shoes suited this outfit. Smooth leather would hold up better.');
if(needCoat&&!coat)notes.push(clim.rain?'Rain is forecast and there is no raincoat in your wardrobe.':'It will be cold and there is no overcoat in your wardrobe.');
if(top&&seasonFit(top,clim.season)<-10)notes.push(`The ${nm(top)} is a ${itemSeason(top)}-weather piece on a ${clim.season} day; no better suit was available.`);
return{suitDay,top,bot,shirt,tie,shoes,belt,socks,watch,clip,links,coat,notes,clim,formal:!!day.formal}}
/* ---- outfit score ----
   A readable 0-100 rating of the planned outfit against the same rules the planner uses.
   Each check earns points out of a maximum; checks that don't apply (no belt owned, suit days have no separate trousers)
   are left out, and the score is the share of available points earned. */
function rateOutfit(o){
  const nice=t=>String(t||'').replace(/lightblue/g,'light blue').replace(/lightgrey/g,'light grey').replace(/darkgrey/g,'dark grey');
  const C=[],add=(label,pts,max,why)=>C.push({label,pts:Math.max(0,Math.min(max,pts)),max,why:pts<max?nice(why):''});
  const {top,shirt,tie,shoes,belt,socks,watch,clip}=o,bot=o.suitDay?null:o.bot,trousers=o.bot||top;
  if(shirt){const raw=primaryCol(shirt);let v=({white:10,lightblue:10,pink:8,cream:8,lightgrey:7,blue:6})[raw]??2,why=v<10?`a ${raw} shirt is less classic than white or light blue`:'';
    if(top&&pcol(shirt)===pcol(top)){v=0;why='shirt is the same colour as the jacket'}
    else if(top&&LUM(shirt)<LUM(top)+20){v-=5;why='shirt is darker than the jacket'}
    if(shirt.cuff==='french'&&!o.links){v-=5;why=(why?why+'; ':'')+'French cuffs without cufflinks'}
    add('Shirt',v,10,why)}
  if(shirt&&tie){const raw=primaryCol(shirt),d=LUM(shirt)-LUM(tie);let v=0,why=[];
    if(d>=25)v+=8;else why.push('tie is not darker than the shirt');
    if(pcol(tie)!==pcol(shirt))v+=2;else why.push('tie and shirt are the same colour');
    if(raw==='white'||!TIE_ON_SHIRT[raw]||TIE_ON_SHIRT[raw].includes(pcol(tie)))v+=5;else{v+=1;why.push(`${primaryCol(tie)} is an unusual tie colour on a ${raw} shirt`)}
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
  if(rec.worn!==false)for(const s of SLOTS)if(o[s])last[o[s].id]=n;
  return o;
}
function buildPlan(y,m){const by=t=>items.filter(i=>i.type===t).sort((a,b)=>a.id<b.id?-1:1),last={},plan={},T=todayDate();
const hasLinks=by('cufflinks').length>0;
for(const d=new Date(y,m,-13);d<=new Date(y,m+1,0);d.setDate(d.getDate()+1)){const w=d.getDay();if(!settings.workdays.includes(w))continue;
  const k=key(d),rec=dayRecs[k];
  if(rec&&rec.ids&&(d<T||rec.worn===true)){plan[k]=frozenOutfit(rec,di(d),last);continue}
  const formal=!!(rec&&rec.formal),o=outfit(formal||!settings.blazerDays.includes(w),di(d),by,last,rec,{formal,clim:dayClimate(d),hasLinks});o.overrides=!!(rec&&(rec.force||rec.skip));o.worn=rec&&rec.worn;plan[k]=o}
return plan}

