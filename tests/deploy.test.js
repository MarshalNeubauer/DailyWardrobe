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
};
