/* Daily Wardrobe: shared constants and item helpers (no DOM access; also loaded by the analysis worker) */
const TYPES={suit:'Suit',blazer:'Blazer',pants:'Pants',shirt:'Dress shirt',tie:'Tie',tieclip:'Tie clip',watch:'Watch',shoes:'Shoes',belt:'Belt',socks:'Socks',cufflinks:'Cufflinks',overcoat:'Overcoat',raincoat:'Raincoat'};
const COLORS={stone:'#cbbfa3',denim:'#3e5c86',black:'#16161a',charcoal:'#3b3f46',darkgrey:'#5e6269',grey:'#8b8f96',midgrey:'#a2a4a8',lightgrey:'#babdc2',white:'#f6f6f3',cream:'#efe4c8',lightblue:'#a9c7e4',blue:'#3f6fb5',steelblue:'#56657f',deepblue:'#26326a',navy:'#1b2a4a',darknavy:'#1c1f2b',slate:'#3a3f4c',brown:'#5a3a22',tan:'#b8946a',khaki:'#c3b091',taupe:'#8b7d6b',deeptaupe:'#5f5449',rust:'#a4502a',olive:'#5b5d36',green:'#2f6b4a',burgundy:'#6d1f2c',wine:'#7d2438',oxblood:'#4a1a1e',red:'#b3262e',purple:'#5d3a7a',pink:'#e3a5b4',gold:'#c9a227',silver:'#c3c6cb',rosegold:'#c98f7a',gunmetal:'#55595f'};
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
  steel:'steelblue',denimblue:'steelblue',dustyblue:'steelblue',verydarknavy:'darknavy',navyblack:'darknavy',inkblue:'darknavy',ink:'darknavy',sapphire:'deepblue',
  skyblue:'lightblue',babyblue:'lightblue',paleblue:'lightblue',powderblue:'lightblue',royalblue:'blue',cobalt:'blue',
  lightyellow:'paleyellow',butter:'paleyellow',lemon:'paleyellow',eggshell:'ivory',lilac:'lavender',cornflower:'periwinkle',cornflowerblue:'periwinkle',darkblue:'navy',navyblue:'navy',midnightblue:'navy',midnight:'navy',offwhite:'cream',ecru:'cream',chino:'khaki',camel:'tan',sand:'tan',mushroom:'taupe',greige:'taupe',darktaupe:'deeptaupe',richtaupe:'deeptaupe',mink:'deeptaupe',orange:'rust',burntorange:'rust',terracotta:'rust',copper:'rust',mintgreen:'mint',palegreen:'mint',seafoam:'mint',
  darkbrown:'brown',chocolate:'brown',cognac:'brown',maroon:'burgundy',winered:'wine',merlot:'wine',claret:'wine',cordovan:'oxblood',color8:'oxblood',darkred:'burgundy',
  yellow:'gold',mustard:'gold',violet:'purple',plum:'purple',rose:'pink',salmon:'pink',teal:'green',emerald:'green',forestgreen:'green',darkgreen:'green',olivegreen:'olive'},
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
  pants:{p:[...SUITING,'cream','lightblue','stone','denim'],a:SUIT_LINES},
  shirt:{p:['white','ivory','cream','paleyellow','beige','pink','lavender','periwinkle','mint','lightblue','blue','steelblue','lightgrey','midgrey','grey','slate','charcoal','navy','darknavy','black','burgundy'],
    a:['white','navy','darknavy','blue','lightblue','steelblue','red','burgundy','pink','lavender','purple','grey','lightgrey','charcoal','black','green','mint','brown','gold']},
  tie:{p:['navy','darknavy','deepblue','blue','steelblue','lightblue','slate','black','charcoal','grey','silver','burgundy','wine','red','pink','purple','lavender','green','olive','brown','tan','gold','rust','cream'],
    a:['white','cream','silver','lightgrey','grey','charcoal','black','navy','deepblue','blue','lightblue','steelblue','burgundy','wine','red','pink','purple','lavender','green','olive','brown','tan','gold','rust']},
  tieclip:{p:['silver','gold','rosegold','gunmetal','grey','black','white','red','blue','navy'],a:['black','white','silver','gold','navy','red','blue']},   // a tie clip is its colour (no metal field): plated, polished or enamel, as clips are sold
  cufflinks:{p:['silver','gold','grey','black','white','navy','blue','lightblue','burgundy','red','green','purple'],a:['silver','gold','black','white','navy','blue','burgundy','red','green']},
  watch:{p:['black','brown','tan','oxblood','navy','grey','green','silver','gold'],a:['black','brown','white','grey','navy']},
  shoes:{p:[...LEATHER_COLS,'white','cream'],a:['black','brown','tan','white','navy','cream','grey']},   // white and cream: sneakers (the planner keeps them off dress outfits); the second colour is a sneaker's sole
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
/* what an own colour's or pattern's name may contain (2026-11-15, the re-audit's N4: a name like `<img src=x onerror=…>` went into the page
   as HTML, ran, and synced to every device): letters of any script, digits, spaces and - ’ . , ( ) / +; a straight apostrophe becomes ’ and
   & "and". ownNameBad refuses a typed name with anything else; ownNameClean is applied to every name shown (applyCustom: one arriving by
   sync or saved before this rule too), so no own name can carry < > " ' & or a backtick into the page */
const OWN_NAME_OK=/^[\p{L}\p{M}\p{N} ’.,()\/+-]*$/u;
const ownNameTidy=s=>String(s==null?'':s).normalize('NFC').replace(/['‘`´]/g,'’').replace(/\s*&\s*/g,' and ').replace(/\s+/g,' ').trim();
const ownNameBad=s=>!OWN_NAME_OK.test(ownNameTidy(s));
const ownNameClean=(s,max=28)=>ownNameTidy(s).replace(/[^\p{L}\p{M}\p{N} ’.,()\/+-]/gu,' ').replace(/\s+/g,' ').trim().slice(0,max);
const ownDescClean=s=>String(s==null?'':s).replace(/[<>"'`&]/g,' ').replace(/\s+/g,' ').trim().slice(0,150);
function applyCustom(cu){
  for(const k of Object.keys(CUSTOM_COL)){delete COLORS[k];delete COLOR_NAMES[k];delete LUMS[k]}
  for(const t of Object.values(COLS_BY)){t.p=t.p.filter(c=>!CUSTOM_COL[c]);t.a=t.a.filter(c=>!CUSTOM_COL[c])}
  for(const t of Object.keys(PATS_BY))PATS_BY[t]=PATS_BY[t].filter(p=>!CUSTOM_PAT[p]);
  CUSTOM_COL={};CUSTOM_PAT={};cu=cu||{};
  for(let c of cu.colors||[]){if(!/^own[a-z]{1,28}$/.test(c.key)||!/^#[0-9a-f]{6}$/i.test(c.hex||'')||!COLORS[c.base]||CUSTOM_COL[c.base])continue;
    const name=ownNameClean(c.name)||c.key.slice(3);c={...c,name};
    CUSTOM_COL[c.key]=c;COLORS[c.key]=c.hex.toLowerCase();COLOR_NAMES[c.key]=name.toLowerCase();
    for(const t of c.types||[])if(COLS_BY[t]){COLS_BY[t].p.push(c.key);if(c.accent)COLS_BY[t].a.push(c.key)}}
  for(let p of cu.patterns||[]){if(!/^own-[a-z0-9-]{1,28}$/.test(p.key))continue;p={...p,name:ownNameClean(p.name)||p.key.slice(4).replace(/-/g,' '),desc:ownDescClean(p.desc)};
    for(const t of p.types||[])if(PATS_BY[t]&&PATS_BY[t].includes(p.base)){PATS_BY[t].push(p.key);CUSTOM_PAT[p.key]=p}}
  COLOR_NAME_RE=null}
const patName=p=>CUSTOM_PAT[p]?String(CUSTOM_PAT[p].name).toLowerCase():patLabel(p);
/* the built-in colour an own shade behaves like (its base), when Claude didn't give one: from the item type's own list (main or
   stripe/motif colours), by colour family before distance (2026-11-15, the new-colour design: by ΔE alone over every key, petrol blue
   planned as charcoal, cognac as rust, neon green as stone, smoky lavender as light grey). A colourful shade takes the list's colours of
   a hue within BASE_HUE degrees (else BASE_HUE2), a near-neutral one the list's neutrals; of those, the ones within BASE_L of its lightness;
   then the nearest by ΔE00. worker/describe.js baseFor is the same rule for Claude's answers */
const BASE_HUE=45,BASE_HUE2=80,BASE_L=25,BASE_GREY=9;
function colBaseFor(hex,type,accent){const lab=rgbLab(...hexRgb(hex)),lch=l=>[Math.hypot(l[1],l[2]),(Math.atan2(l[2],l[1])*180/Math.PI+360)%360],[C,h]=lch(lab);
  const hd=(a,b)=>{const d=Math.abs(a-b)%360;return d>180?360-d:d},typed=!!(type&&COLS_BY[type]);
  const cand=(typed?colsFor(type,accent):Object.keys(COLORS)).filter(c=>COLORS[c]&&!CUSTOM_COL[c]&&(typed||!SHIRT_ONLY.includes(c))).map(k=>{const l=labOf(k),[c2,h2]=lch(l);return {k,l,c2,h2,d:dE00(lab,l)}});
  if(!cand.length)return null;
  let pool=C<BASE_GREY?cand.filter(x=>x.c2<Math.max(5,C+3)):cand.filter(x=>x.c2>=6&&hd(x.h2,h)<=BASE_HUE);
  if(!pool.length&&C>=BASE_GREY)pool=cand.filter(x=>x.c2>=6&&hd(x.h2,h)<=BASE_HUE2);
  if(!pool.length)pool=cand;
  const near=pool.filter(x=>Math.abs(x.l[0]-lab[0])<=BASE_L);if(near.length)pool=near;
  return pool.sort((a,b)=>a.d-b.d)[0].k}
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
  ['funeral','Funeral','the darkest suit, white shirt, black tie, black shoes'],['casual','No jacket or tie','a shirt and pants']];
const occOf=r=>r?(OCCASIONS.some(o=>o[0]===r.occasion)?r.occasion:r.formal?'formal':null):null;
const occLabel=o=>(OCCASIONS.find(x=>x[0]===o)||[])[1]||'';
const SLOT_TYPE=(s,suitDay)=>({top:suitDay?'suit':'blazer',bot:'pants',clip:'tieclip',links:'cufflinks'})[s]||s;
/* items that can carry a second photo: a close-up of the cloth (its weave and true colour), used for the realistic photos */
const TEXTURE_TYPES=['suit','blazer','pants','shirt','tie'];
const METAL_TYPES=['watch','belt','cufflinks'],SEASON_TYPES=['suit','blazer','pants','shirt','tie','overcoat','raincoat'];
/* what an item is made of (item.material): the common choices per type; the dropdown adds Other (typed in) and None. Shoes and
   belts have their leather, watches their band and metal, so they have no list. (2026-11-15, the materials audit and the owner's
   decisions: warm-weather cloths added, shirts hold the fabric only (their weaves are patterns), "performance stretch" for stretch
   shirts, "knitted silk" retired (the knit pattern says it). A name that leaves a list is never lost: it shows as Other with the
   name, and search, season, the painter and import still read it. Must match worker/tag.js MATERIALS_BY) */
const MATERIALS_BY={
  suit:['wool','wool blend','tropical wool','flannel','tweed','linen','linen blend','cotton','seersucker','cashmere','mohair blend','silk blend','moleskin','corduroy','velvet','polyester blend'],
  blazer:['wool','wool blend','tropical wool','flannel','tweed','linen','linen blend','cotton','seersucker','cashmere','camel hair','hopsack','silk blend','jersey','corduroy','velvet','polyester blend'],
  pants:['wool','wool blend','tropical wool','flannel','gabardine','cotton','cotton twill','denim','stretch denim','linen','linen blend','seersucker','moleskin','corduroy','tweed','polyester blend'],
  shirt:['cotton','poplin','linen','linen blend','flannel','cotton blend','performance stretch','seersucker','polyester','polyester blend','silk','rayon','modal','lyocell','bamboo','wool','jersey','denim','corduroy'],
  tie:['silk','grenadine','shantung','wool','wool blend','cashmere','linen','cotton','polyester'],
  socks:['cotton','mercerized cotton','merino wool','wool blend','cashmere blend','bamboo','silk blend','synthetic blend'],
  overcoat:['wool','wool blend','melton','cashmere','cashmere blend','tweed','camel hair','loden','alpaca','cotton'],
  raincoat:['cotton gabardine','waxed cotton','rubberized cotton','nylon','polyester','waterproof shell']};
/* other words for a material (the spreadsheet import and the Wardrobe's search, 2026-11-15, the audit's alias table): word -> the listed
   name, per type where it differs ('*' every type). "fresco" finds and imports as tropical wool, "lisle" as mercerized cotton */
const MAT_ALIAS={'*':{fresco:'tropical wool',tropical:'tropical wool','tropical wool':'tropical wool','high-twist':'tropical wool','high twist':'tropical wool',worsted:'wool','worsted wool':'wool',
    merino:'merino wool',lisle:'mercerized cotton','fil d\'ecosse':'mercerized cotton','fil d’ecosse':'mercerized cotton','fil decosse':'mercerized cotton',broadcloth:'poplin',
    'wool-linen':'linen blend','wool linen':'linen blend','linen-wool':'linen blend','linen wool':'linen blend','linen-cotton':'linen blend','linen cotton':'linen blend','cotton-linen':'linen blend','silk-linen':'linen blend','silk linen':'linen blend',
    'wool-silk':'silk blend','wool silk':'silk blend','silk-wool':'silk blend',camel:'camel hair','camelhair':'camel hair',mohair:'mohair blend','wool-mohair':'mohair blend','wool mohair':'mohair blend',
    'nylon-spandex':'performance stretch','nylon/spandex':'performance stretch','nylon spandex':'performance stretch','poly-spandex':'performance stretch','polyester-spandex':'performance stretch','polyester/spandex':'performance stretch',stretch:'performance stretch',
    'knitted silk':'silk','knit silk':'silk',cord:'corduroy',cords:'corduroy',mackintosh:'rubberized cotton',gaberdine:'gabardine'},
  socks:{nylon:'synthetic blend',polyester:'synthetic blend',wool:'merino wool',stretch:'synthetic blend'},
  raincoat:{gabardine:'cotton gabardine',waxed:'waxed cotton',wax:'waxed cotton'},
  pants:{stretch:'stretch denim'},
  // (polyester is a shirt material of its own since 2026-11-16, the owner's ask: no longer read as performance stretch; nylon still is)
  shirt:{nylon:'performance stretch',viscose:'rayon',tencel:'lyocell',merino:'wool','merino wool':'wool','poly-cotton':'cotton blend',polycotton:'cotton blend','poly cotton':'cotton blend','cotton-polyester':'cotton blend','cotton polyester':'cotton blend',poly:'polyester','poly blend':'polyester blend'}};
/* the listed name a word means for a type ('' when none): the type's own name, else an alias that is on the type's list */
const matAlias=(type,w)=>{const l=MATERIALS_BY[type];if(!l)return '';w=String(w??'').toLowerCase().replace(/\s+/g,' ').trim();if(!w)return '';if(l.includes(w))return w;
  const a=(MAT_ALIAS[type]||{})[w]||MAT_ALIAS['*'][w];return a&&l.includes(a)?a:''};
/* the shirt weaves that left the Material list (they are patterns): on import a weave in the Material column becomes the pattern */
const SHIRT_WEAVE_MAT={twill:'twill',oxford:'oxford','pinpoint oxford':'pinpoint',pinpoint:'pinpoint','royal oxford':'royal-oxford','end-on-end':'end-on-end','end on end':'end-on-end','fil-a-fil':'end-on-end',chambray:'chambray',dobby:'dobby',herringbone:'herringbone'};
const SEASONS=[['all','All year'],['warm','Warm weather'],['cold','Cold weather']],CUFFS=[['button','Button cuffs'],['french','French cuffs']];

/* user settings (stored in IndexedDB meta and synced): which days are workdays, which of those are blazer days,
   temperature units and the weather location */
let settings={workdays:[0,1,2,3,4],blazerDays:[4],units:null,location:null,vestMode:'auto',updated:0};
const SET_DEFAULTS=JSON.parse(JSON.stringify(settings));   // the app's own defaults, for a setting a synced copy marks removed (takeSettings)
/* three-piece suits: a suit may have a matching vest (hasVest). vestMode: 'auto' (suit days that aren't hot, and
   formal days), 'always' (every suit day) or 'never'; a day can override it. A vest means no tie clip. */
const VESTS=[['yes','Matching vest'],['no','No vest']],VEST_MODES=[['auto','Suit days, except hot ones'],['always','Every suit day'],['never','Never']];
/* a suit has a waistcoat only when it says so (vest:'yes'). A wardrobe from before that rule (no settings.vestDef yet: dress.js,
   migrateVests) keeps the old reading, where a suit with no value had one, until its suits have been given their value */
const hasVest=i=>!!i&&i.type==='suit'&&(i.vest==='yes'||(i.vest==null&&!settings.vestDef));
/* the dress code (settings.dress = {jacket, tie}; a missing object or key means yes): does the user wear jackets, ties? */
const wearsJacket=()=>!(settings.dress&&settings.dress.jacket===false);
const wearsTie=()=>!(settings.dress&&settings.dress.tie===false);
/* is an outfit without a jacket (a tie) short of one? Not on a no-jacket day, and not when the dress code leaves it out
   (a formal day, wedding or funeral is dressed in full from what is owned, but nothing is asked for) */
const needsJacket=o=>o.occasion!=='casual'&&!(o.off&&o.off.top)&&wearsJacket();   // (o.off: taken off on Today, see takeOff in planner.js)
const needsTie=o=>o.occasion!=='casual'&&!(o.off&&o.off.tie)&&wearsTie();
/* an item type the dress code leaves out: never planned on an ordinary day, so not counted as unused and not suggested */
const dressOut=t=>(!wearsTie()&&(t==='tie'||t==='tieclip'))||(!wearsJacket()&&(t==='suit'||t==='blazer'));
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
  // no location: the holiday country (chosen from the phone's time zone at setup) gives a hot climate's usual highs and the hemisphere
  // (2026-11-15, the audit: a Kuwait phone with no location was told in December to get an overcoat, Sydney's January was winter)
  // with a location but no usual weather yet (its climate history failed to load: offline at setup, the service busy), the location's
  // country is used the same way (fix round 3, W1-1-05 = W2-16-03: a Kuwait December was planned as winter, with an overcoat)
  const L=settings.location,hc=settings.holidays&&settings.holidays.country,cc=L?(L.cc?String(L.cc).toUpperCase():hc):hc,ht=cc&&CC_TMAX[cc];
  if(ht){const t=ht[d.getMonth()];return {wx:null,season:t>=24?'warm':t<=12?'cold':'mild',rain:false,cold:t<10,veryCold:t<4}}
  const south=settings.location?settings.location.lat<0:SOUTH_CC.includes(cc),m=(d.getMonth()+(south?6:0))%12;
  const season=[11,0,1].includes(m)?'cold':[5,6,7].includes(m)?'warm':'mild';
  return {wx:null,season,rain:false,cold:season==='cold',veryCold:false};
}
/* usual monthly highs (°C) of the Gulf countries, for a phone with no location (dayClimate), and the southern hemisphere's countries */
const CC_TMAX={KW:[19,22,27,34,41,46,47,47,44,37,28,21],SA:[20,23,28,33,39,42,43,43,40,34,27,22],AE:[24,25,28,33,38,40,41,41,39,35,30,26],QA:[22,24,28,33,39,42,42,42,39,35,29,24],
  BH:[20,22,25,30,35,38,39,39,37,33,27,22],OM:[25,26,29,34,38,39,37,35,35,34,30,27],IQ:[16,19,24,30,37,43,46,46,42,34,24,18]};
const SOUTH_CC=['AU','NZ','ZA','AR','CL','UY','PY','BR','BO','PE','NA','BW','ZW','MZ','MG','LS','SZ','FJ'];
/* an item's season: the one set on it, else from its pattern or material (2026-11-15, the audit: a flannel suit planned on a 29°C day
   with full Weather points); a season chosen in the item sheet ('all' too) wins */
/* (2026-11-15, the materials audit and the owner's decisions) tropical wool warm; cashmere, cashmere blend, moleskin and melton cold; a wool
   tie cold (MAT_SEASON_BY: by type, so a wool suit stays all year); mohair blend and hopsack none */
const MAT_SEASON={flannel:'cold',tweed:'cold',corduroy:'cold',velvet:'cold',cashmere:'cold','cashmere blend':'cold',moleskin:'cold',melton:'cold',
  linen:'warm','linen blend':'warm',seersucker:'warm','tropical wool':'warm'};
const MAT_SEASON_BY={tie:{wool:'cold'}};
const matSeason=i=>{const m=String(i.material||'').toLowerCase().trim();return (MAT_SEASON_BY[i.type]||{})[m]||MAT_SEASON[m]||''};
const itemSeason=i=>i&&(i.season||(i.pattern==='tweed'?'cold':SEASON_TYPES.includes(i.type)&&matSeason(i)||'all'));
const seasonFit=(i,season)=>{const s=itemSeason(i);if(!i||!s||s==='all'||s===season)return 0;return season==='mild'?-4:-15};

/* matching logic & helpers */
const primaryCol=i=>i?i.primaryColor||i.color||'grey':'grey';
/* display names for colours: 'lightblue' -> 'light blue' (the keys themselves stay as they are) */
/* a tie clip's metal, read from its colour (tie clips have no metal field): silver, gold or 'other' (gunmetal), or null for an
   enamel colour (black, red, blue, navy), which goes with any metal */
const clipMetal=i=>{const c=i&&i.primaryColor;return c==='gold'||c==='rosegold'?'gold':['silver','white','lightgrey','midgrey','grey'].includes(c)?'silver':['gunmetal','darkgrey','charcoal'].includes(c)?'other':null};
const COLOR_NAMES={grey:'gray',rosegold:'rose gold',paleyellow:'pale yellow',lightblue:'light blue',lightgrey:'light gray',darkgrey:'dark gray',midgrey:'mid gray',steelblue:'steel blue',deepblue:'deep blue',deeptaupe:'deep taupe',darknavy:'very dark navy',slate:'dark slate blue-gray'};
const colName=c=>COLOR_NAMES[c]||c;
// (a key that appears in its own spelled-out name, like slate in 'dark slate blue-gray', is not expanded twice)
/* built when first needed and again after the owner's colours change (applyCustom): made once at load it never knew them, and the
   photo generator was told "a owntaupe tie" */
let COLOR_NAME_RE=null;
const colourNameRe=()=>COLOR_NAME_RE||(COLOR_NAME_RE=new RegExp('(?<!dark )\\b('+Object.keys(COLOR_NAMES).join('|')+')\\b(?! blue-gray)','g'));
const prettyCols=t=>String(t??'').replace(colourNameRe(),m=>COLOR_NAMES[m]);
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
/* (2026-11-15, the new-user audit) cufflinks are named by their colour and metal ("Light blue · silver"; plain silver links "Silver"), the metal
   'other' is "gunmetal" in words (it read "Other"), a sneaker's leather "leather" (not "calf"), and a season only for a type that has one */
const metalWord=m=>m==='other'?'gunmetal':m==='silk'?'silk knot':m;
METAL['two-tone']='#c8b27e';   // (2026-11-15, the owner's option) steel and gold together: planner metalSame lets it go with either
const METAL_OPTS=Object.keys(METAL).map(c=>[c,metalWord(c)]);
const linkFace=i=>{const c=i&&i.type==='cufflinks'&&primaryCol(i);return c&&COLORS[c]&&c!=='silver'&&c!=='gold'?c:null};   // an enamel or stone face (silver and gold links are all metal)
const desc=i=>i?((i.type==='watch'&&!strapBand(i))||(i.type==='cufflinks'&&!linkFace(i))?'':colorDesc(i))+(i.pattern&&i.pattern!=='solid'?' '+patName(i.pattern):'')+(i.type==='shoes'||i.type==='belt'?' '+leatherWord(i,i.leather||'calf'):'')+(i.metal&&METAL_TYPES.includes(i.type)?((i.type==='watch'&&!strapBand(i))||(i.type==='cufflinks'&&!linkFace(i))?'':' · ')+metalWord(i.metal):'')+(i.type==='watch'?`${watchOpts(i).style==='chronograph'?' chronograph':''} · ${colName(watchOpts(i).dial)} dial ·${BAND_WORDS[watchOpts(i).band]||watchOpts(i).band}`:'')+(i.cuff==='french'?' · French cuffs':'')+(i.season&&i.season!=='all'&&SEASON_TYPES.includes(i.type)?` · ${i.season} weather`:''):'';
const nm=i=>i?colorDesc(i)+(i.pattern&&i.pattern!=='solid'&&i.pattern!=='other'?' '+patLabel(i.pattern):'')+' '+typeWord(i):'none';
/* an item's own name (item.name), and what it is called on screen: the name when it has one, else its colour description
   (the planner's texts keep the description); a name is shown as typed, a description capitalised (titleCls) */
const itemName=i=>i&&typeof i.name==='string'?i.name.trim():'';
const itemTitle=i=>itemName(i)||sentence(desc(i));
const titleCls=i=>itemName(i)?'named':'cap';
/* trousers come in three kinds and shoes in five styles; an item without one is dress trousers or oxfords, which the planner treats
   exactly as before there were kinds and styles (so a wardrobe from before plans the same) */
const TROUSER_KINDS=[['dress','Dress pants'],['chinos','Chinos'],['jeans','Jeans']],SHOE_STYLES=[['oxford','Oxford'],['derby','Derby'],['loafer','Loafer'],['boot','Boot'],['sneaker','Sneaker']];
const trouserKind=i=>i&&i.type==='pants'&&(i.trouserKind==='chinos'||i.trouserKind==='jeans')?i.trouserKind:'dress';
const shoeStyle=i=>i&&i.type==='shoes'&&SHOE_STYLES.some(([k])=>k===i.shoeStyle)?i.shoeStyle:'oxford';
/* the word for the item in descriptions: chinos, jeans, loafers, boots, sneakers, derby shoes; else the type's own */
const typeWord=i=>i&&i.type==='pants'&&trouserKind(i)!=='dress'?trouserKind(i):i&&i.type==='shoes'&&shoeStyle(i)!=='oxford'?({derby:'derby shoes',loafer:'loafers',boot:'boots',sneaker:'sneakers'})[shoeStyle(i)]:(TYPES[i&&i.type]||'item').toLowerCase();
/* one title style everywhere: a description starts with a capital and the rest stays as written ("Navy hopsack suit"); a name the
   user typed is shown exactly as typed. (The .cap class used to capitalise every word, names included.) */
/* an average score as shown: one decimal, rounded down, so it reads 100 only when every day scored 100 (99.6 used to show as 100
   beside a list of what costs points) */
const avgText=v=>v==null||!isFinite(v)?'–':v>=100?'100':(Math.floor(v*10)/10).toFixed(1);
const sentence=t=>{t=String(t??'');return t&&t[0].toUpperCase()+t.slice(1)};
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
/* an item's own shade (item.shade, chosen by the owner to match its close-up): steps of SHADE_STEP L* applied to the drawn main
   colour only; the tag, the planner and the photo prompts keep the tagged colour */
const SHADE_STEP=4,SHADE_MAX=6;
const shadeHex=(h,s)=>{if(!s)return h;const l=rgbLab(...hexRgb(h));return labHex([Math.max(2,Math.min(98,l[0]+s*SHADE_STEP)),l[1],l[2]])};
const shadeFor=(i,lab)=>i&&lab&&COLORS[primaryCol(i)]?Math.max(-SHADE_MAX,Math.min(SHADE_MAX,Math.round((lab[0]-labOf(primaryCol(i))[0])/SHADE_STEP))):0;
const shadeName=s=>!s?'As tagged':`${s<0?'Darker':'Lighter'} ${Math.abs(s)}`;
const colOf=i=>{const h=COLORS[primaryCol(i)]||'#8b8f96';return i&&i.shade?shadeHex(h,i.shade):h};
const thirdOf=i=>i&&i.tertiaryColor&&COLORS[i.tertiaryColor]||null;
const accentOf=i=>{const s=i&&i.secondaryColor&&COLORS[i.secondaryColor];if(s)return s;const b=colOf(i);return lum(b)>.55?mix(b,'#000',.35):mix(b,'#fff',.45)};

/* accessory option lists */
const LEATHERS=['calf','cordovan','suede','patent','pebble-grain','scotch-grain'],SHOE_TEXTILES=['canvas','knit'];
/* the materials a pair of shoes (or a belt) can be in, by style: sneakers in leather, suede, canvas or knit; boots and loafers in the
   leathers they are made of; oxfords, derbies and belts in every leather. The field stays item.leather ("calf" reads "Leather"
   on a sneaker) */
/* (2026-11-15, the owner's accessory options) nubuck (a fine nap, drawn and planned like suede) for derbies, boots and sneakers; a belt
   also in braided leather or canvas (BELT_MATS), so its label is "Material" too */
const SHOE_NAP=['nubuck'],BELT_MATS=['braided','canvas'];
const leathersFor=i=>i&&i.type==='shoes'?({sneaker:['calf','suede','nubuck','canvas','knit'],boot:['calf','suede','nubuck','pebble-grain','scotch-grain','cordovan'],loafer:['calf','suede','patent','cordovan'],derby:[...LEATHERS,'nubuck']})[shoeStyle(i)]||LEATHERS:i&&i.type==='belt'?[...LEATHERS,...BELT_MATS]:LEATHERS;
const leatherWord=(i,l)=>i&&i.type==='shoes'&&shoeStyle(i)==='sneaker'&&l==='calf'?'leather':l==='braided'?'braided leather':patLabel(l);
const leatherLabel=i=>'Material';   // shoes and belts: "Material" (a sneaker can be canvas or knit, a belt canvas)
const WATCH_STYLES=[['annual-calendar','Dual time + annual calendar'],['chronograph','Chronograph: three subdials + date'],['date','Three hands + date'],['no-date','Three hands']];
/* a watch's band: a metal bracelet, or a strap in the item's colour (leather, rubber, a fabric NATO strap: 2026-11-15, the owner's options) */
const BANDS=[['bracelet','Metal bracelet'],['integrated','Integrated metal bracelet'],['leather','Leather strap'],['rubber','Rubber strap'],['nato','Fabric (NATO) strap']],BEZELS=[['fluted','Fluted'],['smooth','Smooth'],['engraved','Polished, engraved numerals']];
const STRAP_BANDS=['leather','rubber','nato'],BAND_WORDS={bracelet:'bracelet',integrated:'integrated bracelet',leather:'leather strap',rubber:'rubber strap',nato:'NATO strap'};
const strapBand=w=>!!w&&STRAP_BANDS.includes(watchOpts(w).band);   // a strap: the watch has a colour (a bracelet is its metal)
/* cufflinks may be silk knots (2026-11-15, the owner's option): no metal, a "metal" of 'silk' offered only to cufflinks (METAL keeps the
   three metals and two-tone); planner metalOf reads it as none, so it goes with any metal */
const LINK_METAL_OPTS=()=>[...METAL_OPTS,['silk','silk knot']];
const metalOptsFor=t=>t==='cufflinks'?LINK_METAL_OPTS():METAL_OPTS;
/* a watch in words, for picture prompts: the options plus the owner's own details. With details the style's stock layout is left out
   (the owner's chronograph tells the time in one large subdial; "three subdials and a date window" got a stock chronograph drawn) */
const watchText=(w,cn=colName)=>{const o=watchOpts(w),metal=w.metal==='gold'?'gold':w.metal==='other'?'gunmetal':w.metal==='two-tone'?'two-tone steel and gold':'stainless steel',det=w.details&&String(w.details).trim();
  const style=(det?{'annual-calendar':'dual-time annual-calendar','chronograph':'chronograph','date':'three-hand date','no-date':'three-hand'}:{'annual-calendar':'dual-time annual-calendar','chronograph':'chronograph (three subdials and a date window)','date':'three-hand date','no-date':'three-hand'})[o.style]||'';
  const bezel={fluted:'a fluted bezel',smooth:'a smooth polished bezel',engraved:'a polished bezel engraved with numerals'}[o.bezel]||'';
  const band=o.band==='leather'?`a ${cn(primaryCol(w))} leather strap`:o.band==='rubber'?`a ${cn(primaryCol(w))} rubber strap`:o.band==='nato'?`a ${cn(primaryCol(w))} woven fabric NATO strap`:o.band==='integrated'?`an integrated ${metal} bracelet that flows out of the case`:`a ${metal} link bracelet`;
  return `a ${metal} ${style} wristwatch with ${bezel}, a ${cn(o.dial)} dial and ${band}`+(det?` (${det})`:'')};
const watchOpts=w=>({dial:w&&w.dial||'white',band:w&&w.band||'bracelet',bezel:w&&w.bezel||'fluted',style:w&&w.watchStyle||'annual-calendar'});
const METAL_TONES={gold:['#fbefc4','#d4b04a','#8a6d12'],silver:['#f7f8f9','#c4c8cd','#767b82'],other:['#d2d4d7','#868a90','#45494e'],'two-tone':['#f8f3e2','#c9b98a','#7d7350']};

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
  const days={};for(const d of [...(a.days||[]),...(b.days||[])]){const cur=days[d.date];if(!cur||(d.updated||0)>(cur.updated||0))days[d.date]=dayWins(cur,d);else days[d.date]=dayWins(d,cur)}
  const settings=a.settings&&b.settings?mergeSettings(a.settings,b.settings):(a.settings||b.settings||null);
  return {items:Object.values(items),tombstones:tomb,days:Object.values(days),settings};
}
/* ---- settings, setting by setting (2026-11-14, the audit: two phones each changing a different setting, the later save dropped the
   other's change, as whole copies won by their one stamp). Each setting has its own stamp (settings.ks) and a fingerprint of the value
   it was stamped with (settings.kh): stampSettings, called wherever the settings are saved, stamps only the settings whose value changed
   since (a new or a removed one too). mergeSettings takes each setting from the copy with the newer stamp for it; a copy saved before
   (no ks) counts its one stamp for every setting, so two old copies merge as before. When the merge takes anything from the copy with the
   older overall stamp, the result's overall stamp is one above both, so it is uploaded (sync.js sends settings newer than the server's)
   and wins on the other devices too. The same rule is in the worker's merge. */
const SET_META=['updated','ks','kh'];
const setHash=v=>{const s=JSON.stringify(v===undefined?null:v);let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)};
const setKeys=s=>Object.keys(s||{}).filter(k=>!SET_META.includes(k));
/* called where the settings are read (start-up, after a sync, Settings): a copy from before gets every setting stamped with its one
   stamp; a setting the copy lacks that only the app's defaults filled in gets stamp 0, so a default never wins over another device's
   choice. Its values are taken as they are, so this must run before anything changes them (stampSettings stamps what changed since) */
function keySettings(s){if(!s)return s;
  if(!s.ks||!s.kh){const was=s.updated||0;s.ks={};s.kh={};for(const k of setKeys(s)){s.ks[k]=was;s.kh[k]=setHash(s[k])}return s}
  for(const k of setKeys(s))if(!(k in s.kh)){s.kh[k]=setHash(s[k]);s.ks[k]=0}return s}
function stampSettings(s,t){t=t||Date.now();if(!s)return s;
  if(!s.ks||!s.kh)keySettings(s);
  for(const k of new Set([...setKeys(s),...Object.keys(s.kh)])){const h=k in s?setHash(s[k]):'-';if(s.kh[k]!==h){s.kh[k]=h;s.ks[k]=t}}
  s.updated=Math.max(t,(s.updated||0)+1);return s}
/* stored or downloaded settings (st) taken over the ones in memory (cur) -> the new in-memory settings, keyed. Spread over them, except
   a setting st marks removed (kh '-': a roll-back to a copy without it, or a removal on another device): it goes from memory too, or, when
   the app has a default for it, back to that default with stamp 0, so it never wins over the removal (2026-11-15, the audit: a roll-back's
   removed day off and holidays stayed in memory, and the next change on that phone stamped them back for every device) */
function takeSettings(cur,st){const s={...cur,...st};
  if(st&&st.kh){let ks=null,kh=null;
    for(const k of Object.keys(st.kh))if(st.kh[k]==='-'&&!(k in st)&&!SET_META.includes(k)){
      if(k in SET_DEFAULTS){if(!ks){ks={...st.ks};kh={...st.kh}}s[k]=JSON.parse(JSON.stringify(SET_DEFAULTS[k]));ks[k]=0;kh[k]=setHash(s[k])}else delete s[k]}
    if(ks){s.ks=ks;s.kh=kh}}
  return keySettings(s)}
/* every setting stamped t (a roll-back or restore: the restored copy wins every setting on every device) */
function stampAllSettings(s,t){if(!s)return s;s.ks={};s.kh={};for(const k of setKeys(s)){s.ks[k]=t;s.kh[k]=setHash(s[k])}s.updated=t;return s}
const setStampOf=(s,k)=>s.ks?(s.ks[k]||0):(s.updated||0);
function mergeSettings(a,b){
  const ua=a.updated||0,ub=b.updated||0,hi=ua>=ub?a:b;if(!a.ks&&!b.ks)return keySettings({...hi});   // two copies from before: the newer whole, as always
  const out={},ks={},kh={};let mixed=false;
  for(const k of new Set([...setKeys(a),...setKeys(b),...Object.keys(a.ks||{}),...Object.keys(b.ks||{})])){
    const sa=setStampOf(a,k),sb=setStampOf(b,k),w=sa===sb?hi:sa>sb?a:b;
    if(w!==hi&&setHash(w[k])!==setHash(hi[k]))mixed=true;
    if(k in w)out[k]=w[k];ks[k]=Math.max(sa,sb);kh[k]=w.kh&&w.kh[k]||setHash(w[k])}
  out.ks=ks;out.kh=kh;out.updated=mixed?Math.max(ua,ub)+1:Math.max(ua,ub);
  return mixed?out:(hi.ks?hi:Object.assign(out,{updated:hi.updated||0}))}
/* of two copies of a day, the newer (n) wins, unless it is only the app's lock of the week (app.js lockUpcoming: lockOnly, base = the
   version of the record it was built on) and the older (o) was changed after that version: then the older wins whole, with its own
   lock or none, and the app locks the day again around it (2026-11-14: a phone two days behind locked Nov 17 on its old copy and its
   newer stamp replaced the owner's pick made on another device). The same rule in worker.js mergeLite. */
/* (when the older is itself only a lock, what counts is the version it was built on: two locks of one day don't override each other's
   base, so the newer lock wins unless the older was built on a newer version) */
const dayWins=(o,n)=>!o||o===n||!n.lockOnly?n:((o.lockOnly?o.base:o.updated)||0)>(n.base||0)?o:n;
/* compact fingerprint of a snapshot, to tell whether a merge changed anything */
function stateSig(s){
  s=s||{};const by=(arr,k,v)=>(arr||[]).map(x=>x[k]+':'+v(x)).sort().join(',');
  return [by(s.items,'id',stamp),Object.entries(s.tombstones||{}).map(e=>e.join(':')).sort().join(','),by(s.days,'date',d=>d.updated||0),s.settings?s.settings.updated||0:''].join('|');
}
