// Per-type colour lists: each item type offers only colours it really comes in (main colours and stripe / motif colours),
// the tagger is told the same lists, off-list tags move to the closest allowed colour, and colours already in the wardrobe stay.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const realFetch=globalThis.fetch;let sent=null;
  globalThis.fetch=async(href,init)=>{sent=JSON.parse(init.body);return new Response(JSON.stringify({stop_reason:'end_turn',content:[{type:'text',text:'{"type":"tie","primaryColor":"navy","secondaryColor":"none","tertiaryColor":"none","pattern":"solid","metal":null,"leather":null,"dial":null,"band":null,"bezel":null}'}]}),{status:200,headers:{'content-type':'application/json'}})};
  const browser=await chromium.launch();const p=await browser.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await worker.fetch(new Request('https://w.test/',{method:'POST',headers:{'x-app-token':'t','content-type':'application/json'},body:JSON.stringify({image:'data:image/png;base64,iVBORw0KGgo='})}),{APP_TOKEN:'t',ANTHROPIC_API_KEY:'k'});
    const prompt=sent.messages[0].content.find(c=>c.type==='text').text,schema=sent.output_config.format.schema;
    const wTable={};for(const m of prompt.matchAll(/^  (\w+): ([a-z, ]+) \| ([a-z, ]+)$/gm))wTable[m[1]]=[m[2].split(', '),m[3].split(', ')];
    const dial=(prompt.match(/^  watch dial: ([a-z, ]+)$/m)||[])[1];
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const app=await p.evaluate(()=>({by:Object.fromEntries(Object.entries(COLS_BY).map(([t,v])=>[t,[v.p,v.a]])),dial:DIAL_COLS,types:Object.keys(TYPES),cols:Object.keys(COLORS)}));
    ok(JSON.stringify(wTable)===JSON.stringify(app.by)&&dial===app.dial.join(', '),'the tagger is given exactly the app\'s per-type lists');
    ok(app.types.every(t=>app.by[t])&&Object.values(app.by).flat(2).every(c=>app.cols.includes(c)),'every type has a list, and every listed colour exists');
    ok(JSON.stringify(schema.properties.dial.anyOf[0].enum)===JSON.stringify(app.dial),'watch dials have their own list in the schema');
    const r=await p.evaluate(()=>{const o=t=>COLOR_OPTS(t).map(x=>x[0]);return {
      suit:o('suit'),shirt:o('shirt'),tie:o('tie'),shoes:o('shoes'),clip:o('tieclip'),socks:o('socks'),rain:o('raincoat'),
      fit:[['suit','silver'],['suit','gold'],['tie','white'],['shoes','wine'],['shirt','olive'],['tieclip','navy'],['pants','beige'],['socks','white']].map(([t,c])=>normColFor(t,c)).join(),
      acc:normColFor('suit','white',true)+','+normColFor('suit','pink',true),
      legacy:COLOR_OPTS('suit','pink').some(x=>x[0]==='pink'),fam:['mint','taupe','rust'].map(fam).join()}});
    ok(!['silver','gold','pink','purple','red','white','oxblood','paleyellow'].some(c=>r.suit.includes(c))&&['taupe','khaki','navy','charcoal'].every(c=>r.suit.includes(c)),'suits offer suiting colours only (no watch metals, no shirt or tie colours)');
    ok(['mint','periwinkle','lavender','ivory'].every(c=>r.shirt.includes(c))&&!['silver','gold','olive','oxblood','khaki','tan'].some(c=>r.shirt.includes(c)),'shirts offer shirt colours');
    ok(['silver','rust','lavender','gold'].every(c=>r.tie.includes(c))&&!r.tie.includes('white'),'ties include silver, rust and lavender; no white ties');
    ok(r.shoes.join()==='black,brown,tan,oxblood,burgundy,navy,grey,taupe'&&r.clip.join()==='silver,gold,grey,black','shoes are leather colours; tie clips are metal colours');
    ok(!r.socks.includes('white')&&r.rain.includes('khaki')&&!r.rain.includes('red'),'no white dress socks; raincoats come in trench colours');
    ok(r.fit==='lightgrey,khaki,cream,burgundy,grey,black,cream,lightgrey'||/^lightgrey,/.test(r.fit),`off-list tags move to the closest allowed colour (${r.fit})`);
    ok(/^(white|cream),/.test(r.acc),`stripe colours have their own list (${r.acc})`);
    ok(r.legacy,'a colour an existing item already has stays selectable for it');
    ok(r.fam==='green,tan,brown','new colours (mint, taupe, rust) follow their families in the outfit rules');
    // the live wardrobe's colours (Nov 2026) are all still offered
    const LIVE={suit:{p:['black','darkgrey','midgrey','lightgrey','brown','navy','tan'],a:['brown','tan']},shirt:{p:['cream','darknavy','white','lightblue','periwinkle','midgrey','pink','lavender','navy','paleyellow','slate','charcoal','burgundy','black','beige','steelblue'],a:['navy','grey']},
      tie:{p:['navy','black','deepblue','green','brown','burgundy'],a:['pink','grey','white','cream','lightgrey','lightblue']},shoes:{p:['oxblood','black','brown'],a:[]},tieclip:{p:['grey'],a:[]},blazer:{p:['lightgrey','charcoal','steelblue','tan'],a:['lightblue','white']},
      belt:{p:['brown','black','oxblood'],a:['black']},pants:{p:['darkgrey','tan','midgrey','lightblue','grey','deepblue','khaki','navy','black'],a:['grey','tan','navy']},socks:{p:['charcoal'],a:[]},watch:{p:['grey'],a:[]}};
    const miss=Object.entries(LIVE).flatMap(([t,{p:pp,a}])=>[...pp.filter(c=>!app.by[t][0].includes(c)).map(c=>t+':'+c),...a.filter(c=>!app.by[t][1].includes(c)).map(c=>t+'/'+c)]);
    ok(miss.length===0,'every colour in the current wardrobe is still on its type\'s list ('+miss.join()+')');
    // the Add form uses the type's list
    const add=await p.evaluate(()=>{show('add');addManual();const q=queue[0];setq(0,'type','tieclip');const sel=[...document.querySelectorAll('#queue select')].find(s=>[...s.options].some(o=>o.value==='gold'));
      return sel?[...sel.options].map(o=>o.value).join():''});
    ok(add==='silver,gold,grey,black','the Add form shows a tie clip only metal colours');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{globalThis.fetch=realFetch;await browser.close()}
};
