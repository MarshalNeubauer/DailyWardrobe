// The type check's ratchet (tests/typecheck.js, Round C): its rule on made-up counts, in Node, without running TypeScript (that is
// `npm run typecheck`, in `npm run lint` and the pre-push hook, about 4 s), so this is selected only when the rule itself changes.
const {compare,total}=require('./typecheck');
module.exports=async({ok})=>{
  const base={page:{'a.js':3,'b.js':1},server:{'worker/x.js':2}};
  let r=compare({page:{'a.js':3,'b.js':1},server:{'worker/x.js':2}},base);
  ok(!r.over.length&&!r.under.length,'the same counts pass, with nothing to report');
  r=compare({page:{'a.js':4,'b.js':1},server:{'worker/x.js':2}},base);
  ok(r.over.length===1&&/page a\.js: 4 errors, 3 allowed/.test(r.over[0]),'a file over its count fails, named with both counts');
  r=compare({page:{'a.js':3,'b.js':1,'c.js':1},server:{'worker/x.js':2}},base);
  ok(r.over.length===1&&/c\.js: 1 errors, 0 allowed/.test(r.over[0]),'a file the baseline doesn\'t list may have no errors');
  r=compare({page:{'a.js':2},server:{'worker/x.js':2}},base);
  ok(!r.over.length&&r.under.length===2&&r.under.some(u=>/b\.js: 0 now, 1/.test(u)),'a file under its count (or gone) passes and is named, to lock in with --update');
  r=compare({page:{'a.js':1,'b.js':1},server:{'worker/x.js':2}},{...base,page:{'a.js':1,'b.js':1}});
  ok(!r.over.length,'a count is per scope: the same file in another scope is counted apart');
  ok(total(base)===6&&total({})===0,'the total adds every scope\'s files (--update refuses a higher one; the pre-push check compares it with origin/main\'s)');
};
