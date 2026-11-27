/* Daily Wardrobe: photo tagging, pattern readings (split from tagging.js, Round B CR-2-17): the full pattern (sett) from the pixels, Claude's
   reading (POST /pattern) coloured from the pixels, motifs, a dress shirt's weave texture and camouflage. */
/* a card changed: add.js redraws Add on it (bus.js 'card-changed'; the restructure S3c, 2026-11-26: this file loads before add.js) */
import {emit,serve,askFor} from './bus.js';
import {CAMO_TR,CHECK_PATS,MOTIF_PATS,STRIPE_PATS,TEXTURE_PATS,settFromCanvas,texPat,tieWeave} from './detect.js';
import {FABRIC,PATS_BY,camoPat,dE00,hexRgb,inviteOver,items,labHex,patBase,patName,rgbLab,settingsOpen,esc} from './core.js';
import {BLUR_SHARP,applyMeasured,applyWb,closeRead,measureCard,sharpness,wbRead} from './measure.js';
import {linSrgb8,srgbLin8} from './srgb.js';
import {cardAt,cardIx,imgOf,put,queue} from './app.js';
import {sharpCloseOf,tagImgOf} from './tag-request.js';
import {planDirty} from './today-plan.js';
import {closeTagImg,readBegin,readEnd} from './add-ids.js';
import {toast} from './toast.js';
import {acts} from './act.js';

/* (moved from measure.js with its text unchanged, the restructure S6c) */
/* measure the card and take what is sure (the first tag, tagging again from the close-up, Try again) */
function measureAndApply(q){measureCard(q);missedPattern(q);return applyMeasured(q)}
/* ---- the full pattern (detect.js analyzeSett): read in colour from the sharp item photo (Claude's patternBox: the largest
   area that is all patterned cloth), else from the close-up, else from Claude's own reading (weave.colours). Claude's
   weave also gives the direction (for a close-up, whose angle says nothing), the repeats across the item (the drawing's
   scale on the figure) and a description for the photo generator. ---- */
const SETT_PATS={tie:[...STRIPE_PATS,...CHECK_PATS,'tonal-check','other',...MOTIF_PATS],shirt:[...STRIPE_PATS,...CHECK_PATS,'other',...TEXTURE_PATS],suit:[...STRIPE_PATS,...CHECK_PATS],blazer:[...STRIPE_PATS,...CHECK_PATS],pants:[...STRIPE_PATS,...CHECK_PATS]};
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
/* (2026-11-14, strict: a close-up) the white balance only from a real patch of paper (closeRead); the exposure may still be raised from the
   cloth's own white threads (at most 1.6x, never lowered): a tie's thin white edging and a white dobby's ground read white, as before */
function settCanvas(c,wb,strict){const r=wbRead(c),g=wb||(strict?closeRead(c).gains:r.gains),out=applyWb(c,g);if(!r.ref||r.refLum>=235||r.frac<.03)return out;   // a few white threads are no reference (partly blended, they read dim)
  const k=Math.min(1.6,srgbLin8(243)/srgbLin8(Math.max(1,r.refLum))),x=out.getContext('2d',{willReadFrequently:true}),D=x.getImageData(0,0,out.width,out.height),d=D.data,lut=new Uint8ClampedArray(256);
  for(let v=0;v<256;v++)lut[v]=Math.round(linSrgb8(Math.min(1,srgbLin8(v)*k)));for(let i=0;i<d.length;i+=4){d[i]=lut[d[i]];d[i+1]=lut[d[i+1]];d[i+2]=lut[d[i+2]]}x.putImageData(D,0,0);return out}
/* a reading takes 1.8-2.5 s at phone speed and the card asked for the same one again and again (every re-tag, toggle and Claude's
   answer): each input's reading is kept (by the card's own canvases, which live as long as the card), so it is worked out once */
const settMemo=new WeakMap();
function settFrom(a){const k0=a.tex||a.full;if(!k0)return settFromRaw(a);const key=JSON.stringify([a.full?1:0,a.tex?1:0,a.box||null,a.weave||null,a.wb||null,a.type||null]);
  let m=settMemo.get(k0);if(!m){m=[];settMemo.set(k0,m)}const hit=m.find(e=>e.full===a.full&&e.tex===a.tex&&e.key===key);if(hit)return hit.s&&JSON.parse(JSON.stringify(hit.s));
  const s=settFromRaw(a);m.push({full:a.full,tex:a.tex,key,s:s&&JSON.parse(JSON.stringify(s))});return s}
function settFromRaw({full,box,tex,weave,wb,type}){let s=null,c=null;
  const opt={straight:!!type&&type!=='tie'};   // a jacket's, shirt's or trousers' pattern is straight in the photo
  try{if(full&&box){s=settFromCanvas(settCanvas(full,wb),box,opt);if(s){s.src='photo';s.tr=+(s.cr/.8).toFixed(2)}}   // the box spans about 80% of the item's width
    if(tex){const r=closeRead(tex);c=settFromCanvas(settCanvas(tex,r.ref?r.gains:wb,true),null,opt);if(c){c.src='closeup';c.tr=1.5}}}catch(e){console.warn('pattern not read',e)}
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
/* patterns only Claude's reading can draw (the band reader would turn them into stripes) */
/* a tie tagged woven or tonal check (2026-11-13): never read before, so painted plain; the owner's charcoal & grey woven tie is a grid of
   tiny light dots, which Claude reads as a motif (the tie painter draws motifs and bands; a pure weave, layout texture, stays plain) */
const claudeOnly=(t,p)=>motifPat(p)||texPat(t,p)||tieWeave(t,p)||camoPat(p);   // (a camouflage: Claude's reading, else its colours clustered from the pixels, camoFromPixels; never the band reader)
/* a card's pattern can be read: a band pattern, a weave Claude described, or a pattern only Claude can read (a motif, a shirt's weave) */
/** @param {*} t @param {*} p @param {*} w */ const readable=(t,p,w)=>settable(t,p,w)||claudeOnly(t,p);
/* Claude's reading drawn with the photo's colours: bands (stripes, checks, plaids) or a motif (small figures on a grid) */
/* an answer of a shape it can't draw (2026-11-16: across without bands threw, and the Add card's Confirm stayed off) gives null: the
   pixel reader takes over, as when Claude sent nothing */
const specSett=(spec,args)=>{try{return specSett1(spec,args)}catch(e){console.warn('pattern answer not drawn',e);askFor('err-note',e,'Pattern answer not drawn ('+(args&&args.type||'?')+', '+(spec&&(spec.texture?'texture':spec.motif?'motif':spec.across?'bands':spec.layout)||'?')+')');return null}};
const specSett1=(spec,args)=>spec&&(spec.camo?camoFromSpec(spec,args):spec.texture?(args.type==='shirt'||args.type==='tie'?texFromSpec(spec,args):null):spec.motif?motifFromSpec(spec,args):spec.across?settFromSpec(spec,args):null);
function readSett(q){const ok=!q.settOff&&readable(q.type,q.pattern,q.weave)&&q.raw,args={full:q.raw&&q.raw.full,box:q.patternBox,tex:q.raw&&q.raw.tex,wb:q.wbOff?null:q.wb,type:q.type};q.settReject=null;
  let s=null;if(ok&&q.spec)s=specSett(q.spec,args);
  if(!s)s=ok&&!claudeOnly(q.type,q.pattern)?settFrom({full:q.raw.full,box:q.patternBox,tex:q.raw.tex,weave:q.weave,wb:q.wbOff?null:q.wb,type:q.type}):null;
  if(!s&&ok&&camoPat(q.pattern))try{s=camoFromPixels(args)}catch(e){console.warn('camouflage not read',e)}   // no answer from Claude: its colours from the pixels
  const chk=settCheck(q.type,q.pattern,s);if(chk.reject){q.settReject=chk.reject;s=null}else s=chk.s;
  q.sett=s;return s}
/* a band reading that contradicts the tag is not used (2026-11-14: the walkthrough's soft pinstripe close-up was read as level bands at
   -84° with lines crossing them, and Today drew the suit as a brown windowpane): a stripe has no crossing lines, and on a jacket, shirt
   or trousers it runs upright; read level from a close-up (or by Claude) it is only turned upright, since a close-up can be held either
   way, but level in the item photo it is a misreading */
function settCheck(type,pat,s){if(!s||!s.bands||type==='tie')return {s};const p=patBase(pat)||'';if(!STRIPE_PATS.includes(p))return {s};   // (a tie keeps any reading: a plaid tie is often tagged stripe)
  // crossing lines: a jacket's or trousers' stripe read with them is a misreading (the pinstripe drawn as a windowpane); on a shirt
  // they are the weave or a stray fold at most, so they are only dropped (the walkthrough's white/blue shirt kept its stripes)
  if(s.cross&&s.cross.bands&&s.cross.bands.some(b=>b[0])){if(['suit','blazer','pants'].includes(type))return {reject:'cross'};s={...s,cross:null}}
  const a=((s.a%180)+180)%180;if(a<20||a>160)return {s};
  return /photo/.test(s.src||'')?{reject:'level'}:{s:{...s,a:0}}}
/* a pattern the tag missed: a close-up of cloth tagged plain that clearly shows stripes or a check (bands 12+ ΔE00 apart, two repeats or
   more, a sharp close-up) is suggested, never set */
function missedPattern(q){if(!q||!q.raw||!q.raw.tex||(patBase(q.pattern)||'solid')!=='solid'||!PATS_BY[q.type])return null;
  if(q.missed&&q.missed.c===q.raw.tex)return q.missed.p;let p=null;
  if((sharpness(q.raw.tex)||0)>=BLUR_SHARP){const s=settFrom({tex:q.raw.tex,wb:q.wbOff?null:q.wb,type:q.type});
    if(s&&s.bands&&s.bands.length>=2&&s.cr>=2){const L=h=>rgbLab(...hexRgb(h)),g=s.bands.reduce((a,b)=>b[1]>a[1]?b:a),gl=L(g[0]),con=Math.max(...s.bands.filter(b=>b!==g).map(b=>dE00(L(b[0]),gl))),line=1-g[1];
      const cross=s.cross&&s.cross.bands.some(b=>b[0]),jacket=['suit','blazer','pants'].includes(q.type);
      if(con>=12)p=cross?(jacket?(line<.15?'windowpane':'glen-check'):'check'):(jacket?(line<.15?'pinstripe':'chalk-stripe'):q.type==='shirt'&&line<.15?'fine-stripe':'stripe');
      if(p&&!(PATS_BY[q.type]||[]).includes(p))p=null}}
  q.missed={c:q.raw.tex,p};return p}
function toggleSett(i){const q=queue[i];q.settOff=!q.settOff;readSett(q);if(q.meas)measureAndApply(q);emit('card-changed')}
const settSummary=s=>!s?'generic':s.camo?`camouflage in its tagged colors${s.src==='claude+pixels'?', laid out as Claude and the photo read it':s.src==='pixels'?', laid out as the photo shows it':''}`:s.tex?`a ${TEX_WORDS[s.tex.kind]||'woven texture'} (${s.tex.grid[0].length}×${s.tex.grid.length} repeat), read by Claude with the contrast from the close-up`:s.motif?`${s.motif.figs.length===1?'one figure':s.motif.figs.length+' figures'} on a ${s.motif.grid} grid, read by Claude with the colors from the photo`:s.src==='claude+pixels'?`${s.bands.length} band${s.bands.length===1?'':'s'}${s.cross?' and lines the other way':''}, read by Claude with the colors from the photo`:`${s.bands.length} color band${s.bands.length===1?'':'s'}${s.cross?' with lines crossing the other way':''}, read from ${s.src==='photo'?'the photo':s.src==='closeup'?'the close-up':s.src==='photo+closeup'?'the photo and the close-up':'Claude\'s description'}`;
function settNote(q){if(!readable(q.type,q.pattern,q.weave))return '';
  if(q.patternReading)return '<p class="tagnote mut"><small><span class="spin" aria-hidden="true"></span>Claude is reading the pattern…</small></p>';
  if(q.settOff)return `<p class="tagnote mut"><small>Drawn with the simple ${esc(patName(q.pattern))} pattern.</small><button type="button" class="chipbtn" data-act="settTap" ${cardAt(q)}>Use the pattern from the photo</button></p>`;
  if(q.settReject)return `<p class="tagnote settrej"><small>The pattern reader saw ${q.settReject==='cross'?'lines crossing the stripes':'level bands'}, which isn't ${esc(patName(q.pattern).toLowerCase())}: drawn with the simple pattern.</small></p>`;
  return q.sett?`<p class="tagnote"><small>Pattern: ${settSummary(q.sett)}.</small><button type="button" class="chipbtn" data-act="settTap" ${cardAt(q)}>Use the simple pattern</button></p>`:''}
/* Wardrobe editor: read it again from the kept sharp copy (or the close-up) */
/** @param {*} id */ async function rereadSett(id){const it=items.find(x=>x.id===id);if(!it)return;
  const toCanvas=async src=>{if(!src)return null;try{const im=await imgOf(src),c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d').drawImage(im,0,0);return c}catch{return null}};
  const full=it.pbox?await toCanvas(await tagImgOf(it.id,it)):null,tex=await toCanvas(it.texture);
  let spec=null;const img=await tagImgOf(it.id,it)||it.photo;if(localStorage.getItem('worker_url')&&img){toast('Claude is reading the pattern…');spec=await claudePattern({image:img,closeup:await sharpCloseOf(it),type:it.type})}
  const full2=full||(it.photo?await toCanvas(it.photo):null);
  const s=specSett(spec,{full:full2,box:it.pbox,tex,type:it.type})||(camoPat(it.pattern)?camoFromPixels({full:full2,box:it.pbox,tex}):claudeOnly(it.type,it.pattern)?null:settFrom({full,box:it.pbox,tex,weave:it.weave,wb:null,type:it.type}));   // the kept copy is already white-balanced
  if(spec){it.patternSpec=spec;if(spec.description)it.patternText=spec.description}
  const chk=settCheck(it.type,it.pattern,s);if(chk.reject){toast(`The reading showed ${chk.reject==='cross'?'lines crossing the stripes':'level bands'}, which isn't ${patName(it.pattern).toLowerCase()}: the pattern stays as it was.`);return}
  if(!chk.s){toast(spec===null&&patternFail?'Claude couldn’t read the pattern right now (the server had a problem). Try again later.':'No clear pattern found. Add a fabric close-up (or a sharper photo) and try again.',6000);return}
  // drawn again at once, the open sheet included (it shows the reading); with Settings opened while Claude read it waits for Settings to
  // close (renderWardrobe closes Settings: the 2026-11-24 review's R1 N1)
  it.sett=chk.s;delete it.stripes;await put(it);planDirty();if(settingsOpen())askFor('sync-redraw','wardrobe');else emit('wardrobe-changed');toast(`Pattern read: ${settSummary(s)}.`)}

/* ---- the pattern read by Claude (worker POST /pattern) and coloured from the pixels. The pixel reader alone is thrown by the
   noise in a photo (a seam, moire, panes made uneven by drape); Claude reports the pattern as woven: every band of a repeat each
   way, in order, with its width. The exact colours come from the photos: each named thread is matched to its own pixels, the
   close-up's exposure is matched to the item photo's (which has a white wall to set it), and where a thread's pixels read grey
   though Claude sees a colour (a light-blue line woven into khaki linen), the pixels keep the lightness and Claude the hue.
   Without the worker, or when Claude finds no pattern, the pixel reader (settFrom) is used. ---- */
/* patternFail: the last reading failed on the server's side (an error status, no answer) rather than finding no pattern; rereadSett says so (2026-11-18:
   the server refused every reading for two days with a 502 and the item sheet said "No clear pattern found") */
let patternFail=false;
/** @param {{image: any, closeup: any, type: any, wb?: any, signal?: AbortSignal}} o */
async function claudePattern({image,closeup,type,wb,signal}){const w=localStorage.getItem('worker_url');patternFail=false;if(!w||!image||inviteOver())return null;
  try{const r=await fetch(new URL('pattern',w.replace(/\/*$/,'/')).href,{method:'POST',headers:{'content-type':'application/json','x-app-token':localStorage.getItem('app_token')||''},
      body:JSON.stringify({image,...(closeup?{closeup}:{}),type,...(typeof wb==='boolean'?{wb}:{})}),...(signal?{signal}:{})});   // wb: both pictures white-balanced (worker.js); signal: Skip or a newer close-up calls it off (readBegin)
    const j=await r.json().catch(()=>({}));if(r.status>=500||r.status===401||r.status===403)patternFail=true;if(r.status===429&&j.message)askFor('limit-note',j.message);   // today's limit on pattern readings: say so (the pixel reader takes over)
    // any of the four answers (a camouflage has only camo: CR-2-01, it was paid for and dropped)
    return r.ok&&(j.across||j.motif||j.texture||j.camo)&&j.layout!=='none'?j:null}catch(e){if(!(e&&e.name==='AbortError'))patternFail=true;return null}}
function sampleLabs(c){const x=c.getContext('2d',{willReadFrequently:true}),d=x.getImageData(0,0,c.width,c.height).data,st=Math.max(1,Math.round(c.width*c.height/120000)),out=[];
  for(let i=0;i<d.length;i+=4*st)out.push(rgbLab(d[i],d[i+1],d[i+2]));return out}
const medLab=ls=>[0,1,2].map(k=>{const v=ls.map(l=>l[k]).sort((a,b)=>a-b);return v[v.length>>1]});
function cropCanvas(c,box){const x=box.x/1000*c.width,y=box.y/1000*c.height,w=Math.max(1,box.w/1000*c.width),h=Math.max(1,box.h/1000*c.height),o=document.createElement('canvas');
  o.width=Math.round(w);o.height=Math.round(h);o.getContext('2d').drawImage(c,x,y,w,h,0,0,o.width,o.height);return o}
/** @param {any} spec @param {{tex: any, full?: any, box?: any, wb?: any, type: any}} on */
function settFromSpec(spec,{tex,full,box,wb,type}){
  const L=h=>rgbLab(...hexRgb(h)),C=l=>Math.hypot(l[1],l[2]);
  let src=null;try{src=tex?settCanvas(tex,closeRead(tex).ref?null:wb,true):full&&box?cropCanvas(settCanvas(full,wb),box):null}catch{}
  const labs=src?sampleLabs(src):[],ground=labs.length?medLab(labs):null;   // the whole cloth's median: for the exposure match only (below)
  // the close-up's exposure matched to the item photo's (the median of the patterned area in each); only with the pattern's box:
  // a whole photo's median takes in the wall and the next jackets (it turned a navy pinstripe lavender)
  let delta=[0,0,0];if(tex&&full&&box&&ground)try{const g2=medLab(sampleLabs(cropCanvas(settCanvas(full,wb),box)));delta=g2.map((v,k)=>v-ground[k])}catch{}
  // every distinct thread colour Claude named, with its share of the cloth
  const threads=new Map();for(const d of [spec.across,spec.along])if(d)for(const b of d.bands){const t=threads.get(b.hex)||{share:0,role:b.role};t.share+=b.w/(spec.along?2:1);if(b.role==='ground')t.role='ground';threads.set(b.hex,t)}
  const dist=(x,y)=>Math.hypot((x[0]-y[0])/2,1.4*(x[1]-y[1]),1.4*(x[2]-y[2])),dE76=(x,y)=>Math.hypot(x[0]-y[0],x[1]-y[1],x[2]-y[2]);
  const groundHex=[...threads].filter(([,t])=>t.role==='ground').sort((a,b)=>b[1].share-a[1].share)[0];
  const colour=new Map(),near=(cl,share,from)=>{const top=from.slice().sort((a,b)=>dist(a,cl)-dist(b,cl)).slice(0,Math.max(12,Math.round(from.length*share*.5)));
    return top.length>=6?[0,1,2].map(j=>top.reduce((s,p)=>s+p[j],0)/top.length):null};
  // the ground: the pixels nearest Claude's ground colour, like the lines. It was the median of the whole close-up, which is the ground
  // only when the ground covers most of the cloth: on the owner's half-navy, half-blue repp stripe it landed between the two (#344a71
  // for Claude's #1e2347), and his navy came out slate
  // (a ground covering most of the cloth, 70% or more, keeps the median: it is the ground there, and it was tuned on the owner's photos)
  const gl=groundHex&&labs.length&&groundHex[1].share<.7?near(L(groundHex[0]),groundHex[1].share,labs):null,gref=gl||ground;
  for(const [hex,t] of threads){const cl=L(hex);let m=null;
    if(labs.length){if(groundHex&&hex===groundHex[0])m=gref;
      else{const cand=labs.filter(p=>dE76(p,gref)>6);m=near(cl,Math.min(.2,t.share),cand);
        // a thin line (10% of the repeat or less, all its stripes together) is a few pixels wide in a close-up and blurred with the ground beside it: of its
        // pixels, the half furthest from the ground (a tie's thin white edging read #b6b9b8, light grey, beside a grey band)
        if(m&&t.share<=.1){const top=cand.slice().sort((a,b)=>dist(a,cl)-dist(b,cl)).slice(0,Math.max(12,Math.round(cand.length*t.share*.5))).sort((a,b)=>dE76(b,gref)-dE76(a,gref)),h=top.slice(0,Math.max(6,top.length>>1));
          m=[0,1,2].map(j=>h.reduce((s,p)=>s+p[j],0)/h.length)}}
      // a coloured thread that reads grey in the pixels keeps the pixels' lightness and takes Claude's hue
      if(m&&t.role!=='ground'&&C(cl)>10&&C(m)<.6*C(cl)){const s=Math.max(C(m),.75*C(cl))/C(cl);m=[m[0],cl[1]*s,cl[2]*s]}
      // a line's threads cross the ground's (a white line reads cream, not paper white): a quarter of the ground's lightness. Not on a
      // tie: its stripes are woven floats of their own yarn, and the mix darkened a blue stripe and turned a thin white line grey
      if(m&&t.role!=='ground'&&type!=='tie')m=[.75*m[0]+.25*gref[0],m[1],m[2]]}
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
async function readPatternWithClaude(q){if(!q||!queue.includes(q)||!q.raw||!q.raw.tex||!q.tagImg||!readable(q.type,q.pattern,q.weave)||!localStorage.getItem('worker_url'))return;   // a card saved or skipped meanwhile: no paid call
  const me=readBegin(q,'pattern');q.patternReading=1;emit('card-changed');let spec=null;
  try{const closeup=await closeTagImg(q);if(!queue.includes(q)){readEnd(q,'pattern',me);q.patternReading=0;return}
    spec=await claudePattern({image:q.tagImg,closeup,type:q.type,wb:!!(q.wb&&!q.wbOff),...(me.ac?{signal:me.ac.signal}:{})})}catch(e){console.warn('pattern reading failed',e);askFor('err-note',e,'Pattern reading')}   // wb: one flag for both pictures (the close-up takes the photo's correction, or its own paper's)
  if(!readEnd(q,'pattern',me))return;   // called off (a newer close-up, Skip): its answer is not used
  q.patternReading=0;
  // the card is drawn again however the answer goes (a step that threw here left Confirm switched off: refineFromCloseup)
  try{if(spec){q.spec=spec;if(spec.description)q.weave={...(q.weave||{}),description:spec.description}}else q.specFailed=1;
    readSett(q);if(q.meas)measureAndApply(q)}catch(e){console.warn('pattern answer not applied',e);q.specFailed=1;askFor('err-note',e,'Pattern answer not applied ('+q.type+')')}
  finally{if(queue.includes(q)){emit('card-changed');askFor('add-keep')}}}

/* ---- camouflage (2026-11-16, the owner's MultiCam pants): irregular blotches, no grid to read. Its colours come from the pixels: the
   close-up (else the pattern's box in the photo, else the photo's middle) sampled at about CAMO_SAMPLE px and clustered in Lab (k-means,
   seeded by the farthest-point rule, CAMO_K colours or as many as Claude named), clusters under CAMO_MIN of the cloth dropped (a seam, a
   shadow), largest first, so the ground is the first. Claude's reading (POST /pattern layout camouflage) gives how many colours and how
   big the blotches are (blobsAcrossItem: a camoField tile holds about CAMO_BLOBS across); without pixels, its own colours and shares.
   -> {v:5, camo:{cols, shares, seed}, tr, cr, src} ---- */
const CAMO_SAMPLE=110,CAMO_K=6,CAMO_FINE=10,CAMO_MIN=.03,CAMO_BLOBS=4,CAMO_MERGE=7,CAMO_AB=4;
function camoFromPixels({tex,full,box},k=CAMO_K){
  let src=tex||null;if(!src&&full){try{src=box?cropCanvas(full,box):full}catch{src=full}}
  if(!src)return null;const W=src.width,H=src.height;
  // the middle: a close-up's edges often hold the floor or a seam (the owner's MultiCam close-up had floor tiles down one side, read as a
  // light grey "colour" of 27%), a whole photo's the room around the item
  const m=box?.04:tex?.15:.2,cx=W*m,cy=H*m,cw=W-2*cx,ch=H-2*cy,S=Math.min(1,CAMO_SAMPLE/Math.max(cw,ch)),w=Math.max(8,Math.round(cw*S)),h=Math.max(8,Math.round(ch*S));
  const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d',{willReadFrequently:true});if(!g)return null;g.drawImage(src,cx,cy,cw,ch,0,0,w,h);
  const d=g.getImageData(0,0,w,h).data,px=[];for(let j=0;j<d.length;j+=4)px.push(rgbLab(d[j],d[j+1],d[j+2]));
  // hue counts CAMO_AB times lightness: a muted sage green and a tan of the same lightness are different camouflage colours (with plain Lab
  // distance the owner's greens joined the tan)
  const dist=(a,b)=>(a[0]-b[0])**2+CAMO_AB*((a[1]-b[1])**2+(a[2]-b[2])**2);k=Math.max(2,Math.min(6,k|0));
  // finely first (CAMO_FINE clusters), then down to k: a cluster holding sage green and a pinkish tan averages to grey (their hues cancel),
  // which coarse clusters did on the owner's MultiCam
  const kf=Math.max(k,CAMO_FINE);
  const cen=[px[Math.floor(px.length/2)]];while(cen.length<kf){let far=null,fd=-1;for(let j=0;j<px.length;j+=3){const m=Math.min(...cen.map(c=>dist(px[j],c)));if(m>fd){fd=m;far=px[j]}}cen.push(far)}
  let asg=new Int8Array(px.length);
  for(let it=0;it<12;it++){const sum=cen.map(()=>[0,0,0,0]);for(let j=0;j<px.length;j++){let b=0,bd=1e9;for(let q=0;q<cen.length;q++){const dd=dist(px[j],cen[q]);if(dd<bd){bd=dd;b=q}}asg[j]=b;const S2=sum[b];S2[0]+=px[j][0];S2[1]+=px[j][1];S2[2]+=px[j][2];S2[3]++}
    for(let q=0;q<cen.length;q++)if(sum[q][3])cen[q]=[sum[q][0]/sum[q][3],sum[q][1]/sum[q][3],sum[q][2]/sum[q][3]]}
  const cnt=cen.map(()=>0);for(const a of asg)cnt[a]++;
  // two clusters that came out nearly alike (within CAMO_MERGE ΔE00) are one colour, weighted by their pixels
  let cs=cen.map((c,q)=>({lab:c,n:cnt[q]})).filter(x=>x.n);for(let merged=true;merged;){merged=false;
    for(let a=0;a<cs.length&&!merged;a++)for(let b2=a+1;b2<cs.length&&!merged;b2++)if(dE00(cs[a].lab,cs[b2].lab)<CAMO_MERGE){const n=cs[a].n+cs[b2].n;cs[a]={lab:cs[a].lab.map((v,q)=>(v*cs[a].n+cs[b2].lab[q]*cs[b2].n)/n),n};cs.splice(b2,1);merged=true}}
  // then the smallest into its nearest until k are left (the near ones are alike, so the hues it joins are close)
  while(cs.length>k){cs.sort((a,b)=>a.n-b.n);const s0=cs.shift();let bi=0,bd=1e9;cs.forEach((x,q)=>{const dd=dist(x.lab,s0.lab);if(dd<bd){bd=dd;bi=q}});
    const t2=cs[bi],n=t2.n+s0.n;cs[bi]={lab:t2.lab.map((v,q)=>(v*t2.n+s0.lab[q]*s0.n)/n),n}}
  const cl=cs.map(x=>({hex:labHex(x.lab),share:x.n/px.length})).filter(x=>x.share>=CAMO_MIN).sort((a,b)=>b.share-a.share);
  if(cl.length<2)return null;const t=cl.reduce((a,x)=>a+x.share,0);let h2=5381;for(const ch2 of cl.map(x=>x.hex).join(''))h2=(Math.imul(h2,33)+ch2.charCodeAt(0))>>>0;
  return {v:5,camo:{cols:cl.map(x=>x.hex),shares:cl.map(x=>+(x.share/t).toFixed(3)),seed:h2%100000},tr:CAMO_TR,cr:1,src:'pixels'}}
function camoFromSpec(spec,args){const m=spec&&spec.camo;if(!m||!Array.isArray(m.colours)||m.colours.length<2)return null;
  const tr=Math.max(.5,Math.min(20,(+m.blobsAcrossItem||CAMO_TR*CAMO_BLOBS)/CAMO_BLOBS));
  const fromPx=camoFromPixels(args,m.colours.length);
  if(fromPx)return {...fromPx,tr,src:'claude+pixels'};
  const cols=m.colours.filter(c=>/^#[0-9a-f]{6}$/i.test(c.hex||'')).sort((a,b)=>(+b.share||0)-(+a.share||0));if(cols.length<2)return null;
  const t=cols.reduce((a,c)=>a+Math.max(.01,+c.share||0),0);let h=5381;for(const ch of cols.map(c=>c.hex).join(''))h=(Math.imul(h,33)+ch.charCodeAt(0))>>>0;
  return {v:5,camo:{cols:cols.map(c=>c.hex.toLowerCase()),shares:cols.map(c=>+(Math.max(.01,+c.share||0)/t).toFixed(3)),seed:h%100000},tr,cr:1,src:'claude'}}

/* ---- a motif (small figures on a grid: a neat or foulard, mini squares, dots) as Claude read it, each colour taken from its own
   pixels. A band reader can't draw these: it turns a checkerboard of mini squares into a diagonal plaid. Claude gives the grid,
   the ground and each figure (shape, place, colours, size); the pixels give each colour, like settFromSpec: the close-up's exposure
   matched to the item photo's, and Claude's hue kept where a colour's pixels read grey. ---- */
function motifFromSpec(spec,{tex,full,box,wb}){const m=spec&&spec.motif;if(!m||!m.ground||!m.figures||!m.figures.length)return null;
  const L=h=>rgbLab(...hexRgb(h)),C=l=>Math.hypot(l[1],l[2]);
  let src=null;try{src=tex?settCanvas(tex,closeRead(tex).ref?null:wb,true):full?(box?cropCanvas(settCanvas(full,wb),box):settCanvas(full,wb)):null}catch{}
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
  return {v:3,motif:{grid:m.grid,ground:c(m.ground.hex),groundName:m.ground.name,figs:m.figures.map(f=>({shape:f.shape,place:f.placement,size:+f.size.toFixed(3),cols:f.colours.map(x=>c(x.hex)),names:f.colours.map(x=>x.name),centre:f.centre?c(f.centre.hex):null,centreName:f.centre?f.centre.name:null,...(f.bitmap?{bmp:f.bitmap}:{}),...(f.name?{name:f.name}:{})})),...(m.cellAspect&&m.cellAspect!==1?{aspect:+(+m.cellAspect).toFixed(3)}:{}),...(m.rowOffset==='half'?{off:1}:{})},
    a:m.grid==='diagonal'?45:0,cr:+(+spec.repeatsInCloseup||1).toFixed(2),tr:+(+spec.repeatsAcrossItem||1).toFixed(2),src:'claude+pixels'}}
/* ---- a dress shirt's weave texture (dobby diamonds, herringbone, oxford) as Claude read it: a small bitmap of one repeat. The
   cloth is one colour, so the drawing keeps the tagged colour and takes from the close-up only how strong the texture is: the
   lightness swing between the raised threads and the ground, after the photo's own light falloff is taken out, as a share of
   the close-up's lightness (a white shirt's close-up often reads grey, but the share holds). ---- */
const TEX_WORDS={diamond:'small diamond dobby weave',herringbone:'fine herringbone weave',twill:'fine twill weave',oxford:'oxford weave','royal-oxford':'royal oxford weave',pinpoint:'pinpoint weave','end-on-end':'end-on-end weave',birdseye:'birdseye weave',honeycomb:'honeycomb weave','dobby-dot':'small dobby dot weave',basket:'basket weave',other:'woven texture'};
const TEX_REL={faint:.04,subtle:.08,clear:.14};
function texContrast(c,cells){const W=Math.min(320,c.width),H=Math.max(8,Math.round(c.height*W/c.width)),s=document.createElement('canvas');s.width=W;s.height=H;
  const x=s.getContext('2d',{willReadFrequently:true});x.drawImage(c,0,0,W,H);const d=x.getImageData(0,0,W,H).data,L=new Float32Array(W*H);
  for(let i=0;i<W*H;i++)L[i]=rgbLab(d[4*i],d[4*i+1],d[4*i+2])[0];
  // a box blur wider than a repeat is the light falloff and folds; what is left is the texture
  const R=Math.max(3,Math.min(W>>2,Math.round(1.2*W/Math.max(1,cells)))),I=new Float64Array((W+1)*(H+1));
  for(let y=0;y<H;y++){let r=0;for(let q=0;q<W;q++){r+=L[y*W+q];I[(y+1)*(W+1)+q+1]=I[y*(W+1)+q+1]+r}}
  const res=[];for(let y=R;y<H-R;y+=1)for(let q=R;q<W-R;q+=1){const a=(y-R)*(W+1)+q-R,b=(y-R)*(W+1)+q+R+1,e=(y+R+1)*(W+1)+q-R,f=(y+R+1)*(W+1)+q+R+1;
    res.push(L[y*W+q]-(I[f]-I[b]-I[e]+I[a])/((2*R+1)**2))}
  if(res.length<200)return null;res.sort((a,b)=>a-b);const med=[...L].sort((a,b)=>a-b)[L.length>>1];
  return Math.max(.015,Math.min(.35,(res[Math.floor(res.length*.92)]-res[Math.floor(res.length*.08)])/Math.max(20,med)))}
function texFromSpec(spec,{tex}){const t=spec&&spec.texture;if(!t||!t.grid||t.grid.length<2)return null;
  let rel=null;if(tex)try{rel=texContrast(settCanvas(tex,null,true),+spec.repeatsInCloseup||8)}catch{}
  const L=h=>rgbLab(...hexRgb(h))[0];
  return {v:4,tex:{kind:t.kind,grid:t.grid,aspect:+(+t.aspect||t.grid.length/t.grid[0].length).toFixed(2),lighter:L(t.raised.hex)>=L(t.ground.hex),contrast:t.contrast,rel:+(rel??TEX_REL[t.contrast]??.08).toFixed(3),measured:rel!=null},
    a:0,cr:+(+spec.repeatsInCloseup||8).toFixed(2),tr:+(+spec.repeatsAcrossItem||100).toFixed(2),src:'claude+pixels'}}
/* the Add card's "Use the pattern from the photo" / "Use the simple pattern" (act.js; the card by its id: add-save.js cardIx) */
function settTap(el){toggleSett(cardIx(el))}
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
serve('pattern-readable',readable);serve('pattern-reread',rereadSett);   // (the restructure S6p: the painter, asm-cm-job.js asmCmRoute and asm-cm-page.js Read N patterns, may not import this file)
globalThis.HOOK={__proto__:globalThis.HOOK||null,camoFromPixels,claudePattern,motifFromSpec,motifPat,settCheck,settFrom,specSett,texContrast,texFromSpec,readable,claudeOnly,missedPattern,readPatternWithClaude,readSett,rereadSett,settFromSpec,settSummary,settable};
export {settable,motifPat,claudeOnly,readable,specSett,settSummary,TEX_WORDS,settFrom,readSett,settCheck,missedPattern,settNote,rereadSett,claudePattern,settFromSpec,readPatternWithClaude,camoFromPixels,motifFromSpec,texContrast,texFromSpec,measureAndApply};
acts({settTap});
