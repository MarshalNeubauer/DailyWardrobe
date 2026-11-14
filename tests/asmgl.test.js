// The graphics chip's painter (asm-gl.js, 2026-11-14): every look it covers is painted both ways in this Chromium (WebGL2 on SwiftShader)
// and the two pictures must agree, largest difference at most 2 levels a channel and mean under 0.1; the looks it doesn't cover, a page
// with no WebGL2 and a lost context are painted on the CPU; the real worker paints a covered look on its graphics chip; the switch and
// the page's routing. Fixtures: the suit and shirt-and-tie masters at 512 (tests/fixtures/cm/<kind>), the vest, vest-open, suit-open and
// shirt-open masters derived from them here (stage 5), a stand-in background, and for some looks stand-in solved cloth positions
// (asmGeoPrep's maps, made here from each master's own parts).
// LOOKS is the table later stages add rows to: a look's jacket, shirt and tie, whether it has solved positions, and whether the graphics
// chip paints it (gl) or must leave it to the CPU (why: the reason asmGlWhy gives).
const fs=require('fs'),path=require('path');
// readings (sett) as Claude gives them: the owner's navy pinstripe (tests/asm2048.test.js), a khaki windowpane (its white-blue-white line
// group both ways; no linen in its description), a charcoal pinstripe whose description says herringbone (asmClothOf: the grain's columns)
const PIN={v:2,a:0,bands:[['#2b365a',.94],['#a3aecb',.06]],cross:null,cr:7,tr:40,src:'claude+pixels'};
const WPB=[['#baa98e',.905],['#e0d9c9',.02],['#baa98e',.015],['#97b0c5',.025],['#baa98e',.015],['#e0d9c9',.02]];
const WP={v:2,a:0,bands:WPB,cross:{d:90,bands:WPB.map((b,k)=>[k===0||k===2||k===4?null:b[0],b[1]]),r:1.05},cr:3.8,tr:11,src:'claude+pixels'};
const HBP={v:2,a:0,bands:[['#3b3d42',.47],['#b8b8b4',.06],['#3b3d42',.47]],cross:null,cr:6,tr:30,src:'claude+pixels'};
// the owner's navy & pink stripe tie (tests/asm2048.test.js), its count as the close-up shows it
const STT={v:2,a:-45,bands:[['#16151d',.85],['#e090a0',.15]],cross:null,cr:2.75,tr:3.6,src:'claude+pixels'};
// the owner's pink herringbone shirt (tests/herringbone.test.js)
const HBS={v:4,tex:{kind:'herringbone',grid:['1000000110','0100001010','0010010010','0001100010'],aspect:.3,lighter:true,contrast:'subtle',rel:.179},a:0,cr:13,tr:45};
const LOOKS=[
  {name:'plain navy',top:['suit','navy'],shirt:'pink',tie:'burgundy',gl:true},
  {name:'plain mid grey',top:['suit','midgrey'],shirt:'white',tie:'navy',gl:true},
  {name:'plain black (full look)',top:['suit','black'],shirt:'white',tie:'black',gl:true},
  {name:'plain light grey blazer, solved positions',top:['blazer','lightgrey'],shirt:'lightblue',tie:'burgundy',geo:true,gl:true},
  {name:'twill charcoal',top:['suit','charcoal',{pattern:'twill'}],shirt:'pink',tie:'burgundy',gl:true},
  {name:'twill navy, solved positions',top:['suit','navy',{pattern:'twill'}],shirt:'white',tie:'burgundy',geo:true,gl:true},
  {name:'twill tan and brown',top:['suit','tan',{pattern:'twill',secondaryColor:'brown'}],shirt:'pink',tie:'navy',gl:true},
  {name:'twill light grey, solved positions',top:['suit','lightgrey',{pattern:'twill'}],shirt:'white',tie:'wine',geo:true,gl:true},
  // stage 2: jackets read in bands (asmSuitTex), with the stripe breakup (T.k: kept as they were), the look or the folds' lighting (checks)
  // (has: what the jacket's cloth must be, so a row can't quietly turn into a plain one: the band tile, the stripe breakup, the grain)
  {name:'navy pinstripe',top:['suit','navy',{pattern:'pinstripe',sett:PIN}],shirt:'white',tie:'burgundy',gl:true,has:'tile,k'},
  {name:'navy pinstripe, solved positions',top:['suit','navy',{pattern:'pinstripe',sett:PIN}],shirt:'lightblue',tie:'wine',geo:true,gl:true,has:'tile,k'},
  {name:'grey chalk stripe on twill',top:['suit','grey',{pattern:'chalk-stripe',patternText:'chalk stripe on a twill',sett:{v:2,a:0,bands:[['#55585e',.9],['#d6d4cc',.1]],cross:null,cr:5,tr:22,src:'claude+pixels'}}],shirt:'white',tie:'navy',gl:true,has:'tile,k,twill'},
  {name:'khaki windowpane',top:['blazer','khaki',{pattern:'windowpane',sett:WP}],shirt:'lightblue',tie:'navy',gl:true,has:'tile'},
  {name:'khaki windowpane, solved positions',top:['blazer','khaki',{pattern:'windowpane',sett:WP}],shirt:'white',tie:'burgundy',geo:true,gl:true,has:'tile'},
  // (the owner's khaki windowpane reads as "a slubby linen-blend ground": the linen texture, asmLinenTile, faded at its texels' edges)
  {name:'khaki linen windowpane',top:['blazer','khaki',{pattern:'windowpane',patternText:'a slubby linen-blend ground',sett:WP}],shirt:'lightblue',tie:'navy',gl:true,has:'tile,linen'},
  {name:'khaki linen windowpane, solved positions',top:['blazer','khaki',{pattern:'windowpane',material:'linen',sett:WP}],shirt:'white',tie:'navy',geo:true,gl:true,has:'tile,linen'},
  {name:'two-colour check (dark: the full look)',top:['blazer','navy',{pattern:'check',sett:{v:2,a:0,bands:[['#1b2333',.5],['#3a4a63',.5]],cross:{d:90,bands:[['#1b2333',.5],['#3a4a63',.5]],r:1},cr:3,tr:14,src:'claude+pixels'}}],shirt:'white',tie:'burgundy',gl:true,has:'tile'},
  {name:'charcoal pinstripe on herringbone',top:['suit','charcoal',{pattern:'pinstripe',patternText:'pinstripe on a herringbone',sett:HBP}],shirt:'pink',tie:'navy',gl:true,has:'tile,k,herringbone-cols'},
  {name:'charcoal pinstripe on herringbone, solved positions',top:['suit','charcoal',{pattern:'pinstripe',patternText:'pinstripe on a herringbone',sett:HBP}],shirt:'white',tie:'burgundy',geo:true,gl:true,has:'tile,k,herringbone-cols'},
  // stage 3: the standalone herringbone (asmTwillTex: yarn, floats, grain cells, mottle, the column break: hbx), tweed (asmTweedTile; a
  // Donegal's fleck in its second colour), the small woven figures (asmMicroTex's thread grid: wv-<kind>); c2: a second colour
  {name:'charcoal tonal herringbone',top:['suit','charcoal',{pattern:'herringbone'}],shirt:'white',tie:'burgundy',gl:true,has:'herringbone-cols,hbx'},
  {name:'charcoal tonal herringbone, solved positions',top:['suit','charcoal',{pattern:'herringbone'}],shirt:'lightblue',tie:'navy',geo:true,gl:true,has:'herringbone-cols,hbx'},
  {name:'dark grey herringbone',top:['suit','darkgrey',{pattern:'herringbone'}],shirt:'pink',tie:'navy',gl:true,has:'herringbone-cols,hbx'},
  {name:'grey and navy herringbone',top:['blazer','grey',{pattern:'herringbone',secondaryColor:'navy'}],shirt:'white',tie:'burgundy',gl:true,has:'herringbone-cols,hbx,c2'},
  {name:'slate tweed',top:['blazer','slate',{pattern:'tweed'}],shirt:'white',tie:'wine',gl:true,has:'tweed'},
  {name:'Donegal tweed with fleck',top:['blazer','grey',{pattern:'tweed',secondaryColor:'rust'}],shirt:'lightblue',tie:'navy',gl:true,has:'tweed,c2'},
  {name:'tonal houndstooth',top:['blazer','brown',{pattern:'houndstooth'}],shirt:'white',tie:'navy',gl:true,has:'wv-houndstooth,c2'},
  {name:'black and white houndstooth',top:['blazer','black',{pattern:'houndstooth',secondaryColor:'white'}],shirt:'white',tie:'burgundy',gl:true,has:'wv-houndstooth,c2'},
  {name:'sharkskin',top:['suit','grey',{pattern:'sharkskin'}],shirt:'white',tie:'navy',gl:true,has:'wv-sharkskin'},
  {name:'sharkskin, solved positions',top:['suit','grey',{pattern:'sharkskin'}],shirt:'pink',tie:'navy',geo:true,gl:true,has:'wv-sharkskin'},
  {name:'birdseye',top:['suit','navy',{pattern:'birdseye'}],shirt:'white',tie:'burgundy',gl:true,has:'wv-birdseye'},
  {name:'nailhead',top:['suit','charcoal',{pattern:'nailhead'}],shirt:'lightblue',tie:'wine',gl:true,has:'wv-nailhead'},
  // stage 4: ties read from a tile (asmTieFor: tie-bands, tie-motif, tie-tex-<kind> (texmax: the twill's count held at ASM_TIE_TEX_MAX),
  // tie-knit, tie-paisley), the tie clip (asmBarDraw, after read-back: clip), shirts drawn from a tile (asmCmTile: shirt-tile; fine: a
  // woven shirt's 3x3 points; hbs: the herringbone shirt's look, asmHbShirtLook)
  {name:'navy & pink stripe tie',top:['suit','navy'],shirt:'white',tie:['navy',{pattern:'stripe',secondaryColor:'pink',sett:STT}],gl:true,has:'tie-bands'},
  {name:'navy & pink stripe tie, solved positions',top:['suit','charcoal'],shirt:'lightblue',tie:['navy',{pattern:'stripe',secondaryColor:'pink',sett:STT}],geo:true,gl:true,has:'tie-bands'},
  {name:'foulard (neat motif) tie',top:['suit','grey'],shirt:'white',tie:['navy',{pattern:'foulard',sett:{v:3,motif:{grid:'diagonal',ground:'#313363',figs:[{shape:'square',place:'cell',size:.9,cols:['#755ea0']}]},a:45,cr:17,tr:20,src:'claude+pixels'}}],gl:true,has:'tie-motif'},
  {name:'charcoal check tie',top:['suit','navy'],shirt:'lightblue',tie:['charcoal',{pattern:'check',sett:{v:2,a:0,bands:[['#3a3b3f',.6],['#8a8c90',.4]],cross:{d:90,bands:[['#3a3b3f',.6],['#8a8c90',.4]],r:1},cr:4,tr:6,src:'claude+pixels'}}],gl:true,has:'tie-bands'},
  {name:'tonal woven tie',top:['suit','charcoal'],shirt:'white',tie:['black',{pattern:'woven',sett:{v:4,tex:{kind:'diamond',grid:['00011000','00100100','01000010','10000001','10000001','01000010','00100100','00011000'],aspect:1,lighter:true,contrast:'medium',rel:.35},a:0,cr:40,tr:32,src:'claude+pixels'}}],gl:true,has:'tie-tex-diamond'},
  {name:'burgundy twill tie',top:['suit','navy'],shirt:'white',tie:['burgundy',{pattern:'woven',sett:{v:4,tex:{kind:'twill',grid:['0001','0010','0100','1000'],aspect:1,lighter:true,contrast:'low',rel:.35},a:0,cr:60,tr:80,src:'claude+pixels'}}],gl:true,has:'tie-tex-twill,texmax'},
  {name:'knit tie',top:['suit','grey'],shirt:'white',tie:['navy',{pattern:'knit'}],gl:true,has:'tie-knit'},
  {name:'paisley tie',top:['suit','navy'],shirt:'white',tie:['burgundy',{pattern:'paisley',secondaryColor:'navy'}],gl:true,has:'tie-paisley'},
  {name:'stripe tie with a clip',top:['suit','navy'],shirt:'white',tie:['navy',{pattern:'stripe',secondaryColor:'pink',sett:STT}],clip:'silver',gl:true,has:'tie-bands,clip'},
  {name:'pink herringbone shirt',top:['suit','navy'],shirt:['pink',{pattern:'herringbone',sett:HBS}],tie:'navy',gl:true,has:'shirt-tile,fine,hbs'},
  {name:'pink herringbone shirt, solved positions',top:['suit','charcoal'],shirt:['pink',{pattern:'herringbone',sett:HBS}],tie:'navy',geo:true,gl:true,has:'shirt-tile,fine,hbs'},
  {name:'white woven diamond (dobby) shirt',top:['suit','navy'],shirt:['white',{pattern:'woven',sett:{v:4,tex:{kind:'diamond',grid:['1001','0110','0110','1001'],aspect:1.4,lighter:true,contrast:'subtle',rel:.2},a:0,cr:24,tr:45}}],tie:'burgundy',gl:true,has:'shirt-tile,fine'},
  {name:'grey chevron motif shirt',top:['suit','navy'],shirt:['white',{secondaryColor:'grey',pattern:'dobby',sett:{v:3,motif:{grid:'straight',ground:'#eeeef2',groundName:'white',figs:[{shape:'figure',place:'cell',size:.5,cols:['#6a6870'],bmp:['1000001','1100011','1111111','0111110','0011100','0001000']}],aspect:.82},a:0,cr:10,tr:80,src:'claude+pixels'}}],tie:'burgundy',gl:true,has:'shirt-tile,shirt-motif'},
  {name:'gingham shirt',top:['suit','navy'],shirt:['lightblue',{pattern:'gingham'}],tie:'burgundy',gl:true,has:'shirt-tile'},
  {name:'blue stripe shirt',top:['suit','grey'],shirt:['white',{pattern:'stripe',secondaryColor:'blue'}],tie:'navy',gl:true,has:'shirt-tile'},
  {name:'blue stripe shirt, solved positions',top:['suit','navy'],shirt:['white',{pattern:'stripe',secondaryColor:'blue'}],tie:'burgundy',geo:true,gl:true,has:'shirt-tile'},
  {name:'end-on-end fleck shirt',top:['suit','navy'],shirt:['lightblue',{pattern:'end-on-end'}],tie:'navy',gl:true,has:'shirt-tile'},
  {name:'navy stripe shirt (dark: the full look), paisley tie',top:['suit','grey'],shirt:['navy',{pattern:'stripe',secondaryColor:'white'}],tie:['burgundy',{pattern:'paisley',secondaryColor:'navy'}],gl:true,has:'tie-paisley,shirt-tile'},
  // stage 5: every other master. The waistcoat (vest; the jacket's own cloth), a jacket without a tie (suit-open, vest-open), the shirt
  // masters (shirt-tie, shirt-open: the trousers along the legs, a read trousers' tile, the belt, the buckle, the shirt's sleeves) and a
  // suit's own trousers with its jacket taken off (suitBot). has: m-<master>, wc (a waistcoat zone), gs (the shirt's sleeves), legs (the
  // legs' table), belt, buckle, tr-tile (a read trousers' tile), suitbot; the trousers' suit cloth takes the jacket's tags
  {name:'vest: plain navy suit',top:['suit','navy'],vest:true,shirt:'white',tie:'burgundy',gl:true,has:'m-vest,wc'},
  {name:'vest: plain mid grey suit, pink shirt, navy tie',top:['suit','midgrey'],vest:true,shirt:'pink',tie:'navy',gl:true,has:'m-vest,wc'},
  {name:'vest: plain black suit, solved positions',top:['suit','black'],vest:true,shirt:'lightblue',tie:'wine',geo:true,gl:true,has:'m-vest,wc'},
  {name:'vest: twill charcoal suit',top:['suit','charcoal',{pattern:'twill'}],vest:true,shirt:'white',tie:'burgundy',gl:true,has:'twill,m-vest,wc'},
  {name:'vest: twill tan and brown suit, solved positions',top:['suit','tan',{pattern:'twill',secondaryColor:'brown'}],vest:true,shirt:'pink',tie:'navy',geo:true,gl:true,has:'twill,c2,m-vest,wc'},
  {name:'vest: navy pinstripe suit',top:['suit','navy',{pattern:'pinstripe',sett:PIN}],vest:true,shirt:'white',tie:'burgundy',gl:true,has:'tile,k,m-vest,wc'},
  {name:'vest: navy pinstripe suit, solved positions, stripe tie',top:['suit','navy',{pattern:'pinstripe',sett:PIN}],vest:true,shirt:'lightblue',tie:['navy',{pattern:'stripe',secondaryColor:'pink',sett:STT}],geo:true,gl:true,has:'tile,k,tie-bands,m-vest,wc'},
  {name:'vest-open: plain grey suit',top:['suit','grey'],vest:true,shirt:'white',tie:null,gl:true,has:'m-vest-open,wc'},
  {name:'suit-open: plain navy',top:['suit','navy'],shirt:'white',tie:null,gl:true,has:'m-suit-open'},
  {name:'suit-open: plain light grey blazer, solved positions, blue stripe shirt',top:['blazer','lightgrey'],shirt:['white',{pattern:'stripe',secondaryColor:'blue'}],tie:null,geo:true,gl:true,has:'shirt-tile,m-suit-open'},
  {name:'suit-open: khaki windowpane',top:['blazer','khaki',{pattern:'windowpane',sett:WP}],shirt:'lightblue',tie:null,gl:true,has:'tile,m-suit-open'},
  {name:'suit-open: navy pinstripe, solved positions',top:['suit','navy',{pattern:'pinstripe',sett:PIN}],shirt:'pink',tie:null,geo:true,gl:true,has:'tile,k,m-suit-open'},
  {name:'shirt-tie: plain grey trousers',bot:['pants','grey'],belt:'black',shirt:'white',tie:'burgundy',gl:true,has:'m-shirt-tie,gs,legs,belt,buckle'},
  {name:'shirt-tie: plain trousers, solved positions',bot:['pants','charcoal'],belt:'brown',shirt:'lightblue',tie:'navy',geo:true,gl:true,has:'m-shirt-tie,gs,legs,belt,buckle'},
  {name:'shirt-tie: khaki chinos twill',bot:['pants','khaki',{trouserKind:'chinos',pattern:'twill'}],belt:'brown',shirt:'white',tie:'navy',gl:true,has:'twill,m-shirt-tie,gs,legs,belt,buckle'},
  {name:'shirt-tie: chinos twill, solved positions',bot:['pants','khaki',{trouserKind:'chinos',pattern:'twill'}],belt:'tan',shirt:'pink',tie:'navy',geo:true,gl:true,has:'twill,m-shirt-tie,gs,legs,belt,buckle'},
  {name:'shirt-tie: jeans',bot:['pants','navy',{trouserKind:'jeans',pattern:'twill',material:'denim'}],belt:'brown',shirt:'white',tie:'burgundy',gl:true,has:'twill,m-shirt-tie,gs,legs,belt,buckle'},
  {name:'shirt-tie: suit trousers in pinstripe (jacket taken off)',bot:['suit','navy',{pattern:'pinstripe',sett:PIN}],suitBot:true,belt:'black',shirt:'white',tie:'burgundy',gl:true,has:'tile,k,m-shirt-tie,gs,legs,belt,buckle,suitbot'},
  {name:'shirt-tie: suit trousers in pinstripe, solved positions',bot:['suit','navy',{pattern:'pinstripe',sett:PIN}],suitBot:true,belt:'black',shirt:'lightblue',tie:'wine',geo:true,gl:true,has:'tile,k,m-shirt-tie,gs,legs,belt,buckle,suitbot'},
  {name:'shirt-tie: Donegal tweed trousers',bot:['pants','grey',{pattern:'tweed',secondaryColor:'rust'}],belt:'brown',shirt:'white',tie:'navy',gl:true,has:'tweed,c2,m-shirt-tie,gs,legs,belt,buckle'},
  {name:'shirt-tie: tweed trousers, solved positions',bot:['pants','slate',{pattern:'tweed'}],belt:'brown',shirt:'lightblue',tie:'wine',geo:true,gl:true,has:'tweed,m-shirt-tie,gs,legs,belt,buckle'},
  {name:'shirt-tie: charcoal herringbone trousers',bot:['pants','charcoal',{pattern:'herringbone'}],belt:'black',shirt:'white',tie:'burgundy',gl:true,has:'herringbone-cols,hbx,m-shirt-tie,gs,legs,belt,buckle'},
  {name:'shirt-tie: houndstooth trousers',bot:['pants','brown',{pattern:'houndstooth'}],belt:'brown',shirt:'white',tie:'navy',gl:true,has:'wv-houndstooth,c2,m-shirt-tie,gs,legs,belt,buckle'},
  {name:'shirt-tie: read check trousers',bot:['pants','grey',{pattern:'check',sett:{v:2,a:0,bands:[['#55585e',.6],['#8a8c90',.4]],cross:{d:90,bands:[['#55585e',.6],['#8a8c90',.4]],r:1},cr:3,tr:14,src:'claude+pixels'}}],belt:'black',shirt:'white',tie:'navy',gl:true,has:'m-shirt-tie,gs,legs,belt,buckle,tr-tile'},
  {name:'shirt-tie: read check trousers, solved positions',bot:['pants','grey',{pattern:'check',sett:{v:2,a:0,bands:[['#55585e',.6],['#8a8c90',.4]],cross:{d:90,bands:[['#55585e',.6],['#8a8c90',.4]],r:1},cr:3,tr:14,src:'claude+pixels'}}],belt:'black',shirt:'pink',tie:'navy',geo:true,gl:true,has:'m-shirt-tie,gs,legs,belt,buckle,tr-tile'},
  {name:'shirt-tie: pink herringbone shirt on the sleeves',bot:['pants','grey'],belt:'black',shirt:['pink',{pattern:'herringbone',sett:HBS}],tie:'navy',gl:true,has:'shirt-tile,fine,hbs,m-shirt-tie,gs,legs,belt,buckle'},
  {name:'shirt-tie: pink herringbone shirt, solved positions',bot:['pants','navy'],belt:'brown',shirt:['pink',{pattern:'herringbone',sett:HBS}],tie:'navy',geo:true,gl:true,has:'shirt-tile,fine,hbs,m-shirt-tie,gs,legs,belt,buckle'},
  {name:'shirt-tie: navy & pink stripe tie',bot:['pants','grey'],belt:'black',shirt:'white',tie:['navy',{pattern:'stripe',secondaryColor:'pink',sett:STT}],gl:true,has:'tie-bands,m-shirt-tie,gs,legs,belt,buckle'},
  {name:'shirt-tie: paisley tie, solved positions, with a clip',bot:['pants','khaki'],belt:'brown',shirt:'lightblue',tie:['burgundy',{pattern:'paisley',secondaryColor:'navy'}],clip:'silver',geo:true,gl:true,has:'tie-paisley,clip,m-shirt-tie,gs,legs,belt,buckle'},
  {name:'shirt-open: plain white shirt',bot:['pants','grey'],belt:'black',shirt:'white',tie:null,gl:true,has:'m-shirt-open,gs,legs,belt,buckle'},
  {name:'shirt-open: blue stripe shirt, solved positions',bot:['pants','navy'],belt:'brown',shirt:['white',{pattern:'stripe',secondaryColor:'blue'}],tie:null,geo:true,gl:true,has:'shirt-tile,m-shirt-open,gs,legs,belt,buckle'},
  {name:'shirt-open: gingham shirt, tan belt',bot:['pants','khaki',{trouserKind:'chinos',pattern:'twill'}],belt:'tan',shirt:['lightblue',{pattern:'gingham'}],tie:null,gl:true,has:'twill,shirt-tile,m-shirt-open,gs,legs,belt,buckle'},
  {name:'shirt-open: jacket and tie taken off, suit trousers in pinstripe',bot:['suit','navy',{pattern:'pinstripe',sett:PIN}],suitBot:true,belt:'black',shirt:'white',tie:null,gl:true,has:'tile,k,m-shirt-open,gs,legs,belt,buckle,suitbot'},
  // not covered: the CPU paints it (the cloth look off; since stage 5 no other look a phone paints is left to the CPU on any master)
  {name:'cloth look off',top:['suit','navy'],shirt:['lightblue',{pattern:'gingham'}],tie:'burgundy',jx:{look:false},gl:false,why:/cloth look off/},
].filter(L=>!process.env.ASMGL_ONLY||new RegExp(process.env.ASMGL_ONLY).test(L.name));
// (ASMGL_SIZE=2048 paints the looks at a phone's size, the fixtures enlarged: the spot check; ASMGL_ONLY=<regexp> picks rows by name)
const SIZE=+process.env.ASMGL_SIZE||512;
module.exports=async({ok,chromium,url})=>{
  const HOST='https://w.test/';
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844}});const served={};
    await ctx.route(HOST+'**',route=>{const u=new URL(route.request().url()),k=u.searchParams.get('key');const j=(b,s=200)=>route.fulfill({status:s,contentType:'application/json',body:JSON.stringify(b)});
      if(u.pathname==='/render'&&k)return served[k]?j(served[k]):j({error:'not found'},404);
      if(u.pathname==='/me')return j({id:'owner',role:'owner',name:'Owner',caps:null,used:{}});
      if(u.pathname==='/sync')return j({rev:0,saved:0,data:null});return j({ok:true})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    // (stage 5) a program that won't build or a painting that fails says why (asmGlInit, asmGlTry warn 'asm-gl …')
    p.on('console',m=>{const t=m.text();if(/^asm-gl/.test(t)&&!/context lost/.test(t))console.log('    [console] '+t.slice(0,600))});
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    // the two masters with fixtures (tests/fixtures/cm/<kind> at 512): the suit and the shirt-and-tie masters
    for(const kind of ['suit','shirt-tie']){const FIX=path.join(__dirname,'fixtures','cm',kind),recs={};
      for(const f of fs.readdirSync(FIX)){const n=f.replace(/\.(png|jpg)$/,'').replace(/^mask-/,'mask/').replace(/^part-/,'part/');
        recs[n]={sig:'asm/cm test',img:`data:image/${f.endsWith('.jpg')?'jpeg':'png'};base64,`+fs.readFileSync(path.join(FIX,f)).toString('base64'),model:'colormaster',t:1000}}
      const keys=await p.evaluate(([kind,ns])=>Object.fromEntries(ns.map(n=>[n,asmCmKey(kind,n)])),[kind,Object.keys(recs)]);
      for(const [n,r] of Object.entries(recs))served[keys[n]]=r}
    // the masters, a stand-in background (a cream wall, a window, a desk and laptop, fixed noise, blurred), the jobs and the stand-in maps
    const setup=await p.evaluate(async([h,LOOKS,SIZE])=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','owner');self.ASM_CM_SIZE=SIZE;asmAheadSoon=()=>{};asmAhead=async()=>{};
      if(!await asmCmGet('suit')||!await asmCmGet('shirt-tie'))return {err:'no master'};
      // (stage 5) stand-in masters derived from the two (no real masters downloaded): suit-open = the suit master with its tie's share given
      // to the shirt; vest = the suit master with the lower part of the shirt's front in the V as the waistcoat; vest-open = the vest master
      // with its tie given to the waistcoat below the waistcoat's top and to the shirt above; shirt-open = the shirt-and-tie master with its
      // tie given to the shirt
      const S0=512,N0=S0*S0,rd=async(kind,z)=>{const d=(await asmData(renders[asmCmKey(kind,'mask/'+z)].img,S0)).data,a=new Uint8Array(N0);for(let k=0;k<N0;k++)a[k]=d[4*k];return a};
      const png=a=>{const c=document.createElement('canvas');c.width=c.height=S0;const x=c.getContext('2d'),d=x.createImageData(S0,S0);for(let k=0;k<N0;k++){d.data[4*k]=d.data[4*k+1]=d.data[4*k+2]=a[k];d.data[4*k+3]=255}x.putImageData(d,0,0);return c.toDataURL('image/png')};
      const put=(kind,n,img)=>{renders[asmCmKey(kind,n)]={img,t:1000,sig:'asm/cm test',model:'colormaster'}};
      const copy=(from,to)=>{for(const n of ['master','part/sleeveR','part/sleeveL','part/lapelR','part/lapelL'])if(renders[asmCmKey(from,n)])put(to,n,renders[asmCmKey(from,n)].img)};
      const add=(a,b,m)=>a.map((v,k)=>Math.min(255,v+(!m||m[k]?b[k]:0)));
      const sm={},st={};for(const z of ASM_CM_KINDS.suit.zones)sm[z]=await rd('suit',z);for(const z of ASM_CM_KINDS['shirt-tie'].zones)st[z]=await rd('shirt-tie',z);
      copy('suit','suit-open');for(const z of ASM_CM_KINDS['suit-open'].zones)put('suit-open','mask/'+z,png(z==='shirt'?add(sm.shirt,sm.tie):sm[z]));
      copy('shirt-tie','shirt-open');for(const z of ASM_CM_KINDS['shirt-open'].zones)put('shirt-open','mask/'+z,png(z==='shirt'?add(st.shirt,st.tie):st[z]));
      // the shirt's front: its largest piece; the waistcoat from 35% of the way down it
      const lab=new Int32Array(N0).fill(-1);let best=null;
      for(let s0=0;s0<N0;s0++){if(lab[s0]>=0||sm.shirt[s0]<=127)continue;const q=[s0];lab[s0]=s0;let n=0,x0=S0,x1=0,y0=S0,y1=0;
        while(q.length){const k=q.pop(),x=k%S0,y=(k-x)/S0;n++;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;for(const nb of [k-1,k+1,k-S0,k+S0])if(nb>=0&&nb<N0&&lab[nb]<0&&sm.shirt[nb]>127&&Math.abs(nb%S0-x)<=1){lab[nb]=s0;q.push(nb)}}
        if(!best||n>best.n)best={n,x0,x1,y0,y1}}
      const yT=Math.round(best.y0+.35*(best.y1-best.y0)),inW=k=>{const x=k%S0,y=(k-x)/S0;return x>=best.x0&&x<=best.x1&&y>=yT&&y<=best.y1};
      const wc=new Uint8Array(N0),sv=Uint8Array.from(sm.shirt);for(let k=0;k<N0;k++)if(sm.shirt[k]&&inW(k)){wc[k]=sm.shirt[k];sv[k]=0}
      copy('suit','vest');for(const z of ASM_CM_KINDS.vest.zones)put('vest','mask/'+z,png(z==='waistcoat'?wc:z==='shirt'?sv:sm[z]));
      const below=Uint8Array.from({length:N0},(_,k)=>(k/S0|0)>=yT?1:0),above=below.map(v=>1-v);
      copy('suit','vest-open');for(const z of ASM_CM_KINDS['vest-open'].zones)put('vest-open','mask/'+z,png(z==='waistcoat'?add(wc,sm.tie,below):z==='shirt'?add(sv,sm.tie,above):sm[z]));
      const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');let g=x.createLinearGradient(0,0,512,0);g.addColorStop(0,'#efe9df');g.addColorStop(1,'#d9d1c4');x.fillStyle=g;x.fillRect(0,0,512,512);
      x.fillStyle='#fbf8f2';x.fillRect(20,45,125,280);x.fillStyle='#7a5c40';x.fillRect(300,380,212,20);x.fillStyle='#2b2d31';x.fillRect(380,320,95,60);
      const id=x.getImageData(0,0,512,512);let s=7;for(let k=0;k<id.data.length;k+=4){s=(Math.imul(s,1103515245)+12345)>>>0;const v=(s/4294967296-.5)*6;id.data[k]+=v;id.data[k+1]+=v;id.data[k+2]+=v}x.putImageData(id,0,0);
      const b=document.createElement('canvas');b.width=b.height=512;const bx=b.getContext('2d');bx.filter='blur(3px)';bx.drawImage(c,0,0);
      renders[asmCmBgKey()]={img:b.toDataURL('image/png'),t:4242,sig:'asm/cm-bg test'};
      let n=0;const I=(type,c,x={})=>({id:type+(n++),type,primaryColor:c,pattern:'solid',...x}),watch=I('watch','silver',{metal:'silver'});items=[watch];
      window.__jobs=[];window.__its=[];for(const L of LOOKS){const it=([t,c,x])=>I(t,c,x||{}),top=L.top?it(L.top):null,bot=L.bot?it(L.bot):null,belt=L.belt?I('belt',L.belt):null;
        const sh=Array.isArray(L.shirt)?I('shirt',L.shirt[0],L.shirt[1]):I('shirt',L.shirt),tie=L.tie==null?null:Array.isArray(L.tie)?I('tie',L.tie[0],L.tie[1]):I('tie',L.tie);
        items.push(...[top,bot,belt,sh,tie].filter(Boolean));const clip=L.clip?I('tieclip',L.clip,{metal:L.clip}):null;
        const o={shirt:sh,watch,...(top?{top}:{}),...(bot?{bot}:{}),...(belt?{belt}:{}),...(tie?{tie}:{}),...(L.vest?{vest:true}:{}),...(L.suitBot?{suitBot:true}:{}),...(clip?{clip}:{})};
        const j=await asmCmJob(o);if(!j)return {err:'no job for '+L.name+' ('+asmCmKind(o)+')'};Object.assign(j,L.jx||{});j.diskCache=false;__jobs.push(j);__its.push({sh,tie,bot})}
      // stand-in solved positions at the maps' 2048: the body piece 1, sleeve parts 10+, lapels 40+ (from the master's own parts at 512), each
      // position a smooth bend of the picture's, encoded as asmGeoPrep reads them; one set per master
      const G=ASM_GEO_PX,pcs={};
      for(const kind of [...new Set(__jobs.map(j=>j.cm))]){const ix=LOOKS.map((L,i)=>i).filter(i=>__jobs[i].cm===kind);if(!ix.some(i=>LOOKS[i].geo))continue;
        const hit=await asmCmSetup(__jobs[ix[0]]),P=hit.P,A=P.A,f=G/P.S,pc=pcs[kind]={tie:0,cuff:0,front:0,sleeve:0,legs:0,other:0},on=(z,k)=>!!(A[z]&&A[z][k]);
        const enc=fn=>{const cv=document.createElement('canvas');cv.width=cv.height=G;const cx=cv.getContext('2d'),d=cx.createImageData(G,G);
          for(let Y=0;Y<G;Y++)for(let X=0;X<G;X++){const k=Math.floor(Y/f)*P.S+Math.floor(X/f),j=4*(Y*G+X),si=P.geo?P.geo.seg[k]:0,gs=P.geo?P.geo.segs[si]:null;
            // (stage 4) where there is no jacket: the tie's knot 80 above its neck and blade 81, the shirt's turned cuffs 60.., its front 2
            // (stage 5) the waistcoat as the body (1); on the shirt masters the trousers 3 and the shirt's sleeve parts 10+
            const cu=P.cuff?P.cuff[k]:255,r=on('jacket',k)?(!si?1:gs&&gs.parts?10+2*si:40+si):on('waistcoat',k)?1:on('trousers',k)?3:on('tie',k)?(Math.floor(k/P.S)<P.tieGeo.yk?80:81):
              on('shirt',k)?(cu<255&&P.cuffAng[cu]?60+Math.min(19,cu%20):!A.jacket&&si&&gs&&gs.parts?10+2*si:2):0,v=r?Math.round((fn(X,Y,r)+1024)*16):0;
            pc[r>=80?'tie':r>=60?'cuff':r===2?'front':r===3?'legs':r>=10&&r<40&&!A.jacket?'sleeve':'other']++;d.data[j]=v>>8;d.data[j+1]=v&255;d.data[j+2]=r;d.data[j+3]=255}
          cx.putImageData(d,0,0);return cv.toDataURL('image/png')};
        const geo={geoU:enc((X,Y,r)=>X*1.03+8*Math.sin(Y/150)+r),geoV:enc((X,Y,r)=>Y*.97+5*Math.sin(X/210)-r),gt:'77.78'};
        for(const i of ix)if(LOOKS[i].geo)Object.assign(__jobs[i],geo)}
      const hit=await asmCmSetup(__jobs[0]),P=hit.P,pc=pcs.suit;
      // the picture as asmCmBuild hands it to its JPEG encoder (raw pixels, not the JPEG)
      window.__cap=null;asmJpeg=async img=>{__cap=new Uint8ClampedArray(img.data);return 'data:image/jpeg;base64,'};
      window.__paint=async(i,gl)=>{const j={...__jobs[i],gl};const r=await asmCmBuild(j);return {r,px:__cap}};
      // the creased sleeves (the tube path's choice of upper arm or forearm, asmTubePartQ, in whole numbers on both painters): how many
      // quarter-pixel points the float rule (asmTubePart) would put in the other part
      const cr=P.geo.segs.filter(g=>g&&g.crease);let pts=0,moved=0;
      for(const g of cr)for(let k=0;k<P.N;k+=7){if(!P.A.jacket[k]||P.geo.segs[P.geo.seg[k]]!==g)continue;const X=k%P.S+.25,Y=(k-k%P.S)/P.S+.75;pts++;if(asmTubePartQ(g,X,Y)!==asmTubePart(g,X,Y))moved++}
      return {renderer:(()=>{const G2=asmGlInit(SIZE);return G2?G2.renderer:null})(),bg:!!__jobs[0].bg,crease:cr.length,pts,moved,pcs,cuffs:asmGlCuffs(P).n,kinds:[...new Set(__jobs.map(j=>j.cm))].join()}},[HOST,LOOKS,SIZE]);
    ok(!setup.err&&setup.bg,`the masters (${setup.kinds}), their masks and a background are on the page (${setup.err||'ok'})`);
    ok(!!setup.renderer,`WebGL2 here: ${setup.renderer}`);
    ok(setup.crease>=1&&setup.pts>100&&setup.moved<=setup.pts/1000,`the master has a creased sleeve (${setup.crease}), whose part the whole-number rule chooses as the float rule did (${setup.moved} of ${setup.pts} points moved)`);
    const pc=setup.pcs&&setup.pcs.suit;if(pc)ok(setup.cuffs>=1&&pc.tie>0&&pc.cuff>0&&pc.front>0,`the master has turned shirt cuffs (${setup.cuffs}), and the stand-in maps solve the tie, the cuffs and the shirt's front (${JSON.stringify(pc)} map pixels)`);
    const ps=setup.pcs&&setup.pcs['shirt-tie'];if(ps)ok(ps.legs>0&&ps.sleeve>0&&ps.tie>0&&ps.front>0,`(stage 5) the shirt-and-tie master's stand-in maps solve the trousers (3), the shirt's sleeves (10+), its front and the tie (${JSON.stringify(ps)} map pixels)`);
    // every look, both ways
    for(let i=0;i<LOOKS.length;i++){const L=LOOKS[i];
      const r=await p.evaluate(async i=>{const c=await __paint(i,false),why=asmGlWhy(__jobs[i],(await asmCmSetup(__jobs[i])).P),g=await __paint(i,true);
        const a=c.px,b=g.px,N=a.length/4;let mx=0,sum=0,over=0;for(let k=0;k<N;k++){let m=0;for(let q=0;q<3;q++){const d=Math.abs(a[4*k+q]-b[4*k+q]);sum+=d;if(d>m)m=d}if(m>mx)mx=m;if(m>2)over++}
        const J0=__jobs[i].cloth.jacket||__jobs[i].cloth.trousers,T=J0.suit,C=T&&T.cloth,W=T&&T.wv,has=!T?'':[T.TW>1||T.TH>1?'tile':'',T.k!=null?'k':'',C?C.kind+(C.cw?'-cols':''):'',C&&(C.yarn||C.float||C.grain||C.mottle||C.pbrk)?'hbx':'',
          T.tweed?'tweed':'',W?'wv-'+W.kind:'',(C&&C.c2)||(T.tweed&&T.c2)||(W&&W.c2)?'c2':''].filter(Boolean).join(',');
        // (stage 4) the tie's and shirt's tiles
        const it=__its[i],cl=__jobs[i].cloth,ts=it.tie?usableSett(it.tie):null,ss=usableSett(it.sh),how=it.tie?asmCmRoute(it.tie,'tie').how:'',TI=cl.tie&&cl.tie.tie,SH=cl.shirt.tile;
        // (stage 5) the master and what it has
        const cm=__jobs[i].cm,P=(await asmCmSetup(__jobs[i])).P;
        const has2=[has,TI?(how==='tie'?(ts.bands?'tie-bands':ts.motif?'tie-motif':'tie-tex-'+ts.tex.kind):'tie-'+how):'',TI&&TI.across===ASM_TIE_TEX_MAX?'texmax':'',__jobs[i].bar?'clip':'',
          SH?'shirt-tile':'',SH&&SH.fine?'fine':'',SH&&asmHbShirt(it.sh)?'hbs':'',SH&&ss&&ss.motif?'shirt-motif':'',
          cm!=='suit'?'m-'+cm:'',P.A.waistcoat&&P.A.waistcoat.some(v=>v>127)?'wc':'',P.geo&&P.geo.gar==='shirt'?'gs':'',P.legs?'legs':'',P.A.belt?'belt':'',P.A.buckle?'buckle':'',
          cl.trousers&&cl.trousers.tile?'tr-tile':'',it.bot&&it.bot.type==='suit'?'suitbot':''].filter(Boolean).join(',');
        const B=asmGlBytes(asmGlState);
        return {cpu:c.r.gl,gl:g.r.gl,why,max:mx,mean:sum/(3*N),over,cms:c.r.ms,gms:g.r.ms,has:has2,tkb:B&&B.tiles?Math.round(B.tiles/1024):0,mb:B?(B.all/1048576).toFixed(1):'?',cm}},i);
      if(L.has)ok(r.has===L.has,`${L.name}: the cloth is what the row means (${r.has}, wanted ${L.has})`);
      if(L.gl){ok(r.cpu===false&&r.gl===true,`${L.name}: the graphics chip paints it (switch on), the CPU with the switch off (${r.why||'covered'})`);
        ok(r.max<=2&&r.mean<.1,`${L.name}: GL and CPU agree (largest difference ${r.max}, mean ${r.mean.toFixed(4)}, pixels over 2: ${r.over}; CPU ${r.cms} ms, GL ${r.gms} ms at ${SIZE}; tiles ${r.tkb} KB; textures ${r.mb} MB, ${r.cm})`)}
      else ok(r.gl===false&&L.why.test(r.why)&&r.max===0,`${L.name}: not covered (${r.why}): painted on the CPU either way, the same picture`)}
    // fallbacks: no WebGL2 at all, then a lost context, then the retry
    const fb=await p.evaluate(async()=>{const i=0,out={};
      const oc=OffscreenCanvas.prototype.getContext,hc=HTMLCanvasElement.prototype.getContext;
      OffscreenCanvas.prototype.getContext=function(t,...a){return t==='webgl2'?null:oc.call(this,t,...a)};HTMLCanvasElement.prototype.getContext=function(t,...a){return t==='webgl2'?null:hc.call(this,t,...a)};
      asmGlReset();out.none=(await __paint(i,true)).r.gl;out.probe=asmGlProbe();out.onPage=asmGlOnPage(__jobs[i],{ok:true,gl:false});
      OffscreenCanvas.prototype.getContext=oc;HTMLCanvasElement.prototype.getContext=hc;asmGlReset();
      out.back=(await __paint(i,true)).r.gl;
      asmGlState.gl.getExtension('WEBGL_lose_context').loseContext();await new Promise(r=>setTimeout(r,50));
      const lost=await __paint(i,true);out.lost=lost.r.gl;out.lostPx=!!lost.px&&lost.px.some(v=>v>0);out.waiting=asmGlRetry>Date.now();
      asmGlRetry=0;out.again=(await __paint(i,true)).r.gl;return out});
    ok(fb.none===false&&fb.probe===false&&fb.onPage===false,`no WebGL2: painted on the CPU, and the page doesn't take the look either (${JSON.stringify(fb)})`);
    ok(fb.back===true,'WebGL2 back: the graphics chip paints again');
    ok(fb.lost===false&&fb.lostPx&&fb.waiting,'a lost context: that look is painted on the CPU (a whole picture), and the graphics chip waits ASM_GL_RETRY_MS');
    ok(fb.again===true,'after the wait a new context paints on the graphics chip again');
    // the routing: the job carries this phone's switch; the page paints a covered look only when the worker has no WebGL2; the real worker
    const rt=await p.evaluate(async()=>{const it=items,o={top:it[1],shirt:it[2],tie:it[3],watch:it[0]},out={};
      out.on=(await asmCmJob(o)).gl;localStorage.setItem('asm_gl','0');out.off=(await asmCmJob(o)).gl;localStorage.removeItem('asm_gl');
      const cov=__jobs[0],unc=__jobs[__jobs.length-1];
      out.page=[asmGlOnPage(cov,{ok:true,gl:false}),asmGlOnPage(cov,{ok:true,gl:true}),asmGlOnPage(unc,{ok:true,gl:false}),asmGlOnPage({...cov,gl:false},{ok:true,gl:false})];
      const w=new Worker('asm-worker.js');const next=()=>new Promise(r=>{w.onmessage=e=>r(e.data)});
      const ready=await next();const {geoU,geoV,...job}=cov;w.postMessage({id:1,job:{...job,gl:true}});const res=await next();w.terminate();
      out.ready=ready;out.res={gl:res.res&&res.res.gl,url:!!(res.res&&res.res.url&&res.res.url.startsWith('data:image/jpeg')),err:res.error||null,ms:res.res&&res.res.ms};return out});
    ok(rt.on===true&&rt.off===false,'the job carries the switch (localStorage asm_gl \'0\' = off on this phone)');
    ok(rt.page.join()==='true,false,false,false',`the page paints a look itself only when it is covered, the switch is on and the worker has no WebGL2 (${rt.page})`);
    ok(rt.ready.ready===true&&rt.ready.gl===true&&rt.res.gl===true&&rt.res.url,`the app's worker says it has WebGL2 and paints a covered look on the graphics chip (${JSON.stringify(rt.res)})`);
    // Settings: the owner's switch
    const ui=await p.evaluate(()=>{const b=document.createElement('div');document.body.appendChild(b);asmGlNote({gl:true,ms:91});asmGlUI(b);const s=document.getElementById('cfg-gl'),out={v:s.value,txt:document.getElementById('gl-status').textContent};
      s.value='off';s.dispatchEvent(new Event('change'));out.ls=localStorage.getItem('asm_gl');out.txt2=document.getElementById('gl-status').textContent;asmGlSet('on');out.ls2=localStorage.getItem('asm_gl');b.remove();return out});
    ok(ui.v==='on'&&/graphics chip, 91 ms/.test(ui.txt)&&ui.ls==='0'&&/Off on this phone/.test(ui.txt2)&&ui.ls2===null,`Settings → Outfit pictures → Advanced: "Graphics-chip painting" on by default, off kept in localStorage, the last picture's way shown (${ui.txt.slice(-60)})`);
    ok(!errs.length,'no page errors: '+errs.join('; '));
  }finally{await browser.close()}
};
module.exports.assembled=true;   // it runs the colour-coded painter (assemble.js, asm-color.js, asm-gl.js)
