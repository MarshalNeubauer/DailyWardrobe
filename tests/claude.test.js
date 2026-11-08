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
    ok(sch.type==='json_schema'&&sch.schema.additionalProperties===false&&sch.schema.required.length===10,'structured output: a strict JSON schema with every field required');
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
    ok(/Photo tagging failed: .*ANTHROPIC_API_KEY/.test(await p.textContent('#note')),'the Add screen shows why tagging failed');
    await b.close();
  }finally{globalThis.fetch=realFetch}
};
