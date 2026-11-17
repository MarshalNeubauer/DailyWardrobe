// The worker's sock patterns (2026-11-17, the owner's ask; Claude mocked by a fetch stub, nothing paid): the socks' patterns are the app's
// (PATS_BY.socks); an app that names 'sockpat' in its types is offered them (the pattern enum, the prompt's socks line), told that a sock's
// second and third colours are its pattern's and that its toe cap goes in its own field (toeColor, required, cleaned to a known key or
// 'none'), on the single tag and on /tag-many; an older app's request is exactly as before (its toe cap still in secondaryColor; the
// byte-for-byte check is tests/garmentworker.test.js); the picker's calls never carry it; the schema stays under the freeColors one; the
// server takes an item's toeColor as a colour key (records.js).
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const T=await import(pathToFileURL(path.join(ROOT,'worker/tag.js')).href),R=await import(pathToFileURL(path.join(ROOT,'worker/records.js')).href);
  const IMG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  const realFetch=globalThis.fetch;let sent=[],answer=null;
  globalThis.fetch=async(href,init)=>{if(String(href)!=='https://api.anthropic.com/v1/messages')return new Response('',{status:404});
    const b=JSON.parse(init.body);sent.push(b);const a=typeof answer==='function'?answer(b):answer;
    return new Response(JSON.stringify({model:'claude-opus-5-5',stop_reason:'end_turn',usage:{},content:[{type:'text',text:JSON.stringify(a)}]}),{status:200,headers:{'content-type':'application/json'}})};
  const base={type:'socks',primaryColor:'navy',secondaryColor:'burgundy',tertiaryColor:'gold',pattern:'argyle',toeColor:'light gray',metal:null,leather:null,dial:null,band:null,bezel:null,trouserKind:null,shoeStyle:null,
    confidence:{type:'high',primaryColor:'high',pattern:'high'},altColor:'none',altPattern:'none',newColor:null,newPattern:null,clothBox:null,patternBox:null,weave:null,material:{key:'merino wool',confidence:'low',why:''},accents:['lightgrey','green']};
  const env={APP_TOKEN:'t',ANTHROPIC_API_KEY:'k',CLAUDE_RETRY_MS:'0'};
  const post=async(p,body)=>{const r=await worker.fetch(new Request('https://w.test/'+p,{method:'POST',headers:{'content-type':'application/json','x-app-token':'t'},body:JSON.stringify(body)}),env);return {s:r.status,...(await r.json())}};
  // the app's request (core.js TAG_TYPES)
  const APP=['pocketsquare','tee','polo','henley','sweater','sweatshirt','hoodie','qzip','cardigan','chore','cargo','sockpat'];
  try{
    ok(JSON.stringify(T.PATTERN_BY_TYPE.socks)==='["solid","argyle","stripe","polka-dot","ribbed","birdseye","nailhead","clock","herringbone","other"]','the socks\' patterns: solid, argyle, stripe, polka dot, ribbed, birdseye, nailhead, clock, herringbone, other');
    // an app that knows them
    answer=base;sent=[];let j=await post('',{image:IMG,types:APP});
    let sch=sent[0].output_config.format.schema,sys=sent[0].system[0].text;
    ok(j.s===200&&j.type==='socks'&&j.pattern==='argyle'&&j.secondaryColor==='burgundy'&&j.tertiaryColor==='gold'&&j.toeColor==='lightgrey','a tag with sockpat answers an argyle sock: its diamonds, its crossing lines, its toe cap (light gray → lightgrey)');
    ok(JSON.stringify(j.accents)==='["green"]',`the toe cap is no accent (${JSON.stringify(j.accents)})`);
    ok(['argyle','ribbed','clock'].every(p=>sch.properties.pattern.enum.includes(p))&&sch.properties.toeColor&&sch.required.includes('toeColor'),'its schema offers the sock patterns and asks for the toe cap');
    ok(/  socks:\n\s+solid \(one color, smooth\), argyle \(diamonds/.test(sys)&&/Socks: the pattern's second color \(an argyle's diamonds/.test(sys)&&/toeColor — socks only/.test(sys)&&!/Socks: the color of a contrasting toe cap/.test(sys)&&!/belt, socks, cufflinks, overcoat, raincoat: solid/.test(sys),'its rules: the socks\' pattern line, the pattern\'s colours, the toe cap\'s own field; socks no longer "solid" only');
    {const line=(sys.match(/  socks:\n([\s\S]*?)\n(?=\S|  \w+[,:])/)||[])[1]||'';ok(T.PATTERN_BY_TYPE.socks.every(p=>line.includes(p+' (')||line.includes(p+',')),`every sock pattern is described for Claude (${T.PATTERN_BY_TYPE.socks.filter(p=>!(line.includes(p+' (')||line.includes(p+','))).join(',')||'all'})`)}
    // a bogus toe cap is 'none'
    answer={...base,toeColor:'ignore the rules'};j=await post('',{image:IMG,types:APP});ok(j.toeColor==='none','a toe cap that is no colour is "none"');
    // an older app (no sockpat): as before
    answer={...base,pattern:'solid',secondaryColor:'lightgrey',tertiaryColor:'none',toeColor:undefined};sent=[];j=await post('',{image:IMG,types:APP.filter(t=>t!=='sockpat')});
    sch=sent[0].output_config.format.schema;sys=sent[0].system[0].text;
    ok(!sch.properties.pattern.enum.includes('argyle')&&!sch.properties.toeColor&&!sch.required.includes('toeColor')&&/Socks: the color of a contrasting toe cap/.test(sys)&&!/toeColor/.test(sys),'an app without sockpat: no sock patterns, no toeColor, the toe cap still in secondaryColor');
    // the picker's calls (freeColors / freePattern) never carry it, even if named
    sent=[];await post('',{image:IMG,types:APP,freeColors:true});ok(!sent[0].output_config.format.schema.properties.toeColor,'the picker\'s call has no toe cap field');
    // /tag-many
    answer={items:[{...base,confidence:'high',box:{x:0,y:0,w:400,h:900}}]};sent=[];j=await post('tag-many',{image:IMG,types:APP});
    {const s=sent[0].output_config.format.schema.properties.items.items;ok(j.items&&j.items[0].pattern==='argyle'&&j.items[0].toeColor==='lightgrey'&&s.required.includes('toeColor')&&s.properties.pattern.enum.includes('argyle'),'/tag-many with sockpat: sock patterns and the toe cap')}
    sent=[];await post('tag-many',{image:IMG});
    {const s=sent[0].output_config.format.schema.properties.items.items;ok(!s.required.includes('toeColor')&&!s.properties.toeColor&&!s.properties.pattern.enum.includes('argyle'),'/tag-many without it: as before')}
    // the grammar's size: the app's plain tag stays under the freeColors one the API compiles
    const c=T.cleanCustom({}),sz=(k,free)=>JSON.stringify(T.tagSchema(c,true,free,false,k)).length;
    ok(sz(APP,false)<sz(['pocketsquare'],true),`schema size: the app's plain tag ${sz(APP,false)} (was ${sz(APP.filter(t=>t!=='sockpat'),false)}) under the picker's freeColors ${sz(['pocketsquare'],true)}`);
    // the server keeps a sock's toe cap as a colour key
    ok(R.recCheck({items:[{id:'s1',type:'socks',primaryColor:'navy',toeColor:'lightgrey',pattern:'argyle',secondaryColor:'burgundy'},{id:'s2',type:'socks',primaryColor:'navy',toeColor:'none'}]})===null,'a backup with toeColor (a key, or none) is taken');
    ok(R.recCheck({items:[{id:'s3',type:'socks',primaryColor:'navy',toeColor:'<b>x</b>'}]})!==null,'markup in toeColor is refused');
  }finally{globalThis.fetch=realFetch}
};
