/* Daily Wardrobe: photo tagging, the request (split from tagging.js, Round B CR-2-17). What goes with every tagging request (the sharper
   photo, the fabric close-up, the owner's own colours, patterns and materials, the corrections the owner made before), the sharp copies
   kept on this device, what the tagger learns from the corrections, and what one tagging call costs. */

const TAG_MAX=2048,CLOSE_MAX=1536,TAG_Q=.92;
/* the colours and patterns the owner added, when there are any (the worker adds them to what the tagger may answer) */
const customForTag=()=>{const c=settings.custom||{};return (c.colors||[]).length||(c.patterns||[]).length?{colors:c.colors||[],patterns:c.patterns||[]}:undefined};
/* the latest corrections (another item's only: the benchmark must not hand an item its own answer) */
const tagFixes=skipId=>(settings.tagFixes||[]).filter(f=>f.id!==skipId).slice(-20).map(({field,type,from,to})=>({field,type,from,to}));
/* the person's own materials, sent so Claude can name them (worker cleanOwnMaterials; 2026-11-16): {type: [name]}, or undefined when none */
const ownMatsForTag=()=>{const o={};for(const t of Object.keys(MATERIALS_BY)){const l=ownMats(t);if(l.length)o[t]=l}return Object.keys(o).length?o:undefined};
const tagExtras=(x={})=>({types:x.freeColors||x.freePattern?TAG_TYPES.filter(t=>t==='pocketsquare'):tagTypesNow(),custom:customForTag(),ownMaterials:ownMatsForTag(),corrections:tagFixes(x.skipId),...(x.closeup?{closeup:x.closeup}:{}),...(x.measured?{measured:x.measured}:{}),...(x.freeColors?{freeColors:true}:{}),...(x.freePattern?{freePattern:true}:{}),...(x.wb!=null?{wb:!!x.wb}:{})});

/* ---- tagging copies: the sharp photo sent to the tagger is kept on this device only (Cache Storage, not synced, not loaded
   at start-up), so the benchmark can re-tag an item from the same picture later ---- */
const TAGIMG_CACHE='dw-keep-tagimg';
/* (2026-11-14) signed with the item photo it belongs to (x-ph: phSigOf of the photo, like a close-up's texSig): after Replace photo, or an
   Undo back to another picture, the old copy is no longer handed out to "Read pattern from photo", Ask Claude or the recolouring, which
   sent the old picture. Replace and Rotate keep a new copy (keepPhotoCopy in app.js); a crop or an upgrade of the same picture signs the
   copy again (resignTagImg). tagImgOf(id) without the item (the crop's own similarity test) takes any copy. */
async function keepTagImg(id,url,photo){try{if(!url||!self.caches)return;const c=await caches.open(TAGIMG_CACHE);
  await c.put(new Request('tagimg/'+id),new Response(await (await fetch(url)).blob(),{headers:{'content-type':'image/jpeg',...(photo?{'x-ph':texSig(photo)}:{})}}))}catch(e){console.warn('tag copy not kept',e)}}
async function tagImgOf(id,it){try{if(!self.caches)return null;const c=await caches.open(TAGIMG_CACHE),r=await c.match(new Request('tagimg/'+id));if(!r)return null;
  const sig=r.headers.get('x-ph');if(it&&sig&&sig!==texSig(it.photo||''))return null;   // a copy of another picture than the item's photo now
  const b=await r.blob();return await new Promise(ok=>{const f=new FileReader();f.onload=()=>ok(f.result);f.onerror=()=>ok(null);f.readAsDataURL(b)})}catch{return null}}
async function resignTagImg(id,photo){try{const u=await tagImgOf(id);if(u)await keepTagImg(id,u,photo)}catch{}}

/* the sharp close-up (CLOSE_MAX, on this device only, in the same cache): the synced close-up was 640 px until 2026-11-13 (TEX_MAX is now
   1536, the same), too small for a fine weave
   (the owner's mid grey blazer: a fine broken twill read as a false micro-check at 480x640). Kept with the synced close-up's
   signature, so a close-up replaced, removed or undone never sends the old sharp copy; another device sends the synced one. */
const texSig=u=>u?u.length+':'+u.slice(-48):'';
async function keepCloseImg(id,url,tex){try{if(!url||!tex||!self.caches)return;const c=await caches.open(TAGIMG_CACHE);
  await c.put(new Request('closeimg/'+id),new Response(await (await fetch(url)).blob(),{headers:{'content-type':'image/jpeg','x-tex':texSig(tex)}}))}catch(e){console.warn('sharp close-up not kept',e)}}
async function sharpCloseOf(it){if(!it||!it.texture)return null;
  try{if(self.caches){const c=await caches.open(TAGIMG_CACHE),r=await c.match(new Request('closeimg/'+it.id));
    if(r&&r.headers.get('x-tex')===texSig(it.texture)){const b=await r.blob();const u=await new Promise(ok=>{const f=new FileReader();f.onload=()=>ok(f.result);f.onerror=()=>ok(null);f.readAsDataURL(b)});if(u)return u}}}catch{}
  return it.texture}

/* ---- what the tagger learns from: when an AI-tagged card is saved with a field changed, the change is kept (the latest 60)
   and the latest 20 go with every tagging request; the counts give the accuracy on the stats page ---- */
async function recordTagResult(q,it){if(!q.ai||!q.aiTag)return;const st={n:0,wrong:{},...(settings.tagStats||{})};st.wrong={...st.wrong};st.n++;
  const fixes=[...(settings.tagFixes||[])];
  // taking Claude's own suggestion of a new color or pattern (newColor / newPattern, added as the owner's) is not a correction (W2-17-16)
  const claudes=(f,to)=>{const s=f==='primaryColor'?q.newColor:f==='pattern'?q.newPattern:null,nm=s&&String(s.name||'').trim().toLowerCase(),own=f==='pattern'?CUSTOM_PAT[to]:CUSTOM_COL[to];
    return !!(nm&&own&&String(own.name||'').trim().toLowerCase()===nm)};
  for(const f of ['type','primaryColor','secondaryColor','pattern']){const from=q.aiTag[f]||'none',to=it[f]||'none';if(f==='pattern'&&!hasPat(it.type))continue;
    if(from!==to&&!claudes(f,to)){st.wrong[f]=(st.wrong[f]||0)+1;if(from!=='none'||to!=='none')fixes.push({field:f,type:it.type,from,to,id:it.id,t:Date.now()})}}
  settings.tagStats=st;settings.tagFixes=fixes.slice(-60);await saveUserSettings()}
function tagStatsCard(){const st=settings.tagStats||{n:0,wrong:{}},fx=(settings.tagFixes||[]).slice(-8).reverse();
  const pct=f=>st.n?Math.round(100*(1-(st.wrong[f]||0)/st.n)):null;
  return `<section class="card st-card" id="st-tagging"><h3>Photo tagging</h3>
  ${st.n?`<p class="mut"><small>Of the ${st.n} item${st.n===1?'':'s'} tagged by AI and saved since this was added, how often you kept each tag as it was.</small></p>
    ${['type','primaryColor','pattern','secondaryColor'].map(f=>`<div class="st-miss"><b>${fieldLabel[f][0].toUpperCase()+fieldLabel[f].slice(1)}</b><span class="mut">${pct(f)}% right</span><span class="st-bar"><i style="width:${Math.max(2,pct(f))}%"></i></span></div>`).join('')}`
    :'<p class="mut"><small>No AI-tagged items saved yet since this was added.</small></p>'}
  ${fx.length?`<p class="mut" style="margin-top:8px"><small>Your latest corrections (the tagger is shown them):</small></p><ul class="fixlist">${fx.map(f=>`<li><small>${esc(TYPES[f.type]||f.type)} ${fieldLabel[f.field]}: ${esc(valName(f.field,f.from==='none'?null:f.from))} → <b>${esc(valName(f.field,f.to==='none'?null:f.to))}</b></small></li>`).join('')}</ul>`:''}
  </section>`}

/* ---- what one tagging call costs (the colour picker's "Ask Claude" shows it): Claude Opus 5.5 prices, visual tokens of the photo and
   its close-up, and a usual answer. (The accuracy check that used it, Settings → Photo tagging → Advanced, was removed 2026-11-13.) ---- */
const PRICE_IN=4,PRICE_OUT=20;   // Claude Opus 5.5, $ per million tokens (the worker's default model)
/* visual tokens of a picture (28-pixel patches, capped like the API) */
const visTok=(w,h)=>{const s=Math.min(1,2576/Math.max(w,h));w*=s;h*=s;const t=Math.ceil(w/28)*Math.ceil(h/28);return Math.min(4784,t)};
/* (2026-11-14) at the sizes really sent: the sharp photo (TAG_MAX, a phone's 4:3) and the sharp close-up (CLOSE_MAX); it assumed 1024 and
   half a 640 close-up, about 30% low (the audit) */
function benchEstimate(n,{img=[TAG_MAX,TAG_MAX*.75],close=[CLOSE_MAX,CLOSE_MAX*.75]}={}){const per=(visTok(...img)+(close?visTok(...close):0)+4000)*PRICE_IN/1e6+2500*PRICE_OUT/1e6;return n*per}
/* one "Describe it to Claude" lookup (worker /describe, Claude Sonnet 5.5 unless the owner sets CLAUDE_DESCRIBE_MODEL): the fixed text and
   tables (about 2,300 tokens, counted uncached), the owner's lists and the words (about 300), the answer with its thinking (a colour about
   700 tokens, a pattern about 1,500), and the close-up when it is sent (CLOSE_MAX, 4:3) */
const DESC_PRICE_IN=2,DESC_PRICE_OUT=10;   // Claude Sonnet 5.5, $ per million tokens
function describeEstimate(what,withClose){return (2600+(withClose?visTok(CLOSE_MAX,CLOSE_MAX*.75):0))*DESC_PRICE_IN/1e6+(what==='pattern'?1500:700)*DESC_PRICE_OUT/1e6}
/* "Read color and texture from close-up" (colpick.js rdRun): the color and the pattern lookup, both with the close-up (about 4¢) */
const readEstimate=()=>describeEstimate('colour',true)+describeEstimate('pattern',true);
/* An ES module (2026-11-23): its names are its own. The bridge (tests/bridge.test.js lists it; the file has no top-level call): app.js,
   add.js, add-keep.js, add-save.js, item-photo.js, migrate.js, measure.js, pattern-read.js, colpick.js, look.js, safety.js and stats.js,
   classic scripts, and tagging.js (TAG_Q) and checklist.js (texSig), modules that read them as globals, use these */
Object.assign(globalThis,{TAG_MAX,CLOSE_MAX,TAG_Q,customForTag,tagFixes,tagExtras,TAGIMG_CACHE,keepTagImg,tagImgOf,resignTagImg,texSig,keepCloseImg,sharpCloseOf,recordTagResult,tagStatsCard,benchEstimate,describeEstimate,readEstimate});
export {TAG_MAX,CLOSE_MAX,TAG_Q,customForTag,tagFixes,tagExtras,TAGIMG_CACHE,keepTagImg,tagImgOf,resignTagImg,texSig,keepCloseImg,sharpCloseOf,recordTagResult,tagStatsCard,benchEstimate,describeEstimate,readEstimate};
