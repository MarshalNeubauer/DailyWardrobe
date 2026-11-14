/* Daily Wardrobe: getting started (2026-11-14, the owner's ask after the audit's new-user walkthrough). Loaded after setup.js.
   - the quick tour: four short cards on the score, the close-up, Shade and patterns (tourOpen); shown once to a new user between the
     setup and the first Add, offered on the setup's last step, on Today's first-outfit checklist and in Settings → About
   - the close-up guide: how to take a good close-up, with white paper along one edge (kitCloseupGuide), from the Add card's close-up step
     and the item sheet's photo tools
   - Undo after Confirm on Add (kitSaved, called by app.js save): the item comes out of the wardrobe and its card goes back on Add
   - Duplicate on the item sheet (kitDuplicate): a second identical piece, opened for any difference
   - import from a spreadsheet (kitImportOpen): CSV or rows pasted from Excel or Google Sheets, a template to fill in, a preview before
     anything is saved, each row saved as an item added by hand would be (app.js save), with Undo
   - a sample wardrobe to try the app with (kitSampleLoad): 22 pieces marked sample, a note on Today while they are there, removed in one tap */

/* ---- one sheet for the tour and the guide: cards with a picture, Back and Next, the last one closes it ---- */
let kit=null;   // {cards, at, then}
const KIT_TOUR='tour_seen';
const tourSeen=()=>{try{return localStorage.getItem(KIT_TOUR)==='1'}catch{return false}};
function kitEl(){let e=$('#kitsheet');if(!e){e=document.createElement('div');e.id='kitsheet';e.setAttribute('role','dialog');e.setAttribute('aria-modal','true');e.setAttribute('aria-labelledby','kit-title');document.body.appendChild(e)}return e}
function kitInert(on){for(const el of document.querySelectorAll('body>header,main,body>nav'))el.inert=on;if(!on&&typeof layerInert==='function')layerInert()}
function kitOpen(cards,then){kit={cards,at:0,then:then||null,from:document.activeElement};kitDraw();kitEl().classList.add('on');kitInert(true);
  const t=$('#kit-next');if(t)t.focus({preventScroll:true})}
function kitClose(){const e=$('#kitsheet');if(e){e.classList.remove('on');e.innerHTML=''}const k=kit;kit=null;kitInert(false);
  if(k&&k.cards===TOUR_CARDS){try{localStorage.setItem(KIT_TOUR,'1')}catch{}}
  if(k&&k.then)k.then();else if(k&&k.from&&k.from.isConnected)try{k.from.focus({preventScroll:true})}catch{}}
function kitGo(n){if(!kit)return;const at=kit.at+n;if(at>=kit.cards.length)return kitClose();if(at<0)return;kit.at=at;kitDraw();const t=$('#kit-next');if(t)t.focus({preventScroll:true})}
function kitDraw(){if(!kit)return;const c=kit.cards[kit.at],n=kit.cards.length,last=kit.at===n-1;
  kitEl().innerHTML=`<div class="kit-head"><div><h2 id="kit-title">${c.title}</h2>${n>1?`<small>${kit.at+1} of ${n}</small>`:''}</div><button type="button" class="kit-x" onclick="kitClose()" aria-label="Close">✕</button></div>
${n>1?`<div class="su-prog kit-prog" aria-hidden="true">${kit.cards.map((x,i)=>`<i class="${i<=kit.at?'on':''}"></i>`).join('')}</div>`:''}
<div class="kit-body" data-card="${c.key}"><div class="kit-pic" aria-hidden="true">${c.pic()}</div>${c.body}</div>
<div class="kit-bar">${kit.at?`<button type="button" id="kit-back" onclick="kitGo(-1)">Back</button>`:''}<button type="button" class="pri" id="kit-next" onclick="kitGo(1)">${last?(kit.lastLabel||c.last||'Got it'):'Next'}</button></div>`}
addEventListener('keydown',e=>{if(!kit)return;if(e.key==='Escape'){e.preventDefault();kitClose()}else if(e.key==='ArrowRight')kitGo(1);else if(e.key==='ArrowLeft')kitGo(-1)});

/* the pictures: drawn, in the app's own colours (no photos to download) */
const kitScorePic=()=>`<svg viewBox="0 0 300 150"><rect x="20" y="22" width="260" height="62" rx="14" class="kp-card"/><rect x="34" y="34" width="70" height="38" rx="10" class="kp-good"/><text x="69" y="60" class="kp-num">96</text><text x="118" y="50" class="kp-t">Excellent</text><text x="118" y="70" class="kp-s">Outfit score · tap for why</text>
<rect x="20" y="96" width="260" height="38" rx="10" class="kp-card"/><text x="34" y="120" class="kp-s">−2</text><text x="62" y="120" class="kp-t2">The same tie colour as yesterday</text></svg>`;
const kitClothPic=(paper=true,box=true)=>`<svg viewBox="0 0 200 260"><defs><pattern id="kp-weave" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#3b4256"/><path d="M0 8L8 0M-2 2L2 -2M6 10L10 6" stroke="#4b5370" stroke-width="1.6"/></pattern></defs>
<rect x="10" y="10" width="180" height="240" rx="12" fill="url(#kp-weave)"/>${paper?`<path d="M10 204 H190 V238 A12 12 0 0 1 178 250 H22 A12 12 0 0 1 10 238 Z" fill="#f4f3ef"/>`:''}
${box?`<rect x="37" y="46" width="126" height="148" rx="3" fill="none" stroke="#efb446" stroke-width="2.4" stroke-dasharray="7 5"/>`:''}</svg>`;
const kitShadePic=()=>{const s=['#2c3d66','#253558','#1f2d4a','#19253d','#131c30'];return `<svg viewBox="0 0 300 120">${s.map((c,i)=>`<rect x="${22+i*52}" y="${i===2?18:26}" width="${i===2?50:44}" height="${i===2?60:44}" rx="9" fill="${c}"${i===2?' class="kp-sel"':''}/>`).join('')}
<text x="47" y="104" class="kp-s" text-anchor="middle">lighter</text><text x="150" y="104" class="kp-t2" text-anchor="middle">as tagged</text><text x="253" y="104" class="kp-s" text-anchor="middle">darker</text></svg>`};
const kitPatternPic=()=>`<svg viewBox="0 0 300 150"><defs><pattern id="kp-gen" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="#2a3047"/><rect x="6" width="2" height="14" fill="#8d93a8"/></pattern>
<pattern id="kp-read" width="22" height="22" patternUnits="userSpaceOnUse"><rect width="22" height="22" fill="#2b2733"/><rect x="5" width="1.2" height="22" fill="#9a8fa6"/><rect x="15" width="1.2" height="22" fill="#7d4a59"/></pattern></defs>
<rect x="22" y="14" width="116" height="100" rx="12" fill="url(#kp-gen)"/><rect x="162" y="14" width="116" height="100" rx="12" fill="url(#kp-read)"/>
<text x="80" y="136" class="kp-s" text-anchor="middle">generic pinstripe</text><text x="220" y="136" class="kp-t2" text-anchor="middle">read from your cloth</text></svg>`;

/* ---- the quick tour ---- */
const TOUR_CARDS=[
  {key:'score',title:'The score',pic:kitScorePic,body:`<p>Every outfit gets a score out of 100.</p><p>Points come off only for things you can put right: shoes that don't suit the suit, a colour worn two days running, socks lighter than the trousers.</p><p class="kit-tip">Tap the score on Today to see why, and the swaps that would raise it.</p>`},
  {key:'closeup',title:'The close-up',pic:()=>kitClothPic(true,false),body:`<p>After the photo of the whole piece, take one close-up of the cloth: hold the phone close so the weave fills the screen.</p><p>It gives the true colour and the real size of the pattern. A sheet of plain white paper along one edge lets the app correct for the light: tap the paper on the camera screen before you take the picture.</p><p><button type="button" class="linkbtn" onclick="kitClose();kitCloseupGuide()">How to take a good close-up</button></p>`},
  {key:'shade',title:'Shade',pic:kitShadePic,body:`<p>If a piece is drawn lighter or darker than the real thing, Shade nudges it, up to six steps either way.</p><p><b>Match close-up</b> sets it from your close-up for you.</p><p class="kit-tip">Shade changes only the drawing. The colour the planner matches stays the one you tagged.</p>`},
  {key:'patterns',title:'Patterns',pic:kitPatternPic,body:`<p>Stripes, checks and weaves are read too.</p><p>With a close-up the app measures the stripes' widths and colours, so the drawing and the outfit pictures show your cloth, not a generic one.</p><p class="kit-tip">If a reading looks wrong, tap <b>Use the simple pattern</b> on the card, or <b>Read pattern from photo</b> on the item later.</p>`}];
/* then: what happens after the last card (the setup's "Add my first item" goes on to Add) */
function tourOpen(then,lastLabel){kitOpen(TOUR_CARDS,then);if(lastLabel){kit.lastLabel=lastLabel;kitDraw()}}

/* ---- the close-up guide ---- */
const GUIDE_CARD={key:'guide',title:'A good close-up',pic:()=>kitClothPic(true,true),last:'Got it',body:`<ol class="kit-list">
<li><b>Fill the screen with cloth.</b> Hold the phone a hand's width away, straight down, so the weave is sharp.</li>
<li><b>Lay plain white paper along one edge</b>, about a fifth of the picture, on the cloth or right beside it. Keep it out of the middle: the middle (dashed) is where the colour is measured.</li>
<li><b>Same light on both.</b> Daylight or room light; no flash, no patch of sun, no shadow of your phone across the paper.</li>
<li><b>Tap the paper on the camera screen</b> before you take the picture. The phone sets its exposure there, so the paper comes out white instead of glowing, and the app can read the light from it.</li></ol>
<p class="kit-tip">No paper? It still works: the colour is then corrected like the main photo, and lightness counts for less.</p>`};
function kitCloseupGuide(){kitOpen([GUIDE_CARD])}

/* ---- Undo after Confirm (app.js save calls this for each card saved) ----
   Cards saved within a moment of each other (Save all, an import) are one Undo. Undo takes the items out (a tombstone each, as Delete
   does) and puts their cards back on Add, in their places */
let kitBatch=null,kitQuiet=false;
const KIT_UNDO_MS=8000;
function kitSaved(it,q,i){if(kitQuiet)return;const now=Date.now();
  if(!kitBatch||now-kitBatch.at>1500)kitBatch={its:[],qs:[],at:now};kitBatch.its.push(it.id);kitBatch.qs.push({q,i});kitBatch.at=now;const b=kitBatch,n=b.its.length;
  toast(n===1?`Saved: ${sentence(itemTitle(it))}.`:`Saved ${n} items.`,KIT_UNDO_MS,{label:'Undo',fn:()=>kitUnsave(b)})}
async function kitUnsave(b){if(!b)return;
  for(const id of b.its){await del(id);items=items.filter(x=>x.id!==id)}
  for(const {q,i} of b.qs.slice().reverse()){if(!q)continue;delete q.busy;queue.splice(Math.min(i,queue.length),0,q)}
  if(kitBatch===b)kitBatch=null;cache={};todayStale=true;
  if(b.qs.length&&$('#add')&&!$('#add').hidden)renderAdd();else if(typeof renderWardrobe==='function'&&$('#wardrobe')&&!$('#wardrobe').hidden)renderWardrobe();
  toast(b.its.length===1?'Undone: the item is back on Add.':`Undone: ${b.its.length} items taken out.`,3000)}

/* ---- Duplicate (the item sheet): the same piece again, with a new id and no history, opened for any difference ---- */
const KIT_NO_COPY=['id','added','updated','paused','order','arrives','away','cleaned','sample'];
async function kitDuplicate(id){const it=items.find(x=>x.id===id);if(!it)return;const c=JSON.parse(JSON.stringify(it));for(const k of KIT_NO_COPY)delete c[k];
  c.id=crypto.randomUUID();c.added=Date.now();await put(c);items.push(c);cache={};todayStale=true;
  if(typeof renderWardrobe==='function'&&$('#wardrobe')&&!$('#wardrobe').hidden)renderWardrobe();
  openItem(c.id);toast('Duplicated. Change anything that differs, like its name.',3500)}

/* ---- import from a spreadsheet ----
   A CSV file (Excel, Numbers and Google Sheets all save one) or rows pasted straight from the spreadsheet (tab-separated). The first row
   names the columns, in any order and case; only Type and Colour are needed. Words are matched to the app's own lists: type names and
   common words for them (trousers, pants, slacks, chinos, jeans; necktie; tie bar; loafers…), colour names as the app shows them (light
   blue, mid grey), the owner's own colours by name, pattern names. A row that can't be read is shown with why and left out. */
const KIT_COLS={type:['type','item','category','what','kind of item'],primaryColor:['colour','color','main colour','main color','primary colour','primary color'],
  secondaryColor:['second colour','second color','secondary colour','secondary color','colour 2','color 2'],tertiaryColor:['third colour','third color','colour 3','color 3'],
  pattern:['pattern'],name:['name','label','nickname'],brand:['brand','maker'],material:['material','fabric','cloth'],notes:['notes','note','comments'],
  vest:['vest','waistcoat','three-piece','3-piece'],cuff:['cuffs','cuff'],kind:['trouser kind','trousers kind','fit'],style:['style','shoe style'],leather:['leather'],season:['season']};
const KIT_TYPE_WORDS={suit:['suit','suits','two-piece','three-piece'],blazer:['blazer','sport coat','sports coat','sportcoat','jacket'],pants:['trousers','pants','slacks','chinos','jeans','dress trousers'],
  shirt:['shirt','dress shirt','shirts'],tie:['tie','necktie','ties'],tieclip:['tie clip','tie bar','tieclip','tie pin'],watch:['watch','wristwatch'],shoes:['shoes','shoe','oxfords','oxford','derbies','derby','loafers','loafer','boots','boot','sneakers','trainers'],
  belt:['belt'],socks:['socks','sock'],cufflinks:['cufflinks','cuff links'],overcoat:['overcoat','coat','topcoat','top coat','wool coat'],raincoat:['raincoat','trench','trench coat','mac']};
const kitNorm=s=>String(s??'').trim().toLowerCase().replace(/[_\s]+/g,' ').replace(/grey|gray/g,'grey');
function kitSplit(text){text=String(text||'').replace(/^﻿/,'').replace(/\r\n?/g,'\n');const first=text.split('\n',1)[0];
  const d=first.includes('\t')?'\t':(first.split(';').length>first.split(',').length?';':',');const rows=[];let row=[],f='',q=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(q){if(c==='"'){if(text[i+1]==='"'){f+='"';i++}else q=false}else f+=c;continue}
    if(c==='"'&&f==='')q=true;else if(c===d){row.push(f);f=''}else if(c==='\n'){row.push(f);rows.push(row);row=[];f=''}else f+=c}
  if(f!==''||row.length){row.push(f);rows.push(row)}return rows.filter(r=>r.some(v=>String(v).trim()))}
function kitColour(word,type){const w=kitNorm(word).replace(/^(navy blue)$/,'navy').replace(/^(off white|off-white)$/,'ivory');if(!w||w==='none'||w==='-')return null;
  const own=Object.entries((settings.custom&&settings.custom.colors)||{}).find(([k,v])=>kitNorm(v&&v.name)===w);if(own)return own[0];
  const keys=Object.keys(COLORS);let k=keys.find(c=>kitNorm(colName(c))===w||kitNorm(c)===w||kitNorm(c)===w.replace(/ /g,''));
  return k||undefined}
function kitPattern(word,type){const w=kitNorm(word);if(!w||w==='plain'||w==='none'||w==='solid')return 'solid';
  const list=(PATS_BY[type]||[]);const own=Object.entries((settings.custom&&settings.custom.patterns)||{}).find(([k,v])=>kitNorm(v&&v.name)===w);if(own)return own[0];
  const syn={striped:'stripe',stripes:'stripe',stripe:'stripe',checked:'check',checks:'check','pin stripe':'pinstripe','pin-stripe':'pinstripe','chalkstripe':'chalk-stripe','glen plaid':'glen-check','prince of wales':'glen-check','polka dots':'polka-dot','polka dot':'polka-dot',dots:'polka-dot'};
  const k=list.find(p=>kitNorm(patLabel(p))===w||p===w)||(syn[w]&&list.includes(syn[w])?syn[w]:null);return k||undefined}
function kitRead(text){const rows=kitSplit(text);if(!rows.length)return {err:'Nothing to read.'};
  const head=rows[0].map(kitNorm),col={};for(const [k,names] of Object.entries(KIT_COLS)){const j=head.findIndex(h=>names.includes(h));if(j>=0)col[k]=j}
  if(col.type==null||col.primaryColor==null)return {err:'The first row must name the columns, with at least “Type” and “Colour”. Download the template to see how.'};
  const out=[];
  rows.slice(1).forEach((r,n)=>{const v=k=>col[k]==null?'':String(r[col[k]]??'').trim(),line=n+2,probs=[];
    const tw=kitNorm(v('type'));let type=Object.keys(KIT_TYPE_WORDS).find(t=>KIT_TYPE_WORDS[t].includes(tw))||Object.keys(TYPES).find(t=>kitNorm(TYPES[t])===tw);
    if(!type){out.push({line,ok:false,raw:v('type')||'(empty)',why:`“${v('type')||'(no type)'}” isn't a type the app knows`});return}
    const c=kitColour(v('primaryColor'),type);if(!c){out.push({line,ok:false,raw:v('type'),why:c===null?'no colour':`“${v('primaryColor')}” isn't a colour the app knows`});return}
    const c2=kitColour(v('secondaryColor'),type),c3=kitColour(v('tertiaryColor'),type);if(c2===undefined)probs.push(`second colour “${v('secondaryColor')}” left out`);if(c3===undefined)probs.push(`third colour “${v('tertiaryColor')}” left out`);
    let pattern='solid';if(FABRIC.includes(type)){const p=kitPattern(v('pattern'),type);if(p===undefined)probs.push(`pattern “${v('pattern')}” read as plain`);else pattern=p}
    const card={id:crypto.randomUUID(),manual:true,type,primaryColor:c,secondaryColor:c2||null,tertiaryColor:c3||null,pattern,metal:'silver',leather:'calf'};
    const yes=s=>/^(y|yes|true|1|x|matching|with)/i.test(String(s).trim());
    if(type==='suit')card.vest=yes(v('vest'))?'yes':'no';
    if(type==='shirt')card.cuff=/french|double/i.test(v('cuff'))?'french':'button';
    if(type==='pants'){const k=kitNorm(v('kind')||tw);card.trouserKind=/jean|denim/.test(k)?'jeans':/chino/.test(k)?'chinos':'dress'}
    if(type==='shoes'){const s=kitNorm(v('style')||tw);card.shoeStyle=/derb/.test(s)?'derby':/loaf/.test(s)?'loafer':/boot/.test(s)?'boot':/sneak|train/.test(s)?'sneaker':'oxford';
      const l=kitNorm(v('leather'));if(/suede/.test(l))card.leather='suede';else if(/patent/.test(l))card.leather='patent';else if(/cordovan/.test(l))card.leather='cordovan'}
    if(type==='belt'){const l=kitNorm(v('leather'));if(/suede/.test(l))card.leather='suede'}
    if(SEASON_TYPES.includes(type)){const s=kitNorm(v('season'));if(/^(summer|warm)/.test(s))card.season='warm';else if(/^(winter|cold)/.test(s))card.season='cold'}
    for(const k of ['name','brand','material','notes'])if(v(k))card[k]=v(k);
    out.push({line,ok:true,card,probs})});
  return {rows:out}}
const KIT_TEMPLATE='Type,Colour,Second colour,Pattern,Name,Brand,Material,Notes,Vest\nSuit,Navy,,Pinstripe,Navy pinstripe,,Wool,,Yes\nDress shirt,Light blue,,Solid,,,Cotton,,\nTie,Burgundy,Navy,Stripe,,,Silk,Repp stripe,\nShoes,Black,,,Black oxfords,,,,\nTrousers,Mid grey,,Solid,,,,Flannel,\n';
function kitTemplate(){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([KIT_TEMPLATE],{type:'text/csv'}));a.download='wardrobe-template.csv';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}
let kitImp=null;   // {rows} once read
function kitImportOpen(){kitImp=null;const e=kitEl();kit={cards:[],at:0,then:null,from:document.activeElement};
  e.innerHTML=`<div class="kit-head"><div><h2 id="kit-title">Import from a spreadsheet</h2></div><button type="button" class="kit-x" onclick="kitClose()" aria-label="Close">✕</button></div>
<div class="kit-body" data-card="import"><p>One row per piece. The first row names the columns; only <b>Type</b> and <b>Colour</b> are needed. Save the sheet as CSV, or copy the rows and paste them below.</p>
<div class="btns"><button type="button" onclick="kitTemplate()">Download a template</button><label class="btn">Choose a CSV file<input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" class="vfile" onchange="kitImportFile(this.files[0]);this.value=''"></label></div>
<label class="kit-paste">Or paste the rows<textarea id="kit-paste" rows="5" placeholder="Type, Colour, Pattern…" oninput="kitImportText(this.value)"></textarea></label>
<div id="kit-prev" aria-live="polite"></div></div>
<div class="kit-bar"><button type="button" onclick="kitClose()">Cancel</button><button type="button" class="pri" id="kit-imp" disabled onclick="kitImportGo()">Add items</button></div>`;
  e.classList.add('on');kitInert(true)}
async function kitImportFile(f){if(!f)return;const t=await f.text();const ta=$('#kit-paste');if(ta)ta.value='';kitImportText(t)}
function kitImportText(t){const r=kitRead(t),el=$('#kit-prev'),b=$('#kit-imp');if(!el)return;
  if(r.err){kitImp=null;el.innerHTML=String(t).trim()?`<p class="kit-err">${esc(r.err)}</p>`:'';if(b){b.disabled=true;b.textContent='Add items'}return}
  kitImp=r;const good=r.rows.filter(x=>x.ok),bad=r.rows.filter(x=>!x.ok);
  el.innerHTML=`<p class="kit-sum"><b>${good.length} item${good.length===1?'':'s'} ready</b>${bad.length?`, ${bad.length} row${bad.length===1?'':'s'} left out`:''}</p>
<ul class="kit-rows">${r.rows.map(x=>x.ok?`<li class="ok"><span class="kit-dot">${swatchSVG(x.card,true)}</span><span><b>${esc(sentence(itemTitle(x.card)))}</b><small>${esc([TYPES[x.card.type],...x.probs].join(' · '))}</small></span></li>`
    :`<li class="bad"><span class="kit-dot kit-no" aria-hidden="true">!</span><span><b>Row ${x.line}</b><small>${esc(x.why)}</small></span></li>`).join('')}</ul>`;
  if(b){b.disabled=!good.length;b.textContent=good.length?`Add ${good.length} item${good.length===1?'':'s'}`:'Add items'}}
/* each row saved as a card added by hand (app.js save: the dress code's waistcoat rule, swatches, sync), then one Undo for them all */
async function kitSaveCards(cards){kitQuiet=true;const ids=[];try{for(const c of cards){queue.unshift({...c});await save(0);const it=items[items.length-1];if(it&&it.id===c.id)ids.push(it.id)}}finally{kitQuiet=false}return ids}
async function kitImportGo(){if(!kitImp)return;const cards=kitImp.rows.filter(x=>x.ok).map(x=>x.card);if(!cards.length)return;
  const ids=await kitSaveCards(cards);kitClose();cache={};todayStale=true;if($('#add')&&!$('#add').hidden)renderAdd();
  toast(`Imported ${ids.length} item${ids.length===1?'':'s'}.`,KIT_UNDO_MS,{label:'Undo',fn:()=>kitUnsave({its:ids,qs:[]})})}

/* ---- a sample wardrobe to try the app with: plain and patterned pieces enough for a varied month, marked sample ---- */
const KIT_SAMPLE=[
  ['suit','navy',null,'solid',{vest:'no',name:'Navy suit'}],['suit','charcoal',null,'pinstripe',{vest:'yes',name:'Charcoal pinstripe'}],['suit','midgrey',null,'herringbone',{vest:'no'}],
  ['blazer','navy',null,'solid',{name:'Navy blazer'}],['blazer','tan',null,'windowpane',{}],
  ['pants','grey',null,'solid',{}],['pants','stone',null,'solid',{trouserKind:'chinos'}],
  ['shirt','white',null,'solid',{}],['shirt','lightblue',null,'solid',{}],['shirt','white','blue','stripe',{}],['shirt','pink',null,'solid',{}],['shirt','white',null,'solid',{cuff:'french'}],
  ['tie','burgundy',null,'solid',{}],['tie','navy','white','polka-dot',{}],['tie','green',null,'solid',{}],['tie','silver',null,'solid',{}],['tie','navy','burgundy','stripe',{}],
  ['shoes','black',null,'solid',{shoeStyle:'oxford'}],['shoes','brown',null,'solid',{shoeStyle:'derby'}],
  ['belt','black',null,'solid',{}],['belt','brown',null,'solid',{}],['socks','navy',null,'solid',{}],['socks','charcoal',null,'solid',{}],['watch','silver',null,'solid',{metal:'silver'}]];
const kitHasSample=()=>items.some(i=>i.sample);
async function kitSampleLoad(){if(items.length&&!kitHasSample()&&!await askConfirm('Add the sample wardrobe next to your own clothes?',{ok:'Add the sample'}))return;
  const cards=KIT_SAMPLE.map(([type,c,c2,p,x])=>({id:crypto.randomUUID(),manual:true,type,primaryColor:c,secondaryColor:c2,tertiaryColor:null,pattern:FABRIC.includes(type)?p:'solid',metal:'silver',leather:'calf',sample:true,...x}));
  const ids=await kitSaveCards(cards);
  cache={};todayStale=true;show('today');if(typeof goToday==='function')goToday();   // on a weekend, the next workday's outfit
  toast(`A sample wardrobe of ${ids.length} pieces: swipe through the days to see outfits.`,4500)}
async function kitSampleRemove(){const s=items.filter(i=>i.sample);if(!s.length)return;
  if(!await askConfirm(`Remove the ${s.length} sample pieces?\n\nYour own clothes stay.`,{ok:'Remove',danger:true}))return;
  for(const it of s)await del(it.id);items=items.filter(i=>!i.sample);if(typeof clearLocks==='function')await clearLocks();cache={};todayStale=true;
  show(items.length?'today':'wardrobe');toast('The sample wardrobe is gone.',3000)}
/* Today, while sample pieces are there */
function kitSampleBanner(){if(!kitHasSample())return '';const own=items.filter(i=>!i.sample).length;
  return `<div class="kit-banner" id="kit-sample"><b>You're trying a sample wardrobe</b><small>${own?`Your ${own} own piece${own===1?' is':'s are'} mixed in. `:''}Swipe through the days, tap the score, try a swap. Add your own clothes whenever you like.</small>
<div class="btns"><button type="button" onclick="openAdd()">Add my own</button><button type="button" onclick="kitSampleRemove()">Remove the sample</button></div></div>`}
/* the setup's last step, Today's checklist and the empty Wardrobe: the ways in for a new user */
const kitStartRow=()=>`<div class="kit-start"><button type="button" class="linkbtn" id="kit-tour-link" onclick="tourOpen()">Take the 1-minute tour</button><span aria-hidden="true">·</span><button type="button" class="linkbtn" id="kit-sample-link" onclick="kitSampleLoad()">Try a sample wardrobe</button></div>`;
