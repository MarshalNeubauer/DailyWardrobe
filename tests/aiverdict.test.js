// Claude's own signals in the colour verdict (2026-11-14, the owner's "Do 2"): how sure Claude was of the main colour and its
// runner-up (from the same answer, no extra call) are kept on the card and the saved item (tagAI) and weigh with the measurement.
// Claude unsure with the measured colour as its runner-up: the close-up's measurement changes the colour (with Undo) from
// AI_LOW_AUTO; Claude sure and no white reference: never changed, asked only from AI_HIGH_FLAG; otherwise as before. A colour set
// by hand is never overruled, and an undone change is not made again. All answers are mocked: nothing is sent anywhere.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  try{
    const p=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/,r=>r.abort());
    await p.goto(url);await p.waitForFunction(()=>window.appReady);

    // ---- 1. the card's verdicts with mocked Claude answers (a navy-tagged suit whose close-up measures charcoal)
    const r=await p.evaluate(()=>{const keep=items;const S=(id,c,lab)=>({id,type:'suit',primaryColor:c,pattern:'solid',meas:{lab,ref:true,src:'closeup'}});
      items=[S('n1','navy',[20,3,-22]),S('n2','navy',[21,3,-21]),S('c1','charcoal',[28,0,-2]),S('c2','charcoal',[27,0,-3])];show('add');
      // sharp/spread/ref set the measurement's confidence: (.3,2,no ref) about 0.6, (.25,10,no ref) about 0.45, (.5,2,no ref) about 0.8
      const mk=(ai,{sharp=.3,spread=2,ref=false}={})=>{queue.length=0;addManual();const q=queue[0];q.manual=false;
        Object.assign(q,{type:'suit',primaryColor:'navy',pattern:'solid',meas:{lab:[27.5,0,-2.5],hex:'#3f4143',ref,src:'closeup',sharp,spread}});
        q.tagAI=ai?aiSignals({type:'suit',primaryColor:ai.col||'navy',pattern:'solid',conf:{type:'high',primaryColor:ai.c,pattern:'high'},altColor:ai.alt||null,altPattern:null},true):null;
        q.measV=colourVerdicts(q);applyMeasured(q);renderAdd();
        const card=document.querySelector('#queue .card');return {q,col:q.primaryColor,conf:q.measV[0].conf,mode:q.measV[0].mode,
          auto:card.querySelector('.measauto')?card.querySelector('.measauto').textContent:null,flag:card.querySelector('.measalt')?card.querySelector('.measalt').textContent:null}};
      const pick=({q,...o})=>o,out={};
      out.none=pick(mk(null));                                         // no signals: the measurement alone (0.6: asks)
      let c=mk({c:'low',alt:'charcoal'});out.low=pick(c);               // unsure, runner-up = measured: changed
      c.q&&document.querySelector('#queue .measauto button').click();const u=queue[0];out.undo={col:u.primaryColor,edited:!!(u.edited&&u.edited.primaryColor)};
      applyMeasured(u);out.undo.again=u.primaryColor;
      out.lowOther=pick(mk({c:'low',alt:'black'}));                     // unsure, but its runner-up is a third colour: only asks
      out.medium=pick(mk({c:'medium',alt:'charcoal'}));                 // medium: as before
      out.high=pick(mk({c:'high'}));                                    // sure, 0.6: asks (AI_HIGH_FLAG)
      out.highWeak=pick(mk({c:'high'},{sharp:.25,spread:10}));          // sure, 0.45: says nothing
      out.noneWeak=pick(mk(null,{sharp:.25,spread:10}));                //   (the measurement alone asked)
      out.highStrong=pick(mk({c:'high'},{sharp:.5}));                   // sure, 0.8 without a white reference: asks, never changes
      out.noneStrong=pick(mk(null,{sharp:.5}));                         //   (the measurement alone changed it)
      out.highRef=pick(mk({c:'high'},{sharp:.5,ref:true}));             // sure, but a white reference in the close-up: the measurement decides
      out.stale=pick(mk({c:'low',alt:'charcoal',col:'blue'}));          // the field no longer holds Claude's answer: its signals don't count
      const h=mk({c:'low',alt:'charcoal'});queue.length=0;addManual();const hq=queue[0];hq.manual=false;
      Object.assign(hq,{type:'suit',primaryColor:'navy',pattern:'solid',edited:{primaryColor:true},tagAI:h.q.tagAI,meas:{lab:[27.5,0,-2.5],hex:'#3f4143',ref:false,src:'closeup',sharp:.3,spread:2}});
      hq.measV=colourVerdicts(hq);applyMeasured(hq);renderAdd();out.hand={col:hq.primaryColor,notes:!!document.querySelector('#queue .measauto,#queue .measalt')};
      out.k={AI_LOW_AUTO,AI_HIGH_FLAG,MEAS_AUTO};queue.length=0;items=keep;renderAdd();return out});
    ok(r.none.mode==='flag'&&r.none.col==='navy'&&r.none.conf>=r.k.AI_LOW_AUTO&&r.none.conf<r.k.MEAS_AUTO,`without Claude's signals a ${r.none.conf} measurement only asks, as before`);
    ok(r.low.col==='charcoal'&&/Changed navy → charcoal \(measured from your close-up; Claude wasn’t sure\)Undo/.test(r.low.auto),`Claude unsure of navy, its runner-up charcoal = measured: changed by itself: "${r.low.auto}"`);
    ok(r.undo.col==='navy'&&r.undo.edited&&r.undo.again==='navy','Undo puts navy back, and it is not changed again');
    ok(r.lowOther.col==='navy'&&r.lowOther.mode==='flag'&&/Measured: charcoal\?/.test(r.lowOther.flag),'Claude unsure but its runner-up is a third colour: only asks');
    ok(r.medium.col==='navy'&&r.medium.mode==='flag','Claude medium: as before (asks below MEAS_AUTO)');
    ok(r.high.col==='navy'&&r.high.mode==='flag'&&r.highWeak.mode===null&&!r.highWeak.flag&&r.noneWeak.mode==='flag',`Claude sure: asks at ${r.high.conf}, says nothing at ${r.highWeak.conf} (which the measurement alone asked about)`);
    ok(r.highStrong.col==='navy'&&r.highStrong.mode==='flag'&&r.noneStrong.col==='charcoal',`Claude sure and no white reference: a ${r.highStrong.conf} measurement only asks (alone it changed the colour)`);
    ok(r.highRef.col==='charcoal'&&r.highRef.mode===null,'with a white reference the measurement decides even against a sure Claude');
    ok(r.stale.col==='navy'&&r.stale.mode==='flag','once the colour is no longer Claude\'s answer, its confidence doesn\'t count');
    ok(r.hand.col==='navy'&&!r.hand.notes,'a colour set by hand is never overruled nor asked about, whatever Claude said');

    // ---- 2. kept from the answer itself (first tag and tag-many), saved on the item, not sent to the planner
    const sv=await p.evaluate(async()=>{const was=window.ask;
      window.ask=async()=>normTag({type:'suit',primaryColor:'navy',secondaryColor:'none',tertiaryColor:'none',pattern:'solid',confidence:{type:'high',primaryColor:'low',pattern:'medium'},altColor:'charcoal',altPattern:'twill',newColor:null,newPattern:null,clothBox:null},'m');
      const c=document.createElement('canvas');c.width=c.height=200;const x=c.getContext('2d');x.fillStyle='#283050';x.fillRect(0,0,200,200);
      const b=await new Promise(r=>c.toBlob(r,'image/png'));show('add');await addFiles([new File([b],'s.png',{type:'image/png'})]);window.ask=was;
      const card=queue[0]&&queue[0].tagAI;await save(0);const it=items.find(i=>i.tagAI);
      const multi=aiSignals({...normTag({type:'tie',primaryColor:'navy',pattern:'stripe'},'m'),confidence:'medium'},false);
      return {card,saved:it&&it.tagAI,multi}});
    ok(sv.card&&sv.card.col==='navy'&&sv.card.conf.primaryColor==='low'&&sv.card.alt==='charcoal'&&sv.card.altPat==='twill'&&sv.card.seen===false,`the card keeps Claude's colour, confidence and runner-ups from the same answer: ${JSON.stringify(sv.card)}`);
    ok(sv.saved&&sv.saved.conf.primaryColor==='low'&&sv.saved.alt==='charcoal','the saved item carries them (item.tagAI), to calibrate the verdict later');
    ok(sv.multi.conf.primaryColor==='medium'&&sv.multi.col==='navy','tag-many\'s one confidence counts for the colour too');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
