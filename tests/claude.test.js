// Photo tagging through the Claude API (api.anthropic.com mocked): request shape, parsing, errors, Workers AI fallback, app messages.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const IMG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  const realFetch=globalThis.fetch;let sent=null,reply=null;
  globalThis.fetch=async(href,init)=>{if(String(href)!=='https://api.anthropic.com/v1/messages')return new Response('',{status:404});
    sent={headers:init.headers,body:JSON.parse(init.body)};const [status,b]=reply();return new Response(JSON.stringify(b),{status,headers:{'content-type':'application/json'}})};
  const tag=(env,img=IMG)=>worker.fetch(new Request('https://w.test/',{method:'POST',headers:{'content-type':'application/json','x-app-token':'t'},body:JSON.stringify({image:img})}),{APP_TOKEN:'t',...env});
  const answer={type:'shirt',primaryColor:'darknavy',secondaryColor:'none',tertiaryColor:'none',pattern:'solid',metal:null,leather:null,dial:null,band:null,bezel:null};
  try{
    reply=()=>[200,{model:'claude-opus-5-5',stop_reason:'end_turn',content:[{type:'thinking',thinking:''},{type:'text',text:JSON.stringify(answer)}]}];
    let r=await tag({ANTHROPIC_API_KEY:'sk-test'});const j=await r.json();
    ok(r.status===200&&j.type==='shirt'&&j.primaryColor==='darknavy','a Claude answer is returned to the app as the tag object');
    ok(sent.headers['x-api-key']==='sk-test'&&sent.headers['anthropic-version'],'the API key and version headers are sent');
    ok(sent.body.model==='claude-opus-5-5','default model is claude-opus-5-5');
    const c=sent.body.messages[0].content;
    ok(c[0].type==='image'&&c[0].source.type==='base64'&&c[0].source.media_type==='image/png'&&!c[0].source.data.startsWith('data:'),'the photo is sent as a base64 image block (data: prefix stripped)');
    const sch=sent.body.output_config.format;
    ok(sch.type==='json_schema'&&sch.schema.additionalProperties===false&&sch.schema.required.length===Object.keys(sch.schema.properties).length&&sch.schema.required.length>=16,'structured output: a strict JSON schema with every field required (the tag plus confidence, runner-up, suggestions and the cloth box)');
    ok(sch.schema.properties.primaryColor.enum.includes('darknavy')&&sch.schema.properties.primaryColor.enum.includes('wine'),'the colour enum includes the new colours');
    ok(sent.body.fallbacks==='default'&&sent.headers['anthropic-beta']==='server-side-fallback-2026-07-01','refusal fallback is enabled for Opus');
    ok(!('temperature' in sent.body)&&!('thinking' in sent.body),'no sampling or thinking parameters (rejected on current models)');
    await tag({ANTHROPIC_API_KEY:'k',CLAUDE_MODEL:'claude-haiku-5-5'});
    ok(sent.body.model==='claude-haiku-5-5'&&!('fallbacks' in sent.body)&&!sent.headers['anthropic-beta'],'CLAUDE_MODEL overrides the model; no fallback parameter on Haiku');
    // the worker's colour list matches the app's
    const appCols=await (async()=>{const b=await chromium.launch();const p=await b.newPage();await p.goto(url);await p.waitForFunction(()=>window.appReady);const k=await p.evaluate(()=>Object.keys(COLORS));await b.close();return k})();
    ok(appCols.slice().sort().join()===sch.schema.properties.primaryColor.enum.slice().sort().join(),'the worker colour enum matches COLORS in the app');
    // errors
    reply=()=>[401,{type:'error',error:{type:'authentication_error',message:'invalid x-api-key'}}];
    r=await tag({ANTHROPIC_API_KEY:'bad'});let e=await r.json();
    ok(r.status===502&&/ANTHROPIC_API_KEY/.test(e.detail),`a bad key says to check the secret (${e.detail})`);
    reply=()=>[400,{type:'error',error:{type:'invalid_request_error',message:'Your credit balance is too low to access the Anthropic API.'}}];
    e=await (await tag({ANTHROPIC_API_KEY:'k'})).json();
    ok(/Billing/.test(e.detail),'no credits says to add credits');
    reply=()=>[200,{stop_reason:'refusal',content:[]}];
    e=await (await tag({ANTHROPIC_API_KEY:'k'})).json();
    ok(/declined/.test(e.detail),'a refusal is reported, not parsed');
    // without a key, Workers AI is used
    sent=null;let aiUsed=false;
    r=await tag({AI:{run:async()=>{aiUsed=true;return {response:answer}}}});
    ok(aiUsed&&sent===null&&(await r.json()).primaryColor==='darknavy','without ANTHROPIC_API_KEY the Workers AI binding is used');
    e=await (await tag({})).json();
    ok(/ANTHROPIC_API_KEY/.test(e.detail),'with neither, the worker says what to set');
    // the app shows a tagging error instead of silently guessing
    const b=await chromium.launch();const ctx=await b.newContext();
    await ctx.route('https://w.test/**',async route=>{const q=route.request();const res=await worker.fetch(new Request(q.url(),{method:q.method(),headers:q.headers(),body:q.postData()}),{APP_TOKEN:'t',ANTHROPIC_API_KEY:'bad'});
      await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:await res.text()})});
    reply=()=>[401,{type:'error',error:{type:'authentication_error',message:'invalid x-api-key'}}];
    const p=await ctx.newPage();await p.goto(url);await p.evaluate(()=>{localStorage.setItem('worker_url','https://w.test/');localStorage.setItem('app_token','t')});await p.reload();await p.waitForFunction(()=>window.appReady);
    await p.evaluate(async src=>{show('add');const blob=await (await fetch(src)).blob();await addFiles([new File([blob],'x.png',{type:'image/png'})])},IMG);
    ok(/Photo tagging failed: Reading photos isn’t available on this server yet/.test(await p.textContent('#note')),'the Add screen shows why tagging failed, in plain words (a connection whose role is not known yet: ui.js plainErr)');
    ok(await p.evaluate(()=>{rememberRole({role:'owner'});return /ANTHROPIC_API_KEY/.test(tagFailText(500,{},'invalid x-api-key: add an ANTHROPIC_API_KEY secret'))}),'the owner reads the technical reason');
    reply=()=>[200,{model:'claude-opus-5-5',stop_reason:'end_turn',usage:{input_tokens:1,output_tokens:1},content:[{type:'text',text:JSON.stringify(answer)}]}];
    await ctx.unroute('https://w.test/**');
    await ctx.route('https://w.test/**',async route=>{const q=route.request();const res=await worker.fetch(new Request(q.url(),{method:q.method(),headers:q.headers(),body:q.postData()}),{APP_TOKEN:'t',ANTHROPIC_API_KEY:'k'});
      await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:await res.text()})});
    await p.evaluate(async src=>{const blob=await (await fetch(src)).blob();await addFiles([new File([blob],'x.png',{type:'image/png'})])},IMG);
    ok((await p.textContent('#queue')).includes('Tagged by Claude (claude-opus-5-5).')&&!(await p.textContent('#queue')).includes('Cloudflare AI'),'each photo card says which model tagged it');
    ok(/read by Claude \(claude-opus-5-5\)/.test(await p.textContent('#note')),`the Add screen says which model tagged the photo ("${await p.textContent('#note')}")`);
    await b.close();
    // freeColors (the colour picker's Ask Claude): Claude's own colour names and shades, outside the list, tidied
    const free={...answer,confidence:{type:'high',primaryColor:'low',pattern:'high'},altColor:'none',altPattern:'none',newColor:null,newPattern:null,clothBox:null,patternBox:null,weave:null,
      ownColors:{primary:{name:'Bottle Green!',hex:'#1F4A3A'},secondary:{name:'x',hex:'#zz0000'},tertiary:null}};
    reply=()=>[200,{model:'claude-opus-5-5',stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify(free)}]}];
    const ask2=extra=>worker.fetch(new Request('https://w.test/',{method:'POST',headers:{'content-type':'application/json','x-app-token':'t'},body:JSON.stringify({image:IMG,...extra})}),{APP_TOKEN:'t',ANTHROPIC_API_KEY:'k'});
    let fj=await (await ask2({freeColors:true})).json();
    const fs=sent.body.output_config.format.schema,ft=sent.body.messages[0].content.at(-1).text;
    ok(fs.properties.ownColors&&fs.required.includes('ownColors')&&/ownColors — your own reading/.test(ft),'with freeColors the schema and prompt ask for Claude\'s own colours');
    ok(fj.ownColors&&fj.ownColors.primary.name==='bottle green'&&fj.ownColors.primary.hex==='#1f4a3a'&&fj.ownColors.secondary===null&&fj.ownColors.tertiary===null,`its own colours come back tidied, a bad shade dropped (${JSON.stringify(fj.ownColors)})`);
    await ask2({});
    ok(!sent.body.output_config.format.schema.properties.ownColors&&!/ownColors/.test(sent.body.messages[0].content.at(-1).text),'a normal tag doesn\'t ask for them');
    // freePattern: Claude's own name for the pattern, its description and whether the listed one fits
    reply=()=>[200,{model:'claude-opus-5-5',stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify({...free,ownPattern:{name:'Broken Twill <b>',description:'Ribs reversing every few threads.',fits:'yes'}})}]}];
    fj=await (await ask2({freePattern:true})).json();
    const ps=sent.body.output_config.format.schema;
    ok(ps.properties.ownPattern&&ps.required.includes('ownPattern')&&!ps.properties.ownColors&&/ownPattern — the pattern or weave in your own precise words/.test(sent.body.messages[0].content.at(-1).text),'with freePattern the schema and prompt ask for Claude\'s own pattern name');
    await ask2({freePattern:true,freeColors:true});const both=sent.body.output_config.format.schema.properties;
    ok(both.ownPattern&&!both.ownColors,'asked for both, only the pattern is asked of Claude (both at once is more than the API compiles)');
    fj=await (await ask2({freePattern:true})).json();
    ok(fj.ownPattern&&fj.ownPattern.name==='broken twill b'&&fj.ownPattern.description==='Ribs reversing every few threads.'&&fj.ownPattern.fits===false,`its pattern comes back tidied, fits only when true (${JSON.stringify(fj.ownPattern)})`);
  }finally{globalThis.fetch=realFetch}
};
