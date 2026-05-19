#!/usr/bin/env bash
# Cloudflare Pages deploy wrapper.
#
# Two responsibilities beyond invoking wrangler:
#
#   1. Production-only gate. This script is the production deploy path and
#      passes `--branch=main` to wrangler unconditionally. Running it with
#      anything other than main checked out would publish a feature-branch
#      artifact on the production hostname, bypassing the protected-branch
#      PR workflow.
#
#   2. Commit-message sanitization. wrangler forwards the commit subject in
#      HTTP headers, which are ISO-8859-1 per HTTP/1.1. Raw multibyte UTF-8
#      (arrows, em dashes, smart quotes) gets rejected by the CF API as
#      "Invalid commit message, it must be a valid UTF-8 string." (code
#      8000111). Strip to ASCII before handing off to wrangler.
#
set -euo pipefail

RESOLVED_BRANCH="${CF_PAGES_BRANCH:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')}"

if [ "$RESOLVED_BRANCH" != "main" ]; then
  echo "deploy-cf: refusing to deploy. Resolved branch '${RESOLVED_BRANCH:-<unknown>}' is not 'main'." >&2
  echo "deploy-cf: this script is the production deploy path. Branch protection requires" >&2
  echo "deploy-cf: PR -> squash-merge to main; CF Pages then re-invokes this script." >&2
  exit 1
fi

# Idempotent project create. The "already exists" failure mode is expected
# on every run after the first; other failures (auth, permission, network)
# must surface so a deploy does not silently progress against a misconfigured
# Cloudflare account.
if CREATE_OUT=$(npx wrangler pages project create aragornwang-com \
  --production-branch=main 2>&1); then
  echo "deploy-cf: created Cloudflare Pages project 'aragornwang-com'."
  echo "$CREATE_OUT"
elif echo "$CREATE_OUT" | grep -qiE 'already (exists|taken)|name (is|has been) (already )?taken'; then
  echo "deploy-cf: Cloudflare Pages project 'aragornwang-com' already exists, continuing."
else
  echo "deploy-cf: wrangler pages project create failed:" >&2
  echo "$CREATE_OUT" >&2
  exit 1
fi

MSG=$(git log -1 --format=%s | iconv -c -f UTF-8 -t ASCII 2>/dev/null || true)
[ -z "$MSG" ] && MSG="deploy"

exec npx wrangler pages deploy dist \
  --project-name=aragornwang-com \
  --branch=main \
  --commit-hash="${CF_PAGES_COMMIT_SHA:-$(git rev-parse HEAD)}" \
  --commit-message="$MSG"
