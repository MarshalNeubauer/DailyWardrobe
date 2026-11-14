// Assembled pictures painted off the page and ahead of time (assemble.js: asmRun / asm-worker.js, asmAhead): the painting runs in a
// Web Worker and gives the same picture as on the page; the next days' looks are painted in the background, so swiping to a day shows its
// picture at once, not the drawing first; nothing is built ahead without a worker; the day on screen is not redrawn under a finger.
// Fixtures: the colour-coded suit master and its masks at 512 (tests/fixtures/cm/suit/), kept on the device as if downloaded.
const fs=require('fs'),path=require('path');
module.exports=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const FIX=path.join(__dirname,'fixtures','cm','suit'),recs=fs.readdirSync(FIX).map(f=>[f.replace(/\.(png|jpg)$/,'').replace(/^mask-/,'mask/').replace(/^part-/,'part/'),`data:image/${f.endsWith('.jpg')?'jpeg':'png'};base64,`+fs.readFileSync(path.join(FIX,f)).toString('base64')]);
    // a wardrobe whose every look is painted on the suit master, its records on the device
    await p.evaluate(async recs=>{self.ASM_CM_SIZE=512;for(const [n,img] of recs)renders[asmCmKey('suit',n)]={sig:'asm/cm test',img,model:'colormaster',t:1000};
      let n=0;const I=(type,primaryColor,x={})=>({id:type+(n++),type,primaryColor,pattern:'solid',...x});
      const watch=I('watch','silver',{metal:'silver'}),jk=I('blazer','khaki',{pattern:'windowpane'}),black=I('shirt','black'),white=I('shirt','white'),t1=I('tie','navy',{pattern:'stripe',secondaryColor:'pink'}),t2=I('tie','burgundy');
      items=[watch,jk,black,white,t1,t2,I('pants','grey'),I('shoes','brown',{leather:'calf'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('socks','navy')];
      settings.workdays=[1,2,3,4,5];settings.blazerDays=[1,2,3,4,5];settings.vestMode='never';dayRecs={};weather={};TODAY_OVERRIDE='2026-11-10T12:00:00';cache={};sel=new Date(2026,10,10);view={y:2026,m:10};
      window.__lt=[];new PerformanceObserver(l=>{for(const e of l.getEntries())__lt.push(Math.round(e.duration))}).observe({type:'longtask'});
      show('today')},recs);
    // the worker and the page make the same picture
    const same=await p.evaluate(async()=>{const o=planFor()[key(sel)],job=await asmJob(o),w=await asmRun(job),pg=await asmBuild(job);
      const px=async u=>{const im=new Image();im.src=u;await im.decode();const c=document.createElement('canvas');c.width=c.height=im.width;const x=c.getContext('2d');x.drawImage(im,0,0);return x.getImageData(0,0,im.width,im.width).data};
      const A=await px(w.url),B=await px(pg.url);let d=0;for(let i=0;i<A.length;i++)d+=Math.abs(A[i]-B[i]);return {worker:asmOffPage()&&!!asmW&&asmW.ok===true,len:A.length===B.length,mean:d/A.length}});
    ok(same.worker&&same.len&&same.mean<0.5,`the picture is put together in a Web Worker and comes out as on the page (mean difference ${same.mean.toFixed(3)} per channel)`);
    // building ahead: every look of the coming days gets its picture without being shown
    await p.evaluate(()=>{__lt=[]});
    await p.waitForFunction(()=>{if(asmAheadOn)return false;const T=todayDate();for(let i=0;i<ASM_AHEAD;i++){const d=new Date(T.getFullYear(),T.getMonth(),T.getDate()+i);if(!isWorkday(d))continue;const o=planOn(d);if(o&&asmWants(o)&&!asmFor(o))return false}return true},null,{timeout:60000,polling:250});
    const built=await p.evaluate(()=>{const T=todayDate(),looks=new Set();let days=0;for(let i=0;i<ASM_AHEAD;i++){const d=new Date(T.getFullYear(),T.getMonth(),T.getDate()+i);if(!isWorkday(d))continue;const o=planOn(d);if(o&&asmWants(o)){days++;looks.add(asmOutKey(o))}}
      return {days,looks:looks.size,kept:Object.keys(asmOut).length,lt:Math.max(0,...__lt)}});
    ok(built.days>=40&&built.looks>=2&&built.kept>=built.looks,`the next 60 days are built in the background: ${built.days} workdays, ${built.looks} looks, all kept`);
    ok(built.lt<400,`building them ahead never holds the page for long (longest task ${built.lt} ms)`);
    // swiping to a day never looked at: its picture is there on the first drawing, no drawing first
    const sw=await p.evaluate(()=>{const seen=[];for(let i=0;i<8;i++){stepDay(1);const c=$('#mannequin-container');seen.push(!!c.querySelector(':scope > img')&&!c.querySelector(':scope > svg'))}return seen});
    ok(sw.every(Boolean),`swiping through eight days never seen shows each day's picture at once (${sw.join(',')})`);
    // the day on screen isn't redrawn under a finger: it waits for the finger to lift
    const cdp=await ctx.newCDPSession(p);
    await p.evaluate(()=>{window.__rt=0;window.__r0=refreshToday;refreshToday=()=>{__rt++}});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:200,y:300}]});
    const during=await p.evaluate(()=>{asmShow();return __rt});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await p.waitForFunction(()=>__rt>0,null,{timeout:3000}).catch(()=>{});
    const after=await p.evaluate(()=>{const n=__rt;refreshToday=__r0;return n});
    ok(during===0&&after===1,`a picture ready while a finger is down is shown when it lifts (${during} redraws during, ${after} after)`);
    // without a worker nothing is built ahead (on the page it would freeze swiping); the day on screen still is
    const nw=await p.evaluate(async()=>{asmWorkerDown();window.ASM_NO_WORKER=true;asmW=null;for(const k of Object.keys(asmOut))delete asmOut[k];
      await asmAhead();const T=todayDate(),d=new Date(T.getFullYear(),T.getMonth(),T.getDate()+7),o=planOn(d),aheadNone=!Object.keys(asmOut).length;
      const cur=planFor()[key(sel)];await asmEnsure(cur);return {off:!asmOffPage(),aheadNone,cur:!!asmFor(cur),later:!asmFor(o)||+d===+sel}});
    ok(nw.off&&nw.aheadNone&&nw.cur,'without a worker nothing is built ahead, and the day on screen is still put together (on the page)');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    await ctx.close();
  }finally{await browser.close()}
};

module.exports.assembled=true;   // tests assembled pictures (assemble.js); other tests run with them switched off (ASM_TEST_OFF)
