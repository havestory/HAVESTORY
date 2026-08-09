#!/bin/bash
# Auto-push to GitHub on every Replit checkpoint commit
set -e

# If GITHUB_PAT not already in environment, read it from the post-commit hook
if [ -z "$GITHUB_PAT" ]; then
  HOOK_FILE="$(git rev-parse --show-toplevel)/.git/hooks/post-commit"
  if [ -f "$HOOK_FILE" ]; then
    GITHUB_PAT=$(grep 'GITHUB_PAT=' "$HOOK_FILE" | head -1 | cut -d'"' -f2)
  fi
fi

if [ -z "$GITHUB_PAT" ]; then
  echo "[github-sync] GITHUB_PAT not found — skipping push."
  exit 0
fi

REPO_URL="https://kleraandria35-coder:${GITHUB_PAT}@github.com/kleraandria35-coder/PrintBloom.git"

cd "$(git rev-parse --show-toplevel)"

echo "[github-sync] Pushing to GitHub..."
git push "$REPO_URL" HEAD:main --force 2>&1 | sed "s/${GITHUB_PAT}/***REDACTED***/g" || true
echo "[github-sync] Done."
