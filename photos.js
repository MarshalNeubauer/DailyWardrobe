/* Daily Wardrobe: outfit photos: keys, kept photos, the realistic photo, item pictures and the background queue
   (A classic script sharing one global scope with the others, loaded in index.html's order; split out of app.js on 2026-11-14.) */
/* ---- realistic photo: the figure + item photos -> worker /render (OpenAI image edit).
   Photos are saved per outfit combination, not per day: any day that wears the same pieces reuses the photo.
   The worker keeps a copy (KV) so every device can show it. ---- */
let renders={},rendering=false,renderMsg={k:'',t:''},renderFail={};   // rendering: an outfit being sent (or, on a worker without a queue, made) now; renderMsg: a note for one day; renderFail: why a queued photo failed, per combination
const esc=t=>String(t??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');   // ' too: some go into onclick='…'
const figureLabel=o=>[o.top,o.shirt,o.tie,o.clip,o.watch].filter(Boolean).map(i=>nm(i)).join(', ');
/* the combination a photo shows: which pieces, and everything about them that changes how they look */
/* Which look a photo shows. The shirt counts only by its base colour (any white shirt shares the photo made with another
   white shirt); the jacket, tie, clip and watch count by how they look (colours, pattern, metal, dial), not by which item it
   is, so identical items share too. */
const LOOK_FIELDS=['primaryColor','secondaryColor','tertiaryColor','pattern','metal','dial','band','bezel','watchStyle'];
/* how one piece looks, for photo keys: a shirt by its colour (and its pattern or read texture), anything else by its look fields, details and read pattern */
const lookSig=(s,i)=>s==='shirt'?'shirt/'+primaryCol(i)+(shirtPatterned(i)?'/'+i.pattern+(i.sett?'/'+settSig(i.sett):'')+(i.patternText?'/'+i.patternText:''):shirtTextured(i)?'/tex/'+settSig(i.sett):''):[i.type,...LOOK_FIELDS.map(f=>i[f]??'')].join('/')+(i.details?'/'+i.details:'')+(i.sett?'/'+settSig(i.sett):'')+(i.patternText?'/'+i.patternText:'');
const comboSig=o=>(o.vest?'vest|':'')+(!o.top&&o.bot?'nojacket/'+[o.bot.type,...LOOK_FIELDS.map(f=>o.bot[f]??'')].join('/')+'|':'')+['top','shirt','tie','clip','watch'].map(s=>o[s]?lookSig(s,o[s]):'-').join('|');
const fnvMemo=new Map();   // the same looks are hashed over and over (every render, every history record): remember them
const fnv64=t=>{let v=fnvMemo.get(t);if(v)return v;let h=0xcbf29ce484222325n;for(const c of new TextEncoder().encode(t)){h^=BigInt(c);h=(h*0x100000001b3n)&0xffffffffffffffffn}
  v=h.toString(16).padStart(16,'0');if(fnvMemo.size>4000)fnvMemo.clear();fnvMemo.set(t,v);return v};
const comboKey=o=>'c'+fnv64(comboSig(o));
/* the key photos were saved under before shirts counted by colour only; moved over on first use */
const comboSigV1=o=>(o.vest?'vest|':'')+['top','shirt','tie','clip','watch'].map(s=>{const i=o[s];return i?[i.id,...LOOK_FIELDS.map(f=>i[f]??''),i.cuff??'',i.stripes?JSON.stringify(i.stripes):''].join('/'):'-'}).join('|');
const comboKeyV1=o=>'c'+fnv64(comboSigV1(o));
const figSig=comboSig;
/* photos saved before combinations were used were keyed by date with this signature; they are moved over on first use */
const legacySig=o=>(o.vest?'vest|':'')+['top','shirt','tie','clip','watch'].map(s=>{const i=o[s];return i?[i.id,i.primaryColor,i.secondaryColor,i.tertiaryColor,i.pattern,i.metal,i.updated||0].join('/'):'-'}).join('|');
async function keepRender(ck,rec,share){renders[ck]=rec;await metaPut('render:'+ck,rec);if(share)shareRender(ck,rec)}
const workerBase=()=>{const w=localStorage.getItem('worker_url'),tok=localStorage.getItem('app_token');return w&&tok?{url:new URL('render',w.replace(/\/*$/,'/')).href,tok}:null};
function shareRender(ck,rec){const W=workerBase();if(W)fetch(W.url,{method:'PUT',headers:{'content-type':'application/json','x-app-token':W.tok},body:JSON.stringify({key:ck,rec})}).catch(()=>{})}
// assembled pictures (assemble.js) are in use: ASM_ON, which a test switches off unless it tests them; nothing of assemble.js is
// called while they are off, so a change there selects only the tests that use them
const asmLive=()=>typeof ASM_ON!=='undefined'&&ASM_ON;
const renderFor=o=>{const a=asmLive()&&asmFor(o);if(a)return a;   // put together on the device from item photos (assemble.js)
  const ck=comboKey(o);if(renders[ck])return renders[ck];
  const v1=renders[comboKeyV1(o)];if(v1){const rec={...v1,sig:comboSig(o)};keepRender(ck,rec,true);return rec}
  const old=renders[key(sel)];if(old&&old.sig===legacySig(o)){const rec={...old,sig:comboSig(o)};keepRender(ck,rec,true);return rec}
  return null};
/* a combination with no photo here: ask the worker (another device may have made it); one with a photo only here: share it */
const renderTried=new Set();
async function fetchRemoteRender(o,day){
  const W=workerBase(),ck=comboKey(o);if(!W||renderTried.has(ck)||rendering)return;renderTried.add(ck);
  try{
    const get=async q=>{const r=await fetch(W.url+'?'+q,{headers:{'x-app-token':W.tok},cache:'no-store'});return r.ok?r.json():null};
    const cur=renders[ck];if(cur&&remoteKeys&&remoteKeys.has(ck))return;   // here and on the worker already: nothing to do
    // with the worker's list in hand, a day it has no photo for is not asked about: each ask was a 404, logged as an error in the
    // console for every day shown (audit 2026-11-13: 31 in one session); "none" is the normal answer
    await remoteList(W);if(remoteListed&&!remoteKeys.has(ck)&&!remoteKeys.has(comboKeyV1(o))){if(cur)shareRender(ck,cur);return}
    let j=await get('key='+ck);
    if(!j){if(cur){shareRender(ck,cur);return}
      // a photo the worker kept under the earlier combination key, or for this date before combinations were used
      const v1=await get('key='+comboKeyV1(o));if(v1&&v1.img)j={...v1,sig:comboSig(o),legacy:true};
      else{const old=await get('day='+encodeURIComponent(day));if(old&&old.img&&old.sig===legacySig(o))j={...old,sig:comboSig(o),legacy:true}}}
    if(!j||!j.img)return;
    if(cur&&cur.t>(j.t||0)){shareRender(ck,cur);return}if(cur&&cur.t===(j.t||0))return;
    await keepRender(ck,{sig:comboSig(o),img:keptPhoto(j.img),model:j.model||'',t:j.t||Date.now()},!!j.legacy);
    if(planFor()[key(sel)]&&comboKey(planFor()[key(sel)])===ck&&!$('#today').hidden)refreshToday();
  }catch(e){console.warn('remote photo unavailable',e)}
}
/* photos the worker keeps that this device lacks (a new install, or made on another device): download the ones the plan needs
   for the month on screen and the next, nearest the selected day first, so swiping between days shows them at once */
let prefetching=false,prefetchAgain=false,remoteKeys=null,remoteListed=false,remoteListP=null;
const planOf=planMonth;
/* the worker's list of kept photos (GET ?list=1), read once and shared (remoteKeys is reset to read it again); remoteListed is false
   when the worker gave no list (an older one, or its daily list allowance used up): then each day is asked about as before */
function remoteList(W){if(remoteKeys)return Promise.resolve(remoteKeys);
  return remoteListP||(remoteListP=fetch(W.url+'?list=1',{headers:{'x-app-token':W.tok},cache:'no-store'}).then(r=>r.ok?r.json().catch(()=>null):null).catch(()=>null)
    .then(j=>{remoteListP=null;remoteListed=!!(j&&Array.isArray(j.keys));remoteKeys=new Set(remoteListed?j.keys:[]);return remoteKeys}))}
async function prefetchRenders(){const W=workerBase();if(!W)return;if(prefetching){prefetchAgain=true;return}prefetching=true;
  try{
    await remoteList(W);if(!remoteListed)return;   // no list: fetch per day as before
    do{prefetchAgain=false;const c=+sel,near=new Map();   // each combination ranked by its day closest to the one on screen
      for(const [y,m] of [[view.y,view.m],[view.m===11?view.y+1:view.y,(view.m+1)%12]])for(const [k,o] of Object.entries(planOf(y,m))){if(!hasOutfit(o))continue;
        const ck=comboKey(o);if(renders[ck]||!remoteKeys.has(ck)||renderTried.has(ck))continue;const d=Math.abs(+keyDate(k)-c),cur=near.get(ck);if(!cur||d<cur[0])near.set(ck,[d,ck,o])}
      const list=[...near.values()].sort((a,b)=>a[0]-b[0]);let i=0;
      const one=async()=>{while(i<list.length&&!prefetchAgain){const [,ck,o]=list[i++];if(renders[ck])continue;
        try{const r=await fetch(W.url+'?key='+ck,{headers:{'x-app-token':W.tok},cache:'no-store'});const j=r.ok?await r.json().catch(()=>null):null;
          if(!j||!j.img){remoteKeys.delete(ck);continue}
          await keepRender(ck,{sig:comboSig(o),img:keptPhoto(j.img),model:j.model||'',t:j.t||Date.now()},false);
          const s=planFor()[key(sel)];if(s&&comboKey(s)===ck&&!$('#today').hidden)refreshToday()}catch(e){remoteKeys.delete(ck)}}};
      await Promise.all([one(),one(),one()]);
    }while(prefetchAgain)
  }catch(e){console.warn('photo prefetch failed',e)}finally{prefetching=false}}
let prefetchTimer=0;const schedulePrefetch=()=>{clearTimeout(prefetchTimer);prefetchTimer=setTimeout(prefetchRenders,250)};
async function loadRenders(){try{const all=await txs('meta','readonly',s=>s.getAll(IDBKeyRange.bound('render:','render;',false,true)));renders={};for(const x of all||[])renders[String(x.k).slice(7)]=x.v}catch(e){console.warn(e)}}   // (only the photos' key range: the kept assembled pictures are read by asmLoad)
/* a metal as words for the photo prompt: 'other' (a dark grey metal) reads as gunmetal */
const metalWord=i=>({gold:'gold',other:'gunmetal'})[i&&i.metal]||'silver';
/* a tie clip is named by its colour (no metal field): "silver", "rose gold", "black" (enamel) */
const clipWord=i=>colName(primaryCol(i));
/* a striped or checked shirt shows in the photo (a plain or finely woven one counts by its colour alone) */
const shirtPatterned=i=>!!i&&([...STRIPE_PATS,...CHECK_PATS,'houndstooth'].includes(patBase(i.pattern))||!!(usableSett(i)||{}).motif);
/* a shirt whose weave texture was read (dobby diamonds, herringbone…): it gets its own photo, described and drawn for the generator */
const shirtTextured=i=>!!i&&!shirtPatterned(i)&&!!(usableSett(i)||{}).tex;
const shirtTexText=i=>`a ${colName(primaryCol(i))} dress shirt woven with a fine, subtle tone-on-tone ${TEX_WORDS[i.sett.tex.kind]||'woven texture'} (the texture is in the weave itself, one colour, faint but visible up close; not stripes, checks or a print)`;
function outfitText(o){
  const pt=(i,role)=>{const t=patternPrompt(i,role);return t?` (${t})`:''};   // the pattern measured and described (tagging.js)
  const parts=[o.top&&`a ${nm(o.top)}${pt(o.top,'top')}`,o.shirt&&(shirtPatterned(o.shirt)?`a ${colName(primaryCol(o.shirt))} ${patName(o.shirt.pattern)} dress shirt${pt(o.shirt,'shirt')}`:shirtTextured(o.shirt)?shirtTexText(o.shirt):`a plain ${colName(primaryCol(o.shirt))} dress shirt`)+(o.top?(o.tie?'':', worn with the collar open and the top button undone, with no tie'):`, tucked in, ${o.tie?'':'the collar open with no tie, '}no jacket`),!o.top&&o.bot&&`${nm(o.bot)}${pt(o.bot,'bot')} with a leather belt`,o.vest&&`a matching five-button waistcoat (vest) in the same fabric as the suit, buttoned, its V opening visible above the jacket button`,o.tie&&`a ${nm(o.tie)}${pt(o.tie,'tie')}`,o.clip&&`a ${clipWord(o.clip)} tie bar`,
    o.watch&&watchText(o.watch,{worn:true}),o.links&&`${metalWord(o.links)} cufflinks`];
  return prettyCols(parts.filter(Boolean).join('; '));
}
/* draw the figure SVG onto a canvas and return a PNG data URL. With a jacket the picture is the square FIG_CROP of the drawing
   (viewBox units): the shoulders fill its width and it ends just under the pocket flaps, the close framing the photo generator
   copies (sent whole, 390x400, it came back zoomed out, down to the hips). A no-jacket day keeps the whole drawing */
const FIG_CROP={x:11,y:0,s:368};
async function figurePng(o,w=780){
  const crop=o&&o.top?FIG_CROP:null,k=crop?w/crop.s:w/390,W=Math.round(390*k),H=Math.round(400*k);
  // the watch's face on the drawing is its own photo's dial (as the dial reference is cut), turned as worn in figure.js
  const wp=o&&o.watch&&(o.watch.photo||(itemPic(o.watch)||{}).img),face=wp&&typeof dialCrop==='function'?await dialCrop(wp):null;
  const svg=figureSvg(o,'r-',{photo:true,face}).replace('width="100%"',`width="${W}" height="${H}"`).replace('style="display:block;height:auto"','');
  return new Promise((ok,no)=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=w;c.height=crop?w:H;const x=c.getContext('2d');
    x.fillStyle=figBg();x.fillRect(0,0,c.width,c.height);x.drawImage(im,crop?-crop.x*k:0,crop?-crop.y*k:0,W,H);ok(c.toDataURL('image/png'))};im.onerror=()=>no(new Error('could not draw the illustration'));
    im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)});
}
/* an outfit photo is kept on the device as the worker made it: shrunk to 900px (JPEG .85) it was softer than the 1024 original, and
   Today shows it up to 390 points wide on a 3x screen (1170 pixels) and zooms 2.5x. Assembled pictures keep their 900px (assemble.js):
   their kept zones were measured at that size */
const keptPhoto=u=>u;
const shrinkUrl=(u,max,q=.85)=>new Promise(ok=>{const im=new Image();im.onload=()=>{const k=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);c.getContext('2d').drawImage(im,0,0,c.width,c.height);ok(c.toDataURL('image/jpeg',q))};im.onerror=()=>ok(u);im.src=u});
/* generate and keep the photo for one outfit; throws with a readable message */
/* reference photos for an outfit photo, each labelled: the jacket and tie photos, and the watch's own photo or its product
   picture (no shirt photo: an outfit photo is shared by every shirt of that colour). A tie with a close-up goes without its
   photo (the owner's choice after a trial: the close-up and the pattern drawing carry the tie, and its place goes to the
   shirt's close-up); a tie without one keeps its photo, its only picture */
function outfitRefs(o){const refs=[],labels=[];const add=(img,l)=>{if(img){refs.push(img);labels.push(l)}};
  const tex=(i,what)=>add(i&&i.texture,`a close-up of the ${what} fabric (match its exact colour and weave)`);   // a fabric close-up, when the item has one
  const top=o.suitDay?'suit':'blazer';add(o.top&&o.top.photo,'the '+top);tex(o.top,top);
  if(!o.top){add(o.bot&&o.bot.photo,'the trousers');tex(o.bot,'trouser')}tex(o.shirt,'shirt');if(!(o.tie&&o.tie.texture))add(o.tie&&o.tie.photo,'the tie');tex(o.tie,'tie');
  // the owner's own photo of the watch first: a product picture is the generator's redrawing, and its dial's details are already lost
  if(o.watch)add(o.watch.photo||(itemPic(o.watch)||{}).img,'the wristwatch (copy it exactly: case shape, bezel, dial layout and subdials, numerals, hands, bracelet links)');
  return {refs,labels}}
async function renderCombo(o){
  const w=localStorage.getItem('worker_url'),tok=localStorage.getItem('app_token');
  if(!w||!tok)throw new Error('Connect in ⚙ Settings first.');
  const image=await figurePng(o);
  const {refs,labels}=await outfitRefsFull(o);
  const r=await fetch(new URL('render',w.replace(/\/*$/,'/')).href,{method:'POST',headers:{'content-type':'application/json','x-app-token':tok},body:JSON.stringify({image,refs,labels,outfit:outfitText(o),key:comboKey(o),sig:comboSig(o),...(o.top?{}:{nojacket:true})})});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error((r.status===404||r.status===405)?'The server doesn’t support photos yet: it needs an update.':(j.message||j.error||`HTTP ${r.status}`));
  const rec={sig:comboSig(o),img:keptPhoto(j.image),model:j.model||'',t:Date.now()};
  await keepRender(comboKey(o),rec,false);   // the worker already kept a copy
  return rec;
}
/* Generate or Regenerate (Settings → This day's photo; there is no month batch any more) the shown day's photo. It goes to the worker's background queue,
   so the app can be swiped to another day, closed or locked: the worker makes it and the app picks it up when it next looks
   (every 20 s while open, and on opening). Only a worker without the queue makes it while the app waits. */
const renderPending=o=>{const ck=o&&comboKey(o);return !!ck&&(rendering===ck||(queuedKeys().includes(ck)&&!renderStalled(ck)))};
/* a photo waiting over 10 minutes has stalled (one takes about a minute; retries a few more): the button offers to send it again */
const STALL_MS=10*60000,renderStalled=ck=>{const q=rqGet();return q.keys.includes(ck)&&Date.now()-sentAt(q,ck)>STALL_MS};
async function generateRender(){
  const o=planFor()[key(sel)];if(!o||rendering||renderPending(o))return;
  const day=key(sel),ck=comboKey(o),replace=!!renderFor(o);rendering=ck;delete renderFail[ck];renderMsg={k:day,t:''};renderToday();renderRegenUI();
  // an outfit painted on a colour-coded master is only painted (nothing to pay for); a Regenerate still makes a whole photo
  try{const q=!replace&&asmLive()&&asmWants(o)?(await asmEnsure(o),'asm'):await queueCombo(o,replace);
    if(q==='queued'){const s=rqGet();s.keys=[...new Set([...s.keys,ck])];s.total=(s.total||0)+1;s.sentAt=Date.now();s.at={...(s.at||{}),[ck]:s.sentAt};s.failed=s.failed||[];rqSet(s);startQueueWatch()}
    else if(q==='noqueue'){renderMsg={k:day,t:'This takes about 30–90 seconds. Keep the app open until it is done.'};renderToday();await renderCombo(o);renderMsg={k:'',t:''}}}
  catch(e){const raw=String(e.message||e),pm=typeof plainErr==='function'?plainErr(raw):raw;   // (the server's set-up errors in plain words for a tester, ui.js)
    renderMsg={k:day,t:/Connect in|server doesn|Today’s limit/.test(raw)?raw:pm!==raw?pm:'Couldn’t send the photo: '+raw}}
  finally{rendering=false;if(key(sel)===day&&!$('#today').hidden)refreshToday();renderRegenUI()}
}
/* when this look (same suit, tie, clip, watch, vest; any shirt of the same colour) was last worn, before the shown day.
   A day counts unless marked "Didn't" (2026-11-14, the owner: a day is worn by default; it used to take a ✓) */
function lastWorn(o){
  const ck=comboKey(o),T=todayDate(),lim=Math.min(+keyDate(key(sel)),+T);let best=null;
  for(const r of Object.values(dayRecs)){if(!r.ids||r.worn===false)continue;const d=keyDate(r.date);if(+d>=lim||(best&&d<=best))continue;
    const get=id=>id&&items.find(i=>i.id===id)||null,x={suitDay:!!r.suitDay,top:get(r.ids.top),bot:get(r.ids.bot),shirt:get(r.ids.shirt),tie:get(r.ids.tie),clip:get(r.ids.clip),watch:get(r.ids.watch),vest:!!r.vestOn};
    if([x.top,x.shirt,x.tie].some(i=>i&&(i.added||0)>+d+864e5))continue;   // dated before a piece was added: a warm-up day of the planner, never worn
    if((x.top||x.shirt)&&comboKey(x)===ck)best=d}
  return best;
}
/* ---- item pictures: product photos of shoes, belts, socks, trousers and coats for the tiles under the figure.
   Generated once per look (OpenAI, through the worker), kept like outfit photos and shared between devices. ---- */
const ITEM_PIC_TYPES=['shoes','belt','socks','pants','overcoat','raincoat','watch'];
const aAn=w=>(/^[aeiou]/i.test(w)?'an ':'a ')+w;
function itemDesc(i){const c=colName(primaryCol(i)),lea=patLabel(i.leather||'calf'),pat=i.pattern&&i.pattern!=='solid'&&i.pattern!=='other'?patLabel(i.pattern)+' ':'';
  switch(i.type){
    case 'shoes':{const st=shoeStyle(i);   // (an oxford's description is the one from before styles, so its picture is kept)
      if(st==='sneaker'){const m=i.leather==='canvas'?'canvas':i.leather==='knit'?'knit':i.leather==='suede'?'suede':'leather',sole=i.secondaryColor&&i.secondaryColor!=='none'?colName(i.secondaryColor):'white';
        return `a pair of ${c} ${m} low-top sneakers with ${aAn(sole)} rubber cupsole, side three-quarter view`}
      return st==='oxford'?`a pair of ${c} ${lea} leather cap-toe oxford dress shoes, side three-quarter view`:`a pair of ${c} ${lea} leather ${({derby:'derby dress shoes',loafer:'penny loafers',boot:'chelsea boots'})[st]}, side three-quarter view`}
    case 'belt':return `${aAn(c)} ${lea} leather dress belt, loosely coiled, with a polished ${i.metal==='gold'?'gold':i.metal==='other'?'gunmetal':'silver'} buckle`;
    case 'socks':{const t=sockToe(i);return `a single ${c} ${pat}fine-knit mid-calf dress sock in side profile, as if on an invisible leg: the cuff at the top, the leg straight down, the heel at the lower left and the foot pointing to the right, smooth fine gauge with a soft sheen${t?`, with a ${colName(t)} knitted toe cap over the toes (only the toe, the heel stays ${c})`:', the toe and heel the same colour as the rest'}`}
    case 'pants':{const k=trouserKind(i);return k==='jeans'?`a pair of ${c} denim jeans, neatly folded`:k==='chinos'?`a pair of ${c} ${pat}cotton chinos, neatly folded`:`a pair of ${c} ${pat}${primaryCol(i)==='khaki'?'cotton twill':'wool'} dress trousers, neatly folded`}
    case 'overcoat':return `${aAn(c)} wool overcoat on an invisible mannequin`;
    case 'raincoat':return `${aAn(c)} trench coat on an invisible mannequin`;
    case 'watch':return `${watchText(i)}, three-quarter view, standing upright on a display cushion, the bracelet closed`}
  return ''}
const itemKey=i=>'c'+fnv64('item|'+itemDesc(i));
const itemPic=i=>i&&ITEM_PIC_TYPES.includes(i.type)&&renders[itemKey(i)]||null;
/* the colour of a product photo's backdrop (the average of its outer edge), so a tile wider than the photo is filled to match;
   the picture's edges are feathered (CSS mask) so there is no visible seam */
const picBgs={},PIC_BG='rgb(220,215,210)';   // the generated photos' backdrops average about this; used until a real reading
/* WebKit (iOS Safari) can hand back blank pixels when an <img> is drawn right at onload, so read from a decoded copy and
   accept only a full-alpha, light result (the backdrops are light grey); anything else keeps PIC_BG */
async function readPicBg(src){try{const im=new Image();im.src=src;await im.decode();const N=16,c=document.createElement('canvas');c.width=c.height=N;
    const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0,N,N);const d=x.getImageData(0,0,N,N).data,s=[0,0,0,0];let n=0;
    for(let y=0;y<N;y++)for(let X=0;X<N;X++)if(y===0||X===0||y===N-1||X===N-1){const o=(y*N+X)*4;for(let j=0;j<4;j++)s[j]+=d[o+j];n++}
    const [r,g,b,a]=s.map(v=>Math.round(v/n));return a>=250&&r*.3+g*.59+b*.11>=150?`rgb(${r},${g},${b})`:null}catch{return null}}
/* product photos made on a pure white backdrop (the old sock prompt) glare next to the warm-grey ones: tone the white down to
   PIC_BG (bright pixels are multiplied by it, dark ones kept, so the item and its soft shadow stay). Returns a new data URL,
   or null when the photo's edge isn't near white */
async function greyBackdrop(src){try{const im=new Image();im.src=src;await im.decode();const W=im.naturalWidth,H=im.naturalHeight;if(!W||!H)return null;
    const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0);
    const D=x.getImageData(0,0,W,H),d=D.data,lum=o=>d[o]*.3+d[o+1]*.59+d[o+2]*.11;let s=0,n=0;
    for(let X=0;X<W;X+=4){s+=lum(X*4)+lum(((H-1)*W+X)*4);n+=2}for(let Y=0;Y<H;Y+=4){s+=lum(Y*W*4)+lum((Y*W+W-1)*4);n+=2}
    if(s/n<240)return null;
    const bg=PIC_BG.match(/\d+/g).map(v=>+v/255);
    for(let o=0;o<d.length;o+=4){const l=lum(o),t=l<=150?0:l>=245?1:((l-150)/95)**2;for(let j=0;j<3;j++)d[o+j]=Math.round(d[o+j]*(1-t+t*bg[j]))}
    x.putImageData(D,0,0);return c.toDataURL('image/jpeg',.88)}catch{return null}}
const itemImg=async u=>{const s=await shrinkUrl(u,400);return await greyBackdrop(s)||s};
/* once per kept product photo: tone down a white backdrop saved before the prompt changed */
async function fixItemBackdrops(){let n=0;for(const [k,r] of Object.entries(renders))if(r&&r.sig==='item'&&!r.grey){const g=await greyBackdrop(r.img);
    await keepRender(k,{...r,...(g?{img:g}:{}),grey:1},false);if(g){n++;delete picBgs[k]}}return n}
function picBg(img,k){if(picBgs[k]!==undefined)return;picBgs[k]=null;
  readPicBg(img.src).then(c=>{if(!c)return;picBgs[k]=c;document.querySelectorAll(`img.item-pic[data-k="${k}"]`).forEach(i=>{const t=i.closest('.tile');if(t)t.style.background=c})})}
const itemPicHtml=(i,fallback)=>{const p=itemPic(i);if(p)return `<img class="item-pic" src="${p.img}" alt="" data-k="${itemKey(i)}" onload="picBg(this,'${itemKey(i)}')">`;if(i&&ITEM_PIC_TYPES.includes(i.type))setTimeout(()=>fetchItemPic(i),0);return fallback};
async function fetchItemPic(i){const W=workerBase(),k=itemKey(i);if(!W||renderTried.has(k)||renders[k])return;renderTried.add(k);
  try{await remoteList(W);if(remoteListed&&!remoteKeys.has(k))return;   // not on the worker: no 404 to ask for
    const r=await fetch(W.url+'?key='+k,{headers:{'x-app-token':W.tok},cache:'no-store'});if(!r.ok)return;const j=await r.json();if(!j||!j.img)return;
    await keepRender(k,{sig:'item',img:await itemImg(j.img),model:j.model||'',t:j.t||Date.now(),grey:1},false);if(!$('#today').hidden)refreshToday();else if(!$('#wardrobe').hidden&&!phEdit.crop)renderWardrobe()}catch(e){console.warn('item picture unavailable',e)}}
async function renderItemPic(i){
  const W=workerBase();if(!W)throw new Error('Connect in ⚙ Settings first.');
  const r=await fetch(W.url,{method:'POST',headers:{'content-type':'application/json','x-app-token':W.tok},body:JSON.stringify({mode:'item',item:itemDesc(i),key:itemKey(i),...(i.photo?{ref:i.photo}:{})})});   // the item's own photo, when there is one, is the model to copy
  const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.message||j.error||`HTTP ${r.status}`);
  await keepRender(itemKey(i),{sig:'item',img:await itemImg(j.image),model:j.model||'',t:Date.now(),grey:1},false);
}
const missingItemPics=()=>{const seen=new Set();return items.filter(i=>{if(!ITEM_PIC_TYPES.includes(i.type))return false;const k=itemKey(i);if(seen.has(k)||renders[k])return false;seen.add(k);return true})};
let itemBatch=false;
function renderItemPicUI(){const b=$('#itempic-btn');if(!b||itemBatch)return;const n=missingItemPics().length;
  b.textContent=n?`Generate ${n} item picture${n===1?'':'s'}`:'Every shoe, belt, sock, trousers, coat and watch has a picture';b.disabled=!n;if(typeof needConn==='function')needConn(b)}
async function startItemPics(){if(itemBatch)return;const todo=missingItemPics();if(!todo.length)return;
  if(!await askConfirm(`Generate ${todo.length} product picture${todo.length===1?'':'s'}?\n\nFor your shoes, belts, socks, trousers, coats and watches.${showCost()?` About $${(todo.length*.05).toFixed(2)} at roughly 5¢ each.`:''}`,{ok:'Generate'}))return;
  itemBatch=true;const st=$('#itempic-status'),b=$('#itempic-btn');let done=0,fail=0,err='';
  for(const i of todo){if(st)st.textContent=`Generating ${done+fail+1} of ${todo.length}…`;if(b)b.disabled=true;
    try{renderTried.delete(itemKey(i));await fetchItemPic(i);if(!renders[itemKey(i)])await renderItemPic(i);done++}catch(e){fail++;err=e.message;if(/Connect in|OPENAI_API_KEY|forbidden|Today’s limit/i.test(err))break}}
  itemBatch=false;if(st)st.textContent=`Done: ${done} picture${done===1?'':'s'} ready${fail?`, ${fail} failed (${typeof plainErr==='function'?plainErr(err):err})`:''}`;renderItemPicUI();if(!$('#today').hidden)refreshToday()}
/* ---- background photos (worker queue): send one outfit's inputs; the worker makes the photo later ---- */
async function queueCombo(o,replace=false){
  const W=workerBase();if(!W)throw new Error('Connect in ⚙ Settings first.');
  const image=await figurePng(o),{refs,labels}=await outfitRefsFull(o),ck=comboKey(o);
  const r=await fetch(W.url,{method:'POST',headers:{'content-type':'application/json','x-app-token':W.tok},body:JSON.stringify({mode:'queue',image,refs,labels,outfit:outfitText(o),key:ck,sig:comboSig(o),...(o.top?{}:{nojacket:true}),...(replace?{replace:true}:{})})});
  const j=await r.json().catch(()=>({}));
  if(r.ok&&j.queued)return 'queued';
  if(r.ok&&j.exists){renderTried.delete(ck);if(remoteKeys)remoteKeys.add(ck);await fetchRemoteRender(o,'');return renders[ck]?'done':'queued'}
  if(r.ok&&j.image){await keepRender(ck,{sig:comboSig(o),img:keptPhoto(j.image),model:j.model||'',t:Date.now()},false);return 'done'}   // an older worker made it right away
  // only a worker without the queue (noQueue) is asked again directly: a 501 for a missing image service is the answer, not a
  // reason to ask twice (one Generate tap sent two POST /render, audit 2026-11-13)
  if((r.status===501&&j.noQueue)||r.status===404||r.status===405)return 'noqueue';
  throw new Error(j.message||j.error||`HTTP ${r.status}`)}
const RQ='render_queue';
const rqGet=()=>{try{const q=JSON.parse(localStorage.getItem(RQ)||'{}');return {keys:[],failed:[],...q}}catch{return {keys:[],failed:[]}}};
const rqSet=q=>{try{q.keys.length?localStorage.setItem(RQ,JSON.stringify(q)):localStorage.removeItem(RQ)}catch{}renderBusy()};
const queuedKeys=()=>rqGet().keys;
/* ask the worker how the queued photos are doing and bring the finished ones home */
let rqTimer=null,rqBusy=false;
async function checkQueue(){const q=rqGet(),W=workerBase();if(!q.keys.length||!W||rqBusy)return;rqBusy=true;const removed=new Set(),newFail=[],fresh={};
  // by key: the worker reads each one, no KV list (lists are capped per day)
  try{const r=await fetch(W.url+'-queue?keys='+q.keys.slice(0,40).join(','),{headers:{'x-app-token':W.tok},cache:'no-store'});const st=await r.json().catch(()=>null);if(!r.ok||!st)return;
    const pend=new Set(st.pending||[]),fail=Object.fromEntries((st.failed||[]).map(f=>[f.key,f.error]));let got=0,shown=false;
    for(const k of [...q.keys]){
      if(pend.has(k)){const run=st.running&&st.running[k];if(run&&run.at>sentAt(q,k))fresh[k]=run.at;continue}   // the worker started it again: wait afresh
      if(fail[k]){newFail.push(fail[k]);renderFail[k]=fail[k];shown=true;removed.add(k);continue}
      const g=await fetch(W.url+'?key='+k,{headers:{'x-app-token':W.tok},cache:'no-store'});const j=g.ok?await g.json().catch(()=>null):null;
      if(j&&j.img){await keepRender(k,{sig:j.sig||'',img:keptPhoto(j.img),model:j.model||'',t:j.t||Date.now()},false);got++;removed.add(k);
        const o=planFor()[key(sel)];if(o&&comboKey(o)===k)shown=true}
      else if(!g.ok&&g.status!==404)continue;
      else if(Date.now()-sentAt(q,k)>LOST_MS)removed.add(k)}   // neither waiting, failed nor finished for a long time: lost (expired), stop waiting for it
      // (a job just sent can be missing from the worker's list for up to a minute: KV lists are only eventually consistent)
    // applied to the list as it is now: a push may have taken some meanwhile, and new photos may have been sent
    const q2=rqGet();q2.keys=q2.keys.filter(k=>!removed.has(k));if(Object.keys(fresh).length)q2.at={...(q2.at||{}),...fresh};if(q2.at)for(const k of removed)delete q2.at[k];q2.failed=[...(q2.failed||[]),...newFail];finishQueueMsg(q2);
    rqSet(q2);renderRegenUI();if((shown||removed.size)&&!$('#today').hidden)refreshToday();
  }catch(e){console.warn('queue check failed',e)}finally{rqBusy=false}}
/* Bringing photos home. The worker pushes: while photos are waiting and the app is on screen, a request to GET /render-wait is held
   open, and the worker answers it the moment a queue job finishes, with the photo itself (waitPush). Polling GET /render-queue
   stays as the backup (a worker without the push, a dropped connection), timed by what a photo takes: none is ready within 40 s
   of sending, so the first look is then; after that every 7 s, every 20 s after 3 minutes (a month batch) and every minute after 15. */
/* when each photo was sent (rqGet().at), and how long one may go unseen before it counts as lost: the queue retries a failing
   photo for several minutes and a month batch makes two at a time, so 45 minutes */
const LOST_MS=45*60000,sentAt=(q,k)=>(q.at&&q.at[k])||q.sentAt||0;
const queueDelay=age=>age<40000?40000-age:age<300000?20000:60000;   // the push brings photos the moment they're made; polling is only the backup
function scheduleQueueCheck(){clearTimeout(rqTimer);rqTimer=null;const q=rqGet();if(!q.keys.length)return;
  rqTimer=setTimeout(async()=>{rqTimer=null;if(document.visibilityState==='visible')await checkQueue();scheduleQueueCheck()},Math.max(1000,queueDelay(Date.now()-(q.sentAt||0))))}
function startQueueWatch(){renderBusy();scheduleQueueCheck();waitPush()}
function stopQueueWatch(){clearTimeout(rqTimer);rqTimer=null}
let PUSH_WAIT=90000,pushOn=false,noPush=false;
async function waitPush(){const W=workerBase(),keys=queuedKeys();if(pushOn||noPush||!W||!keys.length||document.visibilityState!=='visible')return;pushOn=true;let pause=0;
  try{const r=await fetch(W.url+'-wait?keys='+keys.join(',')+'&ms='+PUSH_WAIT,{headers:{'x-app-token':W.tok},cache:'no-store'});
    if(r.status===501||(r.status>=400&&r.status<500)){noPush=true;return}   // an older worker without the push (or no access): polling only
    const res=r.ok?await r.json().catch(()=>[]):[];if(!r.ok)pause=5000;if(Array.isArray(res)&&res.length)await takeQueued(res)}
  catch{pause=5000}   // the connection dropped (the app went to the background): look again shortly
  finally{pushOn=false}
  if(pause)await new Promise(ok=>setTimeout(ok,pause));waitPush()}
/* finished (or failed) queued photos, from the push or from polling */
async function takeQueued(res){res=(res||[]).filter(m=>m&&m.key);if(!res.length)return;
  // every finished photo is kept, even one the app had stopped waiting for: it is for an outfit the user asked for
  for(const m of res)if(m.rec&&m.rec.img)await keepRender(m.key,{sig:m.rec.sig||'',img:keptPhoto(m.rec.img),model:m.rec.model||'',t:m.rec.t||Date.now()},false);
  const q=rqGet(),mine=new Set(q.keys);for(const m of res){if(!mine.has(m.key))continue;if(!m.rec&&m.error){q.failed.push(m.error);renderFail[m.key]=m.error}q.keys=q.keys.filter(k=>k!==m.key)}
  finishQueueMsg(q);rqSet(q);renderRegenUI();if(!$('#today').hidden)refreshToday()}
function finishQueueMsg(q){const done=(q.total||0)-q.keys.length-q.failed.length;
  q.msg=q.keys.length?`Making photos: ${done} of ${q.total} done. You can close the app; they appear as they finish.`
    :`All ${done} photo${done===1?'':'s'} ready${q.failed.length?`; ${q.failed.length} failed (${q.failed[q.failed.length-1]})`:''}.`;
  if(!q.keys.length)stopQueueWatch()}
