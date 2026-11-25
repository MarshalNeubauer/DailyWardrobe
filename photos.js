/* Daily Wardrobe: outfit photos: keys, kept photos and item pictures
   (An ES module since 2026-11-23, loaded in index.html's order like the other scripts; split out of app.js on 2026-11-14.) */
/* ---- kept outfit photos (made by the retired photo generator, worker /render): saved per outfit combination, not per day, so any
   day that wears the same pieces shows the photo; the worker keeps a copy (KV) so every device can show it. ---- */
let renders={};   // kept pictures by key: outfit photos made before 2026-11-14 (renderFor shows them), item pictures, assembled pictures
const esc=t=>String(t??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');   // ' too: some go into onclick='…'
/* (fix round 3, W2-13-02) a value inside a quoted JS string inside an inline handler (an onclick calling f('…')): the browser decodes the attribute
   first, so esc alone gives the JS string its ' back; jsq escapes for JS, then for the attribute */
const jsq=t=>esc(String(t??'').replace(/[\\'"\n\r\u2028\u2029<>&]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')));
/* a picture's src: only a data:image base64 picture, a blob: or http(s) address or a file path, with nothing that ends the attribute,
   else nothing (records are checked where they come in, core.js cleanRecord; this is the second lock) */
const srcOk=s=>{s=String(s??'');return /^(?:data:image\/[\w.+-]+;base64,[A-Za-z0-9+/=]*|(?:blob:|https?:\/\/)[^\s"'<>`\\]+|[\w./-]+)$/.test(s)?s:''};
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
/* a picture record whose img isn't a data:image/jpeg|png|webp;base64 picture is not kept (fix round 3, W2-13-06: the server took any text
   after the prefix, and the img went into src) */
async function keepRender(ck,rec,share){if(!rec||typeof rec.img!=='string'||!REC_PHOTO.test(rec.img))return;renders[ck]=rec;await metaPut('render:'+ck,rec);if(share)shareRender(ck,rec)}
// (an ended invitation: null, so nothing is asked with the dead code: the photo list, item and outfit pictures, the masters, holiday lists.
// Every open sent 12-45 refused requests; re-audit 2026-11-15)
const workerBase=()=>{const w=localStorage.getItem('worker_url'),tok=localStorage.getItem('app_token');return w&&tok&&!(typeof inviteOver==='function'&&inviteOver())?{url:new URL('render',w.replace(/\/*$/,'/')).href,tok}:null};
function shareRender(ck,rec){const W=workerBase();if(W)fetch(W.url,{method:'PUT',headers:{'content-type':'application/json','x-app-token':W.tok},body:JSON.stringify({key:ck,rec})}).catch(()=>{})}
// assembled pictures (assemble.js) are in use: ASM_ON, which a test switches off unless it tests them; nothing of assemble.js is
// called while they are off, so a change there selects only the tests that use them
const asmLive=()=>typeof ASM_ON!=='undefined'&&ASM_ON;
/* Settings → Outfit pictures → "Drawing only" (settings.pictures 'drawn', synced like every setting; absent or 'painted' = painted
   pictures, as before). 2026-11-14, the owner: "let the user turn off the painter and only use the mannequin". With it on, Today always
   shows the traced mannequin (no painted picture, no kept outfit photo) and nothing is painted or downloaded for the pictures: no masters,
   no built pictures, no list, no outfit photos (asmEnsure, asmAhead, asmSync, fetchRemoteRender, prefetchRenders all return). Item
   pictures (the product photos on the tiles under the figure, made on a tap) are their own feature and are not affected. What is already
   kept stays on the device, so switching back shows it at once. */
const picsDrawn=()=>!!settings&&settings.pictures==='drawn';
const renderFor=o=>{if(picsDrawn())return null;const a=asmLive()&&asmShown(o);if(a)return a;   // (or the same outfit's last picture while its current one is made: asmStale)   // put together on the device from item photos (assemble.js)
  const ck=comboKey(o);return renders[ck]||null};   // (the keys of older builds were moved over long ago; outfit photos are retired: CR-1-12)
/* a combination with no photo here: ask the worker (another device may have made it); one with a photo only here: share it */
const renderTried=new Set();
async function fetchRemoteRender(o,day){
  const W=workerBase(),ck=comboKey(o);if(!W||picsDrawn()||renderTried.has(ck))return;renderTried.add(ck);
  try{
    const get=async q=>{const r=await fetch(W.url+'?'+q,{headers:{'x-app-token':W.tok},cache:'no-store'});return r.ok?r.json():null};
    const cur=renders[ck];if(cur&&remoteKeys&&remoteKeys.has(ck))return;   // here and on the worker already: nothing to do
    // with the worker's list in hand, a day it has no photo for is not asked about: each ask was a 404, logged as an error in the
    // console for every day shown (audit 2026-11-13: 31 in one session); "none" is the normal answer
    await remoteList();if(remoteHold())return;   // the server's lists are used up today: no day-by-day asks either
    if(remoteListed&&!remoteKeys.has(ck)){if(cur)shareRender(ck,cur);return}
    const j=await get('key='+ck);
    if(!j&&cur){shareRender(ck,cur);return}
    if(!j||!j.img)return;
    if(cur&&cur.t>(j.t||0)){shareRender(ck,cur);return}if(cur&&cur.t===(j.t||0))return;
    await keepRender(ck,{sig:comboSig(o),img:j.img,model:j.model||'',t:j.t||Date.now()},false);
    if(planFor()[key(sel)]&&comboKey(planFor()[key(sel)])===ck&&!$('#today').hidden)refreshToday();
  }catch(e){console.warn('remote photo unavailable',e)}
}
/* photos the worker keeps that this device lacks (a new install, or made on another device): download the ones the plan needs
   for the month on screen and the next, nearest the selected day first, so swiping between days shows them at once */
let prefetching=false,prefetchAgain=false,remoteKeys=null,remoteListed=false,remoteListP=null;
/* the worker's list of kept photos (GET /render?list=1): ONE request, shared by everything that needs it (the outfit photos here and
   assemble.js asmListGet; they used to ask separately, two lists every start), kept LIST_MS. A list costs one of the server's daily
   KV lists (testers share 150 a day): refused (429: the day's list allowance; 503: the server's lists failing, the free plan's daily
   lists used up) it is not asked for again until the next UTC day (localStorage list_pause {w, until}; the audit of 2026-11-14 saw 23
   refused lists in 20 s after one start, then one more on every swipe); a forced ask (Settings' Pictures ahead, Refresh) still tries
   once. Offline or unreachable: not asked again for LIST_RETRY_MS. Resolves to the Set of keys, or null when there is none */
const LIST_MS=10*60e3;
const LIST_RETRY_MS=60e3;
let listKeys=null,listAt=0,listP=null,listOf='',listFailAt=0,listRefused='';
const listNextDay=()=>{const d=new Date();return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+1)};
function listPaused(W){if(listRefused&&listRefused===W.url+'|'+W.tok)return true;try{const p=JSON.parse(localStorage.getItem('list_pause')||'null');return !!p&&p.w===W.url&&Date.now()<p.until}catch{return false}}
function workerList(force){const W=workerBase();if(!W)return Promise.resolve(null);
  const of=W.url+'|'+W.tok;if(of!==listOf){listOf=of;listKeys=null;listAt=0;listFailAt=0}   // another server or account: nothing of the last one's
  if(listP)return listP;
  if(!force&&(listKeys&&Date.now()-listAt<LIST_MS||listPaused(W)||Date.now()-listFailAt<LIST_RETRY_MS))return Promise.resolve(listKeys);
  listP=(async()=>{try{const r=await fetch(W.url+'?list=1',{headers:{'x-app-token':W.tok},cache:'no-store'});
      if(r.status===429||r.status===503){try{localStorage.setItem('list_pause',JSON.stringify({w:W.url,until:listNextDay()}))}catch{}return listKeys}
      // the code refused (401/403): an ended invitation is said and kept as such (sync.js), so workerBase gives nothing from now on; any
      // other refusal (the owner's mistyped code) holds every picture request for this code until it changes
      if(r.status===401||r.status===403){const j=await r.json().catch(()=>null);listRefused=of;
        if(typeof endedAnswer==='function'&&endedAnswer(r.status,j)&&typeof inviteEnded==='function')inviteEnded(W.tok,j);return listKeys}
      const j=r.ok?await r.json().catch(()=>null):null;
      if(j&&Array.isArray(j.keys)){listKeys=new Set(j.keys);listAt=Date.now();listFailAt=0;try{localStorage.removeItem('list_pause')}catch{}}else listFailAt=Date.now()}
    catch(e){listFailAt=Date.now();console.warn('no list',e)}
    finally{listP=null}return listKeys})();
  return listP}
/* the outfit photos' copy of the list (remoteKeys, a copy: prefetchRenders crosses off keys that turn out empty; reset to read it again);
   remoteListed is false when there is no list (an older worker): then each day is asked about as before, except while the list is
   paused for the day (remoteHold): then no day is asked about either, those were the refused requests' 404s */
function remoteList(){if(remoteKeys)return Promise.resolve(remoteKeys);
  return remoteListP||(remoteListP=workerList().then(L=>{remoteListP=null;remoteListed=!!L;remoteKeys=new Set(L||[]);
    if(L&&!localPicsTried){localPicsTried=true;shareLocalPics()}   // once a session, when the server answers again
    return remoteKeys}))}
const remoteHold=()=>{const W=workerBase();return !remoteListed&&!!W&&listPaused(W)};
async function prefetchRenders(){const W=workerBase();if(!W||picsDrawn())return;if(prefetching){prefetchAgain=true;return}prefetching=true;
  try{
    await remoteList();if(!remoteListed)return;   // no list: fetch per day as before
    do{prefetchAgain=false;const c=+sel,near=new Map();   // each combination ranked by its day closest to the one on screen
      for(const [y,m] of [[view.y,view.m],[view.m===11?view.y+1:view.y,(view.m+1)%12]])for(const [k,o] of Object.entries(planMonth(y,m))){if(!hasOutfit(o))continue;
        const ck=comboKey(o);if(renders[ck]||!remoteKeys.has(ck)||renderTried.has(ck))continue;const d=Math.abs(+keyDate(k)-c),cur=near.get(ck);if(!cur||d<cur[0])near.set(ck,[d,ck,o])}
      const list=[...near.values()].sort((a,b)=>a[0]-b[0]);let i=0;
      const one=async()=>{while(i<list.length&&!prefetchAgain){const [,ck,o]=list[i++];if(renders[ck])continue;
        try{const r=await fetch(W.url+'?key='+ck,{headers:{'x-app-token':W.tok},cache:'no-store'});const j=r.ok?await r.json().catch(()=>null):null;
          if(!j||!j.img){remoteKeys.delete(ck);continue}
          await keepRender(ck,{sig:comboSig(o),img:j.img,model:j.model||'',t:j.t||Date.now()},false);
          const s=planFor()[key(sel)];if(s&&comboKey(s)===ck&&!$('#today').hidden)refreshToday()}catch(e){remoteKeys.delete(ck)}}};
      await Promise.all([one(),one(),one()]);
    }while(prefetchAgain)
  }catch(e){console.warn('photo prefetch failed',e)}finally{prefetching=false}}
let prefetchTimer=0;const schedulePrefetch=()=>{clearTimeout(prefetchTimer);prefetchTimer=setTimeout(prefetchRenders,250)};
async function loadRenders(){try{const all=await txs('meta','readonly',s=>s.getAll(IDBKeyRange.bound('render:','render;',false,true)));renders={};for(const x of all||[])renders[String(x.k).slice(7)]=x.v}catch(e){console.warn(e)}}   // (only the photos' key range: the kept assembled pictures are read by asmLoad)
/* a striped or checked shirt has its own photo key (a plain or finely woven one counts by its colour alone) */
const shirtPatterned=i=>!!i&&([...STRIPE_PATS,...CHECK_PATS,'houndstooth'].includes(patBase(i.pattern))||!!(usableSett(i)||{}).motif);
/* a shirt whose weave texture was read (dobby diamonds, herringbone…): it has its own photo key too */
const shirtTextured=i=>!!i&&!shirtPatterned(i)&&!!(usableSett(i)||{}).tex;
/* (an outfit photo is kept on the device as the worker made it, not shrunk: Today shows it up to 1170 pixels wide and zooms 2.5x) */
const shrinkUrl=(u,max,q=.85)=>new Promise(ok=>{const im=new Image();im.onload=()=>{const k=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);c.getContext('2d').drawImage(im,0,0,c.width,c.height);ok(c.toDataURL('image/jpeg',q))};im.onerror=()=>ok(u);im.src=u});
/* (2026-11-14, the owner) the outfit photo made by OpenAI from the drawn figure is retired: the colour-coded masters paint every
   look on the device, nothing paid. Photos already kept still show on their days (renderFor) and still sync (GET/PUT /render); the
   prompt builders it was asked with are gone, and the worker's POST /render makes item pictures only. */
try{localStorage.removeItem('render_queue')}catch{}   // a queue of photos the app will never look for again
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
/* the picture prompts keep the color names they were first written with (British, before the app's text went American): itemKey
   hashes the description, so a respelt name would orphan every generated picture of a gray piece and ask to pay for it again */
const PIC_COL={grey:'grey',lightgrey:'light grey',darkgrey:'dark grey',midgrey:'mid grey',slate:'dark slate blue-grey'};
const picCol=c=>PIC_COL[c]||colName(c);
function itemDesc(i){const c=picCol(primaryCol(i)),lea=patLabel(i.leather||'calf'),pat=i.pattern&&i.pattern!=='solid'&&i.pattern!=='other'?patLabel(i.pattern)+' ':'';
  switch(i.type){
    case 'shoes':{const st=shoeStyle(i);   // (an oxford's description is the one from before styles, so its picture is kept)
      if(st==='sneaker'){const m=i.leather==='canvas'?'canvas':i.leather==='knit'?'knit':i.leather==='suede'?'suede':'leather',sole=i.secondaryColor&&i.secondaryColor!=='none'?picCol(i.secondaryColor):'white';
        return `a pair of ${c} ${m} low-top sneakers with ${aAn(sole)} rubber cupsole, side three-quarter view`}
      return st==='oxford'?`a pair of ${c} ${lea} leather cap-toe oxford dress shoes, side three-quarter view`:`a pair of ${c} ${lea} leather ${({derby:'derby dress shoes',loafer:'penny loafers',boot:'chelsea boots'})[st]}, side three-quarter view`}
    case 'belt':return `${aAn(c)} ${lea} leather dress belt, loosely coiled, with a polished ${i.metal==='gold'?'gold':i.metal==='other'?'gunmetal':'silver'} buckle`;
    // (a patterned sock, 2026-11-17: its pattern's colours too, "navy argyle fine-knit … sock, the pattern in burgundy and gold"; a plain sock's description, and so its picture, is unchanged)
    case 'socks':{const t=sockToe(i),pc=sockPatterned(i)?[i.secondaryColor,i.tertiaryColor].filter(x=>x&&x!=='none'&&COLORS[x]).map(picCol):[],pw=pc.length?`, the ${patName(i.pattern)} in ${pc.join(' and ')}`:'';return `a single ${c} ${pat}fine-knit mid-calf dress sock in side profile, as if on an invisible leg: the cuff at the top, the leg straight down, the heel at the lower left and the foot pointing to the right, smooth fine gauge with a soft sheen${pw}${t?`, with a ${picCol(t)} knitted toe cap over the toes (only the toe, the heel stays ${c})`:', the toe and heel the same colour as the rest'}`}
    case 'pants':{const k=trouserKind(i);if(isCargo(i))return `a pair of ${c} cotton cargo pants with thigh pockets, neatly folded`;return k==='jeans'?`a pair of ${c} denim jeans, neatly folded`:k==='chinos'?`a pair of ${c} ${pat}cotton chinos, neatly folded`:`a pair of ${c} ${pat}${primaryCol(i)==='khaki'?'cotton twill':'wool'} dress trousers, neatly folded`}
    case 'overcoat':return `${aAn(c)} wool overcoat on an invisible mannequin`;
    case 'raincoat':return `${aAn(c)} trench coat on an invisible mannequin`;
    case 'watch':return `${watchText(i,picCol)}, three-quarter view, standing upright on a display cushion, the bracelet closed`}
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
const itemPicHtml=(i,fallback)=>{const p=itemPic(i);if(p)return `<img class="item-pic" src="${srcOk(p.img)}" alt="" data-k="${itemKey(i)}" data-act-load="itemPicLoad">`;if(i&&ITEM_PIC_TYPES.includes(i.type))setTimeout(()=>fetchItemPic(i),0);return fallback};
/* sure: asked before paying for a new picture (startItemPics), so without a list the key is asked for even while lists are paused */
async function fetchItemPic(i,sure){const W=workerBase(),k=itemKey(i);if(!W||renderTried.has(k)||renders[k])return;renderTried.add(k);
  try{await remoteList();if(remoteListed&&!remoteKeys.has(k)||!sure&&remoteHold())return;   // not on the worker: no 404 to ask for
    const r=await fetch(W.url+'?key='+k,{headers:{'x-app-token':W.tok},cache:'no-store'});if(!r.ok)return;const j=await r.json();if(!j||!j.img)return;
    await keepRender(k,{sig:'item',img:await itemImg(j.img),model:j.model||'',t:j.t||Date.now(),grey:1},false);if(!$('#today').hidden)refreshToday();else if(!$('#wardrobe').hidden&&!phEdit.crop)wardRefresh()}catch(e){console.warn('item picture unavailable',e)}}
/* the Wardrobe drawn again for a picture that arrived in the background: while Settings or an item's sheet is open it waits for it to close,
   as a sync's redraw does (syncRedraw: viewStale, syncLater); renderWardrobe closes Settings and redraws the sheet (the 2026-11-24 review's
   R1 N1: Settings snapped shut by itself) */
function wardRefresh(){if(settingsOpen()||editing)syncRedraw('wardrobe');else renderWardrobe()}
async function renderItemPic(i){
  const W=workerBase();if(!W)throw new Error('Connect in ⚙ Settings first.');
  const r=await fetch(W.url,{method:'POST',headers:{'content-type':'application/json','x-app-token':W.tok},body:JSON.stringify({mode:'item',item:itemDesc(i),key:itemKey(i),...(i.photo?{ref:i.photo}:{})})});   // the item's own photo, when there is one, is the model to copy
  const j=await r.json().catch(()=>({}));
  // a refusal stops the batch (stop): the server's limits, its saves used up, no key; the next picture would only be refused too
  if(!r.ok){const e=new Error(j.message||j.error||`HTTP ${r.status}`);e.stop=[401,403,429,501,503].includes(r.status);throw e}
  // made (and paid for) but the server couldn't keep it (its saves used up, worker/items.js): kept on this phone, marked local so it
  // is uploaded later (shareLocalPics), and the batch stops before paying for another that couldn't be kept either
  const local=j.stored===false;
  await keepRender(itemKey(i),{sig:'item',img:await itemImg(j.image),model:j.model||'',t:Date.now(),grey:1,...(local?{local:1}:{})},false);
  if(local){const e=new Error(j.message||'The server can’t save more pictures today.');e.stop=true;e.kept=true;throw e}
}
/* item pictures kept only on this phone (made while the server couldn't save): uploaded once the server takes them again; a refusal
   keeps the mark for the next try (a new batch, or the next start's list) */
let localPicsTried=false;
async function shareLocalPics(){const W=workerBase();if(!W)return 0;let n=0;
  for(const [k,rec] of Object.entries(renders))if(rec&&rec.local){const clean={...rec};delete clean.local;
    try{const r=await fetch(W.url,{method:'PUT',headers:{'content-type':'application/json','x-app-token':W.tok},body:JSON.stringify({key:k,rec:clean})});
      if(!r.ok)break;await keepRender(k,clean,false);n++}catch{break}}
  return n}
const missingItemPics=()=>{const seen=new Set();return items.filter(i=>{if(!ITEM_PIC_TYPES.includes(i.type)||i.sample)return false;/* (not the sample wardrobe's pieces: not his) */const k=itemKey(i);if(seen.has(k)||renders[k])return false;seen.add(k);return true})};
/* the question names a tester's daily limit (account.js acct.me: caps.item, used.item from /me; the owner has none): "You can make 18
   more today, of your 40." and, when fewer are left than asked for, which are made (2026-11-15, the re-audit: the question didn't say) */
const itemPicsUsed=m=>m.day&&m.day!==new Date().toISOString().slice(0,10)?0:+(m.used&&m.used.item)||0;   // (counts from another UTC day start again)
function itemPicLimitText(n){const m=typeof acct!=='undefined'&&acct&&acct.me;const cap=m&&m.caps&&+m.caps.item;if(!cap)return '';
  const left=Math.max(0,cap-itemPicsUsed(m));
  if(!left)return '';   // (startItemPics says so instead of asking)
  return `\n\nYou can make ${left} more today, of your daily ${cap}.${left<n?` The first ${left} are made now; the rest can be made after midnight UTC.`:''}`}
const itemPicsUsedUp=()=>{const m=typeof acct!=='undefined'&&acct&&acct.me;const cap=m&&m.caps&&+m.caps.item;return cap&&itemPicsUsed(m)>=cap?cap:0};
let itemBatch=false;
function renderItemPicUI(){const b=$('#itempic-btn');if(!b||itemBatch)return;const n=missingItemPics().length;
  b.textContent=n?`Generate ${n} item picture${n===1?'':'s'}`:'Every shoe, belt, sock, pants, coat and watch has a picture';b.disabled=!n;if(typeof needConn==='function')needConn(b)}
async function startItemPics(){if(itemBatch)return;const todo=missingItemPics();if(!todo.length)return;
  {const cap=itemPicsUsedUp();if(cap){const st=$('#itempic-status');const t=`Today’s ${cap} item pictures are used up. They start again at midnight UTC.`;if(st)st.textContent=t;else if(typeof toast==='function')toast(t);return}}
  if(!await askConfirm(`Generate ${todo.length} product picture${todo.length===1?'':'s'}?\n\nFor your shoes, belts, socks, pants, coats and watches.${showCost()?` About $${(todo.length*.05).toFixed(2)} at roughly 5¢ each.`:''}${itemPicLimitText(todo.length)}`,{ok:'Generate'}))return;
  itemBatch=true;const st=$('#itempic-status'),b=$('#itempic-btn');let done=0,fail=0,err='',kept=false;
  await shareLocalPics();
  for(const i of todo){if(st)st.textContent=`Generating ${done+fail+1} of ${todo.length}…`;if(b)b.disabled=true;
    try{renderTried.delete(itemKey(i));await fetchItemPic(i,true);if(!renders[itemKey(i)])await renderItemPic(i);done++}
    // (a picture the server refused, e.stop without kept, was not made and nothing was paid: it counts as not made, not failed)
    catch(e){err=e.message;if(e.kept){done++;kept=true}else if(!e.stop)fail++;if(e.stop||/Connect in|OPENAI_API_KEY|forbidden|Today’s limit/i.test(err))break}}
  // what wasn't tried after a stop is said as such: "failed" read as if each had been tried (and paid for)
  const left=todo.length-done-fail,why=err?(typeof plainErr==='function'?plainErr(err):err):'';
  itemBatch=false;if(st)st.textContent=`Done: ${done} picture${done===1?'':'s'} ready${fail?`, ${fail} failed`:''}${left?`, ${left} not made`:''}${kept||fail||left?` (${why})`:''}`;renderItemPicUI();if(!$('#today').hidden)refreshToday()}
/* the setters other files call to assign these lets (restructure S1a, 2026-11-25): once files import each other an imported binding is read-only */
function setRemoteKeys(v){remoteKeys=v}
/* the bridge (tests/bridge.test.js): what the classic scripts and the tests still use as globals. esc is called by 35 page scripts,
   srcOk by nine, jsq by add-save.js and look.js; the painter, which stays classic, reads the kept pictures and their keys (renders,
   comboSig, comboKey, fnv64, keepRender, workerBase, workerList, listAt, picsDrawn); today.js draws with renderFor, itemPic,
   itemPicHtml, itemKey, picBgs, PIC_BG, figureLabel, lastWorn and fetchRemoteRender; start.js loads and mends (loadRenders,
   fixItemBackdrops, asmLive); settings.js draws the item pictures' line (renderItemPicUI, schedulePrefetch); history.js and
   daysoff.js word with aAn; itemsheet.js asks for a piece's picture (fetchItemPic); the rest are called or read by tests only.
   renders is replaced by tests (care, navfit, socktoe), remoteListed, listKeys and listAt by tests: a getter and a setter each
   (remoteKeys: today.js calls setRemoteKeys, the tests use HOOK); itemBatch is a let only this file writes: a getter. A module imports them.
   Above acts(), the file's one top-level call that can throw (act.js not loaded): the names are then still the page's, as a
   classic script's were */
Object.assign(globalThis,{esc,jsq,srcOk,figureLabel,comboSig,fnv64,comboKey,keepRender,workerBase,asmLive,picsDrawn,renderFor,fetchRemoteRender,workerList,schedulePrefetch,loadRenders,lastWorn,aAn,itemKey,itemPic,picBgs,PIC_BG,fixItemBackdrops,itemPicHtml,fetchItemPic,renderItemPicUI,setRemoteKeys});
Object.defineProperties(globalThis,{renders:{get:()=>renders,set:v=>{renders=v}},listAt:{get:()=>listAt,set:v=>{listAt=v}}});
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
globalThis.HOOK={__proto__:globalThis.HOOK||null,ITEM_PIC_TYPES,get itemBatch(){return itemBatch},itemDesc,itemPicLimitText,itemPicsUsedUp,get listKeys(){return listKeys},set listKeys(v){listKeys=v},missingItemPics,prefetchRenders,remoteList,get remoteListed(){return remoteListed},set remoteListed(v){remoteListed=v},renderItemPic,renderTried,shareLocalPics,shirtPatterned,startItemPics,get renders(){return renders},set renders(v){renders=v},get remoteKeys(){return remoteKeys},set remoteKeys(v){remoteKeys=v},get listAt(){return listAt},set listAt(v){listAt=v}};
export {renders,esc,jsq,srcOk,figureLabel,comboSig,fnv64,comboKey,keepRender,workerBase,asmLive,picsDrawn,renderFor,renderTried,fetchRemoteRender,remoteKeys,remoteListed,listKeys,listAt,workerList,remoteList,prefetchRenders,schedulePrefetch,loadRenders,shirtPatterned,lastWorn,ITEM_PIC_TYPES,aAn,itemDesc,itemKey,itemPic,picBgs,PIC_BG,fixItemBackdrops,itemPicHtml,fetchItemPic,renderItemPic,shareLocalPics,missingItemPics,itemPicLimitText,itemPicsUsedUp,itemBatch,renderItemPicUI,startItemPics,setRemoteKeys};
/* index.html's (act.js): Settings' "Generate item pictures" */
function itemPicsTap(){startItemPics()}
/* an item picture has loaded (data-act-load; its key in data-k): its background color is read from it once */
function itemPicLoad(el){picBg(el,el.dataset.k)}
acts({itemPicsTap,itemPicLoad});
