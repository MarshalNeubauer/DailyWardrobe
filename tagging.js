/* Daily Wardrobe: photo tagging. The request to the worker (sharper photos, the fabric close-up, the owner's own colours and
   patterns, the corrections the owner made before), measuring the cloth's colour after white balance, tagging again from the
   close-up, adding a colour or pattern the lists lack, and the tagging benchmark. */

const TAG_MAX=2048,CLOSE_MAX=1536,TAG_Q=.92;
/* the colours and patterns the owner added, when there are any (the worker adds them to what the tagger may answer) */
const customForTag=()=>{const c=settings.custom||{};return (c.colors||[]).length||(c.patterns||[]).length?{colors:c.colors||[],patterns:c.patterns||[]}:undefined};
/* the latest corrections (another item's only: the benchmark must not hand an item its own answer) */
const tagFixes=skipId=>(settings.tagFixes||[]).filter(f=>f.id!==skipId).slice(-20).map(({field,type,from,to})=>({field,type,from,to}));
const tagExtras=(x={})=>({custom:customForTag(),corrections:tagFixes(x.skipId),...(x.closeup?{closeup:x.closeup}:{}),...(x.measured?{measured:x.measured}:{})});

/* ---- tagging copies: the sharp photo sent to the tagger is kept on this device only (Cache Storage, not synced, not loaded
   at start-up), so the benchmark can re-tag an item from the same picture later ---- */
const TAGIMG_CACHE='dw-keep-tagimg';
async function keepTagImg(id,url){try{if(!url||!self.caches)return;const c=await caches.open(TAGIMG_CACHE);await c.put(new Request('tagimg/'+id),new Response(await (await fetch(url)).blob()))}catch(e){console.warn('tag copy not kept',e)}}
async function tagImgOf(id){try{if(!self.caches)return null;const c=await caches.open(TAGIMG_CACHE),r=await c.match(new Request('tagimg/'+id));if(!r)return null;
  const b=await r.blob();return await new Promise(ok=>{const f=new FileReader();f.onload=()=>ok(f.result);f.onerror=()=>ok(null);f.readAsDataURL(b)})}catch{return null}}

/* ---- the light reading of a picture: white-balance gains from its brightest near-neutral pixels, whether such a white
   reference is there at all, and how bright it is once corrected (for the exposure of a close-up with white paper in it) ---- */
function wbRead(c){
  const k=Math.min(1,200/Math.max(c.width,c.height)),w=Math.max(1,Math.round(c.width*k)),h=Math.max(1,Math.round(c.height*k)),t=document.createElement('canvas');t.width=w;t.height=h;
  const x=t.getContext('2d',{willReadFrequently:true});x.drawImage(c,0,0,w,h);const d=x.getImageData(0,0,w,h).data,n=w*h,lums=new Float32Array(n);
  for(let i=0,j=0;i<d.length;i+=4,j++)lums[j]=(d[i]+d[i+1]+d[i+2])/3;
  const thr=Math.max(150,[...lums].sort((a,b)=>a-b)[Math.floor(n*.95)]-12);let R=0,G=0,B=0,m=0;
  for(let i=0,j=0;i<d.length;i+=4,j++){if(lums[j]<thr)continue;const mx=Math.max(d[i],d[i+1],d[i+2]),mn=Math.min(d[i],d[i+1],d[i+2]);
    if(mx>=250&&mn>=250)continue;   // clipped highlights say nothing about the light
    if((mx-mn)/mx<.35){R+=d[i];G+=d[i+1];B+=d[i+2];m++}}   // a white wall under tungsten light reads about 30% saturated
  if(m<n*.005||m>n*.85)return {gains:null,ref:false,refLum:0,frac:m/n};
  const g=(R+G+B)/3/m,cl=v=>Math.min(1.18,Math.max(.85,v)),gains={r:cl(g/(R/m)),g:cl(g/(G/m)),b:cl(g/(B/m))};
  const sig=Math.max(...Object.values(gains).map(v=>Math.abs(v-1)))>=.02;
  return {gains:sig?gains:null,ref:true,refLum:(R/m*gains.r+G/m*gains.g+B/m*gains.b)/3,frac:m/n}}
const wbGains=c=>wbRead(c).gains;

/* ---- measuring the cloth: the median CIELAB colour of a region (a box in thousandths, or the middle of the picture), after
   the white-balance gains; with a white reference (paper in the close-up) the exposure is also set from it, so lightness is
   trustworthy. Shadows and highlights (the darkest and brightest tenth) and the reference itself are left out. ---- */
const sLin=u=>{u/=255;return u>.04045?((u+.055)/1.055)**2.4:u/12.92},linS=u=>255*(u>.0031308?1.055*u**(1/2.4)-.055:12.92*u);
function measureCloth(c,box,{gains=null,refLum=0}={}){
  const W=c.width,H=c.height,bx=box?{x:box.x/1000*W,y:box.y/1000*H,w:box.w/1000*W,h:box.h/1000*H}:{x:W*.15,y:H*.15,w:W*.7,h:H*.7};
  const k=Math.min(1,120/Math.max(bx.w,bx.h)),w=Math.max(1,Math.round(bx.w*k)),h=Math.max(1,Math.round(bx.h*k)),t=document.createElement('canvas');t.width=w;t.height=h;
  const x=t.getContext('2d',{willReadFrequently:true});x.drawImage(c,bx.x,bx.y,bx.w,bx.h,0,0,w,h);const d=x.getImageData(0,0,w,h).data;
  const g=gains||{r:1,g:1,b:1},ex=refLum?sLin(243)/sLin(Math.min(250,refLum)):1;
  let px=[];for(let i=0;i<d.length;i+=4){const rgb=[d[i]*g.r,d[i+1]*g.g,d[i+2]*g.b].map(v=>linS(Math.min(1,sLin(Math.min(255,v))*ex)));px.push(rgb)}
  if(refLum){const keep=px.filter(([r,gg,b])=>{const mx=Math.max(r,gg,b),mn=Math.min(r,gg,b);return !(mx>225&&(mx-mn)/mx<.12)});if(keep.length>=px.length*.2)px=keep}   // not the paper
  const labs=px.map(p=>rgbLab(...p)).sort((a,b)=>a[0]-b[0]),cut=Math.floor(labs.length*.1),mid=labs.slice(cut,labs.length-cut||labs.length);
  const med=j=>{const v=mid.map(l=>l[j]).sort((a,b)=>a-b);return v[Math.floor(v.length/2)]};
  const lab=[med(0),med(1),med(2)].map(v=>Math.round(v*10)/10);return {lab,hex:labHex(lab),ref:!!refLum}}
/* the colour each name has in this wardrobe: the median of the owner's own measured items of that colour (the same kind of
   item), once there are two; otherwise the app's swatch. Measurements with a white reference count first. */
const typeGroup=t=>['suit','blazer','pants','overcoat','raincoat'].includes(t)?'cloth':t;
function calibLab(c,type){const ms=items.filter(i=>primaryCol(i)===c&&i.meas&&typeGroup(i.type)===typeGroup(type)).map(i=>i.meas),good=ms.filter(m=>m.ref),use=good.length>=2?good:ms;
  if(use.length<2)return null;const med=j=>{const v=use.map(m=>m.lab[j]).sort((a,b)=>a-b);return v[Math.floor(v.length/2)]};return [med(0),med(1),med(2)]}
function nearestCols(type,lab,ref){return colsFor(type).map(c=>({c,d:Math.round(dE00(lab,calibLab(c,type)||labOf(c),ref?1:2)*10)/10})).sort((a,b)=>a.d-b.d).slice(0,3)}
const FAR_DE=12;   // further than this from every allowed colour: offer to add a new one
/* the card's measurement: the close-up when there is one (with its own white reference if it has one, else the item photo's
   light reading), otherwise the plain-cloth box Claude pointed at in the item photo */
function measureCard(q){
  let m=null;
  if(q.raw&&q.raw.tex){const r=wbRead(q.raw.tex);
    m=r.ref?{...measureCloth(q.raw.tex,null,{gains:r.gains,refLum:r.refLum}),src:'closeup'}:{...measureCloth(q.raw.tex,null,{gains:q.wbOff?null:q.wb}),src:'closeup'}}
  else if(q.clothBox&&q.raw&&q.raw.big)m={...measureCloth(q.raw.big,q.clothBox,{gains:q.wbOff?null:q.wb}),src:'photo'};
  if(m)m.near=nearestCols(q.type,m.lab,m.ref);q.meas=m;return m}
const measHint=m=>m&&{lab:m.lab,hex:m.hex,ref:m.ref,src:m.src,near:m.near};

/* ---- tagging again once the close-up is in: both photos and the measurement go to the tagger; fields the owner has set by
   hand stay, the rest take the new answer, and the card says what changed ---- */
const TAG_FIELDS=['type','primaryColor','secondaryColor','tertiaryColor','pattern'];
const fieldLabel={type:'item',primaryColor:'colour',secondaryColor:'second colour',tertiaryColor:'third colour',pattern:'pattern'};
const valName=(k,v)=>!v?'none':k==='type'?(TYPES[v]||v).toLowerCase():k==='pattern'?patName(v):colName(v);
/* what the tagger answered, as the card's values (the same normalising as a first tag) */
function aiFields(ai){return {type:ai.type,primaryColor:COLORS[ai.primaryColor]?ai.primaryColor:'grey',secondaryColor:ai.secondaryColor&&ai.secondaryColor!=='none'?ai.secondaryColor:null,
  tertiaryColor:ai.tertiaryColor&&ai.tertiaryColor!=='none'?ai.tertiaryColor:null,pattern:normPat(ai.type,ai.pattern)}}
function takeExtras(q,ai){Object.assign(q,{conf:ai.conf||null,altColor:ai.altColor||null,altPattern:ai.altPattern||null,newColor:ai.newColor||null,newPattern:ai.newPattern||null,clothBox:ai.clothBox||q.clothBox||null,
    patternBox:ai.patternBox||q.patternBox||null,weave:ai.weave||q.weave||null});
  q.aiTag={...aiFields(ai)};readSett(q)}
async function closeTagImg(q){const r=wbRead(q.raw.texFull||q.raw.tex),g=r.ref?r.gains:(q.wbOff?null:q.wb);return applyWb(q.raw.texFull||q.raw.tex,g).toDataURL('image/jpeg',TAG_Q)}
async function refineFromCloseup(i){const q=queue[i];if(!q||!q.raw||!q.raw.tex)return;measureCard(q);
  if(!q.tagImg||!localStorage.getItem('worker_url')){renderAdd();return}
  q.refining=1;renderAdd();
  const ai=await ask(q.tagImg,{closeup:await closeTagImg(q),measured:measHint(q.meas)});const k=queue.indexOf(q);q.refining=0;
  if(!ai||!ai.type){q.refineNote=aiError||'Tagging again from the close-up didn’t work; the first tags stay.';if(k>=0)renderAdd();return}
  const f=aiFields(ai),changes=[];
  for(const key of TAG_FIELDS)if(!(q.edited&&q.edited[key])&&f[key]!==q[key]){changes.push(`${fieldLabel[key]} ${valName(key,q[key])} → ${valName(key,f[key])}`);q[key]=f[key]}
  if(changes.some(c=>c.startsWith('item ')))q.pattern=normPat(q.type,q.pattern);
  takeExtras(q,ai);measureCard(q);q.model=ai.model||q.model;
  q.refineNote=changes.length?'Updated from the close-up: '+changes.join(', ')+'.':'The close-up confirmed the tags.';if(k>=0)renderAdd()}

/* ---- the card's tagging notes: how sure Claude was, its runner-up (one tap to take it), the measured colour, and an offer to
   add a colour or pattern when none of the listed ones fits ---- */
const confTxt=c=>c?['type','primaryColor','pattern'].filter(k=>c[k]&&c[k]!=='high').map(k=>`${fieldLabel[k]}: ${c[k]} confidence`).join(' · '):'';
function tagNotes(q,i){if(q.manual)return '';const out=[];
  if(q.refining)out.push('<p class="tagnote mut"><small>Tagging again with the close-up…</small></p>');
  else if(q.refineNote)out.push(`<p class="tagnote"><small>${esc(q.refineNote)}</small></p>`);
  const ct=confTxt(q.conf),alts=[q.altColor&&q.altColor!==q.primaryColor&&colsFor(q.type).includes(q.altColor)?`<button type="button" class="chipbtn" onclick="setq(${i},'primaryColor','${q.altColor}')">or ${esc(colName(q.altColor))}</button>`:'',
    q.altPattern&&q.altPattern!==q.pattern&&(PATS_BY[q.type]||[]).includes(q.altPattern)?`<button type="button" class="chipbtn" onclick="setq(${i},'pattern','${q.altPattern}')">or ${esc(patName(q.altPattern))}</button>`:''].join('');
  if(ct||alts)out.push(`<p class="tagnote mut"><small>${ct}</small>${alts}</p>`);
  out.push(settNote(q,i));
  const m=q.meas;if(m&&m.near&&m.near.length){const n=m.near;out.push(`<p class="tagnote measrow"><span class="msw" style="background:${m.hex}" title="${m.hex}"></span><small>Measured ${m.src==='closeup'?'in the close-up':'in the photo'}${m.ref?' (white reference)':''}: closest ${n.map(x=>`${esc(colName(x.c))} (ΔE ${x.d})`).join(', ')}</small></p>`)}
  if(FABRIC.includes(q.type)||COLS_BY[q.type]){const far=m&&m.near&&m.near.length&&m.near[0].d>FAR_DE;
    if(q.colForm)out.push(newColForm(q,i));
    else if(q.newColor||far)out.push(`<div class="offer"><small>${q.newColor?`None of your colours quite fit: Claude calls it <b>${esc(q.newColor.name)}</b>${q.newColor.why?`, ${esc(q.newColor.why)}`:''}.`:'The measured colour is far from every colour for this item.'}</small><button type="button" class="chipbtn" onclick="openColForm(${i})">Add as a new colour</button></div>`)}
  if(PATS_BY[q.type]){if(q.patForm)out.push(newPatForm(q,i));
    else if(q.newPattern)out.push(`<div class="offer"><small>No listed pattern fits: Claude calls it <b>${esc(q.newPattern.name)}</b>${q.newPattern.why?`: ${esc(q.newPattern.why)}`:''}.</small><button type="button" class="chipbtn" onclick="openPatForm(${i})">Add this pattern</button></div>`)}
  return out.join('')}

/* ---- adding a colour or a pattern (settings.custom, synced; see applyCustom in core.js) ---- */
const COL_GROUPS=[['suit','blazer','pants'],['overcoat','raincoat'],['shirt'],['tie'],['socks'],['shoes','belt']];
const groupOf=t=>COL_GROUPS.find(g=>g.includes(t))||[t];
function openColForm(i){const q=queue[i];q.colForm={name:q.newColor?q.newColor.name:'',hex:q.meas?q.meas.hex:COLORS[q.primaryColor]||'#888888',types:groupOf(q.type),accent:false};
  const lab=rgbLab(...hexRgb(q.colForm.hex));q.colForm.base=Object.keys(COLORS).filter(c=>!CUSTOM_COL[c]&&!SHIRT_ONLY.includes(c)).sort((a,b)=>dE00(lab,labOf(a))-dE00(lab,labOf(b)))[0];renderAdd()}
function newColForm(q,i){const f=q.colForm,bases=Object.keys(COLORS).filter(c=>!CUSTOM_COL[c]&&!SHIRT_ONLY.includes(c)).sort();
  return `<div class="newform"><b>New colour</b>
  <label>Name <input type="text" maxlength="24" value="${esc(f.name)}" oninput="queue[${i}].colForm.name=this.value"></label>
  <label>Shade <input type="color" value="${f.hex}" oninput="queue[${i}].colForm.hex=this.value"></label>
  <label>Behaves like <select onchange="queue[${i}].colForm.base=this.value">${bases.map(c=>`<option value="${c}"${c===f.base?' selected':''}>${esc(colName(c))}</option>`).join('')}</select></label>
  <small class="mut">The outfit rules treat it like this colour; it keeps its own shade in the drawings.</small>
  <div class="typechecks">${Object.keys(COLS_BY).map(t=>`<label><input type="checkbox" ${f.types.includes(t)?'checked':''} onchange="colFormType(${i},'${t}',this.checked)"> ${TYPES[t]}</label>`).join('')}</div>
  <label><input type="checkbox" ${f.accent?'checked':''} onchange="queue[${i}].colForm.accent=this.checked"> Also offer it for stripes and motifs</label>
  <p class="mut formerr" id="colerr-${i}"></p>
  <div class="btns"><button type="button" class="pri" onclick="saveColForm(${i})">Add colour</button><button type="button" onclick="queue[${i}].colForm=null;renderAdd()">Cancel</button></div></div>`}
function colFormType(i,t,on){const f=queue[i].colForm;f.types=on?[...new Set([...f.types,t])]:f.types.filter(x=>x!==t)}
async function addCustomColor({name,hex,base,types,accent}){name=String(name||'').trim();const key=ownColKey(name);
  if(key.length<5)throw new Error('Give it a name of at least two letters.');if(COLORS[key])throw new Error('There is already a colour with that name.');
  if(!/^#[0-9a-f]{6}$/i.test(hex))throw new Error('Pick a shade.');if(!COLORS[base]||CUSTOM_COL[base])throw new Error('Choose what it behaves like.');
  if(!types.length)throw new Error('Tick at least one kind of item.');
  const cu=settings.custom||{};settings.custom={...cu,colors:[...(cu.colors||[]),{key,name,hex:hex.toLowerCase(),base,types,accent:!!accent}]};
  applyCustom(settings.custom);await saveUserSettings();return key}
async function saveColForm(i){const q=queue[i];try{const key=await addCustomColor(q.colForm);q.colForm=null;q.newColor=null;q.primaryColor=key;q.edited={...q.edited,primaryColor:true};
  if(q.meas)q.meas.near=nearestCols(q.type,q.meas.lab,q.meas.ref);renderAdd();toast(`${colName(key)} added to your colours.`)}catch(e){const el=$('#colerr-'+i);if(el)el.textContent=e.message}}
function openPatForm(i){const q=queue[i];q.patForm={name:q.newPattern?q.newPattern.name:'',desc:q.newPattern?q.newPattern.why:'',base:q.pattern&&!CUSTOM_PAT[q.pattern]?q.pattern:'solid',types:[q.type]};renderAdd()}
function newPatForm(q,i){const f=q.patForm,bases=(PATS_BY[q.type]||['solid']).filter(p=>!CUSTOM_PAT[p]);
  return `<div class="newform"><b>New pattern</b>
  <label>Name <input type="text" maxlength="24" value="${esc(f.name)}" oninput="queue[${i}].patForm.name=this.value"></label>
  <label>How it looks <input type="text" maxlength="150" value="${esc(f.desc)}" oninput="queue[${i}].patForm.desc=this.value"></label>
  <label>Drawn like <select onchange="queue[${i}].patForm.base=this.value">${bases.map(p=>`<option value="${p}"${p===f.base?' selected':''}>${esc(patLabel(p))}</option>`).join('')}</select></label>
  <small class="mut">The drawings and the outfit rules use this pattern for it; your close-up shows the real thing.</small>
  <div class="typechecks">${Object.keys(PATS_BY).map(t=>`<label><input type="checkbox" ${f.types.includes(t)?'checked':''} onchange="patFormType(${i},'${t}',this.checked)"> ${TYPES[t]}</label>`).join('')}</div>
  <p class="mut formerr" id="paterr-${i}"></p>
  <div class="btns"><button type="button" class="pri" onclick="savePatForm(${i})">Add pattern</button><button type="button" onclick="queue[${i}].patForm=null;renderAdd()">Cancel</button></div></div>`}
function patFormType(i,t,on){const f=queue[i].patForm;f.types=on?[...new Set([...f.types,t])]:f.types.filter(x=>x!==t)}
async function addCustomPattern({name,desc,base,types}){name=String(name||'').trim();const key=ownPatKey(name);
  if(key.length<6)throw new Error('Give it a name of at least two letters.');if(CUSTOM_PAT[key]||Object.values(PATS_BY).some(l=>l.includes(key)))throw new Error('There is already a pattern with that name.');
  types=types.filter(t=>PATS_BY[t]&&PATS_BY[t].includes(base));if(!types.length)throw new Error('Tick at least one kind of item that has the "drawn like" pattern.');
  const cu=settings.custom||{};settings.custom={...cu,patterns:[...(cu.patterns||[]),{key,name,desc:String(desc||'').trim().slice(0,150),base,types}]};
  applyCustom(settings.custom);await saveUserSettings();return key}
async function savePatForm(i){const q=queue[i];try{const key=await addCustomPattern(q.patForm);q.patForm=null;q.newPattern=null;q.pattern=key;q.edited={...q.edited,pattern:true};renderAdd();toast(`${patName(key)} added to your patterns.`)}
  catch(e){const el=$('#paterr-'+i);if(el)el.textContent=e.message}}
/* Settings: the colours and patterns you added; one no item uses can be removed */
function renderCustomUI(){const el=$('#custom-list');if(!el)return;const cu=settings.custom||{},cols=cu.colors||[],pats=cu.patterns||[];
  const used=(k,f)=>items.filter(i=>f(i,k)).length;
  el.innerHTML=!cols.length&&!pats.length?'<p class="mut"><small>None yet. When a photo shows a colour or pattern the lists lack, the Add card offers to add it.</small></p>':
    [...cols.map(c=>{const n=used(c.key,(i,k)=>[i.primaryColor,i.secondaryColor,i.tertiaryColor].includes(k));return `<div class="custrow"><span class="msw" style="background:${c.hex}"></span><span><b>${esc(c.name)}</b><br><small class="mut">behaves like ${esc(colName(c.base))} · ${c.types.map(t=>TYPES[t]).join(', ')}${n?` · ${n} item${n>1?'s':''}`:''}</small></span>${n?'':`<button type="button" onclick="removeCustom('colors','${c.key}')">Remove</button>`}</div>`}),
     ...pats.map(p=>{const n=used(p.key,(i,k)=>i.pattern===k);return `<div class="custrow"><span class="msw pat">▦</span><span><b>${esc(p.name)}</b><br><small class="mut">drawn like ${esc(patLabel(p.base))} · ${p.types.map(t=>TYPES[t]).join(', ')}${n?` · ${n} item${n>1?'s':''}`:''}</small></span>${n?'':`<button type="button" onclick="removeCustom('patterns','${p.key}')">Remove</button>`}</div>`})].join('')}
async function removeCustom(kind,key){const cu=settings.custom||{};settings.custom={...cu,[kind]:(cu[kind]||[]).filter(x=>x.key!==key)};applyCustom(settings.custom);cache={};await saveUserSettings();renderCustomUI()}

/* ---- what the tagger learns from: when an AI-tagged card is saved with a field changed, the change is kept (the latest 60)
   and the latest 20 go with every tagging request; the counts give the accuracy on the stats page ---- */
async function recordTagResult(q,it){if(!q.ai||!q.aiTag)return;const st={n:0,wrong:{},...(settings.tagStats||{})};st.wrong={...st.wrong};st.n++;
  const fixes=[...(settings.tagFixes||[])];
  for(const f of ['type','primaryColor','secondaryColor','pattern']){const from=q.aiTag[f]||'none',to=it[f]||'none';if(f==='pattern'&&!FABRIC.includes(it.type))continue;
    if(from!==to){st.wrong[f]=(st.wrong[f]||0)+1;if(from!=='none'||to!=='none')fixes.push({field:f,type:it.type,from,to,id:it.id,t:Date.now()})}}
  settings.tagStats=st;settings.tagFixes=fixes.slice(-60);await saveUserSettings()}
function tagStatsCard(){const st=settings.tagStats||{n:0,wrong:{}},fx=(settings.tagFixes||[]).slice(-8).reverse();
  const pct=f=>st.n?Math.round(100*(1-(st.wrong[f]||0)/st.n)):null,runs=benchRuns();
  return `<section class="card st-card" id="st-tagging"><h3>Photo tagging</h3>
  ${st.n?`<p class="mut"><small>Of the ${st.n} item${st.n===1?'':'s'} tagged by AI and saved since this was added, how often you kept each tag as it was.</small></p>
    ${['type','primaryColor','pattern','secondaryColor'].map(f=>`<div class="st-miss"><b>${fieldLabel[f][0].toUpperCase()+fieldLabel[f].slice(1)}</b><span class="mut">${pct(f)}% right</span><span class="st-bar"><i style="width:${Math.max(2,pct(f))}%"></i></span></div>`).join('')}`
    :'<p class="mut"><small>No AI-tagged items saved yet since this was added.</small></p>'}
  ${fx.length?`<p class="mut" style="margin-top:8px"><small>Your latest corrections (the tagger is shown them):</small></p><ul class="fixlist">${fx.map(f=>`<li><small>${esc(TYPES[f.type]||f.type)} ${fieldLabel[f.field]}: ${esc(valName(f.field,f.from==='none'?null:f.from))} → <b>${esc(valName(f.field,f.to==='none'?null:f.to))}</b></small></li>`).join('')}</ul>`:''}
  ${runs.length?`<p class="mut" style="margin-top:8px"><small>Last benchmark (${new Date(runs[0].t).toLocaleDateString()}, ${runs[0].n} items): ${benchScoreTxt(runs[0])}.</small></p>`:''}</section>`}

/* ---- the benchmark: re-tag a share of the wardrobe (its items with photos, picked at random) and compare with the tags you
   confirmed. Each item goes with its kept sharp copy when there is one (newer items), else its saved photo, plus its close-up
   and measurement, exactly as a new item would. Runs only when started; results are kept on this device (the last ten). ---- */
let bench=null;
const benchRuns=()=>{try{return JSON.parse(localStorage.getItem('tag_bench')||'[]')}catch{return []}};
const benchPool=()=>items.filter(i=>i.photo&&TYPES[i.type]);
const PRICE_IN=4,PRICE_OUT=20;   // Claude Opus 5.5, $ per million tokens (the worker's default model)
/* visual tokens of a picture (28-pixel patches, capped like the API) */
const visTok=(w,h)=>{const s=Math.min(1,2576/Math.max(w,h));w*=s;h*=s;const t=Math.ceil(w/28)*Math.ceil(h/28);return Math.min(4784,t)};
function benchEstimate(n){const per=(visTok(1024,1024)+visTok(640,640)*.5+4000)*PRICE_IN/1e6+2500*PRICE_OUT/1e6;return n*per}
function renderBenchUI(){const el=$('#bench-box');if(!el)return;const pool=benchPool().length,runs=benchRuns();
  if(bench){el.innerHTML=`<p class="mut"><small>Tagging ${bench.done} of ${bench.n}…</small></p><div class="btns"><button type="button" onclick="bench.stop=true">Stop</button></div>`;return}
  const pick=+(localStorage.getItem('bench_pct')||25),n=Math.ceil(pool*pick/100);
  el.innerHTML=!pool?'<p class="mut"><small>No items with photos yet.</small></p>':`<p class="mut"><small>Re-tags part of your wardrobe and compares with the tags you confirmed, so a change to the tagger can be judged by numbers.</small></p>
  <div class="days bench-pct">${[25,50,75,100].map(p=>`<button type="button" class="dtog ${p===pick?'on':''}" onclick="localStorage.setItem('bench_pct',${p});renderBenchUI()">${p}%</button>`).join('')}</div>
  <p class="mut"><small>${n} of ${pool} item${pool===1?'':'s'} with photos · about $${benchEstimate(n).toFixed(2)} (Claude Opus 5.5 prices; the thinking varies)</small></p>
  <div class="btns"><button type="button" onclick="runBench(${pick})">Run benchmark</button></div>
  ${runs.length?`<div class="benchruns">${runs.map(r=>`<p><small><b>${new Date(r.t).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</b> · ${r.pct}% (${r.n} items${r.fail?`, ${r.fail} failed`:''}): ${benchScoreTxt(r)}</small></p>`).join('')}</div>`:''}
  ${runs[0]&&runs[0].misses&&runs[0].misses.length?`<details class="benchmiss"><summary><small>Where the last run disagreed (${runs[0].misses.length})</small></summary>${runs[0].misses.map(m=>`<p><small>${esc(m.what)}: ${m.diffs.map(d=>`${fieldLabel[d.f]} yours <b>${esc(valName(d.f,d.mine))}</b>, tagger ${esc(valName(d.f,d.ai))}`).join('; ')}</small></p>`).join('')}</details>`:''}`}
const benchScoreTxt=r=>['type','primaryColor','family','pattern'].filter(f=>r.score[f]!=null).map(f=>`${f==='family'?'colour family':fieldLabel[f]} ${r.score[f]}%`).join(', ');
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
async function benchTagOne(it){const img=await tagImgOf(it.id)||it.photo;let measured,closeup;
  if(it.texture){const c=await imgOf(it.texture),cv=document.createElement('canvas');cv.width=c.naturalWidth;cv.height=c.naturalHeight;cv.getContext('2d').drawImage(c,0,0);
    const r=wbRead(cv),m={...measureCloth(cv,null,r.ref?{gains:r.gains,refLum:r.refLum}:{}),src:'closeup'};m.near=nearestCols(it.type,m.lab,m.ref);measured=measHint(m);closeup=it.texture}
  return ask(img,{closeup,measured,skipId:it.id})}
async function runBench(pct){if(bench)return;const pool=shuffle(benchPool()),list=pool.slice(0,Math.ceil(pool.length*pct/100));if(!list.length)return;
  if(!localStorage.getItem('worker_url')){alert('Set the Worker URL and App Token in Settings first.');return}
  if(!confirm(`Re-tag ${list.length} item${list.length===1?'':'s'}? About $${benchEstimate(list.length).toFixed(2)} on your Claude account.`))return;
  bench={n:list.length,done:0,stop:false};renderBenchUI();const res=[];let fail=0,next=0;
  const work=async()=>{while(!bench.stop&&next<list.length){const it=list[next++];let ai=null;try{ai=await benchTagOne(it)}catch{}bench.done++;renderBenchUI();
    if(!ai||!ai.type){fail++;continue}const f=aiFields(ai);res.push({it,f})}};
  await Promise.all([work(),work(),work()]);
  const pc=(k,eq)=>{const r=res.filter(x=>k!=='pattern'||FABRIC.includes(x.it.type));return r.length?Math.round(100*r.filter(eq).length/r.length):null};
  const score={type:pc('type',x=>x.f.type===x.it.type),primaryColor:pc('primaryColor',x=>x.f.primaryColor===primaryCol(x.it)),
    family:pc('family',x=>fam(colBase(x.f.primaryColor))===fam(colBase(primaryCol(x.it)))),pattern:pc('pattern',x=>x.f.pattern===(x.it.pattern||'solid'))};
  const misses=res.map(({it,f})=>({what:`${TYPES[it.type]}: ${desc(it)||nm(it)}`,diffs:['type','primaryColor','pattern'].filter(k=>k!=='pattern'||FABRIC.includes(it.type)).map(k=>({f:k,mine:k==='primaryColor'?primaryCol(it):k==='pattern'?(it.pattern||'solid'):it[k],ai:f[k]})).filter(d=>d.mine!==d.ai)})).filter(m=>m.diffs.length);
  const run={t:Date.now(),pct,n:res.length,fail,score,misses:misses.slice(0,40)};
  try{localStorage.setItem('tag_bench',JSON.stringify([run,...benchRuns()].slice(0,10)))}catch{}
  bench=null;renderBenchUI();toast(res.length?`Benchmark done: ${benchScoreTxt(run)}.`:'The benchmark could not tag any item.')}

/* ---- the full pattern (detect.js analyzeSett): read in colour from the sharp item photo (Claude's patternBox: the largest
   area that is all patterned cloth), else from the close-up, else from Claude's own reading (weave.colours). Claude's
   weave also gives the direction (for a close-up, whose angle says nothing), the repeats across the item (the drawing's
   scale on the figure) and a description for the photo generator. ---- */
const SETT_PATS={tie:[...STRIPE_PATS,...CHECK_PATS,'tonal-check','other'],shirt:[...STRIPE_PATS,...CHECK_PATS,'other'],suit:CHECK_PATS,blazer:CHECK_PATS,pants:CHECK_PATS};
const settable=(type,pat,weave)=>{const p=patBase(pat)||'solid';return p!=='solid'&&((SETT_PATS[type]||[]).includes(p)||!!(weave&&weave.layout&&FABRIC.includes(type)))};
const DIR_ANG={'upper-left to lower-right':-45,'lower-left to upper-right':45,vertical:0,horizontal:90};
const WEAVE_W={hairline:.02,narrow:.05,medium:.12,wide:.25};
function settFromWeave(w){const c=(w&&w.colours||[]).filter(x=>/^#[0-9a-f]{6}$/i.test(x.hex));if(c.length<2)return null;const tot=c.reduce((s,x)=>s+(WEAVE_W[x.width]||.12),0);
  return {v:2,a:DIR_ANG[w.direction]??-45,bands:c.map(x=>[x.hex.toLowerCase(),+((WEAVE_W[x.width]||.12)/tot).toFixed(3)]),cross:null,cr:1,src:'claude'}}
/* the sett for a card, or for a saved item from its kept pictures */
function settFrom({full,box,tex,weave,wb}){let s=null;
  try{if(full&&box){s=settFromCanvas(applyWb(full,wb),box);if(s){s.src='photo';s.tr=+(s.cr/.8).toFixed(2)}}   // the box spans about 80% of the item's width
    if(!s&&tex){const r=wbRead(tex);s=settFromCanvas(applyWb(tex,r.ref?r.gains:wb));if(s){s.src='closeup';s.tr=1.5}}}catch(e){console.warn('pattern not read',e)}
  if(!s&&weave)s=settFromWeave(weave);
  if(s&&weave){if(weave.repeatsAcross)s.tr=weave.repeatsAcross;if(s.src==='closeup'&&DIR_ANG[weave.direction]!=null)s.a=DIR_ANG[weave.direction]}   // a close-up's angle says nothing
  return s}
function readSett(q){q.sett=!q.settOff&&settable(q.type,q.pattern,q.weave)&&q.raw?settFrom({full:q.raw.full,box:q.patternBox,tex:q.raw.texFull||q.raw.tex,weave:q.weave,wb:q.wbOff?null:q.wb}):null;return q.sett}
function toggleSett(i){const q=queue[i];q.settOff=!q.settOff;readSett(q);renderAdd()}
const settSummary=s=>`${s.bands.length} colour bands${s.cross?' with lines crossing the other way':''}, read from ${s.src==='photo'?'the photo':s.src==='closeup'?'the close-up':'Claude\'s description'}`;
function settNote(q,i){if(!settable(q.type,q.pattern,q.weave))return '';
  if(q.settOff)return `<p class="tagnote mut"><small>Drawn with the simple ${esc(patName(q.pattern))} pattern.</small><button type="button" class="chipbtn" onclick="toggleSett(${i})">Use the pattern from the photo</button></p>`;
  return q.sett?`<p class="tagnote"><small>Pattern: ${settSummary(q.sett)}.</small><button type="button" class="chipbtn" onclick="toggleSett(${i})">Use the simple pattern</button></p>`:''}
/* Wardrobe editor: read it again from the kept sharp copy (or the close-up) */
async function rereadSett(id){const it=items.find(x=>x.id===id);if(!it)return;
  const toCanvas=async src=>{if(!src)return null;try{const im=await imgOf(src),c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d').drawImage(im,0,0);return c}catch{return null}};
  const full=it.pbox?await toCanvas(await tagImgOf(it.id)):null,tex=await toCanvas(it.texture);
  const s=settFrom({full,box:it.pbox,tex,weave:it.weave,wb:null});   // the kept copy is already white-balanced
  if(!s){toast('No clear pattern found. Add a fabric close-up (or a sharper photo) and try again.');return}
  it.sett=s;delete it.stripes;await put(it);cache={};renderWardrobe();toast(`Pattern read: ${settSummary(s)}.`)}
