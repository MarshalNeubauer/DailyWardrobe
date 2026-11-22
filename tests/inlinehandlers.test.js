// Inline handlers (on…="…" in markup), two checks.
// 1. The count only goes down (Round C, wave C2, 2026-11-18): markup names its handler with data-act and act.js runs it, so nothing is
// compiled from markup and markup doesn't reach code by a global name. LEFT below is how many inline handlers each file still has
// (` on<type>="` in a root script or index.html, comments included); a file not listed has none. A file over its number fails: use
// data-act (act.js). A file under its number fails too, until the number is lowered (or the line taken out at 0), so a handler that
// went can't come back. When two branches lower the same file's number, the merge takes the lower one.
// 2. Values inside the ones left (fix round A, 2026-11-17, the code review's Critical C1 = CR-2-02 + CR-4-01 + CR-7-02): a quoted
// argument written into onclick="f('${x}')" runs as script when x carries a quote, and esc() doesn't help there (the browser decodes
// &#39; back before it compiles the handler). Values from outside (settings, a backup, a sync, a server or Claude answer) go into data-*
// attributes read by a listener, or through jsq(). This lint reads every app script and fails on a quoted ${…} inside an inline handler
// that isn't jsq(…) and isn't on the list below of the ones checked to hold only app-made values (fixed names, slot names, ids and keys
// that the records check or applyCustom already limits to letters, digits, - _ . :). No new one is added: a new control uses data-act.
const fs=require('fs'),path=require('path');
/* the inline handlers left, per file: may only go down (asm-color.js and asm-gl.js are in the painter's fingerprint: they wait for C3) */
const LEFT={
  'about.js':5,'account.js':7,'app.js':1,'asm-color.js':1,'asm-gl.js':1,
  'calendar.js':11,'care.js':13,'cost.js':10,'dress.js':1,'history.js':7,
  'missed.js':4,'month.js':3,'own-lists.js':3,'pack.js':14,'pattern-read.js':2,
  'photos.js':2,'remind.js':3,'safety.js':2,'scorecard.js':4,'shop.js':9,'start.js':1,'stats.js':5,'tagging.js':12,
  'today.js':20,'ui.js':10,'wardrobe.js':10};
const HANDLER=/\son[a-z]+="/g;
/* counts {file: n} against the table -> what is wrong, one line each (none: fine) */
const ratchet=(counts,left)=>{const bad=[];
  for(const f of [...new Set([...Object.keys(counts),...Object.keys(left)])].sort()){const n=counts[f]||0,max=left[f]||0;
    if(n>max)bad.push(`${f} has ${n} inline handler${n===1?'':'s'}, ${max} allowed: use data-act (act.js)`);
    else if(n<max)bad.push(`${f} is down to ${n} from ${max}: lower its number in LEFT`+(n?'':' (take the line out)'))}
  return bad};
module.exports=async({ok,ROOT})=>{
  const files=fs.readdirSync(ROOT).filter(f=>f.endsWith('.js')).sort(),pages=[...files,'index.html'];
  const counts={};for(const f of pages){const n=(fs.readFileSync(path.join(ROOT,f),'utf8').match(HANDLER)||[]).length;if(n)counts[f]=n}
  const total=Object.values(counts).reduce((a,b)=>a+b,0),bad=ratchet(counts,LEFT);
  ok(pages.length>40&&Object.values(LEFT).every(n=>Number.isInteger(n)&&n>0),`the count reads the app's scripts and index.html (${pages.length} files, ${total} inline handlers left in ${Object.keys(counts).length} files)`);
  ok(!bad.length,'no file has more inline handlers than its number, and every number is as low as its file'+(bad.length?': '+bad.join('; '):''));
  ok(!counts['settings.js']&&!counts['daysoff.js']&&!counts['weather.js']&&!counts['act.js'],'settings.js, daysoff.js and weather.js have none left (their controls use data-act), nor has act.js');
  ok(['add-card.js','add-more.js','add.js','add-sheet.js','item-photo.js','itemsheet.js'].every(f=>!counts[f]),'the Add card, the "Add without a photo" sheet, the item page and its photo tools have none left (C2-5)');
  ok(!counts['index.html']&&(fs.readFileSync(path.join(ROOT,'index.html'),'utf8').match(/\sdata-act(-[a-z]+)?="/g)||[]).length>=63,'index.html has none left: its 63 controls name their handlers with data-act (C2-4)');
  // the rule itself, on made-up counts: one more fails, a new file fails, one fewer fails until the table follows, the same passes
  const T={'a.js':3,'b.js':1};
  ok(!ratchet({'a.js':3,'b.js':1},T).length,'the rule passes counts equal to the table');
  ok(ratchet({'a.js':4,'b.js':1},T).join()==='a.js has 4 inline handlers, 3 allowed: use data-act (act.js)','the rule fails a file whose count rose');
  ok(ratchet({'a.js':3,'b.js':1,'c.js':1},T).join()==='c.js has 1 inline handler, 0 allowed: use data-act (act.js)','the rule fails a handler in a file that is not in the table');
  ok(ratchet({'a.js':2,'b.js':1},T).join()==='a.js is down to 2 from 3: lower its number in LEFT'&&ratchet({'a.js':3},T).join()==='b.js is down to 0 from 1: lower its number in LEFT (take the line out)','the rule asks for a lower number when a file’s count fell');
  ok(' onclick="x()" data-act="y" onchange="z(this)"\tonkeydown="k()" online="1" on="2"'.match(HANDLER).length===4&&!('<b data-on="1" aeon="x">'.match(HANDLER)),'the count takes ` on<type>="` and nothing else');

  const CHECKED=new Set([
    // ids of the app's own shape (core.js ID_RE, cleanRecord) and keys from the app's own lists
    'account.js|acctEsc(v.id)','app.js|k','care.js|w','care.js|g.t','care.js|t',
    'dress.js|k','missed.js|k','history.js|slot','pack.js|which','pack.js|first.k','photos.js|itemKey(i)',
    'shop.js|k','shop.js|esc(x.key)','today.js|s',"today.js|addForSlot(s,o.suitDay)||''",'ui.js|o.mode',"ui.js|o.cloth||''",'wardrobe.js|k',
    // the Add card's offers: Claude's answer, shown only when it is one of the app's own keys (TYPES, COLORS, colsFor, PATS_BY) or a field name
    'tagging.js|q.refineType','tagging.js|q.refineKept.c','tagging.js|q.altColor','tagging.js|q.altPattern','tagging.js|f','tagging.js|v.f','tagging.js|v.to','tagging.js|mp']);
  const found=[];
  for(const f of files){const s=fs.readFileSync(path.join(ROOT,f),'utf8');
    for(const m of s.matchAll(/\son[a-z]+="([^"]*)"/g))for(const q of m[1].matchAll(/'\$\{((?:[^{}]|\{[^{}]*\})*)\}/g))if(!/^jsq\(/.test(q[1]))found.push(f+'|'+q[1])}
  const fresh=[...new Set(found)].filter(x=>!CHECKED.has(x)),stale=[...CHECKED].filter(x=>!found.includes(x));
  ok(files.length>40&&found.length>40,`the lint reads the app's scripts (${files.length} files, ${found.length} quoted values in inline handlers)`);
  ok(!fresh.length,'no quoted value in an inline handler that isn\'t jsq() or checked to be app-made'+(fresh.length?': '+fresh.join(', '):''));
  ok(!stale.length,'the checked list holds no value whose handler is gone'+(stale.length?': '+stale.join(', '):''));
  // the three sinks of C1 hold no handler at all now: their values are in data-* attributes
  const src=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
  ok(/function renderCustomUI\(/.test(src('own-lists.js'))&&!/onclick="removeCustom/.test(src('own-lists.js')),'Settings\' own colors and patterns: Remove has no inline handler (CR-2-02)');
  ok(!/on(change|click)="(toggleHoliday|removeDaysOff)/.test(src('daysoff.js')),'Days off: a holiday\'s checkbox and a day off\'s × have no inline handler (CR-7-02)');
  ok(!/onclick="shopUnhide/.test(src('shop.js')),'What to buy: "Show again" has no inline handler (CR-4-01)');
  // the lint itself catches the old code
  const old=`<button type="button" onclick="removeCustom('colors','\${c.key}')">Remove</button> onclick="shopUnhide('\${esc(k)}')" onclick="x('\${jsq(k)}')"`;
  const hits=[...old.matchAll(/\son[a-z]+="([^"]*)"/g)].flatMap(m=>[...m[1].matchAll(/'\$\{((?:[^{}]|\{[^{}]*\})*)\}/g)].map(q=>q[1])).filter(x=>!/^jsq\(/.test(x));
  ok(hits.join()==='c.key,esc(k)','the lint flags the old Remove and Show again handlers, and passes jsq() ('+hits.join()+')');
};
