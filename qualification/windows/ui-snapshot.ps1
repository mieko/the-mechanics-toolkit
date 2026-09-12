[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateRange(1, [int]::MaxValue)]
  [int]$ProcessId,

  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

try {
  Add-Type -AssemblyName UIAutomationClient
  Add-Type -AssemblyName UIAutomationTypes
  $condition = New-Object Windows.Automation.PropertyCondition(
    [Windows.Automation.AutomationElement]::ProcessIdProperty,
    $ProcessId
  )
  $elements = [Windows.Automation.AutomationElement]::RootElement.FindAll(
    [Windows.Automation.TreeScope]::Descendants,
    $condition
  )
  $allowedControlTypes = [Collections.Generic.HashSet[string]]::new(
    [string[]]@(
      'ControlType.Button',
      'ControlType.ComboBox',
      'ControlType.Document',
      'ControlType.Edit',
      'ControlType.MenuItem',
      'ControlType.Window'
    )
  )
  $descriptions = @($elements | ForEach-Object {
    try {
      $name = $_.Current.Name
      $automationId = $_.Current.AutomationId
      $controlType = $_.Current.ControlType.ProgrammaticName
      if (($name -or $automationId) -and $allowedControlTypes.Contains($controlType)) {
        [ordered]@{
          name = $name
          automationId = $automationId
          controlType = $controlType
          enabled = $_.Current.IsEnabled
          offscreen = $_.Current.IsOffscreen
          patterns = @($_.GetSupportedPatterns() | ForEach-Object ProgrammaticName)
        }
      }
    } catch {
    }
  })
  [ordered]@{ok = $true; processId = $ProcessId; elements = $descriptions} |
    ConvertTo-Json -Depth 5 |
    Set-Content -LiteralPath $OutputPath -Encoding utf8
  exit 0
} catch {
  [ordered]@{ok = $false; processId = $ProcessId; error = $_.Exception.Message} |
    ConvertTo-Json -Depth 3 |
    Set-Content -LiteralPath $OutputPath -Encoding utf8
  exit 1
}
