$ErrorActionPreference = 'Stop'

$projectId = 'odd-pond-10454202'
$branchId = 'br-purple-morning-aexdy7cc'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$entry = Join-Path $repoRoot 'functions/summary.mjs'
if (-not (Test-Path $entry)) { throw 'Run this script from the ScholarMCP cloud-pilot branch.' }
if (-not (Get-Command 'npx.cmd' -ErrorAction SilentlyContinue)) { throw 'Install Node.js before running this script.' }
if (-not (Get-Command 'npm.cmd' -ErrorAction SilentlyContinue)) { throw 'Install npm before running this script.' }

Push-Location $repoRoot
try {
  Write-Host 'Connecting the Neon CLI to your account. A browser may open.'
  & npx.cmd --yes neon@latest login
  if ($LASTEXITCODE -ne 0) { throw 'Neon login failed.' }

  & npx.cmd --yes neon@latest functions get summarypilot --project-id $projectId --branch $branchId
  if ($LASTEXITCODE -ne 0) { throw 'Could not verify the ScholarMCP test function. No key was requested.' }

  Write-Host 'Installing the two dependencies needed to bundle the function.'
  & npm.cmd install --prefix functions --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed. No key was requested.' }

  $secureKey = Read-Host 'Paste your Google AI Studio Gemini API key (input is hidden)' -AsSecureString
  if ($secureKey.Length -lt 10) { throw 'The key is too short. Nothing was deployed.' }
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
  try {
    $plainKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    Write-Host 'Sending the key directly to the existing Neon test function. Pilot stays disabled.'
    & npx.cmd --yes neon@latest functions deploy summarypilot --src $entry --project-id $projectId --branch $branchId --env "GEMINI_API_KEY=$plainKey" --env 'PILOT_ENABLED=false' --wait
    if ($LASTEXITCODE -ne 0) { throw 'The deploy did not complete. Check the error above; do not paste the key into chat.' }
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    Remove-Variable plainKey, secureKey -ErrorAction SilentlyContinue
  }

  & npx.cmd --yes neon@latest functions get summarypilot --project-id $projectId --branch $branchId --list-env-variables
  if ($LASTEXITCODE -ne 0) { throw 'Deployed, but could not verify the environment-variable names.' }
  Write-Host 'Done. Tell Codex only that the command finished; do not share your key.'
} finally {
  Pop-Location
}
