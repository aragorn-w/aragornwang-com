// Fails the build if the font pipeline produced anything other than exactly
// the vendored fonts, on every page.
//
// This exists because a fontless build is SILENT. Astro's font resolver runs
// with `throwOnError: false`, so a provider it cannot reach yields zero
// @font-face sources and the build still exits 0. Such a build passed the whole
// browser harness (49/49 routes, 25/25 design-system) before this check.
//
// It runs as `postbuild`, not inside the verify harness, so it also guards the
// Cloudflare deploy, which runs `npm run build` and never runs verify.
//
// It binds the emitted CSS to the vendored BYTES: an earlier, weaker version
// only counted faces, and passed when all 24 binaries were replaced with the
// text "broken font", when unicode ranges were wrong, when a family was renamed
// and when one page lost its fonts entirely. Each of those is now caught.

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const MANIFEST = 'src/assets/fonts/MANIFEST.json';
const problems = [];
const note = (m) => problems.push(m);

if (!existsSync(DIST)) {
  console.error(`check-fonts: ${DIST}/ not found; run the build first.`);
  process.exit(1);
}

const expected = JSON.parse(readFileSync(MANIFEST, 'utf8')).fonts;
if (!Array.isArray(expected) || expected.length === 0) {
  console.error('check-fonts: manifest lists no fonts.');
  process.exit(1);
}

// Faces are joined to the manifest by their FULL normalized unicode-range, not
// by a guess from the first range. Classifying on the first range only let a
// corrupted range through: replacing every latin-ext range with U+10FFFF, or
// truncating latin to just U+0000-00FF, shipped correct bytes with the wrong
// character coverage and passed. A byte hash cannot catch that, because the
// bytes are fine; the CSS is what is wrong.
const normRange = (r) =>
  r
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join(',');
const keyOf = (f) => `${f.family}/${f.weight}/${f.style}`;
const byKey = new Map();
for (const f of expected) {
  if (!Array.isArray(f.unicodeRange) || f.unicodeRange.length === 0) {
    console.error(`check-fonts: manifest entry ${f.file} has no unicodeRange.`);
    process.exit(1);
  }
  (byKey.get(keyOf(f)) ?? byKey.set(keyOf(f), []).get(keyOf(f))).push({
    ...f,
    range: normRange(f.unicodeRange.join(',')),
  });
}
const expectedKeys = new Set(expected.map((f) => `${keyOf(f)}/${f.subset}`));

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });

const all = walk(DIST);
const pages = all.filter((f) => f.endsWith('.html'));
const sheets = all.filter((f) => f.endsWith('.css'));

// 1. Every emitted woff2 must be byte-for-byte a file we vendored.
const wantedShas = new Set(expected.map((f) => f.sha256));
const emitted = all.filter((f) => f.endsWith('.woff2'));
const emittedShas = new Set();
for (const f of emitted) {
  const sha = createHash('sha256').update(readFileSync(f)).digest('hex');
  emittedShas.add(sha);
  if (!wantedShas.has(sha)) note(`${f} is not any vendored font (sha256 ${sha.slice(0, 12)}…).`);
}
for (const f of expected) {
  if (!emittedShas.has(f.sha256)) note(`vendored ${f.file} was not emitted.`);
}
if (emitted.length !== expected.length) {
  note(`emitted ${emitted.length} woff2 files, expected ${expected.length}.`);
}

// 2. Every page must declare the complete inventory, and each declaration must
//    point at the correct bytes for that exact family/weight/style/subset.
for (const page of pages) {
  const text = readFileSync(page, 'utf8');
  const seen = new Set();
  for (const [, body] of text.matchAll(/@font-face\{([^}]*)\}/g)) {
    const url = body.match(/url\("([^"]+\.woff2)"\)/)?.[1];
    if (!url) continue; // system-fallback face, has no source of its own
    const range = body.match(/unicode-range:([^;}]+)/)?.[1];
    if (!range) {
      note(`${page}: a face has no unicode-range.`);
      continue;
    }
    const family = body.match(/font-family:"?([^";]+)"?;/)[1].replace(/-[0-9a-f]{8,}$/, '');
    const weight = Number(body.match(/font-weight:(\d+)/)?.[1] ?? 400);
    const style = body.match(/font-style:(\w+)/)?.[1] ?? 'normal';
    const candidates = byKey.get(`${family}/${weight}/${style}`);
    if (!candidates) {
      note(`${page}: unexpected face ${family}/${weight}/${style}.`);
      continue;
    }
    // The emitted range must match one of the manifest's ranges EXACTLY.
    const want = candidates.find((c) => c.range === normRange(range));
    if (!want) {
      note(
        `${page}: ${family}/${weight}/${style} has a unicode-range matching no vendored subset.`,
      );
      continue;
    }
    const key = `${family}/${weight}/${style}/${want.subset}`;
    if (seen.has(key)) note(`${page}: duplicate face ${key}.`);
    seen.add(key);
    const file = join(DIST, url.replace(/^\//, ''));
    if (!existsSync(file) || statSync(file).size === 0) {
      note(`${page}: ${url} is missing or empty.`);
      continue;
    }
    const sha = createHash('sha256').update(readFileSync(file)).digest('hex');
    if (sha !== want.sha256) note(`${page}: ${key} points at the wrong bytes.`);
  }
  for (const k of expectedKeys) if (!seen.has(k)) note(`${page}: missing face ${k}.`);
}

// 3. A stylesheet may also carry faces; they must be legitimate too.
for (const sheet of sheets) {
  for (const [, body] of readFileSync(sheet, 'utf8').matchAll(/@font-face\{([^}]*)\}/g)) {
    const url = body.match(/url\("([^"]+\.woff2)"\)/)?.[1];
    if (!url) continue;
    const file = join(DIST, url.replace(/^\//, ''));
    if (!existsSync(file)) note(`${sheet}: references missing ${url}.`);
  }
}

if (problems.length) {
  console.error(`check-fonts: ${problems.length} problem(s):`);
  for (const p of problems.slice(0, 15)) console.error(`  - ${p}`);
  if (problems.length > 15) console.error(`  … and ${problems.length - 15} more`);
  process.exit(1);
}

console.log(
  `check-fonts: ${expected.length} vendored faces verified by sha256 across ${pages.length} pages.`,
);
