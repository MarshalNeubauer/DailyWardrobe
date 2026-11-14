// ESLint (`npm run lint`, and on the changed files before every push: tests/lint.js, .githooks/pre-push).
// Only three rules, all about mistakes that run fine until the line is reached: a name that doesn't exist (a typo, a
// function that was renamed), a variable that is never used, and a name declared twice. No style rules.
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
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const espree = createRequire(import.meta.url)('espree');

/* the scopes: the page (index.html's script tags, in order) and each Web Worker (itself and what it importScripts) */
const page = [...fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').matchAll(/<script\s+src="([^"]+\.js)"/g)].map(m => m[1]);
const workers = ['asm-worker.js', 'analysis-worker.js'].filter(f => fs.existsSync(path.join(ROOT, f))).map(f => {
  const m = /importScripts\(([^)]*)\)/.exec(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  return [...(m ? [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]) : []), f];
});
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
const names = new Map(classic.map(f => [f, topNames(f) || new Set()]));
/* names a script puts on the page from inside a function (`window.outfitFigureSvg = …` in figure.js), and those the tests'
   page scripts add (tests/fixedplan.js: TEST_PLAN; helpers a test defines in one page.evaluate() and uses in the next) */
const onWindow = files => new Set(files.flatMap(f => [...fs.readFileSync(path.join(ROOT, f), 'utf8').matchAll(/\b(?:window|self|globalThis)\.([A-Za-z_$][\w$]*)\s*=(?!=)/g)].map(m => m[1])));
const tests = fs.readdirSync(path.join(ROOT, 'tests')).filter(f => f.endsWith('.js')).map(f => 'tests/' + f);
const tools = fs.readdirSync(path.join(ROOT, 'tools')).filter(f => f.endsWith('.js')).map(f => 'tools/' + f);
const pageExtra = onWindow([...classic, 'tests/fixedplan.js']);
// (tools/atlas-measure.js is put into the page by tools/asm-atlas.js: its functions are page names too)
const testExtra = new Set([...onWindow([...tests, ...tools]), ...(topNames('tools/atlas-measure.js') || [])]);
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
const loose = {...rules, 'no-unused-vars': ['warn', {...unused, vars: 'all'}], 'no-redeclare': ['error', {builtinGlobals: false}]};

export default [
  {ignores: ['node_modules/**', 'atlas/**', 'tests/fixtures/**', '.claude/**', '.wrangler/**', '**/*.mjs']},
  {linterOptions: {reportUnusedDisableDirectives: 'off'}},
  // each classic script: the platform, and the top-level names of the other scripts it shares a scope with
  ...classic.map(f => {
    const others = new Set();
    for (const s of scopes) if (s.includes(f)) for (const g of s) if (g !== f) for (const n of names.get(g)) if (!names.get(f).has(n)) others.add(n);
    for (const n of pageExtra) if (!names.get(f).has(n)) others.add(n);
    return {files: [f], languageOptions: {ecmaVersion: 'latest', sourceType: 'script', globals: {...platform, ...writable(others)}}, rules};
  }),
  {files: ['sw.js'], languageOptions: {ecmaVersion: 'latest', sourceType: 'script', globals: globals.serviceworker}, rules: loose},
  {files: ['worker.js', 'worker/**/*.js'], languageOptions: {ecmaVersion: 'latest', sourceType: 'module', globals: {...globals.serviceworker, ...globals.es2024}}, rules: loose},
  // Node scripts. Tests and tools also hand functions to page.evaluate(), which run in the app's page: its names are known there
  {files: ['tools/**/*.js', 'tests/**/*.js'], languageOptions: {ecmaVersion: 'latest', sourceType: 'commonjs', globals: {...globals.node, ...globals.browser, ...writable(appNames), ...writable(pageExtra), ...writable(testExtra)}},
    rules: {...loose, 'no-unused-vars': ['warn', {...unused, vars: 'local'}]}},
];
