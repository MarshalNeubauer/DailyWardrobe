/* Daily Wardrobe: the "New Look editor (beta)" (2026-11-17, the owner's approved design: C:\code\audit-2026-11-13\look-mockup\look-mockup.html,
   from the color & texture audit C:\code\audit-2026-11-13\picker-audit\AUDIT.md). One Look section, the same for every type, on the Add card
   and in the item sheet: Color, Pattern and Material rows (a swatch, the value and a chevron), each opening the one picker sheet (colpick.js
   #col-sheet); Claude's and the measurement's suggestions on the row they change; one "Read with Claude" for all three. A Settings switch
   (Photo tagging → Beta features) turns it on for this phone only (localStorage beta_look, not synced); off, the app is exactly as before.
   Both UIs read and write the same item fields; the beta's own fields (lookOk, lookHint, leatherOwn, metalOwn) are ignored by the old UI.
   Loaded after checklist.js; nothing runs at load but Settings' registration. */

/* ---- the switch ---- */
const LOOK_LS='beta_look';
let lookBetaMemo=null;
function lookOn(){if(lookBetaMemo===null){try{lookBetaMemo=localStorage.getItem(LOOK_LS)==='1'}catch{lookBetaMemo=false}}return lookBetaMemo}
/* flipping it redraws what is open (Add, the no-photo sheet, the item sheet); nothing is saved or lost either way */
function lookSet(on){on=!!on;try{if(on)localStorage.setItem(LOOK_LS,'1');else localStorage.removeItem(LOOK_LS)}catch{}lookBetaMemo=on;
  try{if(colPick)closeColPick()}catch{}
  try{renderAdd()}catch{}
  try{if(editing)renderWardrobe()}catch{}
  try{renderLookSetting();renderOwnMatUI()}catch{}
  announce(on?'New Look editor on.':'New Look editor off.')}
function renderLookSetting(){const el=document.querySelector('#beta-list');if(!el)return;const on=lookOn();
  el.innerHTML=`<div class="dress-row"><span class="dress-txt"><b id="beta-look-l">New Look editor (beta)</b><small id="beta-look-h">One Look section for color, pattern and material when you add or open an item. This phone only; switch it off any time and nothing is lost.</small></span><button type="button" class="dress-sw${on?' on':''}" id="beta-look" role="switch" aria-checked="${on}" aria-labelledby="beta-look-l" aria-describedby="beta-look-h" data-act="lkSwitch" data-on="${!on}"><i></i></button></div>`}
settingsPart(renderLookSetting);

/* ---- which types have what ---- */
const LOOK_CU=['sweater','qzip','cardigan','polo','socks','pocketsquare','overcoat','raincoat'];   // also take a close-up in the beta
const LOOK_COATS=['overcoat','raincoat'];   // patterns and a second color in the beta (core.js PATS_BY)
const LOOK_NOPAT=['shoes','belt','watch','tieclip','cufflinks'];   // the Pattern row is there, dimmed, so the three rows never move
const LOOK_METALT=['watch','tieclip','cufflinks'];
const LOOK_CLIP_METALS=['silver','gold','rosegold','gunmetal'];   // a tie clip's metal: its colour key when it has no enamel (planner.js clipMetal reads it)
const LOOK_ENAMEL=['black','red','blue','navy'];   // the clip colours clipMetal reads as enamel (null): the planner's enamelPref
const LOOK_METAL_COLS=['silver','gold','rosegold','gunmetal'];   // no shade for a metal
const lookCu=t=>TEXTURE_TYPES.includes(t)||(lookOn()&&LOOK_CU.includes(t));
const lookHasPat=t=>hasPat(t)||(lookOn()&&LOOK_COATS.includes(t));
const lookMatKind=t=>t==='shoes'||t==='belt'?'leather':LOOK_METALT.includes(t)?'metal':'fabric';
const lookItem=(src,id)=>src==='q'?queue.find(x=>x&&x.id===id):items.find(x=>x.id===id);
const lookNoun=t=>({shoes:'shoes',belt:'belts',watch:'watches',tieclip:'tie clips',cufflinks:'cufflinks'})[t]||'this item';

/* ---- second and third colours follow the pattern (as socks already did): what each is for ---- */
const LOOK_NEED0=['solid','twill','herringbone','heather','cable','knit','fine-texture','ribbed'];
const LOOK_NEED2=['argyle','tattersall','glen-check','check','paisley','camouflage','other'];
const LOOK_FOR2={pinstripe:'the stripes','chalk-stripe':'the stripes',stripe:'the stripes','fine-stripe':'the stripes',gingham:'the checks',windowpane:'the pane lines',
  houndstooth:'the teeth','polka-dot':'the dots',foulard:'the motif',border:'the border','end-on-end':'the light threads',chambray:'the weft threads',oxford:'the second threads',
  pinpoint:'the second threads','royal-oxford':'the second threads',birdseye:'the dots',nailhead:'the dots',sharkskin:'the second tone',dobby:'the woven figure',woven:'the second threads',
  textured:'the slubs',tweed:'the flecks','tonal-check':'the lighter shade',argyle:'the diamonds',tattersall:'the first lines','glen-check':'the check',check:'the lines',
  paisley:'the motif',camouflage:'the second blotches',other:'the second color',clock:'the clock motif',ribbed:'the ribs',herringbone:'the second threads',heather:'the flecks',cable:'the cables'};
const LOOK_FOR3={argyle:'the lines over them',tattersall:'the second lines','glen-check':'the overcheck',check:'the second lines',paisley:'the third color',camouflage:'the third blotches',
  other:'the third color',stripe:'the third stripes'};
const lookPatOf=it=>patBase(normPat(it.type,it.pattern))||'solid';
function lookNeed(it){const t=it.type,p=lookPatOf(it);
  if(t==='socks')return p==='solid'?0:SOCK_THIRD.includes(p)?2:1;   // as the socks' rule (colpick.js colShows)
  if(!lookHasPat(t))return 0;return LOOK_NEED0.includes(p)?0:LOOK_NEED2.includes(p)?2:1}

/* ---- material: the fabric, the leather (shoes, belts) or the metal (watches, tie clips, cufflinks; a belt's buckle) ---- */
/* a shirt's material is its fiber (the owner's question 2 on the mockup); the weaves are its patterns. The cotton cloths that plan a season
   (flannel and corduroy cold, seersucker warm: core.js MAT_SEASON) or name a cloth a pattern can't (denim, jersey) stay pickable as cloths.
   A shirt saved as poplin (a cotton weave: solid in PAT_ALIAS) shows as Cotton until a material is picked; nothing is rewritten */
const LOOK_SHIRT_FIBERS=['cotton','cotton blend','linen','linen blend','silk','wool','polyester','polyester blend','performance stretch','rayon','modal','lyocell','bamboo'];
const LOOK_SHIRT_CLOTHS=['flannel','seersucker','corduroy','denim','jersey'];
const LOOK_SHIRT_AS={poplin:'cotton'};
const LOOK_LEATHER_G=[['Smooth and grained',['calf','cordovan','patent','pebble-grain','scotch-grain','braided']],['Suede and textiles',['suede','nubuck','canvas','knit']]];
/* the own list a kind keeps its names under (settings.ownMaterials {key: [name]}, synced entry by entry), and the group that shares them
   (own-lists.js COL_GROUPS, as own colours; the metals of watches, tie clips, cufflinks and buckles together) */
const lookOwnKey=(t,k)=>k==='buckle'?'buckle':t;
const lookGroup=key=>key==='buckle'||LOOK_METALT.includes(key)?['watch','tieclip','cufflinks','buckle']:groupOf(key);
const lookOwnRaw=key=>{const o=settings&&settings.ownMaterials,l=o&&typeof o==='object'&&Array.isArray(o[key])?o[key]:[];return l.map(ownMatName).filter(Boolean)};
function lookBuiltins(it,k){const t=it.type;
  if(k==='material')return t==='shirt'?[...LOOK_SHIRT_FIBERS,...LOOK_SHIRT_CLOTHS]:(MATERIALS_BY[t]||[]).slice();
  if(k==='leather')return leathersFor(it).slice();
  if(t==='tieclip')return LOOK_CLIP_METALS.slice();
  return [...Object.keys(METAL),...(t==='cufflinks'&&k==='metal'?['silk']:[])]}
function lookOwnMats(it,k){const key=lookOwnKey(it.type,k),std=lookBuiltins(it,k),out=[];
  for(const g of lookGroup(key))for(const n of lookOwnRaw(g))if(!std.includes(n)&&!out.includes(n))out.push(n);return out}
/* the kind of the picker for a field key */
const lookPkKind=(it,k)=>k==='material'?'fabric':k==='leather'?'leather':'metal';
/* the value shown for a field: {v (the picker's key: a built-in key, 'own:<name>', 'none'), name, note} */
function lookCur(it,k){
  if(k==='enamel'){const c=it.primaryColor;return LOOK_ENAMEL.includes(c)?c:'none'}
  if(k==='dial')return watchOpts(it).dial;
  return lookVal(it,k).v}
function lookVal(it,k){const t=it.type;
  if(k==='material'){const m=String(it.material||'').trim(),l=lookBuiltins(it,'material');if(!m)return {v:'none',name:'Not set'};
    if(t==='shirt'&&LOOK_SHIRT_AS[m.toLowerCase()])return {v:LOOK_SHIRT_AS[m.toLowerCase()],name:cap1(LOOK_SHIRT_AS[m.toLowerCase()]),note:`saved as ${m.toLowerCase()}`};
    if(l.includes(m))return {v:m,name:cap1(m)};return {v:'own:'+m,name:cap1(m)}}
  if(k==='leather'){if(it.leatherOwn)return {v:'own:'+it.leatherOwn,name:cap1(it.leatherOwn)};
    // (an Add card with none yet is saved as calf, add.js saveCard, unless None was picked: leatherNone)
    const l=it.leather||(it.leatherNone||items.some(x=>x.id===it.id)?'':'calf');if(!l)return {v:'none',name:'Not set'};
    return {v:l,name:cap1(leatherWord(it,l))}}
  if(t==='tieclip'){if(it.metalOwn)return {v:'own:'+it.metalOwn,name:cap1(it.metalOwn)};const m=lookClipMetal(it),pc=it.primaryColor;
    return {v:m,name:cap1(colName(m)),note:pc&&!LOOK_CLIP_METALS.includes(pc)&&!LOOK_ENAMEL.includes(pc)?`saved as ${colName(pc)}`:''}}
  if(it.metalOwn)return {v:'own:'+it.metalOwn,name:cap1(it.metalOwn)};const m=it.metal||'silver';return {v:m,name:cap1(metalWord(m))}}
/* a tie clip's metal: its colour when that is a metal (a plain clip), the colours the planner reads as silver or gunmetal, else (an enamel
   clip) the metal kept beside it (it.metal; silver when none) */
function lookClipMetal(it){const pc=it.primaryColor;if(LOOK_CLIP_METALS.includes(pc))return pc;const cm=clipMetal(it);if(cm==='silver')return 'silver';if(cm==='other')return 'gunmetal';
  return LOOK_CLIP_METALS.includes(it.metal)?it.metal:'silver'}
const LOOK_OTHER='+other';   // the picker's Other tile (not the metal key 'other', which is gunmetal)
const lookName=(it,k,v)=>v==='none'?(k==='enamel'?'None':'Not set'):v===LOOK_OTHER?'Other':String(v).startsWith('own:')?cap1(String(v).slice(4)):k==='leather'?cap1(leatherWord(it,v)):LOOK_METALT.includes(it.type)||k==='buckle'||k==='metal'?cap1(it.type==='tieclip'?colName(v):metalWord(v)):cap1(v);

/* a drawn swatch of a material (no photos: every theme, any size); kind 'fabric' | 'leather' | 'metal', hex the item's colour */
let lookSwN=0;
const LOOK_ROSE=['#f6dcd2','#c98f7a','#8a5644'];
function lookMatSw(kind,v,hex){const n='lk'+(++lookSwN),k=String(v||'');hex=hex||'#8b8f96';
  if(k==='none')return `<svg viewBox="0 0 40 40" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><pattern id="${n}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--bg)"/><rect width="1.4" height="6" fill="var(--line)"/></pattern></defs><rect width="40" height="40" fill="url(#${n})"/></svg>`;
  if(k===LOOK_OTHER)return `<svg viewBox="0 0 40 40" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="40" height="40" fill="var(--bg)"/><text x="20" y="27" text-anchor="middle" font-size="20" font-weight="700" fill="var(--mut)">?</text></svg>`;
  const w=k.replace(/^own:/,'').toLowerCase();
  if(kind==='metal'){if(w==='silk')return `<svg viewBox="0 0 40 40" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="40" height="40" fill="${hex}"/><circle cx="14" cy="20" r="8" fill="${hex}" stroke="rgba(0,0,0,.35)"/><circle cx="27" cy="20" r="8" fill="${hex}" stroke="rgba(0,0,0,.35)"/><path d="M8 17q6 4 12 0M21 17q6 4 12 0" stroke="rgba(255,255,255,.35)" fill="none"/></svg>`;
    const T=w==='rosegold'?LOOK_ROSE:w==='gunmetal'?METAL_TONES.other:METAL_TONES[w]||METAL_TONES.silver,two=w==='two-tone';
    return `<svg viewBox="0 0 40 40" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="${n}" x2="1" y2="1"><stop stop-color="${T[0]}"/><stop offset=".55" stop-color="${T[1]}"/><stop offset="1" stop-color="${T[2]}"/></linearGradient></defs><rect width="40" height="40" fill="url(#${n})"/>${two?`<rect x="15" width="10" height="40" fill="${METAL_TONES.gold[1]}" opacity=".85"/>`:''}<path d="M4 34L34 4" stroke="rgba(255,255,255,.45)" stroke-width="2"/></svg>`}
  let over='';
  if(kind==='leather'){
    over=/suede|nubuck/.test(w)?`<defs><filter id="${n}"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .35 0"/></filter></defs><rect width="40" height="40" filter="url(#${n})"/>`
      :/grain/.test(w)?Array.from({length:30},(_,j)=>`<circle cx="${(j*13)%40+2}" cy="${(j*7+((j*5)%11))%40+2}" r="${w==='pebble-grain'?2.2:1.2}" fill="rgba(0,0,0,.18)"/>`).join('')
      :w==='braided'?`<path d="M0 10L10 0M0 20L20 0M0 30L30 0M0 40L40 0M10 40L40 10M20 40L40 20M30 40L40 30M0 0L40 40M0 10L30 40M0 20L20 40M10 0L40 30M20 0L40 20" stroke="rgba(0,0,0,.28)" stroke-width="2"/>`
      :/canvas/.test(w)?Array.from({length:10},(_,j)=>`<path d="M0 ${j*4+2}H40M${j*4+2} 0V40" stroke="rgba(0,0,0,.14)"/>`).join('')
      :w==='knit'?Array.from({length:8},(_,j)=>`<path d="${Array.from({length:8},(_,x)=>`M${x*5} ${j*5}l2.5 4 2.5-4`).join('')}" stroke="rgba(0,0,0,.2)" fill="none"/>`).join('')
      :`<defs><radialGradient id="${n}" cx=".3" cy=".25" r=".8"><stop stop-color="#fff" stop-opacity="${w==='patent'?'.75':w==='cordovan'?'.4':'.28'}"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="40" height="40" fill="url(#${n})"/>${w==='patent'?'<path d="M6 34Q18 12 36 8" stroke="rgba(255,255,255,.7)" stroke-width="2" fill="none"/>':''}`}
  else{
    over=/linen|slub/.test(w)?Array.from({length:10},(_,j)=>`<path d="M0 ${j*4+1.5}H40" stroke="rgba(255,255,255,.14)" stroke-width="${j%3?1:1.8}"/>`).join('')
      :/corduroy/.test(w)?Array.from({length:10},(_,j)=>`<rect x="${j*4}" width="2.2" height="40" fill="rgba(0,0,0,.18)"/>`).join('')
      :/silk|shantung|satin|velvet|rayon|modal|lyocell/.test(w)?`<defs><linearGradient id="${n}" x2="1" y2="1"><stop stop-color="#fff" stop-opacity=".32"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient></defs><rect width="40" height="40" fill="url(#${n})"/>`
      :/jersey|knit|piqu|fleece|terry|waffle/.test(w)?Array.from({length:8},(_,j)=>`<path d="${Array.from({length:8},(_,x)=>`M${x*5} ${j*5}l2.5 4 2.5-4`).join('')}" stroke="rgba(0,0,0,.16)" fill="none"/>`).join('')
      :/tweed|loden|shetland|alpaca|mohair/.test(w)?Array.from({length:36},(_,j)=>`<rect x="${(j*17)%40}" y="${(j*11)%40}" width="2" height="1.2" fill="${j%2?'rgba(255,255,255,.25)':'rgba(0,0,0,.22)'}"/>`).join('')
      :/wool|flannel|melton|cashmere|camel|gabardine|twill|denim|hopsack|serge/.test(w)?Array.from({length:14},(_,j)=>`<path d="M${j*4-20} 40L${j*4+20} 0" stroke="rgba(0,0,0,${/denim|twill|gabardine/.test(w)?'.2':'.12'})" stroke-width="1.2"/>`).join('')
      :Array.from({length:14},(_,j)=>`<path d="M0 ${j*3}H40M${j*3} 0V40" stroke="rgba(0,0,0,.07)"/>`).join('')}
  return `<svg viewBox="0 0 40 40" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="40" height="40" fill="${hex}"/>${over}</svg>`}

/* ---- Claude's and the measurement's suggestions, on the row they change ---- */
/* the Add card's (q) come from the card's own reading (tagging.js / measure.js: altColor, the verdicts, newColor, altPattern, missed,
   newPattern, matGuess, matNew); a saved item's from item.lookHint (kept when the card was saved in the beta, or by Read with Claude)
   or, for an item saved before, Claude's runner-ups in item.tagAI. Hidden once the Look is checked ("Looks right") */
const lookColOk=(it,c)=>!!c&&!!COLORS[c]&&c!==primaryCol(it)&&(colsFor(it.type).includes(c)||!!CUSTOM_COL[c]);
function lookChips(src,it){const out={col:[],pat:[],mat:[]};if(it.type==='tieclip'||it.type==='watch')return out;
  if(src==='q'){const q=it;if(q.manual||(q.checked&&q.checked.lk))return out;
    const mv=q.meas?colourVerdicts(q):[],fl=mv.find(v=>v.f==='primaryColor'&&v.mode==='flag'&&!(q.edited&&q.edited.primaryColor)&&!(q.auto&&q.auto.primaryColor)),m=fl&&lookColOk(q,fl.to)?fl.to:null;
    const a=lookColOk(q,q.altColor)?q.altColor:null,rk=q.refineKept&&lookColOk(q,q.refineKept.c)?q.refineKept.c:null;
    if(a&&a===m)out.col.push({lab:'Claude & measured',v:a,f:'primaryColor'});else{if(a)out.col.push({lab:'Claude',v:a,f:'primaryColor'});if(m)out.col.push({lab:'Measured',v:m,f:'primaryColor'})}
    if(rk&&rk!==a&&rk!==m)out.col.push({lab:'Claude, from the close-up',v:rk,f:'primaryColor'});
    if(q.newColor&&q.newColor.name)out.col.push({lab:'Claude',add:'col',name:q.newColor.name});
    const pl=PATS_BY[q.type]||[],ap=q.altPattern&&pl.includes(q.altPattern)&&q.altPattern!==q.pattern?q.altPattern:null;if(ap)out.pat.push({lab:'Claude',or:1,v:ap,f:'pattern'});
    const mp=q.missed&&q.raw&&q.missed.c===q.raw.tex?q.missed.p:null;if(mp&&mp!==ap&&lookPatOf(q)==='solid'&&!(q.edited&&q.edited.pattern))out.pat.push({lab:'Measured',v:mp,f:'pattern'});
    if(q.newPattern&&q.newPattern.name)out.pat.push({lab:'Claude',add:'pat',name:q.newPattern.name});
    const kind=lookMatKind(q.type);
    if(kind==='fabric'){const g=matGuessOf(q),nm=matNewOf(q);if(g)out.mat.push({lab:'Claude’s guess',v:lookFiber(q,g.key),f:'material',why:g.why});if(nm)out.mat.push({lab:'Claude',add:'mat',name:nm.key,why:nm.why})}
    const h=q.lookHint&&q.lookHint.mat;if(h&&kind!=='fabric'&&h.key)out.mat.push({lab:'Claude’s guess',v:h.key,f:kind==='leather'?'leather':'metal'});
    return out}
  if(it.lookOk)return out;const h=it.lookHint||{},ai=it.tagAI||{},had=it.lookHint!==undefined;
  const a=lookColOk(it,h.c)?h.c:!had&&ai.col&&ai.col===primaryCol(it)&&lookColOk(it,ai.alt)?ai.alt:null,m=lookColOk(it,h.m)?h.m:null;
  if(a&&a===m)out.col.push({lab:'Claude & measured',v:a,f:'primaryColor',hk:'c'});else{if(a)out.col.push({lab:'Claude',v:a,f:'primaryColor',hk:'c'});if(m)out.col.push({lab:'Measured',v:m,f:'primaryColor',hk:'m'})}
  if(h.nc&&h.nc.name)out.col.push({lab:'Claude',add:'col',name:h.nc.name,hk:'nc'});
  const pl=PATS_BY[it.type]||[],cp=normPat(it.type,it.pattern),ap=h.p&&pl.includes(h.p)&&h.p!==cp?h.p:!had&&ai.altPat&&pl.includes(ai.altPat)&&ai.altPat!==cp?ai.altPat:null;
  if(ap)out.pat.push({lab:'Claude',or:1,v:ap,f:'pattern',hk:'p'});
  if(h.np&&h.np.name)out.pat.push({lab:'Claude',add:'pat',name:h.np.name,hk:'np'});
  if(h.mat&&h.mat.key){const kind=lookMatKind(it.type),f=kind==='fabric'?'material':kind==='leather'?'leather':'metal',cur=lookVal(it,f).v;
    if(h.mat.isNew)out.mat.push({lab:'Claude',add:'mat',name:h.mat.key,why:h.mat.why,hk:'mat'});else if(h.mat.key!==cur)out.mat.push({lab:'Claude',v:h.mat.key,f,why:h.mat.why,hk:'mat'})}
  return out}
/* a shirt's material as a fiber (poplin is cotton) */
const lookFiber=(it,k)=>it.type==='shirt'&&LOOK_SHIRT_AS[k]?LOOK_SHIRT_AS[k]:k;
/* the hints kept on a card saved in the beta (its runner-ups, for the item sheet until used or checked) */
function lookHintOf(q){const c=lookChips('q',q),h={};
  for(const x of c.col){if(x.add)h.nc={name:x.name,hex:newColHex(q)};else if(x.lab==='Measured')h.m=x.v;else if(!h.c)h.c=x.v;if(x.lab==='Claude & measured')h.m=x.v}
  for(const x of c.pat){if(x.add)h.np={name:x.name,desc:q.newPattern&&q.newPattern.why||''};else if(!h.p)h.p=x.v}
  for(const x of c.mat){h.mat=x.add?{key:x.name,why:x.why||'',isNew:1}:{key:x.v,why:x.why||''};break}
  return Object.keys(h).length?h:null}
function lookChipHtml(src,it,x){const r=`'${src}','${jsq(it.id)}'`;let sw='',name='',txt;
  if(x.add){name=x.name;sw=x.add==='col'?`<i class="lkdot" style="background:${esc(cnHex(it.newColor&&COLORS[it.primaryColor]?COLORS[it.primaryColor]:'')||(it.lookHint&&it.lookHint.nc&&cnHex(it.lookHint.nc.hex))||COLORS[primaryCol(it)]||'#888')}"></i>`:x.add==='pat'?`<i class="lkdot">${swatchSVG(it,true)}</i>`:`<i class="lkdot">${lookMatSw('fabric',x.name,COLORS[primaryCol(it)])}</i>`;
    txt=`<em>${esc(x.lab)}:</em> ${esc(x.name.toLowerCase())}? <span class="lkuse">Add</span>`;
    return `<button type="button" class="lkchip lkadd" data-chip="${x.add}" data-src="${src}" data-id="${esc(it.id)}" data-add="${esc(x.add)}" data-act="lkAddChip">${sw}<span class="lkct">${txt}</span></button>`}
  if(x.f==='primaryColor'){sw=`<i class="lkdot" style="background:${COLORS[x.v]}"></i>`;name=colName(x.v).toLowerCase()}
  else if(x.f==='pattern'){sw=`<i class="lkdot">${swatchSVG(patVar(it,x.v),true)}</i>`;name=patName(x.v).toLowerCase()}
  else{sw=`<i class="lkdot">${lookMatSw(lookPkKind(it,x.f),x.v,COLORS[primaryCol(it)])}</i>`;name=lookName(it,x.f,x.v)}
  txt=`<em>${esc(x.lab)}:</em> ${x.or?'or ':''}${esc(x.f==='material'||x.f==='leather'||x.f==='metal'?name:name)}?`;
  return `<button type="button" class="lkchip" data-chip="${x.f}" data-src="${src}" data-id="${esc(it.id)}" data-f="${esc(x.f)}" data-v="${esc(x.v)}" data-hk="${esc(x.hk||'')}" data-act="lkUse">${sw}<span class="lkct">${txt}</span><span class="lkuse">Use</span></button>`}
const lookChipsHtml=(src,it,l)=>l.length?`<div class="lkchips">${l.map(x=>lookChipHtml(src,it,x)).join('')}</div>`:'';

/* ---- fields written, with Undo ---- */
const lookSnap=(it,fs)=>Object.fromEntries(fs.map(f=>[f,it[f]===undefined?undefined:JSON.parse(JSON.stringify(it[f]))]));
async function lookRestore(src,id,snap){const it=lookItem(src,id);if(!it)return;const pat=it.pattern,col=it.primaryColor;
  for(const [k,v] of Object.entries(snap)){if(v===undefined)delete it[k];else it[k]=v}
  if(src==='q'){if(it.pattern!==pat)try{readSett(it)}catch{}if(it.primaryColor!==col&&it.texCanvas)try{generateSwatch(it)}catch{}queueMicrotask(addKeep);renderAdd()}
  else{if(it.sample)it.sampleMine=1;if(it.primaryColor!==col&&it.swSrc==='tex')await refreshSwatch(it);await put(it);planDirty();renderWardrobe()}}
/* o: {field: value} (undefined or null: the field goes) */
async function lookWrite(src,id,o){const it=lookItem(src,id);if(!it){if(src==='e')itemGoneTell(id);return null}
  for(const [k,v] of Object.entries(o)){if(v===undefined||v===null)delete it[k];else it[k]=v}
  if('primaryColor' in o)delete it.color;
  if(src==='q'){it.edited={...it.edited,...Object.fromEntries(Object.keys(o).map(k=>[k,true]))};queueMicrotask(addKeep);renderAdd()}
  else{if(it.sample)it.sampleMine=1;await put(it);planDirty();renderWardrobe()}
  return it}
const LOOK_UNDO_F=['primaryColor','color','shade','secondaryColor','tertiaryColor','pattern','sett','stripes','patternSpec','weave','material','matSet','matAI','matGuess','matNew','leather','leatherOwn','leatherNone','metal','metalOwn','dial','lookHint','newColor','newPattern'];
const LOOK_FIELD_WORD={primaryColor:'Color',pattern:'Pattern',material:'Material',leather:'Leather',metal:'Metal',buckle:'Buckle',dial:'Dial',enamel:'Enamel'};
/* a chip's Use: the field set (as a pick would), the hint it came from dropped, a toast with Undo */
async function lookUse(src,id,f,v,hk){const it=lookItem(src,id);if(!it)return;const snap=lookSnap(it,LOOK_UNDO_F);
  if(src==='e'&&hk&&it.lookHint){const h={...it.lookHint};delete h[hk];it.lookHint=h}
  const name=lookName(it,f,v);
  if(f==='primaryColor'||f==='pattern'){if(src==='q'){const i=qAt(id);if(i<0)return;setq(i,f,v)}else await sete(id,f,v)}
  else if(f==='material'){if(src==='q'){if(it.matGuess&&lookFiber(it,it.matGuess.key)===v)delete it.matGuess;await lookWrite('q',id,{material:v,matSet:1,matAI:undefined})}else await lookWrite('e',id,{material:v})}
  else await lookSetMat(src,id,f,v,true);
  toast(`${LOOK_FIELD_WORD[f]||'Look'}: ${f==='primaryColor'?cap1(colName(v)):f==='pattern'?cap1(patName(v)):name}.`,6000,{label:'Undo',fn:()=>lookRestore(src,id,snap)})}
/* a chip's Add: Claude's new colour, pattern or material (the New color / New pattern sheet with its name; a material added at once) */
async function lookAddChip(src,id,kind){const it=lookItem(src,id);if(!it)return;
  if(kind==='col'){if(src==='q'){openColForm(qAt(id));return}const nc=it.lookHint&&it.lookHint.nc;if(!nc)return;openColPick('e',id,'primaryColor');openColNew({from:'add',name:nc.name,hex:nc.hex})}
  else if(kind==='pat'){if(src==='q'){openPatForm(qAt(id));return}const np=it.lookHint&&it.lookHint.np;if(!np)return;openColPick('e',id,'pattern');openPatNew({from:'add',name:np.name,desc:np.desc||'',base:np.base||null})}
  else{if(src==='q'){matOffer(qAt(id));return}const m=it.lookHint&&it.lookHint.mat;if(!m)return;const snap=lookSnap(it,LOOK_UNDO_F),n=await lookAddOwn(it.type,'material',m.key);if(!n)return;
    const h={...it.lookHint};delete h.mat;it.lookHint=h;await lookWrite('e',id,{material:n});
    toast(`${cap1(n)} added to your ${matTypeWord(it.type)} materials.`,6000,{label:'Undo',fn:async()=>{await lookRestore('e',id,snap);await lookDropOwn(it.type,'material',n)}})}}

/* ---- own materials (2026-11-17, the beta: "+ New material", a typed Other kept, shared by a group of types) ---- */
async function lookAddOwn(t,k,name){const n=ownMatName(name);if(!n){toast('Use 2 to 24 letters, spaces or hyphens, at most 3 words.',5000);return ''}
  const it={type:t};if(lookBuiltins(it,k).includes(n))return n;const key=lookOwnKey(t,k);
  if(k==='material'&&MATERIALS_BY[t])return await addOwnMaterial(t,n);   // (own-lists.js: the type's list, sorted, at most OWN_MAT_MAX)
  const cur=lookOwnRaw(key);if(cur.includes(n))return n;if(cur.length>=OWN_MAT_MAX){toast(`You have ${OWN_MAT_MAX} of your own here: remove one in Settings first.`,5000);return ''}
  const o=settings.ownMaterials&&typeof settings.ownMaterials==='object'?settings.ownMaterials:{};settings.ownMaterials={...o,[key]:[...cur,n].sort()};await saveUserSettings();return n}
async function lookDropOwn(t,k,name){const key=lookOwnKey(t,k);if(k==='material'&&MATERIALS_BY[t])return removeOwnMaterial(t,name);
  const o=settings.ownMaterials&&typeof settings.ownMaterials==='object'?settings.ownMaterials:{},l=lookOwnRaw(key).filter(x=>x!==name),nx={...o};
  if(l.length)nx[key]=l;else delete nx[key];if(Object.keys(nx).length)settings.ownMaterials=nx;else delete settings.ownMaterials;await saveUserSettings();renderOwnMatUI()}

/* Settings → Photo tagging → Your materials with the beta on: the leathers and metals kept too, and "+ New material" (a type, a name, Add) */
const LOOK_OWN_KEYS=[['shoes','Shoes'],['belt','Belt'],['buckle','Belt buckle'],['watch','Watch'],['tieclip','Tie clip'],['cufflinks','Cufflinks']];
let lookOwnForm=false;
function lookOwnMatUI(){const rows=[];
  for(const [key,lab] of LOOK_OWN_KEYS)for(const m of lookOwnRaw(key))rows.push(`<div class="custrow ownmatrow" data-t="${esc(key)}" data-m="${esc(m)}"><span><b>${esc(cap1(m))}</b><br><small class="mut">${esc(lab)}</small></span><button type="button" aria-label="Remove ${esc(m)} from your ${esc(lab.toLowerCase())} materials" data-key="${esc(key)}" data-m="${esc(m)}" data-act="lkOwnRm">Remove</button></div>`);
  const fors=[...Object.keys(MATERIALS_BY).map(t=>[t,TYPES[t]||t]),...LOOK_OWN_KEYS];
  const form=lookOwnForm?`<div class="lkform lkownf" id="ownmat-form"><label for="ownmat-for">For</label><select id="ownmat-for">${fors.map(([t,l])=>`<option value="${esc(t)}">${esc(l)}</option>`).join('')}</select><label for="ownmat-name">Name</label><input type="text" id="ownmat-name" dir="auto" maxlength="24" autocomplete="off" placeholder="e.g. cupro, shell cordovan, titanium"><p class="cnbarerr lkerr" id="ownmat-err" role="alert" hidden></p><div class="btns"><button type="button" class="pri" id="ownmat-add" data-act="lkOwnAdd">Add</button><button type="button" data-act="lkOwnCancel">Cancel</button></div></div>`
    :`<div class="custadd"><button type="button" id="ownmat-new" data-act="lkOwnOpen">+ New material</button></div>`;
  return rows.join('')+form}
async function lookOwnAddForm(){const t=($('#ownmat-for')||{}).value,raw=($('#ownmat-name')||{}).value||'',n=ownMatName(raw),err=$('#ownmat-err');
  if(!t||!n){if(err){err.hidden=false;err.textContent=raw.trim()?'Use 2 to 24 letters, spaces or hyphens, at most 3 words.':'Give it a name first.'}return}
  const k=t==='buckle'?'buckle':t==='shoes'||t==='belt'?'leather':LOOK_METALT.includes(t)?'metal':'material',got=await lookAddOwn(t==='buckle'?'belt':t,k,n);if(!got)return;
  lookOwnForm=false;renderOwnMatUI();toast(`${cap1(got)} added to your materials.`,4000)}
async function lookOwnRemove(key,name){await lookDropOwn(key==='buckle'?'belt':key,key==='buckle'?'buckle':key==='shoes'||key==='belt'?'leather':'metal',name);renderOwnMatUI()}

/* ---- setting a material, a leather, a metal, a buckle, the enamel (v: a built-in key, 'own:<name>', 'none') ---- */
async function lookSetMat(src,id,k,v,quiet){const it=lookItem(src,id);if(!it)return;const t=it.type,own=String(v).startsWith('own:')?String(v).slice(4):null;
  if(own){const n=ownMatName(own);if(n&&!lookBuiltins(it,k).includes(n)&&!lookOwnRaw(lookOwnKey(t,k)).includes(n)&&lookOwnMats(it,k).includes(n))await lookAddOwn(t,k,n)}   // one made for another type of the group: offered for this one too
  if(k==='material'){const m=own!==null?own:v==='none'?'':v;return lookWrite(src,id,src==='q'?{material:m||undefined,matSet:1,matAI:undefined}:{material:m||undefined})}
  if(k==='leather'){if(v==='none')return lookWrite(src,id,{leather:undefined,leatherOwn:undefined,...(src==='q'?{leatherNone:1}:{})});
    if(own!==null)return lookWrite(src,id,{leatherOwn:own,leather:it.leather||'calf',leatherNone:undefined});return lookWrite(src,id,{leather:v,leatherOwn:undefined,leatherNone:undefined})}
  if(t==='tieclip'&&k==='metal'){if(own!==null)return lookWrite(src,id,{metalOwn:own});
    // the planner reads a plain clip's metal from its colour (clipMetal): a clip with no enamel takes the metal as its colour, as the old
    // Color field did; an enamel clip keeps its enamel colour and the metal beside it (it.metal, which the planner never reads for a clip)
    return lookWrite(src,id,lookCur(it,'enamel')==='none'?{primaryColor:v,metal:v,metalOwn:undefined}:{metal:v,metalOwn:undefined})}
  if(own!==null)return lookWrite(src,id,{metalOwn:own,metal:it.metal||'silver'});return lookWrite(src,id,{metal:v,metalOwn:undefined})}
async function lookSetEnamel(src,id,v){const it=lookItem(src,id);if(!it)return;const m=lookClipMetal(it);
  return lookWrite(src,id,v==='none'||!LOOK_ENAMEL.includes(v)?{primaryColor:m,metal:m}:{primaryColor:v,metal:m})}

/* ---- the picker for a material, a leather, a metal or a buckle: the colour sheet's layout (#col-sheet, colPick with k one of LOOK_PK):
   the item drawn beside a large swatch, Suggested (Claude), Yours, the full list by groups, None / Other, then "+ New" (its name field
   never redraws the sheet, so the first tap on Add works) ---- */
const LOOK_PK=['material','leather','metal','buckle'];
const LOOK_KS=[...LOOK_PK,'enamel','dial'];
function lookPick(src,id,k){openColPick(src,id,k)}
function lookMatGroups(it,k){const t=it.type,l=lookBuiltins(it,k);
  if(k==='material')return t==='shirt'?[['Fibers',LOOK_SHIRT_FIBERS],['Cotton cloths',LOOK_SHIRT_CLOTHS]]:[['Materials',l]];
  if(k==='leather')return LOOK_LEATHER_G.map(g=>[g[0],(/** @type {string[]} */(g[1])).filter(x=>l.includes(x))]).filter(g=>g[1].length);
  return t==='cufflinks'&&k==='metal'?[['Metals',l.filter(x=>x!=='silk')],['Not metal',['silk']]]:[['Metals',l]]}
function lookPickTitle(it,k){return k==='material'?(it.type==='shirt'?'Choose the fiber':'Choose the material'):k==='leather'?'Choose the leather':k==='buckle'?'Choose the buckle':'Choose the metal'}
function lookSugMat(it,k){const out=[],src=colPick?colPick.src:'e';
  if(src==='q'){if(k==='material'){if(it.matAI&&it.matAI.key)out.push([lookFiber(it,it.matAI.key),'Claude']);const g=matGuessOf(it);if(g)out.push([lookFiber(it,g.key),'Claude’s guess'])}
    else if(it.lookHint&&it.lookHint.mat&&!it.lookHint.mat.isNew)out.push([it.lookHint.mat.key,'Claude’s guess'])}
  else{const h=it.lookHint&&it.lookHint.mat;if(h&&!h.isNew&&h.key)out.push([lookFiber(it,h.key),'Claude'])}
  const rb=LOOK_RD[src+'|'+it.id];if(rb&&rb.by&&rb.by.mat){const v=lookVal(it,k).v;if(!out.some(x=>x[0]===v))out.push([v,'Read by Claude'])}
  return out.filter((x,j,a)=>a.findIndex(y=>y[0]===x[0])===j)}
function renderLookPick(keep){const el=$('#col-sheet'),it=colTarget();if(!el||!it||!colPick)return;const {k,sel,cur}=colPick,y=el.scrollTop,kind=lookPkKind(it,k),hex=COLORS[primaryCol(it)]||'#8b8f96';
  const nm=v=>lookName(it,k,v);
  const tile=(v,extra='')=>`<button type="button" class="cptile${v===sel?' sel':''}" data-c="${esc(v)}" data-c2="${esc(v)}" data-act="lkSel" aria-pressed="${v===sel}"><span class="cpsw lkmsw">${lookMatSw(kind,v,hex)}${v===cur?'<i class="cpnow" aria-hidden="true">Now</i>':''}</span><span class="cpnm">${esc(nm(v))}</span>${v===cur?'<span class="vh">, now</span>':''}${extra}</button>`;
  const sug=lookSugMat(it,k),own=lookOwnMats(it,k),groups=lookMatGroups(it,k);
  const drawn=k==='leather'?{...it,leather:sel==='none'||String(sel).startsWith('own:')?it.leather:sel}:k==='metal'||k==='buckle'?(it.type==='tieclip'&&LOOK_CLIP_METALS.includes(sel)&&lookCur(it,'enamel')==='none'?{...it,primaryColor:sel}:{...it,metal:METAL[sel]?sel:it.metal}):it;
  const oth=colPick.other!=null?colPick.other:(String(cur).startsWith('own:')&&!own.includes(String(cur).slice(4))?String(cur).slice(4):'');
  const word=kind==='fabric'?'material':kind;
  el.innerHTML=`<div class="cptop">${SW_GRAB}<div class="pick-head"><b id="col-title">${lookPickTitle(it,k)}</b><button class="pick-x" data-act="lkClose" aria-label="Close">×</button></div>
<div class="cpcmp"><figure class="cpph cpfig"><div class="cpdraw">${itemThumb(drawn)}</div><figcaption>As drawn</figcaption></figure><figure class="cpbig lkbig">${lookMatSw(kind,sel,hex)}<figcaption>${esc(nm(sel))}</figcaption></figure></div></div>
${it.type==='shirt'&&k==='material'?'<p class="cphelp">A shirt’s material is its fiber; its weave (oxford, twill, end-on-end…) is its pattern.</p>':''}
${sug.length?`<h4 class="cph">Suggested</h4><div class="cpgrid">${sug.map(([v,l])=>tile(v,`<small class="cpd cpaid">${esc(l)}</small>`)).join('')}</div>`:''}
<h4 class="cph">Yours</h4>${own.length?`<div class="cpgrid cnown">${own.map(n=>tile('own:'+n)).join('')}</div>`:`<p class="cphelp lkyours">${cap1(word)}s you add show here first. “+ New ${word}” is at the end.</p>`}
${groups.map(([g,l])=>`<h4 class="cph">${esc(g)}</h4><div class="cpgrid">${l.map(v=>tile(v)).join('')}</div>`).join('')}
<h4 class="cph">Or</h4><div class="cpgrid">${kind!=='metal'?tile('none'):''}${tile(LOOK_OTHER)}</div>
${sel===LOOK_OTHER?`<div class="lkform" id="lk-otherf"><label for="lk-other">Which ${word}?</label><input type="text" id="lk-other" dir="auto" maxlength="24" autocomplete="off" enterkeyhint="done" value="${esc(oth)}" placeholder="e.g. ${kind==='metal'?'titanium':kind==='leather'?'shell cordovan':'cupro'}" data-act-input="lkOther"><label class="lkchk"><input type="checkbox" id="lk-save" ${colPick.saveOther===false?'':'checked'} data-act-change="lkSaveOther"> Keep it as one of your ${word}s</label></div>`:''}
<h4 class="cph">New</h4>${colPick.newm?`<div class="lkform" id="lk-newf"><label for="lk-new">Name</label><input type="text" id="lk-new" dir="auto" maxlength="24" autocomplete="off" enterkeyhint="done" placeholder="e.g. ${kind==='metal'?'titanium':kind==='leather'?'shell cordovan':'cupro'}" data-act-input="lkNewName"><p class="cnbarerr lkerr" id="lk-err" role="alert" hidden></p><button type="button" class="pri lknewadd" id="lk-newadd" data-act="lkNewAdd">Add and use it</button></div>`
  :`<div class="cpgrid"><button type="button" class="cptile cpnewt" id="lk-newopen" data-act="lkNewOpen"><span class="cpsw" aria-hidden="true">+</span><span class="cpnm">New ${word}</span></button></div>`}
<div class="cpbar"><button type="button" class="pri" data-act="lkUsePick">${esc(sel===cur&&sel!==LOOK_OTHER?'Keep '+nm(sel):sel===LOOK_OTHER?'Use the one I typed':'Use '+nm(sel))}</button></div>`;
  if(keep)el.scrollTop=y}
function lookNewOpen(){if(!colPick)return;colPick.newm=true;colPick.newName='';renderColPick(true);const f=$('#lk-new');if(f){try{f.scrollIntoView({block:'center'})}catch{}f.focus({preventScroll:true})}}
/* "Add and use it": added to the person's own (synced) and set; the name field never redraws the sheet (the audit's first-tap bug) */
async function lookNewAdd(){if(!colPick)return;const {src,ref,k}=colPick,it=colTarget();if(!it)return;const raw=($('#lk-new')||{}).value||colPick.newName||'',n=ownMatName(raw);
  const err=$('#lk-err');if(!n){if(err){err.hidden=false;err.textContent=raw.trim()?'Use 2 to 24 letters, spaces or hyphens, at most 3 words.':'Give it a name first.'}return}
  const had=lookOwnRaw(lookOwnKey(it.type,k)).includes(n)||lookBuiltins(it,k).includes(n),snap=lookSnap(it,LOOK_UNDO_F);
  const got=await lookAddOwn(it.type,k,n);if(!got)return;closeColPick();await lookSetMat(src,ref,k,lookBuiltins(it,k).includes(got)?got:'own:'+got);
  toast(`Added ${cap1(got)} to your ${k==='material'?'materials':k==='leather'?'leathers':'metals'} and used it.`,6000,{label:'Undo',fn:async()=>{await lookRestore(src,ref,snap);if(!had)await lookDropOwn(it.type,k,got)}})}
async function lookUsePick(){const {src,ref,k,sel,cur}=colPick,it=colTarget();if(!it){closeColPick();return}let v=sel;
  if(sel===LOOK_OTHER){const t=String(($('#lk-other')||{}).value??colPick.other??'').replace(/\s+/g,' ').trim().slice(0,24);if(!t){const f=$('#lk-other');if(f)f.focus();toast('Type which one first.',3000);return}
    const n=ownMatName(t);if(colPick.saveOther!==false&&n){const got=await lookAddOwn(it.type,k,n);v=got?(lookBuiltins(it,k).includes(got)?got:'own:'+got):'own:'+t}else v='own:'+(n||t)}
  closeColPick();if(v===cur)return;await lookSetMat(src,ref,k,v)}

/* ---- the colour sheet's beta parts (colpick.js renderColPick / renderPatPick call these while lookOn()) ---- */
/* Shade under the preview (hidden for metals), Suggested (Claude's pick and runner-up, the measurement) */
function lookShadeHtml(){if(!colPick)return '';const s=colPick.shade||0;
  return `<div class="lkshade" role="group" aria-label="Shade"><button type="button" data-d="-1" data-act="lkShade"${s<=-SHADE_MAX?' disabled':''} aria-label="Darker">− Darker</button><output id="lk-shade">${s?esc(shadeName(s)):'As the color'}</output><button type="button" data-d="1" data-act="lkShade"${s>=SHADE_MAX?' disabled':''} aria-label="Lighter">Lighter +</button></div>`}
function lookShadeStep(d){if(!colPick)return;colPick.shade=Math.max(-SHADE_MAX,Math.min(SHADE_MAX,(colPick.shade||0)+d));renderColPick(true)}
const lookShadeOk=(k,sel)=>k==='primaryColor'&&!!sel&&sel!=='none'&&sel!==NEW_COL&&!LOOK_METAL_COLS.includes(sel)&&!!COLORS[sel];
function lookSugCols(it,k){if(k!=='primaryColor'||!colPick)return [];const src=colPick.src,ch=lookChips(src==='s'?'e':src,it).col.filter(x=>!x.add),out=ch.map(x=>[x.v,x.lab]);
  const ai=src==='q'?it.aiTag&&it.aiTag.primaryColor:it.tagAI&&it.tagAI.col;if(ai&&COLORS[ai]&&!out.some(x=>x[0]===ai))out.unshift([ai,'Claude’s pick']);
  const near=colNear(it,k);if(near.length&&!out.some(x=>x[0]===near[0].c))out.push([near[0].c,'Measured']);
  const rb=LOOK_RD[src+'|'+it.id];if(rb&&rb.by&&rb.by.col&&!out.some(x=>x[0]===primaryCol(it)))out.push([primaryCol(it),'Read by Claude']);
  return out.filter(x=>COLORS[x[0]])}
function lookSugPats(it){if(!colPick)return [];const src=colPick.src==='s'?'e':colPick.src,out=lookChips(src,it).pat.filter(x=>!x.add).map(x=>[x.v,x.lab]),ch=patChoices(it);
  const ai=src==='q'?it.aiTag&&it.aiTag.pattern:null;if(ai&&ch.includes(ai)&&!out.some(x=>x[0]===ai))out.unshift([ai,'Claude’s pick']);
  const rb=LOOK_RD[src+'|'+it.id];if(rb&&rb.by&&rb.by.pat){const p=normPat(it.type,it.pattern);if(!out.some(x=>x[0]===p))out.push([p,'Read by Claude'])}
  return out.filter(x=>ch.includes(x[0]))}
/* the beta's pattern groups: heather with the plain ones, the knits together, a pocket square's border with the figures */
const LOOK_PAT_GROUPS=[[['solid','heather'],'Plain'],[['pinstripe','chalk-stripe','stripe','fine-stripe'],'Stripes'],[['glen-check','windowpane','check','gingham','tattersall','tonal-check','houndstooth'],'Checks'],
  [['herringbone','birdseye','nailhead','sharkskin','twill','tweed','oxford','pinpoint','royal-oxford','end-on-end','chambray','dobby','woven','textured','fine-texture'],'Weaves'],[['knit','ribbed','cable'],'Knits'],
  [['polka-dot','paisley','foulard','camouflage','argyle','clock','border'],'Figures']];
const lookPatGroupOf=p=>{const b=patBase(p);const g=LOOK_PAT_GROUPS.findIndex(([l])=>l.includes(b));return g<0?LOOK_PAT_GROUPS.length:g};

/* ---- the Look section (both surfaces): {mark, title, sum, body} ---- */
const LOOK_CHEV='<svg class="lkchev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
const lookAi=(src,it,f)=>{const rb=LOOK_RD[src+'|'+it.id];return rb&&rb.by&&rb.by[f]?'<span class="lkai">✦ Claude</span>':''};
function lookRow(src,it,o){const r=`'${src}','${jsq(it.id)}'`;
  return `<button type="button" class="lkrow${o.sub?' sub':''}" data-k="${o.k}" data-src="${src}" data-id="${esc(it.id)}" data-k2="${esc(o.k)}" data-act="lkRow" aria-haspopup="dialog" aria-label="${esc(o.lab)}: ${esc(o.name)}"><span class="lksw">${o.sw}</span><span class="lktx"><small>${esc(o.lab)}${o.hint?` · ${esc(o.hint)}`:''}</small><b>${esc(o.name)}</b>${o.note?`<small class="lknote">${esc(o.note)}</small>`:''}</span>${o.ai||''}${LOOK_CHEV}</button>`}
const lookChipSw=c=>c&&COLORS[c]?`<i class="lkcol" style="background:${COLORS[c]}"></i>`:'<i class="lkcol none"></i>';
function lookColRows(src,it){const t=it.type,rows=[],e=src==='e',pc=e?primaryCol(it):it.primaryColor;
  const col=(k,lab,v,o={})=>lookRow(src,it,{k,lab,name:v&&COLORS[v]?cap1(colName(v))+(k==='primaryColor'&&it.shade&&lookShadeOk(k,v)?' · '+shadeName(it.shade).toLowerCase():''):'None',sw:k==='primaryColor'&&it.shade&&COLORS[v]?`<i class="lkcol" style="background:${shadeHex(COLORS[v],it.shade)}"></i>`:lookChipSw(v),ai:o.ai,...o});
  if(t==='watch'){rows.push(col('dial','Dial',watchOpts(it).dial,{ai:lookAi(src,it,'col')}));if(strapBand(it))rows.push(col('primaryColor','Strap color',pc,{sub:1}))}
  else if(t==='tieclip'){const en=lookCur(it,'enamel');rows.push(col('enamel','Enamel',en==='none'?null:en,{ai:lookAi(src,it,'col'),name:en==='none'?'None · plain metal':cap1(colName(en))}))}
  else rows.push(col('primaryColor','Color',pc,{ai:lookAi(src,it,'col')}));
  const chips=lookChipsHtml(src,it,lookChips(src,it).col);
  const sub=[];
  if(t==='shoes'&&soleStyle(it))sub.push(col('secondaryColor','Sole',it.secondaryColor,{sub:1}));
  else if(lookHasPat(t)&&!(t==='socks'&&it.toeColor===undefined&&!sockPatterned(it))){const need=lookNeed(it),p=lookPatOf(it);
    if(need>=1||colHas(it.secondaryColor))sub.push(col('secondaryColor','Second color',it.secondaryColor,{sub:1,hint:need>=1?LOOK_FOR2[p]||'':''}));
    if(need>=2||colHas(it.tertiaryColor))sub.push(col('tertiaryColor','Third color',it.tertiaryColor,{sub:1,hint:need>=2?LOOK_FOR3[p]||'':''}))}
  if(t==='socks')sub.push(col('toeColor','Toe cap',e?sockToeKey(it):it.toeColor&&it.toeColor!=='none'?it.toeColor:null,{sub:1,hint:'and the cuff edge'}));
  // a change the measurement made by itself on the card, with Undo (tagging.js tagNotes said it under the photo)
  const auto=src==='q'&&it.auto&&it.auto.primaryColor?`<p class="lkauto"><small>Changed from ${esc(colName(it.auto.primaryColor.from))} (measured from ${it.auto.primaryColor.src==='closeup'?'your close-up':'your photo'})</small><button type="button" class="chipbtn" data-id="${esc(it.id)}" data-act="lkUndoMeas">Undo</button></p>`:'';
  return rows.join('')+chips+auto+sub.join('')}
function lookPatRow(src,it){const t=it.type;
  if(LOOK_NOPAT.includes(t)||!lookHasPat(t))return `<div class="lkrow off" aria-disabled="true"><span class="lksw">${lookMatSw('fabric','none')}</span><span class="lktx"><small>Pattern</small><b>Not used for ${esc(lookNoun(t))}</b></span></div>`;
  const p=normPat(t,it.pattern);
  return lookRow(src,it,{k:'pattern',lab:'Pattern',name:cap1(patName(p)),sw:swatchSVG(patVar(it,p),true),ai:lookAi(src,it,'pat')})+lookChipsHtml(src,it,lookChips(src,it).pat)}
function lookMatRows(src,it){const t=it.type,kind=lookMatKind(t),hex=COLORS[primaryCol(it)],f=kind==='fabric'?'material':kind;
  const lab=kind==='fabric'?(t==='shirt'?'Material · Fiber':'Material · Fabric'):kind==='leather'?'Material · Leather':t==='watch'?(strapBand(it)?'Material · Metal (case)':'Material · Metal'):'Material · Metal';
  const v=lookVal(it,f);let h=lookRow(src,it,{k:f,lab,name:v.name,note:v.note,sw:lookMatSw(kind,v.v,hex),ai:lookAi(src,it,'mat')});
  const sug=src==='q'&&kind==='fabric'&&it.matAI&&it.matAI.key&&it.material===it.matAI.key?`<p class="lkauto"><small>Suggested by Claude (${esc(it.matAI.conf||'medium')} confidence). Change it if it’s wrong.</small></p>`:'';
  const added=src==='q'&&it.matAdded&&it.material===it.matAdded?`<p class="lkauto"><small>Now one of your materials, on all your devices.</small></p>`:'';
  h+=sug+added+lookChipsHtml(src,it,lookChips(src,it).mat);
  if(t==='belt'){const b=lookVal(it,'buckle');h+=lookRow(src,it,{k:'buckle',lab:'Buckle · Metal',name:b.name,sw:lookMatSw('metal',b.v,hex),sub:1})}
  return h}
/* "Read with Claude": one call for color, pattern and material (/describe what:'both' with look:true), from the close-up when there is
   one, else the photo; the price as the other Claude actions say it (rdCost: the owner's cents, a tester's lookups) */
const LOOK_RD={};   // in memory: 'q|id' / 'e|id' -> {busy, err, by:{col,pat,mat}, ac}
/* the price: the owner's cents (readEstimate); a tester "counts as 2 lookups" and what is left today (no cents for testers) */
function lookReadCost(){if(!isConnected())return 'connect in ⚙ Settings first';if(showCost())return rdCost();const l=cnLeft();return `counts as ${RD_LOOKUPS} lookups${l?` · ${l.left} of ${l.cap} left today`:''}`}
function lookReadBox(src,it){const k=src+'|'+it.id,me=LOOK_RD[k]||{},r=`'${src}','${jsq(it.id)}'`,from=it.texture?'from your close-up':'from the photo';
  const what=LOOK_NOPAT.includes(it.type)?`Color and ${lookMatKind(it.type)==='leather'?'leather':'metal'} at once`:'Color, pattern and material at once';
  if(me.busy)return `<div class="lkrd busy" role="status"><span class="spin" aria-hidden="true"></span><div class="lkrdtx"><b>Claude is reading ${LOOK_NOPAT.includes(it.type)?'color and '+(lookMatKind(it.type)==='leather'?'leather':'metal'):'color, pattern and material'}…</b><small>${from}</small></div><button type="button" class="lkrdstop" data-src="${src}" data-id="${esc(it.id)}" data-act="lkStop">Stop</button></div>`;
  const pic=!!(it.texture||it.photo||it.tagImg),off=!pic?'Add a photo first: Claude reads the look from it.':rdOff(),reading=src==='q'&&cardReading(it);
  const cu=!it.texture&&lookCu(it.type)?`<span class="lkrdcu">${closeupBtn({label:'Add a close-up for a truer color',cls:'linkbtn lkcuadd',mode:'add',aria:'Add fabric close-up',act:src==='q'?` data-act-change="lkCuFileQ" ${cardAt(it)}`:` data-act-change="photoCuFile" data-id="${esc(it.id)}"`,cloth:paperCloth(it)})}</span>`:'';
  return `<div class="lkrd"><div class="lkrdtx"><b><span class="lkstar" aria-hidden="true">✦</span> Read with Claude</b><small>${what}, ${from} · <span class="lkcost">${esc(pic?lookReadCost():'needs a photo')}</span></small>${me.err?`<small class="lkerr" role="alert">${esc(me.err)}</small>`:''}${cu}</div><button type="button" class="pri lkrdbtn" id="lk-read-${esc(src)}" data-src="${src}" data-id="${esc(it.id)}" data-act="lkRead"${off||reading?' aria-disabled="true"':''}>${me.by?'Read again':'Read'}</button></div>`}
function lookSum(src,it,ch){const t=it.type,en=t==='tieclip'?lookCur(it,'enamel'):null,c=t==='watch'?watchOpts(it).dial:t==='tieclip'?(en==='none'?lookClipMetal(it):it.primaryColor):src==='e'?primaryCol(it):it.primaryColor;
  const kind=lookMatKind(t),mv=lookVal(it,kind==='fabric'?'material':kind),bits=[en==='none'?'No enamel':`<span class="ckcn">${ckChip(c)}${esc(cap1(colName(c)||'')+(t==='watch'?' dial':''))}</span>`];
  if(!LOOK_NOPAT.includes(t)&&lookHasPat(t))bits.push(esc(cap1(patName(normPat(t,it.pattern)))));
  bits.push(esc(mv.v==='none'?`no ${kind==='fabric'?'material':kind} yet`:mv.name));
  return bits.join(' · ')+(ch?' · Claude has a suggestion':'')}
function lookSection(src,it,i){const ch=lookChips(src,it),any=ch.col.length+ch.pat.length+ch.mat.length>0,ok=src==='q'?!!(it.checked&&it.checked.lk):!!it.lookOk;
  const lr=src==='q'?ckLr(it,i,'lk'):`<button type="button" class="cklr" aria-pressed="${ok}" data-id="${esc(it.id)}" data-act="lkCheck">${ok?'<span aria-hidden="true">✓ </span>Checked':'Looks right'}</button>`;
  const body=`<div class="lkbody">${lookReadBox(src,it)}${lookColRows(src,it)}${accRow(src,it.id,it)}${lookPatRow(src,it)}${src==='e'?lookPatExtras(it):''}${lookMatRows(src,it)}</div>${lr}`;
  return {mark:ok?'good':any?'warn':'todo',title:'Look',sum:lookSum(src,it,any&&!ok),body,warn:any&&!ok}}
/* the item sheet's pattern reading (Pattern layout, Read pattern from photo) and the outfit pictures' note stay under the Pattern row */
function lookPatExtras(i){const id=i.id,fab=FABRIC.includes(i.type);
  const layout=fab&&(DETECT_PATS.includes(patBase(i.pattern))||settable(i.type,i.pattern,i.weave)||claudeOnly(i.type,i.pattern)||i.sett)?`<div class="ivpat"><p class="shelp">Pattern layout: ${patSummary(i)}</p><div class="btns">${!i.photo&&!i.texture?'<p class="shelp nopatpic">Add a photo above to read its pattern from it.</p>':claudeOnly(i.type,i.pattern)&&!isConnected()?'':`<button id="readpat-btn" data-id="${esc(id)}" data-how="${i.texture||i.pbox||claudeOnly(i.type,i.pattern)?'reread':'detect'}" data-act="lkReread">Read pattern from photo</button>`}${i.stripes||i.sett?`<button data-id="${esc(id)}" data-act="lkClearStripes">Use generic</button>`:''}</div></div>`:'';
  return layout+(typeof asmGapNote==='function'?asmGapNote(i):'')}
/* the item sheet's "Looks right": kept on the item (lookOk, synced); a later edit leaves it (the owner's question 4: it stays) */
async function lookCheck(id){const it=items.find(x=>x.id===id);if(!it){itemGoneTell(id);return}if(it.lookOk)delete it.lookOk;else it.lookOk=1;await put(it);renderWardrobe()}
/* the item sheet opens Look unfolded every time an item is opened (itemsheet.js itemBody, a new phEdit) */
function lookOpenFresh(){CK_OPEN['e|lk']=true}

/* ---- a card saved in the beta: what the old save leaves out (add.js saveCard calls this before colTidy) ---- */
function lookSave(q,it){if(!lookOn())return;const t=q.type;
  if(LOOK_COATS.includes(t))it.pattern=normPat(t,q.pattern);   // (saveCard keeps a pattern only for hasPat types)
  if(q.texture&&LOOK_CU.includes(t))it.texture=q.texture;
  if(q.checked&&q.checked.lk)it.lookOk=1;else{const h=lookHintOf(q);if(h)it.lookHint=h}
  if(q.leatherOwn&&(t==='shoes'||t==='belt'))it.leatherOwn=q.leatherOwn;if(q.leatherNone&&(t==='shoes'||t==='belt')&&!q.leatherOwn)delete it.leather;
  if(q.metalOwn&&(LOOK_METALT.includes(t)||t==='belt'))it.metalOwn=q.metalOwn;
  if(t==='tieclip'&&LOOK_CLIP_METALS.includes(q.metal)&&!LOOK_CLIP_METALS.includes(it.primaryColor))it.metal=q.metal}

/* ---- Read with Claude ---- */
function lookRedraw(src,id){if(src==='q')renderAdd();else if(editing===id)renderWardrobe()}
function lookReadStop(src,id){const me=LOOK_RD[src+'|'+id];if(me&&me.ac)try{me.ac.abort()}catch{}delete LOOK_RD[src+'|'+id];lookRedraw(src,id)}
async function lookRead(src,id){const it=lookItem(src,id);if(!it)return;const key=src+'|'+id;if(LOOK_RD[key]&&LOOK_RD[key].busy)return;
  if(src==='q'&&cardReading(it)){tell('Claude is still reading this card.');return}
  const off=rdOff();if(off){tell(off);return}
  const pats=!LOOK_NOPAT.includes(it.type)&&!!PATS_BY[it.type];
  const me=LOOK_RD[key]={busy:true,err:'',by:(LOOK_RD[key]||{}).by,ac:typeof AbortController==='function'?new AbortController():null};lookRedraw(src,id);
  let img=null,wb,from='photo';
  try{if(it.texture){await paperOf(it);const cp=await paperCopy(it);img=cp.closeup;wb=cp.wb;from='closeup'}else img=src==='q'?(it.tagImg||it.photo):((await tagImgOf(id,it))||it.photo)}catch{img=it.texture||it.photo||null}
  if(LOOK_RD[key]!==me)return;
  if(!img){delete LOOK_RD[key];lookRedraw(src,id);tell('Add a photo first: Claude reads the look from it.');return}
  const body={what:'both',look:true,src:from,type:it.type,colours:{main:primaryCol(it),second:it.secondaryColor||null,third:it.tertiaryColor||null},pattern:pats?normPat(it.type,it.pattern):'solid',custom:settings.custom||{},closeup:img};
  if(typeof wb==='boolean')body.wb=wb;const om=lookOwnMats(it,'material');if(om.length&&MATERIALS_BY[it.type])body.ownMaterials={[it.type]:om};
  const w=localStorage.getItem('worker_url')||'';let r=null,j={};
  try{r=await fetch(new URL('describe',w.replace(/\/*$/,'/')).href,{method:'POST',headers:{'content-type':'application/json','x-app-token':localStorage.getItem('app_token')||''},body:JSON.stringify(body),...(me.ac?{signal:me.ac.signal}:{})});j=await r.json().catch(()=>({}))}catch(e){r=null}
  if(LOOK_RD[key]!==me)return;   // stopped meanwhile: nothing changes
  me.busy=false;delete me.ac;
  if(r&&r.ok&&acct&&acct.me&&acct.me.caps&&acct.me.used)acct.me.used.describe=(+acct.me.used.describe||0)+(j.lookups!=null?+j.lookups||0:RD_LOOKUPS);
  if(r&&r.status===429){me.err=j.message||'Today’s readings are used up. They start again at midnight UTC.';lookRedraw(src,id);return}
  if(!r||!r.ok||!j.colour){me.err=r&&!r.ok&&showCost()&&(j.detail||j.message)?`Claude couldn’t read it this time (${j.detail||j.message}).`:'Claude couldn’t read it this time. Try again.';lookRedraw(src,id);return}
  me.err='';await lookApplyRead(src,id,j,me)}
/* the answer onto the item: each part set as a pick would set it (listed colours, patterns and materials only); a new colour, pattern or
   material Claude named, and a material it is unsure of, become chips on their rows; one toast says what it read, with Undo for all */
async function lookApplyRead(src,id,j,me){const it=lookItem(src,id);if(!it)return;const t=it.type,snap=lookSnap(it,LOOK_UNDO_F),by={},said=[],h={...(it.lookHint||{})};let changed=false;
  const pc0=it.primaryColor,pat0=normPat(t,it.pattern);
  const c=j.colour;
  if(c&&!c.error&&(c.kind==='colour'||c.kind==='several')&&c.existing&&COLORS[c.existing]){const k=c.existing;
    if(t==='tieclip'){const v=LOOK_CLIP_METALS.includes(k)||clipMetal({primaryColor:k})?k:LOOK_ENAMEL.includes(k)?k:null;if(v&&v!==it.primaryColor){it.primaryColor=v;if(LOOK_ENAMEL.includes(v))it.metal=lookClipMetal({...it,primaryColor:pc0});changed=true}if(v){by.col=1;said.push(colName(v))}}
    else if(t==='watch'){if(strapBand(it)&&colsFor(t).includes(k)){if(k!==it.primaryColor){it.primaryColor=k;changed=true}by.col=1}}
    else if(colsFor(t).includes(k)||CUSTOM_COL[k]){if(k!==primaryCol(it)){it.primaryColor=k;delete it.color;delete it.shade;changed=true}by.col=1;said.push(colName(k))}
    if(+c.dE>6&&c.name&&t!=='tieclip'&&t!=='watch'){const nc={name:cap1(String(c.name)),hex:cnHex(c.hex)};if(src==='q')it.newColor={name:nc.name,why:c.why||''};else h.nc=nc}}
  const p=j.pattern;
  if(PATS_BY[t]&&!LOOK_NOPAT.includes(t)&&p&&!p.error&&p.kind==='pattern'){const ch=patChoices(it),ex=ch.includes(p.existing)?p.existing:ch.includes(p.plansAs)?p.plansAs:null;
    if(ex){if(ex!==pat0){it.pattern=ex;for(const f of ['sett','stripes','patternSpec','weave'])delete it[f];changed=true}by.pat=1;said.push(patName(ex))}
    const pn=String(p.name||'').trim().toLowerCase();if(p.match==='new'&&pn&&!ch.some(x=>patName(x).toLowerCase()===pn)){if(src==='q')it.newPattern={name:cap1(pn),why:p.description||''};else h.np={name:cap1(pn),desc:p.description||'',base:ex||'solid'}}}
  const kind=lookMatKind(t),m=(p&&!p.error&&p.material)||j.material,hi=m&&(m.confidence==='high'||m.confidence==='medium');
  if(m&&m.key&&m.key!=='none'){const key=lookFiber(it,String(m.key).toLowerCase().trim());
    if(kind==='fabric'){const l=[...lookBuiltins(it,'material'),...lookOwnMats(it,'material'),...(matsFor(t)||[])];
      if(l.includes(key)){if(hi){if(key!==it.material){it.material=key;changed=true}if(src==='q'){it.matAI={key,conf:m.confidence,why:m.why||''};delete it.matSet;delete it.matGuess}by.mat=1;said.push(key)}
        else{if(src==='q')it.matGuess={key,conf:'low',why:m.why||''};else h.mat={key,why:m.why||''}}}
      else if(m.new===true&&hi&&ownMatName(key)===key){if(src==='q')it.matNew={key,conf:m.confidence,why:m.why||''};else h.mat={key,why:m.why||'',isNew:1}}}
    else if(kind==='leather'){if(leathersFor(it).includes(key)){if(hi){if(key!==it.leather||it.leatherOwn){it.leather=key;delete it.leatherOwn;delete it.leatherNone;changed=true}by.mat=1;said.push(leatherWord(it,key))}else h.mat={key,why:m.why||''}}}
    else{const l=lookBuiltins(it,'metal');if(l.includes(key)){if(hi){if(t==='tieclip'){if(lookCur(it,'enamel')==='none'){if(it.primaryColor!==key){it.primaryColor=key;changed=true}}it.metal=key}else if(it.metal!==key||it.metalOwn){it.metal=key;delete it.metalOwn;changed=true}by.mat=1;said.push(t==='tieclip'?colName(key):metalWord(key))}else h.mat={key,why:m.why||''}}}}
  if(t==='watch'&&j.dial&&DIAL_COLS.includes(j.dial)){if(j.dial!==watchOpts(it).dial){it.dial=j.dial;changed=true}by.col=1;said.unshift(colName(j.dial)+' dial')}
  if(t==='belt'&&j.buckle&&METAL[j.buckle]){if(j.buckle!==it.metal||it.metalOwn){it.metal=j.buckle;delete it.metalOwn;changed=true}said.push(metalWord(j.buckle)+' buckle')}
  if(Object.keys(h).length)it.lookHint=h;else delete it.lookHint;
  me.by=by;
  if(src==='q'){if(normPat(t,it.pattern)!==pat0)try{readSett(it)}catch{}if(it.primaryColor!==pc0&&it.texCanvas)try{generateSwatch(it)}catch{}queueMicrotask(addKeep);renderAdd()}
  else{if(it.sample)it.sampleMine=1;if(it.primaryColor!==pc0&&it.swSrc==='tex')await refreshSwatch(it);await put(it);planDirty();renderWardrobe()}
  const words=said.filter(Boolean).map(s=>String(s).toLowerCase());
  toast(words.length?`Claude read it: ${words.join(', ')}.${changed?'':' Nothing changed.'}`:'Claude couldn’t tell this time: nothing changed.',8000,changed?{label:'Undo',fn:async()=>{await lookRestore(src,id,snap);const x=LOOK_RD[src+'|'+id];if(x)delete x.by;lookRedraw(src,id)}}:undefined)}

/* ---- what the beta's controls do (act.js: data-act names the handler, its arguments are the element's data-*) ---- */
const lkSI=el=>[el.dataset.src,el.dataset.id];
function lkSwitch(el){lookSet(el.dataset.on==='true')}
function lkAddChip(el){lookAddChip(...lkSI(el),el.dataset.add)}
function lkUse(el){lookUse(...lkSI(el),el.dataset.f,el.dataset.v,el.dataset.hk||'')}
function lkOwnRm(el){lookOwnRemove(el.dataset.key,el.dataset.m)}
function lkOwnAdd(){lookOwnAddForm()}
function lkOwnCancel(){lookOwnForm=false;renderOwnMatUI()}
function lkOwnOpen(){lookOwnForm=true;renderOwnMatUI();const n=/** @type {HTMLElement|null} */(document.querySelector('#ownmat-name'));if(n)n.focus()}
function lkSel(el){colPickSel(el.dataset.c2)}
function lkClose(){closeColPick()}
function lkOther(el){if(colPick)colPick.other=el.value}
function lkSaveOther(el){if(colPick)colPick.saveOther=el.checked}
function lkNewName(el){if(colPick)colPick.newName=el.value}
function lkNewAdd(){lookNewAdd()}
function lkNewOpen(){lookNewOpen()}
function lkUsePick(){useColPick()}
function lkShade(el){lookShadeStep(+el.dataset.d)}
function lkRow(el){openColPick(...lkSI(el),el.dataset.k2)}
function lkUndoMeas(el){undoMeasured(qAt(el.dataset.id),'primaryColor')}
function lkStop(el){lookReadStop(...lkSI(el))}
function lkRead(el){lookRead(...lkSI(el))}
function lkCheck(el){lookCheck(el.dataset.id)}
function lkReread(el){if(el.dataset.how==='reread')rereadSett(el.dataset.id);else redetect(el.dataset.id)}
function lkClearStripes(el){clearStripes(el.dataset.id)}
function lkNewCol(){openColNew()}
function lkNewPat(){openPatNew()}
function lkCuFileQ(el,ev,f){cuGot(el,f,x=>addTexture(cardIx(el),x,true))}   // (the Add card's "Add a close-up for a truer color": read at once)
acts({lkSwitch,lkAddChip,lkUse,lkOwnRm,lkOwnAdd,lkOwnCancel,lkOwnOpen,lkSel,lkClose,lkOther,lkSaveOther,lkNewName,lkNewAdd,lkNewOpen,lkUsePick,lkShade,lkRow,lkUndoMeas,lkStop,lkRead,lkCheck,lkReread,lkClearStripes,lkNewCol,lkNewPat,lkCuFileQ});
