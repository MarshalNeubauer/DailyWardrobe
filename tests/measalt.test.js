// When the measured colour clearly disagrees with the tag, the Add card offers the measured one in a tap. The user's mink suit
// (tests/fixtures/suit-mink.jpg, close-up suit-mink-closeup.png: very dark, almost grey brown) was tagged "brown" while the close-up measured deep taupe at ΔE 4,
// and the card only printed the measurement. The tagger is also told to weigh the measurement and give it as altColor.
const path=require('path'),fs=require('fs');
module.exports=async({ok,chromium,url,ROOT})=>{
  const src=require('./workersrc.js')();
  ok(/mink or\s+espresso-grey suit whose brown is so muted it reads almost grey is deeptaupe, not brown/.test(src),'the tagger is told how a muted, almost grey brown differs from brown');
  const worker=(await import(require('url').pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const realFetch=globalThis.fetch;let sent=null;
  globalThis.fetch=async(h,init)=>{sent=JSON.parse(init.body);return new Response(JSON.stringify({stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify({type:'suit',primaryColor:'brown',secondaryColor:'none',tertiaryColor:'none',pattern:'twill',metal:null,leather:null,dial:null,band:null,bezel:null,
    confidence:{type:'high',primaryColor:'medium',pattern:'medium'},altColor:'none',altPattern:'none',newColor:null,newPattern:null,clothBox:null,patternBox:null,weave:null})}]}),{status:200,headers:{'content-type':'application/json'}})};
  const browser=await chromium.launch();
  try{
    await worker.fetch(new Request('https://w.test/',{method:'POST',headers:{'x-app-token':'t','content-type':'application/json'},
      body:JSON.stringify({image:'data:image/png;base64,iVBORw0KGgo=',measured:{lab:[24,1.5,3.5],hex:'#3c3631',ref:false,src:'closeup',near:[{c:'deeptaupe',d:4},{c:'charcoal',d:10.6},{c:'black',d:10.9}]}})}),{APP_TOKEN:'t',ANTHROPIC_API_KEY:'k'});
    const prompt=JSON.stringify(sent.messages);
    ok(/nearest of the owner's colours: deeptaupe/.test(prompt)&&/give the nearest measured one as altColor/.test(prompt),'with a measurement, the tagger is asked to give the measured colour as its runner-up when it picks another');
    const p=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    // the user's close-up (tests/fixtures/suit-mink-closeup.png) and photo, measured by the app's own code
    const {m,ph}=await p.evaluate(async()=>{const ld=async s=>{const im=new Image();im.src=s;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;c.getContext('2d').drawImage(im,0,0);return c};
      const r=measureCloth(await ld('tests/fixtures/suit-mink-closeup.png'),null,{});r.near=nearestCols('suit',r.lab,false);
      const q=measureCloth(await ld('tests/fixtures/suit-mink.jpg'),{x:220,y:550,w:113,h:125});q.near=nearestCols('suit',q.lab,false);
      return {m:{lab:r.lab,near:r.near,brown:Math.round(dE00(r.lab,labOf('brown'),2)*10)/10},ph:{lab:q.lab,near:q.near}}});
    ok(m.near[0].c==='deeptaupe'&&m.near[0].d<=5&&m.brown-m.near[0].d>=4,`the close-up measures closest to deep taupe (ΔE ${m.near[0].d}), far from brown (ΔE ${m.brown}); L* ${m.lab[0]}, a* ${m.lab[1]}, b* ${m.lab[2]}`);
    // the card (2026-11-14: one verdict per colour; not sure enough to change it, the card asks "Measured: deep taupe?")
    const card=await p.evaluate(m=>{show('add');addManual();const q=queue[0];q.manual=false;setq(0,'type','suit');q.primaryColor='brown';q.meas={...m,hex:'#3c3631',ref:false,src:'closeup',sharp:.5,spread:2};renderAdd();
      const o=document.querySelector('#queue .measalt'),v=q.measV.find(x=>x.f==='primaryColor');return o&&{txt:o.textContent,btn:o.querySelector('button').textContent,v,brown:q.primaryColor}},{lab:m.lab,near:m.near});
    ok(card&&/Measured: deep taupe\?/.test(card.txt)&&card.btn==='Use deep taupe'&&card.brown==='brown',`the card asks about the measured colour and leaves the tag (${card&&card.txt}; confidence ${card&&card.v.conf})`);
    await p.click('#queue .measalt button');
    ok(await p.evaluate(()=>queue[0].primaryColor==='deeptaupe'&&!document.querySelector('#queue .measalt')),'one tap takes it, and the offer goes away');
    // the photo alone (no close-up, no white reference) is too dark to trust: it measures nearest black, and offers nothing
    const phNone=await p.evaluate(ph=>{const q=queue[0];q.primaryColor='brown';q.meas={...ph,hex:'#2e2a26',ref:false,src:'photo'};renderAdd();return {best:ph.near[0].c,none:!document.querySelector('#queue .measalt')}},ph);
    ok(phNone.best==='black'&&phNone.none,`a photo-only measurement (nearest ${phNone.best} here) offers nothing: only a close-up or a white reference does`);
    // no offer when the tag is about as close as the measurement
    const none=await p.evaluate(()=>{const q=queue[0];q.primaryColor='charcoal';q.meas={lab:[27,0,-3],hex:'#3e4044',ref:false,src:'closeup',near:[{c:'darkgrey',d:4},{c:'charcoal',d:5.5}]};renderAdd();return !document.querySelector('#queue .measalt')});
    ok(none,'no offer when the tagged colour is about as close as the measured one');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{globalThis.fetch=realFetch;await browser.close()}
};
