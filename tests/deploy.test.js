// Automatic worker deploys: wrangler.toml must deploy worker.js under the existing name with every binding the
// worker reads, keep dashboard variables, and the workflow must run on worker changes and test before deploying.
const fs=require('fs'),path=require('path');
module.exports=async({ok,ROOT})=>{
  const toml=fs.readFileSync(path.join(ROOT,'wrangler.toml'),'utf8'),wf=fs.readFileSync(path.join(ROOT,'.github/workflows/deploy-worker.yml'),'utf8'),src=require('./workersrc.js')();
  ok(/^name = "wardrobevision"$/m.test(toml)&&/^main = "worker.js"$/m.test(toml),'wrangler.toml deploys worker.js as wardrobevision');
  ok(/^preview_urls = false$/m.test(toml),'per-version preview links are off');
  ok(/^keep_vars = true$/m.test(toml),'dashboard variables (ALLOWED_ORIGIN, model choices) are kept on deploy');
  ok(/\[ai\][\s\S]*?binding = "AI"/.test(toml)&&/\[\[kv_namespaces\]\][\s\S]*?binding = "WARDROBE"/.test(toml),'the AI and WARDROBE bindings the worker uses are declared');
  ok(/env\.WARDROBE/.test(src)&&/env\.AI\b/.test(src),'(the worker does read env.WARDROBE and env.AI)');
  ok(!/[0-9a-f]{32}/.test(toml),'no account or namespace IDs are committed (they come from GitHub variables)');
  ok(/paths:[^\n]*worker\.js/.test(wf)&&/paths:[^\n]*'worker\/\*\*'/.test(wf)&&/branches: \[main\]/.test(wf),'the deploy workflow runs when worker.js or one of its modules (worker/) changes on main');
  {const up=[...new Set([...src.matchAll(/^import (?:[^'\n]* from )?'\.\.\/([^'\/]+\.js)';$/gm)].map(m=>m[1]))],paths=(/paths: \[([^\]]*)\]/.exec(wf)||[])[1]||'';   // (merge.js, shared with the app: Round B)
    ok(up.includes('merge.js')&&up.every(f=>paths.split(',').map(s=>s.trim()).includes(f)),'the deploy workflow also runs when an app file the worker imports changes ('+up.join(', ')+')');}
  {const ent=fs.readFileSync(path.join(ROOT,'worker.js'),'utf8'),mods=fs.readdirSync(path.join(ROOT,'worker')).filter(f=>/\.js$/.test(f));
    ok(/export \{ RenderHub \} from '\.\/worker\/render\.js'/.test(ent)&&/^export default \{/m.test(ent)&&mods.length>5&&mods.every(f=>new RegExp("from '\\./(?:worker/)?"+f.replace('.','\\.')+"'").test(src)),
      `worker.js is the entry: it exports the handlers and the Durable Object class, and every module in worker/ is imported (${mods.length} modules)`);}
  ok(wf.indexOf('npm test')>0&&wf.indexOf('npm test')<wf.indexOf('wrangler@'),'tests run before the deploy');
  {const sub=wf.indexOf('s/WARDROBE_KV_ID/');ok(sub>wf.lastIndexOf('npm test')&&sub<wf.indexOf('wrangler@'),'the real KV ID is filled in after the tests, just before the deploy');}
  ok(/secrets\.CLOUDFLARE_API_TOKEN/.test(wf)&&!/CLOUDFLARE_API_TOKEN:\s*["']?[A-Za-z0-9_-]{30,}/.test(wf),'the Cloudflare token comes from a GitHub secret');
  ok(/wrangler@\d+\.\d+\.\d+/.test(wf),'wrangler is pinned to an exact version');
  // the browser: only for tests that will really run, and never a step that fails the deploy when apt cannot reach its mirrors
  const step=name=>{const i=wf.indexOf('- name: '+name);return i<0?'':wf.slice(i,(wf.indexOf('\n      - ',i+1)+1||wf.length+1)-1)};
  const sel=step('Which tests will run'),inst=step('Install the browsers');
  ok(/node tests\/run\.js --changed --list/.test(sel)&&/browser=no/.test(sel)&&/browser=yes/.test(sel)&&wf.indexOf(sel)<wf.indexOf('- run: npm test'),'the workflow asks which tests will run before running them');
  {const imp=fs.readFileSync(path.join(ROOT,'tests/impact.js'),'utf8'),said=(sel.match(/grep -Eq '([^']+)'/)||[])[1]||'';
    const parts=said.split('|').map(t=>t.replace(/\\\./g,'.'));
    ok(parts.length===2&&parts.every(t=>t.length>10&&imp.includes("'"+t+"'")),'the sentences it takes for "nothing runs" are the ones tests/impact.js prints');}
  ok(/if: steps\.sel\.outputs\.browser == 'yes'/.test(inst)&&inst.split('playwright install').length===3&&wf.split('playwright install').length===3,'the browsers are installed only when tests will run');
  // the WebKit halves (#551) need WebKit: the deploy of #557 failed 11 checks with "Executable doesn't exist" (2026-11-17)
  {const run=fs.readFileSync(path.join(ROOT,'tests/run.js'),'utf8');
    ok(/grep -q '\^WebKit: '/.test(sel)&&/grep -Eq '\^WebKit: \.\*do not run'/.test(sel)&&/webkit=yes/.test(sel)&&/webkit=no/.test(sel)
      &&/console\.log\([^\n]*`WebKit: /.test(run)&&run.includes("+' do not run'")
      &&/steps\.sel\.outputs\.webkit \}\}" = yes \]; then B="chromium webkit"/.test(inst),'WebKit is installed too when the selection runs WebKit halves (run.js\'s "WebKit: …" line, "do not run" when none does)');}
  ok(!/--with-deps/.test(wf)&&/timeout -k 10 \$T npx playwright install-deps \$B \|\| echo/.test(inst),'system packages (apt) are tried for a limited time and never fail the step');
  ok(/for i in 1 2 3; do npx playwright install \$B && exit 0;/.test(inst)&&/\n\s+exit 1\s*$/.test(inst),'the browser download is tried three times');
  ok(/- uses: actions\/checkout@v\d+\n\s+with:\n\s+fetch-depth: 0\n/.test(wf),'the checkout has the whole history (tests read older commits with git show)');
  ok(/^    timeout-minutes: \d+$/m.test(wf),'the job has a time limit');
  // npm install must leave the checkout as it was: a package-lock.json written on the runner counts as a change, and then every test runs
  ok(/- run: npm install --no-package-lock\n/.test(wf)&&!/npm (?:install|i|ci)(?! --no-package-lock)\b/.test(wf)&&!fs.existsSync(path.join(ROOT,'package-lock.json')),'npm install writes no package-lock.json (the selection would take it for a change)');
};
