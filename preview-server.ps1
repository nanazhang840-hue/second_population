# 第二人口 · 本机静态预览服务（Windows PowerShell 5.1 自带 HttpListener）
# 只用系统自带组件，不依赖 Node / Python / 任何第三方包。
# 说明：HttpListener 的顺序处理会让大文件（mp4）阻塞后续请求，
# 因此请求分派到 runspace 池里并发处理。
param(
  [int]$PortStart = 8120,
  [int]$PortEnd = 8160,
  [int]$MaxWorkers = 8,
  # 启动后自动打开的页面（相对路径，例如 'space.html'）；留空则打开 index.html
  [string]$OpenPath = '',
  # 自动化验证时用：只起服务，不打开浏览器
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$Root = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($Root)) { $Root = Split-Path -Parent $MyInvocation.MyCommand.Definition }
$RootFull = [System.IO.Path]::GetFullPath($Root).TrimEnd('\') + '\'

$Mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.htm'  = 'text/html; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.mjs'  = 'text/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.map'  = 'application/json; charset=utf-8'
  '.txt'  = 'text/plain; charset=utf-8'
  '.md'   = 'text/plain; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.webp' = 'image/webp'
  '.gif'  = 'image/gif'
  '.ico'  = 'image/x-icon'
  '.mp4'  = 'video/mp4'
  '.webm' = 'video/webm'
  '.glb'  = 'model/gltf-binary'
  '.gltf' = 'model/gltf+json'
  '.ktx2' = 'image/ktx2'
  '.woff2' = 'font/woff2'
  '.woff' = 'font/woff'
  '.ttf'  = 'font/ttf'
  '.otf'  = 'font/otf'
  '.zip'  = 'application/zip'
  '.wasm' = 'application/wasm'
}

# 单个请求的处理逻辑（在 runspace 池中执行，必须是自包含脚本块）
$Handler = {
  param($context, $RootFull, $Mime)

  $request = $context.Request
  $response = $context.Response

  function Send-Text {
    param($target, [int]$status, [string]$text)
    try {
      $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
      $target.StatusCode = $status
      $target.ContentType = 'text/plain; charset=utf-8'
      $target.ContentLength64 = $bytes.Length
      $target.OutputStream.Write($bytes, 0, $bytes.Length)
    } catch {}
  }

  try {
    $response.Headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
    $response.Headers['Pragma'] = 'no-cache'

    $method = $request.HttpMethod
    if ($method -ne 'GET' -and $method -ne 'HEAD') {
      Send-Text $response 405 'Method Not Allowed'
      return
    }

    $rawPath = $request.RawUrl
    $queryIndex = $rawPath.IndexOf('?')
    if ($queryIndex -ge 0) { $rawPath = $rawPath.Substring(0, $queryIndex) }
    $hashIndex = $rawPath.IndexOf('#')
    if ($hashIndex -ge 0) { $rawPath = $rawPath.Substring(0, $hashIndex) }

    $decoded = '/'
    try { $decoded = [System.Uri]::UnescapeDataString($rawPath) } catch {
      Send-Text $response 400 'Bad Request'
      return
    }

    if ($decoded -eq '/' -or $decoded -eq '') { $decoded = '/index.html' }
    $relative = $decoded.TrimStart('/').Replace('/', '\')

    $filePath = $null
    try {
      $filePath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($RootFull, $relative))
    } catch {
      Send-Text $response 400 'Bad Request'
      return
    }

    if (-not $filePath.StartsWith($RootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
      Send-Text $response 403 'Forbidden'
      return
    }

    if ([System.IO.Directory]::Exists($filePath)) { $filePath = [System.IO.Path]::Combine($filePath, 'index.html') }

    if (-not [System.IO.File]::Exists($filePath)) {
      Send-Text $response 404 ('Not Found: ' + $decoded)
      return
    }

    $extension = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
    $contentType = 'application/octet-stream'
    if ($Mime.ContainsKey($extension)) { $contentType = $Mime[$extension] }

    $total = (Get-Item -LiteralPath $filePath).Length
    $startByte = 0
    $endByte = $total - 1
    $status = 200
    $rangeHeader = $request.Headers['Range']

    if ($rangeHeader -and $rangeHeader -match '^bytes=(\d*)-(\d*)$') {
      $fromText = $matches[1]
      $toText = $matches[2]
      if ([string]::IsNullOrEmpty($fromText) -and [string]::IsNullOrEmpty($toText)) {
        $status = 416
      } elseif ([string]::IsNullOrEmpty($fromText)) {
        $suffix = [int64]$toText
        if ($suffix -le 0) { $status = 416 }
        else {
          $startByte = [Math]::Max([int64]0, $total - $suffix)
          $endByte = $total - 1
          $status = 206
        }
      } else {
        $startByte = [int64]$fromText
        if ($startByte -ge $total) { $status = 416 }
        elseif ([string]::IsNullOrEmpty($toText)) { $endByte = $total - 1; $status = 206 }
        else {
          $endByte = [Math]::Min([int64]$toText, $total - 1)
          if ($endByte -lt $startByte) { $status = 416 } else { $status = 206 }
        }
      }
    }

    if ($status -eq 416) {
      $response.StatusCode = 416
      $response.AddHeader('Content-Range', "bytes */$total")
      $response.ContentLength64 = 0
      return
    }

    $response.StatusCode = $status
    $response.ContentType = $contentType
    $response.AddHeader('Accept-Ranges', 'bytes')
    if ($status -eq 206) { $response.AddHeader('Content-Range', "bytes $startByte-$endByte/$total") }
    $length = $endByte - $startByte + 1
    if ($total -le 0) { $length = 0 }
    $response.ContentLength64 = $length

    if ($method -ne 'HEAD' -and $length -gt 0) {
      $stream = [System.IO.File]::Open($filePath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
      try {
        $stream.Position = $startByte
        $remaining = $length
        $buffer = New-Object byte[] 262144
        while ($remaining -gt 0) {
          $want = [Math]::Min([int64]$buffer.Length, $remaining)
          $read = $stream.Read($buffer, 0, [int]$want)
          if ($read -le 0) { break }
          $response.OutputStream.Write($buffer, 0, $read)
          $remaining -= $read
        }
      } finally {
        $stream.Dispose()
      }
    }
  } catch {
    try { Send-Text $response 500 ('Server Error: ' + $_.Exception.Message) } catch {}
  } finally {
    try { $response.OutputStream.Close() } catch {}
    try { $response.Close() } catch {}
  }
}

$listener = $null
$port = 0
for ($candidate = $PortStart; $candidate -le $PortEnd; $candidate++) {
  $tryListener = New-Object System.Net.HttpListener
  try {
    $tryListener.Prefixes.Add("http://127.0.0.1:$candidate/")
    $tryListener.Start()
    $listener = $tryListener
    $port = $candidate
    break
  } catch {
    try { $tryListener.Close() } catch {}
  }
}
if ($null -eq $listener) {
  Write-Host ""
  Write-Host "启动失败：端口 $PortStart-$PortEnd 全部被占用或被系统策略拒绝。" -ForegroundColor Red
  Write-Host "请先关闭占用端口的程序，或修改本脚本里的 `$PortStart。"
  exit 1
}

$baseUrl = "http://127.0.0.1:$port/"
$url = $baseUrl
if (-not [string]::IsNullOrWhiteSpace($OpenPath)) { $url = $baseUrl + $OpenPath.TrimStart('/') }

Write-Host ""
Write-Host "第二人口 · 本地预览" -ForegroundColor Cyan
Write-Host "目录：$Root"
Write-Host "主流程：$($baseUrl)index.html"
Write-Host "档案空间：$($baseUrl)space.html"
Write-Host "本次打开：$url" -ForegroundColor Green
Write-Host "关闭此窗口即停止预览。" -ForegroundColor Yellow
Write-Host ""

if (-not $NoBrowser) {
  try { Start-Process $url | Out-Null } catch { Write-Host "浏览器未能自动打开，请手动访问上面的地址。" -ForegroundColor Yellow }
}

$pool = [runspacefactory]::CreateRunspacePool(1, $MaxWorkers)
$pool.Open()
$pending = New-Object System.Collections.ArrayList

while ($listener.IsListening) {
  $context = $null
  try {
    $context = $listener.GetContext()
  } catch {
    if (-not $listener.IsListening) { break }
    Start-Sleep -Milliseconds 40
    continue
  }

  try {
    $shell = [powershell]::Create()
    $shell.RunspacePool = $pool
    [void]$shell.AddScript($Handler).AddArgument($context).AddArgument($RootFull).AddArgument($Mime)
    $handle = $shell.BeginInvoke()
    [void]$pending.Add([pscustomobject]@{ Shell = $shell; Handle = $handle })
  } catch {
    try { $context.Response.StatusCode = 500; $context.Response.Close() } catch {}
  }

  foreach ($item in @($pending)) {
    if ($item.Handle.IsCompleted) {
      try { $item.Shell.EndInvoke($item.Handle) | Out-Null } catch {}
      try { $item.Shell.Dispose() } catch {}
      [void]$pending.Remove($item)
    }
  }
}

foreach ($item in @($pending)) {
  try { $item.Shell.EndInvoke($item.Handle) | Out-Null } catch {}
  try { $item.Shell.Dispose() } catch {}
}
try { $pool.Close(); $pool.Dispose() } catch {}
try { $listener.Stop(); $listener.Close() } catch {}
