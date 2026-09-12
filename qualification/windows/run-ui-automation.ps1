[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$RequestPath,

  [switch]$Worker
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$requestPath = [IO.Path]::GetFullPath($RequestPath)
$resultPath = "$requestPath.result.json"

function Write-Failure($Message) {
  [ordered]@{ok = $false; error = $Message} |
    ConvertTo-Json -Depth 3 |
    Set-Content -LiteralPath $resultPath -Encoding utf8
}

if ($Worker) {
  try {
    $request = Get-Content -Raw -LiteralPath $requestPath | ConvertFrom-Json
    foreach ($property in @('action', 'processId', 'windowTitle', 'controlName', 'controlType')) {
      if ($request.PSObject.Properties.Name -notcontains $property) {
        throw "UI Automation request is missing '$property'"
      }
    }
    $arguments = @{
      Action = [string]$request.action
      ProcessId = [int]$request.processId
      WindowTitle = [string]$request.windowTitle
      ControlName = [string]$request.controlName
      ControlType = [string]$request.controlType
      OutputPath = $resultPath
    }
    if ($request.PSObject.Properties.Name -contains 'documentName') {
      $arguments.DocumentName = [string]$request.documentName
    }
    if ($request.PSObject.Properties.Name -contains 'requiredButtonName') {
      $arguments.RequiredButtonName = [string]$request.requiredButtonName
    }
    if ($request.PSObject.Properties.Name -contains 'value') {
      $arguments.Value = [string]$request.value
    }
    & (Join-Path $PSScriptRoot 'ui-automation.ps1') @arguments
    exit $LASTEXITCODE
  } catch {
    Write-Failure $_.Exception.Message
    exit 1
  }
}

if (-not (Test-Path -LiteralPath $requestPath -PathType Leaf)) {
  throw "UI Automation request does not exist: $requestPath"
}
Remove-Item -LiteralPath $resultPath -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath "$resultPath.progress" -Force -ErrorAction SilentlyContinue

$taskName = "TMTK-UIA-$([Guid]::NewGuid().ToString('N'))"
$quotedScript = '"{0}"' -f $PSCommandPath
$quotedRequest = '"{0}"' -f $requestPath
$taskArguments = @(
  '-NoProfile',
  '-STA',
  '-WindowStyle', 'Hidden',
  '-ExecutionPolicy', 'Bypass',
  '-File', $quotedScript,
  '-RequestPath', $quotedRequest,
  '-Worker'
) -join ' '
$taskAction = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $taskArguments
$identityName = [Security.Principal.WindowsIdentity]::GetCurrent().Name
if ([String]::IsNullOrWhiteSpace($identityName)) {
  throw "could not resolve the current Windows identity"
}
$principal = New-ScheduledTaskPrincipal -UserId $identityName `
  -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $taskName -Action $taskAction -Principal $principal | Out-Null

try {
  Start-ScheduledTask -TaskName $taskName
  for ($attempt = 0; $attempt -lt 240 -and -not (Test-Path -LiteralPath $resultPath); $attempt += 1) {
    Start-Sleep -Milliseconds 250
  }
  if (-not (Test-Path -LiteralPath $resultPath)) {
    $taskResult = (Get-ScheduledTaskInfo -TaskName $taskName).LastTaskResult
    throw "interactive UI Automation worker produced no result (task result $taskResult)"
  }
  Get-Content -Raw -LiteralPath $resultPath
} finally {
  if ((Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue).State -eq 'Running') {
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  }
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
}
