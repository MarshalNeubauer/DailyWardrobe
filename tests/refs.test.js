// The worker takes 8 reference photos. With the pattern drawings an outfit can have more; the least needed go first and an item's
// own photo is never dropped. Cutting the list at 8 dropped the watch (it comes last), and the generator drew a generic one.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  try{
    const p=await browser.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=c.height=64;c.getContext('2d').fillRect(0,0,9,9);const im=c.toDataURL('image/jpeg',.5);
      const band={v:2,a:0,bands:[['#1f2a44',.9],['#ffffff',.1]],cross:null,cr:4,tr:30,src:'claude+pixels'};
      const o={suitDay:false,top:{id:'b',type:'blazer',primaryColor:'navy',pattern:'pinstripe',secondaryColor:'white',photo:im,texture:im,sett:band},bot:{id:'p',type:'pants',primaryColor:'grey',pattern:'solid'},
        shirt:{id:'s',type:'shirt',primaryColor:'white',pattern:'woven',texture:im,sett:{v:4,tex:{kind:'diamond',grid:['10','01'],lighter:true,contrast:'subtle',rel:.1},a:0,cr:20,tr:45}},
        tie:{id:'t',type:'tie',primaryColor:'navy',pattern:'stripe',secondaryColor:'pink',photo:im,texture:im,sett:{...band,a:-45}},
        watch:{id:'w',type:'watch',primaryColor:'silver',metal:'silver',photo:im},clip:null,vest:false};
      const all=outfitRefs(o).labels.length+4,{refs,labels}=await outfitRefsFull(o);
      const plain=await outfitRefsFull({suitDay:true,top:{id:'s2',type:'suit',primaryColor:'grey',pattern:'solid',photo:im},shirt:{id:'s3',type:'shirt',primaryColor:'white',pattern:'solid'},tie:{id:'t2',type:'tie',primaryColor:'burgundy',pattern:'solid',photo:im},watch:{id:'w',type:'watch',primaryColor:'silver',metal:'silver',dial:'white',watchStyle:'chronograph',photo:im}});
      const size=u=>new Promise(k=>{const i=new Image();i.onload=()=>k(i.width+'x'+i.height);i.src=u});
      return {all,n:refs.length,labels,plain:plain.labels,dial:await size(plain.refs[plain.refs.length-1])}});
    ok(r.all>8&&r.n===8,`a full outfit has ${r.all} references; 8 go to the generator`);
    ok(r.labels.some(l=>/^the wristwatch/.test(l))&&['the blazer','the tie'].every(x=>r.labels.includes(x)),'the watch photo and every item photo are kept');
    ok(!r.labels.some(l=>/^a close-up of the shirt/.test(l))&&r.labels.some(l=>/^a drawing of the shirt/.test(l))&&r.labels.some(l=>/^a drawing of the tie/.test(l))&&r.labels.some(l=>/^a drawing of the blazer/.test(l)),'the shirt\'s close-up goes first; its texture drawing and the tie and blazer drawings stay');
    ok(!r.labels.some(l=>/^an enlargement/.test(l)),'in a full outfit the watch dial\'s enlargement gives way to the pattern drawings');
    ok(r.plain.join('|')==="the suit|the tie|the wristwatch (copy it exactly: case shape, bezel, dial layout and subdials, numerals, hands, bracelet links)|an enlargement of the same wristwatch's dial (a white dial with its subdials: copy its layout, hands and markings)"&&r.dial==='640x640',`with room, the watch's dial is sent enlarged after its photo (${r.dial})`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
