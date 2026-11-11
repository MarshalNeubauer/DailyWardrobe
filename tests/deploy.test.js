// Automatic worker deploys: wrangler.toml must deploy worker.js under the existing name with every binding the
// worker reads, keep dashboard variables, and the workflow must run on worker changes and test before deploying.
const fs=require('fs'),path=require('path');
module.exports=async({ok,ROOT})=>{
  const toml=fs.readFileSync(path.join(ROOT,'wrangler.toml'),'utf8'),wf=fs.readFileSync(path.join(ROOT,'.github/workflows/deploy-worker.yml'),'utf8'),src=fs.readFileSync(path.join(ROOT,'worker.js'),'utf8');
  ok(/^name = "wardrobevision"$/m.test(toml)&&/^main = "worker.js"$/m.test(toml),'wrangler.toml deploys worker.js as wardrobevision');
  ok(/^preview_urls = false$/m.test(toml),'per-version preview links are off');
  ok(/^keep_vars = true$/m.test(toml),'dashboard variables (ALLOWED_ORIGIN, model choices) are kept on deploy');
  ok(/\[ai\][\s\S]*?binding = "AI"/.test(toml)&&/\[\[kv_namespaces\]\][\s\S]*?binding = "WARDROBE"/.test(toml),'the AI and WARDROBE bindings the worker uses are declared');
  ok(/env\.WARDROBE/.test(src)&&/env\.AI\b/.test(src),'(the worker does read env.WARDROBE and env.AI)');
  ok(!/[0-9a-f]{32}/.test(toml),'no account or namespace IDs are committed (they come from GitHub variables)');
  ok(/paths:[^\n]*worker\.js/.test(wf)&&/branches: \[main\]/.test(wf),'the deploy workflow runs when worker.js changes on main');
  ok(wf.indexOf('npm test')>0&&wf.indexOf('npm test')<wf.indexOf('wrangler@'),'tests run before the deploy');
  {const sub=wf.indexOf('s/WARDROBE_KV_ID/');ok(sub>wf.lastIndexOf('npm test')&&sub<wf.indexOf('wrangler@'),'the real KV ID is filled in after the tests, just before the deploy');}
  ok(/secrets\.CLOUDFLARE_API_TOKEN/.test(wf)&&!/CLOUDFLARE_API_TOKEN:\s*["']?[A-Za-z0-9_-]{30,}/.test(wf),'the Cloudflare token comes from a GitHub secret');
  ok(/wrangler@\d+\.\d+\.\d+/.test(wf),'wrangler is pinned to an exact version');
  // the browser: only for tests that will really run, and never a step that fails the deploy when apt cannot reach its mirrors
  const step=name=>{const i=wf.indexOf('- name: '+name);return i<0?'':wf.slice(i,(wf.indexOf('\n      - ',i+1)+1||wf.length+1)-1)};
  const sel=step('Which tests will run'),inst=step('Install Chromium');
  ok(/node tests\/run\.js --changed --list/.test(sel)&&/browser=no/.test(sel)&&/browser=yes/.test(sel)&&wf.indexOf(sel)<wf.indexOf('- run: npm test'),'the workflow asks which tests will run before running them');
  {const imp=fs.readFileSync(path.join(ROOT,'tests/impact.js'),'utf8'),said=(sel.match(/grep -Eq '([^']+)'/)||[])[1]||'';
    const parts=said.split('|').map(t=>t.replace(/\\\./g,'.'));
    ok(parts.length===2&&parts.every(t=>t.length>10&&imp.includes("'"+t+"'")),'the sentences it takes for "nothing runs" are the ones tests/impact.js prints');}
  ok(/if: steps\.sel\.outputs\.browser == 'yes'/.test(inst)&&inst.split('playwright install').length===3&&wf.split('playwright install').length===3,'Chromium is installed only when tests will run');
  ok(!/--with-deps/.test(wf)&&/timeout [^\n]*playwright install-deps chromium \|\| echo/.test(inst),'system packages (apt) are tried for a limited time and never fail the deploy');
  ok(/for i in 1 2 3; do npx playwright install chromium && exit 0;/.test(inst)&&/\n\s+exit 1\s*$/.test(inst),'the browser download is tried three times');
  ok(/^    timeout-minutes: \d+$/m.test(wf),'the job has a time limit');
  // npm install must leave the checkout as it was: a package-lock.json written on the runner counts as a change, and then every test runs
  ok(/- run: npm install --no-package-lock\n/.test(wf)&&!/npm (?:install|i|ci)(?! --no-package-lock)\b/.test(wf)&&!fs.existsSync(path.join(ROOT,'package-lock.json')),'npm install writes no package-lock.json (the selection would take it for a change)');
};
