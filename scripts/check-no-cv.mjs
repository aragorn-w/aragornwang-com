#!/usr/bin/env node
// Build-time guard per spec §7.1.
// Fails the build if any CV/resume artifact has been added to public/ or src/.
//
// The site does not expose a downloadable CV. If a recruiter or admissions
// reviewer wants the document, they email Aragorn. Accidentally committing
// one to public/ would silently undo that policy.
//
// Matches CV/resume tokens (cv, resume, curriculum, vitae) inside any
// suspicious-extension file. Splits on non-letter separators and camelCase
// boundaries; also catches the token as a prefix or suffix of a longer
// concatenated token (myresume, AragornWangCV) without false-positiving on
// mid-word substrings (scvbenchmark, recover). Accent normalization handles
// "résumé". Self-tests run on every invocation so the matcher cannot
// silently regress.

import { readdirSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCAN_DIRS = ['public', 'src'];
const SUSPICIOUS_EXT = /\.(pdf|docx?|rtf|odt|pages)$/i;
const SUSPICIOUS_TOKENS = ['cv', 'resume', 'curriculum', 'vitae'];

function normalize(s) {
  // Lowercase + strip combining marks so "Résumé" becomes "resume".
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function tokenize(name) {
  const stem = name.replace(SUSPICIOUS_EXT, '');
  // Insert separators at camelCase boundaries before lowercasing, so
  // "AragornWangCV" and "MyCVDocument" decompose into discrete tokens.
  const withBreaks = stem
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return normalize(withBreaks)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function isCvLikeFilename(name) {
  if (!SUSPICIOUS_EXT.test(name)) return false;
  const tokens = tokenize(name);
  return tokens.some((t) => {
    for (const kw of SUSPICIOUS_TOKENS) {
      if (t === kw) return true;
      // Only catch the keyword at a token boundary (prefix or suffix),
      // not embedded in the middle of an unrelated word.
      if (t.length > kw.length && (t.startsWith(kw) || t.endsWith(kw))) {
        return true;
      }
    }
    return false;
  });
}

const SELF_TESTS = [
  ['cv.pdf', true],
  ['resume.pdf', true],
  ['curriculum.pdf', true],
  ['curriculum_vitae.docx', true],
  ['cv-2026.pdf', true],
  ['Aragorn_Wang_CV.pdf', true],
  ['AragornWangCV.pdf', true],
  ['MyCVDocument.pdf', true],
  ['myresume.pdf', true],
  ['resume-final.pdf', true],
  ['my-resume.doc', true],
  ['CV (1).pdf', true],
  ['résumé.pdf', true],
  ['vitae.pdf', true],
  ['ResumeForJob.pdf', true],
  ['headshot.jpg', false],
  ['favicon.ico', false],
  ['coverage.pdf', false],
  ['discover.pdf', false],
  ['recovery.pdf', false],
  ['scvbenchmark.pdf', false],
  ['photo.png', false],
];

for (const [name, expected] of SELF_TESTS) {
  const got = isCvLikeFilename(name);
  if (got !== expected) {
    console.error(
      `check-no-cv self-test failed: isCvLikeFilename(${JSON.stringify(name)}) returned ${got}, expected ${expected}`,
    );
    process.exit(2);
  }
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
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
    if (isCvLikeFilename(basename(file))) {
      offenders.push(relative(ROOT, file));
    }
  }
}

if (offenders.length > 0) {
  console.error('\nx check-no-cv: CV/resume artifact detected.');
  console.error('  The site does not expose downloadable CVs (spec §7.1).');
  console.error('  Move these files out of public/ and src/; keep them in ./source/ instead.\n');
  for (const f of offenders) {
    console.error('   - ' + f);
  }
  console.error('');
  process.exit(1);
}

console.log('check-no-cv: no CV/resume artifacts in public/ or src/');
