// What no test runs (`npm run gaps`): from the committed tests/impact.map (what each test used when it last ran), every
// top-level function of the app's scripts and every rule of styles.css that no test ever ran or applied. Nothing is run.
//   node tests/gaps.js           a summary per file and the names
//   node tests/gaps.js --json    the same as JSON
// Caveats: a test that reads a script whole as text (a check over its source) doesn't run it, so its functions still show here;
// sw.js runs in the browser's service worker, out of the recorder's sight, so all of it shows.
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process'),impact=require('./impact');
const ROOT=path.resolve(__dirname,'..');
(async()=>{
  let text;try{text=execFileSync('git',['show','HEAD:'+impact.MAP],{cwd:ROOT,maxBuffer:1<<28,stdio:['ignore','pipe','ignore']}).toString()}catch(e){text=fs.readFileSync(path.join(ROOT,impact.MAP),'utf8')}
  // the map as tests/impact.js reads it (the lines shared by every page test folded back into each test)
  const tmp=fs.mkdtempSync(path.join(require('os').tmpdir(),'dw-gaps-'));fs.mkdirSync(path.join(tmp,'tests'));fs.writeFileSync(path.join(tmp,impact.MAP),text);
  const map=impact.load(tmp);fs.rmSync(tmp,{recursive:true,force:true});
  if(!map){console.log('No '+impact.MAP+' to read.');process.exit(1)}
  const usedIn=f=>{const S=new Set();for(const e of map.values())if(e.has(f))for(const k of e.get(f))S.add(k);return S};
  const out={tests:map.size,scripts:[],css:null};
  for(const f of fs.readdirSync(ROOT).filter(f=>/\.js$/.test(f)).sort()){const src=fs.readFileSync(path.join(ROOT,f),'utf8'),u=await impact.scan(src);
    if(!u){out.scripts.push({file:f,unparsable:true});continue}
    const used=usedIn(f),names=impact.flat(u).map(x=>x.n),never=names.filter(n=>!used.has(n));
    out.scripts.push({file:f,units:names.length,never,readAsText:used.has(impact.ANY)})}
  const sheet=impact.cssScan(fs.readFileSync(path.join(ROOT,'styles.css'),'utf8'));
  if(sheet){const keys=[...new Set(sheet.rules.filter(r=>r.key).map(r=>r.key))],used=usedIn('styles.css');out.css={rules:keys.length,never:keys.filter(k=>!used.has(k))}}
  if(process.argv.includes('--json')){console.log(JSON.stringify(out,null,1));process.exit(0)}
  console.log(`What no test runs, from ${impact.MAP} (${out.tests} tests). A name starting with @ is an unnamed function, named after the code before it; a>b is function b inside block a.\n`);
  for(const s of out.scripts){if(s.unparsable){console.log(s.file+': could not be read');continue}
    if(!s.never.length)continue;
    console.log(`${s.file}: ${s.never.length} of ${s.units} never run`+(s.file==='sw.js'?' (the service worker: tests check it from outside)':''));
    console.log('  '+s.never.join('\n  '))}
  if(out.css){console.log(`\nstyles.css: ${out.css.never.length} of ${out.css.rules} rules never applied in a test`);if(out.css.never.length)console.log('  '+out.css.never.join('\n  '))}
  const total=out.scripts.reduce((a,s)=>a+(s.never?s.never.length:0),0);
  console.log(`\n${total} functions and ${out.css?out.css.never.length:0} CSS rules no test reaches.`);
  process.exit(0);
})();
