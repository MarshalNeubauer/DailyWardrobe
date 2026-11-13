// A shirt woven with small figures in a second colour (the user's white dobby with grey chevrons, tests/fixtures/shirt-chevron-closeup.png)
// is read as a motif whose figure Claude draws as a bitmap ("figure"), on a grid whose cells can be taller or shorter than wide
// (cellAspect) and whose rows can be offset by half a cell (rowOffset). It is drawn at full contrast in the colours measured from
// the close-up, is read on the Add card once its close-up is in, gets its own photo key, a description and its drawing.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const realFetch=globalThis.fetch;let sent=null,reply=null;
  globalThis.fetch=async(href,init)=>{if(String(href)!=='https://api.anthropic.com/v1/messages')return new Response('',{status:404});sent=JSON.parse(init.body);
    return new Response(JSON.stringify({model:'claude-opus-5-5',stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify(reply())}]}),{status:200,headers:{'content-type':'application/json'}})};
  const IMG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  const CHEV=['1000001','1100011','1111111','0111110','0011100','0001000'];
  const MOTIF={grid:'straight',ground:{name:'white',hex:'#eeeef2'},cellAspect:.82,rowOffset:'none',
    figures:[{shape:'figure',placement:'cell',colours:[{name:'grey',hex:'#6a6870'}],centre:null,sizePct:50,bitmap:CHEV,name:'downward chevron'}]};
  const SPEC={layout:'motif',across:null,along:null,texture:null,motif:MOTIF,stripeDirection:'vertical',repeatsInCloseup:8,repeatsAcrossItem:40,paneAspect:1,ignored:'',
    description:'A white dobby shirt with small grey chevrons woven in columns.'};
  const env={APP_TOKEN:'t',ANTHROPIC_API_KEY:'k'},call=b=>worker.fetch(new Request('https://w.test/pattern',{method:'POST',headers:{'content-type':'application/json','x-app-token':'t'},body:JSON.stringify(b)}),env);
  const browser=await chromium.launch();
  try{
    // ---- worker
    reply=()=>({...SPEC,motif:{...MOTIF,figures:[...MOTIF.figures,{shape:'figure',placement:'cell',colours:[{name:'grey',hex:'#6a6870'}],centre:null,sizePct:20,bitmap:['abc'],name:'bad'}]}});
    let r=await call({image:IMG,closeup:IMG,type:'shirt'}),j=await r.json();
    const t=sent.messages[0].content.find(c=>c.type==='text').text,sch=sent.output_config.format.schema;
    ok(r.status===200&&/a shirt's figured dobby whose small figures are woven in a second, clearly different colour/.test(t)&&/it is a motif, not a texture/.test(t)&&/figure \(any other small shape: draw it in "bitmap"\)/.test(t),'the pattern prompt sends two-colour figured dobbies to a motif, and asks for any other figure as a bitmap');
    ok(sch.properties.motif.anyOf[0].required.includes('cellAspect')&&sch.properties.motif.anyOf[0].required.includes('rowOffset'),'the motif carries the grid\'s cell shape and row offset');
    const f=j.motif.figures;
    ok(f[0].shape==='figure'&&f[0].bitmap.join()===CHEV.join()&&f[0].name==='downward chevron'&&f[1].shape==='other'&&!f[1].bitmap&&j.motif.cellAspect===.82&&j.motif.rowOffset==='none',
      'the figure\'s bitmap and name are kept; a figure with no usable bitmap falls back to "other"');
    // ---- app
    const ctx=await browser.newContext({viewport:{width:390,height:844}});let calls=[];
    const spec={...SPEC,motif:{...MOTIF,figures:MOTIF.figures.map(x=>({...x,size:x.sizePct/100}))}};
    await ctx.route('https://w.test/**',async route=>{const q=route.request(),u=new URL(q.url());
      if(u.pathname==='/pattern'){calls.push(JSON.parse(q.postData()));return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({...spec,model:'m'})})}
      if(q.method()==='POST'&&u.pathname==='/')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({type:'shirt',primaryColor:'white',secondaryColor:'grey',tertiaryColor:'none',pattern:'dobby',metal:null,leather:null,dial:null,band:null,bezel:null,
        confidence:{type:'high',primaryColor:'high',pattern:'medium'},altColor:'none',altPattern:'none',newColor:null,newPattern:null,clothBox:null,patternBox:null,weave:null,model:'m'})});
      return route.fulfill({status:404,contentType:'application/json',body:'{}'})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.evaluate(()=>{localStorage.setItem('worker_url','https://w.test/');localStorage.setItem('app_token','t')});await p.reload();await p.waitForFunction(()=>window.appReady);
    const m=await p.evaluate(async spec=>{const im=new Image();im.src='tests/fixtures/shirt-chevron-closeup.png';await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;c.getContext('2d').drawImage(im,0,0);
      const s=specSett(spec,{tex:c,type:'shirt'}),L=h=>rgbLab(...hexRgb(h))[0],it={id:'sh',type:'shirt',primaryColor:'white',secondaryColor:'grey',pattern:'dobby',sett:s};
      const def=fabricDef('q',it,'shirt'),W=+def.match(/width="([\d.]+)"/)[1],H=+def.match(/height="([\d.]+)"/)[1];
      const off=fabricDef('q',{...it,sett:{...s,motif:{...s.motif,off:1}}},'shirt');
      const o={suitDay:true,top:{id:'t',type:'suit',primaryColor:'navy',pattern:'solid'},shirt:it,tie:{id:'x',type:'tie',primaryColor:'burgundy',pattern:'solid'}};
      return {s,ground:L(s.motif.ground),fig:L(s.motif.figs[0].cols[0]),rects:(def.match(/<rect /g)||[]).length,ratio:H/W,figCol:def.includes(s.motif.figs[0].cols[0]),
        offDiff:off!==def,usable:!!usableSett(it),band:usableSett({...it,sett:{v:2,bands:[['#fff',.5],['#888',.5]]}}),patterned:shirtPatterned(it),
        key:comboKey(o)!==comboKey({...o,shirt:{...it,sett:null}}),text:settText(it,'shirt')}},spec);
    ok(m.s.v===3&&m.s.motif.figs[0].bmp.join()===CHEV.join()&&m.s.motif.aspect===.82&&m.s.cr===8&&m.s.tr===40,'the reading keeps the figure\'s bitmap, the cell shape and the scale');
    ok(m.ground>85&&m.fig>35&&m.fig<65,`colours come from the close-up, at full contrast: white ground L* ${m.ground.toFixed(0)}, grey figures L* ${m.fig.toFixed(0)}`);
    ok(m.figCol&&m.rects>=1+4*CHEV.length&&Math.abs(m.ratio-.82)<.01,`the swatch draws the chevrons row by row (${m.rects} rects) on cells 0.82 as tall as wide`);
    ok(m.offDiff,'a half-row offset moves every other row');
    ok(m.usable&&m.band===null,'a dobby shirt takes the figure reading (a band reading still does not apply)');
    ok(m.patterned&&m.key,'the figured shirt counts as patterned: its own photo key');
    ok(/small grey downward chevrons/.test(m.text)&&/grid of columns, the figures stacked closer than the columns are apart/.test(m.text)&&/white ground/.test(m.text)&&/about 40 repeats/.test(m.text),
      `the photo generator is told the figure, the layout and the colours (${m.text})`);
    // the Add card: a dobby shirt's close-up asks Claude, and the reading is saved
    await p.evaluate(async()=>{items=[];show('add');const b=await (await fetch('tests/fixtures/shirt-chevron-closeup.png')).blob();await addFiles([new File([b],'s.png',{type:'image/png'})])});
    await p.evaluate(async()=>{const b=await (await fetch('tests/fixtures/shirt-chevron-closeup.png')).blob();await addTexture(0,new File([b],'c.png',{type:'image/png'}))});
    await p.waitForFunction(()=>queue[0]&&queue[0].sett&&queue[0].sett.motif,null,{timeout:20000});
    ok(calls.length===1&&calls[0].type==='shirt'&&/read by Claude/.test(await p.textContent('#queue')),'a dobby shirt\'s close-up asks Claude for the pattern on the Add card');
    await p.evaluate(()=>save(0));
    const sv=await p.evaluate(async()=>{const it=items[0],o={suitDay:true,top:{id:'t',type:'suit',primaryColor:'navy',pattern:'solid'},shirt:it};const {labels}=await outfitRefsFull(o);
      return {motif:!!(it.sett&&it.sett.motif),pool:asmCmGaps().filter(x=>x.i.id===it.id).length,label:labels.find(l=>/the shirt's measured pattern/.test(l))||''}});
    ok(sv.motif&&sv.pool===0&&/copy its figures/.test(sv.label),'saved with its reading; Settings → Painted plain doesn\'t list it to read again; the photo generator gets its drawing');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{globalThis.fetch=realFetch;await browser.close()}
};
