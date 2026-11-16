// Fix round 3 (2026-11-16, the third audit), the spreadsheet import (kit.js): a Description column read for patterns, kinds, styles and
// names, with the columns not used named (W2-15-01); a re-import updates matching pieces (W2-15-02, the owner's decision 5); "lt."/"dk"
// (W2-15-03); row numbers after a blank row (W2-15-04); a title row, a list with no column names, everyday headers (W2-15-05); quantities
// (W2-15-06); short forms, typos, shoe words, both problems of a row (W2-15-07); long fields cut and said (W2-12-05); Arabic types and colors
// (W2-16-06); the app's own hyphenated color name (W2-18-04); a file that can't be read (W2-20-01); the 14 Nov import's list numbers as
// colors repaired, and own colours named like the app's (W1-2-01, W1-2-02).
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Kuwait'});const p=await ctx.newPage();p.errs=[];
    p.on('pageerror',e=>p.errs.push(e.message));await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{if(typeof setupClose==='function'&&document.querySelector('#setup.on'))setupClose()});
    /* ---- W2-15-01: the Description column ---- */
    const d=await p.evaluate(()=>{const r=kitRead('Category\tDescription\tColor\tBrand\tSize\nSuit\tcharcoal pinstripe\tcharcoal\tM&S\t40R\nShirt\tpink gingham\tpink/white\t\t\nShirt\tbengal stripe\tblue & white\tHilditch\t\nTie\tknit\tnavy\t\t\nTie\trepp stripe\tburgundy & navy\tDrake\'s\t\nTie\tpaisley\tgold\t\t\nTie\tpolka dot\tnavy\t\t\nTrousers\tchinos\tkhaki\tGap\t\nShoes\tpenny loafers\toxblood\t\t\nShoes\tbrogues\ttan\t\t\nSuit\tnavy three-piece\tnavy\t\t\n');
      kitImportOpen();kitImportText('Category\tDescription\tColor\tSize\nTie\tknit\tnavy\tM\n');const prev=document.querySelector('#kit-prev').textContent;kitClose();
      return {rows:r.rows.map(x=>[x.card.type,x.card.pattern,x.card.trouserKind||x.card.shoeStyle||x.card.vest||'',x.card.name||''].join(':')),unused:r.unused,desc:r.descCols,prev}});
    ok(d.rows.join('|')==='suit:pinstripe:no:|shirt:gingham::|shirt:stripe::|tie:knit::|tie:stripe::|tie:paisley::|tie:polka-dot::|pants:solid:chinos:|shoes:solid:loafer:Penny loafers|shoes:solid:oxford:Brogues|suit:solid:yes:',
      'a Description column gives the pattern, the trousers\' kind, the shoes\' style, a three-piece suit, and its other words the name: '+d.rows.join(' | '));
    ok(d.unused.join()==='Size'&&d.desc.join()==='Description'&&/Description: read for patterns/.test(d.prev)&&/Not used: Size/.test(d.prev),'the preview says the Description column was read and names the column it didn\'t use: '+d.prev);
    /* ---- W2-15-02: the same sheet again with a Pattern column updates the pieces, keeping their ids ---- */
    const B=[['Suit','charcoal','M&S','pinstripe'],['Shirt','pink/white','','gingham'],['Tie','navy','','knit'],['Tie','navy','','polka dot'],['Tie','gold','','paisley'],['Shoes','tan','','']];
    const first='Category\tColor\tBrand\n'+B.map(r=>r.slice(0,3).join('\t')).join('\n'),second='Category\tColor\tBrand\tPattern\n'+B.map(r=>r.join('\t')).join('\n')+'\nBelt\tblack\t\t';
    const u=await p.evaluate(async([a,b])=>{kitImportOpen();kitImportText(a);await kitImportGo();const ids=items.map(i=>i.id).sort().join();
      const tie=items.find(i=>i.type==='tie'&&i.primaryColor==='navy');tie.name='Office';tie.updated=Date.now();
      kitImportOpen();kitImportText(b);const sum=document.querySelector('.kit-sum').textContent,btn=document.querySelector('#kit-imp').textContent,upd=document.querySelectorAll('.kit-rows li.upd').length,
        info=[...document.querySelectorAll('.kit-rows li.upd small')].map(x=>x.textContent);
      await kitImportGo();const after=items.length,same=items.filter(i=>i.type!=='belt').map(i=>i.id).sort().join()===ids,pats=items.filter(i=>i.type==='tie').map(i=>i.pattern).sort().join(),named=(items.find(i=>i.name==='Office')||{}).pattern;
      const t=document.querySelector('#toast').textContent;await document.querySelector('#toast button').click();await new Promise(r=>setTimeout(r,400));
      return {sum,btn,upd,info,after,same,pats,named,t,undone:items.filter(i=>i.type==='tie').map(i=>i.pattern).sort().join(),n:items.length}},[first,second]);
    ok(u.upd===5&&u.btn==='Add 1, update 5'&&/5 match pieces you have with another pattern/.test(u.sum)&&u.info.some(x=>/updates your navy tie: pattern solid → (knit|polka dot)/.test(x)),`re-importing with a Pattern column offers to update the 5 re-patterned pieces, not add them (${u.btn}; ${u.sum})`);
    ok(u.after===7&&u.same&&u.pats==='knit,paisley,polka-dot'&&/Imported 1 item and updated 5 pieces/.test(u.t),`the pieces keep their ids (and so their history) and get the patterns; only the new belt is added (${JSON.stringify(u)})`);
    ok(u.undone==='solid,solid,solid'&&u.n===6,'Undo puts the updated pieces back as they were and takes the belt out: '+u.undone);
    const an=await p.evaluate(()=>{kitImportOpen();kitImportText('Type,Colour,Pattern\nTie,Navy,Paisley\n');const b0=document.querySelector('#kit-imp').textContent;document.querySelector('.kit-asnew').click();
      const b1=document.querySelector('#kit-imp').textContent;kitImportText('Type,Colour\nTie,Navy\nTie,Navy\nTie,Navy\n');const b2=document.querySelector('#kit-imp').textContent;kitImportText('Type,Colour,Name\nTie,Navy,Sheet tie\n');const b3=document.querySelector('#kit-imp').textContent;kitClose();return {b0,b1,b2,b3}});
    ok(an.b0==='Update 1 piece'&&an.b1==='Add 1 item'&&an.b2==='Add 1 item'&&an.b3==='Add 1 item',`"Add as new" adds the row instead of updating; rows that say nothing new are the pieces already there; a name for an unnamed piece, or another name, is a new piece (${JSON.stringify(an)})`);
    /* ---- W2-15-03, -04, -05, -06, -07, W2-12-05, W2-16-06, W2-18-04 ---- */
    const w=await p.evaluate(()=>{const R=t=>{const r=kitRead(t);return r.err?['ERR']:r.rows.map(x=>x.ok?[x.card.type,x.card.primaryColor,x.card.secondaryColor||'',x.qty,x.probs.join('/')].join(':'):'bad:'+x.line+':'+x.why)};
      return {lt:R('Type\tColour\nShirt\tlt. blue\nShirt\tlt blue\nTrousers\tdk grey\nTrousers\tmed grey\nSocks\theather grey\n'),
        line:R('Type\tColour\nSuit\tnavy\nTie\tnavy\n\t\nPocket square\twhite\nBelt\tbrown'),
        title:R('My clothes (updated Oct)\nType\tColour\nSuit\tnavy\nShirt\twhite'),list:R('Navy suit\nWhite shirt x3\nBurgundy tie\nCharcoal pinstripe suit\nNavy and white striped tie'),
        heads:[R('Item type\tColours\nSuit\tnavy'),R('Clothing\tColour\nSuit\tnavy'),R('Piece,Colour\nSuit,navy')],
        qty:R('Type\tColour\tQty\nShirt\tWhite\t3\nTie\tNavy\t0\nSocks\tBlack\t40\nShirt\tBlue\tsome\n'),
        typo:R('Type\tColour\nShoes\tbrn\nShirt\tblue & wht\nShrit\tsky\nBrogues\tTan\nMonk straps\tBlack\nScarf\tbrnx\n'),
        long:R('Type,Colour,Name,Notes\nTie,Navy,'+'n'.repeat(80)+','+'z'.repeat(600)+'\n'),
        ar:R('Type\tColour\tName\nبدلة\tأسود\tبدلة سوداء\nقميص\tأبيض\tقميص أبيض ٢\nربطة عنق\tأزرق فاتح\t\nحذاء\tبني\t\nقبعة\tأسود\t\n'),
        slate:R('Type\tColour\nTie\tDark slate blue-gray\nTie\tdark slate blue-grey\n')}});
    ok(w.lt[0].startsWith('shirt:lightblue:')&&w.lt[1].startsWith('shirt:lightblue:')&&w.lt[2].startsWith('pants:darkgrey:')&&w.lt[3].startsWith('pants:midgrey:')&&/only “grey” of “heather grey” was understood/.test(w.lt[4]),'"lt. blue" is light blue, "dk grey" dark gray, "med grey" mid gray, and a color only partly understood says so: '+w.lt.join(' | '));
    ok(/^bad:5:/.test(w.line.find(x=>/^bad/.test(x))||''),'a row left out after a blank row has its own row number: '+w.line.join(' | '));
    ok(w.title.length===2&&w.title[0].startsWith('suit:navy'),'the column names under a title row are found: '+w.title.join(' | '));
    ok(w.list.length===5&&!w.list.some(x=>/^bad/.test(x))&&w.list[0].startsWith('suit:navy::1')&&w.list[1].startsWith('shirt:white::3')&&w.list[2].startsWith('tie:burgundy')&&w.list[4].startsWith('tie:navy:white:'),'a list with no column names is read line by line, with "x3": '+w.list.join(' | '));
    ok(w.heads.every(h=>h[0]&&h[0].startsWith('suit:navy')),'"Item type", "Colours", "Clothing" and "Piece" name the columns: '+JSON.stringify(w.heads));
    ok(w.qty[0]==='shirt:white::3:'&&/bad:3:Quantity is 0/.test(w.qty[1])&&/^socks:black::12:40 asked for/.test(w.qty[2])&&/shirt:blue::1:quantity “some” left out/.test(w.qty[3]),'a Qty column makes that many pieces, at most 12, and says what it couldn\'t read: '+w.qty.join(' | '));
    ok(w.typo[0].startsWith('shoes:brown:')&&w.typo[1].startsWith('shirt:blue:white:')&&/^shirt:lightblue::1:“Shrit” read as dress shirt/.test(w.typo[2])&&w.typo[3].startsWith('shoes:tan:')&&w.typo[4].startsWith('shoes:black:')&&/isn't a type the app plans.*“brnx” isn't a color the app knows either/.test(w.typo[5]),
      'short forms (brn, wht, sky), a typo in the type, Brogues and Monk straps are read; an unknown type and color are both said: '+w.typo.join(' | '));
    const lr=await p.evaluate(()=>kitRead('Type,Colour,Name,Notes\nTie,Navy,'+'n'.repeat(80)+','+'z'.repeat(600)+'\n').rows[0].card);
    ok(lr.name.length===60&&lr.notes.length===500&&/name cut to 60 characters\/notes cut to 500 characters/.test(w.long[0]),'long text is cut to what is kept, and the preview says so: '+w.long[0].slice(-80));
    ok(w.ar.slice(0,4).map(x=>x.split(':').slice(0,2).join(':')).join()==='suit:black,shirt:white,tie:lightblue,shoes:brown'&&/write the type in English/.test(w.ar[4]),'Arabic type and color words are read; an unknown one asks for English: '+w.ar.join(' | '));
    ok(w.slate.every(x=>/^tie:slate::1:$/.test(x)),'the app\'s own color name with its hyphen is no "read as": '+w.slate.join(' | '));
    /* ---- W2-20-01: a file that can't be read ---- */
    const f=await p.evaluate(async()=>{kitImportOpen();const bad={arrayBuffer:()=>Promise.reject(new DOMException('The I/O read operation failed.','NotReadableError')),text:()=>Promise.reject(new DOMException('The I/O read operation failed.','NotReadableError'))};
      await kitImportFile(bad);const t=document.querySelector('#kit-prev').textContent;kitClose();return t});
    ok(/This file couldn’t be read/.test(f),'a file that can\'t be read says so: '+f);
    /* ---- W1-2-01 and W1-2-02: own colours from the 14 Nov version ---- */
    const o=await p.evaluate(async()=>{for(const i of items.slice())await kitDelMany([i.id]);
      settings.custom={colors:[{key:'ownmocha',name:'Mocha',hex:'#6f4e37',base:'brown',types:['suit']},{key:'owngray',name:'Gray',hex:'#eeeeee',base:'white',types:['shirt']},{key:'ownnavy',name:'Navy',hex:'#7a7f88',base:'grey',types:['suit','blazer','pants']}],patterns:[]};applyCustom(settings.custom);
      const mk=(id,type,c,name)=>({id,type,primaryColor:c,secondaryColor:null,pattern:'solid',name,added:1,updated:1});
      const old=[mk('o1','tie','1','Gray tie'),mk('o2','pants','2','Navy trousers'),mk('o3','suit','0','Mocha two'),{...mk('o4','shirt','white','Two'),secondaryColor:'2'}];
      await kitStore(old);const n=await kitFixOldImports();const disk=await tx('readonly',s=>s.getAll());const again=await kitFixOldImports();
      const imp=kitRead('Type,Colour\nSuit,Navy\nTie,Navy\nTrousers,Gray\nShirt,Gray\nSuit,Grey\nSuit,Mocha\n').rows.map(x=>x.card.primaryColor);
      return {n,again,cols:disk.sort((a,b)=>a.id<b.id?-1:1).map(i=>[i.primaryColor,i.secondaryColor].filter(Boolean).join('+')),stamped:disk.every(i=>i.updated>1),imp}});
    ok(o.n===4&&o.again===0&&o.cols.join()==='grey,navy,ownmocha,white+navy'&&o.stamped,`a list number saved as a color by the 14 Nov import becomes the color its own colour's name means, stamped to sync, once (${JSON.stringify(o)})`);
    ok(o.imp.join()==='navy,navy,grey,grey,grey,ownmocha','the app\'s own color names come before own colours named alike ("Navy", "Gray"); other own colours still read by name: '+o.imp.join());
    ok(!p.errs.length,'no page errors: '+p.errs.join(' | '));
  }finally{await browser.close()}
};
