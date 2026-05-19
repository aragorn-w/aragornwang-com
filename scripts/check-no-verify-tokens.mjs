#!/usr/bin/env node
// Build-time guard: fails the build if any unresolved {{VERIFY ...}}
// placeholder appears in src/content/.
//
// VERIFY tokens are internal markers for unconfirmed copy. Letting one reach
// the live site exposes unfinished content on the portfolio surface that is
// supposed to establish research and industry credibility.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCAN_DIR = 'src/content';
const TEXT_EXT = /\.(md|mdx|json|ya?ml)$/i;
const PATTERN = /\{\{\s*VERIFY\b[^}]*\}\}/gi;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      yield* walk(full);
    } else if (TEXT_EXT.test(full)) {
      yield full;
    }
  }
}

const root = join(ROOT, SCAN_DIR);
try {
  statSync(root);
} catch {
  console.log(`check-no-verify-tokens: ${SCAN_DIR} does not exist, skipping.`);
  process.exit(0);
}

const offenders = [];
for (const file of walk(root)) {
  const text = readFileSync(file, 'utf8');
  const matches = text.match(PATTERN);
  if (!matches) continue;
  const rel = relative(ROOT, file);
  for (const match of matches) {
    offenders.push({ file: rel, token: match });
  }
}

if (offenders.length > 0) {
  console.error('\nx check-no-verify-tokens: unresolved VERIFY placeholder(s) found.');
  console.error('  Resolve the copy or remove the entry before shipping.\n');
  for (const { file, token } of offenders) {
    console.error(`   - ${file}: ${token}`);
  }
  console.error('');
  process.exit(1);
}

console.log('check-no-verify-tokens: no unresolved VERIFY placeholders');
