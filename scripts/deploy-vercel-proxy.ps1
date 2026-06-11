param(
  [switch]$Prod = $true
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$ProxyDir = Join-Path $Root "vercel\weread-proxy"
$Pnpm = Join-Path $Root ".tools\pnpm\bin\pnpm.cjs"

if (-not (Test-Path $ProxyDir)) {
  throw "找不到 Vercel 代理目录：$ProxyDir"
}

if (-not (Test-Path $Pnpm)) {
  throw "找不到项目内 pnpm：$Pnpm"
}

$env:USERPROFILE = Join-Path $Root ".home"
$env:HOME = Join-Path $Root ".home"
$env:APPDATA = Join-Path $Root ".home\AppData\Roaming"
$env:LOCALAPPDATA = Join-Path $Root ".localappdata"
$env:PNPM_HOME = Join-Path $Root ".pnpm-home"

New-Item -ItemType Directory -Force `
  $env:USERPROFILE, `
  $env:APPDATA, `
  $env:LOCALAPPDATA, `
  $env:PNPM_HOME | Out-Null

Push-Location $ProxyDir
try {
  Write-Host "当前目录：$ProxyDir"
  Write-Host "如果尚未登录 Vercel，请按浏览器提示完成登录。"
  node $Pnpm dlx vercel login

  if ($Prod) {
    node $Pnpm dlx vercel deploy --prod
  } else {
    node $Pnpm dlx vercel deploy
  }

  Write-Host ""
  Write-Host "部署完成后，请把输出中的 https://xxx.vercel.app 地址加上 /api/weread 作为代理地址。"
} finally {
  Pop-Location
}
