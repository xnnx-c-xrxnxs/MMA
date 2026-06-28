#!/usr/bin/env bash
# =============================================================================
# setup-branch-protection.sh
#
# Applies the required branch protection rules for main and develop via the
# GitHub API using the `gh` CLI (must be authenticated: gh auth login).
#
# Usage:
#   bash .github/scripts/setup-branch-protection.sh
#
# What it configures on both `main` and `develop`:
#   - Require the four CI status checks to pass before merging
#   - Require "up to date" (no stale branches merging)
#   - Require at least 1 PR approval
#   - Require Code Owner review (CODEOWNERS must have real teams/users)
#   - Dismiss stale reviews when new commits are pushed
#   - Require conversation resolution before merge
#
# Note: Required status check contexts are registered by their exact job names
# as they appear in the workflow files. If you rename a job, update this script.
# =============================================================================

set -euo pipefail

# On Windows (Git Bash/WSL), gh may only be available as gh.exe
GH="gh"
if ! command -v gh &>/dev/null && command -v gh.exe &>/dev/null; then
  GH="gh.exe"
fi

if ! command -v "$GH" &>/dev/null; then
  echo "ERROR: gh CLI not found. Install from https://cli.github.com and run: gh auth login"
  exit 1
fi

# Resolve repo from git remote automatically, or override with REPO env var.
REPO="${REPO:-$($GH repo view --json nameWithOwner -q .nameWithOwner)}"

if [[ -z "$REPO" ]]; then
  echo "ERROR: Could not determine repository. Set REPO=owner/name and re-run."
  exit 1
fi

echo "Applying branch protection to: $REPO"

# -----------------------------------------------------------------------------
# The four required status checks (job names exactly as in workflow files)
# -----------------------------------------------------------------------------
REQUIRED_CHECKS=$(cat <<'EOF'
[
  { "context": "Quick Validation (Affected Only)" },
  { "context": "Test Affected (Unit + Integration)" },
  { "context": "API E2E Tests" },
  { "context": "Webapp E2E Tests (Playwright)" }
]
EOF
)

# -----------------------------------------------------------------------------
# Branch protection payload
# -----------------------------------------------------------------------------
PROTECTION_PAYLOAD=$(cat <<EOF
{
  "required_status_checks": {
    "strict": true,
    "checks": $REQUIRED_CHECKS
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "require_last_push_approval": false
  },
  "restrictions": null,
  "required_conversation_resolution": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
)

# -----------------------------------------------------------------------------
# Apply to each branch
# -----------------------------------------------------------------------------
apply_protection() {
  local branch="$1"
  echo ""
  echo "── Applying protection to branch: $branch"

  # Check whether the branch exists on the remote before trying to protect it
  if ! $GH api "repos/$REPO/branches/$branch" --silent 2>/dev/null; then
    echo "   Branch '$branch' does not exist yet — skipping."
    echo "   (Create the branch first, then re-run this script.)"
    return
  fi

  $GH api \
    --method PUT \
    "repos/$REPO/branches/$branch/protection" \
    --input - <<< "$PROTECTION_PAYLOAD"

  echo "   ✓ Branch protection applied to '$branch'"
}

apply_protection "main"
apply_protection "develop"

echo ""
echo "Done. Verify in: https://github.com/$REPO/settings/branches"
echo ""
echo "Next steps:"
echo "  1. .github/CODEOWNERS is already configured for @Old-St-Labs/senior-devs."
echo "  2. Once workflows have run at least once, verify the status check names"
echo "     appear in Settings - Branches - Edit rule - Required status checks."
