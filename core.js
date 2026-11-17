/* Daily Wardrobe: shared constants and item helpers (no DOM access; also loaded by the analysis worker) */
const TYPES={suit:'Suit',blazer:'Blazer',pants:'Pants',shirt:'Dress shirt',tie:'Tie',tieclip:'Tie clip',pocketsquare:'Pocket square',watch:'Watch',shoes:'Shoes',belt:'Belt',socks:'Socks',cufflinks:'Cufflinks',overcoat:'Overcoat',raincoat:'Raincoat',
  // the casual garments (2026-11-16, the owner's approved new types): worn only when picked by hand on Today (isHandPick)
  tee:'T-shirt',polo:'Polo',henley:'Henley',sweater:'Sweater',sweatshirt:'Sweatshirt',hoodie:'Hoodie',qzip:'Quarter-zip',cardigan:'Cardigan',chore:'Chore jacket'};
/* the types and kinds the tagger offers only to an app that names them (the request's `types`; worker/tag.js knownTypes; the pocket square too): an older app
   reads an unknown type as a suit, so the worker gives one only when told. 'cargo' is the pants kind (trouserKind) */
const TAG_TYPES=['pocketsquare','tee','polo','henley','sweater','sweatshirt','hoodie','qzip','cardigan','chore','cargo','sockpat'];   // ('sockpat', 2026-11-17: socks' patterns, their pattern colours and the toe cap's own field, toeColor)
/* ---- hand-pick only (2026-11-16, the owner: "Planner: hand-pick only"): the casual tops (worn in the shirt slot, in place of the shirt),
   the casual jackets (the jacket slot) and cargo pants are never planned or suggested ("Suggest another" too) and don't count in the
   rotation stats or What to buy; Today's picker offers them under "Casual · pick by hand". isHandPick is the one check the planner, the
   suggestions and the stats ask; a later "Uniform" flag can extend it ---- */
const CASUAL_TOPS=['tee','polo','henley','sweater','sweatshirt','hoodie','qzip'];
const CASUAL_JACKETS=['cardigan','chore'];
const HANDPICK_TYPES=[...CASUAL_TOPS,...CASUAL_JACKETS];
const isHandPick=i=>!!i&&(HANDPICK_TYPES.includes(i.type)||(i.type==='pants'&&i.trouserKind==='cargo'));
/* the Today slot a hand-pick piece is worn in (null: not one) */
const handPickSlot=i=>!isHandPick(i)?null:CASUAL_TOPS.includes(i.type)?'shirt':CASUAL_JACKETS.includes(i.type)?'top':'bot';
/* a casual top worn in the shirt slot: the day has no tie and no tie clip (the top is the top layer, in place of the shirt) */
const casualTop=o=>!!(o&&o.shirt&&CASUAL_TOPS.includes(o.shirt.type));
const COLORS={stone:'#cbbfa3',denim:'#3e5c86',black:'#16161a',charcoal:'#3b3f46',darkgrey:'#5e6269',grey:'#8b8f96',midgrey:'#a2a4a8',lightgrey:'#babdc2',white:'#f6f6f3',cream:'#efe4c8',lightblue:'#a9c7e4',blue:'#3f6fb5',steelblue:'#56657f',deepblue:'#26326a',navy:'#1b2a4a',darknavy:'#1c1f2b',slate:'#3a3f4c',brown:'#5a3a22',tan:'#b8946a',khaki:'#c3b091',taupe:'#8b7d6b',deeptaupe:'#5f5449',rust:'#a4502a',olive:'#5b5d36',green:'#2f6b4a',burgundy:'#6d1f2c',wine:'#7d2438',oxblood:'#4a1a1e',red:'#b3262e',purple:'#5d3a7a',pink:'#e3a5b4',gold:'#c9a227',silver:'#c3c6cb',rosegold:'#c98f7a',gunmetal:'#55595f'};
/* colours offered only for dress shirts (the planner maps them to a family for other rules) */
const SHIRT_COLORS={mint:'#cfe6d4',paleyellow:'#f1e6ac',ivory:'#f4efde',beige:'#dccbb0',lavender:'#c9bfe2',periwinkle:'#9ea8d4'};
Object.assign(COLORS,SHIRT_COLORS);
const SHIRT_ONLY=Object.keys(SHIRT_COLORS),SHIRT_FALLBACK={mint:'green',paleyellow:'cream',ivory:'cream',beige:'tan',lavender:'purple',periwinkle:'blue'};
const METAL={gold:'#c9a227',silver:'#c3c6cb',other:'#7d8187'},PATS_BY=(()=>{const suiting=['solid','pinstripe','chalk-stripe','herringbone','birdseye','nailhead','sharkskin','houndstooth','glen-check','windowpane','tweed','twill','camouflage','other'];
  return{suit:suiting,blazer:suiting,pants:suiting,shirt:['solid','stripe','pinstripe','fine-stripe','gingham','tattersall','check','houndstooth','herringbone','oxford','pinpoint','royal-oxford','twill','end-on-end','chambray','dobby','woven','textured','fine-texture','camouflage','other'],tie:['solid','woven','stripe','polka-dot','paisley','check','tonal-check','foulard','knit','other'],
    // a pocket square (2026-11-16): the tie's prints, and 'border', a plain ground with a contrast edge or rolled hem (its colour: secondaryColor)
    pocketsquare:['solid','border','polka-dot','paisley','stripe','check','foulard','woven','other'],
    // the casual garments (2026-11-16): heather (a marled mix of light and dark fibers of one color), cable (cable-knit ropes)
    tee:['solid','stripe','heather','other'],polo:['solid','stripe','heather','other'],henley:['solid','stripe','heather','other'],sweater:['solid','heather','cable','stripe','other'],
    sweatshirt:['solid','stripe','heather','other'],hoodie:['solid','stripe','heather','other'],qzip:['solid','heather','cable','stripe','other'],cardigan:['solid','heather','cable','stripe','other'],chore:['solid','other'],
    // socks (2026-11-17, the owner's sock patterns): bold ones (argyle, stripe = horizontal bands, polka-dot, other) and quiet knits that read
    // plain from a step away (ribbed, birdseye, nailhead, herringbone, clock = a small motif up the side of the ankle); worker/tag.js SOCK_PATS
    socks:['solid','argyle','stripe','polka-dot','ribbed','birdseye','nailhead','clock','herringbone','other']}})(),
PAT_ALIAS={suit:{stripe:'pinstripe',check:'glen-check',plaid:'glen-check',texture:'twill'},shirt:{texture:'textured',plaid:'check',hairline:'fine-stripe','hairline-stripe':'fine-stripe','fine-stripes':'fine-stripe','fil-a-fil':'end-on-end','end-to-end':'end-on-end',jacquard:'dobby','pin-point':'pinpoint','royal-oxford-weave':'royal-oxford',poplin:'solid',broadcloth:'solid','fine-textured':'fine-texture','micro-texture':'fine-texture',weave:'woven','basket-weave':'royal-oxford'},tie:{texture:'woven',textured:'woven',weave:'woven','basket-weave':'woven',basketweave:'woven',oxford:'woven','micro-check':'woven',grenadine:'woven',tonal:'tonal-check','tone-on-tone':'tonal-check','tonal-glen-check':'tonal-check','tone-on-tone-check':'tonal-check',dots:'polka-dot',plaid:'check'},
  pocketsquare:{dots:'polka-dot',dot:'polka-dot','contrast-border':'border',bordered:'border',edged:'border',edge:'border',piped:'border',piping:'border','rolled-edge':'border',hem:'border',plaid:'check',gingham:'check',stripes:'stripe',striped:'stripe',texture:'woven',textured:'woven',plain:'solid',motif:'foulard',geometric:'foulard'},
  socks:{diamond:'argyle',diamonds:'argyle','diamond-pattern':'argyle',harlequin:'argyle',argyles:'argyle','argyle-pattern':'argyle',stripes:'stripe',striped:'stripe','horizontal-stripe':'stripe','horizontal-stripes':'stripe',
    'rugby-stripe':'stripe','multi-stripe':'stripe',bands:'stripe',banded:'stripe',dot:'polka-dot',dots:'polka-dot',polka:'polka-dot','polka-dots':'polka-dot',dotted:'polka-dot','pin-dot':'polka-dot',pindot:'polka-dot','pin-dots':'polka-dot',spots:'polka-dot',spotted:'polka-dot',
    rib:'ribbed',ribs:'ribbed','rib-knit':'ribbed','ribbed-knit':'ribbed','ribbed-texture':'ribbed','birds-eye':'birdseye',"bird's-eye":'birdseye','birds-eye-knit':'birdseye','pin-point':'nailhead',pinpoint:'nailhead',
    clocked:'clock',clocks:'clock','clock-motif':'clock','side-clock':'clock',embroidered:'clock',chevron:'herringbone',zigzag:'herringbone','fishbone':'herringbone',plain:'solid',novelty:'other',print:'other',printed:'other',
    camo:'other',camouflage:'other',fair:'other','fair-isle':'other'}},
CASUAL_PAT_ALIAS={striped:'stripe',stripes:'stripe',breton:'stripe','breton-stripe':'stripe',marl:'heather',marled:'heather',melange:'heather',heathered:'heather',mottled:'heather',
  'cable-knit':'cable',cables:'cable',cabled:'cable',plain:'solid',knit:'solid',jersey:'solid',ribbed:'solid',rib:'solid'},
normPat=(t,p)=>{const l=PATS_BY[t]||['solid'],g=PAT_ALIAS[t==='blazer'||t==='pants'?'suit':t]||(HANDPICK_TYPES.includes(t)?CASUAL_PAT_ALIAS:{});p=String(p||'').toLowerCase().trim().replace(/[\s_]+/g,'-');return l.includes(p)?p:l.includes(g[p])?g[p]:'solid'},
patLabel=p=>String(p||'').replace(/-/g,' '),
COL_ALIAS={gray:'grey',lightgray:'lightgrey',palegrey:'lightgrey',palegray:'lightgrey',silvergrey:'silver',silvergray:'silver',darkgray:'darkgrey',middlegrey:'midgrey',middlegray:'midgrey',midgray:'midgrey',mediumgrey:'grey',mediumgray:'grey',
  slateblue:'slate',slategrey:'slate',slategray:'slate',slatebluegrey:'slate',darkslatebluegrey:'slate',darkslate:'slate',bluegrey:'slate',bluegray:'slate',
  steel:'steelblue',denimblue:'steelblue',dustyblue:'steelblue',verydarknavy:'darknavy',navyblack:'darknavy',inkblue:'darknavy',ink:'darknavy',sapphire:'deepblue',
  skyblue:'lightblue',babyblue:'lightblue',paleblue:'lightblue',powderblue:'lightblue',royalblue:'blue',cobalt:'blue',
  lightyellow:'paleyellow',butter:'paleyellow',lemon:'paleyellow',eggshell:'ivory',lilac:'lavender',cornflower:'periwinkle',cornflowerblue:'periwinkle',darkblue:'navy',navyblue:'navy',midnightblue:'navy',midnight:'navy',offwhite:'cream',ecru:'cream',chino:'khaki',camel:'tan',sand:'tan',mushroom:'taupe',greige:'taupe',darktaupe:'deeptaupe',richtaupe:'deeptaupe',mink:'deeptaupe',orange:'rust',burntorange:'rust',terracotta:'rust',copper:'rust',mintgreen:'mint',palegreen:'mint',seafoam:'mint',
  darkbrown:'brown',chocolate:'brown',cognac:'brown',maroon:'burgundy',winered:'wine',merlot:'wine',claret:'wine',cordovan:'oxblood',color8:'oxblood',darkred:'burgundy',
  yellow:'gold',mustard:'gold',violet:'purple',plum:'purple',rose:'pink',salmon:'pink',teal:'green',emerald:'green',forestgreen:'green',darkgreen:'green',olivegreen:'olive'},
normColFor=(type,c,accent)=>fitCol(type,normCol(c),accent),
/* a type with a pattern and pattern colours: FABRIC's cloth, the pocket square's print and the casual garments' stripe, heather or
   cable (2026-11-16; they have no close-up, swatch or reading) */
hasPat=t=>FABRIC.includes(t)||t==='pocketsquare'||t==='socks'||HANDPICK_TYPES.includes(t),   // (socks 2026-11-17: argyle, stripes, dots…)
normCol=c=>{if(!c)return null;const x=String(c).trim().toLowerCase();if(/^own[a-z0-9]+$/.test(x)&&COLORS[x])return x;const k=String(c).toLowerCase().replace(/[^a-z]/g,'');if(!k||k==='none'||k==='null')return null;return COLORS[k]?k:COL_ALIAS[k]||null},FABRIC=['suit','blazer','pants','shirt','tie'],COOL=3;
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
  // a pocket square (2026-11-16): white first (linen or cotton, the safe default), the tie's colours and its motif colours
  pocketsquare:{p:['white','cream','silver','lightgrey','grey','charcoal','black','navy','darknavy','deepblue','blue','steelblue','lightblue','burgundy','wine','red','pink','purple','lavender','green','olive','brown','tan','gold','rust'],
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
/* the casual garments' colours (2026-11-16; worker/tag.js TYPE_COLORS has the same) */
{const CAS_P=['white','cream','lightgrey','midgrey','grey','charcoal','black','navy','darknavy','blue','lightblue','steelblue','slate','green','olive','khaki','tan','brown','burgundy','wine','red','rust','pink','purple','gold'],
  CAS_A=['white','cream','lightgrey','grey','charcoal','black','navy','blue','lightblue','red','burgundy','green','olive','tan','brown','gold','rust','pink'],
  KNIT_P=['cream','white','lightgrey','midgrey','grey','charcoal','black','navy','darknavy','blue','steelblue','slate','green','olive','khaki','tan','taupe','brown','burgundy','wine','rust','red','gold'];
  for(const t of ['tee','polo','henley','sweater','sweatshirt','hoodie','qzip','cardigan'])COLS_BY[t]={p:[...(['sweater','qzip','cardigan'].includes(t)?KNIT_P:CAS_P)],a:[...CAS_A]};
  COLS_BY.chore={p:['navy','darknavy','blue','steelblue','olive','green','khaki','tan','stone','brown','rust','black','charcoal','grey','cream'],a:['black','brown','navy','cream','white','tan','olive']}}
/* watch dials */
const DIAL_COLS=['white','cream','silver','lightgrey','grey','slate','charcoal','black','navy','deepblue','blue','lightblue','green','olive','brown','burgundy','gold'];
const colsFor=(type,accent)=>{const t=COLS_BY[type];return t?(accent?t.a:t.p):Object.keys(COLORS)};
/* the closest allowed colour: the named fallback for shirt colours first, otherwise nearest by (weighted) RGB distance */
function fitCol(type,k,accent){if(!k)return null;const l=colsFor(type,accent);if(l.includes(k))return k;
  const f=SHIRT_FALLBACK[k]||{green:'mint',olive:'mint'}[k];if(f&&l.includes(f))return f;
  const x=labOf(k);let best=l[0],bd=1e9;for(const c of l){const y=labOf(c),d=(x[0]-y[0])**2+1.5*((x[1]-y[1])**2+(x[2]-y[2])**2);if(d<bd){bd=d;best=c}}return best}
/* CIE L*a*b* of a named colour (perceptual distance, so a neutral never lands on a tint) */
function labOf(c){return rgbLab(...hexRgb(COLORS[c]))}
/* CIE L*a*b* of an sRGB colour (0-255), and back to a hex for display (the worker's copy, worker/colormath.js, is checked equal by
   tests/colormath.test.js) */
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
/* an own colour's or pattern's key from its name (fix round 3, 2026-11-16, W2-12-03/W2-16-01: they kept only a-z, so an Arabic name gave the
   key "own" and was refused as "at least two letters", and "Rot 1" / "Rot 2" both became ownrot): accents are dropped (Café → cafe), the
   Latin letters and digits kept (Arabic-Indic digits as 0-9), and a name with letters outside a-z gets a short hash of the whole name
   (FNV-1a, base 36) so any script has a key of its own; keys stay ASCII (own[a-z0-9] / own-[a-z0-9-], OWN_COL_RE / OWN_PAT_RE). A Latin
   name without digits gets the key it always had; stored keys are never derived again (look a name up with ownColFind / ownPatFind) */
const OWN_COL_RE=/^own[a-z0-9]{1,28}$/,OWN_PAT_RE=/^own-[a-z0-9-]{1,28}$/;
const ownKeyNorm=s=>String(s==null?'':s).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[٠-٩]/g,d=>d.charCodeAt(0)-0x660).replace(/[۰-۹]/g,d=>d.charCodeAt(0)-0x6f0).replace(/ـ/g,'').replace(/\s+/g,' ').trim();
const ownKeyHash=s=>{let h=0x811c9dc5;for(const ch of s){h^=ch.codePointAt(0);h=Math.imul(h,16777619)>>>0}return h.toString(36)};
const ownKeyOther=n=>/[^\x00-\x7f]/.test(n.replace(/[^\p{L}\p{N}]/gu,''));   // letters (or digits) outside a-z 0-9 after accents are dropped
const ownColKey=name=>{const n=ownKeyNorm(name),a=n.replace(/[^a-z0-9]/g,'');return 'own'+(ownKeyOther(n)?a.slice(0,20)+'x'+ownKeyHash(n):a).slice(0,28)};
const ownPatKey=name=>{const n=ownKeyNorm(name),s=n.replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');return 'own-'+(ownKeyOther(n)?(s.slice(0,19).replace(/-$/,'')+'-'+ownKeyHash(n)).replace(/^-/,''):s).slice(0,28).replace(/-$/,'')};
/* a name needs two letters or digits, in any script */
const ownNameShort=name=>[...ownKeyNorm(name).replace(/[^\p{L}\p{N}]/gu,'')].length<2;
/* the key of the owner's colour or pattern with this name (any case, accents and marks aside), else null */
const ownColFind=name=>{const n=ownKeyNorm(ownNameClean(name));if(!n)return null;const c=Object.values(CUSTOM_COL).find(x=>ownKeyNorm(x.name)===n);return c?c.key:null};
const ownPatFind=name=>{const n=ownKeyNorm(ownNameClean(name));if(!n)return null;const p=Object.values(CUSTOM_PAT).find(x=>ownKeyNorm(x.name)===n);return p?p.key:null};
/* a free key: the name's own, or with 2, 3… after it when an older name took it ("Rot 1" saved before digits counted is ownrot) */
const ownFreeKey=(key,taken,re)=>{if(!taken(key))return key;for(let k=2;k<100;k++){const x=key.slice(0,(key.startsWith('own-')?32:31)-String(k).length)+k;if(re.test(x)&&!taken(x))return x}return key};
/* is a pattern name already a built-in pattern's ("Birdseye", "Glen check", "chalk stripe") or one of the owner's? (W1-3-05: the built-in
   check compared the prefixed key own-birdseye with birdseye, so it never matched) */
const patLetters=t=>ownKeyNorm(t).replace(/[^\p{L}\p{N}]/gu,'');
const patNameTaken=name=>{const n=patLetters(name);if(!n)return false;
  return Object.values(PATS_BY).some(l=>l.some(p=>!CUSTOM_PAT[p]&&patLetters(patLabel(p))===n))||Object.values(CUSTOM_PAT).some(p=>patLetters(p.name)===n)};
/* what an own colour's or pattern's name may contain (2026-11-15, the re-audit's N4: a name like `<img src=x onerror=…>` went into the page
   as HTML, ran, and synced to every device): letters of any script, digits, spaces and - ’ . , ( ) / +; a straight apostrophe becomes ’ and
   & "and". ownNameBad refuses a typed name with anything else; ownNameClean is applied to every name shown (applyCustom: one arriving by
   sync or saved before this rule too), so no own name can carry < > " ' & or a backtick into the page */
const OWN_NAME_OK=/^[\p{L}\p{M}\p{N} ’.,،()\/+-]*$/u;   // ، the Arabic keyboard's comma (W2-16-02)
const ownNameTidy=s=>String(s==null?'':s).normalize('NFC').replace(/['‘`´]/g,'’').replace(/\s*&\s*/g,' and ').replace(/\s+/g,' ').trim();
const ownNameBad=s=>!OWN_NAME_OK.test(ownNameTidy(s));
const ownNameClean=(s,max=28)=>ownNameTidy(s).replace(/[^\p{L}\p{M}\p{N} ’.,،()\/+-]/gu,' ').replace(/\s+/g,' ').trim().slice(0,max);
const ownDescClean=s=>String(s==null?'':s).replace(/[<>"'`&]/g,' ').replace(/\s+/g,' ').trim().slice(0,150);
function applyCustom(cu){
  for(const k of Object.keys(CUSTOM_COL)){delete COLORS[k];delete COLOR_NAMES[k];delete LUMS[k]}
  for(const t of Object.values(COLS_BY)){t.p=t.p.filter(c=>!CUSTOM_COL[c]);t.a=t.a.filter(c=>!CUSTOM_COL[c])}
  for(const t of Object.keys(PATS_BY))PATS_BY[t]=PATS_BY[t].filter(p=>!CUSTOM_PAT[p]);
  CUSTOM_COL={};CUSTOM_PAT={};cu=cu&&typeof cu==='object'?cu:{};const arr=v=>Array.isArray(v)?v:[];   // (a list that isn't one counts as empty: it stopped the start-up, CR-7-03)
  for(let c of arr(cu.colors)){if(!c||typeof c!=='object'||!OWN_COL_RE.test(c.key)||!/^#[0-9a-f]{6}$/i.test(c.hex||'')||!COLORS[c.base]||CUSTOM_COL[c.base])continue;
    const name=ownNameClean(c.name)||c.key.slice(3);c={...c,name};
    CUSTOM_COL[c.key]=c;COLORS[c.key]=c.hex.toLowerCase();COLOR_NAMES[c.key]=name.toLowerCase();
    for(const t of arr(c.types))if(COLS_BY[t]){COLS_BY[t].p.push(c.key);if(c.accent)COLS_BY[t].a.push(c.key)}}
  for(let p of arr(cu.patterns)){if(!p||typeof p!=='object'||!OWN_PAT_RE.test(p.key))continue;p={...p,name:ownNameClean(p.name)||p.key.slice(4).replace(/-/g,' '),desc:ownDescClean(p.desc)};
    for(const t of arr(p.types))if(PATS_BY[t]&&PATS_BY[t].includes(p.base)){PATS_BY[t].push(p.key);CUSTOM_PAT[p.key]=p}}
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
  // the nearest hue pool holding a colour within BASE_L of its lightness wins over a hue alone (fix round 3, W2-16-12: a dark petrol tie
  // had only light blue within BASE_HUE and was planned as light blue; within BASE_HUE2 it takes steel blue)
  const near=p=>p.filter(x=>Math.abs(x.l[0]-lab[0])<=BASE_L),best=p=>p.sort((a,b)=>a.d-b.d)[0].k;
  const pools=C<BASE_GREY?[cand.filter(x=>x.c2<Math.max(5,C+3))]:[BASE_HUE,BASE_HUE2].map(w=>cand.filter(x=>x.c2>=6&&hd(x.h2,h)<=w));
  for(const p of pools)if(near(p).length)return best(near(p));
  const p=pools.find(x=>x.length);return best(p||(near(cand).length?near(cand):cand))}
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
const SLOTS=['top','bot','shirt','tie','shoes','belt','socks','watch','clip','links','coat','pocket'];   // (pocket: a pocket square, worn only with a jacket on, 2026-11-16)
/* occasions a day can be given (Settings): each changes what the planner picks. 'formal' is stored as rec.formal (as
   before); the others as rec.occasion. 'casual' = no jacket and no tie: a shirt and trousers. */
const OCCASIONS=[['formal','Formal','dark suit, white shirt, quiet tie'],['wedding','Wedding','a lighter suit, a light shirt and a lively tie, never black'],
  ['funeral','Funeral','the darkest suit, white shirt, black tie, black shoes'],['casual','No jacket or tie','a shirt and pants']];
const occOf=r=>r?(OCCASIONS.some(o=>o[0]===r.occasion)?r.occasion:r.formal?'formal':null):null;
const occLabel=o=>(OCCASIONS.find(x=>x[0]===o)||[])[1]||'';
const SLOT_TYPE=(s,suitDay)=>({top:suitDay?'suit':'blazer',bot:'pants',clip:'tieclip',links:'cufflinks',pocket:'pocketsquare'})[s]||s;
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
  pocketsquare:['silk','linen','cotton','wool','silk blend','polyester'],
  socks:['cotton','mercerized cotton','merino wool','wool blend','cashmere blend','bamboo','silk blend','synthetic blend'],
  overcoat:['wool','wool blend','melton','cashmere','cashmere blend','tweed','camel hair','loden','alpaca','cotton'],
  raincoat:['cotton gabardine','waxed cotton','rubberized cotton','nylon','polyester','waterproof shell'],
  // the casual garments (2026-11-16)
  tee:['cotton','jersey','pima cotton','slub cotton','cotton blend','linen','merino wool','polyester blend'],
  polo:['piqué','cotton','jersey','pima cotton','merino wool','linen','cotton blend','polyester blend'],
  henley:['cotton','jersey','waffle knit','slub cotton','cotton blend','merino wool','linen'],
  sweater:['merino wool','lambswool','cashmere','cashmere blend','wool','wool blend','shetland wool','alpaca','mohair blend','cotton'],
  sweatshirt:['cotton','fleece','french terry','loopback cotton','cotton blend','polyester blend'],
  hoodie:['cotton','fleece','french terry','cotton blend','polyester blend','merino wool'],
  qzip:['merino wool','lambswool','cashmere','wool','wool blend','cotton','fleece','polyester blend'],
  cardigan:['merino wool','lambswool','cashmere','cashmere blend','wool','wool blend','alpaca','cotton'],
  chore:['canvas','duck canvas','cotton twill','cotton','denim','moleskin','corduroy','wool','waxed cotton','linen']};
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
  // the casual garments (2026-11-16)
  polo:{pique:'piqué','pique cotton':'piqué','piqué cotton':'piqué',mesh:'piqué'},tee:{supima:'pima cotton',slub:'slub cotton'},henley:{waffle:'waffle knit',thermal:'waffle knit',slub:'slub cotton'},
  sweater:{shetland:'shetland wool',lambs:'lambswool','lambs wool':'lambswool','lamb’s wool':'lambswool',merino:'merino wool',mohair:'mohair blend'},cardigan:{lambs:'lambswool','lambs wool':'lambswool',merino:'merino wool'},qzip:{lambs:'lambswool',merino:'merino wool',polar:'fleece'},
  sweatshirt:{terry:'french terry','loopback':'loopback cotton',polar:'fleece','brushed fleece':'fleece'},hoodie:{terry:'french terry',polar:'fleece','brushed fleece':'fleece'},
  chore:{duck:'duck canvas',twill:'cotton twill',waxed:'waxed cotton',wax:'waxed cotton',cord:'corduroy'},
  // (polyester is a shirt material of its own since 2026-11-16, the owner's ask: no longer read as performance stretch; nylon still is)
  shirt:{nylon:'performance stretch',viscose:'rayon',tencel:'lyocell',merino:'wool','merino wool':'wool','poly-cotton':'cotton blend',polycotton:'cotton blend','poly cotton':'cotton blend','cotton-polyester':'cotton blend','cotton polyester':'cotton blend',poly:'polyester','poly blend':'polyester blend'}};
/* ---- the person's own materials (2026-11-16, the owner's approved design): settings.ownMaterials = {type: [name]}, added from Claude's
   offer when nothing on the list fits ("Add cupro as a material"), synced like own colors (entry by entry: SET_SPLIT 'mats'), removed in
   Settings → Your materials. A name is lower-case letters, spaces and hyphens, 2-24 characters, at most 3 words (the worker's matName
   rule; it also turns away weaves, leathers and prose). They join the type's dropdown, import and search; the planner and the painter
   know nothing of them, so an own material has no season and is painted plain */
const OWN_MAT_MAX=20;
const ownMatName=v=>{const s=String(v??'').toLowerCase().replace(/\s+/g,' ').trim();return /^[a-z][a-z -]{0,22}[a-z]$/.test(s)&&!/--/.test(s)&&s.split(' ').length<=3?s:''};
const ownMats=type=>{const o=typeof settings!=='undefined'&&settings&&settings.ownMaterials,l=o&&typeof o==='object'&&Array.isArray(o[type])?o[type]:[],std=MATERIALS_BY[type]||[],out=[];
  if(!MATERIALS_BY[type])return out;for(const v of l){const n=ownMatName(v);if(n&&!std.includes(n)&&!out.includes(n))out.push(n);if(out.length>=OWN_MAT_MAX)break}return out};
/* the type in a material sentence: "your shirt materials" (matTypeWord), "every shirt / pair of pants you add" (matTypeOne) */
const matTypeWord=t=>t==='shirt'?'shirt':(TYPES[t]||t).toLowerCase();
const matTypeOne=t=>t==='pants'||t==='socks'?'pair of '+t:matTypeWord(t);
/* the type's materials: the standard list, then the person's own (null for a type without a list) */
const matsFor=type=>MATERIALS_BY[type]?[...MATERIALS_BY[type],...ownMats(type)]:null;
/* the listed name a word means for a type ('' when none): the type's own name (an own one too), else an alias that is on the type's list */
const matAlias=(type,w)=>{const l=matsFor(type);if(!l)return '';w=String(w??'').toLowerCase().replace(/\s+/g,' ').trim();if(!w)return '';if(l.includes(w))return w;
  const a=(MAT_ALIAS[type]||{})[w]||MAT_ALIAS['*'][w];return a&&l.includes(a)?a:''};
/* the shirt weaves that left the Material list (they are patterns): on import a weave in the Material column becomes the pattern */
const SHIRT_WEAVE_MAT={twill:'twill',oxford:'oxford','pinpoint oxford':'pinpoint',pinpoint:'pinpoint','royal oxford':'royal-oxford','end-on-end':'end-on-end','end on end':'end-on-end','fil-a-fil':'end-on-end',chambray:'chambray',dobby:'dobby',herringbone:'herringbone'};
const SEASONS=[['all','All year'],['warm','Warm weather'],['cold','Cold weather']],CUFFS=[['button','Button cuffs'],['french','French cuffs']];

/* user settings (stored in IndexedDB meta and synced): which days are workdays, which of those are blazer days,
   temperature units and the weather location */
/* the one writer of the wardrobe, the outfit history and the settings in memory (Round B, CR-7-07: start, sync, kit, wardrobe,
   settings and safety assigned them themselves); it only sets what it is given, so each caller keeps its own applyCustom/planDirty,
   in its own order. (planWith and packPlanOf swap dayRecs for a moment, and analysis.js swaps items: they put them back.) */
function setWardrobe(w){if('items' in w)items=w.items;if('days' in w)dayRecs=w.days;if('settings' in w)settings=w.settings}
let settings={workdays:[0,1,2,3,4],blazerDays:[4],units:null,location:null,vestMode:'auto',updated:0};
const SET_DEFAULTS=JSON.parse(JSON.stringify(settings));   // the app's own defaults, for a setting a synced copy marks removed (takeSettings)
/* three-piece suits: a suit may have a matching vest (hasVest). vestMode: 'auto' (suit days that aren't hot, and
   formal days), 'always' (every suit day) or 'never'; a day can override it. A vest means no tie clip. */
const VESTS=[['yes','Matching vest'],['no','No vest']];
/* a suit has a waistcoat only when it says so (vest:'yes'). A wardrobe from before that rule (no settings.vestDef yet: dress.js,
   migrateVests) keeps the old reading, where a suit with no value had one, until its suits have been given their value */
const hasVest=i=>!!i&&i.type==='suit'&&(i.vest==='yes'||(i.vest==null&&!settings.vestDef));
/* the dress code (settings.dress = {jacket, tie}; a missing object or key means yes): does the user wear jackets, ties? */
const wearsJacket=()=>!(settings.dress&&settings.dress.jacket===false);
const wearsTie=()=>!(settings.dress&&settings.dress.tie===false);
/* is an outfit without a jacket (a tie) short of one? Not on a no-jacket day, and not when the dress code leaves it out
   (a formal day, wedding or funeral is dressed in full from what is owned, but nothing is asked for) */
const needsJacket=o=>o.occasion!=='casual'&&!(o.off&&o.off.top)&&wearsJacket();   // (o.off: taken off on Today, see takeOff in planner.js)
const needsTie=o=>o.occasion!=='casual'&&!(o.off&&o.off.tie)&&wearsTie()&&!casualTop(o);   // (a T-shirt, sweater… in the shirt slot: no tie that day)
/* an item type the dress code leaves out: never planned on an ordinary day, so not counted as unused and not suggested */
const dressOut=t=>(!wearsTie()&&(t==='tie'||t==='tieclip'))||(!wearsJacket()&&(t==='suit'||t==='blazer'||t==='pocketsquare'));   // (a pocket square is worn only with a jacket)
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
/* camouflage (2026-11-16, the owner's MultiCam pants: drawn plain, since no band, motif or weave reading can hold irregular blotches with
   no repeating grid). camoPat(p): the pattern 'camouflage', an own pattern based on it, or an own pattern named or described as camouflage
   (one made before the pattern existed: his "Camouflage (OCP/MultiCam)" based on other).
   camoField(N, shares, seed): a seamless N x N map of colour indexes for colours in share order (index 0, the largest, is the ground): each
   other colour gets a smooth noise field summed over octaves on a wrapping lattice (the big blobs, then ragged edges), and from the smallest
   share up each takes the pixels where its own field is highest until it covers its share, so the accents lie over the others and every
   colour covers what it should. The same arguments give the same map (seeded). No DOM: the drawings (draw.js camoTileUrl) and the painter
   (asm-color.js asmCamoTex) share it; kept per arguments (camoMemo) */
/* (v2, 2026-11-16, the owner's "why does it look like trash": round flat cartoon blobs, three repeats across, washed out) each field is
   domain-warped (looked up through a slow displacement field, CAMO_WARP of the tile: organic, irregular edges instead of round ones), on a
   finer lattice (CAMO_OCT: smaller, more numerous blotches), and camoImage softens the edges and adds a faint cloth grain */
const CAMO_RE=/camo|multicam|\bocp\b|woodland|flecktarn|realtree/i,camoMemo=new Map(),CAMO_OCT=[[5,1],[10,.45],[20,.18],[40,.05]],CAMO_WARP=.09,CAMO_SOFT=.005,CAMO_GRAIN=.035,CAMO_V=2;
const camoPat=p=>{if(!p)return false;if(patBase(p)==='camouflage')return true;const c=typeof CUSTOM_PAT!=='undefined'&&CUSTOM_PAT[p];return !!c&&CAMO_RE.test((c.name||'')+' '+(c.desc||'')+' '+p)};
function camoField(N,shares,seed=1){const key=N+'|'+shares.join(',')+'|'+seed;if(camoMemo.has(key))return camoMemo.get(key);
  let s=(Math.imul(seed|0,2654435761)>>>0)||1;const rnd=()=>(s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296;
  const noise=oct=>{const f=new Float32Array(N*N);for(const [G,w] of oct){const L=new Float32Array(G*G);for(let k=0;k<G*G;k++)L[k]=rnd();
      for(let y=0;y<N;y++){const gy=y*G/N,y0=Math.floor(gy),ty=gy-y0,sy=ty*ty*(3-2*ty),r0=(y0%G)*G,r1=((y0+1)%G)*G;
        for(let x=0;x<N;x++){const gx=x*G/N,x0=Math.floor(gx),tx=gx-x0,sx=tx*tx*(3-2*tx),c0=x0%G,c1=(x0+1)%G;
          const a=L[r0+c0]+(L[r0+c1]-L[r0+c0])*sx,b=L[r1+c0]+(L[r1+c1]-L[r1+c0])*sx;f[y*N+x]+=w*(a+(b-a)*sy)}}}
    return f};
  // the slow displacement every field is looked up through (wrapping, so the tile stays seamless)
  const A=CAMO_WARP*N,wx=noise([[3,1],[6,.4]]),wy=noise([[3,1],[6,.4]]),mod=v=>((v%N)+N)%N;
  const warped=f=>{const g=new Float32Array(N*N);for(let y=0;y<N;y++)for(let x=0;x<N;x++){const j=y*N+x,X=mod(x+A*(wx[j]-.7)*2),Y=mod(y+A*(wy[j]-.7)*2),x0=Math.floor(X),y0=Math.floor(Y),tx=X-x0,ty=Y-y0,x1=(x0+1)%N,y1=(y0+1)%N;
      g[j]=(f[y0*N+x0]*(1-tx)+f[y0*N+x1]*tx)*(1-ty)+(f[y1*N+x0]*(1-tx)+f[y1*N+x1]*tx)*ty}return g};
  const n=N*N,idx=new Uint8Array(n),taken=new Uint8Array(n),tot=shares.reduce((a,b)=>a+Math.max(0,+b||0),0)||1;
  const order=shares.map((v,k)=>k).slice(1).sort((a,b)=>shares[a]-shares[b]);   // the smallest share first; the ground (index 0) is what is left
  for(const k of order){const f=warped(noise(CAMO_OCT)),want=Math.round(n*Math.max(0,+shares[k]||0)/tot),ids=[];for(let j=0;j<n;j++)if(!taken[j])ids.push(j);
    ids.sort((a,b)=>f[b]-f[a]);for(let q=0;q<want&&q<ids.length;q++){idx[ids[q]]=k;taken[ids[q]]=1}}
  if(camoMemo.size>16)camoMemo.clear();camoMemo.set(key,idx);return idx}
/* the camouflage as an N x N sRGB image (Uint8ClampedArray, 3 a pixel): camoField's map in its colours, the edges softened by two wrapping
   box blurs of CAMO_SOFT of the tile (a blended edge, as printed camouflage has, not a cut-out), and a faint cloth grain (±CAMO_GRAIN,
   seeded). Shared by the drawings (draw.js camoTileUrl) and the painter (asm-color.js asmCamoTex) */
function camoImage(N,cols,shares,seed=1){const idx=camoField(N,shares,seed),rgb=cols.map(h=>hexRgb(h)),n=N*N;let a=new Float32Array(3*n),b=new Float32Array(3*n);
  for(let j=0;j<n;j++){const c=rgb[idx[j]]||rgb[0];a[3*j]=c[0];a[3*j+1]=c[1];a[3*j+2]=c[2]}
  const r=Math.max(1,Math.round(CAMO_SOFT*N)),blur=(src,dst,dx,dy)=>{const w=2*r+1;for(let y=0;y<N;y++)for(let x=0;x<N;x++){let s0=0,s1=0,s2=0;
      for(let k=-r;k<=r;k++){const xx=((x+k*dx)%N+N)%N,yy=((y+k*dy)%N+N)%N,j=3*(yy*N+xx);s0+=src[j];s1+=src[j+1];s2+=src[j+2]}const o=3*(y*N+x);dst[o]=s0/w;dst[o+1]=s1/w;dst[o+2]=s2/w}};
  for(let p=0;p<2;p++){blur(a,b,1,0);blur(b,a,0,1)}
  let s=(Math.imul((seed|0)+7,2246822519)>>>0)||1;const rnd=()=>(s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296,out=new Uint8ClampedArray(3*n);
  for(let j=0;j<n;j++){const g=1+CAMO_GRAIN*(rnd()-.5)*2;for(let q=0;q<3;q++)out[3*j+q]=Math.round(a[3*j+q]*g)}
  return out}
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
/* socks: a contrasting toe cap is its own field, item.toeColor (2026-11-17, sock patterns: the second and third colours are now the
   pattern's, an argyle's diamonds and lines, as on every patterned item). Before, the toe cap was the secondaryColor: a sock with no
   toeColor at all is from before (wardrobe.js sockToeMigrate moves it, once, stamped; a sock from an older app may still arrive by sync), and
   a plain one's secondaryColor is read as its toe cap, as it always was. A patterned sock never is: patterns came with the toeColor field */
const sockPatterned=i=>!!i&&i.type==='socks'&&(patOf(i)||'solid')!=='solid';
const sockToeKey=i=>{if(!i||i.type!=='socks')return null;const t=i.toeColor!==undefined?i.toeColor:sockPatterned(i)?null:i.secondaryColor;return t&&t!=='none'&&COLORS[t]?t:null};
const sockToe=i=>{const t=sockToeKey(i);return t&&t!==primaryCol(i)?t:null};
const sockToeWord=i=>sockToe(i)?`, ${colName(sockToe(i)).toLowerCase()} toe`:'';
const colorDesc = i => {
  if(!i) return '';
  if(i.type==='socks'&&!sockPatterned(i))return colName(primaryCol(i))+sockToeWord(i);   // (a plain sock exactly as before: "Navy, light gray toe")
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
const desc=i=>i?((i.type==='watch'&&!strapBand(i))||(i.type==='cufflinks'&&!linkFace(i))?'':colorDesc(i))+(i.pattern&&i.pattern!=='solid'?' '+patName(i.pattern):'')+(sockPatterned(i)?sockToeWord(i):'')+(i.type==='shoes'||i.type==='belt'?' '+leatherWord(i,i.leather||'calf'):'')+(i.metal&&METAL_TYPES.includes(i.type)?((i.type==='watch'&&!strapBand(i))||(i.type==='cufflinks'&&!linkFace(i))?'':' · ')+metalWord(i.metal):'')+(i.type==='watch'?`${watchOpts(i).style==='chronograph'?' chronograph':''} · ${colName(watchOpts(i).dial)} dial · ${BAND_WORDS[watchOpts(i).band]||watchOpts(i).band}`:'')+(i.cuff==='french'?' · French cuffs':'')+(i.season&&i.season!=='all'&&SEASON_TYPES.includes(i.type)?` · ${i.season} weather`:''):'';   // (the band after " · " with its space: it read "·leather strap", 2026-11-17)
/* ---- titles (2026-11-17, the owner's title audit: "Navy & burgundy & gold argyle, light gray toe socks" was too long): what an item is
   called on screen (itemTitle, the Saved toast, the piece picker, Today's pieces, Laundry, Insights, What to buy, the import's list) and in
   the planner's words (nm) is its main colour, its pattern and its kind: "Navy argyle", "Burgundy stripe", "Gray glen check". The second
   and third colours, a toe cap or a sneaker's sole, the season and French cuffs stay in desc() and the item sheet (its Color summary,
   Details), and search still finds them (wardHay reads desc). A watch is its metal, chronograph and dial ("Gold chronograph · white dial");
   cufflinks their face and metal, a belt and shoes their leather, as before. A name the owner typed is always shown as typed (itemName).
   Pictures keep their keys: they never read titles (photos.js itemDesc, comboSig) */
const shortCol=i=>colName(primaryCol(i));
const shortDesc=i=>{if(!i)return '';const t=i.type;
  if(t==='watch'){const o=watchOpts(i);return `${metalWord(i.metal||'silver')}${o.style==='chronograph'?' chronograph':''} · ${colName(o.dial)} dial`}
  const c=t==='cufflinks'&&!linkFace(i)?'':shortCol(i);
  return c+(i.pattern&&i.pattern!=='solid'?' '+patName(i.pattern):'')+(t==='shoes'||t==='belt'?' '+leatherWord(i,i.leather||'calf'):'')+(i.metal&&METAL_TYPES.includes(t)?(c?' · ':'')+metalWord(i.metal):'')};
const nm=i=>i?shortCol(i)+(i.pattern&&i.pattern!=='solid'&&i.pattern!=='other'?' '+patName(i.pattern):'')+' '+typeWord(i):'none';   // an own pattern by its name, not "own basketweave" (W1-1-04); the main colour only (the title audit, 2026-11-17)
/* an item's own name (item.name), and what it is called on screen: the name when it has one, else its colour description
   (the planner's texts keep the description); a name is shown as typed, a description capitalised (titleCls) */
const itemName=i=>i&&typeof i.name==='string'?i.name.trim():'';
const itemTitle=i=>itemName(i)||sentence(shortDesc(i)+styleWord(i));
/* a shoe's style and a trouser's kind in a described title ("Oxblood calf loafers", "Stone chinos"): they were "Oxblood calf" and "Stone"
   (W2-17-15); oxfords and dress pants, and items from before styles existed, read as before */
const styleWord=i=>!i?'':i.type==='shoes'&&i.shoeStyle&&i.shoeStyle!=='oxford'?' '+(({derby:'derbies',loafer:'loafers',boot:'boots',sneaker:'sneakers'})[i.shoeStyle]||''):i.type==='pants'&&(i.trouserKind==='chinos'||i.trouserKind==='jeans')?' '+i.trouserKind:i.type==='pants'&&i.trouserKind==='cargo'?' cargo pants':'';
const titleCls=i=>itemName(i)?'named':'cap';
/* a right-to-left name (Arabic, Hebrew…) in a line of English keeps its place (fix round 3, W2-16-04/-10: "2 · بدلة كحلي رسمية days", the
   count jumped to the name's other side): nameHtml escapes it and wraps it in <bdi>, nameIso puts it between the invisible isolates
   U+2068/U+2069 for plain text (toasts, labels); a name with no right-to-left letter is returned as before */
const RTL_RE=/[֐-ࣿיִ-﷿ﹰ-ﻼ]/;
const nameHtml=t=>{t=String(t??'');return RTL_RE.test(t)?`<bdi>${esc(t)}</bdi>`:esc(t)};
const nameIso=t=>{t=String(t??'');return RTL_RE.test(t)?'⁨'+t+'⁩':t};
/* trousers come in three kinds and shoes in five styles; an item without one is dress trousers or oxfords, which the planner treats
   exactly as before there were kinds and styles (so a wardrobe from before plans the same) */
/* (2026-11-16) cargo pants: chinos with thigh cargo pockets, picked by hand only (isHandPick); the planner, never planning them, reads
   them as chinos when the owner picks them (trouserKind) */
const TROUSER_KINDS=[['dress','Dress pants'],['chinos','Chinos'],['jeans','Jeans'],['cargo','Cargo pants']],SHOE_STYLES=[['oxford','Oxford'],['derby','Derby'],['loafer','Loafer'],['boot','Boot'],['sneaker','Sneaker']];
const trouserKind=i=>i&&i.type==='pants'&&(i.trouserKind==='chinos'||i.trouserKind==='jeans')?i.trouserKind:i&&i.type==='pants'&&i.trouserKind==='cargo'?'chinos':'dress';
const isCargo=i=>!!i&&i.type==='pants'&&i.trouserKind==='cargo';
/* the kind as shown to the owner (the item sheet's Kind and Details, the grid's label): cargo stays cargo there; the planner keeps trouserKind */
const trouserKindShown=i=>isCargo(i)?'cargo':trouserKind(i);
const shoeStyle=i=>i&&i.type==='shoes'&&SHOE_STYLES.some(([k])=>k===i.shoeStyle)?i.shoeStyle:'oxford';
/* the word for the item in descriptions: chinos, jeans, loafers, boots, sneakers, derby shoes; else the type's own */
const typeWord=i=>isCargo(i)?'cargo pants':i&&i.type==='pants'&&trouserKind(i)!=='dress'?trouserKind(i):i&&i.type==='shoes'&&shoeStyle(i)!=='oxford'?({derby:'derby shoes',loafer:'loafers',boot:'boots',sneaker:'sneakers'})[shoeStyle(i)]:(TYPES[i&&i.type]||'item').toLowerCase();
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
/* an item's accents (item.accents, 2026-11-16, the owner's approved job "keep an item's extra colors"): up to ACCENT_MAX colours beyond its
   three (a five-colour paisley tie, a multi-colour plaid), most visible first, filled by Claude's tag or close-up reading or by hand. As
   read: known colours only, none of the three main ones, no repeats (a main colour changed later hides an accent that became it). The
   drawings and the painter keep three colours (a camouflage aside: detect.js camoLook); the planner weighs them less (planner.js) */
const ACCENT_MAX=4;
const accentsOf=i=>{if(!i||!Array.isArray(i.accents)||!i.accents.length)return [];const main=[primaryCol(i),i.secondaryColor,i.tertiaryColor],out=[];
  for(const c of i.accents)if(typeof c==='string'&&COLORS[c]&&!main.includes(c)&&!out.includes(c)&&out.length<ACCENT_MAX)out.push(c);return out};
/* a list of colours (Claude's, a spreadsheet's, the picker's) as an item's accents: known keys, none of its main three, no repeats, at most 4 */
const accentsFor=(i,list)=>accentsOf({...i,accents:Array.isArray(list)?list.map(c=>typeof c==='string'?COLORS[c]?c:normCol(c):null).filter(Boolean):[]});
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
   Merge two wardrobe snapshots {items, tombstones, days, settings}: items and days field by field, settings setting by setting, and a
   deletion (tombstone) wins over any older edit. The rules themselves are in merge.js (loaded before this file), one copy shared with
   the server (worker/backup.js); here are the app's own parts: the field and setting stamps made when something is saved, and the
   app's way of merging (MERGE_APP: the corrected clock, old settings keyed) */
/* ---- the phone's clock against the server's (fix round 3, 2026-11-16, the audit's W1-9 and W1-5-07): every stamp came from the phone's
   own clock, so a phone a year behind lost its edits and deletions to the backup, one a year ahead froze what it edited for a year, and a
   phone a few minutes slow lost a later edit to another phone's earlier one. Each sync learns the gap from the server's time (sync.js
   clockLearn, the x-now header); nowMs() is the phone's time corrected by it (the phone's own while no server has answered). A record's
   new stamp is also always above the one it replaces (nextStamp), so an edit or a deletion wins over the copy it was made on whatever the
   clocks say. In background workers (no localStorage) nowMs() is Date.now() */
const CLOCK_MIN=3000,CLOCK_AHEAD=10*6e4;   // a gap under CLOCK_MIN is noise; a stamp over CLOCK_AHEAD past the corrected time is from a wrong clock
let clockSkew=0;try{clockSkew=+localStorage.getItem('clock_skew')||0}catch{}
const nowMs=()=>Date.now()+clockSkew;
const nextStamp=prev=>Math.max(nowMs(),(+prev||0)+1);
// the corrected date (local midnight): todayDate() itself while no gap is known (or a test sets the day, TODAY_OVERRIDE)
const trueToday=()=>{if(!clockSkew||TODAY_OVERRIDE)return todayDate();const d=new Date(nowMs());return new Date(d.getFullYear(),d.getMonth(),d.getDate())};
/* ---- items field by field (merge.js mergeItem): the field stamps fs = {u, b, s} of an item saved by put() (app.js) */
/* the field stamps of item i, about to be stored over cur (the stored copy it was edited from): a field that differs from cur is stamped
   with i's stamp, the others keep cur's. A new item, or one stored again after a deletion, gets none (one stamp for all, as before).
   i's stamp is made one above cur's when it isn't already (an edit made on a copy is newer than it) */
function itemFields(i,cur){
  if(!cur||cur.id!==i.id){delete i.fs;return i}
  const tc=stamp(cur);if(stamp(i)<=tc)i.updated=tc+1;const t=stamp(i),s={};
  for(const k of new Set([...Object.keys(i),...Object.keys(cur),...(fsOk(cur)?Object.keys(cur.fs.s):[])]))if(!ITEM_META.includes(k))s[k]=sameVal(i[k],cur[k])?fieldStamp(cur,k):t;
  i.fs=fsPack(t,s);return i}
/* the app's way of merging (merge.js mergeStateBy): deletions forgotten by the corrected clock, two settings copies from before setting
   stamps keyed as they are read (keySettings) */
const MERGE_APP={now:()=>nowMs(),old:h=>keySettings({...h})};
function mergeState(a,b){return mergeStateBy(a,b,MERGE_APP)}
/* ---- settings, setting by setting, and a setting made of entries entry by entry (merge.js mergeSettingsBy, SET_SPLIT): stampSettings,
   called wherever the settings are saved, stamps only the settings (and entries) whose value changed since; keySettings keys a copy
   from before */
const subHashes=m=>{const o={};for(const [e,v] of m)o[e]=setHash(v);return o};
/* the entry stamps of setting k from what they were (the copy's khe[k] for the value it last stamped, was = that value's fingerprint) */
function subStamp(s,k,t,was){const m=setEntries(k,s[k]);
  if(!m){if(s.kse)delete s.kse[k];if(s.khe)delete s.khe[k];return}
  s.kse=s.kse||{};s.khe=s.khe||{};const nh=subHashes(m),none=was===undefined;   // (none: the setting didn't exist before: no entries)
  const oh=none?{'#':undefined}:s.khe[k],os=none?{'':0}:s.kse[k];if(none)was=undefined;
  if(!oh||!os||oh['#']!==was){s.khe[k]={...nh,'#':setHash(s[k])};s.kse[k]={'':t};return}   // not known before: the whole setting at t, as before
  const ns={...os},he={};
  for(const e of new Set([...Object.keys(oh),...Object.keys(nh)])){if(e==='#')continue;if((oh[e]||'-')!==(nh[e]||'-'))ns[e]=t;if(!nh[e])he[e]='-'}
  s.khe[k]={...he,...nh,'#':setHash(s[k])};s.kse[k]=ns}
/* a copy's entries keyed where it has none yet (or an older app changed the value since): every entry at the setting's own stamp */
function keySplit(s){for(const k of Object.keys(SET_SPLIT))if((k in s||k in (s.kh||{}))&&!subOk(s,k)){const m=setEntries(k,s[k]);if(!m)continue;
  s.kse=s.kse||{};s.khe=s.khe||{};s.khe[k]={...subHashes(m),'#':setHash(s[k])};s.kse[k]={'':setStampOf(s,k)}}return s}
/* called where the settings are read (start-up, after a sync, Settings): a copy from before gets every setting stamped with its one
   stamp; a setting the copy lacks that only the app's defaults filled in gets stamp 0, so a default never wins over another device's
   choice. Its values are taken as they are, so this must run before anything changes them (stampSettings stamps what changed since) */
function keySettings(s){if(!s)return s;
  if(!s.ks||!s.kh){const was=s.updated||0;s.ks={};s.kh={};for(const k of setKeys(s)){s.ks[k]=was;s.kh[k]=setHash(s[k])}return keySplit(s)}
  for(const k of setKeys(s))if(!(k in s.kh)){s.kh[k]=setHash(s[k]);s.ks[k]=0}return keySplit(s)}
function stampSettings(s,t){t=t||nowMs();if(!s)return s;
  if(!s.ks||!s.kh)keySettings(s);
  for(const k of new Set([...setKeys(s),...Object.keys(s.kh)])){const h=k in s?setHash(s[k]):'-';if(s.kh[k]!==h){const st=Math.max(t,(+s.ks[k]||0)+1);if(SET_SPLIT[k])subStamp(s,k,st,s.kh[k]==='-'?setHash(undefined):s.kh[k]);s.kh[k]=h;s.ks[k]=st}}   // (above its stamp before: the change wins whatever the clocks)
  s.updated=Math.max(t,(s.updated||0)+1);return s}
/* stored or downloaded settings (st) taken over the ones in memory (cur) -> the new in-memory settings, keyed. Spread over them, except
   a setting st marks removed (kh '-': a roll-back to a copy without it, or a removal on another device): it goes from memory too, or, when
   the app has a default for it, back to that default with stamp 0, so it never wins over the removal (2026-11-15, the audit: a roll-back's
   removed day off and holidays stayed in memory, and the next change on that phone stamped them back for every device) */
function takeSettings(cur,st){if(st&&typeof st==='object')st=cleanSettings(st);const s={...cur,...st};   // (cleanSettings: a setting of the wrong shape is left out, so memory keeps its own)
  if(st&&st.kh){let ks=null,kh=null;
    for(const k of Object.keys(st.kh))if(st.kh[k]==='-'&&!(k in st)&&!SET_META.includes(k)){
      if(k in SET_DEFAULTS){if(!ks){ks={...st.ks};kh={...st.kh}}s[k]=JSON.parse(JSON.stringify(SET_DEFAULTS[k]));ks[k]=0;kh[k]=setHash(s[k])}else delete s[k]}
    if(ks){s.ks=ks;s.kh=kh}}
  return keySettings(s)}
/* every setting stamped t (a roll-back or restore: the restored copy wins every setting on every device) */
function stampAllSettings(s,t){if(!s)return s;s.ks={};s.kh={};delete s.kse;delete s.khe;for(const k of setKeys(s)){s.ks[k]=t;s.kh[k]=setHash(s[k])}s.updated=t;return s}
function mergeSettings(a,b){return mergeSettingsBy(a,b,MERGE_APP)}
/* ---- a day field by field (merge.js mergeDay): the field stamps of a day saved by saveDay or the week's lock (history.js) */
function dayFields(rec,cur){
  if(!cur||cur.date!==rec.date){delete rec.fs;return rec}
  const tc=stamp(cur);if(stamp(rec)<=tc)rec.updated=tc+1;const t=stamp(rec),fr=dayFlat(rec),fc=dayFlat(cur),shown=cur.ids||{},s={};
  for(const k of new Set([...Object.keys(fr),...Object.keys(fc),...(fsOk(cur)?Object.keys(cur.fs.s):[])])){
    const same=sameVal(fr[k],fc[k])||(k.startsWith('force.')&&fr[k]!=null&&fr[k]===shown[k.slice(6)]&&!(k in fc));   // fixed to what was shown: no change
    s[k]=same?dayStamp(cur,k):t}
  rec.fs=fsPack(t,s);return rec}
/* ---- records coming in (fix round 3, 2026-11-16, the audit's W2-13-02 = W2-12-01: a crafted Restore file, a sync or a server answer put
   an item's id, photo, colour key and sett band colour into the page as markup). cleanState runs where records enter: Restore file, every
   sync pull and roll-back (sync.js), and the stored wardrobe at start-up (start.js). An item keeps only fields of the right shape:
   an id of safe characters (ID_RE, else the item is left out), a known type, colour and option keys of letters, digits, - and _ (an own
   key too; a colour word a known colour's alias, "light blue", becomes its key), photos only data:image/jpeg|png|webp;base64 (else
   the photo is dropped), numbers as numbers, a pattern reading's colours as hex and its words plain; free text (name, brand, notes…)
   is kept as typed (shown escaped) without bidi controls; any other field is kept with < > " ` taken out of its strings. Days keep a
   date of the app's shape and item ids of ID_RE; tombstones numbers. Pure and idempotent: a clean record comes out equal.
   worker/records.js recCheck refuses the same shapes on the server ---- */
const ID_RE=/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/,REC_KEY=/^[\p{L}\p{M}\p{N}_-]{1,48}$/u,REC_PHOTO=/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]*$/,REC_HEX=/^#[0-9a-fA-F]{3,8}$/,
  REC_DATE=/^\d{4}-\d{1,2}-\d{1,2}$/,REC_WORD=/^[\p{L}\p{M}\p{N} _+.,:;()\/#%’-]{0,120}$/u,BIDI_RE=/[‪-‮⁦-⁩]/g;   // embeddings, overrides and isolates (the marks LRM/RLM stay: an Arabic name may need them)
const REC_COLS=['primaryColor','secondaryColor','tertiaryColor','dial','toeColor'],REC_PICS=['photo','photoSm','texture','swatch'],
  REC_KEYS=['pattern','swSrc','metal','leather','cuff','vest','season','shoeStyle','trouserKind','band','bezel','watchStyle'],
  REC_NUMS=['added','updated','shade'],REC_TEXT={name:200,brand:200,material:200,notes:4000,details:4000,patternText:4000},REC_STRICT=['sett'];
const recClean=s=>String(s).replace(/[<>"`]/g,'');   // a free field's string: nothing that opens a tag or ends an attribute
const recFree=(v,d=0)=>typeof v==='string'?recClean(v):typeof v==='number'?(isFinite(v)?v:null):v==null||typeof v==='boolean'?v:d>8?null:
  Array.isArray(v)?v.map(x=>recFree(x,d+1)):typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>REC_WORD.test(k)).map(([k,x])=>[k,recFree(x,d+1)])):null;
/* a pattern reading (sett: bands, crossing lines, motif, texture): numbers, hex colours and plain words only */
const recStrict=(v,d=0)=>typeof v==='string'?(REC_HEX.test(v)||REC_WORD.test(v)?v:null):typeof v==='number'?(isFinite(v)?v:null):v==null||typeof v==='boolean'?v:d>8?null:
  Array.isArray(v)?v.map(x=>recStrict(x,d+1)):typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>REC_WORD.test(k)).map(([k,x])=>[k,recStrict(x,d+1)])):null;
/* Claude's and the app's own structured words (weave, patternSpec, tagAI, meas, away): prose may hold quotes ("a 1/2" stripe") and stays
   as it is, but nothing that opens a tag; a colour under a "hex" key (patternSpec.across bands reach a fill) must be a hex colour */
const REC_PROSE=['weave','patternSpec','tagAI','meas','away'];
const recProse=(v,d=0,k='')=>typeof v==='string'?(/^hex$/i.test(k)?(REC_HEX.test(v)?v:null):v.replace(/[<>`]/g,'')):typeof v==='number'?(isFinite(v)?v:null):v==null||typeof v==='boolean'?v:d>8?null:
  Array.isArray(v)?v.map(x=>recProse(x,d+1,k)):typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([kk])=>REC_WORD.test(kk)).map(([kk,x])=>[kk,recProse(x,d+1,kk)])):null;
const recCol=c=>c==null||c===''?c:typeof c!=='string'?undefined:/^own/.test(c)?(OWN_COL_RE.test(c)?c:undefined):COLORS[c]?c:normCol(c)||(REC_KEY.test(c)?c:undefined);   // an own colour's key by the one rule (OWN_COL_RE; the server's worker/ownkeys.js is the same)
const noBidi=s=>String(s==null?'':s).replace(BIDI_RE,'');
function cleanRecord(it){
  if(!it||typeof it!=='object'||Array.isArray(it)||typeof it.id!=='string'||!ID_RE.test(it.id)||!TYPES[it.type])return null;
  const o={};
  for(const [k,v] of Object.entries(it)){
    if(k==='id'||k==='type'){o[k]=v;continue}
    if(!REC_WORD.test(k)||k==='__proto__')continue;
    if(REC_COLS.includes(k)){const c=recCol(v);if(c!==undefined)o[k]=c}
    else if(k==='accents'){if(Array.isArray(v))o[k]=v.map(recCol).filter(c=>typeof c==='string'&&c).slice(0,8)}   // colour keys (accentsOf reads at most 4)
    else if(REC_PICS.includes(k)){if(v==null||typeof v==='string'&&(REC_PHOTO.test(v)||/^dwph:[0-9a-f]{20}$/.test(v)))o[k]=v}   // (a backup's own photo reference too)
    else if(REC_KEYS.includes(k)){if(v==null||typeof v==='string'&&(k==='pattern'&&/^own/.test(v)?OWN_PAT_RE.test(v):REC_KEY.test(v)))o[k]=v}
    else if(REC_NUMS.includes(k)){if(v==null||typeof v==='number'&&isFinite(v))o[k]=v}
    else if(k in REC_TEXT){if(v==null)o[k]=v;else if(typeof v==='string'||typeof v==='number')o[k]=noBidi(v).slice(0,REC_TEXT[k])}
    else if(REC_STRICT.includes(k))o[k]=recStrict(v);
    else if(REC_PROSE.includes(k))o[k]=recProse(v);
    else o[k]=recFree(v)}
  return o}
function cleanDay(d){
  if(!d||typeof d!=='object'||Array.isArray(d)||typeof d.date!=='string'||!REC_DATE.test(d.date))return null;
  const o={};
  for(const [k,v] of Object.entries(d)){if(!REC_WORD.test(k)||k==='__proto__')continue;
    // the pieces a day names (ids, lock, force: slot -> item id): an id of the wrong shape is left out
    if((k==='ids'||k==='lock'||k==='force')&&v&&typeof v==='object'&&!Array.isArray(v))o[k]=Object.fromEntries(Object.entries(v).filter(([s,x])=>REC_KEY.test(s)&&(typeof x!=='string'||ID_RE.test(x))).map(([s,x])=>[s,recFree(x)]));
    else if(k==='date')o[k]=v;else o[k]=recFree(v)}
  return o}
/* a snapshot from outside ({items, days, tombstones, settings}, a backup file's or the server's): its records cleaned, the rest as it came */
function cleanState(st){
  if(!st||typeof st!=='object')return st;const o={...st};
  if(Array.isArray(st.items))o.items=st.items.map(cleanRecord).filter(Boolean);
  if(Array.isArray(st.days))o.days=st.days.map(cleanDay).filter(Boolean);
  if(st.tombstones&&typeof st.tombstones==='object')o.tombstones=Object.fromEntries(Object.entries(st.tombstones).filter(([id,t])=>ID_RE.test(id)&&typeof t==='number'&&isFinite(t)));
  if(st.settings&&typeof st.settings==='object')o.settings=cleanSettings(st.settings);
  return o}
/* ---- settings coming in (fix round A, 2026-11-17, the code review's Critical C1 = CR-2-02 + CR-4-01 + CR-7-02: a crafted Restore file, a
   sync pull or a holiday list put an own color's key and hex, a holiday's or day off's date and a hidden What to buy idea's key into the
   page as script; "settings pass as they are" was the gap). cleanSettings keeps each setting only in its own shape: workdays and blazer days
   0-6; holidays' country two capital letters (else none), their dates and the days off's YYYY-MM-DD, names without bidi controls or
   < > " `; What to buy's hidden keys type|group|class of letters, digits, - and _; own colors and patterns only with a key of OWN_COL_RE /
   OWN_PAT_RE (a color also a 6-digit hex), their base and kinds plain keys (kinds always a list), a pattern's look numbers, hex and plain
   words; own materials as ownMatName gives them; the tagging stats' counts numbers; every other setting with < > " ` taken out of its
   strings (recFree). An entry of the wrong shape is left out. The stamps (updated, ks, kh, kse, khe) are never touched, and a setting
   that is already clean comes out as the same object (a clean copy is returned as it is): nothing is restamped. It runs in cleanState
   (Restore file, every sync pull, roll-back), in takeSettings (start-up, after a sync, the safety restore) and once over the stored copy
   (app.js cleanStoredSettings); fetchHolidays' tidy keeps only dated, named holidays (settings.js) ---- */
const setStr=(v,max)=>typeof v==='string'?noBidi(v).replace(/[<>"`]/g,'').slice(0,max):undefined;
const setFields=(v,f)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).filter(([k])=>k!=='__proto__'&&REC_WORD.test(k)).map(([k,x])=>[k,f[k]?f[k](x):recFree(x)]).filter(([,x])=>x!==undefined)):undefined;
const setList=(v,f)=>Array.isArray(v)?v.map(f).filter(x=>x!==undefined):undefined;
const setDays=v=>setList(v,d=>Number.isInteger(d)&&d>=0&&d<=6?d:undefined);
const setDate=d=>typeof d==='string'&&REC_DATE.test(d)?d:undefined;
const setDay=x=>{const o=setFields(x,{d:setDate,n:n=>setStr(n,1000)});return o&&o.d?o:undefined};   // (a holiday's names joined: tidy keeps each at 120)
const setKey=k=>typeof k==='string'&&REC_KEY.test(k)?k:undefined;
const SHOP_SKIP_RE=/^[A-Za-z0-9_-]{1,40}\|[A-Za-z0-9_-]{0,40}\|[A-Za-z0-9_-]{0,40}$/;
/* an own color or pattern: its key by the one rule, else left out; need = fields it can't be without */
const setOwn=(re,more,need)=>x=>{if(!x||typeof x!=='object'||typeof x.key!=='string'||!re.test(x.key))return undefined;
  const o=setFields(x,{key:k=>k,name:n=>setStr(n,60),base:setKey,types:t=>setList(t,setKey)||[],...more});return need.every(k=>o[k]!==undefined)?o:undefined};
const SET_CLEAN={workdays:setDays,blazerDays:setDays,
  holidays:v=>v===null?null:setFields(v,{country:c=>typeof c==='string'&&/^[A-Z]{2}$/.test(c)?c:'',list:l=>setList(l,setDay)||[],skip:l=>setList(l,setDate)||[],fetched:n=>typeof n==='number'&&isFinite(n)?n:0}),
  daysOff:v=>setList(v,setDay),
  shopSkip:v=>setList(v,k=>typeof k==='string'&&SHOP_SKIP_RE.test(k)?k:undefined),
  custom:v=>setFields(v,{colors:l=>setList(l,setOwn(OWN_COL_RE,{hex:h=>typeof h==='string'&&/^#[0-9a-f]{6}$/i.test(h)?h:undefined},['hex'])),
    patterns:l=>setList(l,setOwn(OWN_PAT_RE,{desc:d=>setStr(d,150),look:recStrict},[]))}),
  ownMaterials:v=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).filter(([t,l])=>t!=='__proto__'&&REC_KEY.test(t)&&Array.isArray(l)).map(([t,l])=>[t,l.filter(m=>typeof m==='string'&&ownMatName(m)===m)])):undefined,
  // the calendar link (calendar.js; kept only as a webcal/https link of up to 2048 characters) and the events kept or dismissed {id: 'k'|'x'}
  calendar:v=>v===null?null:setFields(v,{url:u=>typeof u==='string'&&u.length<=2048&&/^(webcals?|https?):\/\/[^\s<>"`]+$/i.test(u)?u:undefined,at:n=>typeof n==='number'&&isFinite(n)?n:0}),
  calSeen:v=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).filter(([k,x])=>/^[0-9a-f]{16}$/.test(k)&&(x==='k'||x==='x'))):undefined,
  tagStats:v=>setFields(v,{n:n=>typeof n==='number'&&isFinite(n)?n:0,wrong:w=>w&&typeof w==='object'&&!Array.isArray(w)?Object.fromEntries(Object.entries(w).filter(([k,x])=>k!=='__proto__'&&REC_KEY.test(k)&&typeof x==='number'&&isFinite(x))):{}})};
/* a settings copy from outside -> the same copy when every setting is clean, else a cleaned copy (null for one that isn't an object) */
function cleanSettings(s){if(!s||typeof s!=='object'||Array.isArray(s))return null;let o=null;
  for(const [k,v] of Object.entries(s)){if(SET_META.includes(k))continue;
    const c=k==='__proto__'||!REC_WORD.test(k)?undefined:(SET_CLEAN[k]||recFree)(v);
    if(c!==undefined&&setHash(c)===setHash(v))continue;   // already clean: kept as it is
    o=o||{...s};if(c===undefined)delete o[k];else o[k]=c}
  return o||s}
