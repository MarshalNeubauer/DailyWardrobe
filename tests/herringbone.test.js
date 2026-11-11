// Claude's herringbone or twill reading is drawn with the woven tile (columns of slanted twill lines turning at each column edge),
// not by tiling Claude's one-repeat bitmap: the user's blue shirt came back as one V ("10000001/01000010/00100100/00011000"),
// which tiles into horizontal zigzags. Figured weaves (a diamond dobby) keep the bitmap.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  try{
    const p=await browser.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(()=>{const hb={id:'b',type:'shirt',primaryColor:'blue',pattern:'herringbone',sett:{v:4,tex:{kind:'herringbone',grid:['10000001','01000010','00100100','00011000'],aspect:.6,lighter:true,contrast:'subtle',rel:.35},a:0,cr:60,tr:80}};
      const tw={...hb,id:'t',pattern:'twill',sett:{...hb.sett,tex:{...hb.sett.tex,kind:'twill',grid:['10','01']}}};
      const dm={...hb,id:'d',pattern:'dobby',sett:{...hb.sett,tex:{...hb.sett.tex,kind:'diamond'}}};
      const cols=s=>(s.match(/<svg [^>]*width=/g)||[]).length,lines=s=>(s.match(/stroke-opacity/g)||[]).length,w=s=>+(s.match(/<pattern[^>]*width="([\d.]+)"/)||[])[1];
      const sw=fabricDef('a',hb,'shirt'),dot=fabricDef('b',hb,'shirt','dot'),fig=fabricDef('c',hb,'shirt','fig'),dia=fabricDef('d',hb,'shirt','dia');
      const ln=s=>+((s.match(/stroke-opacity="([\d.]+)"/)||[])[1]);
      return {img:/<image/.test(sw+dot+fig+dia),cols:[sw,dot,fig,dia].every(s=>cols(s)===2),swW:w(sw),dotW:w(dot),k:[ln(sw),ln(dot),ln(dia)],
        twill:!/<image/.test(fabricDef('e',tw,'shirt'))&&lines(fabricDef('e',tw,'shirt'))>=2,diamond:/<image/.test(fabricDef('f',dm,'shirt'))}});
    ok(!r.img&&r.cols,'a herringbone reading is drawn as two columns of slanted lines that turn at the edge, in every size (not Claude\'s bitmap)');
    ok(r.swW>=5&&r.swW<=10&&Math.abs(r.dotW-16/3)<.01,`at a scale that shows: at most 20 column pairs in a swatch though Claude counted 60 (repeat ${r.swW}), three in Today's small squares (${r.dotW.toFixed(2)})`);
    ok(r.k[1]>r.k[0]&&r.k[2]>r.k[0],`stronger where it's small and for the photo generator (line opacity ${r.k.join(' / ')})`);
    ok(r.twill&&r.diamond,'a twill reading is drawn as twill; a diamond dobby keeps Claude\'s bitmap');
    const pk=await p.evaluate(()=>{const g=['1000000110','0100001010','0010010010','0001100010'],pink={id:'p',type:'shirt',primaryColor:'pink',pattern:'herringbone',sett:{v:4,tex:{kind:'herringbone',grid:g,aspect:.3,lighter:true,contrast:'subtle',rel:.179},a:0,cr:13,tr:45}};
      const d=fabricDef('a',pink,'shirt'),w=+(d.match(/<pattern[^>]*width="([\d.]+)"/)||[])[1],cw=+(d.match(/<svg width="([\d.]+)"/)||[])[1];
      return {band:texPlainBand(g),blue:texPlainBand(['10000001','01000010','00100100','00011000']),w,cw,sheen:/<rect x="[\d.]+" width="[\d.]+" height="[\d.]+" fill="#fff"/.test(d)}});
    ok(pk.band&&Math.abs(pk.band.share-.2)<1e-9&&pk.band.light&&pk.blue===null,'the user\'s pink herringbone stripe: Claude\'s bitmap has a plain band (a column all 1, a column all 0: 20% of the repeat, shiny); the blue shirt has none');
    ok(Math.abs(pk.w-(2*pk.cw+2*(2*pk.cw*.25)))<.01&&pk.sheen,`it is drawn alternating, as on the shirt: a twill column, a plain shiny band, the column slanting the other way, a band (repeat ${pk.w.toFixed(2)}, columns ${pk.cw.toFixed(2)})`);
    const order=await p.evaluate(()=>{const pink={id:'p',type:'shirt',primaryColor:'pink',pattern:'herringbone',sett:{v:4,tex:{kind:'herringbone',grid:['1000000110','0100001010','0010010010','0001100010'],lighter:true,rel:.179},a:0,cr:13,tr:45}};
      const d=fabricDef('a',pink,'shirt');return [...d.matchAll(/<(svg) [^>]*x="([\d.]+)"|<svg width|<rect x="([\d.]+)" width="([\d.]+)" height="[\d.]+" fill="#fff"/g)].map(m=>m[0].startsWith('<svg')?'col':'band')});
    ok(order.join(',')==='col,band,col,band',`one band after each column (${order.join(', ')})`);
    const src=require('fs').readFileSync(require('path').join(__dirname,'..','worker.js'),'utf8');
    ok(/plain \(untwilled\) bands/.test(src),'Claude is told to mark a stripe\'s plain bands as columns that are the same all the way down');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
