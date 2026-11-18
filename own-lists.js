/* Daily Wardrobe: photo tagging, the person's own lists (split from tagging.js, Round B CR-2-17): adding a colour or a pattern the lists
   lack, own materials from Claude's offers, and their Settings lists. */

/* ---- adding a colour or a pattern (settings.custom, synced; see applyCustom in core.js) ---- */
/* the kinds a new colour is offered for at first ("Offer it for"): the casual tops together and the casual jackets together (2026-11-16,
   the owner's coyote brown T-shirt), the pocket square with the tie (the same silk and print colours) */
const COL_GROUPS=[['suit','blazer','pants'],['overcoat','raincoat'],['shirt'],['tie','pocketsquare'],['socks'],['shoes','belt'],CASUAL_TOPS,CASUAL_JACKETS];
const groupOf=t=>(COL_GROUPS.find(g=>g.includes(t))||[t]).slice();
/* "T-shirts", "dress shirts", "watches", "pants" */
const typePl=t=>{const n=TYPES[t]||t,p=/s$/.test(n)?n:/(ch|sh)$/.test(n)?n+'es':n+'s';return t==='tee'?p:p.toLowerCase()};
/* an own colour used for a kind of item it isn't offered for yet (2026-11-16, the owner: "I want it to be coyote brown … the color picker
   doesn't let me pick my added colors": made on pants, Coyote brown was in no T-shirt list, and adding it again was refused, "There is
   already a color with that name"): that kind joins its "Offer it for", and stripes and motifs when it was picked for one; saved and synced
   as any settings change (saveUserSettings: the colour's entry gets a new stamp). Returns {msg, undo} or null when nothing changed */
async function ownColOffer(key,type,accent){const cu=settings.custom||{},l=cu.colors||[],c=l.find(x=>x&&x.key===key);
  if(!c||!CUSTOM_COL[key]||!COLS_BY[type]||colsFor(type,accent).includes(key))return null;
  const had={types:c.types,accent:c.accent},newAcc=!!accent&&!c.accent;
  settings.custom={...cu,colors:l.map(x=>x===c?{...c,types:[...new Set([...(c.types||[]),type])],accent:!!c.accent||!!accent}:x)};
  applyCustom(settings.custom);planDirty();await saveUserSettings();
  const undo=async()=>{const u=settings.custom||{};settings.custom={...u,colors:(u.colors||[]).map(x=>x&&x.key===key?{...x,types:had.types,accent:had.accent}:x)};
    applyCustom(settings.custom);planDirty();await saveUserSettings();if(typeof renderCustomUI==='function')renderCustomUI()};
  return {msg:`${cap1(colName(key))} is now offered for ${typePl(type)}${newAcc?' and their stripes and motifs':''} too.`,undo}}
/* the Add card's offer of a new colour (Claude's newColor, or a close-up measured over FAR_DE from every listed colour) opens the
   "+ New colour" sheet (colpick.js openColNew) on the card's main colour, with Claude's name and the measured shade filled in; the inline
   forms (newColForm / newPatForm) were removed 2026-11-15: one way to add, the same everywhere */
/* the shade the sheet starts on (fix round 3, W2-17-05: Claude's "dusty pink" opened over the tagged cream): a close-up's measurement, else
   the colour Claude's name says ("dusty pink" → pink, "sky blue" → light blue: the whole name, then its words from the last), else the
   photo's measurement, else the tagged colour */
const nameHex=n=>{const w=String(n||'').toLowerCase().split(/[^a-z]+/).filter(Boolean);for(const x of [w.join(''),...w.slice().reverse()]){const k=normCol(x);if(k&&!CUSTOM_COL[k])return COLORS[k]}return null};
function newColHex(q){const m=q.meas&&q.meas.hex;return q.meas&&q.meas.src==='closeup'&&m||q.newColor&&nameHex(q.newColor.name)||m||COLORS[q.primaryColor]}
function openColForm(i){const q=queue[i];if(!q)return;openColPick('q',i,'primaryColor');openColNew({from:'add',name:q.newColor?q.newColor.name:'',hex:newColHex(q)})}
const OWN_NAME_MSG='Use only letters, numbers, spaces and - ’ . , ( ) / + in the name.';
async function addCustomColor({name,hex,base,types,accent}){if(ownNameBad(name))throw new Error(OWN_NAME_MSG);name=ownNameClean(name,24);
  if(ownNameShort(name))throw new Error('Give it a name of at least two letters.');if(ownColFind(name)||colNameTaken(name))throw new Error('There is already a color with that name.');
  const key=ownFreeKey(ownColKey(name),k=>!!COLORS[k]||(settings.custom&&settings.custom.colors||[]).some(c=>c.key===k),OWN_COL_RE);
  if(!/^#[0-9a-f]{6}$/i.test(hex))throw new Error('Pick a shade.');if(!COLORS[base]||CUSTOM_COL[base])throw new Error('Choose what it behaves like.');
  if(!types||!types.length)throw new Error('Choose at least one kind of item.');
  const cu=settings.custom||{};settings.custom={...cu,colors:[...(cu.colors||[]),{key,name,hex:hex.toLowerCase(),base,types,accent:!!accent}]};
  applyCustom(settings.custom);await saveUserSettings();return key}
/* a new pattern's "drawn like" from the words in its name and description (2026-11-13: the owner's "fine worsted twill" and "melange
   twill" were left drawn like solid, so the outfit pictures painted them plain): the longest listed pattern named in them, a few
   other words for one, else what the card was tagged */
const PAT_WORDS=[[/prince of wales|glen ?plaid/i,'glen-check'],[/plaid|tartan/i,'check'],[/serge|gabardine|cavalry/i,'twill'],[/pin ?stripe/i,'pinstripe'],[/chalk ?stripe/i,'chalk-stripe'],[/dots?\b|spots?\b/i,'polka-dot'],[/neat|micro.?print/i,'foulard']];
function guessPatBase(name,desc,type,fallback){const t=`${name||''} ${desc||''}`,ok=p=>(PATS_BY[type]||[]).includes(p)&&!CUSTOM_PAT[p];
  const list=(PATS_BY[type]||[]).filter(p=>p!=='solid'&&p!=='other'&&ok(p)).sort((a,b)=>b.length-a.length);
  for(const p of list)if(new RegExp('\\b'+p.replace(/-/g,'[- ]?')+'\\b','i').test(t))return p;
  for(const [re,p] of PAT_WORDS)if(re.test(t)&&ok(p))return p;
  return fallback}
/* the Add card's offer of a new pattern (Claude's newPattern) opens the "+ New pattern or texture" sheet with Claude's name and words, its
   "drawn like" guessed from them (guessPatBase) */
function openPatForm(i){const q=queue[i];if(!q)return;const name=q.newPattern?q.newPattern.name:'',why=q.newPattern?q.newPattern.why:'';
  openColPick('q',i,'pattern');openPatNew({from:'add',name,desc:[name,why].filter(Boolean).join(': ').slice(0,120),base:guessPatBase(name,why,q.type,null)})}
/* look: the drawing recipe from "+ New pattern" (worker /describe: {layout, tr, tex | across (+ along) | motif}, roles not colours),
   kept with the pattern (synced) and drawn by detect.js lookSett in each item's colours, the painter too */
const cleanLookApp=l=>l&&typeof l==='object'&&['texture','stripes','check','windowpane','plaid','motif'].includes(l.layout)&&(Array.isArray(l.tex&&l.tex.grid)||Array.isArray(l.across)||l.motif&&Array.isArray(l.motif.figs))?JSON.parse(JSON.stringify(l)):null;
async function addCustomPattern({name,desc,base,types,look}){if(ownNameBad(name))throw new Error(OWN_NAME_MSG);name=ownNameClean(name,24);
  if(ownNameShort(name))throw new Error('Give it a name of at least two letters.');if(patNameTaken(name))throw new Error('There is already a pattern with that name.');
  const key=ownFreeKey(ownPatKey(name),k=>!!CUSTOM_PAT[k]||(settings.custom&&settings.custom.patterns||[]).some(p=>p.key===k)||Object.values(PATS_BY).some(l=>l.includes(k)),OWN_PAT_RE);
  types=(types||[]).filter(t=>PATS_BY[t]&&PATS_BY[t].includes(base));if(!types.length)throw new Error('Choose at least one kind of item that has the "drawn like" pattern.');
  const lk=cleanLookApp(look),cu=settings.custom||{};settings.custom={...cu,patterns:[...(cu.patterns||[]),{key,name,desc:ownDescClean(desc),base,types,...(lk?{look:lk}:{})}]};
  applyCustom(settings.custom);await saveUserSettings();return key}
/* Settings: the colours and patterns you added; one no item uses can be removed. Only entries of the own-key rule are listed (a color
   with a 6-digit hex), every value escaped, and Remove carries its key in data-* attributes read by one listener (fix round A, CR-2-02:
   the raw settings.custom key and hex went into an inline handler and a style attribute) */
function renderCustomUI(){const el=$('#custom-list');if(!el)return;const cu=settings.custom||{},arr=v=>Array.isArray(v)?v:[];
  const cols=arr(cu.colors).filter(c=>c&&OWN_COL_RE.test(c.key)&&/^#[0-9a-f]{6}$/i.test(c.hex||'')),pats=arr(cu.patterns).filter(p=>p&&OWN_PAT_RE.test(p.key));
  const used=(k,f)=>items.filter(i=>f(i,k)).length,kinds=x=>esc(arr(x.types).map(t=>TYPES[t]).filter(t=>typeof t==='string').join(', '));
  if(!el.dataset.rm){el.dataset.rm='1';el.addEventListener('click',e=>{const b=e.target.closest('button[data-rm-kind]');if(b&&el.contains(b))removeCustom(b.dataset.rmKind,b.dataset.rmKey)})}
  const rm=(kind,k)=>`<button type="button" data-rm-kind="${kind}" data-rm-key="${esc(k)}">Remove</button>`;
  // a pattern's swatch is drawn with its look, on a sample item of its first kind (navy, a white shirt)
  const patSw=p=>{const t=arr(p.types)[0]||'suit';try{return swatchSVG({type:t,primaryColor:t==='shirt'?'white':'navy',pattern:p.key},true)}catch(e){return ''}};
  el.innerHTML=(!cols.length&&!pats.length?'<p class="mut"><small>None yet. Add one below, or from any color or pattern list (“+ New”); the Add card offers one when a photo shows a color or pattern the lists lack.</small></p>':
    [...cols.map(c=>{const n=used(c.key,(i,k)=>[i.primaryColor,i.secondaryColor,i.tertiaryColor].includes(k));return `<div class="custrow"><span class="msw" style="background:${esc(c.hex)}"></span><span><b>${esc(c.name)}</b><br><small class="mut">behaves like ${esc(colName(c.base))} · ${kinds(c)}${n?` · ${n} item${n>1?'s':''}`:''}</small></span>${n?'':rm('colors',c.key)}</div>`}),
     ...pats.map(p=>{const n=used(p.key,(i,k)=>i.pattern===k);return `<div class="custrow"><span class="msw pat">${patSw(p)}</span><span><b>${esc(p.name)}</b><br><small class="mut">${p.look?'drawn from its own look, planned':'drawn'} like ${esc(patLabel(p.base))} · ${kinds(p)}${n?` · ${n} item${n>1?'s':''}`:''}</small></span>${n?'':rm('patterns',p.key)}</div>`})].join(''))
    +`<div class="custadd"><button type="button" id="cust-newcol" onclick="openCustomNew('colour')">+ New color</button><button type="button" id="cust-newpat" onclick="openCustomNew('pattern')">+ New pattern</button></div>`}
async function removeCustom(kind,key){if(kind!=='colors'&&kind!=='patterns')return;const cu=settings.custom||{};settings.custom={...cu,[kind]:(cu[kind]||[]).filter(x=>x.key!==key)};applyCustom(settings.custom);planDirty();await saveUserSettings();renderCustomUI()}

/* adding one of Claude's new materials to the person's own for a type (settings.ownMaterials, synced; core.js ownMats): -> the name, or ''.
   The list is kept sorted, at most OWN_MAT_MAX a type */
async function addOwnMaterial(type,name){const n=ownMatName(name);if(!n||!MATERIALS_BY[type])return '';if(matsFor(type).includes(n))return n;
  const cur=ownMats(type);if(cur.length>=OWN_MAT_MAX){toast(`You have ${OWN_MAT_MAX} of your own ${matTypeWord(type)} materials: remove one in Settings first.`,5000);return ''}
  const o=settings.ownMaterials&&typeof settings.ownMaterials==='object'?settings.ownMaterials:{};settings.ownMaterials={...o,[type]:[...cur,n].sort()};
  await saveUserSettings();return n}
async function removeOwnMaterial(type,name){const o=settings.ownMaterials&&typeof settings.ownMaterials==='object'?settings.ownMaterials:{},l=ownMats(type).filter(x=>x!==name),nx={...o};
  if(l.length)nx[type]=l;else delete nx[type];if(Object.keys(nx).length)settings.ownMaterials=nx;else delete settings.ownMaterials;await saveUserSettings();renderOwnMatUI()}
/* the Add card's "Add cupro as a material": added to the person's own for this type, chosen as this card's material (by hand: matSet,
   Fabric & fit checked), a note under the field, and a toast with Undo (takes it off the card and out of the list again) */
async function matOffer(i){const q=queue[i];if(!q||!q.matNew)return;const nm=q.matNew,was=q.material,had=matsFor(q.type).includes(nm.key);
  const n=await addOwnMaterial(q.type,nm.key);if(!n)return;
  const qq=queue.find(x=>x.id===q.id);if(!qq)return;delete qq.matNew;delete qq.matAI;qq.material=n;qq.matSet=1;qq.matAdded=n;qq.checked={...qq.checked,fabric:1};
  addKeepSoon();renderAdd();
  toast(`${cap1(n)} added to your ${matTypeWord(q.type)} materials.`,6000,{label:'Undo',fn:async()=>{const c=queue.find(x=>x.id===q.id);
    if(c&&c.material===n){if(was)c.material=was;else delete c.material;delete c.matAdded;c.matNew=nm}if(!had)await removeOwnMaterial(q.type,n);renderAdd()}})}
/* the Add card's "Use wool" on Claude's low-confidence guess: chosen by hand (matSet, Fabric & fit checked) */
function matGuessUse(i){const q=queue[i];if(!q||!q.matGuess)return;const k=q.matGuess.key;delete q.matGuess;setQField(i,'material',k)}
/* Settings → Your materials: the materials added from Claude's offers, per type; each can be removed (items already using it keep it: it
   shows as Other with its name there; it is only no longer offered) */
function renderOwnMatUI(){const el=$('#ownmat-list');if(!el)return;const rows=[];
  for(const t of Object.keys(MATERIALS_BY))for(const m of ownMats(t)){const n=items.filter(i=>i.type===t&&i.material===m).length;
    rows.push(`<div class="custrow ownmatrow" data-t="${esc(t)}" data-m="${esc(m)}"><span><b>${esc(cap1(m))}</b><br><small class="mut">${esc(TYPES[t]||t)}${n?` · ${n} item${n>1?'s':''}`:''}</small></span><button type="button" aria-label="Remove ${esc(m)} from your ${esc(matTypeWord(t))} materials" onclick="removeOwnMaterial('${jsq(t)}','${jsq(m)}')">Remove</button></div>`)}
  el.innerHTML=rows.length?rows.join('')+'<p class="mut"><small>Removing one leaves the items that use it as they are; it just stops being offered.</small></p>'
    :'<p class="mut"><small>None yet. When Claude reads a material that is on no list (cupro, say), the Add card offers to add it here.</small></p>';
  if(lookOn())el.insertAdjacentHTML('beforeend',lookOwnMatUI())}   // (the Look beta: leathers and metals too, and "+ New material": look.js)
