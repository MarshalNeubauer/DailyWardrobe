// Colour recognition on every item (2026-11-14, the owner's design): a patterned cloth is measured colour by colour, a close-up's white
// reference must be a real patch of paper, the wardrobe's own colours are learned from plain cloth only, a confident measurement changes
// the colour on the Add card (with Undo) and an unsure one only asks, a colour set by hand is never overruled, a stripe reading that
// contradicts the tag is not used, and a blurry close-up is called out. Also: the kept sharp photo is signed with its item photo, tag
// requests say whether the photo was white-balanced, and several photos are tagged three at a time.
//
// Fixtures from the new-user walkthrough (small copies of crops of Wikimedia Commons photos):
//   walk-shirt-bluestripe-closeup.jpg  "White collar blue striped shirt" by Lucius Kwok, CC BY-SA 2.0
//   walk-shirt-lightblue-closeup.jpg   "Pink and blue dress shirts, JCPenney" by Ser Amantio di Nicolao, CC BY-SA 4.0
//   walk-trousers-cream-closeup.jpg    "Trousers-colourisolated" by Themightyquill, from "Dressed for summer" by Ed Yourdon, CC BY-SA 2.0
//   walk-suit-pinstripe-closeup.jpg    "Pinstripe suit" by Suzanne willson (en.wikipedia), public domain / CC BY-SA 3.0
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  try{
    const p=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{window.ld=async s=>{const im=new Image();im.src=s;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;c.getContext('2d').drawImage(im,0,0);return c};
      // a cloth canvas: f(x,y) -> [r,g,b], with a little noise
      window.cloth=(w,h,f,seed=7)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d'),d=x.createImageData(w,h);let s=seed;const rnd=()=>((s=(s*16807)%2147483647)/2147483647-.5)*8;
        for(let y=0;y<h;y++)for(let X=0;X<w;X++){const v=f(X,y),k=4*(y*w+X),n=rnd();d.data[k]=v[0]+n;d.data[k+1]=v[1]+n;d.data[k+2]=v[2]+n;d.data[k+3]=255}x.putImageData(d,0,0);return c}});

    // ---- 1. white paper only for a real solid patch
    const wb=await p.evaluate(async()=>{const f=n=>ld('tests/fixtures/'+n);const blue=await f('walk-shirt-lightblue-closeup.jpg'),cream=await f('walk-trousers-cream-closeup.jpg'),stripe=await f('walk-shirt-bluestripe-closeup.jpg');
      const paper=cloth(400,300,(x,y)=>x>290&&y<110?[244,243,238]:[60,70,110]);   // navy cloth with a corner of white paper
      return {old:[wbRead(blue).ref,wbRead(cream).ref,wbRead(stripe).ref],strict:[closeRead(blue).ref,closeRead(cream).ref,closeRead(stripe).ref],paper:closeRead(paper).ref}});
    ok(wb.old.every(Boolean)&&!wb.strict.some(Boolean),`no white paper is found in the light blue shirt, cream trousers or white/blue stripe close-ups (it was: ${wb.old}; now ${wb.strict})`);
    ok(wb.paper,'a real corner of white paper in a close-up still counts as the white reference');

    // ---- 2. a white/blue striped shirt reads white and blue, not the grey in between
    const st=await p.evaluate(async()=>{const q={id:'s1',type:'shirt',primaryColor:'white',secondaryColor:'blue',pattern:'stripe',raw:{tex:await ld('tests/fixtures/walk-shirt-bluestripe-closeup.jpg')},wb:null};
      readSett(q);measureCard(q);const v=f=>q.measV.find(x=>x.f===f);return {whole:q.meas.near[0].c,parts:q.meas.parts&&q.meas.parts.map(x=>x.role+' '+x.hex),p:v('primaryColor'),s:v('secondaryColor'),hint:measHint(q.meas)}});
    const fam=c=>['blue','steelblue','navy','lightblue','deepblue','periwinkle','darknavy'].includes(c);
    ok(st.parts&&st.parts.length===2&&st.p.to==='white'&&st.s&&fam(st.s.to),`the stripe shirt is measured colour by colour: ${st.parts&&st.parts.join(', ')} (ground ${st.p.to}, stripe ${st.s&&st.s.to}; the whole picture's median is ${st.whole})`);
    ok(!st.p.mode&&!(st.s&&st.s.mode==='auto'),'nothing about the white ground is offered, and the stripe colour is not changed by itself');
    ok(st.hint.near[0].c==='white','the tagger is told the ground\'s measurement, not the grey average');

    // ---- 3. a stripe reading that contradicts the tag is not used; a blurry close-up is called out
    const pin=await p.evaluate(async()=>{const chk=(t,pat,s)=>{const r=settCheck(t,pat,s);return r.reject||(r.s&&r.s.a)};const B=[['#333333',.9],['#cccccc',.1]];
      const unit={cross:chk('suit','pinstripe',{v:2,a:0,bands:B,cross:{d:90,bands:[['#999999',.1],[null,.9]],r:1},src:'closeup'}),level:chk('suit','pinstripe',{v:2,a:-84,bands:B,cross:null,src:'photo'}),
        turned:chk('suit','pinstripe',{v:2,a:88,bands:B,cross:null,src:'closeup'}),tie:chk('tie','stripe',{v:2,a:-45,bands:B,cross:{d:90,bands:[['#999999',.1],[null,.9]],r:1},src:'photo'}),check:chk('suit','windowpane',{v:2,a:0,bands:B,cross:{d:90,bands:[['#999999',.1],[null,.9]],r:1},src:'photo'}),
        shirt:settCheck('shirt','stripe',{v:2,a:0,bands:B,cross:{d:90,bands:[['#999999',.1],[null,.9]],r:1},src:'closeup'}).s.cross};
      show('add');addManual();const q=queue[0];q.manual=false;Object.assign(q,{type:'suit',primaryColor:'charcoal',secondaryColor:'lightgrey',pattern:'pinstripe',raw:{tex:await ld('tests/fixtures/walk-suit-pinstripe-closeup.jpg')},wb:null});
      readSett(q);measureCard(q);renderAdd();const card=document.querySelector('#queue .card').textContent;
      return {unit,sett:q.sett&&{a:q.sett.a,cross:!!q.sett.cross},rej:q.settReject,sharp:q.meas.sharp,blur:/too blurry to read the weave: retake it\?/.test(card),rejNote:/which isn.t pinstripe: drawn with the simple pattern/.test(card)}});
    ok(pin.unit.cross==='cross'&&pin.unit.level==='level'&&pin.unit.turned===0&&pin.unit.tie===-45&&pin.unit.check===0&&pin.unit.shirt===null,`a pinstripe with crossing lines or read level in the photo is turned down; read level in a close-up it is turned upright; a tie keeps any reading (a plaid tie is often tagged stripe), a windowpane its crossing lines; a shirt's crossing lines are dropped (${JSON.stringify(pin.unit)})`);
    ok(!pin.sett||(!pin.sett.cross&&(((pin.sett.a%180)+180)%180<20||((pin.sett.a%180)+180)%180>160)),`the walkthrough's soft pinstripe close-up gives no windowpane: ${pin.rej?'its reading was turned down ('+pin.rej+')':'upright stripes, no crossing lines'}`);
    ok(!pin.rej||pin.rejNote,'the card says why the reading wasn\'t used');
    ok(pin.sharp<.25&&pin.blur,`the soft close-up (sharpness ${pin.sharp}) gets "too blurry to read the weave: retake it?"`);

    // ---- 4. the wardrobe's own colours are learned from plain cloth only, never from the item itself
    const cal=await p.evaluate(()=>{const keep=items;const I=(id,pat,lab,x={})=>({id,type:'tie',primaryColor:'navy',pattern:pat,meas:{lab,ref:false,src:'closeup'},...x});
      items=[I('a','stripe',[40,5,-20],{secondaryColor:'white'}),I('b','paisley',[38,8,-18],{secondaryColor:'gold'})];const none=calibLab('navy','tie');
      items.push(I('c','solid',[18,4,-22]),I('d','woven',[16,5,-24]));const two=calibLab('navy','tie'),self=calibLab('navy','tie','d');items=keep;return {none,two,self}});
    ok(cal.none===null,'two patterned navy ties teach "navy" nothing (the walkthrough\'s plain brown tie then measured nearest navy)');
    ok(cal.two&&cal.two[0]===18&&cal.self===null,`plain and one-colour woven ties do (navy L* ${cal.two&&cal.two[0]}), and an item never teaches its own measurement`);

    // ---- 5. confident and disagreeing: changed, with Undo; unsure: asked; set by hand: left alone
    const card=await p.evaluate(()=>{const keep=items;const S=(id,c,lab)=>({id,type:'suit',primaryColor:c,pattern:'solid',meas:{lab,ref:true,src:'closeup'}});
      items=[S('n1','navy',[20,3,-22]),S('n2','navy',[21,3,-21]),S('c1','charcoal',[28,0,-2]),S('c2','charcoal',[27,0,-3])];
      const mk=(sharp,ref)=>{queue.length=0;addManual();const q=queue[0];q.manual=false;Object.assign(q,{type:'suit',primaryColor:'navy',pattern:'solid',meas:{lab:[27.5,0,-2.5],hex:'#3f4143',ref,src:'closeup',sharp,spread:2}});q.measV=colourVerdicts(q);return q};
      const out={};let q=mk(.6,true);out.conf=q.measV[0].conf;applyMeasured(q);renderAdd();const el=document.querySelector('#queue .measauto');
      out.auto={col:q.primaryColor,txt:el&&el.textContent};el&&el.querySelector('button').click();q=queue[0];out.undo={col:q.primaryColor,edited:!!(q.edited&&q.edited.primaryColor)};applyMeasured(q);out.undo.after=q.primaryColor;
      q=mk(.3,false);out.flagConf=q.measV[0].conf;applyMeasured(q);renderAdd();const fl=document.querySelector('#queue .measalt');out.flag={col:q.primaryColor,txt:fl&&fl.textContent,mode:q.measV[0].mode};
      q=mk(.6,true);q.edited={primaryColor:true};applyMeasured(q);renderAdd();out.hand={col:q.primaryColor,notes:!!document.querySelector('#queue .measauto,#queue .measalt')};
      queue.length=0;items=keep;renderAdd();return out});
    ok(card.auto.col==='charcoal'&&/Changed navy → charcoal \(measured from your close-up\)Undo/.test(card.auto.txt),`a confident measurement (${card.conf}) changes the colour and says so: "${card.auto.txt}"`);
    ok(card.undo.col==='navy'&&card.undo.edited&&card.undo.after==='navy','Undo puts the tag back, and it is not changed again');
    ok(card.flag.col==='navy'&&card.flag.mode==='flag'&&/Measured: charcoal\?Use charcoal/.test(card.flag.txt),`an unsure one (${card.flagConf}: no white reference, a soft close-up) only asks: "${card.flag.txt}"`);
    ok(card.hand.col==='navy'&&!card.hand.notes,'a colour set by hand is never overruled, nor asked about');

    // ---- 6. a pattern the tag missed is suggested
    const miss=await p.evaluate(()=>{const mk=c=>({id:'m',type:'shirt',primaryColor:'white',pattern:'solid',raw:{tex:c},wb:null});
      const striped=mk(cloth(640,480,x=>x%40<6?[40,70,160]:[240,240,236])),plain=mk(cloth(640,480,()=>[200,205,215]));return [missedPattern(striped),missedPattern(plain)]});
    ok(['stripe','fine-stripe'].includes(miss[0])&&miss[1]===null,`a close-up of cloth tagged plain that shows clear stripes suggests ${miss[0]}; a plain one suggests nothing`);

    // ---- 7. the kept sharp photo is signed with its item photo
    const sig=await p.evaluate(async()=>{const a=cloth(40,30,()=>[200,10,10]).toDataURL('image/jpeg');
      await keepTagImg('sg1',a,'data:image/jpeg;base64,PHOTO-A');const same=!!await tagImgOf('sg1',{photo:'data:image/jpeg;base64,PHOTO-A'}),other=await tagImgOf('sg1',{photo:'data:image/jpeg;base64,PHOTO-B'}),any=!!await tagImgOf('sg1');
      await resignTagImg('sg1','data:image/jpeg;base64,PHOTO-B');const again=!!await tagImgOf('sg1',{photo:'data:image/jpeg;base64,PHOTO-B'});return {same,other,any,again}});
    ok(sig.same&&sig.other===null&&sig.any&&sig.again,'the sharp copy is handed out only with the photo it was kept for (after Replace photo the old one is not sent), and a crop signs it again');

    // ---- 8. tag requests say whether the photo was white-balanced; several photos are tagged three at a time
    const par=await p.evaluate(async()=>{const was=ask;let live=0,max=0;const sent=[];window.ask=async(img,x)=>{sent.push(x&&x.wb);live++;max=Math.max(max,live);await new Promise(r=>setTimeout(r,150));live--;return null};
      const file=async n=>new File([await new Promise(r=>cloth(60,40,()=>[n*40,90,120]).toBlob(r,'image/png'))],`p${n}.png`,{type:'image/png'});
      const fs=[];for(let n=0;n<5;n++)fs.push(await file(n));show('add');const t0=performance.now();await addFiles(fs,false);const ms=performance.now()-t0;window.ask=was;
      let pat=null;const f0=window.fetch;localStorage.setItem('worker_url','https://w.test/');window.fetch=async(u,o)=>{pat=JSON.parse(o.body);return new Response('{}',{status:500})};
      await claudePattern({image:'data:image/jpeg;base64,AA',type:'tie',wb:false});window.fetch=f0;localStorage.removeItem('worker_url');
      const ex=tagExtras({wb:true}),cards=queue.length;window.patWb=pat&&pat.wb;queue.length=0;renderAdd();return {max,sent,cards,ms,ex:ex.wb,none:'wb' in tagExtras({}),pat:window.patWb}});
    ok(par.max===3&&par.cards===5,`five photos get five cards and are tagged three at a time (at most ${par.max} at once, ${Math.round(par.ms)} ms)`);
    ok(par.sent.length===5&&par.sent.every(v=>typeof v==='boolean')&&par.ex===true&&!par.none&&par.pat===false,'every tag request, and a pattern reading, says whether its pictures were white-balanced (wb)');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
