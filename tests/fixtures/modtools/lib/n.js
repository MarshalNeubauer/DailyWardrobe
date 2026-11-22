// a module with nothing to import: UNIT stays its own, px is exported and bridged
export const UNIT='px';
export function px(n){return n+UNIT}
Object.assign(globalThis,{px});
