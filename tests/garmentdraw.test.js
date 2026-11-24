// The garment drawings.
// Joined by feature from 2 files (Round B, 2026-11-17: the code review's CR-10-14); each part below is one old file, its checks unchanged.
const {execSync}=require('child_process');

/* ---- was tests/garmentdraw.test.js ---- */
// The casual garments' drawings (2026-11-16, the owner's approved new types): each type laid flat (draw.js casualMarks, CASUAL_D) with
// its own details, their stripe / heather / cable cloth (casualTile) in the drawing and the 16 px swatch, cargo pants' thigh pockets
// (cargoPockets), and the existing types' drawings byte for byte as on origin/main.
const garmentdraw=async({ok,chromium,url,ROOT})=>{
  // (main's draw.js is a module since C3: its export line blanked, as the vm tests read a module: tests/appsrc.js)
  let old='';try{old=require('./appsrc').asScript(execSync('git show origin/main:draw.js',{cwd:ROOT,encoding:'utf8',maxBuffer:64e6}))}catch(e){}
  const browser=await chromium.launch();const p=await browser.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(()=>{const I=(type,x)=>({id:'g-'+type,type,primaryColor:'navy',pattern:'solid',...x}),T=['tee','polo','henley','sweater','sweatshirt','hoodie','qzip','cardigan','chore'];
      const th={};for(const t of T)th[t]=itemThumb(I(t));
      const pat=t=>['solid','stripe','heather','cable'].filter(p=>(PATS_BY[t]||[]).includes(p)).map(p=>fabricDef('x',I(t,{pattern:p,secondaryColor:'white'}),'shirt'));
      const sw=swatchSVG(I('tee',{pattern:'stripe',secondaryColor:'white'}),true),swPlain=swatchSVG(I('tee'),true);
      const cargo=itemThumb({id:'c',type:'pants',primaryColor:'olive',pattern:'solid',trouserKind:'cargo'}),chinos=itemThumb({id:'d',type:'pants',primaryColor:'olive',pattern:'solid',trouserKind:'chinos'});
      const dark=itemThumb(I('tee',{primaryColor:'black'}));
      return {th,pats:{tee:pat('tee'),sweater:pat('sweater')},sw,swPlain,cargo,chinos,dark,
        fig:fabricDef('f',I('sweater',{pattern:'cable'}),'shirt','fig'),boot:itemThumb({id:'b',type:'shoes',primaryColor:'brown',shoeStyle:'boot',leather:'suede'}),sneaker:itemThumb({id:'s',type:'shoes',primaryColor:'white',secondaryColor:'white',shoeStyle:'sneaker'})}});
    for(const [t,h] of Object.entries(r.th))ok(/<svg[^>]*aria-label="[^"]+"/.test(h)&&h.includes('url(#th')&&/<path d="M39,12 C44,14\.5/.test(h),`a ${t} is drawn: its outline in its cloth with the shading`);
    const n=(h,re)=>(h.match(re)||[]).length;
    ok(n(r.th.polo,/<circle /g)===2&&/L39\.4,11 C37/.test(r.th.polo),'a polo has its knit collar and a two-button placket');
    ok(n(r.th.henley,/<circle /g)===3&&!/L39\.4,11/.test(r.th.henley),'a henley has a three-button placket and no collar');
    ok(/C30\.6,8\.6/.test(r.th.hoodie)&&/#ece8df/.test(r.th.hoodie)&&/L37\.4,57\.4/.test(r.th.hoodie),'a hoodie has its hood, drawstrings and kangaroo pocket');
    ok(/#c3c6cb/.test(r.th.qzip)&&/L38,5\.4/.test(r.th.qzip),'a quarter-zip has its stand collar and zip pull');
    ok(n(r.th.cardigan,/<circle /g)===5&&/L50,46 Z/.test(r.th.cardigan),'a cardigan has its V front and five buttons');
    ok(n(r.th.chore,/<circle /g)>=5&&/M56\.6,31 L67,31/.test(r.th.chore)&&/M56\.4,56\.6/.test(r.th.chore),'a chore jacket has its buttons and three patch pockets');
    ok(/L46\.8,21\.6|M46\.8,21\.6/.test(r.th.sweatshirt)&&/stroke-dasharray=".3 .75"/.test(r.th.sweatshirt),'a sweatshirt has its V insert and ribbed hem');
    ok(/stroke-dasharray=".3 .75"/.test(r.th.sweater)&&!/stroke-dasharray=".3 .75"/.test(r.th.tee),'a sweater is ribbed at the neck, cuffs and hem; a T-shirt is not');
    ok(new Set(Object.values(r.th).map(h=>h.replace(/th\d+-/g,''))).size===9,'the nine types draw nine different pictures');
    ok(new Set(r.pats.tee).size===r.pats.tee.length&&new Set(r.pats.sweater).size===r.pats.sweater.length,'solid, stripe, heather and cable draw differently');
    ok(/<rect y="4\.2"[^>]*fill="#f6f6f3"/.test(r.pats.tee[1]),'a striped T-shirt has Breton stripes across in its second color');
    ok(/patternTransform="scale\(0?\.55\)"/.test(r.sw)&&/<rect y="4\.2"/.test(r.sw)&&r.sw.replace(/sw\d+-/g,'')!==r.swPlain.replace(/sw\d+-/g,''),'the 16 px swatch of a striped T-shirt shows its stripes');
    ok(/l\.8,\.9/.test(r.pats.sweater[0])&&!/l\.8,\.9/.test(r.pats.tee[0]),'a plain sweater shows a faint knit; a plain T-shirt is plain jersey');
    ok(/C2\.2,1\.8 5\.8,2\.2/.test(r.fig),'a cable sweater on the figure has its cables');
    ok(n(r.cargo,/class="cargo-pocket"/g)===2&&!/cargo-pocket/.test(r.chinos),'cargo pants have two thigh pockets with flaps; chinos have none');
    ok(r.cargo.includes('tw)')&&r.chinos.includes('tw)'),'cargo pants keep the chinos twill under the pockets');
    ok(/stroke="#([0-9a-f]{6})"/.test(r.dark)&&parseInt(r.dark.match(/stroke="#([0-9a-f]{2})/)[1],16)>0x30,'a black T-shirt draws with lines lighter than its cloth');
    ok(r.boot.includes('<svg')&&r.sneaker.includes('<svg'),'boots and sneakers already draw (shoe styles boot and sneaker)');
    // the existing types' drawings are unchanged (origin/main's draw.js evaluated in a scope of its own)
    // (its bridge goes to a stand-in globalThis, so the page's own draw.js names stay as they are)
    if(old){const same=await p.evaluate(src=>{const O=new Function('globalThis',src+'\n;return {itemThumb,swatchSVG}')({});
        const L=[{id:'a',type:'shirt',primaryColor:'lightblue',pattern:'solid'},{id:'b',type:'shirt',primaryColor:'white',secondaryColor:'navy',pattern:'stripe'},{id:'c',type:'blazer',primaryColor:'navy',pattern:'solid'},
          {id:'d',type:'suit',primaryColor:'charcoal',pattern:'pinstripe'},{id:'e',type:'pants',primaryColor:'grey',pattern:'solid'},{id:'f',type:'pants',primaryColor:'stone',pattern:'solid',trouserKind:'chinos'},
          {id:'g',type:'pants',primaryColor:'denim',pattern:'solid',trouserKind:'jeans'},{id:'h',type:'tie',primaryColor:'burgundy',secondaryColor:'navy',pattern:'stripe'},{id:'i',type:'shoes',primaryColor:'brown',shoeStyle:'loafer'},
          {id:'j',type:'overcoat',primaryColor:'charcoal'},{id:'k',type:'watch',primaryColor:'black',band:'leather'}];
        const z=s=>s.replace(/(th|sw)\d+-/g,'$1-');const bad=[];
        for(const it of L){if(z(O.itemThumb(it))!==z(itemThumb(it)))bad.push(it.id+' thumb');if(z(O.itemThumb(it,true))!==z(itemThumb(it,true)))bad.push(it.id+' full');if(z(O.swatchSVG(it,true))!==z(swatchSVG(it,true)))bad.push(it.id+' swatch')}
        return bad},old);
      ok(!same.length,'the existing types draw exactly as on origin/main (shirts, blazer, suit, dress pants, chinos, jeans, tie, shoes, coat, watch)'+(same.length?': '+same.join(', '):''))}
    else ok(true,'(origin/main not available: the old drawings were not compared)');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};

/* ---- was tests/raincoat.test.js ---- */
// A raincoat without a photo is drawn on its model, traced from Brooks Brothers' photo of their black water-resistant
// raincoat (RAIN_D, rainMarks): the coat takes the item's colour and cloth, the model's skin, hair, shirt and trousers keep
// their tones, the face's eyes are drawn by figEyes, and an overcoat keeps its own traced drawing (COAT_D).
const raincoat=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  try{
    const p=await browser.newPage({viewport:{width:390,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(()=>{const it=c=>({id:'r'+c,type:'raincoat',primaryColor:c,pattern:'solid'});
      const blk=itemThumb(it('black')),tan=itemThumb(it('tan')),oc=itemThumb({id:'o1',type:'overcoat',primaryColor:'charcoal',pattern:'solid'});
      const nums=Object.values(RAIN_D).join(' ').match(/-?[\d.]+/g).map(Number);
      const ids=[...blk.matchAll(/ id="([^"]+)"/g)].map(m=>m[1]);
      const host=document.createElement('div');host.innerHTML=blk;document.body.appendChild(host);const bb=host.querySelector('svg').getBBox();host.remove();
      return {coat:blk.includes(RAIN_D.coat)&&blk.includes(RAIN_D.head)&&blk.includes(RAIN_D.shirt)&&blk.includes(RAIN_D.hbL),
        cloth:[blk,tan].every(s=>s.includes(`<path d="${RAIN_D.coat}" fill="url(#`))&&blk.replace(/th\d+-/g,'')!==tan.replace(/th\d+-/g,''),
        fixed:blk.includes('#a86a48')&&tan.includes('#a86a48')&&blk.includes('#7f9aae')&&tan.includes('#7f9aae'),
        eyes:/<clipPath id="th\d+-ey0">/.test(blk)&&/<clipPath id="th\d+-ey1">/.test(blk),
        inBox:nums.every(v=>v>=-1&&v<=101),unique:new Set(ids).size===ids.length,
        overcoat:oc.includes(COAT_D.coat)&&!oc.includes(RAIN_D.coat),bb:[bb.x,bb.y,bb.width,bb.height]}});
    ok(r.coat,'a raincoat is drawn as the traced coat on its model (coat, head, shirt, herringbone facing)');
    ok(r.cloth,'the coat takes the item\'s cloth and colour');
    ok(r.fixed,'skin and shirt keep their tones whatever the coat\'s colour');
    ok(r.eyes,'the face\'s eyes are drawn by figEyes (each iris clipped to its opening)');
    ok(r.inBox&&r.bb[1]>=-.5&&r.bb[1]+r.bb[3]<=100.5&&r.bb[0]>=20&&r.bb[0]+r.bb[2]<=80,`the drawing fits the thumbnail's box (${r.bb.map(v=>v.toFixed(1))})`);
    ok(r.unique,'its defs ids are unique in one thumbnail');
    ok(r.overcoat,'an overcoat keeps its own traced drawing');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};

// the parts run one after another; one that throws is reported and the rest still run (each was its own file)
module.exports=async t=>{for(const [name,part] of [['garmentdraw',garmentdraw],['raincoat',raincoat]]){try{await part(t)}catch(e){t.ok(false,`threw (${name}): ${e.message}`)}}};
