// The New Look editor's worker side (2026-11-17, the beta: look.js): POST /describe {what:'both', look:true} is "Read with Claude". With
// src:'photo' the picture is the whole item and the words say so; a type without patterns (shoes, belts, watches, tie clips, cufflinks)
// gets the colour half and a finish half (its leather or metal, a watch's dial, a belt's buckle) held to its own list; a tester counts 2
// lookups. A request without look is as before (no new words; shoes still 400). The tagger offers coats their patterns only to an app that
// names 'coatpat' (the beta). Claude is mocked by a fetch stub: no paid call.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,ROOT})=>{
  const mod=await import(pathToFileURL(path.join(ROOT,'worker.js')).href),worker=mod.default;
  const TAG=await import(pathToFileURL(path.join(ROOT,'worker/tag.js')).href);
  const realFetch=globalThis.fetch;let sent=[],reply=null;
  globalThis.fetch=async(href,init)=>{if(String(href)!=='https://api.anthropic.com/v1/messages')return new Response('',{status:404});
    const body=JSON.parse(init.body);sent.push(body);const [st,b]=reply(body);
    return new Response(JSON.stringify(st===200?{model:body.model,stop_reason:'end_turn',usage:{input_tokens:1,output_tokens:1},content:[{type:'text',text:JSON.stringify(b)}]}:b),{status:st,headers:{'content-type':'application/json'}})};
  const store=new Map();
  const KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,put:async(k,v)=>{store.set(k,v)},delete:async k=>{store.delete(k)},
    list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true})};
  const env={APP_TOKEN:'owner',ANTHROPIC_API_KEY:'k',CLAUDE_RETRY_MS:'0',WARDROBE:KV};
  const call=(body,tok='owner')=>worker.fetch(new Request('https://w.test/describe',{method:'POST',headers:{'content-type':'application/json','x-app-token':tok},body:JSON.stringify(body)}),env);
  const J=async r=>({s:r.status,...(await r.json().catch(()=>({})))});
  const IMG='data:image/jpeg;base64,'+Buffer.from([0xff,0xd8,0xff,0xd9]).toString('base64');
  const COL={kind:'colour',match:'existing',existing:'brown',name:'brown',hex:'#5a3a22',plansAs:'brown',fitsType:true,confidence:'high',why:'',ask:null,accents:[]};
  const PAT={kind:'pattern',match:'existing',existing:'herringbone',name:'herringbone',description:'Columns of small Vs.',plansAs:'herringbone',look:{layout:'none',texture:null,across:null,along:null,motif:null,repeatsAcrossItem:10},colourHint:null,confidence:'high',why:'',ask:null,material:{key:'tweed',confidence:'high',why:'Flecked wool.'}};
  const textOf=b=>b.messages[0].content.map(c=>c.text||'').join('\n'),isFinish=b=>/say what it is made of/.test(b.system[0].text),isColour=b=>!!b.output_config.format.schema.properties.plansAs&&!!b.output_config.format.schema.properties.hex;
  reply=b=>isFinish(b)?[200,{material:{key:b.messages[0].content.some(c=>/Kind of item: watch/.test(c.text||''))?'gold':'suede',confidence:'high',why:'Matte nap.'},dial:'navy',buckle:'gold'}]:isColour(b)?[200,COL]:[200,PAT];
  try{
    // ---- a coat from its photo (src:'photo'): the words say it is the whole item; the pattern half gives a coat pattern and its material
    sent=[];let r=await J(await call({what:'both',look:true,src:'photo',type:'overcoat',colours:{main:'charcoal'},pattern:'solid',custom:{},closeup:IMG}));
    const t=sent.map(textOf).join('\n');
    ok(r.s===200&&r.colour.existing==='brown'&&r.pattern.existing==='herringbone'&&r.pattern.material.key==='tweed',`an overcoat is read: color, a coat pattern, its material (${r.s} ${JSON.stringify(r.pattern&&r.pattern.material)})`);
    ok(/whole item, not a close-up/.test(t)&&/<description>the item in the photo<\/description>/.test(t)&&!/close-up of this item/.test(t)&&/read it from the photo itself/.test(t),'src photo: the words say the photo is the whole item, not a close-up');
    // the same reading from a close-up (look true, src closeup): the close-up words as before
    sent=[];await call({what:'both',look:true,src:'closeup',type:'suit',colours:{main:'navy'},pattern:'solid',custom:{},closeup:IMG});
    const t2=sent.map(textOf).join('\n');sent=[];await call({what:'both',type:'suit',colours:{main:'navy'},pattern:'solid',custom:{},closeup:IMG});const t3=sent.map(textOf).join('\n');
    ok(t2===t3&&/close-up of this item/.test(t3)&&!/whole item/.test(t3),'a close-up reading with look is worded exactly as the old "Read color and texture" (and a request without look is unchanged)');
    // ---- shoes: 400 without look (as before), with look the colour half and the finish half
    r=await J(await call({what:'both',type:'shoes',colours:{main:'brown'},custom:{},closeup:IMG}));
    ok(r.s===400,'without look a type with no patterns is still refused (400)');
    sent=[];r=await J(await call({what:'both',look:true,src:'photo',type:'shoes',colours:{main:'oxblood'},custom:{},closeup:IMG}));
    const fin=sent.find(isFinish);
    ok(r.s===200&&r.colour.existing==='brown'&&r.pattern===null&&r.material.key==='suede'&&r.material.confidence==='high'&&r.dial===null&&r.buckle===null,`shoes: color, and the leather from the finish half (no dial, no buckle) (${JSON.stringify({m:r.material,d:r.dial,b:r.buckle})})`);
    ok(sent.length===2&&fin&&fin.output_config.format.schema.properties.material.properties.key.enum.includes('cordovan')&&/Kind of item: shoes\. Its keys: calf, cordovan/.test(textOf(fin))&&fin.system.length===1,'the finish half: its own fixed text (cached), the item\'s keys, a strict schema');
    ok(sent.every(b=>b.messages[0].content.some(c=>c.type==='image')),'both halves see the photo');
    sent=[];r=await J(await call({what:'both',look:true,src:'photo',type:'watch',colours:{main:'black'},custom:{},closeup:IMG}));
    ok(r.s===200&&r.material.key==='gold'&&r.dial==='navy'&&r.buckle===null,`a watch: its metal and dial (${JSON.stringify({m:r.material.key,d:r.dial})})`);
    sent=[];r=await J(await call({what:'both',look:true,src:'photo',type:'belt',colours:{main:'brown'},custom:{},closeup:IMG}));
    ok(r.s===200&&r.material.key==='suede'&&r.buckle==='gold'&&r.dial===null,`a belt: its leather and buckle (${JSON.stringify({m:r.material.key,b:r.buckle})})`);
    // a key another kind has (a watch's metal for shoes) is none
    reply=b=>isFinish(b)?[200,{material:{key:'gold',confidence:'high',why:''},dial:'navy',buckle:'none'}]:[200,COL];
    r=await J(await call({what:'both',look:true,src:'photo',type:'shoes',colours:{main:'brown'},custom:{},closeup:IMG}));
    ok(r.material.key==='none'&&r.dial===null,'the finish is held to the item\'s own list (gold shoes: none; a dial only on a watch)');
    // a failed finish half: the colour half still comes back, one lookup given back for a tester
    reply=b=>isFinish(b)?[400,{error:{type:'invalid_request_error',message:'x'}}]:[200,COL];
    r=await J(await call({what:'both',look:true,src:'photo',type:'cufflinks',colours:{main:'silver'},custom:{},closeup:IMG}));
    ok(r.s===200&&r.colour.kind==='colour'&&r.finish&&r.finish.error&&!('material' in r),`a finish half that fails is said as such; the colour half stays (${JSON.stringify(r.finish)})`);
    // ---- the tagger: coats' patterns only for an app that names 'coatpat'
    const old=TAG.tagRules([]),withTypes=TAG.tagRules(['pocketsquare','sockpat']),coat=TAG.tagRules(['pocketsquare','sockpat','coatpat']);
    ok(/overcoat, raincoat: solid/.test(old)&&/overcoat, raincoat: solid/.test(withTypes)&&!/overcoat, raincoat:\n/.test(withTypes),'without coatpat coats are "solid" in the rules, as before');
    ok(!/overcoat, raincoat: solid/.test(coat)&&/overcoat, raincoat:\n\s+solid, herringbone/.test(coat)&&/glen-check \(Prince of Wales\)/.test(coat),'with coatpat they get their own pattern line');
    ok(TAG.knownTypes({types:['coatpat']}).includes('coatpat')&&JSON.stringify(TAG.PATTERN_BY_TYPE.overcoat)==='["solid","herringbone","houndstooth","check","glen-check","windowpane","tweed","other"]','coatpat is a known flag; the worker lists the coat patterns (= core.js PATS_BY)');
  }finally{globalThis.fetch=realFetch}
};
