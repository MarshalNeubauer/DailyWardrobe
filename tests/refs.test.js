// The worker takes 8 reference photos. With the pattern drawings an outfit can have more; the least needed go first and an item's
// own photo is never dropped. A tie with a close-up is sent without its photo, and the shirt's close-up goes in its place.
// The watch (tested with the owner's Seiko, 2026-11-12): from references at the end of the list, words and a drawn three-hand watch the
// generator drew a stock chronograph. Now the watch and its dial's enlargement go FIRST, as two references, turned as worn; the
// enlargement is never trimmed; the drawing the generator edits carries the watch's own dial (figureSvg photo:true, figurePng).
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  try{
    const p=await browser.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=c.height=64;{const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,64,64);g.fillStyle='#000';g.fillRect(0,0,9,9)}const im=c.toDataURL('image/jpeg',.5);
      const band={v:2,a:0,bands:[['#1f2a44',.9],['#ffffff',.1]],cross:null,cr:4,tr:30,src:'claude+pixels'};
      const o={suitDay:false,top:{id:'b',type:'blazer',primaryColor:'navy',pattern:'pinstripe',secondaryColor:'white',photo:im,texture:im,sett:band},bot:{id:'p',type:'pants',primaryColor:'grey',pattern:'solid'},
        shirt:{id:'s',type:'shirt',primaryColor:'white',pattern:'woven',texture:im,sett:{v:4,tex:{kind:'diamond',grid:['10','01'],lighter:true,contrast:'subtle',rel:.1},a:0,cr:20,tr:45}},
        tie:{id:'t',type:'tie',primaryColor:'navy',pattern:'stripe',secondaryColor:'pink',photo:im,texture:im,sett:{...band,a:-45}},
        watch:{id:'w',type:'watch',primaryColor:'silver',metal:'silver',photo:im},clip:null,vest:false};
      const all=outfitRefs(o).labels.length+4,{refs,labels}=await outfitRefsFull(o);
      const po={suitDay:true,top:{id:'s2',type:'suit',primaryColor:'grey',pattern:'solid',photo:im},shirt:{id:'s3',type:'shirt',primaryColor:'white',pattern:'solid'},tie:{id:'t2',type:'tie',primaryColor:'burgundy',pattern:'solid',photo:im},watch:{id:'w',type:'watch',primaryColor:'silver',metal:'silver',dial:'white',watchStyle:'chronograph',photo:im}};
      const plain=await outfitRefsFull(po);
      const size=u=>new Promise(k=>{const i=new Image();i.onload=()=>k(i.width+'x'+i.height);i.src=u});
      // the test photo has a black corner at the top left: turned half a turn it is at the bottom right
      const dark=async(u,x,y)=>{const i=new Image();await new Promise(k=>{i.onload=k;i.src=u});const cv=document.createElement('canvas');cv.width=i.width;cv.height=i.height;const g=cv.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,cv.width,cv.height);g.drawImage(i,0,0);return g.getImageData(x,y,1,1).data[0]<90};
      const w=plain.refs[0];
      // the owner's own photo of the watch goes, not its product picture (a redrawing whose dial details are lost)
      const wi={id:'w9',type:'watch',primaryColor:'silver',metal:'silver',photo:im};const pic=c.toDataURL('image/png');renders[itemKey(wi)]={img:pic};
      const own=outfitRefs({suitDay:true,top:null,shirt:null,tie:null,watch:wi}).refs[0]===im;
      const fall=outfitRefs({suitDay:true,top:null,shirt:null,tie:null,watch:{...wi,photo:null}}).refs[0]===pic;delete renders[itemKey(wi)];
      // what the worker keeps of a label (worker.js handleRender): it must arrive whole
      const cut=l=>String(l).replace(/[^\w ,.:()'-]/g,'').slice(0,160);
      // the drawing for the generator: the watch's face is its own dial; Today's drawing keeps its drawn hands
      const svgP=figureSvg(po,'q-',{photo:true,face:im}),svgT=figureSvg(po,'q2-');
      const png=await figurePng(po);
      // the watch's words: no stock "three subdials" with the owner's details, and they are said to describe it upright
      const wd={...po.watch,details:'time on a large subdial at 6'};
      return {all,n:refs.length,labels,plain:plain.labels,dial:await size(plain.refs[1]),own,fall,whole:[WATCH_WORN,WATCH_DIAL].every(l=>cut(l)===l),
        turned:await dark(w,61,61)&&!(await dark(w,3,3))&&await dark(im,3,3),
        face:svgP.includes(`href="${im}"`)&&!/M 0 0 L 0 -7/.test(svgP),today:!svgT.includes('<image')&&/M 0 0 L 0 -7/.test(svgT),png:/^data:image\/png/.test(png),
        words:watchText(po.watch).includes('three subdials')&&!watchText(wd).includes('three subdials')&&/described upright.*time on a large subdial/.test(watchText(wd,{worn:true}))&&!/upright/.test(watchText(wd))}});
    ok(r.all===9&&r.n===8,`a full outfit has ${r.all} references; 8 go to the generator`);
    ok(r.labels[0]===WATCH_WORN_TEXT&&r.labels[1]===WATCH_DIAL_TEXT,'the watch and its dial enlarged go first, right after the illustration');
    ok(r.labels.includes('the blazer')&&!r.labels.some(l=>/^a close-up of the shirt/.test(l)),'in a full outfit the one reference over is the shirt\'s close-up: the watch, its dial and the jacket photo are kept');
    ok(!r.labels.includes('the tie')&&r.labels.some(l=>/^a close-up of the tie/.test(l)),'a tie with a close-up is sent without its photo');
    ok(r.labels.some(l=>/^a drawing of the shirt/.test(l))&&r.labels.some(l=>/^a drawing of the tie/.test(l))&&r.labels.some(l=>/^a drawing of the blazer/.test(l)),'the shirt\'s texture drawing and the tie and blazer drawings are sent');
    {const L=r.labels,i=re=>L.findIndex(l=>re.test(l));
      ok(i(/^a drawing of the tie/)+1===i(/^a close-up of the tie/)&&i(/^a drawing of the blazer/)===L.indexOf('the blazer')+1,
        `a drawing sits right after its item's photo; the tie's, with no photo sent, right before its close-up (${L.map(l=>l.slice(0,24)).join(' | ')})`);}
    ok(r.plain.join('|')===[WATCH_WORN_TEXT,WATCH_DIAL_TEXT,'the suit','the tie'].join('|')&&r.dial==='640x640'&&r.turned,`with room, the watch and its 640px dial enlargement go first, both turned half a turn as the watch sits on the wrist (${r.dial})`);
    ok(r.whole,'the watch labels reach the generator whole (the worker keeps 160 characters of a label)');
    ok(r.own&&r.fall,'the watch reference is the owner\'s own photo, its product picture only when there is no photo');
    ok(r.face&&r.today&&r.png,'the drawing the generator edits has the watch\'s own dial as its face (no drawn hands); Today\'s drawing keeps its drawn hands');
    ok(r.words,'with the owner\'s details the stock "three subdials" wording is left out, and in the outfit photo the details are said to describe the watch upright');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
const WATCH_WORN_TEXT="the wristwatch, turned as worn: crown toward the hand, the whole dial turned with it, 6 o'clock at the top (copy case, bezel, dial, bracelet exactly)";
const WATCH_DIAL_TEXT="an enlargement of the same wristwatch's dial, turned the same way: copy its subdials, their places and sizes, the hands and the markings exactly";
