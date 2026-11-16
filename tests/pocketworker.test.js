// The worker's pocket square (2026-11-16, the owner's approved feature; Claude mocked by a fetch stub, nothing paid): the type, its colours,
// patterns (with 'border') and materials are the app's; the tag's schema and prompt offer the type only to an app that says it knows it
// (types:['pocketsquare']: an older app reads an unknown type as a suit), on the single tag and on /tag-many; the schema stays under the
// grammar's bound (below the freeColors one the API compiles), and /describe takes the type.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const T=await import(pathToFileURL(path.join(ROOT,'worker/tag.js')).href);
  const IMG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  const realFetch=globalThis.fetch;let sent=[],answer=null;
  globalThis.fetch=async(href,init)=>{if(String(href)!=='https://api.anthropic.com/v1/messages')return new Response('',{status:404});
    const b=JSON.parse(init.body);sent.push(b);const a=typeof answer==='function'?answer(b):answer;
    return new Response(JSON.stringify({model:'claude-opus-5-5',stop_reason:'end_turn',usage:{},content:[{type:'text',text:JSON.stringify(a)}]}),{status:200,headers:{'content-type':'application/json'}})};
  const base={type:'pocketsquare',primaryColor:'white',secondaryColor:'navy',tertiaryColor:'none',pattern:'border',metal:null,leather:null,dial:null,band:null,bezel:null,trouserKind:null,shoeStyle:null,
    confidence:{type:'high',primaryColor:'high',pattern:'high'},altColor:'none',altPattern:'none',newColor:null,newPattern:null,clothBox:null,patternBox:null,weave:null,material:{key:'linen',confidence:'high',why:'slubs'},accents:[]};
  const env={APP_TOKEN:'t',ANTHROPIC_API_KEY:'k',CLAUDE_RETRY_MS:'0'};
  const post=async(p,body)=>{const r=await worker.fetch(new Request('https://w.test/'+p,{method:'POST',headers:{'content-type':'application/json','x-app-token':'t'},body:JSON.stringify(body)}),env);return {s:r.status,...(await r.json())}};
  try{
    // the lists are the app's (core.js keeps the same; tests/colouraudit and materials compare them whole)
    ok(T.TYPE_LIST.includes('pocketsquare')&&T.TYPE_COLORS.pocketsquare&&T.TYPE_COLORS.pocketsquare[0][0]==='white'&&T.PATTERN_BY_TYPE.pocketsquare.includes('border')&&T.PATTERN_LIST.includes('border'),'the type, its colours (white first) and patterns (border) are in the worker\'s lists');
    ok(JSON.stringify(T.MATERIALS_BY.pocketsquare)==='["silk","linen","cotton","wool","silk blend","polyester"]','its materials: silk, linen, cotton, wool, silk blend, polyester');
    // an app that knows it: offered in the enum and the cached rules
    answer=base;sent=[];let j=await post('',{image:IMG,types:['pocketsquare']});
    let sch=sent[0].output_config.format.schema,sys=sent[0].system[0].text;
    ok(j.s===200&&j.type==='pocketsquare'&&j.pattern==='border'&&j.secondaryColor==='navy'&&j.material.key==='linen','a tag with types:[pocketsquare] answers a pocket square, its border and material');
    ok(sch.properties.type.enum.includes('pocketsquare')&&/tieclip, pocketsquare \(a handkerchief/.test(sys)&&/pocketsquare:\n\s+solid, border \(a plain ground with a contrast edge/.test(sys),'its schema\'s type enum and the cached rules offer it, with its own pattern line (border)');
    // an older app (no types): the type is not offered, its rules don't name it
    answer={...base,type:'suit',pattern:'solid',material:{key:'wool',confidence:'low',why:''}};sent=[];j=await post('',{image:IMG});
    sch=sent[0].output_config.format.schema;sys=sent[0].system[0].text;
    ok(!sch.properties.type.enum.includes('pocketsquare')&&!/pocketsquare \(a handkerchief/.test(sys)&&!/^\s+pocketsquare:\n/m.test(sys),'an older app\'s tag: no pocket square in the type enum nor the type list (it would read one as a suit)');
    ok(JSON.stringify(sch.properties.type.enum)===JSON.stringify(['suit','blazer','pants','shirt','tie','tieclip','watch','shoes','belt','socks','cufflinks','overcoat','raincoat']),'its type enum is exactly as before');
    answer=base;sent=[];j=await post('',{image:IMG,types:'pocketsquare'});ok(!sent[0].output_config.format.schema.properties.type.enum.includes('pocketsquare'),'a malformed types (a string) is not the flag');
    // the picker's calls with the flag keep it too
    answer=base;sent=[];await post('',{image:IMG,types:['pocketsquare'],freeColors:true});ok(sent[0].output_config.format.schema.properties.type.enum.includes('pocketsquare'),'the picker\'s call (freeColors) with the flag offers it');
    // /tag-many: the same rule
    answer={items:[{...base,confidence:'high',box:{x:0,y:0,w:400,h:900}}]};sent=[];j=await post('tag-many',{image:IMG,types:['pocketsquare']});
    {const s=sent[0].output_config.format.schema.properties.items.items;ok(j.items&&j.items[0].type==='pocketsquare'&&s.properties.type.enum.includes('pocketsquare')&&/pocketsquare \(a handkerchief/.test(sent[0].system[0].text),'/tag-many with the flag offers it and answers it')}
    sent=[];await post('tag-many',{image:IMG});
    {const s=sent[0].output_config.format.schema.properties.items.items;ok(!s.properties.type.enum.includes('pocketsquare')&&!/pocketsquare \(a handkerchief/.test(sent[0].system[0].text),'/tag-many without it: not offered')}
    // the grammar's size: the pocket square adds a few characters, the plain tag stays under the freeColors one the API compiles
    const c=T.cleanCustom({}),sz=(pq,free)=>JSON.stringify(T.tagSchema(c,true,free,false,pq)).length;
    ok(sz(true,false)<sz(true,true)&&sz(true,false)-sz(false,false)<30&&sz(true,true)-sz(false,true)<30,`schema size: plain ${sz(false,false)} → ${sz(true,false)} with the pocket square, under the freeColors ${sz(true,true)}`);
    // /describe takes the type (its colour list, its patterns)
    const colAns={kind:'colour',match:'existing',existing:'navy',name:'navy',hex:'#1b2a4a',plansAs:'navy',fitsType:true,confidence:'high',why:'',ask:null};
    answer=colAns;sent=[];j=await post('describe',{what:'colour',type:'pocketsquare',text:'navy'});
    ok(j.s===200&&sent.length===1&&sent[0].output_config.format.schema.properties.plansAs.enum.includes('white'),'/describe a pocket square\'s colour: its list (white among them)');
  }finally{globalThis.fetch=realFetch}
};
