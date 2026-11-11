/* Daily Wardrobe: shared constants and item helpers (no DOM access; also loaded by the analysis worker) */
const TYPES={suit:'Suit',blazer:'Blazer',pants:'Dress pants',shirt:'Dress shirt',tie:'Tie',tieclip:'Tie clip',watch:'Watch',shoes:'Shoes',belt:'Belt',socks:'Socks',cufflinks:'Cufflinks',overcoat:'Overcoat',raincoat:'Raincoat'};
const COLORS={black:'#16161a',charcoal:'#3b3f46',darkgrey:'#5e6269',grey:'#8b8f96',midgrey:'#a2a4a8',lightgrey:'#babdc2',white:'#f6f6f3',cream:'#efe4c8',lightblue:'#a9c7e4',blue:'#3f6fb5',steelblue:'#56657f',deepblue:'#26326a',navy:'#1b2a4a',darknavy:'#1c1f2b',slate:'#3a3f4c',brown:'#5a3a22',tan:'#b8946a',khaki:'#c3b091',taupe:'#8b7d6b',deeptaupe:'#5f5449',rust:'#a4502a',olive:'#5b5d36',green:'#2f6b4a',burgundy:'#6d1f2c',wine:'#7d2438',oxblood:'#4a1a1e',red:'#b3262e',purple:'#5d3a7a',pink:'#e3a5b4',gold:'#c9a227',silver:'#c3c6cb'};
/* colours offered only for dress shirts (the planner maps them to a family for other rules) */
const SHIRT_COLORS={mint:'#cfe6d4',paleyellow:'#f1e6ac',ivory:'#f4efde',beige:'#dccbb0',lavender:'#c9bfe2',periwinkle:'#9ea8d4'};
Object.assign(COLORS,SHIRT_COLORS);
const SHIRT_ONLY=Object.keys(SHIRT_COLORS),SHIRT_FALLBACK={mint:'green',paleyellow:'cream',ivory:'cream',beige:'tan',lavender:'purple',periwinkle:'blue'};
const METAL={gold:'#c9a227',silver:'#c3c6cb',other:'#7d8187'},PATS_BY=(()=>{const suiting=['solid','pinstripe','chalk-stripe','herringbone','birdseye','nailhead','sharkskin','houndstooth','glen-check','windowpane','tweed','twill','other'];
  return{suit:suiting,blazer:suiting,pants:suiting,shirt:['solid','stripe','pinstripe','fine-stripe','gingham','tattersall','check','houndstooth','herringbone','oxford','pinpoint','royal-oxford','twill','end-on-end','chambray','dobby','woven','textured','fine-texture','other'],tie:['solid','woven','stripe','polka-dot','paisley','check','tonal-check','foulard','knit','other']}})(),
PAT_ALIAS={suit:{stripe:'pinstripe',check:'glen-check',plaid:'glen-check',texture:'twill'},shirt:{texture:'textured',plaid:'check',hairline:'fine-stripe','hairline-stripe':'fine-stripe','fine-stripes':'fine-stripe','fil-a-fil':'end-on-end','end-to-end':'end-on-end',jacquard:'dobby','pin-point':'pinpoint','royal-oxford-weave':'royal-oxford',poplin:'solid',broadcloth:'solid','fine-textured':'fine-texture','micro-texture':'fine-texture',weave:'woven','basket-weave':'royal-oxford'},tie:{texture:'woven',textured:'woven',weave:'woven','basket-weave':'woven',basketweave:'woven',oxford:'woven','micro-check':'woven',grenadine:'woven',tonal:'tonal-check','tone-on-tone':'tonal-check','tonal-glen-check':'tonal-check','tone-on-tone-check':'tonal-check',dots:'polka-dot',plaid:'check'}},
normPat=(t,p)=>{const l=PATS_BY[t]||['solid'],g=PAT_ALIAS[t==='blazer'||t==='pants'?'suit':t]||{};p=String(p||'').toLowerCase().trim().replace(/[\s_]+/g,'-');return l.includes(p)?p:l.includes(g[p])?g[p]:'solid'},
patLabel=p=>String(p||'').replace(/-/g,' '),
COL_ALIAS={gray:'grey',lightgray:'lightgrey',palegrey:'lightgrey',palegray:'lightgrey',silvergrey:'silver',silvergray:'silver',darkgray:'darkgrey',middlegrey:'midgrey',middlegray:'midgrey',midgray:'midgrey',mediumgrey:'grey',mediumgray:'grey',
  slateblue:'slate',slategrey:'slate',slategray:'slate',slatebluegrey:'slate',darkslatebluegrey:'slate',darkslate:'slate',bluegrey:'slate',bluegray:'slate',
  steel:'steelblue',denimblue:'steelblue',denim:'steelblue',dustyblue:'steelblue',verydarknavy:'darknavy',navyblack:'darknavy',inkblue:'darknavy',ink:'darknavy',sapphire:'deepblue',
  lightblue:'lightblue',skyblue:'lightblue',babyblue:'lightblue',paleblue:'lightblue',powderblue:'lightblue',royalblue:'blue',cobalt:'blue',
  lightyellow:'paleyellow',butter:'paleyellow',lemon:'paleyellow',eggshell:'ivory',lilac:'lavender',cornflower:'periwinkle',cornflowerblue:'periwinkle',darkblue:'navy',navyblue:'navy',midnightblue:'navy',midnight:'navy',ivory:'cream',offwhite:'cream',ecru:'cream',beige:'tan',khaki:'khaki',chino:'khaki',stone:'khaki',camel:'tan',sand:'tan',taupe:'taupe',mushroom:'taupe',greige:'taupe',deeptaupe:'deeptaupe',darktaupe:'deeptaupe',richtaupe:'deeptaupe',mink:'deeptaupe',rust:'rust',orange:'rust',burntorange:'rust',terracotta:'rust',copper:'rust',mintgreen:'mint',palegreen:'mint',seafoam:'mint',
  darkbrown:'brown',chocolate:'brown',cognac:'brown',maroon:'burgundy',winered:'wine',merlot:'wine',claret:'wine',cordovan:'oxblood',color8:'oxblood',darkred:'burgundy',
  yellow:'gold',mustard:'gold',lavender:'purple',violet:'purple',plum:'purple',rose:'pink',salmon:'pink',teal:'green',emerald:'green',forestgreen:'green',darkgreen:'green',olivegreen:'olive'},
normColFor=(type,c,accent)=>fitCol(type,normCol(c),accent),
normCol=c=>{if(!c)return null;const k=String(c).toLowerCase().replace(/[^a-z]/g,'');if(!k||k==='none'||k==='null')return null;return COLORS[k]?k:COL_ALIAS[k]||null},FABRIC=['suit','blazer','pants','shirt','tie'],COOL=3;
/* colours each item type really comes in: p = main colour, a = stripe / check / motif colours.
   The tagger is told the same lists (worker.js TYPE_COLORS); a colour outside the list is moved to the closest one in it. */
const SUITING=['black','charcoal','darkgrey','grey','midgrey','lightgrey','navy','darknavy','deepblue','blue','steelblue','slate','brown','deeptaupe','taupe','tan','khaki','olive','green'],
  SUIT_LINES=['white','cream','lightgrey','grey','midgrey','charcoal','black','lightblue','blue','navy','deepblue','burgundy','red','rust','brown','tan','green','olive','gold'],
  LEATHER_COLS=['black','brown','tan','oxblood','burgundy','navy','grey','taupe'];
const COLS_BY={
  suit:{p:[...SUITING,'cream'],a:SUIT_LINES},
  blazer:{p:[...SUITING,'cream','burgundy','wine','rust'],a:SUIT_LINES},
  pants:{p:[...SUITING,'cream','lightblue'],a:SUIT_LINES},
  shirt:{p:['white','ivory','cream','paleyellow','beige','pink','lavender','periwinkle','mint','lightblue','blue','steelblue','lightgrey','midgrey','grey','slate','charcoal','navy','darknavy','black','burgundy'],
    a:['white','navy','darknavy','blue','lightblue','steelblue','red','burgundy','pink','lavender','purple','grey','lightgrey','charcoal','black','green','mint','brown','gold']},
  tie:{p:['navy','darknavy','deepblue','blue','steelblue','lightblue','slate','black','charcoal','grey','silver','burgundy','wine','red','pink','purple','lavender','green','olive','brown','tan','gold','rust','cream'],
    a:['white','cream','silver','lightgrey','grey','charcoal','black','navy','deepblue','blue','lightblue','steelblue','burgundy','wine','red','pink','purple','lavender','green','olive','brown','tan','gold','rust']},
  tieclip:{p:['silver','gold','grey','black'],a:['black','white','navy','gold','silver']},
  cufflinks:{p:['silver','gold','grey','black','white','navy','blue','lightblue','burgundy','red','green','purple'],a:['silver','gold','black','white','navy','blue','burgundy','red','green']},
  watch:{p:['black','brown','tan','oxblood','navy','grey','green','silver','gold'],a:['black','brown','white','grey','navy']},
  shoes:{p:LEATHER_COLS,a:['black','brown','tan','white','navy']},
  belt:{p:LEATHER_COLS,a:['black','brown','tan','navy']},
  socks:{p:['black','charcoal','darkgrey','grey','midgrey','navy','darknavy','deepblue','blue','steelblue','slate','brown','taupe','tan','khaki','olive','green','burgundy','wine','red','rust','purple','pink','gold'],
    a:['white','cream','lightgrey','grey','charcoal','black','navy','blue','lightblue','burgundy','red','rust','pink','purple','lavender','green','olive','gold','brown','tan']},
  overcoat:{p:['black','charcoal','darkgrey','grey','midgrey','navy','darknavy','brown','tan','taupe','olive'],a:['black','charcoal','grey','navy','brown','tan','burgundy','green']},
  raincoat:{p:['khaki','tan','taupe','navy','darknavy','black','charcoal','grey','olive'],a:['black','navy','tan','khaki','burgundy','brown']}};
/* watch dials */
const DIAL_COLS=['white','cream','silver','lightgrey','grey','slate','charcoal','black','navy','deepblue','blue','lightblue','green','olive','brown','burgundy','gold'];
const colsFor=(type,accent)=>{const t=COLS_BY[type];return t?(accent?t.a:t.p):Object.keys(COLORS)};
/* the closest allowed colour: the named fallback for shirt colours first, otherwise nearest by (weighted) RGB distance */
function fitCol(type,k,accent){if(!k)return null;const l=colsFor(type,accent);if(l.includes(k))return k;
  const f=SHIRT_FALLBACK[k]||{green:'mint',olive:'mint'}[k];if(f&&l.includes(f))return f;
  const x=labOf(k);let best=l[0],bd=1e9;for(const c of l){const y=labOf(c),d=(x[0]-y[0])**2+1.5*((x[1]-y[1])**2+(x[2]-y[2])**2);if(d<bd){bd=d;best=c}}return best}
/* CIE L*a*b* of a named colour (perceptual distance, so a neutral never lands on a tint) */
function labOf(c){const v=hexRgb(COLORS[c]).map(u=>{u/=255;return u>.04045?((u+.055)/1.055)**2.4:u/12.92});
  const f=t=>t>.008856?Math.cbrt(t):7.787*t+16/116,X=f((v[0]*.4124+v[1]*.3576+v[2]*.1805)/.95047),Y=f(v[0]*.2126+v[1]*.7152+v[2]*.0722),Z=f((v[0]*.0193+v[1]*.1192+v[2]*.9505)/1.08883);
  return [116*Y-16,500*(X-Y),200*(Y-Z)]}
/* CIE L*a*b* of an sRGB colour (0-255), and back to a hex for display */
function rgbLab(r,g,b){const v=[r,g,b].map(u=>{u/=255;return u>.04045?((u+.055)/1.055)**2.4:u/12.92});
  const f=t=>t>.008856?Math.cbrt(t):7.787*t+16/116,X=f((v[0]*.4124+v[1]*.3576+v[2]*.1805)/.95047),Y=f(v[0]*.2126+v[1]*.7152+v[2]*.0722),Z=f((v[0]*.0193+v[1]*.1192+v[2]*.9505)/1.08883);
  return [116*Y-16,500*(X-Y),200*(Y-Z)]}
function labHex([L,a,b]){const fy=(L+16)/116,fx=fy+a/500,fz=fy-b/200,inv=t=>t**3>.008856?t**3:(t-16/116)/7.787;
  const X=inv(fx)*.95047,Y=inv(fy),Z=inv(fz)*1.08883,lin=[X*3.2406-Y*1.5372-Z*.4986,-X*.9689+Y*1.8758+Z*.0415,X*.0557-Y*.2040+Z*1.0570];
  return '#'+lin.map(u=>{u=u>.0031308?1.055*u**(1/2.4)-.055:12.92*u;return Math.round(Math.max(0,Math.min(1,u))*255).toString(16).padStart(2,'0')}).join('')}
/* CIEDE2000 colour difference; kL>1 counts lightness less (a measurement without a white reference) */
function dE00(a,b,kL=1){const [L1,a1,b1]=a,[L2,a2,b2]=b,rad=Math.PI/180,C1=Math.hypot(a1,b1),C2=Math.hypot(a2,b2),Cm=(C1+C2)/2,
  G=.5*(1-Math.sqrt(Cm**7/(Cm**7+25**7))),A1=a1*(1+G),A2=a2*(1+G),c1=Math.hypot(A1,b1),c2=Math.hypot(A2,b2),
  h=(y,x)=>{const t=Math.atan2(y,x)/rad;return t<0?t+360:t},h1=h(b1,A1),h2=h(b2,A2),dL=L2-L1,dC=c2-c1;
  let dh=c1*c2===0?0:h2-h1;if(dh>180)dh-=360;else if(dh<-180)dh+=360;const dH=2*Math.sqrt(c1*c2)*Math.sin(dh*rad/2);
  const Lm=(L1+L2)/2,cm=(c1+c2)/2;let hm=h1+h2;if(c1*c2!==0){if(Math.abs(h1-h2)>180)hm+=hm<360?360:-360;hm/=2}
  const T=1-.17*Math.cos((hm-30)*rad)+.24*Math.cos(2*hm*rad)+.32*Math.cos((3*hm+6)*rad)-.2*Math.cos((4*hm-63)*rad),
    SL=1+.015*(Lm-50)**2/Math.sqrt(20+(Lm-50)**2),SC=1+.045*cm,SH=1+.015*cm*T,RT=-2*Math.sqrt(cm**7/(cm**7+25**7))*Math.sin(60*Math.exp(-(((hm-275)/25)**2))*rad);
  return Math.sqrt((dL/(kL*SL))**2+(dC/SC)**2+(dH/SH)**2+RT*(dC/SC)*(dH/SH))}

/* ---- colours and patterns the owner added (settings.custom = {colors:[{key,name,hex,base,types,accent}],
   patterns:[{key,name,types,base,desc}]}). Each behaves like its base for the outfit rules (colBase/patBase: the planner reads
   planCol/patOf); a colour keeps its own shade for drawing and brightness. Keys: own<letters> / own-<slug>. ---- */
let CUSTOM_COL={},CUSTOM_PAT={};
const colBase=c=>CUSTOM_COL[c]?CUSTOM_COL[c].base:c,patBase=p=>CUSTOM_PAT[p]?CUSTOM_PAT[p].base:p;
const planCol=i=>colBase(primaryCol(i)),patOf=i=>i?patBase(i.pattern):undefined;
const ownColKey=name=>'own'+String(name||'').toLowerCase().replace(/[^a-z]/g,'').slice(0,28);
const ownPatKey=name=>'own-'+String(name||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,28);
function applyCustom(cu){
  for(const k of Object.keys(CUSTOM_COL)){delete COLORS[k];delete COLOR_NAMES[k];delete LUMS[k]}
  for(const t of Object.values(COLS_BY)){t.p=t.p.filter(c=>!CUSTOM_COL[c]);t.a=t.a.filter(c=>!CUSTOM_COL[c])}
  for(const t of Object.keys(PATS_BY))PATS_BY[t]=PATS_BY[t].filter(p=>!CUSTOM_PAT[p]);
  CUSTOM_COL={};CUSTOM_PAT={};cu=cu||{};
  for(const c of cu.colors||[]){if(!/^own[a-z]{1,28}$/.test(c.key)||!/^#[0-9a-f]{6}$/i.test(c.hex||'')||!COLORS[c.base]||CUSTOM_COL[c.base])continue;
    CUSTOM_COL[c.key]=c;COLORS[c.key]=c.hex.toLowerCase();COLOR_NAMES[c.key]=String(c.name||c.key.slice(3)).toLowerCase();
    for(const t of c.types||[])if(COLS_BY[t]){COLS_BY[t].p.push(c.key);if(c.accent)COLS_BY[t].a.push(c.key)}}
  for(const p of cu.patterns||[]){if(!/^own-[a-z0-9-]{1,28}$/.test(p.key))continue;
    for(const t of p.types||[])if(PATS_BY[t]&&PATS_BY[t].includes(p.base)){PATS_BY[t].push(p.key);CUSTOM_PAT[p.key]=p}}}
const patName=p=>CUSTOM_PAT[p]?String(CUSTOM_PAT[p].name).toLowerCase():patLabel(p);
const $=s=>document.querySelector(s),key=d=>d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(),di=d=>Math.round(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/864e5);
let items=[];
/* outfit history (one record per date, see planner.js) and the current date (overridable in tests) */
let dayRecs={},TODAY_OVERRIDE=null;
const todayDate=()=>{const d=TODAY_OVERRIDE?new Date(TODAY_OVERRIDE):new Date();d.setHours(0,0,0,0);return d};
/* an item the user took out of rotation (item.paused) stays in the wardrobe and in past outfits, but the planner never picks it */
/* an item bought but not here yet (item.order) is paused too; with an arrival date (item.arrives, YYYY-MM-DD) it is in rotation for
   every day after that date, so the plan already includes it from then on. n is a day number (di); without one, today. */
const arriveN=i=>{if(!i||!i.arrives)return null;const [y,m,d]=String(i.arrives).split('-').map(Number);return y&&m&&d?di(new Date(y,m-1,d)):null};
const inRotation=(i,n)=>{if(!i)return false;if(!i.paused)return true;const a=arriveN(i);return a!=null&&(n??di(todayDate()))>a};
const SLOTS=['top','bot','shirt','tie','shoes','belt','socks','watch','clip','links','coat'];
/* occasions a day can be given (Settings): each changes what the planner picks. 'formal' is stored as rec.formal (as
   before); the others as rec.occasion. 'casual' = no jacket and no tie: a shirt and trousers. */
const OCCASIONS=[['formal','Formal','dark suit, white shirt, quiet tie'],['wedding','Wedding','a lighter suit, a light shirt and a lively tie, never black'],
  ['funeral','Funeral','the darkest suit, white shirt, black tie, black shoes'],['casual','No jacket or tie','a shirt and trousers']];
const occOf=r=>r?(OCCASIONS.some(o=>o[0]===r.occasion)?r.occasion:r.formal?'formal':null):null;
const occLabel=o=>(OCCASIONS.find(x=>x[0]===o)||[])[1]||'';
const SLOT_TYPE=(s,suitDay)=>({top:suitDay?'suit':'blazer',bot:'pants',clip:'tieclip',links:'cufflinks'})[s]||s;
/* items that can carry a second photo: a close-up of the cloth (its weave and true colour), used for the realistic photos */
const TEXTURE_TYPES=['suit','blazer','pants','shirt','tie'];
const METAL_TYPES=['watch','tieclip','belt','cufflinks'],SEASON_TYPES=['suit','blazer','pants','shirt','tie','overcoat','raincoat'];
const SEASONS=[['all','All year'],['warm','Warm weather'],['cold','Cold weather']],CUFFS=[['button','Button cuffs'],['french','French cuffs']];

/* user settings (stored in IndexedDB meta and synced): which days are workdays, which of those are blazer days,
   temperature units and the weather location */
let settings={workdays:[0,1,2,3,4],blazerDays:[4],units:null,location:null,vestMode:'auto',updated:0};
/* three-piece suits: a suit has a matching vest unless marked 'no'. vestMode: 'auto' (suit days that aren't hot, and
   formal days), 'always' (every suit day) or 'never'; a day can override it. A vest means no tie clip. */
const VESTS=[['yes','Matching vest'],['no','No vest']],VEST_MODES=[['auto','Suit days, except hot ones'],['always','Every suit day'],['never','Never']];
const hasVest=i=>!!i&&i.type==='suit'&&i.vest!=='no';
/* days off: the chosen country's public holidays (settings.holidays: {country, list:[{d:'2026-12-25',n:'Christmas Day'}],
   skip:[dates the user works anyway]}) and the user's own days off (settings.daysOff: [{d, n}]). A day off is planned like
   a weekend: no outfit, and it does not count as worn. offName(d) -> the day's name, or '' on an ordinary day. */
const isoKey=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
let offMemo=null;
function offDays(){const h=settings.holidays,o=settings.daysOff;if(offMemo&&offMemo.h===h&&offMemo.o===o)return offMemo.map;
  const map={},skip=new Set(h&&h.skip||[]);for(const x of h&&h.list||[])if(x&&x.d&&!skip.has(x.d))map[x.d]=map[x.d]?map[x.d]+', '+x.n:x.n||'Public holiday';
  for(const x of o||[])if(x&&x.d)map[x.d]=x.n||map[x.d]||'Day off';
  offMemo={h,o,map};return map}
const offName=d=>offDays()[isoKey(d)]||'';
const isWorkday=d=>settings.workdays.includes(d.getDay())&&!offName(d);
const DAY_NAMES=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
/* forecast by date key: {tmax,tmin,pop,rain,code} in °C, filled from Open-Meteo by app.js */
let weather={};
/* the usual weather of each month at the location: 12 × {tmax, tmin, rainDays}, averaged from the last two years (null until
   it is known); used for days beyond the forecast, so a hot or mild climate is not planned by a temperate calendar */
let climate=null;
/* the day's climate: from the forecast when there is one, otherwise from the location's usual weather for the month, and
   failing that from the calendar (hemisphere from the location) */
function dayClimate(d){
  const w=weather[key(d)];
  if(w){const t=w.tmax;return {wx:w,season:t>=24?'warm':t<=12?'cold':'mild',rain:(w.pop||0)>=40||(w.rain||0)>=1,cold:t<10,veryCold:t<4}}
  // no forecast that far ahead: the month's usual weather at the location (see loadClimate in app.js), judged like a forecast
  const n=climate&&climate[d.getMonth()];
  if(n&&typeof n.tmax==='number'){const t=n.tmax;return {wx:null,norm:n,season:t>=24?'warm':t<=12?'cold':'mild',rain:false,cold:t<10,veryCold:t<4}}
  const south=settings.location&&settings.location.lat<0,m=(d.getMonth()+(south?6:0))%12;
  const season=[11,0,1].includes(m)?'cold':[5,6,7].includes(m)?'warm':'mild';
  return {wx:null,season,rain:false,cold:season==='cold',veryCold:false};
}
const itemSeason=i=>i&&(i.season||(i.pattern==='tweed'?'cold':'all'));
const seasonFit=(i,season)=>{const s=itemSeason(i);if(!i||!s||s==='all'||s===season)return 0;return season==='mild'?-4:-15};

/* matching logic & helpers */
const primaryCol=i=>i?i.primaryColor||i.color||'grey':'grey';
/* display names for colours: 'lightblue' -> 'light blue' (the keys themselves stay as they are) */
const COLOR_NAMES={paleyellow:'pale yellow',lightblue:'light blue',lightgrey:'light grey',darkgrey:'dark grey',midgrey:'mid grey',steelblue:'steel blue',deepblue:'deep blue',deeptaupe:'deep taupe',darknavy:'very dark navy',slate:'dark slate blue-grey'};
const colName=c=>COLOR_NAMES[c]||c;
// (a key that appears in its own spelled-out name, like slate in 'dark slate blue-grey', is not expanded twice)
const COLOR_NAME_RE=new RegExp('(?<!dark )\\b('+Object.keys(COLOR_NAMES).join('|')+')\\b(?! blue-grey)','g');
const prettyCols=t=>String(t??'').replace(COLOR_NAME_RE,m=>COLOR_NAMES[m]);
/* the dropdown for a type; a colour an existing item already has is always kept in its own list */
const COLOR_OPTS=(type,cur,accent)=>{const l=colsFor(type,accent);return (cur&&COLORS[cur]&&!l.includes(cur)?[...l,cur]:l).map(c=>[c,colName(c)])},
  DIAL_OPTS=cur=>(cur&&COLORS[cur]&&!DIAL_COLS.includes(cur)?[...DIAL_COLS,cur]:DIAL_COLS).map(c=>[c,colName(c)]);
/* socks: the secondary colour is a contrasting toe cap, not a pattern colour */
const sockToe=i=>i&&i.type==='socks'&&i.secondaryColor&&i.secondaryColor!=='none'&&COLORS[i.secondaryColor]&&i.secondaryColor!==primaryCol(i)?i.secondaryColor:null;
const colorDesc = i => {
  if(!i) return '';
  if(i.type==='socks')return colName(primaryCol(i))+(sockToe(i)?`, ${colName(sockToe(i)).toLowerCase()} toe`:'');
  let cols=[primaryCol(i)];
  if(i.secondaryColor&&i.secondaryColor!=='none') cols.push(i.secondaryColor);
  if(i.tertiaryColor&&i.tertiaryColor!=='none') cols.push(i.tertiaryColor);
  return cols.map(colName).join(' & ');
};
const desc=i=>i?((i.type==='watch'&&watchOpts(i).band!=='leather')||i.type==='cufflinks'||i.type==='tieclip'?'':colorDesc(i))+(i.pattern&&i.pattern!=='solid'?' '+patName(i.pattern):'')+(i.type==='shoes'||i.type==='belt'?' '+patLabel(i.leather||'calf'):'')+(i.metal?((i.type==='watch'&&watchOpts(i).band!=='leather')||i.type==='cufflinks'||i.type==='tieclip'?'':' · ')+i.metal:'')+(i.type==='watch'?`${watchOpts(i).style==='chronograph'?' chronograph':''} · ${watchOpts(i).dial} dial · ${({bracelet:'bracelet',integrated:'integrated bracelet',leather:'leather strap'})[watchOpts(i).band]||watchOpts(i).band}`:'')+(i.cuff==='french'?' · French cuffs':'')+(i.season&&i.season!=='all'?` · ${i.season} weather`:''):'';
const nm=i=>i?colorDesc(i)+(i.pattern&&i.pattern!=='solid'&&i.pattern!=='other'?' '+patLabel(i.pattern):'')+' '+(TYPES[i.type]||'item').toLowerCase():'none';
const bg=i=>i?(i.swatch?`url(${i.swatch})`:COLORS[primaryCol(i)]||METAL[i.metal]||'#ccc'):'#ccc';

/* brightness of a named colour (0-255), worked out once per colour: the planner asks tens of thousands of times a month */
const LUMS={},lumCol=c=>{let v=LUMS[c];if(v===undefined){const h=COLORS[c];v=LUMS[c]=h?parseInt(h.slice(1,3),16)*.3+parseInt(h.slice(3,5),16)*.59+parseInt(h.slice(5,7),16)*.11:128}return v};
const LUM=i=>lumCol(primaryCol(i));
const WEAVES=['texture','twill','herringbone','birdseye','nailhead','sharkskin','tweed','oxford','knit'];
const pw=i=>!i||!i.pattern||i.pattern==='solid'?0:WEAVES.includes(i.pattern)?.5:1;

// accepts #rgb and #rrggbb (the 3-digit form used to yield NaN, which rendered as black)
const hexRgb=h=>{h=String(h).replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)||0)};
const rgbHex=a=>'#'+a.map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');
const lum=h=>{const [r,g,b]=hexRgb(h);return (.2126*r+.7152*g+.0722*b)/255};
const mix=(h,t,k)=>{const a=hexRgb(h),b=hexRgb(t);return rgbHex(a.map((v,i)=>v+(b[i]-v)*k))};
const colOf=i=>COLORS[primaryCol(i)]||'#8b8f96';
const thirdOf=i=>i&&i.tertiaryColor&&COLORS[i.tertiaryColor]||null;
const accentOf=i=>{const s=i&&i.secondaryColor&&COLORS[i.secondaryColor];if(s)return s;const b=colOf(i);return lum(b)>.55?mix(b,'#000',.35):mix(b,'#fff',.45)};

/* accessory option lists */
const LEATHERS=['calf','cordovan','suede','patent','pebble-grain','scotch-grain'];
const WATCH_STYLES=[['annual-calendar','Dual time + annual calendar'],['chronograph','Chronograph: three subdials + date'],['date','Three hands + date'],['no-date','Three hands']];
const BANDS=[['bracelet','Metal bracelet'],['integrated','Integrated metal bracelet'],['leather','Leather strap']],BEZELS=[['fluted','Fluted'],['smooth','Smooth'],['engraved','Polished, engraved numerals']];
/* a watch in words, for picture prompts: the options plus the owner's own details */
const watchText=w=>{const o=watchOpts(w),metal=w.metal==='gold'?'gold':w.metal==='other'?'gunmetal':'stainless steel';
  const style={'annual-calendar':'dual-time annual-calendar','chronograph':'chronograph (three subdials and a date window)','date':'three-hand date','no-date':'three-hand'}[o.style]||'';
  const bezel={fluted:'a fluted bezel',smooth:'a smooth polished bezel',engraved:'a polished bezel engraved with numerals'}[o.bezel]||'';
  const band=o.band==='leather'?`a ${colName(primaryCol(w))} leather strap`:o.band==='integrated'?`an integrated ${metal} bracelet that flows out of the case`:`a ${metal} link bracelet`;
  return `a ${metal} ${style} wristwatch with ${bezel}, a ${colName(o.dial)} dial and ${band}`+(w.details?` (${String(w.details).trim()})`:'')};
const watchOpts=w=>({dial:w&&w.dial||'white',band:w&&w.band||'bracelet',bezel:w&&w.bezel||'fluted',style:w&&w.watchStyle||'annual-calendar'});
const METAL_TONES={gold:['#fbefc4','#d4b04a','#8a6d12'],silver:['#f7f8f9','#c4c8cd','#767b82'],other:['#d2d4d7','#868a90','#45494e']};

/* ---- backup / sync merge ----
   Merge two wardrobe snapshots {items, tombstones, days, settings}: the newest version of each item wins, and a deletion
   (tombstone) wins over any older edit. Days (outfit history) merge the same way by date; settings by their timestamp. */
const stamp=i=>i&&(i.updated||i.added)||0;
function mergeState(a,b){
  a=a||{};b=b||{};const items={},tomb={...(a.tombstones||{})};
  for(const [id,t] of Object.entries(b.tombstones||{}))tomb[id]=Math.max(tomb[id]||0,t);
  for(const it of [...(a.items||[]),...(b.items||[])]){const cur=items[it.id];if(!cur||stamp(it)>stamp(cur))items[it.id]=it}
  for(const id of Object.keys(items))if(tomb[id]&&tomb[id]>=stamp(items[id]))delete items[id];
  const cutoff=Date.now()-180*864e5;for(const id of Object.keys(tomb))if(tomb[id]<cutoff)delete tomb[id];   // forget old deletions
  const days={};for(const d of [...(a.days||[]),...(b.days||[])]){const cur=days[d.date];if(!cur||(d.updated||0)>(cur.updated||0))days[d.date]=d}
  const settings=a.settings&&b.settings?((a.settings.updated||0)>=(b.settings.updated||0)?a.settings:b.settings):(a.settings||b.settings||null);
  return {items:Object.values(items),tombstones:tomb,days:Object.values(days),settings};
}
/* compact fingerprint of a snapshot, to tell whether a merge changed anything */
function stateSig(s){
  s=s||{};const by=(arr,k,v)=>(arr||[]).map(x=>x[k]+':'+v(x)).sort().join(',');
  return [by(s.items,'id',stamp),Object.entries(s.tombstones||{}).map(e=>e.join(':')).sort().join(','),by(s.days,'date',d=>d.updated||0),s.settings?s.settings.updated||0:''].join('|');
}
