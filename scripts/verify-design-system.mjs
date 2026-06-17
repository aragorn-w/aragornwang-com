// One-off verification harness for step 5 design system.
// Drives a real headless Chromium against the preview server.

import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:4321';
const results = [];

function check(name, pass, detail = '') {
  results.push({ name, pass, detail });
  const mark = pass ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
  console.log(`${mark} ${name}${detail ? '  — ' + detail : ''}`);
}

const browser = await chromium.launch();

try {
  // ───────────────────────────────────────────────
  // Test 1: Home renders, key elements present
  // ───────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ colorScheme: 'dark' });
    const page = await ctx.newPage();
    await page.goto(BASE);

    const h1 = (await page.textContent('h1'))?.trim();
    check('Home: h1 = "Aragorn Wang"', h1 === 'Aragorn Wang', `got "${h1}"`);

    const tagline = (await page.textContent('.tagline'))?.replace(/\s+/g, ' ').trim();
    check(
      'Home: tagline contains expected copy',
      tagline?.includes('AI and robotics undergraduate researcher') &&
        tagline?.includes('Google SWE intern'),
      `got "${tagline}"`,
    );

    const navLinks = await page.locator('nav.site-nav .link').count();
    check('Nav: 7 primary links rendered', navLinks === 7, `got ${navLinks}`);

    const footerToggles = await page
      .locator('[data-theme-toggle], [data-crt-toggle], [data-lig-toggle]')
      .count();
    check('Footer: 3 toggle buttons rendered', footerToggles === 3, `got ${footerToggles}`);

    await ctx.close();
  }

  // ───────────────────────────────────────────────
  // Test 2: Boot animation plays then removes itself; sessionStorage marks booted
  // ───────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ colorScheme: 'dark' });
    const page = await ctx.newPage();
    await page.goto(BASE);

    const bootPresentInitially = await page.locator('[data-boot-anim]').count();
    check('Boot anim: present in initial DOM', bootPresentInitially === 1);

    // Wait for the animation to complete and the element to be removed (~1.2s + 250ms + 400ms ≈ 1.85s)
    await page.waitForSelector('[data-boot-anim]', { state: 'detached', timeout: 5000 });
    check('Boot anim: removes itself from DOM after play', true);

    const booted = await page.evaluate(() => sessionStorage.getItem('booted'));
    check('Boot anim: sessionStorage.booted = "true"', booted === 'true', `got "${booted}"`);

    // Reload — should skip immediately
    await page.reload();
    // Give the inline script a tick to run
    await page.waitForLoadState('domcontentloaded');
    const bootAfterReload = await page.locator('[data-boot-anim]').count();
    check(
      'Boot anim: skipped on reload (sessionStorage)',
      bootAfterReload === 0,
      `got ${bootAfterReload}`,
    );

    await ctx.close();
  }

  // ───────────────────────────────────────────────
  // Test 3: First visit is dark-first by design, regardless of system preference
  //
  // The site is intentionally dark-first: currentTheme() in src/lib/theme.ts
  // defaults to 'dark' with no stored preference, and the BaseHead bootstrap
  // does not consult prefers-color-scheme. So a first visit must render dark
  // even when the system prefers light. This asserts that intentional behavior;
  // do not "fix" it to follow prefers-color-scheme without a design change.
  // ───────────────────────────────────────────────
  {
    const ctxDark = await browser.newContext({ colorScheme: 'dark' });
    const pageDark = await ctxDark.newPage();
    await pageDark.goto(BASE);
    const themeDark = await pageDark.evaluate(() => document.documentElement.dataset.theme);
    check('Theme: dark when prefers-color-scheme=dark', themeDark === 'dark', `got "${themeDark}"`);
    await ctxDark.close();

    const ctxLight = await browser.newContext({ colorScheme: 'light' });
    const pageLight = await ctxLight.newPage();
    await pageLight.goto(BASE);
    const themeLight = await pageLight.evaluate(() => document.documentElement.dataset.theme);
    check(
      'Theme: dark-first even when prefers-color-scheme=light (no stored pref)',
      themeLight === 'dark',
      `got "${themeLight}"`,
    );
    await ctxLight.close();
  }

  // ───────────────────────────────────────────────
  // Test 4: Theme toggle flips, persists, overrides system preference
  // ───────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ colorScheme: 'dark' });
    const page = await ctx.newPage();
    await page.goto(BASE);
    await page.waitForSelector('[data-boot-anim]', { state: 'detached', timeout: 5000 });

    const before = await page.evaluate(() => document.documentElement.dataset.theme);
    check('Theme toggle: starts dark (system pref)', before === 'dark', `got "${before}"`);

    await page.locator('[data-theme-toggle]').click();
    const after = await page.evaluate(() => document.documentElement.dataset.theme);
    check('Theme toggle: flips to light on click', after === 'light', `got "${after}"`);

    const stored = await page.evaluate(() => localStorage.getItem('theme'));
    check('Theme toggle: persists to localStorage', stored === 'light', `got "${stored}"`);

    const labelText = await page.locator('[data-theme-value]').textContent();
    check('Theme toggle: label updates', labelText === 'light', `got "${labelText}"`);

    await page.reload();
    const afterReload = await page.evaluate(() => document.documentElement.dataset.theme);
    check(
      'Theme toggle: persists across reload (overrides system pref)',
      afterReload === 'light',
      `got "${afterReload}"`,
    );

    await ctx.close();
  }

  // ───────────────────────────────────────────────
  // Test 5: CRT toggle flips and persists
  // ───────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ colorScheme: 'dark' });
    const page = await ctx.newPage();
    await page.goto(BASE);
    await page.waitForSelector('[data-boot-anim]', { state: 'detached', timeout: 5000 });

    const initial = await page.evaluate(() => document.documentElement.dataset.crt);
    check('CRT: starts off by default', initial === 'off', `got "${initial}"`);

    await page.locator('[data-crt-toggle]').click();
    const afterClick = await page.evaluate(() => document.documentElement.dataset.crt);
    const stored = await page.evaluate(() => localStorage.getItem('crt'));
    check('CRT: flips to on', afterClick === 'on', `got "${afterClick}"`);
    check('CRT: persists to localStorage', stored === 'on', `got "${stored}"`);

    await page.reload();
    const afterReload = await page.evaluate(() => document.documentElement.dataset.crt);
    check('CRT: persists across reload', afterReload === 'on', `got "${afterReload}"`);

    await ctx.close();
  }

  // ───────────────────────────────────────────────
  // Test 6: Ligature toggle flips and persists
  // ───────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ colorScheme: 'dark' });
    const page = await ctx.newPage();
    await page.goto(BASE);
    await page.waitForSelector('[data-boot-anim]', { state: 'detached', timeout: 5000 });

    const initial = await page.evaluate(() => document.documentElement.dataset.ligatures);
    check('Ligatures: starts on by default', initial === 'on', `got "${initial}"`);

    await page.locator('[data-lig-toggle]').click();
    const afterClick = await page.evaluate(() => document.documentElement.dataset.ligatures);
    const stored = await page.evaluate(() => localStorage.getItem('ligatures'));
    check('Ligatures: flips to off', afterClick === 'off', `got "${afterClick}"`);
    check('Ligatures: persists to localStorage', stored === 'off', `got "${stored}"`);

    await page.reload();
    const afterReload = await page.evaluate(() => document.documentElement.dataset.ligatures);
    check('Ligatures: persists across reload', afterReload === 'off', `got "${afterReload}"`);

    await ctx.close();
  }

  // ───────────────────────────────────────────────
  // Test 7: No console errors during normal use
  // ───────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ colorScheme: 'dark' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
    });
    await page.goto(BASE);
    await page.waitForSelector('[data-boot-anim]', { state: 'detached', timeout: 5000 });
    await page.locator('[data-theme-toggle]').click();
    await page.locator('[data-crt-toggle]').click();
    await page.locator('[data-lig-toggle]').click();
    check('No console / page errors during normal use', errors.length === 0, errors.join('; '));
    await ctx.close();
  }
} finally {
  await browser.close();
}

const passed = results.filter((r) => r.pass).length;
const total = results.length;
console.log(`\n${passed}/${total} checks passed`);
process.exit(passed === total ? 0 : 1);
