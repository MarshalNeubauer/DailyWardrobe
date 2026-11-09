// Watches: chronograph dial, engraved bezel, integrated bracelet and free-text details; drawn on the figure; described in
// picture prompts; product pictures can be made from the item's own photo (image edit); outfit photos get the watch as a
// labelled reference.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const JPG='/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  const realFetch=globalThis.fetch;let sent=[];
  globalThis.fetch=async(href,init)=>{sent.push({url:String(href),body:init.body});return new Response(JSON.stringify({data:[{b64_json:JPG}]}),{status:200,headers:{'content-type':'application/json'}})};
  const store=new Map(),KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,put:async(k,v)=>{store.set(k,v)},delete:async k=>{store.delete(k)}};
  const env={APP_TOKEN:'t',OPENAI_API_KEY:'k',WARDROBE:KV};
  const post=b=>worker.fetch(new Request('https://w.test/render',{method:'POST',headers:{'x-app-token':'t','content-type':'application/json'},body:JSON.stringify(b)}),env);
  const browser=await chromium.launch();const p=await browser.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    // worker: item picture from a reference photo uses the image edit endpoint with a "recreate faithfully" prompt
    await post({mode:'item',item:'a stainless steel chronograph wristwatch',key:'c1111111111111111',ref:PNG});
    const e=sent[0];ok(e.url==='https://api.openai.com/v1/images/edits'&&/exact item in the reference photo/.test(e.body.get('prompt'))&&e.body.getAll('image[]').length===1,'a product picture from the item\'s own photo is an image edit that recreates it');
    sent=[];await post({mode:'item',item:'a pair of black shoes',key:'c2222222222222222'});
    ok(sent[0].url==='https://api.openai.com/v1/images/generations','without a photo it is generated from the description, as before');
    // outfit photos: labelled references
    sent=[];await post({image:PNG,refs:[PNG,PNG],labels:['the suit','the wristwatch (copy it exactly: case shape, bezel)'],outfit:'a navy suit',key:'c3333333333333333'});
    const pr=sent[0].body.get('prompt');
    ok(/in this order: the suit; the wristwatch \(copy it exactly: case shape, bezel\)\. Match each one exactly/.test(pr),'outfit photos name each reference photo, the watch included');
    ok(/printing on a watch dial stays/.test(pr),'the dial printing is allowed to stay as in the photo');
    // app
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(()=>{const w={id:'w1',type:'watch',primaryColor:'silver',pattern:'solid',metal:'silver',dial:'white',band:'integrated',bezel:'engraved',watchStyle:'chronograph',details:'small seconds at 10, 15/30/45 minute counter at 2'};
      const svg=itemThumb(w),plain=itemThumb({...w,watchStyle:'date',bezel:'smooth',band:'bracelet'});
      const o={suitDay:true,top:{id:'s',type:'suit',primaryColor:'navy',pattern:'solid',photo:'data:image/jpeg;base64,AAA'},shirt:{id:'h',type:'shirt',primaryColor:'white',pattern:'solid'},tie:{id:'t',type:'tie',primaryColor:'burgundy',pattern:'solid'},watch:w};
      renders[itemKey(w)]={sig:'item',img:'data:image/jpeg;base64,BBB'};const ref=outfitRefs(o);
      return {opts:[WATCH_STYLES,BANDS,BEZELS].map(l=>l.map(x=>x[0]).join()).join(' | '),
        subdials:(svg.match(/<circle cx=/g)||[]).length,nums:/>12<\/text>/.test(svg)&&/>6<\/text>/.test(svg),bezel:/>30<\/text>/.test(svg),plainHas:/>12<\/text>/.test(plain),
        txt:outfitText(o),desc:itemDesc(w),pic:ITEM_PIC_TYPES.includes('watch'),refs:ref.refs.join(),labels:ref.labels.join('|'),
        key:comboKey(o)!==comboKey({...o,watch:{...w,details:'other'}})&&comboKey(o)!==comboKey({...o,watch:{...w,watchStyle:'date'}})}});
    ok(/chronograph/.test(r.opts)&&/integrated/.test(r.opts)&&/engraved/.test(r.opts),`the wardrobe offers chronograph, integrated bracelet and engraved bezel (${r.opts})`);
    ok(r.subdials>=6&&r.nums&&r.bezel&&!r.plainHas,'a chronograph is drawn with subdials, 12 and 6 numerals and an engraved bezel');
    // long descriptions are not cut off
    sent=[];const long='a watch '+'with many details '.repeat(70)+'END';await post({mode:'item',item:long,key:'c4444444444444444',ref:PNG});
    ok(/END/.test(sent[0].body.get('prompt')),'a long, precise item description reaches the image model in full');
    ok(/chronograph \(three subdials and a date window\) wristwatch with a polished bezel engraved with numerals, a white dial and an integrated stainless steel bracelet.*\(small seconds at 10/.test(r.txt),`outfit photo prompts describe the watch precisely, details included (${r.txt})`);
    ok(r.pic&&/three-quarter view/.test(r.desc),'watches get product pictures');
    ok(r.refs==='data:image/jpeg;base64,AAA,data:image/jpeg;base64,BBB'&&/^the suit\|the wristwatch/.test(r.labels),'the watch picture goes to outfit photos as a labelled reference');
    ok(r.key,'changing the watch style or details gives a new outfit photo');
    // editor
    await p.evaluate(()=>{items=[{id:'w1',type:'watch',primaryColor:'silver',pattern:'solid',metal:'silver',dial:'white',band:'integrated',bezel:'engraved',watchStyle:'chronograph'}];flt='all';editing='w1';show('wardrobe')});
    await p.fill('.wdetails input','blue mark at 45');await p.press('.wdetails input','Tab');
    ok(await p.evaluate(()=>items[0].details==='blue mark at 45'),'the watch editor has a Details field');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{globalThis.fetch=realFetch;await browser.close()}
};
