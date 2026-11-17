/* How fast this machine is right now, for the tests' speed budgets (CR-10-03, 2026-11-17). A budget in milliseconds set on the owner's
   PC (32 threads, quiet) failed on GitHub's 4-core runner: the mannequin drew in 217 ms against 150, the color picker's redraw had a
   90th percentile of 19.7 ms against 12. `pace(page)` times a fixed piece of work in the page (numbers and a canvas, median of 7) and
   gives how many times slower than on the owner's PC it ran (1 at the least), so a budget is `budget * pace`: as strict there, wider
   only where the machine really is slower. Measure it in the same page right before what it scales, before any CPU throttling.
   `holds(page, fn, arg, ms)`: true once fn(arg) is true in the page within ms (a layout that settles after a timer), else false; for a
   check that reads a state, instead of reading it after a fixed pause. */
const PACE_REF=38;   // the work's median on the owner's PC (ms), quiet, Chromium, 2026-11-17: 37-44 (with 24 busy processes on its 32 threads: 70)
// (script, canvas drawing, and an SVG decoded as a picture and drawn large, as the budgets' own work is)
const WORK=async()=>{const t0=performance.now();let x=0;const a=new Float64Array(4096);for(let k=0;k<60;k++)for(let i=0;i<4096;i++){a[i]=Math.sin(i*.37+k)*Math.cos(x);x+=a[i]*1e-3}
  const c=document.createElement('canvas');c.width=c.height=1170;const g=c.getContext('2d');for(let i=0;i<400;i++){g.fillStyle=`hsl(${i%360},60%,50%)`;g.beginPath();g.arc((i*37)%1170,(i*91)%1170,40,0,6.28);g.fill()}
  let s='';for(let i=0;i<300;i++)s+=`<path d="M${(i*13)%390} ${(i*29)%390}c40 -30 80 30 120 0s40 60 0 90z" fill="url(#g${i%4})" opacity=".8"/>`;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1170" height="1170" viewBox="0 0 390 390"><defs>${[0,1,2,3].map(k=>`<linearGradient id="g${k}"><stop offset="0" stop-color="#${k}48"/><stop offset="1" stop-color="#c${k}4"/></linearGradient>`).join('')}</defs>${s}</svg>`;
  const im=new Image();im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);await im.decode();g.drawImage(im,0,0);g.getImageData(0,0,1,1);
  return performance.now()-t0+(x>1e9?1:0)};
async function paceMs(page){const r=[];for(let i=0;i<7;i++)r.push(await page.evaluate(WORK));r.sort((a,b)=>a-b);return r[3]}
async function pace(page){return Math.max(1,await paceMs(page)/PACE_REF)}
const holds=(page,fn,arg,ms=4000)=>page.waitForFunction(fn,arg,{timeout:ms,polling:50}).then(()=>true,()=>false);
module.exports={pace,paceMs,holds,PACE_REF};
