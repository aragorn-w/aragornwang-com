// One-off verification harness for step 5 design system.
// Drives a real headless Chromium against the preview server.

import { readFileSync } from 'node:fs';

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

    // Regression guard for a silent Vite 8 / Lightning CSS failure. The sticky
    // nav's blur is applied with `backdrop-filter`. When Vite switched its
    // default CSS minifier to Lightning CSS it consolidated the vendor-prefixed
    // and unprefixed declarations and kept only `-webkit-backdrop-filter`, so
    // Chromium and Firefox computed `none` and the blur silently died while
    // Safari still looked correct. `vite.build.cssMinify: 'esbuild'` in
    // astro.config.mjs is what prevents that, and this assertion is what proves
    // the setting is still doing its job. A rendered-text diff cannot see this,
    // which is why it has to be read as computed style in a real browser.
    const navBackdrop = await page.evaluate(() => {
      // .site-nav specifically: that is the element the blur is defined on in
      // Nav.astro. A looser 'header, nav' could match a different element and
      // pass for the wrong reason.
      const nav = document.querySelector('nav.site-nav');
      return nav ? window.getComputedStyle(nav).backdropFilter : null;
    });
    // Fonts must actually RENDER, not merely be requested. A fontless build is
    // silent: Astro's resolver runs with throwOnError:false, so a provider it
    // cannot reach yields zero @font-face sources and still exits 0. Such a
    // build passed this whole harness before these assertions existed.
    //
    // Computed font-family is NOT evidence: it echoes the requested stack
    // whether or not the face exists, and document.fonts.check() can return
    // true with nothing loaded. So this asks Chromium which fonts it actually
    // used to paint, via CDP, and checks the declared inventory against the
    // vendored manifest rather than merely counting whatever is present.
    const manifest = JSON.parse(readFileSync('src/assets/fonts/MANIFEST.json', 'utf8')).fonts;
    const wantByFamily = {};
    for (const f of manifest) wantByFamily[f.family] = (wantByFamily[f.family] ?? 0) + 1;

    const cdp = await page.context().newCDPSession(page);
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const paintedBy = async (selector) => {
      const { root } = await cdp.send('DOM.getDocument');
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
      if (!nodeId) return null;
      const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
      return fonts.filter((f) => f.glyphCount > 0).map((f) => f.familyName);
    };

    // Both families must actually paint glyphs. Checking only the monospace
    // body would miss a serif family that silently fell back.
    for (const [selector, family] of [
      ['body', 'JetBrains Mono'],
      ['p.desc', 'Newsreader'],
    ]) {
      const painted = await paintedBy(selector);
      check(
        `Fonts: ${selector} is painted with ${family}, not a fallback`,
        !!painted?.some((n) => new RegExp(family, 'i').test(n)),
        `got ${JSON.stringify(painted)}`,
      );
    }

    // latin-ext coverage specifically. The latin and latin-ext faces differ only
    // by unicode-range, so a corrupted range ships the right bytes with the
    // wrong coverage: the artifact hash still matches while accented glyphs
    // silently fall back. Checking only ASCII text would never notice.
    await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.id = 'latin-ext-probe';
      // Characters from the non-ASCII part of BOTH subsets, and no spaces.
      // A space is covered by the latin face, so a lenient check passed on that
      // one glyph while the accented characters fell back. The latin face also
      // covers more than U+0000-00FF (OE ligatures, euro, trademark), so
      // truncating its range has to be detectable too.
      probe.textContent = '\u0141\u0104\u0179\u017B\u0152\u0153\u20AC\u2122';
      probe.style.cssText = 'position:fixed;left:-9999px;top:0;font-family:var(--font-mono)';
      const serif = document.createElement('div');
      serif.id = 'latin-ext-probe-serif';
      serif.textContent = '\u0141\u0104\u0179\u017B\u0152\u0153\u20AC\u2122';
      serif.style.cssText = 'position:fixed;left:-9999px;top:40px;font-family:var(--font-serif)';
      document.body.append(probe, serif);
    });
    await page.evaluate(() => document.fonts.ready);
    for (const [selector, family] of [
      ['#latin-ext-probe', 'JetBrains Mono'],
      ['#latin-ext-probe-serif', 'Newsreader'],
    ]) {
      const painted = await paintedBy(selector);
      // EVERY painted font must be the expected family. A lenient "contains"
      // check passed while only the space glyph came from the real font and
      // the accented characters fell back to DejaVu.
      const allOurs =
        Array.isArray(painted) &&
        painted.length > 0 &&
        painted.every((n) => new RegExp(family, 'i').test(n));
      check(
        `Fonts: latin-ext glyphs all use ${family} (unicode-range intact)`,
        allOurs,
        `got ${JSON.stringify(painted)}`,
      );
    }

    // The declared inventory must match the manifest per family, so a renamed
    // or dropped family is caught instead of passing because the faces that
    // remain all happen to load.
    const faceReport = await page.evaluate(async (want) => {
      const byFamily = {};
      for (const f of document.fonts) {
        if (/fallback/i.test(f.family)) continue;
        const base = f.family.replace(/-[0-9a-f]{8,}$/, '').replace(/^["']|["']$/g, '');
        (byFamily[base] ??= []).push(f);
      }
      const missing = Object.keys(want).filter((fam) => (byFamily[fam]?.length ?? 0) !== want[fam]);
      const faces = Object.values(byFamily).flat();
      const settled = await Promise.all(
        faces.map((f) =>
          f
            .load()
            .then(() => f.status)
            .catch(() => 'error'),
        ),
      );
      return {
        missing,
        counts: Object.fromEntries(Object.entries(byFamily).map(([k, v]) => [k, v.length])),
        loaded: settled.filter((s) => s === 'loaded').length,
        total: faces.length,
      };
    }, wantByFamily);

    check(
      'Fonts: declared faces match the vendored manifest, per family',
      faceReport.missing.length === 0,
      `expected ${JSON.stringify(wantByFamily)}, got ${JSON.stringify(faceReport.counts)}`,
    );
    check(
      'Fonts: every declared face loads',
      faceReport.total > 0 && faceReport.loaded === faceReport.total,
      `${faceReport.loaded}/${faceReport.total} loaded`,
    );

    check(
      'Nav: backdrop-filter survives CSS minification (not "none")',
      typeof navBackdrop === 'string' && navBackdrop !== '' && navBackdrop !== 'none',
      `got "${navBackdrop}"`,
    );

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
