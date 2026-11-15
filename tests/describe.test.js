// POST /describe (worker/describe.js): a colour or pattern described in words. Claude mocked by a fetch stub (no paid call): the
// request (model, effort, cached fixed text first and byte-identical, the owner block second, the description wrapped and stripped
// of < and >), the cleaners (hex, plansAs, existing and dE, kinds, grids, bands, a weave answered solid), the tester's daily cap and
// the all-testers total, plain words for testers, and the route's 404/405 neighbours.
const path=require('path'),crypto=require('crypto'),{pathToFileURL}=require('url');
module.exports=async({ok,ROOT})=>{
  const mod=await import(pathToFileURL(path.join(ROOT,'worker.js')).href),worker=mod.default;
  const D=await import(pathToFileURL(path.join(ROOT,'worker/describe.js')).href);
  const realFetch=globalThis.fetch;let sent=[],reply=null;
  globalThis.fetch=async(href,init)=>{if(String(href)!=='https://api.anthropic.com/v1/messages')return new Response('',{status:404});
    const body=JSON.parse(init.body);sent.push({headers:init.headers,body});const [st,b]=reply(body);
    return new Response(JSON.stringify(st===200?{model:body.model,stop_reason:'end_turn',usage:{input_tokens:1,output_tokens:1},content:[{type:'thinking',thinking:''},{type:'text',text:JSON.stringify(b)}]}:b),{status:st,headers:{'content-type':'application/json'}})};
  const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
  const store=new Map();
  const KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,put:async(k,v)=>{store.set(k,v)},delete:async k=>{store.delete(k)},
    list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true})};
  const hubs=new Map(),hubOf=name=>{if(!hubs.has(name)){const st=new Map();hubs.set(name,new mod.RenderHub({storage:{get:async k=>st.get(k),put:async(k,v)=>{st.set(k,v)},deleteAll:async()=>{st.clear()}}},{}))}return hubs.get(name)};
  const HUB={idFromName:x=>x,get:name=>({fetch:(u,init)=>hubOf(name).fetch(new Request(u,init))})};
  const env={APP_TOKEN:'owner',ANTHROPIC_API_KEY:'k',CLAUDE_RETRY_MS:'0',WARDROBE:KV,RENDER_HUB:HUB};
  const call=(body,tok='owner',e=env,method='POST',p='describe')=>worker.fetch(new Request('https://w.test/'+p,{method,headers:{'content-type':'application/json','x-app-token':tok},body:method==='GET'?undefined:JSON.stringify(body)}),e);
  const J=async r=>({s:r.status,...(await r.json().catch(()=>({})))});
  const COL={kind:'colour',match:'new',existing:'wine',name:'Faded Burgundy',hex:'#7A3B47',plansAs:'wine',fitsType:true,confidence:'high',why:'A greyed, softer burgundy.',ask:null};
  const PAT={kind:'pattern',match:'new',existing:'nailhead',name:'Hopsack',description:'A small basketweave, two over two.',plansAs:'nailhead',
    look:{layout:'texture',texture:{kind:'basket',grid:['1100','1100','0011','0011'],aspect:1,lighter:true,contrast:'subtle'},across:null,along:null,motif:null,repeatsAcrossItem:70},colourHint:null,confidence:'high',why:'A basket weave.',ask:null};
  const custom={colors:[{key:'ownmoss',name:'Moss',hex:'#5a6b3a',base:'olive',types:['tie'],accent:false}],patterns:[{key:'own-grenadine-fina',name:'Grenadine fina',base:'woven',types:['tie'],desc:'a fine gauze weave'}]};
  try{
    // ---- the request
    reply=()=>[200,COL];
    let r=await J(await call({what:'colour',text:'  faded <burgundy> like old wine ',type:'tie',field:'primary',colours:{main:'burgundy'},custom}));
    const q=sent[0].body,u=q.messages[0].content.map(c=>c.text||'').join('\n');
    ok(r.s===200&&q.model==='claude-sonnet-5-5','the model is Claude Sonnet 5.5 by default');
    ok(q.output_config.effort==='low'&&q.max_tokens===4000&&!('thinking' in q)&&!('temperature' in q),'a colour runs at effort low, max_tokens 4000, no thinking or sampling parameters (Sonnet 5.5 refuses "disabled")');
    ok(q.system.length===2&&q.system.every(s=>s.cache_control&&s.cache_control.type==='ephemeral')&&/menswear cloth expert/.test(q.system[0].text)&&/Colour keys/.test(q.system[0].text)&&/ownmoss = Moss \(#5a6b3a\), behaves like olive/.test(q.system[1].text),'system: the fixed rules and tables first, then the owner\'s colours with their bases, both cached');
    ok(/<description>faded burgundy like old wine<\/description>/.test(u)&&!/<burgundy>/.test(u)&&/Kind of item: tie/.test(u)&&/colour now: burgundy \(#6d1f2c\)/.test(u),'the description is wrapped, < and > removed, after the item\'s kind and colour');
    ok(q.fallbacks==='default'&&sent[0].headers['anthropic-beta']==='server-side-fallback-2026-07-01','the refusal fallback is on for Sonnet 5.5');
    ok(q.output_config.format.type==='json_schema'&&q.output_config.format.schema.properties.existing.enum.includes('ownmoss')&&!q.output_config.format.schema.properties.plansAs.enum.includes('ownmoss'),'strict JSON: existing may be an own colour, plansAs never');
    sent=[];await call({what:'colour',text:'petrol blue',type:'suit',custom:{}});await call({what:'colour',text:'ink',type:'shirt',field:'accent',custom});
    ok(sent[0].body.system[0].text===sent[1].body.system[0].text&&sent[0].body.system.length===1,'the fixed block is byte-identical across descriptions and items (the cache prefix holds); no owner block without own colours');
    ok(/stripe or motif colour/.test(sent[1].body.messages[0].content[0].text),'an accent field asks for a stripe or motif colour');
    sent=[];await call({what:'colour',text:'x',type:'tie'},'owner',{...env,CLAUDE_DESCRIBE_MODEL:'claude-haiku-5-5'});
    ok(sent[0].body.model==='claude-haiku-5-5'&&!('fallbacks' in sent[0].body),'CLAUDE_DESCRIBE_MODEL changes the model (photo tagging keeps CLAUDE_MODEL)');
    // ---- the input
    sent=[];
    for(const [b,why] of [[{what:'colour',text:'',type:'tie'},'empty'],[{what:'colour',text:'x'.repeat(121),type:'tie'},'over 120'],[{what:'colour',text:'<>',type:'tie'},'only < >'],[{what:'hue',text:'red',type:'tie'},'what'],[{what:'colour',text:'red',type:'hat'},'type'],[{what:'pattern',text:'dots',type:'shoes'},'pattern on shoes']]){
      r=await J(await call(b));ok(r.s===400,`refused before Claude: ${why}`)}
    ok(sent.length===0,'nothing was sent to Claude for a refused request');
    ok((await call({what:'colour',text:'x'.repeat(120),type:'tie'})).status===200,'120 characters are accepted');
    // ---- the colour cleaner
    r=await J(await call({what:'colour',text:'faded burgundy',type:'tie'}));
    ok(r.hex==='#7a3b47'&&r.name==='faded burgundy'&&r.plansAs==='wine'&&r.existing==='wine'&&r.dE>4&&r.dE<7&&r.kind==='colour'&&r.ask===null,`a colour answer: hex lower-cased, name tidied, plansAs and existing kept, ΔE00 given (${r.dE})`);
    reply=()=>[200,{...COL,hex:'#1d4b5a',plansAs:'stone',existing:'nope'}];
    r=await J(await call({what:'colour',text:'petrol blue',type:'tie'}));
    ok(['steelblue','slate','deepblue'].includes(r.plansAs)&&D.baseFor('#1d4b5a',['charcoal','steelblue','lightblue','slate'])==='steelblue','a plansAs outside the tie\'s list is replaced by the same family, never charcoal (petrol blue -> '+r.plansAs+')');
    ok(r.existing&&r.existing!=='nope'&&typeof r.dE==='number','an existing outside the lists is snapped to the nearest by ΔE00');
    reply=()=>[200,{...COL,plansAs:'ownmoss',existing:'ownmoss',hex:'#5b6c3b'}];
    r=await J(await call({what:'colour',text:'moss',type:'tie',custom}));
    ok(r.existing==='ownmoss'&&r.dE<1&&r.plansAs!=='ownmoss','an own colour can be the existing one, never plansAs');
    reply=()=>[200,{...COL,hex:'#123456'}];
    r=await J(await call({what:'colour',text:'olive drab #4a5d23',type:'pants'}));
    ok(r.hex==='#4a5d23','a hex in the description wins over Claude\'s');
    reply=()=>[200,{...COL,hex:'burgundy'}];
    r=await J(await call({what:'colour',text:'faded burgundy',type:'tie'}));
    ok(r.s===422,'an unusable hex answers 422');
    reply=()=>[200,{...COL,kind:'unclear',hex:'#000000',ask:'Which shade do you mean?'}];
    r=await J(await call({what:'colour',text:'something nice',type:'tie'}));
    ok(r.s===200&&r.kind==='unclear'&&r.ask==='Which shade do you mean?'&&!('hex' in r)&&!('plansAs' in r),'a non-colour answer returns only kind and ask');
    // ---- the pattern
    reply=()=>[200,PAT];sent=[];
    r=await J(await call({what:'pattern',text:'a small basketweave like a hopsack',type:'blazer',colours:{main:'navy'},pattern:'solid',custom}));
    ok(sent[0].body.output_config.effort==='medium'&&sent[0].body.max_tokens===8000&&/Pattern keys/.test(sent[0].body.system[0].text)&&/own-grenadine-fina = Grenadine fina/.test(sent[0].body.system[1].text),'a pattern runs at effort medium, max_tokens 8000, with the pattern table and the owner\'s patterns');
    ok(/main very dark navy|main navy \(#1b2a4a\)/.test(sent[0].body.messages[0].content[0].text)&&/The pattern now: solid/.test(sent[0].body.messages[0].content[0].text),'the item\'s colours and pattern go in the per-call text');
    ok(r.s===200&&r.plansAs==='nailhead'&&r.look.layout==='texture'&&r.look.tex.grid.join()==='1100,1100,0011,0011'&&r.look.tr===70&&r.look.tex.contrast==='subtle'&&r.name==='hopsack','a texture look: the grid kept, repeats across, the name tidied');
    reply=()=>[200,{...PAT,plansAs:'solid'}];
    r=await J(await call({what:'pattern',text:'hopsack',type:'suit'}));
    ok(r.plansAs==='nailhead','a weave answered "solid" moves to the type\'s first weave (nailhead on a suit)');
    reply=()=>[200,{...PAT,look:{...PAT.look,texture:{...PAT.look.texture,grid:['1111','1111']}}}];
    r=await J(await call({what:'pattern',text:'hopsack',type:'suit'}));
    ok(r.look.layout==='none','a grid without both tones is dropped (layout none)');
    reply=()=>[200,{...PAT,name:'tonal windowpane',plansAs:'windowpane',look:{layout:'windowpane',texture:null,across:{bands:[{colour:'main',widthPct:95},{colour:'lighter',widthPct:5}]},along:{bands:[{colour:'main',widthPct:95},{colour:'lighter',widthPct:5}]},motif:null,repeatsAcrossItem:5}}];
    r=await J(await call({what:'pattern',text:'tonal windowpane',type:'suit'}));
    ok(r.look.across.length===2&&r.look.across[1][0]==='lighter'&&Math.abs(r.look.across[0][1]-.95)<1e-6&&r.look.along&&r.look.tr===5,'bands are roles only, shares of a repeat each way');
    reply=()=>[200,{...PAT,plansAs:'pinstripe',existing:'xx'}];
    r=await J(await call({what:'pattern',text:'hopsack',type:'tie'}));
    ok(r.plansAs!=='pinstripe'&&PATS_TIE.includes(r.plansAs)&&r.existing===r.plansAs,'plansAs outside the type\'s list is replaced, existing snapped');
    reply=()=>[200,{...PAT,kind:'material',ask:null}];
    r=await J(await call({what:'pattern',text:'corduroy',type:'pants'}));
    ok(r.kind==='material'&&/Material/.test(r.ask)&&!r.look,'a material answer says to use the Material field');
    // ---- the owner is never counted; a tester is
    const inv=await J(await call({name:'Tess'},'owner',env,'POST','invites'));
    {const k='invite:'+sha(inv.code),rec=JSON.parse(store.get(k));rec.created-=8*86400000;store.set(k,JSON.stringify(rec))}   // past the first week (no doubling)
    let me=await J(await call(null,inv.code,env,'GET','me'));
    ok(me.caps&&me.caps.describe===40&&me.used.describe===0,'GET /me gives a tester the describe cap (40 a day)');
    reply=()=>[200,COL];
    for(let k=0;k<3;k++)await call({what:'colour',text:'faded burgundy',type:'tie'},inv.code);
    me=await J(await call(null,inv.code,env,'GET','me'));
    ok(me.used.describe===3,'each tester lookup is counted ('+me.used.describe+')');
    reply=()=>[500,{type:'error',error:{type:'api_error',message:'Internal error'}}];
    r=await J(await call({what:'colour',text:'faded burgundy',type:'tie'},inv.code));
    me=await J(await call(null,inv.code,env,'GET','me'));
    ok(r.s===502&&me.used.describe===3,'a failed lookup gives its count back');
    ok(r.message==='The colour or pattern couldn’t be looked up just now. Try again later.'&&!/Claude|API/.test(r.detail||''),'a tester reads plain words (PLAIN.describe): '+(r.detail||r.message));
    reply=()=>[200,{...COL,hex:'nope'}];
    await call({what:'colour',text:'x',type:'tie'},inv.code);me=await J(await call(null,inv.code,env,'GET','me'));
    ok(me.used.describe===3,'a 422 gives its count back too');
    reply=()=>[200,{...COL,kind:'not-clothing'}];
    await call({what:'colour',text:'tell me a joke',type:'tie'},inv.code);me=await J(await call(null,inv.code,env,'GET','me'));
    ok(me.used.describe===4,'a non-colour answer still counts (it was a paid call)');
    {const T=await J(await call({name:'Low',caps:{describe:4}},'owner',env,'POST','invites'));const k='invite:'+sha(T.code),rec=JSON.parse(store.get(k));rec.created-=8*86400000;store.set(k,JSON.stringify(rec));
      reply=()=>[200,COL];for(let i=0;i<4;i++)await call({what:'colour',text:'a',type:'tie'},T.code);sent=[];
      r=await J(await call({what:'colour',text:'a',type:'tie'},T.code));
      ok(r.s===429&&r.what==='describe'&&r.message==='Today’s limit of 4 colour and pattern lookups is used up. It starts again at midnight UTC.'&&sent.length===0,'over the cap: 429 in plain words, before Claude ('+r.message+')')}
    {const e2={...env,TESTER_DAILY_TOTAL:JSON.stringify({describe:8})};reply=()=>[200,COL];sent=[];
      const T=await J(await call({name:'All'},'owner',e2,'POST','invites'));let last;for(let i=0;i<4;i++)last=await J(await call({what:'colour',text:'a',type:'tie'},T.code,e2));
      ok(last.s===429&&last.all===true&&/for everyone testing the app/.test(last.message),'the all-testers total stops lookups when used up ('+last.message+')')}
    sent=[];for(let i=0;i<50;i++)await call({what:'colour',text:'a',type:'tie'});
    me=await J(await call(null,'owner',env,'GET','me'));
    ok(sent.length===50&&me.caps===null&&!me.used.describe,'the owner has no cap and is not counted');
    // ---- routing
    ok((await call(null,'owner',env,'GET','describe')).status===405&&(await call({},'owner',env,'POST','describez')).status===404,'GET /describe is 405, /describez 404');
    ok((await call({what:'colour',text:'a',type:'tie'},'owner',{...env,ANTHROPIC_API_KEY:undefined})).status===501,'without the Claude key: 501');
    ok((await call({what:'colour',text:'a',type:'tie'},'nobody')).status===403,'an unknown code is refused');
    // ---- the 45 prompt cases (tools/describe-eval.js) are not run here: without a token the script sends nothing
    {const {spawnSync}=require('child_process'),e2={...process.env};delete e2.DW_WORKER;delete e2.DW_TOKEN;delete e2.ANTHROPIC_API_KEY;
      const a=spawnSync(process.execPath,[path.join(ROOT,'tools','describe-eval.js')],{env:e2,encoding:'utf8'}),b=spawnSync(process.execPath,[path.join(ROOT,'tools','describe-eval.js'),'--direct'],{env:e2,encoding:'utf8'});
      ok(a.status===2&&/Nothing was sent/.test(a.stderr)&&b.status===2&&/ANTHROPIC_API_KEY/.test(b.stderr),'tools/describe-eval.js (the 45 paid cases) refuses to run without an explicit token')}
    // ---- the tables: the per-type lists the prompt shows are the worker's own
    const T=D.descTables();
    ok(/tie: navy, darknavy/.test(T.colour)&&/shirt: solid, stripe/.test(T.pattern)&&T.colour.length>2000,'the tables list every type (fixed text '+T.colour.length+' / '+T.pattern.length+' characters)');
  }finally{globalThis.fetch=realFetch}
};
const PATS_TIE=['solid','woven','stripe','polka-dot','paisley','check','tonal-check','foulard','knit','other'];
