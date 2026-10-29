// personal-ui.js (My Dream Bucket) — only the amount format the Bucket List screens import from MyNotes' Personal
// Finance screen: a whole amount in the app currency (₹1,20,000).
import { appCurFmt } from '../core/core.js';
export const fmtIntCur = (n) => appCurFmt(0).format(Math.round(Number(n) || 0));
