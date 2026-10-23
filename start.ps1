$ErrorActionPreference='Stop'
$taskCommand=Get-Command node -ErrorAction SilentlyContinue
$taskRuntime=if($taskCommand){$taskCommand.Source}else{Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'}
if(-not (Test-Path -LiteralPath $taskRuntime)){throw 'Install Node.js, or serve this folder with a static HTTP server.'}
& $taskRuntime (Join-Path $PSScriptRoot 'serve.mjs')
