import { readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const files = walk('server').filter((f) => f.endsWith('.js'));

for (const f of files) execFileSync('node', ['--check', f], { stdio: 'inherit' });
console.log(`Syntax OK: ${files.length} server files`);
