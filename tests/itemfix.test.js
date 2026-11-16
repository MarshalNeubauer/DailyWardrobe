// The new-user audit's item sheet, colour and drawing findings (2026-11-15): which colour fields a type shows, cufflinks' and tie clips'
// colours, stale fields after a type change, names that stay a colour's, a colour of your own by hand, no dead-end advice, the plain
// suit's grain, a windowpane swatch, a name typed just before a kill, double taps on Duplicate and Delete.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844}});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);await p.evaluate(()=>{CK_OPEN['*']=true});
    // colour fields by type, on the item sheet and the Add card
    const f=await p.evaluate(()=>{const rows=it=>[...new DOMParser().parseFromString(colRows('e',it.id,it),'text/html').querySelectorAll('label')].map(l=>l.textContent.trim());
      const card=it=>[...new DOMParser().parseFromString(colRows('q',0,it),'text/html').querySelectorAll('label')].map(l=>l.textContent.trim());
      return {coat:rows({id:'a',type:'overcoat',primaryColor:'tan'}),coat2:rows({id:'b',type:'overcoat',primaryColor:'tan',secondaryColor:'brown'}),coatCard:card({type:'overcoat',primaryColor:'tan',secondaryColor:'brown'}),
        watchB:rows({id:'c',type:'watch',primaryColor:'green',band:'bracelet'}),watchL:rows({id:'d',type:'watch',primaryColor:'brown',band:'leather'}),
        links:rows({id:'e',type:'cufflinks',primaryColor:'lightblue'}),sneaker:rows({id:'f',type:'shoes',primaryColor:'white',shoeStyle:'sneaker'}),oxford:rows({id:'g',type:'shoes',primaryColor:'black'}),
        suit:rows({id:'h',type:'suit',primaryColor:'navy',pattern:'pinstripe'})}});
    const names=l=>l.map(s=>s.replace(/\s.*$/,'').replace(/^Strap$/,'Strap color'));
    ok(f.coat.length===1&&/^Color/.test(f.coat[0]),`a coat asks for one color (${f.coat.join(' | ')})`);
    ok(f.coat2.some(s=>/^Second color/.test(s))&&f.coatCard.length===1,'a saved coat with a second color still shows it (to clear it); an Add card does not offer it');
    ok(f.watchB.length===0,`a watch on a bracelet has no Color field (${f.watchB.join(' | ')})`);
    ok(f.watchL.length===1&&/^Strap color/.test(f.watchL[0]),`a leather strap's color is "Strap color" (${f.watchL.join(' | ')})`);
    ok(f.links.length===1,`cufflinks ask for one color (${f.links.join(' | ')})`);
    ok(f.sneaker.some(s=>/^Sole/.test(s))&&f.oxford.length===1,`a sneaker's second color is its "Sole"; an oxford has none (${names(f.sneaker).join(', ')})`);
    ok(f.suit.length===3,'patterned cloth keeps its second and third colors');
    // cufflinks: named and drawn in their colour, and the metal "other" is gunmetal
    const c=await p.evaluate(()=>{const l={id:'l1',type:'cufflinks',primaryColor:'lightblue',metal:'other',pattern:'solid'},s={id:'l2',type:'cufflinks',primaryColor:'silver',metal:'silver',pattern:'solid'};
      return {d:desc(l),ds:desc(s),th:itemThumb(l),ths:itemThumb(s),sw:swatchSVG(l),opts:METAL_OPTS.map(x=>x[1]).join(',')}});
    ok(c.d==='light blue · gunmetal'&&c.ds==='silver',`cufflinks are named by color and metal (${c.d} | ${c.ds})`);
    ok(c.th.includes('class="link-face"')&&c.th.toLowerCase().includes(await p.evaluate(()=>COLORS.lightblue))&&!c.ths.includes('link-face'),'enamel cufflinks are drawn with a face in their color; silver ones stay all metal');
    ok(c.sw.toLowerCase().includes(await p.evaluate(()=>COLORS.lightblue)),'their swatch shows the color');
    ok(/gunmetal/.test(c.opts)&&!/other/.test(c.opts),`the metal dropdown says gunmetal, not other (${c.opts})`);
    // tie clip swatch in its colour
    const clip=await p.evaluate(()=>[swatchSVG({id:'t',type:'tieclip',primaryColor:'rosegold'}),COLORS.rosegold,swatchSVG({id:'t2',type:'tieclip',primaryColor:'black'}),COLORS.black]);
    ok(clip[0].toLowerCase().includes(clip[1].toLowerCase())&&clip[2].toLowerCase().includes(clip[3].toLowerCase()),'a tie clip\'s swatch is its own color (it was always silver)');
    // sneakers are leather, not calf; no season where a type has none
    const d=await p.evaluate(()=>[desc({type:'shoes',primaryColor:'cream',secondaryColor:'brown',leather:'calf',shoeStyle:'sneaker',pattern:'solid'}),desc({type:'cufflinks',primaryColor:'silver',metal:'silver',season:'warm'})]);
    ok(/leather/.test(d[0])&&!/calf/.test(d[0]),`a sneaker's caption says leather (${d[0]})`);
    ok(!/weather/.test(d[1]),`no season in the caption of a type without one (${d[1]})`);
    // a type change drops stale fields
    const t=await p.evaluate(async()=>{const it={id:'rc',type:'raincoat',primaryColor:'olive',secondaryColor:'khaki',season:'warm',material:'waxed cotton',pattern:'solid',added:1};items=[it];await put(it);
      await sete('rc','type','cufflinks');const a={...items[0],title:itemTitle(items[0])};await sete('rc','type','socks');const b={...items[0]};return {a,b}});
    ok(!t.a.season&&!t.a.material&&!t.a.secondaryColor&&t.a.metal==='silver'&&!/weather|·\s*$/.test(t.a.title),`a raincoat made cufflinks loses its season, material and second color and gets a metal (${t.a.title})`);
    ok(!t.b.metal&&!t.b.season,'made socks it has no metal');
    // own colours: a built-in name is refused; one can be added by hand from the colour list
    const own=await p.evaluate(async()=>{const r=[];for(const n of ['Navy','light blue','Very dark navy'])try{await addCustomColor({name:n,hex:'#e3a5b4',base:'pink',types:['tie']});r.push('added '+n)}catch(e){r.push(e.message)}return r});
    ok(own.every(m=>/already a color/.test(m)),`an own color can't take a built-in color's name (${own.join(' | ')})`);
    const it={id:'tie1',type:'tie',primaryColor:'navy',pattern:'solid',added:1};
    await p.evaluate(async it=>{items=[it];await put(it);show('wardrobe');openItem(it.id);openColPick('e',it.id,'primaryColor')},it);
    // (2026-11-15: "+ A colour of my own" became the "+ New colour" sheet: a shade picked by hand and a name)
    await p.click('#cn-open');await p.fill('#cn-name','Navy');await p.dispatchEvent('#cn-name','change');await p.click('#cn-add');
    const err=await p.textContent('#cn-error');ok(/already a color/.test(err),`the new-colour sheet says so too (${err})`);
    await p.fill('#cn-name','Sage');await p.dispatchEvent('#cn-name','change');await p.fill('#cn-hex','#9caf88');await p.dispatchEvent('#cn-hex','change');await p.click('#cn-add');await p.waitForFunction(()=>!document.querySelector('#col-sheet').classList.contains('on'),null,{timeout:3000}).catch(()=>{});
    const sg=await p.evaluate(()=>({col:items[0].primaryColor,custom:(settings.custom.colors||[]).map(c=>c.name+':'+c.hex+':'+c.types.join('/')),open:document.querySelector('#col-sheet').classList.contains('on')}));
    ok(sg.col==='ownsage'&&sg.custom.includes('Sage:#9caf88:tie/pocketsquare')&&!sg.open,`"+ New color" by hand adds Sage for ties (and pocket squares) and uses it (${JSON.stringify(sg)})`);
    // no "add a close-up" advice where there is no close-up; no Read pattern from photo without a photo
    const adv=await p.evaluate(async()=>{const sh={id:'sh1',type:'shoes',primaryColor:'black',leather:'calf',pattern:'solid',added:1},tt={id:'tt1',type:'shirt',primaryColor:'white',pattern:'tattersall',added:1};items=[sh,tt];await put(sh);await put(tt);
      openItem('sh1');openColPick('e','sh1','primaryColor');const a=$('#col-sheet').textContent;closeColPick();openItem('tt1');const b=$('#ivbody').innerHTML;
      openColPick('e','tt1','primaryColor');const c=$('#col-sheet').textContent;closeColPick();return {a,b,c}});
    ok(!/close-up/.test(adv.a),'a shoe\'s color list doesn\'t ask for a fabric close-up');
    ok(/close-up/.test(adv.c),'a shirt\'s still suggests one');
    ok(!/readpat-btn/.test(adv.b)&&/Add a photo above to read its pattern/.test(adv.b),'an item with no photo offers no Read pattern from photo, and says to add a photo');
    // the drawn grain: a plain suit on Today's figure and in a small swatch has a fine, faint grain, no stripe-like lines; windowpane shows panes
    const g=await p.evaluate(()=>{const s={id:'s',type:'suit',primaryColor:'navy',pattern:'solid'};const fig=fabricDef('f',s,'top','fig'),dot=fabricDef('d',s,'top','dot'),wp=fabricDef('w',{id:'w',type:'suit',primaryColor:'grey',pattern:'windowpane'},'top','dot'),pin=fabricDef('p',{id:'p',type:'suit',primaryColor:'navy',pattern:'pinstripe'},'top','fig');
      const W=d=>+d.match(/width="([\d.]+)"/)[1],O=d=>{const m=d.match(/stroke-opacity="([\d.]+)"/);return m?+m[1]:0};return {fw:W(fig),fo:O(fig),dw:W(dot),do_:O(dot),wp:W(wp),pin:/M-2,2 L2,-2/.test(pin)}});
    ok(g.fw<=1.5&&g.fo<=.05&&g.dw<=2&&g.do_<=.05,`a plain suit's grain is fine and faint on the figure (${g.fw}, ${g.fo}) and in swatches (${g.dw}, ${g.do_})`);
    ok(!g.pin,'no grain lines run under a pinstripe on the figure');
    ok(g.wp<=8,`a windowpane swatch shows about two panes (tile ${g.wp} of 16)`);
    // a name typed and the app killed straight after is kept
    await p.evaluate(async()=>{const s={id:'nm1',type:'suit',primaryColor:'grey',pattern:'solid',added:1};items=[s];await put(s);show('wardrobe');openItem('nm1')});
    await p.fill('#ivbody .wf-name','My lucky suit');
    const kept=await p.evaluate(()=>localStorage.getItem('ward_pending'));
    await p.reload();await p.waitForFunction(()=>window.appReady);await p.evaluate(()=>{CK_OPEN['*']=true});
    const nm=await p.evaluate(async()=>{const s=()=>items.find(i=>i.id==='nm1');for(let k=0;k<60&&!(s()&&s().name&&!localStorage.getItem('ward_pending'));k++)await new Promise(r=>setTimeout(r,50));return {n:s()&&s().name,ids:items.map(i=>i.id).join(','),left:localStorage.getItem('ward_pending')}});
    ok(/My lucky suit/.test(kept||''),`each keystroke is kept at once (${kept})`);
    ok(nm.n==='My lucky suit'&&!nm.left,`a name typed just before a reload is kept (${JSON.stringify(nm)})`);
    // killed with no time to save (no pagehide): the copy kept at each keystroke is put back at the next start, unless the item changed since
    const kr=await p.evaluate(async()=>{localStorage.setItem('ward_pending',JSON.stringify({id:'nm1',k:'name',v:'Killed suit',was:'My lucky suit',at:Date.now()}));const a=await wardPendingRestore();
      localStorage.setItem('ward_pending',JSON.stringify({id:'nm1',k:'name',v:'Old',was:'Something else',at:1}));const b=await wardPendingRestore();return {a,b,n:items.find(i=>i.id==='nm1').name,left:localStorage.getItem('ward_pending')}});
    ok(kr.a&&!kr.b&&kr.n==='Killed suit'&&!kr.left,`a name kept from before a kill is restored, an older one is not (${JSON.stringify(kr)})`);
    // double taps: Duplicate makes one copy; Delete one toast
    const dd=await p.evaluate(async()=>{const n0=items.length;show('wardrobe');openItem('nm1');const b=document.querySelector('#iv-dup');b.click();b.click();await new Promise(r=>setTimeout(r,500));const n=items.length-n0;
      const id=items[items.length-1].id;openItem(id);const del=[...document.querySelectorAll('#ivbody .ivdel button')][0];del.click();del.click();await new Promise(r=>setTimeout(r,300));
      return {n,gone:n0+1-items.length,dup:items.length-new Set(items.map(i=>i.id)).size}});
    ok(dd.n===1&&dd.gone===1&&dd.dup===0,`a double tap on Duplicate makes one copy and on Delete deletes one item (${JSON.stringify(dd)})`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
