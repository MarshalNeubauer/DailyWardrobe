// The photo tagger's material suggestion (worker/tag.js, 2026-11-15; Claude mocked by a fetch stub, nothing paid): the plain single tag
// asks for {key, confidence, why} with the rules in the cached prompt; the colour picker's calls (freeColors / freePattern) don't; the
// answer is held to the materials audit's tiers (a cloth plain to see may be high, a good bet medium with a close-up and low without,
// a fiber low, socks low), a key off the type's list or one repeating the pattern is "none", and the schema stays smaller than the
// freeColors one the API already compiles.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const T=await import(pathToFileURL(path.join(ROOT,'worker/tag.js')).href);
  const IMG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  const realFetch=globalThis.fetch;let sent=null,answer=null;
  globalThis.fetch=async(href,init)=>{if(String(href)!=='https://api.anthropic.com/v1/messages')return new Response('',{status:404});
    sent=JSON.parse(init.body);return new Response(JSON.stringify({model:'claude-opus-5-5',stop_reason:'end_turn',usage:{},content:[{type:'text',text:JSON.stringify(answer)}]}),{status:200,headers:{'content-type':'application/json'}})};
  const base={type:'shirt',primaryColor:'white',secondaryColor:'none',tertiaryColor:'none',pattern:'solid',metal:null,leather:null,dial:null,band:null,bezel:null,trouserKind:null,shoeStyle:null,
    confidence:{type:'high',primaryColor:'high',pattern:'high'},altColor:'none',altPattern:'none',newColor:null,newPattern:null,clothBox:null,patternBox:null,weave:null};
  const tag=async(extra,a)=>{answer=a;const r=await worker.fetch(new Request('https://w.test/',{method:'POST',headers:{'content-type':'application/json','x-app-token':'t'},body:JSON.stringify({image:IMG,...extra})}),{APP_TOKEN:'t',ANTHROPIC_API_KEY:'k',CLAUDE_RETRY_MS:'0'});return r.json()};
  try{
    let j=await tag({},{...base,material:{key:'linen',confidence:'high',why:'Slubs and sharp creases.'}});
    const sch=sent.output_config.format.schema,sys=sent.system[0].text;
    ok(sch.properties.material&&sch.required.includes('material')&&sch.properties.material.properties.key.type==='string'&&!sch.properties.material.properties.key.enum,'the plain tag asks for the material: {key, confidence, why}, the key a plain string (no enum of every type\'s names)');
    ok(/Materials per type:/.test(sys)&&/shirt: cotton, poplin, linen/.test(sys)&&/"none" is always allowed/.test(sys)&&/Never give the pattern or weave as the material/.test(sys)&&/Without a close-up, any fiber is low/.test(sys),'its rules and per-type lists are in the cached prompt');
    ok(j.material&&j.material.key==='linen'&&j.material.confidence==='high'&&j.material.why==='Slubs and sharp creases.','a cloth plain to see (linen) stays high, even without a close-up');
    for(const x of [{freeColors:true},{freePattern:true}]){await tag(x,base);const s=sent.output_config.format.schema;
      ok(!s.properties.material&&!/Materials per type/.test(sent.system[0].text),`the picker's call (${Object.keys(x)[0]}) has no material (its schema is near the API's limit)`)}
    const CU='data:image/jpeg;base64,'+Buffer.from('cloth').toString('base64');
    j=await tag({},{...base,material:{key:'performance stretch',confidence:'high',why:''}});ok(j.material.confidence==='low','a good bet without a close-up is low (performance stretch)');
    j=await tag({closeup:CU},{...base,material:{key:'performance stretch',confidence:'high',why:''}});ok(j.material.confidence==='medium','with a close-up it is medium at most');
    j=await tag({closeup:CU},{...base,material:{key:'cotton blend',confidence:'medium',why:''}});ok(j.material.confidence==='low','a fiber call (cotton blend) is low');
    j=await tag({closeup:CU},{...base,material:{key:'twill',confidence:'high',why:''}});ok(j.material.key==='none','a weave is not a shirt material: none');
    j=await tag({closeup:CU},{...base,type:'tie',pattern:'knit',material:{key:'silk',confidence:'high',why:''}});ok(j.material.key==='silk'&&j.material.confidence==='medium','a silk tie with a close-up: medium');
    j=await tag({closeup:CU},{...base,type:'socks',material:{key:'merino wool',confidence:'high',why:''}});ok(j.material.confidence==='low','socks are always low');
    j=await tag({closeup:CU},{...base,type:'suit',pattern:'tweed',material:{key:'tweed',confidence:'high',why:''}});ok(j.material.key==='none','the pattern again (tweed on a tweed suit) is none');
    j=await tag({},{...base,type:'shoes',material:{key:'suede',confidence:'high',why:''}});ok(!('material' in j),'shoes have no material list: no material (their leather is its own field)');
    j=await tag({},{...base,material:{key:'Linen',confidence:'sure',why:'<b>x</b>'}});ok(j.material.key==='linen'&&j.material.confidence==='low'&&!/[<>]/.test(j.material.why),'case is tidied, an unknown confidence is low, the why has no markup');
    j=await tag({},base);ok(!('material' in j),'an answer without a material (an older reply) leaves it out');
    // the schema's size (2026-11-13: ownColors with ownPattern was "compiled grammar is too large")
    const c=T.cleanCustom({}),plain=JSON.stringify(T.tagSchema(c,true,false,false)),free=JSON.stringify(T.tagSchema(c,true,true,false)),noMat=JSON.stringify({...T.tagSchema(c,true,true,false),properties:{...T.tagSchema(c,true,true,false).properties,ownColors:undefined}});
    ok(plain.length<free.length&&plain.length-noMat.length<400,`the plain tag's schema with the material (${plain.length} characters) is smaller than the freeColors one the API compiles (${free.length}), and the material adds ${plain.length-noMat.length}`);
    ok(T.cleanMaterial({key:'wool',confidence:'high'},'watch')===null&&T.cleanMaterial(null,'suit')===null,'cleanMaterial: no list or no answer gives null');
  }finally{globalThis.fetch=realFetch}
};
