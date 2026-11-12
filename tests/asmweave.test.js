// Woven shirts painted on the device (assemble.js asmWeave / asmTexFor / asmTexReady / asmPaint): the owner's rules of 2026-11-12.
// Herringbone at Claude's count across the shirt (12 mm when the count is at the cap or missing); a figured weave (dobby, basket…) at
// the repeat measured in its close-up, never finer than 2.9 mm; end-on-end and unread weaves as a faint fleck; the cuffs' weave along
// the arm. tests/fixtures/shirt-diamond-closeup.jpg is the owner's white woven diamond (16 px a diamond in 440 px: 2.9 mm).
const fs=require('fs'),path=require('path');
module.exports=async({ok,chromium,url,ROOT})=>{
  const browser=await chromium.launch();
  try{
    const p=await browser.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const closeup='data:image/jpeg;base64,'+fs.readFileSync(path.join(ROOT,'tests/fixtures/shirt-diamond-closeup.jpg')).toString('base64');
    const r=await p.evaluate(async cu=>{const S=(pattern,x={})=>({id:'s'+Math.random(),type:'shirt',primaryColor:'pink',pattern,...x});
      const hbG=['1000000110','0100001010','0010010010','0001100010'],tex=(kind,grid,tr,rel=.18)=>({v:4,tex:{kind,grid,lighter:true,rel},a:0,cr:13,tr});
      const hb30=S('herringbone',{sett:tex('herringbone',hbG,30)}),hb80=S('herringbone',{sett:tex('herringbone',hbG,80)}),hbNone=S('herringbone');
      const dia=S('woven',{primaryColor:'white',sett:{...tex('diamond',['01111110','10111101','11011011','11100111','11100111','11011011','10111101','01111110'],65,.31),cr:22},texture:cu});
      const fine=S('dobby',{sett:tex('diamond',['10000001','01000010','00100100','00011000','00011000','00100100','01000010','10000001'],80,.22)});   // no close-up
      const eoe=S('end-on-end',{sett:tex('end-on-end',['1010','0101','1010','0101'],80)}),ox=S('oxford'),solid=S('solid'),stripe=S('stripe',{secondaryColor:'white'});
      const w=i=>{const v=asmWeave(i);return v?v.f+(v.hb?':'+v.mm.toFixed(1):''):'plain'};
      const out={rules:[hb30,hb80,hbNone,dia,fine,eoe,ox,solid].map(w).join(' '),paint:[dia,eoe,ox,solid,stripe].map(asmPaintable).join(),
        mmDia:await asmTexMm(dia),mmFine:await asmTexMm(fine)};
      // the tile: one repeat of the app's own drawing, its mean light 1; scaled to the cloth's swing and the picture
      const t=await asmTexTile(hb80,asmWeaveSig(hb80)),T=await asmTexFor(hb80,colOf(hb80),asmWeaveSig(hb80)),R=asmTexReady(T,colOf(hb80),2048),R9=asmTexReady(T,colOf(hb80),900);
      let m=0;for(const v of t.r)m+=v;out.tileMean=m/t.r.length;const s=Float32Array.from(R.r).sort();out.spread=s[Math.floor(s.length*.95)]-s[Math.floor(s.length*.05)];
      const Yl=L=>((L+16)/116)**3,L0=rgbLab(...hexRgb(colOf(hb80)))[0];out.want=(Yl(L0+T.dL/2)-Yl(L0-T.dL/2))/Yl(L0);out.rx=[R.rx,R9.rx];
      const F=asmTexReady({fleck:true,dL:ASM_FLECK_DL},'#e3a5b4',2048),F2=asmTexReady({fleck:true,dL:ASM_FLECK_DL},'#e3a5b4',2048);out.fleck=[F.rx,F.r.length,F.r.every((v,k)=>v===F2.r[k])];
      // painting: a white shirt (a big front and a narrow upright cuff) on a grey ground, its black calibration
      const W=120,N=W*W,img=f=>{const d=new Uint8ClampedArray(4*N);for(let i=0;i<N;i++)d.set([...f(i%W,(i/W)|0),255],4*i);return new ImageData(d,W,W)};
      const inF=(x,y)=>x>=10&&x<70&&y>=10&&y<110,inC=(x,y)=>x>=90&&x<100&&y>=20&&y<100,sh=(x,y)=>inF(x,y)||inC(x,y);
      const master=img((x,y)=>sh(x,y)?[236,236,236]:[120,120,120]),calib=img((x,y)=>sh(x,y)?[18,18,18]:[120,120,120]),P=asmPaintPrep(master,calib);
      const angAt=(x,y)=>{const q=P.idx.indexOf(y*W+x);return q<0?null:P.ang[q]};out.ang=[angAt(40,60),angAt(95,60)];
      const hex='#e3a5b4',RT=asmTexReady(T,hex,2048);RT.rx=10;RT.ry=10*T.ar;const plain=asmPaint(master,null,hex,P).data,woven=asmPaint(master,null,hex,P,RT).data;
      let dm=0,dv=0,n=0,outside=0;for(let i=0;i<N;i++){const x=i%W,y=(i/W)|0;const j=4*i;if(!sh(x,y)){let near=false;for(let a=-3;a<=3&&!near;a++)for(let b=-3;b<=3;b++)if(sh(x+a,y+b)){near=true;break}if(!near)outside+=Math.abs(plain[j]-woven[j]);continue}if(!(x>=14&&x<66&&y>=14&&y<106))continue;n++;dm+=woven[j+1]-plain[j+1];dv+=Math.abs(woven[j+1]-plain[j+1])}
      out.paintMean=dm/n;out.paintVar=dv/n;out.outside=outside;
      // the picture's key and what is asked of the worker
      const o={top:{id:'j',type:'suit',primaryColor:'navy',pattern:'solid'},shirt:hb80,tie:{id:'t',type:'tie',primaryColor:'red',pattern:'solid'},watch:{id:'w',type:'watch',primaryColor:'silver'}};
      const plainPink={...hb80,pattern:'solid',sett:null};out.key=asmOutKey(o)!==asmOutKey({...o,shirt:plainPink})&&asmOutKey(o)===asmOutKey({...o})&&asmOutKey(o)!==asmOutKey({...o,shirt:{...hb80,sett:tex('herringbone',hbG,30)}});
      out.photo=asmPhotoParts(o).map(x=>x.slot).join();const it0=items;items=[o.top,hb80,dia,eoe,stripe,o.tie,o.watch];out.needs=asmNeeds().filter(q=>q.kind==='piece'&&q.slot==='shirt').map(q=>q.item.pattern).join();items=it0;
      return out},closeup);
    ok(r.rules==='tile:18.3 tile:12.2 tile:12.2 tile tile fleck fleck plain',`herringbone is sized by Claude's count (30 across: 18 mm), 12 mm at the cap or without one; read figured weaves are tiles; end-on-end and unread weaves fleck; solid is plain (${r.rules})`);
    ok(r.paint==='true,true,true,true,false',`woven shirts are painted on the device; a striped one still needs a photo (${r.paint})`);
    ok(Math.abs(r.mmDia-2.9)<.4&&r.mmFine===2.9,`a figured weave's repeat is measured in its close-up (the owner's white diamond: ${r.mmDia.toFixed(2)} mm), never finer than 2.9 mm (no close-up: ${r.mmFine} mm)`);
    ok(Math.abs(r.tileMean-1)<1e-3&&Math.abs(r.spread-r.want)<r.want*.05,`the tile is the app's drawing as light around 1, its swing the cloth's (${r.spread.toFixed(4)} for ${r.want.toFixed(4)})`);
    ok(Math.abs(r.rx[0]-39.1)<.2&&Math.abs(r.rx[1]-39.1*900/2048)<.2,`a 12 mm repeat is ${r.rx[0].toFixed(1)} px on the 2048 master and scales with a smaller picture (${r.rx[1].toFixed(1)} px at 900)`);
    ok(r.fleck[0]===96&&r.fleck[1]===96*96&&r.fleck[2],'the fleck is thread-sized (one pixel a thread at 2048) and the same on every device');
    ok(r.ang[0]===0&&Math.abs(Math.abs(r.ang[1])-Math.PI/2)<.05,`the front's weave is upright, a cuff's runs along the arm (across its band: ${r.ang.map(a=>a===null?'-':(a*180/Math.PI).toFixed(0)).join(', ')} degrees)`);
    ok(Math.abs(r.paintMean)<1.5&&r.paintVar>1&&r.outside===0,`the weave shows on the painted shirt (${r.paintVar.toFixed(2)} levels on average) without changing its colour (mean ${r.paintMean.toFixed(2)}) or anything beyond it`);
    ok(r.key,'the weave is in the picture\'s key: a woven and a plain shirt of one colour, or two herringbone sizes, are different pictures');
    ok(!/shirt/.test(r.photo)&&r.needs==='stripe',`a woven shirt asks the worker for no photo; only the striped one needs a piece (${r.photo}; needs: ${r.needs})`);
    // the whole picture, put together in the Web Worker from the fixture photos (900px): the herringbone shows on the shirt only
    const e=await p.evaluate(async()=>{const url=async n=>{const d=await asmData('tests/fixtures/asm-'+n+'.jpg'),c=document.createElement('canvas');c.width=c.height=d.width;c.getContext('2d').putImageData(d,0,0);return c.toDataURL('image/jpeg',.9)};
      const I=(type,primaryColor,x={})=>({id:type+primaryColor+(x.pattern||''),type,primaryColor,pattern:'solid',...x});
      const watch=I('watch','silver',{metal:'silver'}),jk=I('suit','navy'),tie=I('tie','burgundy'),hb=I('shirt','pink',{pattern:'herringbone'}),pl=I('shirt','pink');items=[watch,jk,tie,hb,pl];
      const put=async(key,f,sig='')=>{renders[key]={sig,img:await url(f),model:'',t:1000}};
      await put(asmMasterKey(),'master',asmMasterSig({watch,shirt:asmMasterItem('shirt','white')}));await put(asmPieceKey('jacket',jk),'jacket');await put(asmPieceKey('tie',tie),'tie');
      for(const s of ['jacket','tie','watch'])await put(asmCalibKey(s),s);await put(asmCalibKey('shirt'),'shirt-black');
      const o={top:jk,shirt:hb,tie,watch,suitDay:true},worker=!!asmWorker(),a=await asmPhoto(o),b=await asmPhoto({...o,shirt:pl});if(!a||!b)return {a:!!a,b:!!b};
      const A=await asmData(a),B=await asmData(b),z=asmUnpackZones(await metaGet('asm:zones:'+asmMasterKey())),W=z.W,inner=asmBox(z.shirt,W,4,false);let sd=0,sn=0,sm=0,od=0,on=0;
      for(let i=0;i<W*W;i++){const j=4*i,d=A.data[j+1]-B.data[j+1];if(inner[i]){sn++;sd+=Math.abs(d);sm+=d}else if(z.jacket[i]||z.tie[i]){on++;od+=Math.abs(d)}}
      return {a:true,b:true,worker,shirt:sd/sn,mean:sm/sn,other:od/on}});
    ok(e.a&&e.b&&e.worker,`a woven shirt's outfit is put together in the Web Worker, like a plain one (${e.a}, ${e.b}, worker ${e.worker})`);
    ok(e.shirt>.6&&Math.abs(e.mean)<1&&e.other<.5,`the herringbone shows on the shirt (${e.shirt.toFixed(2)} levels against the plain one), its colour is the same (mean ${e.mean.toFixed(2)}), and the jacket and tie are untouched (${e.other.toFixed(2)})`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
module.exports.assembled=true;
