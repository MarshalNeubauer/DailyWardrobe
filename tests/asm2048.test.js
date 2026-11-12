// Assembled pictures at 2048 (ASM_VER 3): the pixel distances tuned on 900px pictures scale with the picture (asmPx) and never shrink
// below what was tuned; every job asks the worker for the masters' size; the photos are kept as made (they were shrunk to 900px).
const fs=require('fs'),path=require('path');
module.exports=async({ok,chromium,url,ROOT})=>{
  const browser=await chromium.launch();
  try{
    const p=await browser.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(()=>({px:[asmPx(4,900),asmPx(4,2048),asmPx(2,2048),asmPx(4,120)],size:ASM_SIZE,ver:ASM_VER,vest:ASM_VEST,zv:ASM_ZV,
      calib:asmCalibJob('tie').size,vestCalib:asmCalibJob('vest').size,vm:asmVestMasterJob(),cost:ASM_COST}));
    ok(r.px.join()==='4,9,5,4',`distances are as tuned at 900, about 2.3 times at 2048, and never smaller on a small picture (${r.px.join(', ')})`);
    ok(r.size===2048&&r.ver===3&&r.vest===3&&r.zv===9,`the third masters are 2048 (ASM_VER ${r.ver}, ASM_VEST ${r.vest}, zones version ${r.zv})`);
    ok(r.calib==='2048x2048'&&r.vestCalib==='2048x2048'&&r.vm.size==='2048x2048'&&r.vm.quality==='high',`calibration and waistcoat master jobs ask for 2048 (the waistcoat master at high quality)`);
    ok(/cut LOW/.test(r.vm.swap.text)&&/Do not move either hand/.test(r.vm.swap.text),'the waistcoat master is asked for cut low, the hands left where they are');
    ok(r.cost.piece===.14&&r.cost.master===.46,`the costs shown are the 2048 ones (a piece ${Math.round(r.cost.piece*100)}Â¢, the master ${Math.round(r.cost.master*100)}Â¢)`);
    const z=await p.evaluate(async()=>{const W=60,pic=(x0,y0,x1,y1)=>{const c=document.createElement('canvas');c.width=c.height=W;const g=c.getContext('2d');g.fillStyle='#000';g.fillRect(0,0,W,W);g.fillStyle='#fff';g.fillRect(x0,y0,x1-x0,y1-y0);return c.toDataURL('image/png')};
      const z=await asmZonesFromImgs({jacket:pic(0,0,60,60),shirt:pic(20,0,40,30),tie:pic(25,0,35,40),watch:pic(30,30,40,40)},W),at=(s,x,y)=>z[s][y*W+x];
      const keys=['jacket','shirt','tie','watch','vest'].map(asmZoneKey);
      return {one:[at('jacket',5,5),at('shirt',21,5),at('tie',30,5),at('watch',35,35)].join(),over:at('jacket',30,5)+at('shirt',30,5)+at('tie',35,35),
        n:z.jacket.reduce((a,b)=>a+b,0),keys:new Set(keys).size===5&&keys.every(k=>/^c[0-9a-f]{16}$/.test(k))}});
    ok(z.one==='1,1,1,1'&&z.over===0,`zone pictures made outside the app: white is the piece, one zone per pixel, watch over tie over shirt over jacket (${z.one}; overlaps ${z.over})`);
    ok(z.keys,'each zone picture has a worker key of its own');
    // a piece that moved the master's green tie sideways: the green left in the shirt's zone is covered with the cloth beside it
    const k=await p.evaluate(()=>{const W=120,N=W*W,img=f=>{const d=new Uint8ClampedArray(4*N);for(let i=0;i<N;i++){const c=f(i%W,(i/W)|0);d.set([...c,255],4*i)}return new ImageData(d,W,W)};
      const G=[40,150,70],P=[230,180,200],Gr=[120,120,120],z={W,tie:new Uint8Array(N),shirt:new Uint8Array(N),jacket:new Uint8Array(N),watch:new Uint8Array(N)},lab=new Uint8Array(N);
      for(let i=0;i<N;i++){const x=i%W;if(x>=55&&x<70)z.tie[i]=1;else if(x>=30&&x<95){z.shirt[i]=1;lab[i]=2}else{z.jacket[i]=1;lab[i]=1}}
      const master=img(x=>x>=55&&x<70?G:x>=30&&x<95?[235,235,235]:Gr);
      const out=img(x=>x>=46&&x<70?G:x>=30&&x<95?(x%4<2?P:[210,160,180]):Gr);   // the shirt piece: its green 9px further left, a striped pink
      const n=asmKeyFill(out.data,lab,z,master,W);let green=0,stripes=0;for(let i=0;i<N;i++){if(!lab[i])continue;const j=4*i,o=out.data;if(o[j+1]-o[j]>40)green++;const x=i%W;if(lab[i]===2&&x>=46&&x<51&&(o[j]===230||o[j]===210)&&o[j]===o[j+16])stripes++}   // cloth, not a smear: its stripes still repeat every 4px
      return {n,green,stripes}});
    ok(k.n>0&&k.green===0,`green the master's tie left in another piece is cleaned up (${k.n} found, ${k.green} left)`);
    ok(k.stripes===5*120,`by a sideways copy of the cloth beside it, so its weave carries on (${k.stripes} of ${5*120} pixels in pattern)`);
    // the shirt's grey shadow beside the tie, in the tie's photo (as in the master), is not tie: it was a pale line on a dark shirt
    const tm=await p.evaluate(()=>{const W=120,N=W*W,img=f=>{const d=new Uint8ClampedArray(4*N);for(let i=0;i<N;i++)d.set([...f(i%W),255],4*i);return new ImageData(d,W,W)};
      const z={W,tie:new Uint8Array(N),shirt:new Uint8Array(N),jacket:new Uint8Array(N),watch:new Uint8Array(N)};for(let i=0;i<N;i++){const x=i%W;if(x>=50&&x<70)z.tie[i]=1;else z.shirt[i]=1}
      const bg=x=>x>=70&&x<73?[95,95,95]:[205,205,205],master=img(x=>x>=50&&x<70?[40,150,70]:bg(x)),tie=img(x=>x>=50&&x<70?[30,30,60]:bg(x));
      const out=(m,s=0)=>{for(let i=0;i<N;i++)if(m[i]&&i%W>=71)s++;return s};
      return {without:out(asmTieMask(z,tie)),with:out(asmTieMask(z,tie,master)),inside:asmTieMask(z,tie,master).reduce((a,v,i)=>a+(v&&i%W>=52&&i%W<68?1:0),0)}});
    ok(tm.with===0&&tm.without>0&&tm.inside===16*120,`the tie's outline stops where its photo is still the master (${tm.with} shadow pixels taken as tie, ${tm.without} without that check)`);
    // the painted shirt's soft edge is mixed with what lies beyond it (the neck), not the master's own half-white pixel: a grey line
    const ne=await p.evaluate(()=>{const W=40,N=W*W,mk=f=>{const d=new Uint8ClampedArray(4*N);for(let i=0;i<N;i++)d.set([...f(i%W),255],4*i);return new ImageData(d,W,W)};
      const skin=[180,130,110],master=mk(x=>x<20?[240,240,240]:x===20?[210,185,175]:skin),calib=mk(x=>x<=20?[20,20,20]:skin),P=asmPaintPrep(master,calib),out=asmPaint(master,null,'#16161a',P).data;   // x 20: half skin, half white collar
      let bad=0,n=0;for(let q=0;q<P.idx.length;q++){const A=P.A[q];if(A>=1||A<=0)continue;const k=P.idx[q];if(k%W!==20)continue;n++;const j=4*k,want=[0x16,0x16,0x1a].map((v,c)=>A*v+(1-A)*skin[c]);
        if(want.some((v,c)=>Math.abs(out[j+c]-v)>12))bad++}return {n,bad}});
    ok(ne.n>0&&ne.bad===0,`a painted collar's soft edge blends into the neck beyond it, with none of the master's white (${ne.bad} of ${ne.n} edge pixels off)`);
    // a figured shirt (a motif reading) is painted in colour: the ground the tagged colour, the figures darker, no photo asked for
    const mf=await p.evaluate(async()=>{const i={id:'mf',type:'shirt',primaryColor:'white',secondaryColor:'grey',pattern:'dobby',
        sett:{v:3,motif:{grid:'straight',ground:'#c9c9d4',groundName:'white',figs:[{shape:'square',place:'cell',size:.5,cols:['#716f7b'],names:['grey']}],aspect:1},a:0,cr:10,tr:80,src:'claude+pixels'}};
      const W=256,N=W*W,mk=v=>{const d=new Uint8ClampedArray(4*N);for(let k=0;k<N;k++)d.set([v,v,v,255],4*k);return new ImageData(d,W,W)},hex=colOf(i),wk=asmWeaveSig(i),wv=asmWeave(i);
      const tex=await asmTexFor(i,hex,wk),out=asmPaint(mk(240),mk(20),hex,null,asmTexReady(tex,hex,W)).data,Lm=[];for(let k=0;k<N;k++)Lm.push(out[4*k+1]);const s=[...Lm].sort((a,b)=>a-b);
      const o={top:{id:'j',type:'suit',primaryColor:'navy',pattern:'solid'},shirt:i,tie:{id:'t',type:'tie',primaryColor:'red',pattern:'solid'},watch:{id:'w',type:'watch',primaryColor:'silver'}};
      return {paint:asmPaintable(i),f:wv&&wv.f,mm:wv&&wv.mm,col:!!(tex&&tex.col),med:s[Math.floor(N*.8)],lo:s[Math.floor(N*.05)],tag:hexRgb(hex)[1],photo:asmPhotoParts(o).map(x=>x.slot).join()}});
    ok(mf.paint&&mf.f==='col'&&mf.mm===16&&mf.col&&!/shirt/.test(mf.photo),`a figured shirt is painted in colour, its repeat two cells from the close-up (${mf.mm} mm), with no photo (photo parts: ${mf.photo})`);
    ok(Math.abs(mf.med-mf.tag)<=8&&mf.lo<mf.med*.6,`its ground is the tagged colour (${mf.med} for ${mf.tag}) and its figures keep their contrast (${mf.lo})`);
    // ties are painted on the device: no photo; a plain tie is its tagged colour, a striped one has its stripes (the close-up's count
    // wins over a reading that is half the truth), the knot a quarter turn from the blade
    const tp=await p.evaluate(async()=>{const W=160,N=W*W,img=f=>{const d=new Uint8ClampedArray(4*N);for(let k=0;k<N;k++)d.set([...f(k%W,(k/W)|0),255],4*k);return new ImageData(d,W,W)};
      const zt=new Uint8Array(N);for(let k=0;k<N;k++){const x=k%W,y=(k/W)|0;if(y>=10&&y<150&&Math.abs(x-80)<(y<40?14:y<48?6:12+y/20))zt[k]=1}   // a knot, a narrow neck, the blade
      const master=img(()=>[60,150,80]),calib=img(()=>[200,40,160]),P=asmTiePrep(master,calib,zt);
      const plain=asmTiePaint(master,P,{hex:'#6d1f2c'}).data,j=4*(100*W+80);
      const cl=document.createElement('canvas');cl.width=cl.height=220;const g=cl.getContext('2d');g.fillStyle='#16151d';g.fillRect(0,0,220,220);g.strokeStyle='#e090a0';g.lineWidth=6;
      for(let t=-440;t<440;t+=40*Math.SQRT2){g.beginPath();g.moveTo(t,0);g.lineTo(t+220,220);g.stroke()}const close=cl.toDataURL('image/png');   // stripes 40px apart: 5.5 across
      const n=asmStripeCount(await asmData(close));
      const tie={id:'st',type:'tie',primaryColor:'navy',secondaryColor:'pink',pattern:'stripe',texture:close,sett:{v:2,a:-45,bands:[['#16151d',.85],['#e090a0',.15]],cross:null,cr:2.75,tr:1.8,src:'claude+pixels'}};
      const T=await asmTieFor(tie),st=asmTiePaint(master,P,T).data;let pinkB=0,pinkK=0,nb=0,nk=0;
      for(let k=0;k<N;k++){if(!zt[k])continue;const y=(k/W)|0,pk=st[4*k]>st[4*k+2]+20;if(y>P.yk){nb++;if(pk)pinkB++}else{nk++;if(pk)pinkK++}}
      const o={top:{id:'j',type:'suit',primaryColor:'navy',pattern:'solid'},shirt:{id:'s',type:'shirt',primaryColor:'white'},tie,watch:{id:'w',type:'watch',primaryColor:'silver'}};
      return {plain:[...plain.slice(j,j+3)],hex:hexRgb('#6d1f2c'),n:+n.toFixed(2),across:T.across,yk:P.yk,pinkB:pinkB/nb,pinkK:pinkK/Math.max(1,nk),
        photo:asmPhotoParts(o).map(x=>x.slot).join(),tp:!!asmParts(o).find(x=>x.slot==='tie').tp,needs:(items.push(tie),asmNeeds().some(q=>q.kind==='piece'&&q.slot==='tie'))}});
    ok(tp.tp&&!/tie/.test(tp.photo)&&!tp.needs,`a tie is painted on the device and needs no photo (photo parts: ${tp.photo})`);
    ok(tp.plain.every((v,c)=>Math.abs(v-tp.hex[c])<=3),`a plain tie is its tagged colour (${tp.plain} for ${tp.hex})`);
    ok(Math.abs(tp.n-5.5)<.6&&Math.abs(tp.across-3.6)<.4,`the close-up's stripes are counted (${tp.n} across it, 5.5 drawn), and a reading that counted half as many is corrected (${tp.across} across the blade, read 1.8)`);
    ok(tp.yk>=38&&tp.yk<=48&&tp.pinkB>.08&&tp.pinkB<.3&&tp.pinkK>.05,`the stripes are painted on the blade and in the knot (knot above row ${tp.yk}; ${(100*tp.pinkB).toFixed(0)}% / ${(100*tp.pinkK).toFixed(0)}% stripe)`);
    // plain shirts are painted on the device: no photo is asked for, and the picture's shirt is the tagged colour, shaded from the master and the black calibration shirt
    const pt=await p.evaluate(()=>{const W=40,N=W*W,d=new Uint8ClampedArray(4*N),cd=new Uint8ClampedArray(4*N);for(let i=0;i<N;i++){const x=i%W,v=x<20?240:120,c=x<20?20:10;d.set([v,v,v,255],4*i);cd.set([c,c,c,255],4*i)}   // a white shirt, its right half in shadow; the calibration's black shirt
      const m=new ImageData(cd,W,W),navy={id:'n',type:'shirt',primaryColor:'navy',pattern:'solid'},dob={id:'d',type:'shirt',primaryColor:'lightblue',pattern:'dobby'},str={id:'s',type:'shirt',primaryColor:'white',secondaryColor:'blue',pattern:'stripe'};
      const out=asmPaint(new ImageData(d,W,W),m,colOf(navy)).data,lit=[...out.slice(0,3)],dark=[...out.slice(4*30,4*30+3)];
      const o={top:{id:'j',type:'suit',primaryColor:'navy',pattern:'solid'},shirt:navy,tie:{id:'t',type:'tie',primaryColor:'red',pattern:'solid'},watch:{id:'w',type:'watch',primaryColor:'silver'}};
      const parts=asmParts(o),sp=parts.find(x=>x.slot==='shirt');
      return {hex:colOf(navy),lit,dark,paint:sp&&sp.paint,photo:asmPhotoParts(o).map(x=>x.slot).join(),plain:asmPaintable(navy),dobby:asmPaintable(dob),stripe:asmPaintable(str),
        key:asmOutKey(o)!==asmOutKey({...o,shirt:{...navy,shade:-2}})}});
    const hx=h=>[1,3,5].map(k=>parseInt(h.slice(k,k+2),16));
    ok(pt.plain&&pt.dobby&&!pt.stripe,'a plain shirt is painted, and a woven (dobby) one with its weave (tests/asmweave.test.js); a patterned (stripe) one still needs a photo');
    ok(pt.paint===pt.hex&&!/shirt/.test(pt.photo),`its part is painted in the tagged colour and asks the worker for no photo (photo parts: ${pt.photo})`);
    ok(pt.lit.every((v,k)=>Math.abs(v-hx(pt.hex)[k])<=8)&&pt.dark.every((v,k)=>v<pt.lit[k]),`the lit cloth is the shirt's colour (${pt.lit} for ${pt.hex}), the shadow darker (${pt.dark})`);
    ok(pt.key,'a new shade of the shirt is a new picture');
    const src=fs.readFileSync(path.join(ROOT,'assemble.js'),'utf8');
    ok(!/shrinkUrl\([^)]*900\)/.test(src),'assembled-picture photos are kept as made, not shrunk to 900px');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
