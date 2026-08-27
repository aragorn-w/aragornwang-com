// CI-safe orchestrator for the browser verification harnesses.
//
// Assumes the site is already built (run `npm run build` first; the CI job and
// the `verify` npm script both do). Starts the Astro preview server, waits for
// it to answer on the expected port, runs verify-routes and verify-design-
// system, then stops the preview server regardless of outcome. Exits non-zero
// if either harness fails or the server never becomes ready.
//
// Keeping the preview lifecycle here means `npm run verify` behaves the same
// locally and in CI, instead of relying on a hand-managed background server.
//
// The Astro CLI is launched directly rather than through `npm run preview`, so
// there is no npm wrapper process between this script and the server.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = 'http://127.0.0.1:4321';
const READY_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 500;
const ASTRO_BIN = fileURLToPath(new URL('../node_modules/astro/bin/astro.mjs', import.meta.url));

if (!existsSync('dist')) {
  console.error('verify-ci: dist/ not found. Run `npm run build` first.');
  process.exit(1);
}

function runNode(scriptPath) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath], { stdio: 'inherit' });
    activeHarness = child;
    child.on('error', (err) => {
      console.error(`verify-ci: failed to launch ${scriptPath}: ${err.message}`);
      resolve(1);
    });
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

async function isServing(url) {
  try {
    const res = await fetch(url);
    return res.ok;
  } catch {
    return false;
  }
}

// Poll until the preview answers. The pre-flight check below guarantees the
// port was free beforehand, so whatever answers here is the server we started.
async function waitForReady(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isServing(url)) return true;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return false;
}

function runAstro(args, { capture = false, onChild } = {}) {
  return new Promise((resolve) => {
    const c = spawn(process.execPath, [ASTRO_BIN, ...args], {
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
    onChild?.(c);
    let out = '';
    if (capture) {
      c.stdout.on('data', (d) => (out += d));
      c.stderr.on('data', (d) => (out += d));
    }
    c.on('error', () => resolve({ code: 1, out }));
    // `close`, not `exit`: stdout and stderr can still be open when the process
    // exits, and ownership is decided by parsing this output.
    c.on('close', (code) => resolve({ code: code ?? 1, out }));
  });
}

// `astro preview status` reports the managed server for this project, if any.
// Running form: "Preview server running at http://host:port (...)".
// Idle form:    "No preview server is running."
const RUNNING_RE = /running at\s+(\S+)/i;
const PID_RE = /pid\s+(\d+)/i;
const START_SETTLE_TIMEOUT_MS = 90_000;
async function previewStatus() {
  const { out } = await runAstro(['preview', 'status'], { capture: true });
  return out;
}

// Only stop a server this run started. mayOwn is set immediately before the
// start call, so a signal arriving while Astro is spawning the detached server
// still cleans it up, and is cleared again if the start turns out to have
// reused someone else's server.
let mayOwn = false;
let ownPid = null;
let startPromise = null;
let startChild = null;
let activeHarness = null;
let cancelled = false;
let teardownPromise = null;
function teardown() {
  if (!mayOwn) return Promise.resolve();
  // One shared promise: a second signal, or a signal arriving during normal
  // teardown, must await the same run rather than exiting underneath it.
  teardownPromise ??= doTeardown();
  return teardownPromise;
}
async function doTeardown() {
  // A start that is still in flight has not registered its daemon yet, so
  // stopping now would find nothing and the server would appear afterwards.
  // Wait for the start to finish first, bounded so a wedged start cannot hang
  // teardown forever.
  if (startPromise) {
    const settled = await Promise.race([
      startPromise.catch(() => null),
      new Promise((r) => setTimeout(() => r('timeout'), START_SETTLE_TIMEOUT_MS)),
    ]);
    if (settled === 'timeout') {
      // The start never settled. Kill it, or the orphan can still go on to
      // create the detached preview after this process exits.
      startChild?.kill('SIGKILL');
    } else if (settled) {
      ownPid ??= settled.out?.match(PID_RE)?.[1] ?? null;
    }
  }
  // Signal the server's own process directly. `astro preview stop` only stops
  // whatever the lock file currently records, so a preview that replaced ours
  // in between would be stopped by it; sending the signal ourselves keeps
  // teardown scoped to the process this run actually started.
  const alive = (pid) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };

  // Only a pid reported by this run's own start is positively attributable.
  // A clear pre-flight does not prove a later-recorded preview is ours: Astro
  // checks the lock and then spawns the detached server, so a competing preview
  // can win that window and our start fails without reporting a pid. Adopting
  // whatever status reports would kill that competitor, so leave it instead.
  if (!ownPid) {
    if (RUNNING_RE.test(await previewStatus())) {
      console.error(
        'verify-ci: a preview server is running, but this run could not confirm it started it. ' +
          'Leaving it alone; check `astro preview status`.',
      );
    }
    return;
  }
  const pid = Number(ownPid);

  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    /* already gone */
  }
  for (let i = 0; i < 20 && alive(pid); i++) await new Promise((r) => setTimeout(r, 150));
  if (alive(pid)) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      /* raced with exit */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  if (alive(pid)) {
    console.error(`verify-ci: preview pid ${pid} did not exit. Stop it manually.`);
    return;
  }

  // Clear the lock file only while it still records the server we just stopped.
  // If another preview has taken it over since, leave that one alone.
  if ((await previewStatus()).match(PID_RE)?.[1] === String(pid)) {
    await runAstro(['preview', 'stop'], { capture: true });
  }
}

// Registered before anything is started, and before the pre-flight checks: the
// server is detached, so a signal between spawn and the start call returning
// would otherwise leave it running, and a signal during the pre-flight awaits
// would otherwise take the default disposition instead of this exit path.
// teardown() is a no-op until mayOwn is set, so this is safe to register early.
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => {
    cancelled = true;
    activeHarness?.kill('SIGTERM');
    void teardown().finally(() => process.exit(130));
  });
}

// Refuse to run if something is already bound to the port: the preview would
// fail to bind, and we would otherwise verify against that pre-existing server.
if (await isServing(BASE)) {
  console.error(
    `verify-ci: ${BASE} is already serving before startup. Stop the other process; refusing to verify against it.`,
  );
  process.exit(1);
}

// Bind explicitly to 127.0.0.1. Astro preview otherwise binds to `localhost`,
// which resolves to IPv6 ::1 on some hosts (e.g. GitHub runners) while the
// harnesses and the readiness probe all use the IPv4 127.0.0.1, so the server
// would be unreachable even though it started.
//
// Astro 7.2 runs `preview` as a managed background process when stdout is not
// a TTY, which is always the case here. The launching command therefore exits
// 0 immediately while the server keeps running, so this asks for that mode
// explicitly and shuts the server down through the CLI rather than by killing
// a child PID that is no longer the server.
// Astro reuses an already-recorded preview for this project regardless of which
// port it is on, and reports success without starting anything. Without this
// check a preview left on another port would make startup look fine, the
// readiness probe would time out on 4321, and teardown would stop a server this
// run never started.
const statusBefore = await previewStatus();
const existing = statusBefore.match(RUNNING_RE)?.[1];
if (existing) {
  console.error(
    `verify-ci: a preview server for this project is already running (${existing}). ` +
      'Stop it with `astro preview stop`; refusing to reuse or stop a server this run did not start.',
  );
  process.exit(1);
}

console.log('verify-ci: starting Astro preview server...');
mayOwn = true;
startPromise = runAstro(['preview', '--background', '--host', '127.0.0.1'], {
  capture: true,
  onChild: (c) => (startChild = c),
});
const started = await startPromise;
if (started.out.trim()) console.log(started.out.trim());

// Astro answers a start request with "Preview server already running at ..."
// when one is already recorded for this project, and exits 0. That can happen
// despite the check above if a preview appears in between, so the start result
// itself decides ownership rather than the earlier snapshot.
if (/already running/i.test(started.out)) {
  mayOwn = false;
  console.error(
    'verify-ci: a preview server for this project was already running; ' +
      'refusing to reuse or stop a server this run did not start.',
  );
  process.exit(1);
}

ownPid = started.out.match(PID_RE)?.[1] ?? null;

if (started.code !== 0) {
  console.error(`verify-ci: failed to start the preview server (exit ${started.code})`);
  await teardown();
  process.exit(1);
}

// Confirm the recorded server is both ours and the one the harnesses will talk
// to. The address alone is not enough: a preview that replaced ours would bind
// the same address, so the harnesses would test it while teardown went on to
// signal the pid of a server that is already gone. Comparing the pid too ties
// both to the process this run started.
async function ownsRecordedServer() {
  const st = await previewStatus();
  const addr = st.match(RUNNING_RE)?.[1] ?? '';
  const pid = st.match(PID_RE)?.[1] ?? null;
  if (!ownPid || pid !== ownPid) {
    console.error(
      `verify-ci: recorded preview pid ${pid ?? 'unknown'} is not the one this run started ` +
        `(${ownPid ?? 'unknown'}). Refusing to verify against a server this run does not own.`,
    );
    return false;
  }
  if (addr !== BASE) {
    console.error(`verify-ci: preview is at "${addr || 'unknown'}", expected ${BASE}. Aborting.`);
    return false;
  }
  return true;
}

if (!(await ownsRecordedServer())) {
  await teardown();
  process.exit(1);
}

let exitCode = 1;
try {
  const ready = await waitForReady(BASE, READY_TIMEOUT_MS);
  if (!ready) {
    console.error(
      `verify-ci: preview server did not become ready at ${BASE} within ${READY_TIMEOUT_MS}ms`,
    );
  } else if (!(await ownsRecordedServer())) {
    // Recheck after readiness: the server could have been replaced while the
    // readiness probe was polling, and the harnesses must not test a foreign one.
    exitCode = 1;
  } else {
    // Run both harnesses unconditionally so a failure in the first still
    // surfaces the second's results, then combine their exit codes.
    const routes = cancelled ? 1 : await runNode('scripts/verify-routes.mjs');
    const design = cancelled ? 1 : await runNode('scripts/verify-design-system.mjs');
    // Revalidate afterwards as well. Checking only beforehand lets a server
    // replaced mid-run be verified against and still report success: the
    // harnesses would pass against a foreign server that outlives this run.
    // If ours is no longer the recorded server, the results cannot be trusted,
    // whether it was replaced or died partway through.
    const stillOurs = cancelled ? false : await ownsRecordedServer();
    exitCode = !cancelled && stillOurs && routes === 0 && design === 0 ? 0 : 1;
  }
} finally {
  await teardown();
}

// Honour cancellation here too: a signal arriving during a successful
// teardown attaches to the same teardown promise, and this continuation would
// otherwise reach process.exit(0) first and report success for a run that was
// interrupted.
process.exit(cancelled ? 130 : exitCode);
