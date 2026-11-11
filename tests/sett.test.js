// The full pattern of a striped, checked or plaid cloth (detect.js analyzeSett): every band's colour and width, the lines
// crossing the other way, the direction and the scale; drawn in the swatch and on the figure; described to the photo generator.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const realFetch=globalThis.fetch;let sent=null,reply=null;
  globalThis.fetch=async(href,init)=>{if(String(href)!=='https://api.anthropic.com/v1/messages')return new Response('',{status:404});sent=JSON.parse(init.body);
    return new Response(JSON.stringify({model:'claude-opus-5-5',stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify(reply())}]}),{status:200,headers:{'content-type':'application/json'}})};
  const IMG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  const base={type:'tie',primaryColor:'taupe',secondaryColor:'cream',tertiaryColor:'steelblue',pattern:'stripe',metal:null,leather:null,dial:null,band:null,bezel:null,
    confidence:{type:'high',primaryColor:'high',pattern:'high'},altColor:'none',altPattern:'none',newColor:null,newPattern:null,clothBox:null};
  const DESC='Diagonal regimental stripes running upper left to lower right: wide taupe-brown bands with dark brown pinlines, then cream, sand, steel blue and white, crossed by fine cream lines the other way, on lustrous silk.';
  const weave={layout:'stripes-with-crossing-lines',direction:'upper-left to lower-right',repeatsAcross:.7,
    colours:[{name:'taupe',hex:'#6E655A',width:'wide'},{name:'cream',hex:'#d9d0b8',width:'medium'},{name:'steel blue',hex:'#7d8ba3',width:'narrow'},{name:'bad',hex:'blue',width:'wide'}],crossing:'fine cream lines',description:DESC+' <script>'};
  const browser=await chromium.launch();
  try{
    // ---- worker
    reply=()=>({...base,patternBox:{x:293,y:272,w:339,h:543},weave});
    const r=await (await worker.fetch(new Request('https://w.test/',{method:'POST',headers:{'content-type':'application/json','x-app-token':'t'},body:JSON.stringify({image:IMG})}),{APP_TOKEN:'t',ANTHROPIC_API_KEY:'k'})).json();
    const sch=sent.output_config.format.schema,t=sent.messages[0].content.find(c=>c.type==='text').text;
    ok(sch.required.includes('weave')&&sch.required.includes('patternBox')&&sch.properties.weave.anyOf[0].properties.colours,'Claude is asked for the weave (layout, direction, repeats, colours, crossing lines, description) and a box on the patterned cloth');
    ok(/description: one or two sentences describing the pattern for a photo-realistic image generator/.test(t)&&/patternBox/.test(t),'the prompt explains both');
    ok(r.weave.colours.length===3&&r.weave.colours[0].hex==='#6e655a'&&!/</.test(r.weave.description)&&r.patternBox.w===339,'the answer is tidied (bad colours dropped, text cleaned)');

    const ctx=await browser.newContext({viewport:{width:390,height:844}});
    await ctx.route('https://w.test/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({...base,patternBox:{x:293,y:272,w:339,h:543},weave:{...weave,colours:weave.colours.slice(0,3),description:DESC},model:'m'})}));
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
    await p.goto(url);await p.evaluate(()=>{localStorage.setItem('worker_url','https://w.test/');localStorage.setItem('app_token','t')});await p.reload();await p.waitForFunction(()=>window.appReady);
    // the synthetic cloths' noise is seeded, so every run draws the same cloth
    await p.evaluate(()=>{let x=20261111;Math.random=()=>{x=(x*16807)%2147483647;return x/2147483647}});

    // ---- a synthetic plaid with known bands: every colour and width comes back
    const syn=await p.evaluate(()=>{const S=900,c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d');
      const bands=[['#5a4d3c',.3],['#d8cfb4',.15],['#7a8ca6',.1],['#eef0f2',.08],['#3a2f25',.05],['#b8a88a',.32]],T=380;
      x.save();x.translate(S/2,S/2);x.rotate(-Math.PI/4);let o=-1400;while(o<1400){for(const [h,w] of bands){x.fillStyle=h;x.fillRect(o,-1400,w*T+.6,2800);o+=w*T}}   // bands across x, rotated -45deg
      x.globalAlpha=.5;x.fillStyle='#f3eedf';for(let y=-1400;y<1400;y+=150)x.fillRect(-1400,y,2800,5);x.restore();   // crossing lines, perpendicular
      const s=settFromCanvas(c);const near=(h,w)=>s.bands.some(([b,bw])=>dE00(rgbLab(...hexRgb(b)),rgbLab(...hexRgb(h)))<7&&Math.abs(bw-w)<.05);
      return {s,found:bands.map(([h,w])=>near(h,w)),n:s.bands.length}});
    ok(syn.found.every(Boolean)&&syn.n<=8,`a known 6-band sett comes back band by band, colours within ΔE 7 and widths within 5% (${syn.n} bands: ${syn.s.bands.map(b=>b[0]).join(' ')})`);
    ok(Math.abs(Math.abs(syn.s.a)-45)<=4,`its direction is read (${syn.s.a}°)`);
    ok(syn.s.cross&&Math.abs(syn.s.cross.d-90)<=6&&syn.s.cross.bands.some(b=>b[0]),`the faint lines crossing the other way are found (${syn.s.cross&&syn.s.cross.d}°)`);
    const plain=await p.evaluate(()=>{const S=900,c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d');x.save();x.translate(S/2,S/2);x.rotate(-Math.PI/4);
      let o=-1400;while(o<1400){for(const [h,w] of [['#1f2d4a',.6],['#a01f2c',.25],['#e0d8c0',.15]]){x.fillStyle=h;x.fillRect(o,-1400,w*200+.6,2800);o+=w*200}}x.restore();
      // a little noise, like a weave
      const d=x.getImageData(0,0,S,S);for(let i=0;i<d.data.length;i+=4){const n=(Math.random()-.5)*14;d.data[i]+=n;d.data[i+1]+=n;d.data[i+2]+=n}x.putImageData(d,0,0);return settFromCanvas(c)});
    ok(plain&&plain.bands.length===3&&!plain.cross,`a plain regimental stripe reads as its 3 bands with no crossing lines (${plain&&plain.bands.length} bands, cross ${JSON.stringify(plain&&plain.cross)})`);

    // ---- the real tie: through the Add flow
    const flow=await p.evaluate(async()=>{show('add');const blob=await (await fetch('tests/fixtures/tie-plaid.jpg')).blob();await addFiles([new File([blob],'tie.jpg',{type:'image/jpeg'})]);
      const q=queue[0],s=q.sett,L=s.bands.map(([h])=>rgbLab(...hexRgb(h)));
      return {s,src:s&&s.src,n:s&&s.bands.length,blue:L.some(l=>l[2]<-2&&l[2]<l[1]-1&&l[0]>30),light:L.some(l=>l[0]>68),dark:L.some(l=>l[0]<38),note:document.querySelector('#queue').textContent}});
    ok(flow.src==='photo'&&flow.n>=10,`the tie's pattern is read from the sharp photo: ${flow.n} colour bands`);
    ok(flow.blue&&flow.light&&flow.dark,'… including its steel blue, its cream and its dark pinlines');
    ok(flow.s.cross&&Math.abs(flow.s.cross.d-90)<=10,`… and the lines crossing the other way (${flow.s.cross&&flow.s.cross.d}°)`);
    ok(Math.abs(flow.s.a+46)<=6&&Math.abs(flow.s.tr-.61)<.08,`direction and scale from the photo (${flow.s.a}°, ${flow.s.tr} repeats across; a tie's own count beats Claude's estimate of 0.7)`);
    ok(/Pattern: \d+ colour bands with lines crossing the other way, read from the photo/.test(flow.note),'the card says what was read');
    // drawn: the swatch uses the bands; the figure keeps the repeat's share of the tie's width
    const dr=await p.evaluate(()=>{const q=queue[0],th=itemThumb(q,true),fig=fabricDef('f',q,'tie','fig'),sw=fabricDef('s',q,'tie');const W=d=>+d.match(/width="([\d.]+)"/)[1];
      return {all:q.sett.bands.every(([h])=>th.includes(h)),over:/opacity="\.5"/.test(th),rot:/rotate\(-46\)/.test(th),wf:W(fig),ws:W(sw),tr:q.sett.tr}});
    ok(dr.all&&dr.over&&dr.rot,'the swatch draws every band in its colour, the crossing lines over them, at the tie\'s angle');
    ok(Math.abs(dr.wf-29/dr.tr)<1&&dr.ws>=14&&dr.ws<=110,`one repeat is ${dr.wf.toFixed(0)} units on the figure (the tie is 29 wide, ${dr.tr} repeats across) and ${dr.ws.toFixed(0)} in the swatch`);
    // the simple pattern instead
    await p.click('#queue .chipbtn:has-text("Use the simple pattern")');
    ok(await p.evaluate(()=>!queue[0].sett&&/Drawn with the simple stripe pattern/.test(document.querySelector('#queue').textContent)),'"Use the simple pattern" goes back to the drawn stripe');
    await p.click('#queue .chipbtn:has-text("Use the pattern from the photo")');
    // save; the photo prompt; the photo key; the editor
    const sv=await p.evaluate(async()=>{await save(0);const it=items[0],plain={...it};delete plain.sett;delete plain.patternText;
      const o={top:{id:'s',type:'suit',primaryColor:'charcoal',pattern:'solid'},shirt:{id:'h',type:'shirt',primaryColor:'white',pattern:'solid'},tie:it,suitDay:true};
      return {sett:!!it.sett,pbox:it.pbox,text:it.patternText,prompt:outfitText(o),key:comboKey(o)!==comboKey({...o,tie:plain})}});
    ok(sv.sett&&sv.pbox&&sv.pbox.w===339&&sv.text===DESC,'the item keeps its pattern, the box it was read from and the description');
    ok(/\(measured: diagonal stripes running from the upper left down to the lower right, as the viewer sees them; the bands are about/.test(sv.prompt)&&sv.prompt.includes('wide taupe-brown bands with dark brown pinlines')&&sv.key,'the photo generator is told the pattern, and the photo is made for it (its own key)');
    await p.evaluate(()=>{show('wardrobe');openItem(items[0].id)});await p.waitForTimeout(500);
    const ed=await p.textContent('#item-view');
    ok(/Pattern layout: \d+ colour bands with lines crossing the other way, read from the photo/.test(ed),'the Wardrobe editor shows it');
    await p.evaluate(()=>{delete items[0].sett});await p.click('#item-view button:has-text("Read pattern from photo")');
    await p.waitForFunction(()=>items[0].sett);
    ok(await p.evaluate(()=>items[0].sett.src==='photo'&&items[0].sett.bands.length>=10),'"Read pattern from photo" reads it again from the kept sharp copy');
    // Claude's own reading when the app can't read the photo; a close-up's angle comes from Claude
    const fb=await p.evaluate(()=>{const s=settFrom({weave:{direction:'lower-left to upper-right',repeatsAcross:2,colours:[{hex:'#112233',width:'wide'},{hex:'#ddeeff',width:'narrow'}]}});
      const c=document.createElement('canvas');c.width=c.height=400;const x=c.getContext('2d');for(let i=0;i<400;i+=40){x.fillStyle=i%80?'#203040':'#c0b090';x.fillRect(i,0,40,400)}
      const s2=settFrom({tex:c,weave:{direction:'upper-left to lower-right',repeatsAcross:3}});return {s,s2}});
    ok(fb.s.src==='claude'&&fb.s.a===45&&fb.s.bands.length===2&&fb.s.bands[0][1]>fb.s.bands[1][1],'with nothing readable, Claude\'s colours and widths are drawn');
    ok(fb.s2.src==='closeup'&&fb.s2.a===-45&&fb.s2.tr===3,'a close-up\'s bands are used with Claude\'s direction and scale');
    // ---- suits and shirts: photographed-like synthetic cloth (soft edges, weave noise, light falloff)
    const sw=await p.evaluate(()=>{
      const mk=draw=>{const S=1000,c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d');draw(x,S);x.filter='blur(1px)';x.drawImage(c,0,0);x.filter='none';
        const d=x.getImageData(0,0,S,S);for(let i=0;i<d.data.length;i+=4){const px=(i/4)%S,py=Math.floor(i/4/S),sh=1-.12*((px/S-.5)**2+(py/S-.5)**2)*4,n=(Math.random()-.5)*12;for(let k=0;k<3;k++)d.data[i+k]=d.data[i+k]*sh+n}x.putImageData(d,0,0);return c};
      const v=(x,S,g,lines,step)=>{x.fillStyle=g;x.fillRect(0,0,S,S);let k=0;if(lines.length)for(let o=0;o<S;o+=step){const [c,w]=lines[k++%lines.length];x.fillStyle=c;x.fillRect(o,0,w,S)}};
      const h=(x,S,lines,step,a)=>{x.globalAlpha=a;let k=0;for(let o=0;o<S;o+=step){const [c,w]=lines[k++%lines.length];x.fillStyle=c;x.fillRect(0,o,S,w)}x.globalAlpha=1};
      const lab=hx=>rgbLab(...hexRgb(hx)),r={};
      r.pin=settFromCanvas(mk((x,S)=>v(x,S,'#1f2a44',[['#c8ccd4',2]],32)));
      r.chalk=settFromCanvas(mk((x,S)=>{v(x,S,'#3a3d44',[],0);x.filter='blur(3px)';x.globalAlpha=.55;for(let o=0;o<S;o+=56){x.fillStyle='#b9bcc2';x.fillRect(o,0,6,S)}x.filter='none';x.globalAlpha=1}));
      r.gingham=settFromCanvas(mk((x,S)=>{v(x,S,'#ffffff',[['#5b7fb8',24]],48);h(x,S,[['#5b7fb8',24]],48,.55)}));
      r.tatt=settFromCanvas(mk((x,S)=>{v(x,S,'#f4f1e8',[['#b02a30',3],['#2f6b4a',3]],36);h(x,S,[['#b02a30',3],['#2f6b4a',3]],36,.9)}));
      r.bengal=settFromCanvas(mk((x,S)=>v(x,S,'#ffffff',[['#3f6fb5',14]],28)));
      const L=s=>s.bands.map(b=>lab(b[0])),X=s=>s.cross?s.cross.bands.filter(b=>b[0]).map(b=>lab(b[0])):[];
      return {r,pin:{n:r.pin.bands.length,con:dE00(...L(r.pin)),w:Math.min(...r.pin.bands.map(b=>b[1])),light:Math.max(...L(r.pin).map(l=>l[0]))>Math.min(...L(r.pin).map(l=>l[0]))+15},
        chalk:{n:r.chalk.bands.length,con:dE00(...L(r.chalk))},ging:{white:Math.max(...L(r.gingham).map(l=>l[0])),blue:L(r.gingham).some(l=>l[2]<-15),cross:X(r.gingham).some(l=>l[2]<-15)},
        tatt:{n:r.tatt.bands.length,red:L(r.tatt).some(l=>l[1]>15),green:L(r.tatt).some(l=>l[1]<-10),xred:X(r.tatt).some(l=>l[1]>15),xgreen:X(r.tatt).some(l=>l[1]<-10)},
        bengal:{n:r.bengal.bands.length,cross:!!r.bengal.cross}}});
    ok(sw.pin.n===2&&sw.pin.light&&sw.pin.w<.15&&!sw.r.pin.cross&&sw.r.pin.a===0,`a pinstripe suit: the navy ground and a narrow light stripe, upright, nothing crossing (stripe ${(sw.pin.w*100).toFixed(0)}% of the repeat)`);
    ok(sw.chalk.n===2&&sw.chalk.con>8&&!sw.r.chalk.cross,'a chalk stripe: its soft lighter stripe on the ground');
    ok(sw.ging.white>80&&sw.ging.blue&&sw.ging.cross,`a gingham shirt: white stays white (L* ${sw.ging.white.toFixed(0)}, the crossing threads left out), blue bands and blue crossing lines`);
    ok(sw.tatt.n===4&&sw.tatt.red&&sw.tatt.green&&sw.tatt.xred&&sw.tatt.xgreen,'a tattersall: its red and green lines both ways, kept apart (same lightness, told apart by colour)');
    ok(sw.bengal.n===2&&!sw.bengal.cross,'a bengal stripe: two bands, and the light falling off across the photo is not taken for crossing lines');
    // a blurry whole-jacket reading takes the close-up's bands when the close-up shows enough of the pattern
    const comb=await p.evaluate(()=>{const mk=(step,w,S=900)=>{const c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d');x.fillStyle='#1f2a44';x.fillRect(0,0,S,S);
        for(let o=0;o<S;o+=step){x.fillStyle='#c8ccd4';x.fillRect(o,0,w,S)}return c};
      const full=mk(12,1),tex=mk(150,10),x=full.getContext('2d');x.filter='blur(1.2px)';x.drawImage(full,0,0);
      const s=settFrom({full,box:{x:100,y:100,w:800,h:800},tex,weave:{repeatsAcross:30,direction:'vertical'}});return s});
    ok(comb.src==='photo+closeup'&&comb.tr===30&&comb.a===0&&comb.bands.length===2,`the whole-jacket reading keeps its direction and scale and takes the close-up's sharper bands (${comb.src}, ${comb.bands.map(b=>b.join(':')).join(' ')})`);
    const fig=await p.evaluate(()=>{const it={id:'p1',type:'suit',primaryColor:'navy',pattern:'pinstripe',sett:{v:2,a:3,bands:[['#1f2a44',.94],['#c8ccd4',.06]],cross:null,cr:28,tr:30}};
      const d=fabricDef('f',it,'top','fig'),sw=fabricDef('s',it,'top');return {w:+d.match(/width="([\d.]+)"/)[1],rot:/patternTransform/.test(d),ws:+sw.match(/width="([\d.]+)"/)[1]}});
    ok(Math.abs(fig.w-200/30)<.1&&!fig.rot&&fig.ws===14,`on the figure a 30-across pinstripe repeats every ${fig.w.toFixed(1)} units, upright (a jacket's stripes snap straight); the swatch shows several`);
    const tp=await p.evaluate(()=>({suit:settable('suit','pinstripe'),chalk:settable('blazer','chalk-stripe'),ging:settable('shirt','gingham'),herr:settable('suit','herringbone'),solid:settable('shirt','solid')}));
    ok(tp.suit&&tp.chalk&&tp.ging&&!tp.herr&&!tp.solid,'suits, blazers and trousers read their stripes and checks; fine weaves and solids keep the drawn tile');
    // a patterned shirt is described and gets its own photo; plain shirts still share theirs by colour
    const sh=await p.evaluate(()=>{const top={id:'s',type:'suit',primaryColor:'navy',pattern:'solid'},tie={id:'t',type:'tie',primaryColor:'burgundy',pattern:'solid'};
      const st={id:'a',type:'shirt',primaryColor:'white',pattern:'stripe',sett:{v:2,a:0,bands:[['#ffffff',.5],['#3f6fb5',.5]],cr:20},patternText:'Bold blue bengal stripes on white'},
        p1={id:'b',type:'shirt',primaryColor:'white',pattern:'solid'},p2={id:'c',type:'shirt',primaryColor:'white',pattern:'oxford'},o=sh=>({top,tie,shirt:sh,suitDay:true});
      return {txt:outfitText(o(st)),plain:outfitText(o(p1)),own:comboKey(o(st))!==comboKey(o(p1)),share:comboKey(o(p1))===comboKey(o(p2))}});
    ok(/a white stripe dress shirt \(measured: vertical stripes; the bands are about [^)]*\. Bold blue bengal stripes on white\)/.test(sh.txt)&&/a plain white dress shirt/.test(sh.plain),'the photo generator is told a striped shirt\'s pattern; a plain one is still "a plain white dress shirt"');
    ok(sh.own&&sh.share,'a striped shirt gets its own photo; plain and finely woven white shirts still share one');
    // a linen windowpane blazer (khaki, slubby, thin light-blue lines with a white one beside, both ways, light falling off): the
    // lines barely differ in lightness, only in colour; read from a close-up and from the whole jacket, then combined
    const wp=await p.evaluate(()=>{const linen=(S,step,lw,seed)=>{const c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d');x.fillStyle='#b9ad92';x.fillRect(0,0,S,S);
        let r=seed;const rnd=()=>{r=(r*16807)%2147483647;return r/2147483647};
        for(let k=0;k<S*S/60;k++){const v=rnd()<.5,l=4+rnd()*30,xx=rnd()*S,yy=rnd()*S;x.fillStyle=rnd()<.5?'rgba(255,250,235,.35)':'rgba(90,80,60,.3)';v?x.fillRect(xx,yy,1+rnd(),l):x.fillRect(xx,yy,l,1+rnd())}
        x.fillStyle='#9fb3d0';for(let o=step*.3;o<S;o+=step){x.globalAlpha=.85;x.fillRect(o,0,lw,S);x.fillRect(0,o,S,lw)}x.globalAlpha=1;
        x.fillStyle='rgba(240,240,235,.5)';for(let o=step*.3+lw+1;o<S;o+=step){x.fillRect(o,0,lw*.6,S);x.fillRect(0,o,S,lw*.6)}
        const d=x.getImageData(0,0,S,S);for(let i=0;i<d.data.length;i+=4){const px=(i/4)%S,py=Math.floor(i/4/S),sh=1-.15*((px/S-.3)**2+(py/S-.5)**2)*4,n=(Math.random()-.5)*16;for(let q=0;q<3;q++)d.data[i+q]=d.data[i+q]*sh+n}x.putImageData(d,0,0);return c};
      const close=linen(1100,420,6,7),jacket=linen(1400,95,2,9),blue=h=>rgbLab(...hexRgb(h))[2]<-4;
      const c=settFromCanvas(close,null,{straight:true}),j=settFromCanvas(jacket,{x:200,y:200,w:600,h:600},{straight:true}),both=settFrom({full:jacket,box:{x:200,y:200,w:600,h:600},tex:close,type:'blazer',weave:{repeatsAcross:9}});
      const info=s=>s&&{cr:s.cr,a:s.a,blueBand:s.bands.some(b=>blue(b[0])),blueCross:!!s.cross&&s.cross.bands.some(b=>b[0]&&blue(b[0])),r:s.cross&&s.cross.r,n:s.bands.length};
      return {c:info(c),j:info(j),both:both&&{src:both.src,a:both.a,tr:both.tr,blue:both.bands.some(b=>blue(b[0])),ground:(()=>{const g=rgbLab(...hexRgb(both.bands[0][0])),k=rgbLab(...hexRgb('#b9ad92')),C=l=>Math.hypot(l[1],l[2]),h=l=>Math.atan2(l[2],l[1])*180/Math.PI;return {chroma:C(g)/C(k),hue:Math.abs(h(g)-h(k))}})()},noRef:!wbRead(close).ref}});
    ok(wp.c&&wp.c.blueBand&&wp.c.blueCross&&Math.abs(wp.c.cr-2.36)<.3&&Math.abs(wp.c.r-1)<.1,`a linen windowpane close-up: its light-blue lines both ways, square panes, the right repeat (${JSON.stringify(wp.c)})`);
    ok(wp.j&&wp.j.blueBand&&wp.j.blueCross&&Math.abs(wp.j.cr-8.84)<.5&&wp.j.a===0,`… and from the whole jacket, where the lines are a pixel or two wide (${JSON.stringify(wp.j)})`);
    ok(wp.both&&wp.both.src==='photo+closeup'&&wp.both.blue&&wp.both.tr===9,'with both, the close-up\'s bands and the jacket\'s scale are used');
    ok(wp.noRef&&wp.both.ground.chroma>.85&&wp.both.ground.hue<6,`a khaki close-up's own light slubs are not taken for a white reference, so the khaki keeps its colour (${Math.round(wp.both.ground.chroma*100)}% of its chroma, hue within ${wp.both.ground.hue.toFixed(1)}°)`);
    // the user's own khaki linen windowpane blazer (its synced photo and close-up): the close-up's lines wave with the drape and
    // its panes run 135-175px, which defeated matching the repeat; the lines are found one by one in strips instead
    const real=await p.evaluate(async()=>{const ld=async s=>{const im=new Image();im.src=s;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;c.getContext('2d').drawImage(im,0,0);return c};
      const ph=await ld('tests/fixtures/blazer-windowpane.jpg'),tx=await ld('tests/fixtures/blazer-windowpane-closeup.jpg');
      const s=settFrom({full:ph,box:{x:220,y:420,w:180,h:280},tex:tx,type:'blazer',weave:{repeatsAcross:9}}),L=h=>rgbLab(...hexRgb(h));
      const ground=s.bands.reduce((x,y)=>y[1]>x[1]?y:x),line=s.bands.filter(b=>b!==ground).map(b=>L(b[0])).sort((a,b)=>a[2]-b[2])[0];
      return {src:s.src,cr:s.cr,tr:s.tr,ground:L(ground[0]),line,cross:!!s.cross&&s.cross.bands.some(b=>b[0])}});
    ok(real.src==='photo+closeup'&&Math.abs(real.cr-3.5)<.6&&real.tr===9,`the real blazer: the close-up's lines are found (${real.cr} panes across it) and used, the jacket at 9 panes across`);
    ok(real.ground[2]>10&&real.ground[0]>60&&real.line&&real.ground[2]-real.line[2]>5&&real.cross,`… a khaki ground (L* ${real.ground[0].toFixed(0)}, b* ${real.ground[2].toFixed(0)}, set to the jacket photo's exposure) with bluer lines both ways (b* ${real.line&&real.line[2].toFixed(0)})`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{globalThis.fetch=realFetch;await browser.close()}
};
