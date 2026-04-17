#!/usr/bin/env node
// Build-time guard per spec §7.1.
// Fails the build if any CV/resume artifact has been added to public/ or src/.
//
// Why: the site explicitly does NOT expose a downloadable CV. If a recruiter
// or admissions reviewer wants the document, they email Aragorn. Accidentally
// committing one to public/ would silently undo that policy.

import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCAN_DIRS = ['public', 'src'];
const PATTERN = /(resume|cv|curriculum)\.(pdf|docx?|rtf)$/i;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      // Don't descend into node_modules or .astro caches if they ever land in scope
      if (name === 'node_modules' || name === '.astro') continue;
      yield* walk(full);
    } else {
      yield full;
    }
  }
}

const offenders = [];
for (const top of SCAN_DIRS) {
  const full = join(ROOT, top);
  try {
    statSync(full);
  } catch {
    continue;
  }
  for (const file of walk(full)) {
    if (PATTERN.test(file)) {
      offenders.push(relative(ROOT, file));
    }
  }
}

if (offenders.length > 0) {
  console.error('\n✗ check-no-cv: CV/resume artifact detected.');
  console.error('  The site does not expose downloadable CVs (spec §7.1).');
  console.error('  Move these files out of public/ and src/ — keep them in ./source/ instead.\n');
  for (const f of offenders) {
    console.error('   • ' + f);
  }
  console.error('');
  process.exit(1);
}

console.log('✓ check-no-cv: no CV/resume artifacts in public/ or src/');
