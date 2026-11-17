// Values inside inline handlers (fix round A, 2026-11-17, the code review's Critical C1 = CR-2-02 + CR-4-01 + CR-7-02): a quoted
// argument written into onclick="f('${x}')" runs as script when x carries a quote, and esc() doesn't help there (the browser decodes
// &#39; back before it compiles the handler). Values from outside (settings, a backup, a sync, a server or Claude answer) go into data-*
// attributes read by a listener, or through jsq(). This lint reads every app script and fails on a quoted ${…} inside an inline handler
// that isn't jsq(…) and isn't on the list below of the ones checked to hold only app-made values (fixed names, slot names, ids and keys
// that the records check or applyCustom already limits to letters, digits, - _ . :). A new one: use data-* or jsq, or check where the
// value comes from and add it here with the file.
const fs=require('fs'),path=require('path');
module.exports=async({ok,ROOT})=>{
  const CHECKED=new Set([
    // ids of the app's own shape (core.js ID_RE, cleanRecord) and keys from the app's own lists
    'account.js|acctEsc(v.id)','add-card.js|esc(q.id)','add-card.js|k','add-card.js|v','app.js|k','care.js|w','care.js|g.t','care.js|t','checklist.js|src',
    'colpick.js|src','colpick.js|k','colpick.js|v','colpick.js|c','colpick.js|p','colpick.js|t','colpick.js|esc(q.id)','colpick.js|h',
    "colpick.js|have?'existing':'new'",'dress.js|k','history.js|k','history.js|slot','history.js|f.slot','history.js|f.item.id','itemsheet.js|k',
    'itemsheet.js|t','pack.js|which','pack.js|first.k','photos.js|itemKey(i)','settings.js|r.date','settings.js|id','setup.js|k','setup.js|kind',
    'setup.js|x','shop.js|k','shop.js|esc(x.key)','today.js|s',"today.js|addForSlot(s,o.suitDay)||''",'ui.js|o.mode',"ui.js|o.cloth||''",'wardrobe.js|k',
    // the Add card's offers: Claude's answer, shown only when it is one of the app's own keys (TYPES, COLORS, colsFor, PATS_BY) or a field name
    'tagging.js|q.refineType','tagging.js|q.refineKept.c','tagging.js|q.altColor','tagging.js|q.altPattern','tagging.js|f','tagging.js|v.f','tagging.js|v.to','tagging.js|mp']);
  const found=[],files=fs.readdirSync(ROOT).filter(f=>f.endsWith('.js')).sort();
  for(const f of files){const s=fs.readFileSync(path.join(ROOT,f),'utf8');
    for(const m of s.matchAll(/\son[a-z]+="([^"]*)"/g))for(const q of m[1].matchAll(/'\$\{((?:[^{}]|\{[^{}]*\})*)\}/g))if(!/^jsq\(/.test(q[1]))found.push(f+'|'+q[1])}
  const fresh=[...new Set(found)].filter(x=>!CHECKED.has(x));
  ok(files.length>40&&found.length>40,`the lint reads the app's scripts (${files.length} files, ${found.length} quoted values in inline handlers)`);
  ok(!fresh.length,'no quoted value in an inline handler that isn\'t jsq() or checked to be app-made'+(fresh.length?': '+fresh.join(', '):''));
  // the three sinks of C1 hold no handler at all now: their values are in data-* attributes
  const src=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
  ok(/function renderCustomUI\(/.test(src('own-lists.js'))&&!/onclick="removeCustom/.test(src('own-lists.js')),'Settings\' own colors and patterns: Remove has no inline handler (CR-2-02)');
  ok(!/on(change|click)="(toggleHoliday|removeDaysOff)/.test(src('settings.js')),'Days off: a holiday\'s checkbox and a day off\'s × have no inline handler (CR-7-02)');
  ok(!/onclick="shopUnhide/.test(src('shop.js')),'What to buy: "Show again" has no inline handler (CR-4-01)');
  // the lint itself catches the old code
  const old=`<button type="button" onclick="removeCustom('colors','\${c.key}')">Remove</button> onclick="shopUnhide('\${esc(k)}')" onclick="x('\${jsq(k)}')"`;
  const hits=[...old.matchAll(/\son[a-z]+="([^"]*)"/g)].flatMap(m=>[...m[1].matchAll(/'\$\{((?:[^{}]|\{[^{}]*\})*)\}/g)].map(q=>q[1])).filter(x=>!/^jsq\(/.test(x));
  ok(hits.join()==='c.key,esc(k)','the lint flags the old Remove and Show again handlers, and passes jsq() ('+hits.join()+')');
};
