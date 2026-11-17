// The tagger's routes after the code review (2026-11-16, fix round A; Claude stubbed by a fetch stub in this process, nothing paid):
// - CR-2-05: the measurement's nearest own colors with a digit in the key (ownrot1) are told to Claude;
// - CR-2-06: an app that knows the new garments may get rubber and NATO straps, two-tone metal, nubuck and braided in the tag's schema
//   and rules; an older app's request and the picker's calls are unchanged;
// - CR-2-08: /pattern, /tag-many and /render read the body as POST / does (over 15 MB refused before reading) and refuse a photo that
//   is not a picture before anything is spent or sent;
// - CR-2-11: a dropped connection to Claude is not retried (the first attempt may have been billed);
// - CR-2-13: no prompt asks for text for the retired photo generator.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const T=await import(pathToFileURL(path.join(ROOT,'worker/tag.js')).href);
  const IMG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  const NEW=['tee','polo','henley','sweater','sweatshirt','hoodie','qzip','cardigan','chore','cargo','pocketsquare'];
  const realFetch=globalThis.fetch;let calls=0,sent=null,mode='ok';
  globalThis.fetch=async(href,init)=>{if(String(href)!=='https://api.anthropic.com/v1/messages')return new Response('',{status:404});
    calls++;sent=JSON.parse(init.body);if(mode==='drop')throw new TypeError('Network connection lost.');
    const pat=!!sent.output_config.format.schema.properties.layout,many=!!sent.output_config.format.schema.properties.items;
    const a=pat?{layout:'stripes',across:{bands:[{role:'ground',name:'navy',hex:'#1f2a44',widthPct:90},{role:'line',name:'white',hex:'#eeeeee',widthPct:10}]},along:null,motif:null,texture:null,camo:null,stripeDirection:'vertical',repeatsInCloseup:3,repeatsAcrossItem:30,paneAspect:1,ignored:'',description:'navy with a white chalk stripe'}
      :many?{items:[]}:{type:'watch',primaryColor:'black',secondaryColor:'none',tertiaryColor:'none',pattern:'solid',metal:'two-tone',leather:null,dial:'black',band:'rubber',bezel:'smooth',trouserKind:null,shoeStyle:null};
    return new Response(JSON.stringify({model:'claude-stub',stop_reason:'end_turn',usage:{},content:[{type:'text',text:JSON.stringify(a)}]}),{status:200,headers:{'content-type':'application/json'}})};
  const env={APP_TOKEN:'t',ANTHROPIC_API_KEY:'k',OPENAI_API_KEY:'o',CLAUDE_RETRY_MS:'0'};
  const post=async(p,body,headers={})=>{const r=await worker.fetch(new Request('https://w.test/'+p,{method:'POST',headers:{'content-type':'application/json','x-app-token':'t',...headers},body:typeof body==='string'?body:JSON.stringify(body)}),env);return {status:r.status,j:await r.json().catch(()=>null)}};
  const sysText=()=>[...(sent.system||[]).map(s=>s.text),...sent.messages[0].content.filter(c=>c.type==='text').map(c=>c.text)].join('\n');
  try{
    // ---- CR-2-05
    const t=T.measuredText({lab:[40,20,5],hex:'#7a4a44',ref:false,src:'closeup',near:[{c:'ownrot1',d:1.8},{c:'burgundy',d:6.2},{c:'<x>',d:7}]});
    ok(/nearest of the owner's colors: ownrot1 \(ΔE 1\.8\), burgundy \(ΔE 6\.2\)\./.test(t)&&/altColor/.test(t),'an own color with a digit in its key is told to Claude as the nearest measured one, with the altColor rule; a malformed key is not');

    // ---- CR-2-06
    let r=await post('',{image:IMG,types:NEW});const sch=sent.output_config.format.schema.properties,rules=sysText();
    ok(sch.band.anyOf[0].enum.join()==='bracelet,leather,rubber,nato'&&sch.metal.anyOf[0].enum.includes('two-tone')&&['nubuck','braided'].every(x=>sch.leather.anyOf[0].enum.includes(x)),'an app that knows the new garments may get rubber and NATO straps, two-tone metal, nubuck and braided');
    ok(/rubber \(a rubber or silicone strap\) or nato/.test(rules)&&/two-tone \(steel and gold together\)/.test(rules)&&/nubuck/.test(rules)&&/braided/.test(rules),'and its rules say what they are');
    ok(r.status===200&&r.j.band==='rubber'&&r.j.metal==='two-tone','an answer with them is passed on');
    await post('',{image:IMG});const old=sent.output_config.format.schema.properties,oldRules=sysText();
    ok(old.band.anyOf[0].enum.join()==='bracelet,leather'&&!old.metal.anyOf[0].enum.includes('two-tone')&&!/rubber \(a rubber|two-tone \(steel|nubuck \(a fine|may be braided/.test(oldRules),'an older app (no types) is asked as before');
    for(const x of [{freeColors:true},{freePattern:true}]){await post('',{image:IMG,types:NEW,...x});const s=sent.output_config.format.schema.properties;
      ok(s.band.anyOf[0].enum.join()==='bracelet,leather','the picker\'s '+Object.keys(x)[0]+' schema is unchanged (near what the API compiles)')}

    // ---- CR-2-08
    for(const p of ['pattern','tag-many']){calls=0;
      const bad=await post(p,{image:'javascript:alert(1)',type:'suit'}),badCu=await post(p,{image:IMG,closeup:'data:image/png;base64,@@',type:'suit'});
      ok(bad.status===400&&badCu.status===400&&calls===0,`/${p}: a photo or close-up that isn't a picture is refused (400) before Claude is asked (${bad.status}, ${badCu.status}, ${calls} calls)`);
      const big=await post(p,'{}',{'content-length':String(16e6)});
      ok(big.status===413&&calls===0,`/${p}: a body over 15 MB is refused before it is read (${big.status})`);
      const fine=await post(p,{image:IMG,closeup:IMG,type:'suit'});ok(fine.status===200&&calls===1,`/${p}: a good request is read and answered (${fine.status})`)}
    const rbig=await post('render','{}',{'content-length':String(16e6)}),rgone=await post('render',{mode:'outfit'});
    ok(rbig.status===413&&rgone.status===410,`/render reads its body the same way (${rbig.status}; an outfit photo still 410: ${rgone.status})`);

    // ---- CR-2-11
    mode='drop';calls=0;r=await post('',{image:IMG});mode='ok';
    ok(r.status===502&&calls===1,`a dropped connection to Claude is not retried: it may already be billed (${r.status}, ${calls} attempt)`);

    // ---- CR-2-13
    await post('',{image:IMG,types:NEW});const a1=sysText();await post('',{image:IMG,types:NEW,freePattern:true});const a2=sysText();await post('pattern',{image:IMG,closeup:IMG,type:'suit'});const a3=sysText();
    ok(![a1,a2,a3].some(x=>/generator/i.test(x))&&[a1,a3].every(x=>/description[^\n]*painter/.test(x)),'no prompt asks for text for the retired photo generator; the descriptions are for the owner and the painter');
  }finally{globalThis.fetch=realFetch}
};
