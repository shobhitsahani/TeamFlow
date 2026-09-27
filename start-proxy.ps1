# LiteLLM Proxy Starter for Claude Code
# Routes Claude Code -> Groq (Free) / Gemini (Free) / OpenRouter (Free)
# Secrets come from .env (git-ignored) — never commit literal keys.
# Required: GROQ_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY (see .env.example)

$env:Path += ";C:\Users\shobh\AppData\Roaming\Python\Python314\Scripts"

# Load .env next to this script so `os.environ/*` in litellm_config.yaml resolves.
$envFile = Join-Path $PSScriptRoot ".env"
if (Test-Path -LiteralPath $envFile) {
  Get-Content -LiteralPath $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) { return }
    $idx = $line.IndexOf("=")
    if ($idx -gt 0) {
      $k = $line.Substring(0, $idx).Trim()
      $v = $line.Substring($idx + 1).Trim()
      if ($v.Length -ge 2 -and (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'")))) {
        $v = $v.Substring(1, $v.Length - 2)
      }
      if (-not [string]::IsNullOrEmpty($k) -and $null -eq (Get-Item "Env:$k" -ErrorAction SilentlyContinue)) {
        Set-Item -Path "Env:$k" -Value $v
      }
    }
  }
  Write-Host "Loaded secrets from .env (git-ignored)." -ForegroundColor DarkGray
} else {
  Write-Host "WARNING: .env not found — copy .env.example to .env and fill in rotated keys." -ForegroundColor Yellow
}

foreach ($k in @("GROQ_API_KEY", "GEMINI_API_KEY", "OPENROUTER_API_KEY")) {
  if ([string]::IsNullOrEmpty((Get-Item "Env:$k" -ErrorAction SilentlyContinue).Value)) {
    Write-Host "WARNING: $k is unset — that route will fail. Set it in .env." -ForegroundColor Yellow
  }
}

Write-Host "Starting LiteLLM proxy on http://localhost:4000 ..." -ForegroundColor Cyan
Write-Host "Models available:" -ForegroundColor Green
Write-Host "  - claude-3-5-sonnet-20241022  -> Groq Llama-3.3 70B (Free)" -ForegroundColor Yellow
Write-Host "  - claude-3-7-sonnet-20250219  -> Groq Llama-3.3 70B (Free)" -ForegroundColor Yellow
Write-Host "  - gemini-2.0-flash            -> Google Gemini 2.0 Flash (Free)" -ForegroundColor Yellow
Write-Host ""
Write-Host "In another terminal, run:" -ForegroundColor Cyan
Write-Host '  $env:ANTHROPIC_BASE_URL="http://localhost:4000"' -ForegroundColor White
Write-Host '  $env:ANTHROPIC_API_KEY="sk-litellm"' -ForegroundColor White
Write-Host "  claude" -ForegroundColor White
Write-Host ""

litellm --config litellm_config.yaml --port 4000
