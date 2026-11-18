// The test servers never sit on a port the browsers refuse (tests/safeport.js; 2026-11-18: a run whose server landed on 1719 or 6665
// failed every page load of ~70 checks with net::ERR_UNSAFE_PORT). The list is checked against the real ones: Node's fetch (the Fetch
// standard's bad ports) over every port up to 10,100 (the list's highest is 10080) and Chromium, which refuses each listed port.
const fs=require('fs'),path=require('path'),http=require('http');
const {UNSAFE_PORTS,unsafePort,listenSafe}=require('./safeport');
module.exports=async({ok,chromium,url,ROOT})=>{
  // Node's fetch: "bad port" is said before any connection is tried
  const bad=[];for(let p=1;p<=10100;p+=1000){const b=[];for(let q=p;q<Math.min(p+1000,10101);q++)b.push(fetch('http://127.0.0.1:'+q+'/',{signal:AbortSignal.timeout(3000)}).then(()=>0,e=>{if(/bad port/.test((e.cause&&e.cause.message)||e.message))bad.push(q)}));await Promise.all(b)}
  bad.sort((a,b)=>a-b);const mine=[...UNSAFE_PORTS].sort((a,b)=>a-b);
  ok(bad.join()===mine.join(),`the list is exactly the ports Node's fetch refuses as bad (${mine.length} listed, ${bad.length} refused${bad.join()===mine.join()?'':': '+bad.filter(p=>!UNSAFE_PORTS.has(p)).join()+' missing, '+mine.filter(p=>!bad.includes(p)).join()+' extra'})`);
  // Chromium refuses each listed port before connecting, and loads the app from the port the runner chose
  const browser=await chromium.launch();
  try{const pg=await browser.newPage(),refused=[];
    for(const p of mine){const e=await pg.goto(`http://127.0.0.1:${p}/`).then(()=>'',e=>e.message);if(/ERR_UNSAFE_PORT/.test(e))refused.push(p)}
    // (Chromium's kRestrictedPorts is the Fetch list less 4190 and 6679, which only the standard, WebKit and Node added: the union is avoided)
    const let_=mine.filter(p=>!refused.includes(p));
    ok(let_.every(p=>p===4190||p===6679)&&refused.length>=80,`Chromium refuses every listed port with ERR_UNSAFE_PORT but 4190 and 6679 (${refused.length} of ${mine.length}; let through: ${let_.join()||'none'})`);
    const port=+new URL(url).port;
    ok(!unsafePort(port)&&(await pg.goto(url)).ok(),`the runner's server is on a safe port (${port}) and the app loads from it`);
  }finally{await browser.close()}
  // listenSafe: a port on the list is given back and another asked for (a stand-in server that is handed 6665, then 1719, then 40123)
  const handed=[6665,1719,40123];let closes=0,asked=0;
  const fake={_p:0,once(){},removeListener(){},listen(p,...a){asked++;this._p=handed.shift();a[a.length-1]()},address(){return {port:this._p}},close(cb){closes++;cb()}};
  const got=await listenSafe(fake,'127.0.0.1');
  ok(got===40123&&asked===3&&closes===2,`listenSafe skips unsafe ports: handed 6665 and 1719 it closed both and asked again (got ${got}, ${asked} asks, ${closes} closes)`);
  const real=http.createServer((q,r)=>r.end('hi'));const rp=await listenSafe(real,'127.0.0.1');
  ok(!unsafePort(rp)&&await fetch(`http://127.0.0.1:${rp}/`).then(r=>r.text())==='hi','a real server started by listenSafe answers');await new Promise(r=>real.close(r));
  // every place the tests start a local server: none asks the system for a port directly, and no fixed port is on the list
  const files=[],walk=d=>{for(const f of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory()){if(!/^(node_modules|fixtures|out|scratch)$/.test(f.name))walk(p)}else if(f.name.endsWith('.js'))files.push(p)}};
  walk(path.join(ROOT,'tests'));walk(path.join(ROOT,'tools'));
  const raw=[],fixed=[];
  for(const f of files){if(path.basename(f)==='safeport.js')continue;const s=fs.readFileSync(f,'utf8'),rel=path.relative(ROOT,f).split(path.sep).join('/');
    if(/\.listen\(\s*0\s*[,)]/.test(s))raw.push(rel);
    for(const m of s.matchAll(/\b[A-Z]*PORT\s*=\s*\+?\(?(?:[^;,]*?\|\|\s*)?(\d{2,5})\b/g)){const n=+m[1];for(const p of [n,n+1])if(unsafePort(p))fixed.push(rel+': '+p)}
    for(const m of s.matchAll(/\.listen\(\s*(\d{2,5})\b/g))if(unsafePort(+m[1]))fixed.push(rel+': '+m[1])}
  ok(!raw.length,`no test or tool starts a server with listen(0) directly: each goes through listenSafe (${raw.join(', ')||'none'})`);
  ok(!fixed.length,`no fixed test port (or the worker's port beside it) is one the browsers refuse (${fixed.join(', ')||'none'})`);
};
