/* Daily Wardrobe: the Wardrobe page: the item page's body (the checklist sections, the summary line) and the edits made in it (a field,
   the type and what it drops, rotation, the Arrives date, the pattern read again), the swipe between type chips and renderWardrobe.
   (A classic script sharing one global scope with the others, loaded in index.html's order; split out of app.js on 2026-11-14, and by
   job on 2026-11-17: item-photo.js the photo tools, item-view.js the sheet itself, loaded right before it.) */
const E=(id,k,list,v,lab)=>`<label>${lab?lab:k==='primaryColor'?'Color':k==='secondaryColor'?'Second color':k==='tertiaryColor'?'Third color':k==='watchStyle'||k==='shoeStyle'?'Style':k==='trouserKind'?'Kind':k[0].toUpperCase()+k.slice(1)} <select data-act-change="itemPick" data-id="${esc(id)}" data-f="${k}">${list.map(x=>`<option value="${x[0]}" ${x[0]===v?'selected':''}>${cap1(x[1])}</option>`).join('')}</select></label>`;
let phEdit={id:null,undo:[],crop:null};
/* the item page's body (see "Wardrobe item page" below): the photo beside the drawn swatch with the row of photo tools under it, the
   "Color & texture" card (fabrics), then a card for the tags, one for rotation, and Delete on its own at the very end */
function itemBody(i){
  if(phEdit.id!==i.id)phEdit={id:i.id,undo:[],crop:null};
  const pic=i.photo||wardPic(i);
  // the photo beside the split swatch (drawing | close-up), plain pictures: the comparison lives in Look & compare (2026-11-16, the
  // owner took the old tap-to-compare out of Pictures)
  const pair=!pic?`<div class="ivdraw">${itemThumb(i)}</div>`:photoPair(pic,i,'tagsw-'+i.id);
  // the checklist (2026-11-16, the owner's approved redesign "2B Checklist", checklist.js): a summary line (photo, rotation and care pills),
  // then sections that fold, each with a status mark and a one-line summary: Look & compare (fabrics: the close-up beside the drawing, the
  // match bar, Match close-up, the paper line, True color in 3 steps, Read color and texture), Color, Pattern, Material, Details, Planning &
  // care, Name & notes, Pictures (the photos and the row of photo tools, Edit photos option B), then Duplicate and Delete. While cropping
  // the crop frame takes the summary's place at the top. From 600px two columns: the summary and Look & compare on the left.
  const id=i.id,tex=lookCu(i.type),fab=FABRIC.includes(i.type),scope='e',L=lookOn();   // (lookCu: TEXTURE_TYPES; with the Look beta on more types: look.js)
  if(phEdit.crop)return `<div class="ivin ivck">${cropEditor(i)}</div>`;   // cropping: the frame alone, everything else steps aside
  const top=ivSummary(i,pic);
  let look='';
  if(tex){const lab=i.texture?cmpLab('e',i):null,d=i.texture?cmpDiff(i,lab):null,p=i.texture?cmpPaper('e',i):null;
    const mark=!i.texture?'opt':d===null?'todo':d===0?'good':'warn';
    const sum=!i.texture?'Not yet · add a close-up to compare':d===null?'Close-up vs drawing':d===0?'Close-up vs drawing · they match':`Close-up vs drawing · ${cmpSteps(Math.abs(d))} off`;
    const body=i.texture?cmpHtml(id,i.texture,cmpDrawn(i),!!(p&&p.ref))+cmpMatchHtml('e',id,i,lab)+(paperLine(i)||cmpPaperLine(p,paperRetake(id)))+paperHint(i)+rdEditorBtn(i)
      :`<p class="shelp">Put a close-up of the cloth beside the drawing, and have Claude read its color and weave.</p>${paperHint(i)}${rdEditorBtn(i)}<div class="ckadds">${closeupBtn({label:'Add close-up',cls:'btn ckadd',mode:'add',aria:'Add fabric close-up',act:` data-act-change="photoCuFile" data-id="${esc(id)}"`,cloth:paperCloth(i)})}</div>`;
    look=ckSec(scope,'look',{mark,title:'Look &amp; compare',sum,body,open:true,id:'ivct',cls:'ivct'})}
  // the Look beta (look.js): one Look section in place of Color, Pattern, Material and Details' leather, metal and dial
  const lk=L?lookSection('e',i):null,lkSec=lk?ckSec(scope,'lk',{mark:lk.mark,title:lk.title,sum:lk.sum,body:lk.body,open:true,cls:'cklook'}):'';
  const cr=L?'':colRows('e',id,i),shade=!L&&COLORS[primaryCol(i)]&&colShows(i,'primaryColor')?shadeRow(i,'e',id,!tex&&!!(i.meas&&i.meas.src==='closeup')):'';
  const color=cr||shade?ckSec(scope,'color',{mark:'good',title:'Color',sum:ckColSum(i,primaryCol(i))+(i.shade?` · drawn ${esc(shadeName(i.shade).toLowerCase())}`:''),body:cr+accRow('e',id,i)+shade}):'';
  const layout=fab&&(DETECT_PATS.includes(patBase(i.pattern))||settable(i.type,i.pattern,i.weave)||claudeOnly(i.type,i.pattern)||i.sett)?`<div class="ivpat"><p class="shelp">Pattern layout: ${patSummary(i)}</p><div class="btns">${!i.photo&&!i.texture?'<p class="shelp nopatpic">Add a photo above to read its pattern from it.</p>':claudeOnly(i.type,i.pattern)&&!isConnected()?'':`<button id="readpat-btn" data-act="itemReadPat" data-id="${esc(id)}" data-how="${i.texture||i.pbox||claudeOnly(i.type,i.pattern)?'reread':'detect'}">Read pattern from photo</button>`}${i.stripes||i.sett?`<button data-act="itemGeneric" data-id="${esc(id)}">Use generic</button>`:''}</div></div>`:'';
  const gap=typeof asmGapNote==='function'?asmGapNote(i):'';
  const pattern=!L&&hasPat(i.type)?ckSec(   // (a pocket square or a casual garment too: its pattern, no layout reading)
scope,'pattern',{mark:'good',title:'Pattern',sum:esc(cap1(patName(normPat(i.type,i.pattern))))+(usableSett(i)?' · layout read':''),body:EP(id,i)+layout+gap}):'';
  const mat=!L&&MATERIALS_BY[i.type]?ckSec(scope,'material',{mark:i.material?'good':'opt',title:'Material',sum:i.material?esc(matLabel(i.material)):'Not set',body:matRow(i.type,i.material,matOnItem(id))}):'';
  const det=E(id,'type',Object.entries(TYPES),i.type)+(!L&&METAL_TYPES.includes(i.type)?E(id,'metal',metalOptsFor(i.type),i.metal||'silver',i.type==='belt'?'Buckle':''):'')+
    (i.type==='shirt'?E(id,'cuff',CUFFS,i.cuff||'button'):'')+(i.type==='suit'?E(id,'vest',VESTS,hasVest(i)?'yes':'no'):'')+(SEASON_TYPES.includes(i.type)?E(id,'season',SEASONS,i.season||'all'):'')+
    (i.type==='pants'?E(id,'trouserKind',TROUSER_KINDS,trouserKindShown(i)):'')+(i.type==='shoes'?E(id,'shoeStyle',SHOE_STYLES,shoeStyle(i)):'')+(i.type==='blouse'?blouseFields(id,i):'')+(!L&&(i.type==='shoes'||i.type==='belt')?E(id,'leather',leathersFor(i).map(c=>[c,cap1(leatherWord(i,c))]),i.leather||'calf',leatherLabel(i)):'')+
    (i.type==='watch'?`<label class="wdetails">Details <input type="text" maxlength="${WATCH_DETAILS_MAX}" dir="auto" value="${esc(String(i.details||'').slice(0,WATCH_DETAILS_MAX))}" placeholder="e.g. three subdials, 12 and 6 numerals" data-act-change="itemDetails" data-id="${esc(id)}"></label>`+(L?'':E(id,'dial',DIAL_OPTS(watchOpts(i).dial),watchOpts(i).dial))+E(id,'band',BANDS,watchOpts(i).band)+E(id,'bezel',BEZELS,watchOpts(i).bezel)+E(id,'watchStyle',WATCH_STYLES,watchOpts(i).style):'');
  const details=ckSec(scope,'details',{mark:'good',title:'Details',sum:esc(ivDetailSum(i)),body:det+(fab||L?'':gap),cls:'ivtags'});
  const cs=CARE_ABLE.includes(i.type)&&!i.order&&typeof careState==='function'?careState(i):null;
  const rotIn=`${i.paused?(i.order?`<div class="rotnote ordrow"><p class="shelp">On the way: it isn't in your outfits yet.</p><label class="ordate">Arrives (optional) <input type="date" value="${i.arrives||''}" min="${isoKey(todayDate())}" data-act-change="itemArrives" data-id="${esc(id)}"></label><small class="mut ordhint">${orderHint(i.arrives)}</small></div>`:i.away?'<p class="shelp rotnote">Away being cleaned: it is out of your outfits until it is back (see Care below).</p>':'<p class="shelp rotnote">Out of rotation: the planner won\'t pick it, and it isn\'t offered when you change a piece. Outfits you already wore keep it.</p>'):'<p class="shelp">In rotation: the planner picks it for your outfits.</p>'}
  ${typeof favItemRow==='function'?favItemRow(i):''}${i.away?'':`<div class="btns"><button class="rotbtn${i.paused?' on':''}" data-act="itemPause" data-id="${esc(id)}" data-want="${i.paused?0:1}" aria-pressed="${!!i.paused}">${i.paused?(i.order?'It arrived: put in rotation':'Put back in rotation'):'Take out of rotation'}</button></div>`}${typeof careCard==='function'?careCard(i):''}${typeof cpwBlock==='function'?cpwBlock(i):''}`;   // (cost.js: price, day bought, cost per wear)
  const care=ckSec(scope,'care',{mark:cs&&cs.due?'warn':'good',title:'Planning &amp; care',sum:esc(ivCareSum(i,cs)+(typeof cpwSum==='function'?cpwSum(i):'')),body:rotIn,open:!!(cs&&cs.due),cls:'ivrot'});
  const filled=['name','brand','notes'].filter(k=>String(i[k]||'').trim());
  const names=ckSec(scope,'names',{mark:filled.length?'good':'opt',title:'Name &amp; notes',sum:filled.length?esc(cap1(filled.join(', ')))+' filled in'+(filled.length<3?` · no ${['name','brand','notes'].filter(k=>!filled.includes(k)).join(' or ')}`:''):'Name, brand, notes · optional',body:wardFieldsTop(i)+notesRow(i.notes,ivOn(id))});
  const pics=ckSec(scope,'pics',{mark:'opt',title:'Pictures',sum:esc(cap1([i.photo?'photo':'no photo',tex&&i.texture?'close-up':''].filter(Boolean).join(', ')))+' · replace, rotate, crop',body:`<div class="ivhero">${pair}</div>${photoTools(i)}`,cls:'ivpics'});
  const ends=`<div class="ivdup"><button type="button" id="iv-dup" data-act="itemDup" data-id="${esc(id)}">Duplicate this item</button></div><div class="ivdel"><button class="danger" data-act="itemDelete" data-id="${esc(id)}">Delete item</button></div>`;
  const sample=typeof kitSampleNote==='function'?kitSampleNote(i):'';
  return `<div class="ivin ivck"><div class="ivcols"><div class="ivcl">${top}${sample}${look||pics}</div><div class="ivcr">${lkSec}${color}${pattern}${mat}${details}${care}${names}${look?pics:''}</div></div>${ends}</div>`;
}
/* the summary line at the top of the item sheet: the photo (or the drawing), "In rotation" / "Out of rotation" / "On the way", how many
   wears are left before cleaning (or "Due for cleaning"), the material and the season */
const optLab=(list,v)=>{const o=list.find(x=>x[0]===v);return o?cap1(o[1]):''};
function ivSummary(i,pic){const s=CARE_ABLE.includes(i.type)&&!i.order&&typeof careState==='function'?careState(i):null,left=s?s.limit-s.wears:0;
  const rot=i.paused?`<span class="ivpill${i.order?'':' warn'}">${i.order?'On the way':i.away?(i.away.why==='laundry'?'In the laundry':'At the cleaner’s'):'Out of rotation'}</span>`:'<span class="ivpill good">In rotation</span>';
  const care=s&&!i.away&&s.limit>1?(s.due?`<span class="ivpill warn">Due for ${careWord(i.type)}</span>`:`<span class="ivpill">${careWashed(i.type)?'Wash':'Clean'} in ${left} wear${left===1?'':'s'}</span>`):'';
  const meta=[i.material?matLabel(i.material):'',SEASON_TYPES.includes(i.type)&&i.season&&i.season!=='all'?optLab(SEASONS,i.season):''].filter(Boolean).join(' · ');
  const th=pic?`<img class="ivsumph" src="${srcOk(i.photo?phSm(i):pic)}" alt="">`:`<div class="ivsumph">${itemThumb(i)}</div>`;
  return `<div class="ivsum">${th}<div class="ivsumt"><div class="ivpills">${rot}${care}</div>${meta?`<p class="ivmeta">${esc(meta)}</p>`:''}</div></div>`}
/* the Details section's summary: "Suit · Cold weather · matching vest" */
function ivDetailSum(i){const t=i.type,a=[TYPES[t]||'Item'];
  if(SEASON_TYPES.includes(t))a.push(optLab(SEASONS,i.season||'all'));
  if(t==='suit')a.push(hasVest(i)?'matching vest':'no vest');if(t==='shirt')a.push(optLab(CUFFS,i.cuff||'button').toLowerCase());
  if(t==='pants')a.push(optLab(TROUSER_KINDS,trouserKindShown(i)).toLowerCase());if(t==='shoes')a.push(optLab(SHOE_STYLES,shoeStyle(i)).toLowerCase());
  if(METAL_TYPES.includes(t))a.push(optLab(metalOptsFor(t),i.metal||'silver').toLowerCase());
  return a.filter(Boolean).join(' · ')}
/* Planning & care's summary: "In rotation · worn 3 of 5 since cleaning" */
function ivCareSum(i,s){const r=(i.paused?(i.order?'On the way':i.away?'Away being cleaned':'Out of rotation'):'In rotation')+(typeof isFavItem==='function'&&isFavItem(i.id)?' · ♥ favorite':'');
  if(!s||i.away)return r;if(s.due)return `${r} · due for ${careWord(i.type)}`;
  return s.limit>1?`${r} · worn ${s.wears} of ${s.limit} since ${careWord(i.type)}`:s.wears?`${r} · worn ${careTimes(s.wears)}`:`${r} · not worn yet`}
/* the uniform blouse's name tape, service tape and rank (2026-11-18; core.js blouseTapes): text fields in capitals, the rank a list; the
   drawing and the painted picture show them */
const tapeIn=(id,k,lab,ph)=>`<label>${lab} <input type="text" maxlength="${BLOUSE_TAPE_MAX}" autocapitalize="characters" spellcheck="false" value="${esc(tapeText(items.find(x=>x.id===id)&&items.find(x=>x.id===id)[k]))}" placeholder="${ph}" data-act-change="tapeSet" data-id="${esc(id)}" data-k="${k}"></label>`;
function tapeSet(el){sete(el.dataset.id,el.dataset.k,tapeText(el.value)||'none')}   // (act.js: a tape's text field)
const blouseFields=(id,i)=>tapeIn(id,'tapeName','Name tape','e.g. SMITH')+tapeIn(id,'tapeService','Service tape','e.g. U.S. AIR FORCE')+E(id,'rank',OCP_RANKS,i.rank||'none','Rank');
async function sete(id,k,v){
  const it=items.find(x=>x.id===id);if(!it){itemGoneTell(id);return}
  it[k]=v==='none'&&k!=='toeColor'?null:v;   // (a sock's toe cap keeps 'none': a sock with no toeColor at all is from before, core.js sockToe)
  if(k==='shoeStyle'&&!leathersFor(it).includes(it.leather))it.leather='calf';   // a sneaker can't be cordovan: back to plain leather
  if(k==='type'){it.pattern=normPat(v,it.pattern);shirtColFix(it);if(METAL_TYPES.includes(v)&&!it.metal)it.metal='silver';if((v==='shoes'||v==='belt')&&!it.leather)it.leather='calf';typeTidy(it)}
  if(k==='primaryColor')delete it.color;
  if((k==='primaryColor'||k==='type')&&it.swSrc==='tex')await refreshSwatch(it);   // the close-up swatch takes its lightness from the colour
  await put(it);planDirty();renderWardrobe();
}
/* a type change drops what the new type has no field for (2026-11-15, the new-user audit: a raincoat made cufflinks was "· warm weather",
   as socks "Green, white toe · warm weather" in waxed cotton): season, material not in its list, metal, leather, cuffs, vest, kind, style,
   the watch's options, and a second or third colour it can't show; the photos stay */
const TYPE_FIELDS={season:t=>SEASON_TYPES.includes(t),metal:t=>METAL_TYPES.includes(t),leather:t=>t==='shoes'||t==='belt',cuff:t=>t==='shirt',vest:t=>t==='suit',
  trouserKind:t=>t==='pants',shoeStyle:t=>t==='shoes',tapeName:t=>t==='blouse',tapeService:t=>t==='blouse',rank:t=>t==='blouse',dial:t=>t==='watch',band:t=>t==='watch',bezel:t=>t==='watch',watchStyle:t=>t==='watch',details:t=>t==='watch',toeColor:t=>t==='socks'};
/* a material its type can't have goes; a typed "Other" material stays where the type has a list (an own material of another type goes, like a
   listed one). Also the Add card's type change and save (CR-1-06: a jacket read as tweed and changed to a tie was saved "Other · tweed") */
function matTidy(it){const ml=matsFor(it.type);if(it.material&&!(ml&&(ml.includes(it.material)||!Object.keys(MATERIALS_BY).some(x=>matsFor(x).includes(it.material)))))delete it.material;return it}
function typeTidy(it){const t=it.type;for(const [f,ok] of Object.entries(TYPE_FIELDS))if(f in it&&!ok(t))delete it[f];
  matTidy(it);
  if(t==='shoes'&&it.leather&&!leathersFor(it).includes(it.leather))it.leather='calf';
  if(!FABRIC.includes(t))for(const f of ['sett','stripes','patternSpec','weave','patternText','pbox'])delete it[f];
  if(t==='socks'&&it.toeColor===undefined)it.toeColor='none';   // made socks now: a second colour is the pattern's, never read as a toe cap
  return colTidy(it)}
/* (2026-11-16, the owner's camouflage shirt: the sheet wouldn't open, so it couldn't be deleted either: a pattern drawn from a fallback
   (a camouflage with no reading of its own, camoLook; an own pattern's look) has no i.sett, and this described i.sett. It describes what is
   drawn, and a camouflage drawn in its own colors says how to get its real ones) */
function patSummary(i){const u=usableSett(i);
  if(u&&u.camo&&!(i.sett&&i.sett.camo))return 'camouflage drawn in its own colors (Read pattern from photo takes the real colors from the close-up)';
  if(u)return settSummary(u);
  if(i.sett&&i.sett.tex)return `generic (the weave texture read earlier is for a ${TEX_WORDS[i.sett.tex.kind]||'woven'} pattern)`;
  if(i.sett)return `generic (an older reading drew these ${patName(i.pattern).toLowerCase()} figures as stripes; Read pattern from photo reads them as figures)`;
  const st=i.stripes;if(!st)return 'generic';
  if(st.kind==='check')return `check read from photo (${st.b.length}×${st.v.length} bands)`;
  return `stripes read from photo (${st.b.length} bands, ${Math.abs(st.a)}°)`;
}
async function redetect(id){
  const it=items.find(x=>x.id===id);if(!it)return;
  const load=src=>new Promise(r=>{if(!src)return r(null);const im=new Image();im.onload=()=>r(im);im.onerror=()=>r(null);im.src=src});
  let st=null;
  const sw=await load(it.swatch);if(sw)st=detectPattern(it,sw,0,0,sw.width);
  if(!st){const ph=await load(it.photo);if(ph){const mn=Math.min(ph.width,ph.height)*.7;st=detectPattern(it,ph,(ph.width-mn)/2,(ph.height-mn)/2,mn)}}
  if(!st){tell('Could not find a clear repeating pattern in the photo. Adding it again with the fabric in the middle of the picture usually works.');return}
  it.stripes=st;await put(it);planDirty();renderWardrobe();
}
/* take an item out of rotation, or put it back. Taking it out also lets go of the upcoming days it was pinned to (a swap or a
   hand pick), so those days are planned again without it; past days and days marked worn keep it. */
async function setItemArrives(id,v){const it=items.find(x=>x.id===id);if(!it)return;const a=arriveVal(v);
  if(a==='past'){renderWardrobe();toast(ARRIVE_PAST,4500);return}   // (the date it had stays)
  if(a)it.arrives=a;else delete it.arrives;await put(it);planDirty();
  if(await checkArrivals())return renderWardrobe();renderWardrobe()}
/* want: what the button said when it was drawn (true = "Take out of rotation"): a sheet drawn before another phone's change arrived does
   what it says, never the opposite (fix round 3, W1-5-04); nothing to do when the piece is already that way */
async function togglePause(id,want){const it=items.find(x=>x.id===id);if(!it){itemGoneTell(id);return}
  if(typeof want==='boolean'&&!!it.paused===want){renderWardrobe();toast(want?'It was already taken out of rotation on another phone.':'It was already back in rotation.');return}
  it.paused=!it.paused;if(!it.paused){delete it.paused;delete it.order;delete it.arrives}
  let n=0;if(it.paused){const T=todayDate();
    for(const r of Object.values(dayRecs)){const d=keyDate(r.date);if(d<T||r.worn===true||!r.force)continue;const f={...r.force};let hit=false;
      for(const [s,v] of Object.entries(f))if(v===id){delete f[s];hit=true}
      if(hit){const nr={...r,force:f};if(!Object.keys(f).length)delete nr.force;delete nr.ids;await saveDay(nr,true);n++}}}
  // out of rotation doesn't make a sample piece his (kit.js kitNoMine; put reads it at once)
  const kn=typeof kitNoMine!=='undefined';if(kn)kitNoMine=true;const pw=put(it);if(kn)kitNoMine=false;await pw;planDirty();renderWardrobe();
  toast(it.paused?`Out of rotation: the planner won't pick it${n?`, and ${n} upcoming day${n===1?' was':'s were'} planned again without it`:''}.`:'Back in rotation.')}
async function clearStripes(id){const it=items.find(x=>x.id===id);if(!it)return;delete it.stripes;delete it.sett;await put(it);planDirty();renderWardrobe()}
async function rm(id){return wardDelete(id)}   // at once, with Undo in a toast (wardrobe.js)


/* swiping the Wardrobe moves between the type filters (All, Suit, Blazer, …) in chip order, skipping types with no items;
   only the grid slides. Not while an item is open (its editor has sliders and the photo crop), nor on the chips row itself. */
function setFlt(t){flt=t}   // the Wardrobe's type filter (app.js flt): the one place it is set here
const wardTypes=()=>['all',...Object.keys(TYPES).filter(t=>items.some(i=>i.type===t))];
function stepType(n,from){
  const l=wardTypes();let k=l.indexOf(flt);if(k<0)k=0;const j=k+n;if(j<0||j>=l.length)return false;
  setFlt(l[j]);renderWardrobe();const sl=$('#wslide');if(!sl)return true;
  const x=from===undefined?(n>0?1:-1)*Math.min(innerWidth*.35,140):from;if(!x)return true;
  sl.style.transition='none';sl.style.transform=`translateX(${x}px)`;sl.style.opacity='0';void sl.offsetWidth;
  sl.style.transition='transform .24s cubic-bezier(.2,.8,.2,1),opacity .2s ease-out';sl.style.transform='translateX(0)';sl.style.opacity='1';return true}
(()=>{const el=$('#wardrobe');let st=null;const slide=()=>$('#wslide');
  el.addEventListener('touchstart',e=>{const t=e.touches[0];
    st=e.touches.length>1||editing||t.clientX<24||t.clientX>innerWidth-24||e.target.closest('.chips,input,select,textarea,.cropwrap')?null:{x:t.clientX,y:t.clientY,t:Date.now(),lock:null,dx:0}},{passive:true});
  el.addEventListener('touchmove',e=>{
    if(!st)return;const t=e.touches[0],dx=t.clientX-st.x,dy=t.clientY-st.y;
    if(!st.lock&&(Math.abs(dx)>8||Math.abs(dy)>8))st.lock=Math.abs(dx)>Math.abs(dy)*1.2?'x':'y';
    if(st.lock!=='x')return;e.preventDefault();
    const l=wardTypes(),k=l.indexOf(flt),edge=(dx>0&&k<=0)||(dx<0&&k>=l.length-1);   // nothing further that way: resist
    st.dx=dx;const sl=slide();if(sl){const v=edge?dx/4:dx;sl.style.transition='none';sl.style.transform=`translateX(${v}px)`;sl.style.opacity=String(1-Math.min(.5,Math.abs(v)/innerWidth))}
  },{passive:false});
  const end=()=>{
    if(!st)return;const {lock,dx,t}=st;st=null;const sl=slide();if(lock!=='x'||!sl)return;
    const fast=Math.abs(dx)/Math.max(1,Date.now()-t)>.5,n=dx<0?1:-1,l=wardTypes(),k=l.indexOf(flt),j=(k<0?0:k)+n;
    if((Math.abs(dx)>70||(fast&&Math.abs(dx)>30))&&j>=0&&j<l.length){const w=sl.offsetWidth||innerWidth;
      sl.style.transition='transform .16s ease-in,opacity .16s';sl.style.transform=`translateX(${dx<0?-w:w}px)`;sl.style.opacity='0';
      setTimeout(()=>stepType(n,(dx<0?1:-1)*w*.6),160);
    }else{sl.style.transition='transform .2s ease-out,opacity .2s';sl.style.transform='translateX(0)';sl.style.opacity='1'}};
  el.addEventListener('touchend',end,{passive:true});el.addEventListener('touchcancel',end,{passive:true});
  document.addEventListener('keydown',e=>{if(el.hidden||editing||e.target.closest('input,select,textarea'))return;if(e.key==='ArrowRight')stepType(1);if(e.key==='ArrowLeft')stepType(-1)});
})();
/* in the Wardrobe, shoes, belts and socks show their realistic product picture when there is one */
const WARD_PIC_TYPES=['shoes','belt','socks'];
const wardPic=i=>{if(!WARD_PIC_TYPES.includes(i.type))return null;const p=itemPic(i);if(p)return p.img;setTimeout(()=>fetchItemPic(i),0);return null};
function renderWardrobe(){
  closeSettings();if(editing!==phEdit.id)phEdit={id:null,undo:[],crop:null};   // undo lasts while the item stays open
  const wf=wardKeep();
  const cnt=t=>t==='all'?items.length:items.filter(i=>i.type===t).length;
  // (2026-11-16) a casual type's chip shows once one is owned (or its chip is the one chosen)
  const ft=wardFlt(),chips=['all',...Object.keys(TYPES).filter(t=>!HANDPICK_TYPES.includes(t)||ft===t||items.some(i=>i.type===t))].map(t=>`<button class="chip ${ft===t?'on':''}" aria-pressed="${ft===t}" data-act="wardChip" data-t="${t}">${t==='all'?'All':TYPES[t]} ${cnt(t)}</button>`+(t==='all'&&typeof favChip==='function'?favChip():'')).join('');   // (the ♥ Favorites chip after All, once a piece is a favorite: fav.js)
  const list=wardFresh();
  keepFocus($('#wardrobe'),()=>{$('#wardrobe').innerHTML=`<h2 class="vh">Wardrobe</h2><span class="vh" id="wcount" role="status">${wardCount(list)}</span>${items.length?wardBar()+`<div class="chips">${chips}</div>`:''}<div class="wslide" id="wslide">`+wardGrid(list)+'</div>'});   // (the chip or field pressed keeps the focus: W2-19-01)
  const on=document.querySelector('#wardrobe .chip.on');if(on){const c=on.parentElement;c.scrollLeft=Math.max(0,on.offsetLeft-c.offsetLeft-(c.clientWidth-on.offsetWidth)/2)}
  renderItem();wardBack(wf);
}
/* what the item page's and the Wardrobe's controls do (act.js; the item by its id in data-id) */
function itemPick(el){sete(el.dataset.id,el.dataset.f,el.value)}
function itemDetails(el){sete(el.dataset.id,'details',el.value.trim().slice(0,WATCH_DETAILS_MAX)||'none')}
function itemReadPat(el){if(el.dataset.how==='reread')rereadSett(el.dataset.id);else redetect(el.dataset.id)}
function itemGeneric(el){clearStripes(el.dataset.id)}
function itemArrives(el){setItemArrives(el.dataset.id,el.value)}
function itemPause(el){togglePause(el.dataset.id,el.dataset.want==='1')}
function itemDup(el){wardDuplicate(el.dataset.id)}
function itemDelete(el){rm(el.dataset.id)}
function wardChip(el){setFlt(el.dataset.t);favOff();renderWardrobe()}
acts({itemPick,itemDetails,itemReadPat,itemGeneric,itemArrives,itemPause,itemDup,itemDelete,wardChip,tapeSet});   // (tapeSet: the uniform blouse's tapes)
