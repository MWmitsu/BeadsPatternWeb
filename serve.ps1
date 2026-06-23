# ============================================================
#  アイロンビーズ図案メーカー ローカルサーバ (Node.js 不要)
# ------------------------------------------------------------
#  使い方:
#    PowerShell でこのフォルダに移動し、次を実行:
#        ./serve.ps1
#    既定で http://localhost:8080/ を開きます。
#    ポートを変えたい場合:  ./serve.ps1 -Port 8090
#
#  ※ ES Modules / Service Worker は file:// では動かないため、必ずこのサーバ経由で開いてください。
# ============================================================
param([int]$Port = 8080)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$prefix = "http://localhost:$Port/"

# 拡張子 → Content-Type (ESM のため .js は text/javascript が必須)
$mime = @{
  '.html'         = 'text/html; charset=utf-8'
  '.js'           = 'text/javascript; charset=utf-8'
  '.mjs'          = 'text/javascript; charset=utf-8'
  '.css'          = 'text/css; charset=utf-8'
  '.json'         = 'application/json; charset=utf-8'
  '.webmanifest'  = 'application/manifest+json; charset=utf-8'
  '.svg'          = 'image/svg+xml'
  '.png'          = 'image/png'
  '.jpg'          = 'image/jpeg'
  '.jpeg'         = 'image/jpeg'
  '.webp'         = 'image/webp'
  '.ico'          = 'image/x-icon'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try {
  $listener.Start()
} catch {
  Write-Host "ポート $Port を使用できませんでした。別ポートで試してください:  ./serve.ps1 -Port 8090" -ForegroundColor Red
  exit 1
}

Write-Host "===============================================" -ForegroundColor DarkGray
Write-Host " アイロンビーズ図案メーカー" -ForegroundColor Cyan
Write-Host " $prefix を開いています (停止は Ctrl+C)" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor DarkGray
try { Start-Process $prefix } catch {}

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrEmpty($rel)) { $rel = 'index.html' }
    # ディレクトリトラバーサル簡易対策
    $path = [System.IO.Path]::GetFullPath((Join-Path $root $rel))
    if (-not $path.StartsWith([System.IO.Path]::GetFullPath($root))) {
      $ctx.Response.StatusCode = 403
      $ctx.Response.OutputStream.Close()
      continue
    }
    if ((Test-Path $path) -and -not (Get-Item $path).PSIsContainer) {
      $ext = [System.IO.Path]::GetExtension($path).ToLower()
      $ct = $mime[$ext]
      if (-not $ct) { $ct = 'application/octet-stream' }
      $bytes = [System.IO.File]::ReadAllBytes($path)
      $ctx.Response.ContentType = $ct
      $ctx.Response.Headers['Cache-Control'] = 'no-cache'
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
      $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $rel")
      $ctx.Response.OutputStream.Write($msg, 0, $msg.Length)
    }
    $ctx.Response.OutputStream.Close()
  } catch {
    # クライアント切断などは無視して継続
  }
}
