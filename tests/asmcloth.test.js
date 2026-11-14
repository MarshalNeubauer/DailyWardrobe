// The cloths and the jacket's geometry that the colour-coded painter (asm-color.js) takes from assemble.js: a figured shirt's tile rule
// (asmWeave), a striped tie's count from its close-up (asmStripeCount, asmTieFor), a jacket read in bands (asmSuitTex: Claude's colours,
// bold lines, linen, a herringbone ground under a pinstripe), and the sleeves and lapels (asmSleeveSegs, asmTubeAt, asmTubePart).
// (Until 2026-11-14 this was asm2048.test.js, which also tested the earlier assembler's painters at 2048.)
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  try{
    const p=await browser.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    ok(await p.evaluate(()=>ASM_SIZE===2048&&ASM_VER===3),'phones paint at 2048, and the keys carry ASM_VER 3');
    // a figured shirt (a motif reading) is painted in colour, its repeat two cells from the close-up
    const mf=await p.evaluate(()=>{const i={id:'mf',type:'shirt',primaryColor:'white',secondaryColor:'grey',pattern:'dobby',
        sett:{v:3,motif:{grid:'straight',ground:'#c9c9d4',groundName:'white',figs:[{shape:'square',place:'cell',size:.5,cols:['#716f7b'],names:['grey']}],aspect:1},a:0,cr:10,tr:80,src:'claude+pixels'}};
      const wv=asmWeave(i);return {f:wv&&wv.f,mm:wv&&wv.mm,motif:asmMotif(i)}});
    ok(mf.motif&&mf.f==='col'&&mf.mm===16,`a figured shirt is drawn in colour, its repeat two cells from the close-up (${mf.mm} mm)`);
    // a striped tie: the close-up's count wins over a reading that is half the truth
    const tp=await p.evaluate(async()=>{const cl=document.createElement('canvas');cl.width=cl.height=220;const g=cl.getContext('2d');g.fillStyle='#16151d';g.fillRect(0,0,220,220);g.strokeStyle='#e090a0';g.lineWidth=6;
      for(let t=-440;t<440;t+=40*Math.SQRT2){g.beginPath();g.moveTo(t,0);g.lineTo(t+220,220);g.stroke()}const close=cl.toDataURL('image/png');   // stripes 40px apart: 5.5 across
      const n=asmStripeCount(await asmData(close));
      const tie={id:'st',type:'tie',primaryColor:'navy',secondaryColor:'pink',pattern:'stripe',texture:close,sett:{v:2,a:-45,bands:[['#16151d',.85],['#e090a0',.15]],cross:null,cr:2.75,tr:1.8,src:'claude+pixels'}};
      const T=await asmTieFor(tie),P=await asmTieFor({id:'pl',type:'tie',primaryColor:'burgundy',pattern:'solid'});return {n:+n.toFixed(2),across:T.across,tile:!!T.c,plain:!P.c&&P.hex===colOf({type:'tie',primaryColor:'burgundy'})}});
    ok(Math.abs(tp.n-5.5)<.6&&Math.abs(tp.across-3.6)<.4&&tp.tile,`the close-up's stripes are counted (${tp.n} across it, 5.5 drawn), and a reading that counted half as many is corrected (${tp.across} across the blade, read 1.8)`);
    ok(tp.plain,'a tie with no reading is its tagged colour, with no tile');
    // a patterned jacket read in bands (the owner's khaki windowpane): Claude's colours, no line under ASM_LINE_PX, the sleeves split into
    // an upper arm and a forearm each along its own axis, a linen texture when the cloth is linen
    const pj=await p.evaluate(async()=>{const spec={across:{bands:[{role:'ground',hex:'#cbb38e',w:.905},{role:'line',hex:'#eeeadf',w:.02},{role:'ground',hex:'#cbb38e',w:.015},{role:'line',hex:'#8eb2d6',w:.025},{role:'ground',hex:'#cbb38e',w:.015},{role:'line',hex:'#eeeadf',w:.02}]},
        along:{bands:[{role:'ground',hex:'#cbb38e',w:.905},{role:'line',hex:'#eeeadf',w:.02},{role:'ground',hex:'#cbb38e',w:.015},{role:'line',hex:'#8eb2d6',w:.025},{role:'ground',hex:'#cbb38e',w:.015},{role:'line',hex:'#eeeadf',w:.02}]},description:'a slubby linen-blend ground'};
      const bands=spec.across.bands.map(b=>[b.role==='ground'?'#baa98e':b.hex==='#eeeadf'?'#e0d9c9':'#97b0c5',b.w]),wp={id:'wp',type:'blazer',primaryColor:'khaki',pattern:'windowpane',patternSpec:spec,
        sett:{v:2,a:0,bands,cross:{d:90,bands:bands.map((b,k)=>[k===0||k===2||k===4?null:b[0],b[1]]),r:1.05},cr:3.8,tr:11,src:'claude+pixels'}};
      const T=await asmSuitTex(wp),px=T.mm*ASM_PX_MM,L=ASM_LIN,lin=h=>hexRgb(h).map(v=>L[v]);
      const blue=lin('#eeeadf')/* the off-white line */,row=Math.floor(T.TH*.4);let run=0,best=0;for(let x=0;x<T.TW;x++){const j=3*(row*T.TW+x),d=Math.hypot(T.c[j]-blue[0],T.c[j+1]-blue[1],T.c[j+2]-blue[2]);run=d<.05?run+1:0;best=Math.max(best,run)}
      // an L-shaped sleeve: an upright upper arm, a level forearm
      const W=512,N=W*W,m=new Uint8Array(N);for(let k=0;k<N;k++){const x=k%W,y=(k/W)|0;if((x>=60&&x<140&&y>=40&&y<300)||(x>=60&&x<420&&y>=300&&y<380))m[k]=1}
      const sg=asmSleeveSegs([m],W,N);
      // a lapel: one narrow strip leaning 20° from upright, as wide as the local window: one part, along its length
      const lp=new Uint8Array(N);for(let k=0;k<N;k++){const x=k%W,y=(k/W)|0,cx=250+Math.tan(20*Math.PI/180)*(y-100);if(y>=100&&y<460&&Math.abs(x-cx)<16)lp[k]=1}
      const lg=asmSleeveSegs([{m:lp,one:true}],W,N),lapel=(()=>{const g=lg.segs[lg.seg[280*W+Math.round(250+Math.tan(20*Math.PI/180)*180)]];let a=Math.atan2(g.sn,g.cs)*180/Math.PI;while(a>90)a-=180;while(a<-90)a+=180;return Math.round(Math.abs(a))})(),lparts=lg.segs.length-1;
      const lt=asmLinenTile();let mean=0,sd=0;for(const v of lt.r)mean+=v;mean/=lt.r.length;for(const v of lt.r)sd+=(v-mean)**2;sd=Math.sqrt(sd/lt.r.length);
      return {bands:!!asmSuitBands(wp),linen:T.linen,mm:+T.mm.toFixed(1),linePx:+(best/T.TW*px).toFixed(1),
        parts:sg.segs.length-1,lapel,lparts,body:sg.seg[10*W+300],tube:(()=>{const g=sg.segs[sg.seg[150*W+100]];if(!g||!g.parts||!g.crease)return null;const at=(x,y)=>asmTubeAt(g,x,y).map(v=>Math.round(v*10)/10),part=(x,y)=>g.parts.indexOf(asmTubePart(g,x,y));
        return {up:[at(100,120),at(100,260)],fore:[at(200,340),at(380,340)],parts:[part(100,120),part(100,260),part(130,370),part(200,310),part(380,310)],mid:Math.abs(at(200,344)[0]-at(200,336)[0]),edge:Math.abs(at(200,378)[0]-at(200,370)[0])}})(),mean:+mean.toFixed(3),sd:+sd.toFixed(3)}});
    ok(pj.bands&&pj.mm===50,`a windowpane read in bands is drawn from its reading, the pane ${pj.mm} mm (550 mm / 11 across)`);
    ok(pj.linePx>=3.6,`its lines are in Claude's colours and bold: the 2% off-white line is ${pj.linePx} px at 2048 (it would be ${(.02*pj.mm*3.2).toFixed(1)}; 4 is the least, less a pixel of antialiasing)`);
    {const T2=pj.tube,J=JSON.stringify,lean=a=>Math.abs(a[0][0]-a[1][0])/Math.max(1,Math.abs(a[1][1]-a[0][1]));   // the stripe flow (ASM_SLEEVE_FLOW) leans them a little off the part's line
      ok(pj.parts===1&&T2&&pj.body===0&&lean(T2.up)<=.2&&Math.abs(T2.up[1][1]-T2.up[0][1])>100&&lean(T2.fore)<=.2&&Math.abs(T2.fore[1][1]-T2.fore[0][1])>140,
      `a bent sleeve's stripes run along the upper arm (${J(T2&&T2.up)}) and along the forearm (${J(T2&&T2.fore)}) [across, along], leaning at most 0.2 with the learned flow`);
      ok(T2&&T2.parts.join()==='0,0,1,1,1',`an elbow bent square has a crease: the forearm lies in front up to the elbow's outer corner and across its whole width, the upper arm's stripes stop at its top edge (parts ${T2&&T2.parts})`);
      ok(T2&&T2.edge>T2.mid*1.4,`a sleeve is a cylinder: 8 px at its edge hold ${T2&&T2.edge} px of cloth, 8 px at its middle ${T2&&T2.mid}`)}
    ok(pj.lparts===1&&Math.abs(pj.lapel-20)<4,`a lapel is one part, the pattern along its length (${pj.lapel}° from upright, drawn at 20°)`);
    ok(pj.linen&&Math.abs(pj.mean-1)<.01&&Math.abs(pj.sd-.055)<.01,`a linen jacket gets a linen texture in its shading (mean ${pj.mean}, spread ${pj.sd})`);
    // a navy pinstripe on a herringbone (the owner's): the cloth's weave is laid in, its columns breaking on the stripes; the stripe soft and low
    const hb=await p.evaluate(async()=>{const it={id:'ph',type:'suit',primaryColor:'navy',secondaryColor:'lightblue',pattern:'pinstripe',
        patternSpec:{across:{bands:[{role:'ground',hex:'#2b3858',w:.92},{role:'line',hex:'#7c89a8',w:.08}]},along:null,description:'Navy worsted with a fine herringbone weave, crossed by thin pinstripes'},
        sett:{v:2,a:0,bands:[['#2c324b',.92],['#6c7490',.08]],cross:null,cr:6,tr:40,src:'claude+pixels'}};
      const T=await asmSuitTex(it);return {cloth:T.cloth,mix:T.k,gam:T.gam}});
    ok(hb.cloth&&hb.cloth.kind==='herringbone'&&Math.abs(hb.cloth.cw-22)<.5&&Math.abs(hb.cloth.off-42.24)<.5,`a herringbone cloth is laid in, its columns half a stripe repeat wide (${hb.cloth&&hb.cloth.cw} px) with their breaks on the stripes (${hb.cloth&&hb.cloth.off} px)`);
    ok(hb.mix<.5&&hb.gam>1,`the stripe reads soft and low on the dark navy, as in a photo, not crisp and white (${hb.mix} of the way to Claude's line colour; shading steepened, ^${hb.gam})`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
