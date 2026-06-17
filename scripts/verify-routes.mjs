// Route-level smoke test for step 6.
// Drives headless Chromium against every shipped page.

import { readFileSync } from 'node:fs';

import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:4321';
const results = [];

// Derive the expected /now "Last updated" label from the content frontmatter,
// using the same Date + Intl formatting the page uses (src/pages/now.astro), so
// this assertion survives legitimate content edits instead of hard-coding a
// month. The Date + Intl pair reproduces the page's timezone behavior exactly,
// so the derived label matches whatever the page renders.
function expectedNowLabel() {
  const md = readFileSync(new URL('../src/content/now.md', import.meta.url), 'utf8');
  const m = md.match(/^updated:\s*(.+)$/m);
  if (!m) return null;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(m[1].trim()));
}

function check(name, pass, detail = '') {
  results.push({ name, pass, detail });
  const mark = pass ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
  console.log(`${mark} ${name}${detail ? '  — ' + detail : ''}`);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ colorScheme: 'dark' });
const errors = [];
ctx.on('weberror', (e) => errors.push(`weberror on ${e.page().url()}: ${e.error().message}`));

const routes = [
  { path: '/', expect: { h1: 'Aragorn Wang', selectors: ['.hero', '.currently', '.featured'] } },
  { path: '/about', expect: { h1: 'about', selectors: ['.facts'] } },
  { path: '/experience', expect: { h1: 'experience', selectors: ['.empty, .cards'] } },
  { path: '/projects', expect: { h1: 'projects', selectors: ['#public-code', '#case-studies'] } },
  { path: '/research', expect: { h1: 'research', selectors: ['.empty, .cards'] } },
  { path: '/blog', expect: { h1: 'blog', selectors: ['.empty, .cards'] } },
  { path: '/now', expect: { h1: '~/now', selectors: ['.now-head'] } },
  { path: '/404', expect: { selectors: ['.not-found', '.suggest'] } },
];

for (const r of routes) {
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') pageErrors.push(`console: ${m.text()}`);
  });

  // 404 always returns 200 in static builds (it's just /404.html); explicit fetch needed
  // to avoid Astro's middleware-shaped routing in dev. Preview serves it directly.
  const resp = await page.goto(BASE + r.path);
  const status = resp?.status();
  check(`GET ${r.path} → 200`, status === 200, `got ${status}`);

  // Wait for boot anim to clear on routes that include it (only homepage)
  if (r.path === '/') {
    try {
      await page.waitForSelector('[data-boot-anim]', { state: 'detached', timeout: 5000 });
    } catch {
      // not always present (booted flag from prior test)
    }
  }

  if (r.expect.h1) {
    const h1 = (await page.textContent('h1'))?.trim();
    check(`${r.path}: h1 = "${r.expect.h1}"`, h1 === r.expect.h1, `got "${h1}"`);
  }

  for (const sel of r.expect.selectors) {
    const count = await page.locator(sel).count();
    check(`${r.path}: selector ${sel} present`, count > 0, `count=${count}`);
  }

  // Common: nav + footer + main on every page
  const nav = await page.locator('nav.site-nav').count();
  const footer = await page.locator('footer.site-footer').count();
  const main = await page.locator('main#main').count();
  check(`${r.path}: nav + footer + main present`, nav === 1 && footer === 1 && main === 1);

  check(`${r.path}: no console / page errors`, pageErrors.length === 0, pageErrors.join('; '));

  await page.close();
}

// Now-page-specific: updated date label rendered (derived from frontmatter)
{
  const page = await ctx.newPage();
  await page.goto(BASE + '/now');
  const updated = await page.textContent('.updated');
  const expected = expectedNowLabel();
  check(
    'Now: updated label rendered',
    expected != null && updated?.includes(expected),
    `expected "${expected}", got "${updated?.trim()}"`,
  );
  await page.close();
}

// 404-page-specific: JS substitutes the actual pathname
{
  const page = await ctx.newPage();
  await page.goto(BASE + '/404');
  const pathDisplay = await page.locator('[data-path]').textContent();
  check(
    '404: path display populated by inline script',
    pathDisplay === '/404',
    `got "${pathDisplay}"`,
  );
  await page.close();
}

// RSS endpoint: returns XML
{
  const page = await ctx.newPage();
  const resp = await page.goto(BASE + '/rss.xml');
  const status = resp?.status();
  const body = await resp?.text();
  check(`/rss.xml → 200`, status === 200, `got ${status}`);
  check(`/rss.xml: contains <rss> root`, body?.includes('<rss'), '');
  check(`/rss.xml: lists site title`, body?.includes('<title>aragornwang.com</title>'));
  await page.close();
}

// Sitemap is auto-generated
{
  const page = await ctx.newPage();
  const resp = await page.goto(BASE + '/sitemap-index.xml');
  check(`/sitemap-index.xml → 200`, resp?.status() === 200, `got ${resp?.status()}`);
  await page.close();
}

await ctx.close();
await browser.close();

const passed = results.filter((r) => r.pass).length;
const total = results.length;
console.log(`\n${passed}/${total} checks passed`);
process.exit(passed === total ? 0 : 1);
