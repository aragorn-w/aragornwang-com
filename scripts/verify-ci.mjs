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
// The Astro CLI is launched directly (not via `npm run preview`) so the server
// is a single child process that a plain child.kill() reliably stops, with no
// npm wrapper grandchild left holding the port.

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

// Poll until our preview answers, but bail if the spawned child exits first.
// Without the child-exit guard, a stale server already bound to the port could
// answer the readiness probe while our preview exits on the bind conflict, and
// the harnesses would then test unrelated content.
async function waitForReady(url, timeoutMs, child) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) return false;
    if (await isServing(url)) return true;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return false;
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
console.log('verify-ci: starting Astro preview server...');
const preview = spawn(process.execPath, [ASTRO_BIN, 'preview', '--host', '127.0.0.1'], {
  stdio: 'inherit',
});

let stopped = false;
function teardown() {
  if (stopped) return;
  stopped = true;
  if (preview.exitCode === null && preview.signalCode === null) {
    preview.kill('SIGTERM');
  }
}

let exitCode = 1;
try {
  const ready = await waitForReady(BASE, READY_TIMEOUT_MS, preview);
  if (!ready) {
    const reason =
      preview.exitCode !== null || preview.signalCode !== null
        ? `preview server exited early (code=${preview.exitCode}, signal=${preview.signalCode})`
        : `preview server did not become ready at ${BASE} within ${READY_TIMEOUT_MS}ms`;
    console.error(`verify-ci: ${reason}`);
  } else {
    // Run both harnesses unconditionally so a failure in the first still
    // surfaces the second's results, then combine their exit codes.
    const routes = await runNode('scripts/verify-routes.mjs');
    const design = await runNode('scripts/verify-design-system.mjs');
    exitCode = routes === 0 && design === 0 ? 0 : 1;
  }
} finally {
  teardown();
}

process.exit(exitCode);
