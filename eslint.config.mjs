// ESLint (`npm run lint`, and on the changed files before every push: tests/lint.js, .githooks/pre-push).
// Only three rules, all about mistakes that run fine until the line is reached: a name that doesn't exist (a typo, a
// function that was renamed), a variable that is never used, and a name declared twice. No style rules.
//
// A page script that is an ES module (`<script type="module" src=…>` in index.html; none yet) is linted as one: sourceType
// 'module' (so strict), its own top-level names kept to itself, and of the other scripts it knows what they share. What a module
// shares is its bridge (the names it puts on globalThis at its top level: tests/modscope.js), not its top-level names: a
// classic script, another module or a test's page.evaluate() that names something a module didn't bridge fails no-undef. In a
// module `typeof name` is checked too (a guard on a name that left the global scope is silently false), and so is `this`
// outside every function (undefined there).
//
// The app's scripts are classic scripts sharing one global scope (index.html loads them in order; asm-worker.js and
// analysis-worker.js load some of them with importScripts). So each script is told the top-level names of the other scripts
// it shares a scope with, read from their sources every time this file loads: nothing to keep up to date by hand. A name
// declared at the top of two scripts of one scope is reported (no-redeclare): `let`/`const` twice stops the page loading, and
// a second `function` silently replaces the first.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import globals from 'globals';
// (tests/modtools.test.js lints a made-up app with these same rules: it imports this file with ?root=<folder>)
const ROOT = new URL(import.meta.url).searchParams.get('root') || path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const espree = require('espree');
const {scriptTags} = require('./tests/scriptlist.js');
const modscope = require('./tests/modscope.js');

/* the scopes: the page (index.html's script tags, in order: tests/scriptlist.js) and each Web Worker (itself and what it importScripts) */
const tags = scriptTags(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'));
const page = tags.map(t => t.src), mods = new Set(tags.filter(t => t.module).map(t => t.src));
// (a module worker, `new Worker(url, {type: 'module'})`: its `import './x.js'` lines name its files, and it is linted as a module)
const wk = ['asm-worker.js', 'analysis-worker.js'].filter(f => fs.existsSync(path.join(ROOT, f))).map(f => [f, modscope.workerFiles(ROOT, f)]);
const workers = wk.map(([, w]) => w.files);
for (const [f, w] of wk) if (w.module) mods.add(f);
const scopes = [page, ...workers];
const classic = [...new Set(scopes.flat())];

/* a classic script's top-level names (null when it doesn't parse: ESLint itself then reports the syntax error) */
const topNames = f => {
  let ast;
  try { ast = espree.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'), {ecmaVersion: 'latest', sourceType: 'script'}); } catch (e) { return null; }
  const out = new Set(), pat = p => {
    if (!p) return;
    if (p.type === 'Identifier') out.add(p.name);
    else if (p.type === 'ObjectPattern') p.properties.forEach(q => pat(q.type === 'RestElement' ? q.argument : q.value));
    else if (p.type === 'ArrayPattern') p.elements.forEach(pat);
    else if (p.type === 'RestElement') pat(p.argument);
    else if (p.type === 'AssignmentPattern') pat(p.left);
  };
  for (const s of ast.body) {
    if (s.type === 'FunctionDeclaration' || s.type === 'ClassDeclaration') out.add(s.id.name);
    else if (s.type === 'VariableDeclaration') s.declarations.forEach(d => pat(d.id));
  }
  return out;
};
/* a module's own top-level names, its imports among them (empty when it doesn't parse) */
const modNames = f => { try { return new Set(modscope.declared(modscope.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'), true)).map(d => d.name)); } catch (e) { return new Set(); } };
/* own: what a file declares; names: what it gives the scripts it shares a scope with (a classic script everything, a module its bridge) */
const own = new Map(classic.map(f => [f, mods.has(f) ? modNames(f) : topNames(f) || new Set()]));
const names = new Map(classic.map(f => [f, mods.has(f) ? new Set(modscope.shared(ROOT, f, true)) : own.get(f)]));
/* names a script puts on the page from inside a function (`self.outfitMannequinSvg = …` in mannequin.js), and those the tests'
   page scripts add (tests/fixedplan.js: TEST_PLAN; helpers a test defines in one page.evaluate() and uses in the next) */
const onWindow = files => new Set(files.filter(f => fs.existsSync(path.join(ROOT, f))).flatMap(f => [...fs.readFileSync(path.join(ROOT, f), 'utf8').matchAll(/\b(?:window|self|globalThis)\.([A-Za-z_$][\w$]*)\s*=(?!=)/g)].map(m => m[1])));
// (tests/replay's scripts and helpers are in subfolders; .work holds old builds extracted from git: never read)
const dir = (d, o) => fs.existsSync(path.join(ROOT, d)) ? fs.readdirSync(path.join(ROOT, d), o) : [];
const tests = dir('tests', {recursive: true}).map(f => f.split(path.sep).join('/'))
  .filter(f => f.endsWith('.js') && !f.startsWith('fixtures/') && !f.startsWith('replay/.work/')).map(f => 'tests/' + f);
const tools = dir('tools').filter(f => f.endsWith('.js')).map(f => 'tools/' + f);
const pageExtra = onWindow([...classic, 'tests/fixedplan.js']);
const testExtra = onWindow([...tests, ...tools]);
const appNames = new Set([...names.values()].flatMap(s => [...s]));
const writable = list => Object.fromEntries([...list].map(n => [n, 'writable']));
/* the platform's names, less those the app declares itself (a top-level `function open` is the app's own open) */
const platform = {...globals.browser, ...globals.worker};
for (const n of appNames) delete platform[n];

// an unused variable is a warning: dead code, rarely a bug (tests/lint.js shows it only on lines the change touched)
const unused = {vars: 'local', args: 'none', caughtErrors: 'none', ignoreRestSiblings: true};
const rules = {
  'no-undef': 'error',
  'no-unused-vars': ['warn', unused],
  'no-redeclare': ['error', {builtinGlobals: true}],
};
/* a module: `typeof name` on a name nothing declares, and `this` outside every function */
const moduleRules = {...rules, 'no-undef': ['error', {typeof: true}],
  'no-restricted-syntax': ['error', {selector: 'ThisExpression:not(:function ThisExpression, PropertyDefinition ThisExpression, StaticBlock ThisExpression)', message: 'In a module, "this" outside a function is undefined: say globalThis.'}]};
const loose = {...rules, 'no-unused-vars': ['warn', {...unused, vars: 'all'}], 'no-redeclare': ['error', {builtinGlobals: false}]};

export default [
  {ignores: ['node_modules/**', 'atlas/**', 'tests/fixtures/**', 'tests/replay/.work/**', '.claude/**', '.wrangler/**', '**/*.mjs']},
  {linterOptions: {reportUnusedDisableDirectives: 'off'}},
  // each classic script: the platform, and the top-level names of the other scripts it shares a scope with (of a module, its bridge)
  // each module: the same, as sourceType 'module'
  ...classic.map(f => {
    const others = new Set();
    for (const s of scopes) if (s.includes(f)) for (const g of s) if (g !== f) for (const n of names.get(g)) if (!own.get(f).has(n)) others.add(n);
    for (const n of pageExtra) if (!own.get(f).has(n)) others.add(n);
    if (mods.has(f)) return {files: [f], languageOptions: {ecmaVersion: 'latest', sourceType: 'module', globals: {...platform, ...writable(others)}}, rules: moduleRules};
    return {files: [f], languageOptions: {ecmaVersion: 'latest', sourceType: 'script', globals: {...platform, ...writable(others)}}, rules};
  }),
  {files: ['sw.js'], languageOptions: {ecmaVersion: 'latest', sourceType: 'script', globals: globals.serviceworker}, rules: loose},
  {files: ['worker.js', 'worker/**/*.js'], languageOptions: {ecmaVersion: 'latest', sourceType: 'module', globals: {...globals.serviceworker, ...globals.es2024}}, rules: loose},
  // Node scripts. Tests and tools also hand functions to page.evaluate(), which run in the app's page: its names are known there
  {files: ['tools/**/*.js', 'tests/**/*.js'], languageOptions: {ecmaVersion: 'latest', sourceType: 'commonjs', globals: {...globals.node, ...globals.browser, ...writable(appNames), ...writable(pageExtra), ...writable(testExtra)}},
    rules: {...loose, 'no-unused-vars': ['warn', {...unused, vars: 'local'}]}},
];
