// The cloth reading (2026-11-14): a plain or finely woven jacket or trousers with a close-up is painted from what the close-up measures
// (asm-color.js asmFabRead / asmFabTile / asmFabTex), Claude's reading of the cloth goes with it (tagging.js readCloth, item.clothSpec),
// and the Add card says what is wrong with a close-up (tagging.js closeIssues).
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const ctx=await browser.newContext();const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  let asked=null;
  await ctx.route('https://w.test/**',route=>{const q=route.request();if(q.method()==='POST'&&/\/pattern$/.test(q.url())){asked=JSON.parse(q.postData());
      return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({layout:'cloth',cloth:{weave:'twill',yarns:[{name:'mocha brown',hex:'#5a4a3a',share:.7},{name:'beige',hex:'#9a8a70',share:.3}],melange:'clear',slub:'none',sheen:'soft',description:'a two-tone twill'}})})}
    return route.fulfill({status:q.method()==='OPTIONS'?204:404,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},body:''})});
  try{await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(async()=>{
      // a close-up: a brown cloth of darker and lighter beige threads in short level streaks, white paper down the left edge; and an even one
      const mk=(W,H,two,paper)=>{const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d'),d=x.createImageData(W,H);let s=7;const rnd=()=>{s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff};
        for(let y=0;y<H;y++){let run=0,lt=false;for(let xx=0;xx<W;xx++){if(!run){run=6+Math.floor(rnd()*18);lt=rnd()<.4}run--;const k=4*(y*W+xx),pp=xx<W*paper,a=two&&lt?[150,132,104]:[84,66,46];
          d.data[k]=pp?245:a[0];d.data[k+1]=pp?244:a[1];d.data[k+2]=pp?242:a[2];d.data[k+3]=255}}x.putImageData(d,0,0);return c};
      const two=mk(1152,1536,true,.2),even=mk(1152,1536,false,.2),base=[.2,.14,.09];
      const R=await asmFabRead(two.toDataURL('image/png')),E=await asmFabRead(even.toDataURL('image/png')),F=asmFabTile(R,base),FE=asmFabTile(E,base);
      const mean=[0,0,0];if(F)for(let k=0;k<F.TW*F.TH;k++)for(let q=0;q<3;q++)mean[q]+=F.t[3*k+q]/(F.TW*F.TH);
      const tex=two.toDataURL('image/jpeg',.9),I=(x)=>({id:'s1',type:'suit',primaryColor:'brown',pattern:'twill',texture:tex,...x});
      const R2={...R,tint:[...R.tint]},mel=asmFabSpec(R2,{melange:'none',yarns:[{hex:'#5a4a3a'},{hex:'#9a8a70'}]});
      const job=await asmFabTex(I(),true),flat=await asmFabTex(I({pattern:'solid'}),false);
      const small=mk(480,640,true,0),papery=mk(1152,1536,true,.5);
      return {R:R&&{sd:R.sd,sn:R.sn,tint:R.tint},E:E&&E.sd,amp:F&&F.amp,tw:F&&F.TW,mm:F&&F.mm,mean:mean.map((v,q)=>v/base[q]),evenNull:FE===null,
        tag:asmFabTag('jacket',I()),tagTr:asmFabTag('trousers',I({type:'pants',pattern:'solid'})),tagNo:asmFabTag('jacket',I({texture:''})),tagHb:asmFabTag('jacket',I({pattern:'herringbone'})),tagShirt:asmFabTag('shirt',I({type:'shirt'})),
        tagSpec:asmFabTag('jacket',I({clothSpec:{melange:'clear',yarns:[]}})),mel,tint2:R2.tint,
        job:job&&{t:job.t.length,TW:job.TW,ribs:job.cloth&&job.cloth.kind,fab:!!job.fab},flat:flat&&{ribs:flat.cloth},
        sig:asmCmSig({top:I(),shirt:{id:'h',type:'shirt',primaryColor:'white',pattern:'solid'}})===asmCmSig({top:I({texture:tex+'x'}),shirt:{id:'h',type:'shirt',primaryColor:'white',pattern:'solid'}}),
        issues:{small:closeIssues(small),papery:closeIssues(papery),fine:closeIssues(two)},
        sum0:clothSummary(I()),sum1:clothSummary(I({clothSpec:{weave:'twill',yarns:[{name:'mocha brown'},{name:'beige'}],melange:'clear',slub:'none',sheen:'soft'}}))}});
    ok(r.R&&r.R.sd>.03&&r.R.sn>.03&&r.E!==null&&r.E<.01,`a two-tone close-up measures a swing, an even one none (sd ${r.R&&r.R.sd.toFixed(3)}, even ${r.E&&r.E.toFixed(4)})`);
    ok(r.R&&r.R.tint[0]<r.R.tint[2]&&r.R.tint.every(v=>v>=.6&&v<=1.5),`the yarns' tint: beige over brown swings blue most, red least (${r.R&&r.R.tint.map(v=>v.toFixed(2))})`);
    ok(r.amp>.012&&r.amp<=.11&&r.tw===256&&Math.abs(r.mm-80)<.01&&r.mean.every(v=>Math.abs(v-1)<.002),`the tile: 256 texels over 80 mm, its swing within bounds (${r.amp&&r.amp.toFixed(3)}), its mean the item's colour exactly`);
    ok(r.evenNull,'an even cloth gets no tile (it stays as it was painted)');
    ok(/^\/fab1-/.test(r.tag)&&/^\/fab1-/.test(r.tagTr)&&r.tagNo===''&&r.tagHb===''&&r.tagShirt===''&&r.tagSpec!==r.tag&&!r.sig,'the look\'s key carries the close-up for a plain or twill jacket or trousers only (not a herringbone, a shirt or no close-up), and Claude\'s reading; a new close-up is a new key');
    ok(r.mel===.5&&r.tint2[0]<r.tint2[2],'Claude\'s reading: "none" halves the swing, its yarns give the tint');
    ok(r.job&&r.job.t===3*256*256&&r.job.ribs==='twill'&&r.job.fab&&r.flat&&r.flat.ribs===null,'the painter\'s cloth: the tile with the twill\'s ribs over it; a plain cloth has no ribs');
    ok(r.issues.small.length===1&&/small \(480/.test(r.issues.small[0])&&r.issues.papery.some(t=>/paper covers about 5\d%/.test(t))&&!r.issues.fine.length,`the Add card's close-up notes: small, too much paper, none for a good one (${JSON.stringify(r.issues)})`);
    ok(/measured from the close-up/.test(r.sum0)&&r.sum1==='twill, mocha brown and beige, clear melange, soft sheen','the item sheet\'s cloth line');
    // the item sheet's button asks the server and keeps the answer
    const s=await p.evaluate(async()=>{localStorage.setItem('worker_url','https://w.test/');localStorage.setItem('app_token','t');
      const c=document.createElement('canvas');c.width=c.height=64;c.getContext('2d').fillRect(0,0,64,64);const u=c.toDataURL('image/jpeg');
      const it={id:'c1',type:'suit',primaryColor:'brown',pattern:'twill',texture:u,photo:u,added:Date.now(),updated:Date.now()};items.push(it);await put(it);
      const html=itemBody?itemBody(it):'';await readCloth('c1');return {btn:/id="readcloth-btn"/.test(html),spec:items.find(x=>x.id==='c1').clothSpec}}).catch(e=>({err:String(e)}));
    ok(!s.err&&s.spec&&s.spec.weave==='twill'&&s.spec.yarns.length===2&&asked&&asked.cloth===true&&asked.type==='suit'&&!!asked.closeup,`"Read cloth with Claude" posts {cloth:true} with the close-up and keeps the answer as item.clothSpec (${s.err||''})`);
    ok(s.btn,'the item sheet shows the button for a twill suit with a close-up');
    ok(!errs.length,'no page errors ('+errs.join('; ')+')')}
  finally{await browser.close()}};
module.exports.assembled=true;
