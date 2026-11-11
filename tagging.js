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
  const sorted=[...lums].sort((a,b)=>a-b),thr=Math.max(150,sorted[Math.floor(n*.95)]-12),p25=sorted[Math.floor(n*.25)];let R=0,G=0,B=0,m=0;
  for(let i=0,j=0;i<d.length;i+=4,j++){if(lums[j]<thr)continue;const mx=Math.max(d[i],d[i+1],d[i+2]),mn=Math.min(d[i],d[i+1],d[i+2]);
    if(mx>=250&&mn>=250)continue;   // clipped highlights say nothing about the light
    if((mx-mn)/mx<.35){R+=d[i];G+=d[i+1];B+=d[i+2];m++}}   // a white wall under tungsten light reads about 30% saturated
  if(m<n*.005||m>n*.85)return {gains:null,ref:false,refLum:0,frac:m/n};
  // a white reference is one solid area clearly brighter than the cloth (a wall, a white shirt under a tie, paper); the light
  // slubs and highlights of a khaki or beige cloth are scattered specks only a little brighter, and taking them for white would
  // turn the cloth grey
  const isRef=new Uint8Array(n);for(let i=0,j=0;i<d.length;i+=4,j++){if(lums[j]<thr)continue;const mx=Math.max(d[i],d[i+1],d[i+2]),mn=Math.min(d[i],d[i+1],d[i+2]);if(!(mx>=250&&mn>=250)&&(mx-mn)/mx<.35)isRef[j]=1}
  let solid=0;for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const j=y*w+x;if(isRef[j]&&isRef[j-1]+isRef[j+1]+isRef[j-w]+isRef[j+w]>=3)solid++}
  if(solid<m*.5||(R+G+B)/3/m<1.15*p25)return {gains:null,ref:false,refLum:0,frac:m/n};
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
  q.refineNote=changes.length?'Updated from the close-up: '+changes.join(', ')+'.':'The close-up confirmed the tags.';if(k>=0)renderAdd();
  readPatternWithClaude(q)}

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
const SETT_PATS={tie:[...STRIPE_PATS,...CHECK_PATS,'tonal-check','other',...MOTIF_PATS],shirt:[...STRIPE_PATS,...CHECK_PATS,'other'],suit:[...STRIPE_PATS,...CHECK_PATS],blazer:[...STRIPE_PATS,...CHECK_PATS],pants:[...STRIPE_PATS,...CHECK_PATS]};
const settable=(type,pat,weave)=>{const p=patBase(pat)||'solid';return p!=='solid'&&((SETT_PATS[type]||[]).includes(p)||!!(weave&&weave.layout&&FABRIC.includes(type)))};
const DIR_ANG={'upper-left to lower-right':-45,'lower-left to upper-right':45,vertical:0,horizontal:90};
const WEAVE_W={hairline:.02,narrow:.05,medium:.12,wide:.25};
function settFromWeave(w){const c=(w&&w.colours||[]).filter(x=>/^#[0-9a-f]{6}$/i.test(x.hex));if(c.length<2)return null;const tot=c.reduce((s,x)=>s+(WEAVE_W[x.width]||.12),0);
  return {v:2,a:DIR_ANG[w.direction]??-45,bands:c.map(x=>[x.hex.toLowerCase(),+((WEAVE_W[x.width]||.12)/tot).toFixed(3)]),cross:null,cr:1,src:'claude'}}
/* the sett for a card, or for a saved item from its kept pictures */
/* both pictures when there are both: the item photo gives the scale and the direction; a close-up that shows at least one and a half
   repeats resolves fine stripes far better (a pinstripe a pixel wide in the whole-jacket photo is a crisp line up close), so
   its bands and crossing lines are used */
/* white balance and, when the picture has a white reference (a white shirt under the tie, a white wall, paper), exposure set
   from it too: an underexposed photo otherwise reads every band too dark (a cream reads grey). At most 1.6x, in linear light. */
function settCanvas(c,wb){const r=wbRead(c),g=wb||r.gains,out=applyWb(c,g);if(!r.ref||r.refLum>=235||r.frac<.03)return out;   // a few white threads are no reference (partly blended, they read dim)
  const k=Math.min(1.6,sLin(243)/sLin(Math.max(1,r.refLum))),x=out.getContext('2d',{willReadFrequently:true}),D=x.getImageData(0,0,out.width,out.height),d=D.data,lut=new Uint8ClampedArray(256);
  for(let v=0;v<256;v++)lut[v]=Math.round(linS(Math.min(1,sLin(v)*k)));for(let i=0;i<d.length;i+=4){d[i]=lut[d[i]];d[i+1]=lut[d[i+1]];d[i+2]=lut[d[i+2]]}x.putImageData(D,0,0);return out}
function settFrom({full,box,tex,weave,wb,type}){let s=null,c=null;
  const opt={straight:!!type&&type!=='tie'};   // a jacket's, shirt's or trousers' pattern is straight in the photo
  try{if(full&&box){s=settFromCanvas(settCanvas(full,wb),box,opt);if(s){s.src='photo';s.tr=+(s.cr/.8).toFixed(2)}}   // the box spans about 80% of the item's width
    if(tex){const r=wbRead(tex);c=settFromCanvas(settCanvas(tex,r.ref?r.gains:wb),null,opt);if(c){c.src='closeup';c.tr=1.5}}}catch(e){console.warn('pattern not read',e)}
  // the close-up's colours are moved so its ground matches the item photo's: the item photo usually has a white wall behind it to
  // set its exposure, the close-up of a khaki cloth has nothing white in it and reads darker
  if(s&&c&&c.cr>=1.5){const g=b=>b.reduce((x,y)=>y[1]>x[1]?y:x),L=h=>rgbLab(...hexRgb(h)),d=L(g(s.bands)[0]).map((v,k)=>v-L(g(c.bands)[0])[k]);
    const mv=h=>h&&labHex(L(h).map((v,k)=>v+d[k]));
    s={...s,bands:c.bands.map(([h,w])=>[mv(h),w]),cross:c.cross?{...c.cross,d:s.cross?s.cross.d:c.cross.d,bands:c.cross.bands.map(([h,w])=>[mv(h),w])}:s.cross,cr:c.cr,src:'photo+closeup'}}   // the swatch sits beside the close-up: its scale
  else if(!s)s=c;
  if(!s&&weave)s=settFromWeave(weave);
  if(s&&weave){if(weave.repeatsAcross&&!(type==='tie'&&/photo/.test(s.src)))s.tr=weave.repeatsAcross;   // a tie's box spans most of its width: its own count beats Claude's estimate (a jacket's box is only part of it)
    if(s.src==='closeup'&&DIR_ANG[weave.direction]!=null)s.a=DIR_ANG[weave.direction]}   // a close-up's angle says nothing
  return s}
const motifPat=p=>MOTIF_PATS.includes(patBase(p)||'');
/* Claude's reading drawn with the photo's colours: bands (stripes, checks, plaids) or a motif (small figures on a grid) */
const specSett=(spec,args)=>spec&&(spec.motif?motifFromSpec(spec,args):spec.across?settFromSpec(spec,args):null);
function readSett(q){const ok=!q.settOff&&settable(q.type,q.pattern,q.weave)&&q.raw,args={full:q.raw&&q.raw.full,box:q.patternBox,tex:q.raw&&(q.raw.texFull||q.raw.tex),wb:q.wbOff?null:q.wb,type:q.type};
  if(ok&&q.spec){const s=specSett(q.spec,args);if(s){q.sett=s;return s}}
  q.sett=ok&&!motifPat(q.pattern)?settFrom({full:q.raw.full,box:q.patternBox,tex:q.raw.texFull||q.raw.tex,weave:q.weave,wb:q.wbOff?null:q.wb,type:q.type}):null;return q.sett}
function toggleSett(i){const q=queue[i];q.settOff=!q.settOff;readSett(q);renderAdd()}
const settSummary=s=>s.motif?`${s.motif.figs.length===1?'one figure':s.motif.figs.length+' figures'} on a ${s.motif.grid} grid, read by Claude with the colours from the photo`:s.src==='claude+pixels'?`${s.bands.length} bands${s.cross?' and lines the other way':''}, read by Claude with the colours from the photo`:`${s.bands.length} colour bands${s.cross?' with lines crossing the other way':''}, read from ${s.src==='photo'?'the photo':s.src==='closeup'?'the close-up':s.src==='photo+closeup'?'the photo and the close-up':'Claude\'s description'}`;
function settNote(q,i){if(!settable(q.type,q.pattern,q.weave))return '';
  if(q.patternReading)return '<p class="tagnote mut"><small>Claude is reading the pattern…</small></p>';
  if(q.settOff)return `<p class="tagnote mut"><small>Drawn with the simple ${esc(patName(q.pattern))} pattern.</small><button type="button" class="chipbtn" onclick="toggleSett(${i})">Use the pattern from the photo</button></p>`;
  return q.sett?`<p class="tagnote"><small>Pattern: ${settSummary(q.sett)}.</small><button type="button" class="chipbtn" onclick="toggleSett(${i})">Use the simple pattern</button></p>`:''}
/* once: Claude-read patterns saved without a pattern box were exposure-matched to the whole item photo (wall and all, a navy
   pinstripe came out lavender): recolour them from the saved reading and the close-up, no new call to Claude */
async function recolourSpecSetts(){if(localStorage.getItem('spec_recolour')==='1')return 0;let n=0;
  for(const it of items)if(it.patternSpec&&it.patternSpec.across&&it.sett&&it.sett.src==='claude+pixels'&&!it.pbox&&it.texture)try{
    const im=await imgOf(it.texture),c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d').drawImage(im,0,0);
    const s=settFromSpec(it.patternSpec,{tex:c,type:it.type});if(s&&JSON.stringify(s.bands)!==JSON.stringify(it.sett.bands)){it.sett=s;await put(it);n++}}catch(e){console.warn(e)}
  localStorage.setItem('spec_recolour','1');if(n)cache={};return n}
/* Wardrobe editor: read it again from the kept sharp copy (or the close-up) */
async function rereadSett(id){const it=items.find(x=>x.id===id);if(!it)return;
  const toCanvas=async src=>{if(!src)return null;try{const im=await imgOf(src),c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d').drawImage(im,0,0);return c}catch{return null}};
  const full=it.pbox?await toCanvas(await tagImgOf(it.id)):null,tex=await toCanvas(it.texture);
  let spec=null;const img=await tagImgOf(it.id)||it.photo;if(localStorage.getItem('worker_url')&&img){toast('Claude is reading the pattern…');spec=await claudePattern({image:img,closeup:it.texture||null,type:it.type})}
  const full2=full||(it.photo?await toCanvas(it.photo):null);
  const s=specSett(spec,{full:full2,box:it.pbox,tex,type:it.type})||(motifPat(it.pattern)?null:settFrom({full,box:it.pbox,tex,weave:it.weave,wb:null,type:it.type}));   // the kept copy is already white-balanced
  if(spec){it.patternSpec=spec;if(spec.description)it.patternText=spec.description}
  if(!s){toast('No clear pattern found. Add a fabric close-up (or a sharper photo) and try again.');return}
  it.sett=s;delete it.stripes;await put(it);cache={};renderWardrobe();toast(`Pattern read: ${settSummary(s)}.`)}

/* ---- the pattern for the photo generator. Claude's words alone were not enough: on a plaid tie its description had the stripes
   rising the wrong way and the generator followed it, and it said nothing of how much of each colour there is. So a read
   pattern is also described from the measurements (direction as the viewer sees it, each colour's share, pinlines, crossing
   lines), any direction in Claude's words is taken out, and a drawing of the pattern goes along as a reference. ---- */
/* a band's name: the nearest of Claude's own colour names for this cloth (so the measured shares and its description use one
   vocabulary; lightness counts half, a photo's exposure being the least certain), else the nearest of the app's colours */
const nearName=(hex,named)=>{const l=rgbLab(...hexRgb(hex));
  // hue counts most here: a greyed steel blue in a dim photo is still the blue band, not the beige one of the same lightness
  const dist=(x,y)=>Math.hypot((x[0]-y[0])/2,1.4*(x[1]-y[1]),1.4*(x[2]-y[2]));
  if(named&&named.length>=2){let best=named[0],bd=1e9;for(const c of named){const d=dist(l,rgbLab(...hexRgb(c.hex)));if(d<bd){bd=d;best=c}}return String(best.name).toLowerCase()}
  let best=null,bd=1e9;for(const c of Object.keys(COLORS)){if(CUSTOM_COL[c])continue;const d=dE00(l,labOf(c));if(d<bd){bd=d;best=c}}return colName(best)};
/* which way the stripes run as the viewer sees them (sett.a is the angle across them; on a jacket or shirt they are snapped straight) */
function settDirText(s,role){const a=role==='tie'?s.a:Math.round(s.a/90)*90,phi=((a+90)%180+180)%180;   // the stripes' own direction, 0 = horizontal, y down
  if(phi<15||phi>165)return 'horizontal stripes';if(phi>75&&phi<105)return 'vertical stripes';
  return phi<90?'diagonal stripes running from the upper left down to the lower right, as the viewer sees them':'diagonal stripes running from the lower left up to the upper right, as the viewer sees them'}
function settText(i,role){const s=usableSett(i);if(s&&s.motif)return motifText(s,role);if(!s||!s.bands)return '';
  const named=[...(i.patternSpec?[i.patternSpec.across,i.patternSpec.along].filter(Boolean).flatMap(d=>d.bands.map(b=>({name:b.name,hex:b.hex}))):[]),...(i.weave&&i.weave.colours||[])].filter(c=>c&&c.name&&/^#[0-9a-f]{6}$/i.test(c.hex||''));
  const share={},thin={};for(const [h,w] of s.bands){const n=nearName(h,named);if(w<.035)thin[n]=1;else share[n]=(share[n]||0)+w}
  const tot=Object.values(share).reduce((a,b)=>a+b,0)||1,parts=Object.entries(share).sort((a,b)=>b[1]-a[1]).map(([n,w])=>`${Math.max(1,Math.round(100*w/tot/5)*5)}% ${n}`);
  const pins=Object.keys(thin);
  const cross=s.cross?[...new Set(s.cross.bands.filter(b=>b[0]).map(b=>nearName(b[0],named)))]:[];
  return `measured: ${settDirText(s,role)}; the bands are about ${parts.join(', ')}${pins.length?`, with thin ${pins.join(' and ')} pinlines`:''}`+
    (cross.length?`; fine ${cross.join(' and ')} lines cross them in the other direction`:'')}
const DIR_RE=/(?:rising|running|descending|slanting|sloping|going|that run|which run)?\s*(?:diagonally\s+)?(?:from\s+)?(?:the\s+)?(?:upper|lower|top|bottom)[ -](?:left|right)\s+(?:down\s+|up\s+)?(?:to|towards)\s+(?:the\s+)?(?:upper|lower|top|bottom)[ -](?:left|right)(?:\s+as (?:seen|worn))?/gi;
const dropDir=t=>String(t||'').replace(DIR_RE,'').replace(/\s+([,.:;])/g,'$1').replace(/\s{2,}/g,' ').trim();
/* what the photo prompt says of an item's pattern */
function patternPrompt(i,role){if(!i)return '';const m=settText(i,role),d=m?dropDir(i.patternText):i.patternText||'';
  return [m,d.replace(/\.$/,'')].filter(Boolean).join('. ')}
/* the drawing of a read pattern for the generator: a tie as its blade (tip down, the pattern at the angle it is worn), anything else
   as a square of its cloth; on a light grey ground, sharp */
function patternDiagram(i,role){const fab=figFabric(i,role);if(!fab)return Promise.resolve(null);
  const tie=role==='tie',vb=tie?'168 46 54 214':'0 0 200 200',W=tie?360:600,H=tie?Math.round(360*214/54):600;
  const shape=tie?'<path d="M 182 50 L 208 50 C 211 60 210 70 205 79 C 199 83 191 83 185 79 C 180 70 179 60 182 50 Z" fill="url(#pd)"/><path d="M 186 74 L 204 74 C 207 120 212 172 217 222 L 195 256 L 173 222 C 178 172 183 120 186 74 Z" fill="url(#pd)"/>':'<rect width="200" height="200" fill="url(#pd)"/>';
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${vb}"><defs>${fab.def('pd',0)}</defs><rect x="-10" y="-10" width="400" height="400" fill="#ececea"/>${shape}</svg>`;
  return new Promise(ok=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=W;c.height=H;c.getContext('2d').drawImage(im,0,0,W,H);ok(c.toDataURL('image/png'))};im.onerror=()=>ok(null);
    im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)})}
/* the references with the pattern drawings put in after their item's photos (at most 8 in all) */
async function outfitRefsFull(o){const {refs,labels}=outfitRefs(o),slots=[['tie','tie','the tie'],['top','top',o.suitDay?'the suit':'the blazer'],['shirt','shirt','the shirt'],...(o.top?[]:[['bot','bot','the trousers']])];
  for(const [s,role,name] of slots){const i=o[s];if(!i||!usableSett(i)||refs.length>=8)continue;const img=await patternDiagram(i,role);if(!img)continue;
    let at=labels.findIndex(l=>l.startsWith(name));at=at<0?refs.length:at+1;
    refs.splice(at,0,img);labels.splice(at,0,`a drawing of ${name.replace(/^the /,'the ')}'s measured pattern${role==='tie'?' as worn':''}: copy ${i.sett.motif?'its figures, their shapes, colours, arrangement and size':'its colours, their order and proportions and the stripe direction'} exactly, rendered as real woven ${role==='tie'?'silk':'cloth'}`)}
  return {refs:refs.slice(0,8),labels:labels.slice(0,8)}}

/* ---- the pattern read by Claude (worker POST /pattern) and coloured from the pixels. The pixel reader alone is thrown by the
   noise in a photo (a seam, moire, panes made uneven by drape); Claude reports the pattern as woven: every band of a repeat each
   way, in order, with its width. The exact colours come from the photos: each named thread is matched to its own pixels, the
   close-up's exposure is matched to the item photo's (which has a white wall to set it), and where a thread's pixels read grey
   though Claude sees a colour (a light-blue line woven into khaki linen), the pixels keep the lightness and Claude the hue.
   Without the worker, or when Claude finds no pattern, the pixel reader (settFrom) is used. ---- */
async function claudePattern({image,closeup,type}){const w=localStorage.getItem('worker_url');if(!w||!image)return null;
  try{const r=await fetch(new URL('pattern',w.replace(/\/*$/,'/')).href,{method:'POST',headers:{'content-type':'application/json','x-app-token':localStorage.getItem('app_token')||''},
      body:JSON.stringify({image,...(closeup?{closeup}:{}),type})});
    const j=await r.json().catch(()=>({}));return r.ok&&(j.across||j.motif)&&j.layout!=='none'?j:null}catch{return null}}
function sampleLabs(c){const x=c.getContext('2d',{willReadFrequently:true}),d=x.getImageData(0,0,c.width,c.height).data,st=Math.max(1,Math.round(c.width*c.height/120000)),out=[];
  for(let i=0;i<d.length;i+=4*st)out.push(rgbLab(d[i],d[i+1],d[i+2]));return out}
const medLab=ls=>[0,1,2].map(k=>{const v=ls.map(l=>l[k]).sort((a,b)=>a-b);return v[v.length>>1]});
function cropCanvas(c,box){const x=box.x/1000*c.width,y=box.y/1000*c.height,w=Math.max(1,box.w/1000*c.width),h=Math.max(1,box.h/1000*c.height),o=document.createElement('canvas');
  o.width=Math.round(w);o.height=Math.round(h);o.getContext('2d').drawImage(c,x,y,w,h,0,0,o.width,o.height);return o}
function settFromSpec(spec,{tex,full,box,wb,type}){
  const L=h=>rgbLab(...hexRgb(h)),C=l=>Math.hypot(l[1],l[2]);
  let src=null;try{src=tex?settCanvas(tex,wbRead(tex).ref?null:wb):full&&box?cropCanvas(settCanvas(full,wb),box):null}catch{}
  const labs=src?sampleLabs(src):[],ground=labs.length?medLab(labs):null;
  // the close-up's exposure matched to the item photo's (the median of the patterned area in each); only with the pattern's box:
  // a whole photo's median takes in the wall and the next jackets (it turned a navy pinstripe lavender)
  let delta=[0,0,0];if(tex&&full&&box&&ground)try{const g2=medLab(sampleLabs(cropCanvas(settCanvas(full,wb),box)));delta=g2.map((v,k)=>v-ground[k])}catch{}
  // every distinct thread colour Claude named, with its share of the cloth
  const threads=new Map();for(const d of [spec.across,spec.along])if(d)for(const b of d.bands){const t=threads.get(b.hex)||{share:0,role:b.role};t.share+=b.w/(spec.along?2:1);if(b.role==='ground')t.role='ground';threads.set(b.hex,t)}
  const dist=(x,y)=>Math.hypot((x[0]-y[0])/2,1.4*(x[1]-y[1]),1.4*(x[2]-y[2])),dE76=(x,y)=>Math.hypot(x[0]-y[0],x[1]-y[1],x[2]-y[2]);
  const groundHex=[...threads].filter(([,t])=>t.role==='ground').sort((a,b)=>b[1].share-a[1].share)[0];
  const colour=new Map();
  for(const [hex,t] of threads){const cl=L(hex);let m=null;
    if(labs.length){if(groundHex&&hex===groundHex[0])m=ground;
      else{const cand=labs.filter(p=>dE76(p,ground)>6).sort((a,b)=>dist(a,cl)-dist(b,cl)),k=Math.max(12,Math.round(labs.length*Math.min(.2,t.share)*.5)),top=cand.slice(0,k);
        if(top.length>=6)m=[0,1,2].map(j=>top.reduce((s,p)=>s+p[j],0)/top.length)}
      // a coloured thread that reads grey in the pixels keeps the pixels' lightness and takes Claude's hue
      if(m&&t.role!=='ground'&&C(cl)>10&&C(m)<.6*C(cl)){const s=Math.max(C(m),.75*C(cl))/C(cl);m=[m[0],cl[1]*s,cl[2]*s]}
      // a line's threads cross the ground's (a white line reads cream, not paper white): a quarter of the ground's lightness
      if(m&&t.role!=='ground')m=[.75*m[0]+.25*ground[0],m[1],m[2]]}
    if(m)colour.set(hex,m)}
  // the measured ground far (ΔE00 over 15) from Claude's: first without the exposure match, else Claude's colours
  const gm=groundHex&&colour.get(groundHex[0]),gc=groundHex&&L(groundHex[0]),far=d=>gm&&dE00(gm.map((v,k)=>v+d[k]),gc)>15;
  const use=!far(delta)?delta:!far([0,0,0])?[0,0,0]:null;
  for(const [hex] of threads){const m=colour.get(hex);colour.set(hex,m&&use?labHex(m.map((v,k)=>v+use[k])):hex)}
  const run=d=>{const out=[];for(const b of d.bands){const h=colour.get(b.hex);if(out.length&&out[out.length-1][0]===h)out[out.length-1][1]+=b.w;else out.push([h,b.w])}return out.map(([h,w])=>[h,+w.toFixed(4)])};
  const bands=run(spec.across);if(bands.length<2)return null;
  const gH=groundHex&&colour.get(groundHex[0]),along=spec.along?run(spec.along).map(([h,w])=>[h===gH?null:h,w]):null;
  const a=type==='tie'?(DIR_ANG[spec.stripeDirection]??-45):spec.stripeDirection==='horizontal'?90:0;
  return {v:2,a,bands,cross:along&&along.some(b=>b[0])?{d:90,bands:along,r:+spec.paneAspect.toFixed(2)}:null,cr:+(+spec.repeatsInCloseup).toFixed(2),tr:+(+spec.repeatsAcrossItem).toFixed(2),src:'claude+pixels'}}
/* ask Claude for a card's pattern once it has a close-up (the noise it strips is what the pixel reader can't) */
async function readPatternWithClaude(q){if(!q||!q.raw||!q.raw.tex||!q.tagImg||!settable(q.type,q.pattern,q.weave)||!localStorage.getItem('worker_url'))return;
  q.patternReading=1;renderAdd();const spec=await claudePattern({image:q.tagImg,closeup:await closeTagImg(q),type:q.type});q.patternReading=0;
  if(spec){q.spec=spec;if(spec.description)q.weave={...(q.weave||{}),description:spec.description}}else q.specFailed=1;
  readSett(q);if(queue.includes(q))renderAdd()}

/* ---- a motif (small figures on a grid: a neat or foulard, mini squares, dots) as Claude read it, each colour taken from its own
   pixels. A band reader can't draw these: it turns a checkerboard of mini squares into a diagonal plaid. Claude gives the grid,
   the ground and each figure (shape, place, colours, size); the pixels give each colour, like settFromSpec: the close-up's exposure
   matched to the item photo's, and Claude's hue kept where a colour's pixels read grey. ---- */
function motifFromSpec(spec,{tex,full,box,wb}){const m=spec&&spec.motif;if(!m||!m.ground||!m.figures||!m.figures.length)return null;
  const L=h=>rgbLab(...hexRgb(h)),C=l=>Math.hypot(l[1],l[2]);
  let src=null;try{src=tex?settCanvas(tex,wbRead(tex).ref?null:wb):full?(box?cropCanvas(settCanvas(full,wb),box):settCanvas(full,wb)):null}catch{}
  const labs=src?sampleLabs(src):[],med=labs.length?medLab(labs):null;
  // only with a box on the cloth: the whole photo's median is mostly its background (a tie on a grey wall)
  let delta=[0,0,0];if(tex&&full&&box&&med)try{const g2=medLab(sampleLabs(cropCanvas(settCanvas(full,wb),box)));delta=g2.map((v,k)=>v-med[k])}catch{}
  // each colour's share of the cloth: a figure covers size² of its cell (half the cells when it alternates), split between its colours
  const share=new Map(),add=(h,w)=>share.set(h,(share.get(h)||0)+w);let figs=0;
  for(const f of m.figures){const a=f.size*f.size*(f.placement==='alternate-cells'?.5:1);figs+=a;f.colours.forEach(c=>add(c.hex,a*(f.centre?.85:1)/f.colours.length));if(f.centre)add(f.centre.hex,a*.15)}
  add(m.ground.hex,Math.max(.05,1-Math.min(1,figs)));
  const dist=(x,y)=>Math.hypot((x[0]-y[0])/2,1.4*(x[1]-y[1]),1.4*(x[2]-y[2]));
  const colour=new Map();
  for(const [hex,sh] of share){const cl=L(hex);let mm=null;
    if(labs.length>=40){const k=Math.max(12,Math.round(labs.length*Math.min(.25,sh)*.5)),top=[...labs].sort((a,b)=>dist(a,cl)-dist(b,cl)).slice(0,k);
      if(dist(top[top.length>>1],cl)<40)mm=[0,1,2].map(j=>top.reduce((s,p)=>s+p[j],0)/top.length);   // nothing near Claude's colour: keep Claude's
      if(mm&&C(cl)>10&&C(mm)<.6*C(cl)){const s=Math.max(C(mm),.75*C(cl))/C(cl);mm=[mm[0],cl[1]*s,cl[2]*s]}}
    colour.set(hex,mm?labHex(mm.map((v,k)=>v+delta[k])):hex)}
  const c=h=>colour.get(h)||h;
  return {v:3,motif:{grid:m.grid,ground:c(m.ground.hex),groundName:m.ground.name,figs:m.figures.map(f=>({shape:f.shape,place:f.placement,size:+f.size.toFixed(3),cols:f.colours.map(x=>c(x.hex)),names:f.colours.map(x=>x.name),centre:f.centre?c(f.centre.hex):null,centreName:f.centre?f.centre.name:null}))},
    a:m.grid==='diagonal'?45:0,cr:+(+spec.repeatsInCloseup||1).toFixed(2),tr:+(+spec.repeatsAcrossItem||1).toFixed(2),src:'claude+pixels'}}
/* the motif in words for the photo generator */
const SHAPE_WORDS={square:'small squares','square-with-dot':'tiny squares with a dot in the middle',diamond:'small diamonds',dot:'dots',ring:'small rings',cross:'small crosses',flower:'small flowers',other:'small figures'};
function motifText(s,role){const m=s.motif,figs=m.figs.map((f,n)=>{const cols=f.names.length===2?`alternating ${f.names[0]} and ${f.names[1]}`:f.names[0];
    const where=f.place==='corner'?(n?' where the corners meet':' at the grid corners'):f.place==='alternate-cells'?' in every other cell':'';
    return `${cols} ${SHAPE_WORDS[f.shape]||'figures'}${f.centreName?` (each with a ${f.centreName} dot)`:''}${where}`});
  return `measured: a neat pattern on a ${m.grid==='diagonal'?'diagonal (45°)':'straight'} grid: ${figs.join(', with ')}, on a ${m.groundName} ground; about ${Math.round(s.tr)} repeats across the ${role==='tie'?'tie':'cloth'}`}
