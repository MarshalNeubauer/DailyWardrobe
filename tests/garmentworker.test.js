// The worker's new garments (2026-11-16, the owner's approved casual types; Claude and Workers AI stubbed, nothing paid): T-shirt, polo,
// henley, sweater, sweatshirt, hoodie, quarter-zip, cardigan, chore jacket and cargo pants are offered by the tagger only to an app that
// names them in `types` (an older app reads an unknown type as a suit). Without it every request the worker sends (single tag, the
// picker's two calls, /tag-many, Workers AI) is byte-identical to main's before the change (tests/fixtures/garmentworker-old.json,
// recorded by tests/garmentworker-calls.js); with it the types, their colors, pattern lines, material rows and cargo are offered;
// the lists are the app's; the schema stays under the bound; /describe takes the new types.
const path=require('path'),fs=require('fs'),{pathToFileURL}=require('url');
const {oldCalls}=require('./garmentworker-calls.js');
module.exports=async({ok,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const T=await import(pathToFileURL(path.join(ROOT,'worker/tag.js')).href);
  const NEW=['tee','polo','henley','sweater','sweatshirt','hoodie','qzip','cardigan','chore'],ALL=[...NEW,'cargo'];
  // an older app: every request exactly as before
  const old=JSON.parse(fs.readFileSync(path.join(ROOT,'tests/fixtures/garmentworker-old.json'),'utf8')),now=await oldCalls(ROOT);
  for(const k of Object.keys(old))ok(JSON.stringify(now[k])===JSON.stringify(old[k]),`an older app's ${k} request (no types) is byte-identical to before the new garments`);
  // a malformed or foreign types list is no flag
  const junk=await oldCalls(ROOT,{types:'tee'}),foreign=await oldCalls(ROOT,{types:['scarf','pocketsquare']});
  ok(JSON.stringify(junk.single)===JSON.stringify(old.single)&&JSON.stringify(foreign.single)===JSON.stringify(old.single)&&JSON.stringify(foreign.many)===JSON.stringify(old.many),'types as a string, or naming none of them, changes nothing');
  // the lists (core.js keeps the same: tests/colouraudit and tests/materials compare them whole)
  const CAS_P=['white','cream','lightgrey','midgrey','grey','charcoal','black','navy','darknavy','blue','lightblue','steelblue','slate','green','olive','khaki','tan','brown','burgundy','wine','red','rust','pink','purple','gold'],
    CAS_A=['white','cream','lightgrey','grey','charcoal','black','navy','blue','lightblue','red','burgundy','green','olive','tan','brown','gold','rust','pink'],
    KNIT_P=['cream','white','lightgrey','midgrey','grey','charcoal','black','navy','darknavy','blue','steelblue','slate','green','olive','khaki','tan','taupe','brown','burgundy','wine','rust','red','gold'];
  const want={tee:[CAS_P,CAS_A],polo:[CAS_P,CAS_A],henley:[CAS_P,CAS_A],sweater:[KNIT_P,CAS_A],sweatshirt:[CAS_P,CAS_A],hoodie:[CAS_P,CAS_A],qzip:[KNIT_P,CAS_A],cardigan:[KNIT_P,CAS_A],
    chore:[['navy','darknavy','blue','steelblue','olive','green','khaki','tan','stone','brown','rust','black','charcoal','grey','cream'],['black','brown','navy','cream','white','tan','olive']]};
  ok(NEW.every(t=>T.TYPE_LIST.includes(t)&&JSON.stringify(T.TYPE_COLORS[t])===JSON.stringify(want[t])),'each new type is in TYPE_LIST with its colors (main | line)');
  const top=['solid','stripe','heather','other'],knit=['solid','heather','cable','stripe','other'];
  ok(JSON.stringify(NEW.map(t=>T.PATTERN_BY_TYPE[t]))===JSON.stringify([top,top,top,knit,top,top,knit,knit,['solid','other']])&&T.PATTERN_KEYS.includes('heather')&&T.PATTERN_KEYS.includes('cable')&&!T.PATTERN_LIST.includes('heather'),'their patterns (heather, cable among the keys; the old tag enum PATTERN_LIST unchanged)');
  const mats={tee:['cotton','jersey','pima cotton','slub cotton','cotton blend','linen','merino wool','polyester blend'],polo:['piqué','cotton','jersey','pima cotton','merino wool','linen','cotton blend','polyester blend'],
    henley:['cotton','jersey','waffle knit','slub cotton','cotton blend','merino wool','linen'],sweater:['merino wool','lambswool','cashmere','cashmere blend','wool','wool blend','shetland wool','alpaca','mohair blend','cotton'],
    sweatshirt:['cotton','fleece','french terry','loopback cotton','cotton blend','polyester blend'],hoodie:['cotton','fleece','french terry','cotton blend','polyester blend','merino wool'],
    qzip:['merino wool','lambswool','cashmere','wool','wool blend','cotton','fleece','polyester blend'],cardigan:['merino wool','lambswool','cashmere','cashmere blend','wool','wool blend','alpaca','cotton'],
    chore:['canvas','duck canvas','cotton twill','cotton','denim','moleskin','corduroy','wool','waxed cotton','linen']};
  ok(NEW.every(t=>JSON.stringify(T.MATERIALS_BY[t])===JSON.stringify(mats[t])),'their materials');
  ok(T.cleanMaterial({key:'pique',confidence:'high',why:''},'polo',['solid'],false).key==='piqué'&&T.cleanMaterial({key:'fleece',confidence:'high',why:''},'hoodie',['solid'],false).confidence==='high'&&T.cleanMaterial({key:'lambswool',confidence:'high',why:''},'sweater',['solid'],true).confidence==='low','a polo\'s "pique" is piqué; fleece can be high; lambswool (a fiber) is low');
  ok(T.cleanMaterial({key:'heather',confidence:'high',why:''},'tee',['solid'],false).key==='none','a pattern word (heather) is never a material');
  // knownTypes
  ok(JSON.stringify(T.knownTypes({types:['cargo','tee','x']}))==='["tee","cargo"]'&&T.knownTypes({}).length===0&&T.knownTypes(null).length===0,'knownTypes: the named ones, in order; none without an array');
  // an app that knows them: the single tag
  const IMG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  const realFetch=globalThis.fetch;let sent=[],answer=null;
  globalThis.fetch=async(href,init)=>{if(String(href)!=='https://api.anthropic.com/v1/messages')return new Response('',{status:404});
    const b=JSON.parse(init.body);sent.push(b);const a=typeof answer==='function'?answer(b):answer;
    return new Response(JSON.stringify({model:'claude-opus-5-5',stop_reason:'end_turn',usage:{},content:[{type:'text',text:JSON.stringify(a)}]}),{status:200,headers:{'content-type':'application/json'}})};
  const base={type:'sweater',primaryColor:'navy',secondaryColor:'none',tertiaryColor:'none',pattern:'cable',metal:null,leather:null,dial:null,band:null,bezel:null,trouserKind:null,shoeStyle:null,
    confidence:{type:'high',primaryColor:'high',pattern:'high'},altColor:'none',altPattern:'none',newColor:null,newPattern:null,clothBox:null,patternBox:null,weave:null,material:{key:'lambswool',confidence:'low',why:''},accents:[]};
  const env={APP_TOKEN:'t',ANTHROPIC_API_KEY:'k',CLAUDE_RETRY_MS:'0'};
  const post=async(p,body,e=env)=>{const r=await worker.fetch(new Request('https://w.test/'+p,{method:'POST',headers:{'content-type':'application/json','x-app-token':'t'},body:JSON.stringify(body)}),e);return {s:r.status,...(await r.json())}};
  try{
    answer=base;sent=[];let j=await post('',{image:IMG,types:ALL});
    let sch=sent[0].output_config.format.schema,sys=sent[0].system[0].text;
    ok(j.s===200&&j.type==='sweater'&&j.pattern==='cable'&&j.material.key==='lambswool','a tag with the types answers a cable sweater in lambswool');
    ok(NEW.every(t=>sch.properties.type.enum.includes(t))&&sch.properties.pattern.enum.includes('heather')&&sch.properties.trouserKind.anyOf[0].enum.includes('cargo'),'its schema offers the nine types, heather and cable, and cargo pants');
    ok(/raincoat \(trench or mac\),\n  tee \(T-shirt/.test(sys)&&/chore \(chore coat or field jacket/.test(sys)&&/^  sweater: cream, white/m.test(sys)&&/^  chore: navy, darknavy/m.test(sys)&&/sweater, qzip, cardigan:\n    solid, heather/.test(sys)&&/cargo \(pants with patch cargo pockets on the thighs\)\./.test(sys),'its rules name the types, their color rows, their pattern lines and cargo');
    ok(/^    polo: piqué, cotton/m.test(sys)&&/high also for the casual pieces/.test(sys),'its material rules list their materials and the plain-to-see cloths');
    // only some named: only those offered
    answer=base;sent=[];await post('',{image:IMG,types:['tee']});sch=sent[0].output_config.format.schema;sys=sent[0].system[0].text;
    ok(sch.properties.type.enum.includes('tee')&&!sch.properties.type.enum.includes('hoodie')&&!sch.properties.trouserKind.anyOf[0].enum.includes('cargo')&&!/hoodie \(hooded/.test(sys)&&!/^  hoodie:/m.test(sys)&&/^  tee: white/m.test(sys),'types:[tee] offers the T-shirt alone (no hoodie, no cargo)');
    answer=base;sent=[];await post('',{image:IMG,types:['cargo']});sch=sent[0].output_config.format.schema;sys=sent[0].system[0].text;
    ok(sch.properties.trouserKind.anyOf[0].enum.includes('cargo')&&!sch.properties.type.enum.includes('tee')&&JSON.stringify(sch.properties.pattern.enum)===JSON.stringify(old.single.schema.properties.pattern.enum),'types:[cargo] offers cargo pants alone (the pattern enum as before)');
    // the picker's calls with the flag keep it
    for(const x of [{freeColors:true},{freePattern:true}]){sent=[];await post('',{image:IMG,types:ALL,...x});ok(sent[0].output_config.format.schema.properties.type.enum.includes('cardigan'),`the picker's call (${Object.keys(x)[0]}) with the types offers them`)}
    // /tag-many: the same rule
    answer={items:[{...base,type:'chore',pattern:'solid',confidence:'high',box:{x:0,y:0,w:400,h:900}}]};sent=[];j=await post('tag-many',{image:IMG,types:ALL});
    {const s=sent[0].output_config.format.schema.properties.items.items;ok(j.items&&j.items[0].type==='chore'&&s.properties.type.enum.includes('chore')&&s.properties.trouserKind.anyOf[0].enum.includes('cargo')&&/qzip \(quarter-zip pullover/.test(sent[0].system[0].text),'/tag-many with the types offers them and answers a chore jacket')}
    // Workers AI: the same prompt words
    let ai=null;const envAi={APP_TOKEN:'t',AI:{run:async(m,input)=>{ai=input;return {response:{type:'hoodie'}}}}};j=await post('',{image:IMG,types:ALL},envAi);
    ok(j.s===200&&/hoodie \(hooded sweatshirt/.test(ai.messages[1].content[0].text)&&/\{"type":"\.\.\."/.test(ai.messages[1].content[0].text),'the Workers AI fallback with the types names them');
    // the grammar's size: the plain tag with everything stays under the freeColors one the API compiles (before the new garments);
    // the picker's two calls grow by the new enum values only
    const c=T.cleanCustom({}),sz=(k,free,fp)=>JSON.stringify(T.tagSchema(c,true,free,fp,k)).length,oldFree=JSON.stringify(old.free.schema).length;
    ok(sz(ALL,false,false)<oldFree&&sz(ALL,true,false)-sz([],true,false)<150&&sz(ALL,false,true)-sz([],false,true)<150,`schema size: plain ${sz([],false,false)} → ${sz(ALL,false,false)} with the new garments, under the freeColors ${oldFree}; freeColors ${sz([],true,false)} → ${sz(ALL,true,false)}, freePattern ${sz([],false,true)} → ${sz(ALL,false,true)}`);
    // /describe takes the new types: a sweater's color (its list) and a henley's pattern (heather)
    const colAns={kind:'colour',match:'existing',existing:'cream',name:'cream',hex:'#efe4c8',plansAs:'cream',fitsType:true,confidence:'high',why:'',ask:null};
    answer=colAns;sent=[];j=await post('describe',{what:'colour',type:'sweater',text:'oatmeal'});
    ok(j.s===200&&sent.length===1&&/sweater: cream, white/.test(sent[0].system.map(s=>s.text).join('\n')),'/describe a sweater\'s color: accepted, its list in the tables');
    const patAns={kind:'pattern',match:'existing',existing:'heather',name:'heather',description:'a mottled gray',plansAs:'heather',look:{layout:'plain',texture:null,across:null,along:null,motif:null,repeatsAcrossItem:0},colourHint:null,confidence:'high',why:'',ask:null};
    answer=patAns;sent=[];j=await post('describe',{what:'pattern',type:'henley',text:'heather'});
    ok(j.s===200&&sent.length===1&&sent[0].output_config.format.schema.properties.existing.enum.includes('heather'),'/describe a henley\'s pattern: heather is a key it can answer');
  }finally{globalThis.fetch=realFetch}
};
