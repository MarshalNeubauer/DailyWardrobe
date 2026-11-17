/* Running the suite on WebKit (`TEST_BROWSER=webkit`, `npm run test:webkit`): the engine of Safari, the closest the
   Linux container gets to the owner's iPhone. Two things the tests lean on exist only in Chromium, so this file stands in:
   - CORS on mocked replies: Chromium's Playwright answers a mocked cross-origin request without checking CORS, WebKit's
     checks it as a real request would be. Every `route.fulfill` gets open CORS headers and preflights are answered.
   - touch input: tests send touches through `ctx.newCDPSession(p)` → `Input.dispatchTouchEvent`. Here that is a stand-in
     whose touches are touch events fired at the element under the finger (a tap, under 10px of movement, is also a click).
     Unlike Chromium's they do not scroll the page natively, so checks that a swipe scrolls something fail here.
   - service workers are blocked (`serviceWorkers:'block'`; `WK_SW=1` leaves them on): once one controls the page,
     Playwright's WebKit stops routing the page's POST/PUT requests to the mocks ("Load failed"). Real Safari is not
     affected (sw.js lets every non-GET request through). So tests/sw.test.js fails here; it is Chromium's to check.
   - requests made inside a Web Worker (asm-worker.js) are not routed either: a fake host there fails CORS.
   `WK_DEBUG=1` prints every mocked request. */
/* The recorder of tests/impact.map is Chromium only (CDP coverage), so run.js turns it off on WebKit and writes no map.
   The browser: `node /opt/node-tools/node_modules/playwright/cli.js install webkit` and `… install-deps webkit` (apt),
   with the same Playwright as the Chromium runs. */
const CORS={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PUT,DELETE,PATCH,OPTIONS','access-control-expose-headers':'*'};
const wrapRoute=fn=>async(route,req)=>{if(process.env.WK_DEBUG)console.log('  [route]',route.request().method(),route.request().url().slice(0,70),'post',route.request().postData()==null?'null':route.request().postData().length);
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:CORS});
  const r=new Proxy(route,{get:(t,k)=>k==='fulfill'?async(o={})=>{
      let headers={...(o.headers||{})};
      if(o.response&&!o.headers)headers={...o.response.headers()};
      for(const h of Object.keys(headers))if(/^access-control-/i.test(h))delete headers[h];
      return t.fulfill({...o,headers:{...headers,...CORS}})}
    :typeof t[k]==='function'?t[k].bind(t):t[k]});
  return fn(r,req)};
// a stand-in for a CDP session that only knows Input.dispatchTouchEvent
const touchSession=page=>{let start=null,last=null;
  const fire=(type,x,y)=>page.evaluate(([type,x,y,sx,sy])=>{
      const st=window.__wkTouch||(window.__wkTouch={});
      if(type==='touchstart')st.el=document.elementFromPoint(x,y)||document.body;
      // the target stays the element the touch began on, removed or not, as on a real phone
      const el=st.el||document.body;
      // WebKit's Linux build has no Touch constructor: a plain event carries the touch lists
      const t={identifier:1,target:el,clientX:x,clientY:y,pageX:x+scrollX,pageY:y+scrollY,screenX:x,screenY:y,radiusX:1,radiusY:1,force:1};
      const live=type==='touchend'||type==='touchcancel'?[]:[t],list=a=>Object.assign([...a],{item:i=>a[i]||null});
      const ev=new Event(type,{bubbles:true,cancelable:true,composed:true});
      for(const [k,v] of [['touches',live],['targetTouches',live],['changedTouches',[t]]])Object.defineProperty(ev,k,{value:list(v)});
      el.dispatchEvent(ev);
      if(type==='touchend'&&Math.hypot(x-sx,y-sy)<10){const c=document.elementFromPoint(x,y);if(c){if(typeof c.click==='function')c.click();else c.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,clientX:x,clientY:y}))}}   // (an SVG element has no click())
    },[type,x,y,start?start.x:x,start?start.y:y]);
  return {async send(method,p={}){
      if(method!=='Input.dispatchTouchEvent')throw new Error('CDP '+method+' is Chromium only (WebKit run)');
      const pt=p.touchPoints&&p.touchPoints[0];
      if(p.type==='touchStart'){start=last={x:pt.x,y:pt.y};return fire('touchstart',pt.x,pt.y)}
      if(p.type==='touchMove'){last={x:pt.x,y:pt.y};return fire('touchmove',pt.x,pt.y)}
      if(p.type==='touchEnd'||p.type==='touchCancel'){const l=last||{x:0,y:0};await fire(p.type==='touchEnd'?'touchend':'touchcancel',l.x,l.y);start=last=null}},
    async detach(){},on(){},off(){}}};
/* about.js reads the version from the page's own sw.js (at start-up, and `?check=<time>` when Settings opens); a reload or a page
   load cutting that fetch off is reported by Playwright's WebKit, in a context with routes, as a page error
   "/127.0.0.1:<port>/sw.js[?check=<n>] due to access control checks." (about.js catches the failed fetch; Chromium reports
   nothing). Exactly that error, on the test server's own sw.js, is left out of the page's
   'pageerror' and console-error listeners; every other error, and any other access-control error, still reaches the test */
const SW_CUT=/^\/127\.0\.0\.1:\d+\/sw\.js(?:\?check=\d+)? due to access control checks\.$/;   // (WebKit's whole message, as it comes)
const swCut=(ev,a)=>{try{return ev==='pageerror'?SW_CUT.test(a&&a.message):ev==='console'&&a.type()==='error'&&SW_CUT.test(a.text())}catch(e){return false}};
const quietSwCut=page=>{const wrapped=new WeakMap();
  const pass=(ev,fn)=>{if((ev!=='pageerror'&&ev!=='console')||typeof fn!=='function')return fn;if(!wrapped.has(fn))wrapped.set(fn,function(a){if(!swCut(ev,a))return fn.apply(this,arguments)});return wrapped.get(fn)};
  for(const k of ['on','addListener','once','prependListener']){const o=page[k].bind(page);page[k]=(ev,fn)=>o(ev,pass(ev,fn))}
  for(const k of ['off','removeListener']){const o=page[k].bind(page);page[k]=(ev,fn)=>o(ev,wrapped.get(fn)||fn)}};
const wrapPage=page=>{if(page.__wk)return page;const route=page.route.bind(page);page.route=(u,fn,o)=>route(u,wrapRoute(fn),o);quietSwCut(page);page.__wk=true;return page};
const wrapContext=ctx=>{if(ctx.__wk)return ctx;
  const route=ctx.route.bind(ctx),newPage=ctx.newPage.bind(ctx);
  ctx.route=(u,fn,o)=>route(u,wrapRoute(fn),o);
  ctx.newPage=async()=>wrapPage(await newPage());
  ctx.on('page',wrapPage);
  ctx.newCDPSession=async page=>touchSession(page);
  ctx.__wk=true;return ctx};
const wrapBrowser=b=>{const newContext=b.newContext.bind(b);
  b.newContext=async o=>wrapContext(await newContext(process.env.WK_SW?o:{serviceWorkers:'block',...(o||{})}));
  b.newPage=async o=>{const c=await b.newContext(o);return c.newPage()};
  return b};
/* the engines a test file that checks both runs on (CR-10-01/02, 2026-11-17): [[name, launch]], given to every test file by run.js as
   `engines`. Each launch gives run.js's view of one shared browser per process, with the fixed plan, the painter off and the file's
   flags (realPlanner, assembled) on every context, as Chromium's has: launching WebKit from playwright directly skipped all three, so
   its half ran the real planner and painted at every load, and set the suite's pace. Under --webkit (TEST_BROWSER=webkit) the
   "Chromium" browser is WebKit already, so only one half runs, named WebKit. The nightly cloud run installs WebKit on
   the shards that run WebKit halves (.github/workflows/full-tests.yml); without it the WebKit half fails with "WebKit: the browser starts (…)" */
const engines=(chromium,webkit)=>process.env.TEST_BROWSER==='webkit'?[['WebKit',()=>chromium.launch()]]:[['Chromium',()=>chromium.launch()],['WebKit',()=>webkit.launch()]];
module.exports={wrapBrowser,wrapContext,engines};
