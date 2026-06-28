<#
.SYNOPSIS
    Applies GitHub branch protection rules for main and develop.

.DESCRIPTION
    Uses the gh CLI (GitHub CLI) to configure required status checks,
    PR review requirements, and other branch protection settings.
    Must be run after `gh auth login`.

.EXAMPLE
    .\setup-branch-protection.ps1
    .\setup-branch-protection.ps1 -Repo "my-org/my-repo"
#>

param(
    [string]$Repo = ""
)

$ErrorActionPreference = "Stop"

# ── Resolve repo ──────────────────────────────────────────────────────────────
if (-not $Repo) {
    try {
        $Repo = gh repo view --json nameWithOwner -q .nameWithOwner
    } catch {
        Write-Error "Could not determine repository. Pass -Repo owner/name or run from inside the cloned repo."
        exit 1
    }
}
Write-Host "Applying branch protection to: $Repo" -ForegroundColor Cyan

# ── Payload ───────────────────────────────────────────────────────────────────
# Required status check job names — must match exactly the `name:` field in each workflow job.
# Using a here-string avoids ConvertTo-Json serialisation quirks (e.g. $null -> "").
$payload = @'
{
  "required_status_checks": {
    "strict": true,
    "checks": [
      { "context": "Quick Validation (Affected Only)" },
      { "context": "Test Affected (Unit + Integration)" },
      { "context": "API E2E Tests" },
      { "context": "Webapp E2E Tests (Playwright)" }
    ]
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
'@

# ── Apply to each branch ──────────────────────────────────────────────────────
function Apply-BranchProtection {
    param([string]$Branch)

    Write-Host ""
    Write-Host "-- Applying protection to branch: $Branch" -ForegroundColor Yellow

    # Check the branch exists before trying to protect it
    # Temporarily relax error handling so a 404 doesn't terminate the script.
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $null = gh api "repos/$Repo/branches/$Branch" 2>&1
    $branchExists = $LASTEXITCODE -eq 0
    $ErrorActionPreference = $prev
    if (-not $branchExists) {
        Write-Host "   Branch '$Branch' does not exist yet -- skipping." -ForegroundColor DarkGray
        Write-Host "   (Create the branch first, then re-run this script.)" -ForegroundColor DarkGray
        return
    }

    # Write payload to a temp file to avoid piping quirks in PS 5.1
    $tmpFile = [System.IO.Path]::GetTempFileName()
    try {
        [System.IO.File]::WriteAllText($tmpFile, $payload)
        $output = gh api --method PUT "repos/$Repo/branches/$Branch/protection" --input "$tmpFile" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   OK Branch protection applied to '$Branch'" -ForegroundColor Green
        } else {
            Write-Host "   ERROR: $output" -ForegroundColor Red
            throw "Failed to apply protection to '$Branch'"
        }
    } finally {
        Remove-Item $tmpFile -ErrorAction SilentlyContinue
    }
}

Apply-BranchProtection -Branch "main"
Apply-BranchProtection -Branch "develop"

Write-Host ""
Write-Host "Done. Verify at: https://github.com/$Repo/settings/branches" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  1. Edit .github/CODEOWNERS - @Old-St-Labs/senior-devs is already configured."
Write-Host "  2. Once workflows have run at least once, verify the status check names"
Write-Host "     appear in Settings -> Branches -> Edit rule -> Required status checks."
