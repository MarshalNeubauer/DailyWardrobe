// The worker's accents (2026-11-16, the owner's approved job "keep an item's extra colors"; Claude mocked by a fetch stub, nothing paid):
// the plain single tag, the multi-item tag and the close-up reader's colour half ask for up to 4 further colours beyond the three main ones;
// the answer is cleaned to known keys (the list's and the owner's own), never one of the three main colours, no repeats, at most 4; the
// picker's calls (freeColors / freePattern) don't ask; the plain tag's schema stays smaller than the freeColors one the API compiles; an
// answer without accents (an older reply) leaves the field out, and the fields an older app reads are unchanged.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const T=await import(pathToFileURL(path.join(ROOT,'worker/tag.js')).href);
  const IMG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  const realFetch=globalThis.fetch;let sent=[],answer=null;
  globalThis.fetch=async(href,init)=>{if(String(href)!=='https://api.anthropic.com/v1/messages')return new Response('',{status:404});
    const b=JSON.parse(init.body);sent.push(b);const a=typeof answer==='function'?answer(b):answer;
    return new Response(JSON.stringify({model:'claude-opus-5-5',stop_reason:'end_turn',usage:{},content:[{type:'text',text:JSON.stringify(a)}]}),{status:200,headers:{'content-type':'application/json'}})};
  const base={type:'tie',primaryColor:'navy',secondaryColor:'burgundy',tertiaryColor:'cream',pattern:'paisley',metal:null,leather:null,dial:null,band:null,bezel:null,trouserKind:null,shoeStyle:null,
    confidence:{type:'high',primaryColor:'high',pattern:'high'},altColor:'none',altPattern:'none',newColor:null,newPattern:null,clothBox:null,patternBox:null,weave:null,material:{key:'silk',confidence:'medium',why:''}};
  const env={APP_TOKEN:'t',ANTHROPIC_API_KEY:'k',CLAUDE_RETRY_MS:'0'};
  const post=async(p,body)=>{const r=await worker.fetch(new Request('https://w.test/'+p,{method:'POST',headers:{'content-type':'application/json','x-app-token':'t'},body:JSON.stringify(body)}),env);return {s:r.status,...(await r.json())}};
  const tag=async(extra,a)=>{answer=a;sent=[];return post('',{image:IMG,...extra})};
  try{
    // the plain single tag asks, with the rule in the cached prompt
    let j=await tag({},{...base,accents:['gold','red']});
    const sch=sent[0].output_config.format.schema,sys=sent[0].system[0].text;
    ok(sch.properties.accents&&sch.required.includes('accents')&&sch.properties.accents.type==='array'&&sch.properties.accents.items.type==='string'&&!sch.properties.accents.items.enum,'the plain tag asks for accents: an array of plain strings (no enum: the grammar stays small)');
    ok(/accents — up to 4 further distinct colors visible in the pattern beyond the three above/.test(sys)&&/Small specks, logos, labels, shadows and the white paper don't count/.test(sys)&&/\[\] when none/.test(sys)&&/rosegold, gunmetal/.test(sys),'its rule (up to 4, most visible first, specks/logos/labels/shadows/paper don\'t count, [] when none) and the full color list are in the cached prompt');
    ok(JSON.stringify(j.accents)==='["gold","red"]','the accents come back as given ('+JSON.stringify(j.accents)+')');
    // cleaned: known keys only, case and spaces tidied, the three main colours dropped, no repeats, at most 4
    j=await tag({},{...base,accents:['Gold','navy','light blue','gold','Burgundy','<b>red</b>','teal','cream','Dark Gray','green','olive','pink']});
    ok(JSON.stringify(j.accents)==='["gold","lightblue","darkgrey","green"]','cleaned: case and spaces tidied (light blue = lightblue, Dark Gray = darkgrey), the main three (navy, burgundy, cream) and unknown words (teal, markup) dropped, no repeats, at most 4 ('+JSON.stringify(j.accents)+')');
    j=await tag({},{...base,accents:'gold, red'});ok(Array.isArray(j.accents)&&j.accents.length===0,'a malformed answer (a string) gives []');
    j=await tag({},{...base,accents:[]});ok(Array.isArray(j.accents)&&j.accents.length===0,'none: []');
    // the owner's own colours count as known (sent as custom.colors)
    j=await tag({custom:{colors:[{key:'ownmushroom',name:'Mushroom',hex:'#9a8a78',types:['tie']}]}},{...base,accents:['ownmushroom','ownnope','gold']});
    ok(JSON.stringify(j.accents)==='["ownmushroom","gold"]','an own colour (ownmushroom) is kept; an own key the owner doesn\'t have is dropped ('+JSON.stringify(j.accents)+')');
    // an older reply without the field: left out; the fields an older app reads are unchanged
    const {accents:_,...noAcc}=base;j=await tag({},noAcc);
    ok(!('accents' in j),'an answer without accents (an older reply) leaves the field out');
    j=await tag({},{...base,accents:['gold']});
    ok(j.type==='tie'&&j.primaryColor==='navy'&&j.secondaryColor==='burgundy'&&j.tertiaryColor==='cream'&&j.pattern==='paisley'&&j.material&&j.material.key==='silk','the fields an older app reads are as before (an app from before ignores accents)');
    // the picker's calls don't ask (their schema is near the API's limit)
    for(const x of [{freeColors:true},{freePattern:true}]){await tag(x,base);const s=sent[0].output_config.format.schema;
      ok(!s.properties.accents&&!/accents — up to 4/.test(sent[0].system[0].text),`the picker's call (${Object.keys(x)[0]}) doesn't ask for accents`)}
    // the schema's size: smaller than the freeColors one the API already compiles, also with 40 own colours
    const c=T.cleanCustom({}),plain=JSON.stringify(T.tagSchema(c,true,false,false)),free=JSON.stringify(T.tagSchema(c,true,true,false));
    const noAccS=JSON.stringify((s=>({...s,properties:{...s.properties,accents:undefined}}))(T.tagSchema(c,true,false,false)));
    const own40=T.cleanCustom({colors:Array.from({length:40},(_,n)=>({key:'own'+'abcdefghijklmnopqrstuvwxyz'[n%26]+(n>=26?'x':'')+'shade',hex:'#123456',name:'x'}))});
    const p40=JSON.stringify(T.tagSchema(own40,true,false,false)).length,f40=JSON.stringify(T.tagSchema(own40,true,true,false)).length;
    ok(plain.length<free.length&&plain.length-noAccS.length<100&&p40<f40,`the plain tag's schema with accents (${plain.length} characters; accents add ${plain.length-noAccS.length}) stays below the freeColors one (${free.length}); with 40 own colours ${p40} < ${f40}`);
    ok(JSON.stringify(T.cleanAccents(['red','red','gold','blue','green','pink','olive'],['navy'],[]))==='["red","gold","blue","green"]'&&T.cleanAccents(null,[],[]).length===0,'cleanAccents: no repeats, at most 4; null gives []');
    // the multi-item tag: each item's accents, cleaned against its own main colours
    answer={items:[{...base,confidence:'high',box:{x:0,y:0,w:400,h:900},accents:['gold','navy','gold','red']},{...base,primaryColor:'gold',confidence:'high',box:{x:500,y:0,w:400,h:900},accents:['gold','green']}]};sent=[];
    j=await post('tag-many',{image:IMG});
    {const s=sent[0].output_config.format.schema.properties.items.items;
      ok(s.properties.accents&&s.required.includes('accents')&&/accents — up to 4/.test(sent[0].system[0].text),'the multi-item tag asks for each item\'s accents');
      ok(j.items&&JSON.stringify(j.items.map(i=>i.accents))==='[["gold","red"],["green"]]','each item\'s accents are cleaned against its own three colours ('+JSON.stringify(j.items&&j.items.map(i=>i.accents))+')')}
    // the close-up reader (what:'both'): the colour half asks and cleans; the pattern half doesn't
    const colAns={kind:'colour',match:'existing',existing:'navy',name:'navy',hex:'#1b2a4a',plansAs:'navy',fitsType:true,confidence:'high',why:'',ask:null,accents:['gold','navy','burgundy','rust','red','pink','green']};
    const patAns={kind:'pattern',match:'existing',existing:'paisley',name:'paisley',description:'',plansAs:'paisley',look:{layout:'none',texture:null,across:null,along:null,motif:null,repeatsAcrossItem:1},colourHint:null,confidence:'high',why:'',ask:null,material:{key:'silk',confidence:'medium',why:''}};
    answer=b=>b.output_config.format.schema.properties.plansAs.enum.includes('paisley')?patAns:colAns;sent=[];
    j=await post('describe',{what:'both',type:'tie',colours:{main:'navy',second:'burgundy',third:'cream'},pattern:'paisley',closeup:IMG});
    {const cs=sent.find(b=>b.output_config.format.schema.properties.fitsType),ps=sent.find(b=>!b.output_config.format.schema.properties.fitsType);
      ok(j.s===200&&JSON.stringify(j.colour.accents)==='["gold","rust","red","pink"]','the reader\'s colour half gives the accents, cleaned (the item\'s three and the main read dropped, at most 4: '+JSON.stringify(j.colour&&j.colour.accents)+')');
      ok(cs&&cs.output_config.format.schema.properties.accents&&/list the cloth's further colors/.test(cs.system[0].text)&&/second burgundy/.test(JSON.stringify(cs.messages)),'its schema and cached text ask for them, and the item\'s second and third colours are named');
      ok(ps&&!ps.output_config.format.schema.properties.accents&&!('accents' in j.pattern),'the pattern half doesn\'t')}
    // a single colour lookup (the New color sheet) keeps its schema
    answer={...colAns,accents:undefined};sent=[];await post('describe',{what:'colour',type:'tie',text:'navy'});
    ok(!sent[0].output_config.format.schema.properties.accents,'a single colour lookup (New color) doesn\'t ask for accents');
  }finally{globalThis.fetch=realFetch}
};
