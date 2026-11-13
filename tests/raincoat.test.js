// A raincoat without a photo is drawn on its model, traced from Brooks Brothers' photo of their black water-resistant
// raincoat (RAIN_D, rainMarks): the coat takes the item's colour and cloth, the model's skin, hair, shirt and trousers keep
// their tones, the face's eyes are drawn by figEyes, and an overcoat keeps its own traced drawing (COAT_D).
module.exports=async({ok,chromium,url})=>{
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
