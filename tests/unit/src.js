// Tests that check a file's source read it through here (paths from the app's folder).
import { readFileSync } from 'node:fs';
export const read = (f) => readFileSync(new URL('../../' + f, import.meta.url), 'utf8');
