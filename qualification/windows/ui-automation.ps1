[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('inspect', 'invoke', 'expand', 'select-menu-item', 'set-value')]
  [string]$Action,

  [Parameter(Mandatory = $true)]
  [ValidateRange(1, [int]::MaxValue)]
  [int]$ProcessId,

  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$WindowTitle,

  [string]$DocumentName,

  [string]$RequiredButtonName,

  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$ControlName,

  [Parameter(Mandatory = $true)]
  [ValidateSet('Button', 'Edit', 'Document', 'MenuItem')]
  [string]$ControlType,

  [string]$Value,

  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Element-Description($Element) {
  return [ordered]@{
    name = $Element.Current.Name
    automationId = $Element.Current.AutomationId
    controlType = $Element.Current.ControlType.ProgrammaticName
    processId = $Element.Current.ProcessId
    enabled = $Element.Current.IsEnabled
    offscreen = $Element.Current.IsOffscreen
  }
}

function Control-Text($Element) {
  $valueText = $null
  try {
    $valuePattern = $Element.GetCurrentPattern([Windows.Automation.ValuePattern]::Pattern)
    if ($null -ne $valuePattern) {
      $valueText = [string]$valuePattern.Current.Value
    }
  } catch {
  }
  if ($null -ne $valueText) {
    $withoutLineEnding = $valueText.Trim([char[]]"`r`n")
    if ($withoutLineEnding -ceq $Element.Current.Name) {
      return ''
    }
    return $valueText
  }
  try {
    $textPattern = $Element.GetCurrentPattern([Windows.Automation.TextPattern]::Pattern)
    if ($null -ne $textPattern) {
      $text = [string]$textPattern.DocumentRange.GetText(-1)
      $withoutLineEnding = $text.Trim([char[]]"`r`n")
      if ($withoutLineEnding -ceq $Element.Current.Name) {
        return ''
      }
      return $text
    }
  } catch {
  }
  return $valueText
}

function Text-Sha256($Text) {
  $sha256 = [Security.Cryptography.SHA256]::Create()
  try {
    $bytes = [Text.Encoding]::UTF8.GetBytes($Text)
    return -join ($sha256.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') })
  } finally {
    $sha256.Dispose()
  }
}

$exitCode = 0
$expandedMenuItems = $null
$progressPath = "$OutputPath.progress"
function Record-Phase([string]$Phase) {
  $Phase | Set-Content -LiteralPath $progressPath -Encoding ascii
}
try {
  Add-Type -AssemblyName UIAutomationClient
  Add-Type -AssemblyName UIAutomationTypes
  Record-Phase 'automation-loaded'

  $root = [Windows.Automation.AutomationElement]::RootElement
  $processCondition = New-Object Windows.Automation.PropertyCondition(
    [Windows.Automation.AutomationElement]::ProcessIdProperty,
    $ProcessId
  )
  $windowNameCondition = New-Object Windows.Automation.PropertyCondition(
    [Windows.Automation.AutomationElement]::NameProperty,
    $WindowTitle
  )
  $windowTypeCondition = New-Object Windows.Automation.PropertyCondition(
    [Windows.Automation.AutomationElement]::ControlTypeProperty,
    [Windows.Automation.ControlType]::Window
  )
  $windowCondition = [Windows.Automation.AndCondition]::new(
    [Windows.Automation.Condition[]]@(
      $processCondition,
      $windowNameCondition,
      $windowTypeCondition
    )
  )
  $nativeProcess = Get-Process -Id $ProcessId -ErrorAction Stop
  $windowHandle = $nativeProcess.MainWindowHandle
  if ($windowHandle -eq [IntPtr]::Zero) {
    throw "exact process $ProcessId has no main window"
  }
  $window = [Windows.Automation.AutomationElement]::FromHandle($windowHandle)
  $windows = @($window | Where-Object {
    $_.Current.ProcessId -eq $ProcessId -and
      $_.Current.Name -ceq $WindowTitle -and
      $_.Current.ControlType -eq [Windows.Automation.ControlType]::Window
  })
  Record-Phase 'window-resolved'
  if ($windows.Count -ne 1) {
    throw "main window for PID $ProcessId did not match exact title '$WindowTitle'"
  }

  $searchRoot = $windows[0]
  $documentDescription = $null
  if ($PSBoundParameters.ContainsKey('DocumentName')) {
    if ([string]::IsNullOrEmpty($DocumentName)) {
      throw 'DocumentName must not be empty when supplied'
    }
    $documentCondition = [Windows.Automation.AndCondition]::new(
      [Windows.Automation.Condition[]]@(
        (New-Object Windows.Automation.PropertyCondition(
          [Windows.Automation.AutomationElement]::ControlTypeProperty,
          [Windows.Automation.ControlType]::Document
        )),
        (New-Object Windows.Automation.PropertyCondition(
          [Windows.Automation.AutomationElement]::AutomationIdProperty,
          'RootWebArea'
        )),
        (New-Object Windows.Automation.PropertyCondition(
          [Windows.Automation.AutomationElement]::NameProperty,
          $DocumentName
        ))
      )
    )
    $documents = @($windows[0].FindAll(
      [Windows.Automation.TreeScope]::Descendants,
      $documentCondition
    ))
    Record-Phase 'document-searched'
    if ($documents.Count -ne 1) {
      throw "expected one exact RootWebArea document named '$DocumentName'; found $($documents.Count)"
    }
    $searchRoot = $documents[0]
    $documentDescription = Element-Description $searchRoot
  }

  $requiredButtonDescription = $null
  if ($PSBoundParameters.ContainsKey('RequiredButtonName')) {
    if ([string]::IsNullOrEmpty($RequiredButtonName)) {
      throw 'RequiredButtonName must not be empty when supplied'
    }
    $requiredButtonCondition = [Windows.Automation.AndCondition]::new(
      [Windows.Automation.Condition[]]@(
        (New-Object Windows.Automation.PropertyCondition(
          [Windows.Automation.AutomationElement]::ControlTypeProperty,
          [Windows.Automation.ControlType]::Button
        )),
        (New-Object Windows.Automation.PropertyCondition(
          [Windows.Automation.AutomationElement]::NameProperty,
          $RequiredButtonName
        ))
      )
    )
    $requiredButtons = @($searchRoot.FindAll(
      [Windows.Automation.TreeScope]::Descendants,
      $requiredButtonCondition
    ))
    Record-Phase 'required-button-searched'
    if ($requiredButtons.Count -ne 1) {
      throw "expected one exact required button '$RequiredButtonName'; found $($requiredButtons.Count)"
    }
    if (-not $requiredButtons[0].Current.IsEnabled -or $requiredButtons[0].Current.IsOffscreen) {
      throw "exact required button '$RequiredButtonName' is not interactable"
    }
    $requiredButtonDescription = Element-Description $requiredButtons[0]
  }

  $expectedControlType = switch ($ControlType) {
    'Button' { [Windows.Automation.ControlType]::Button }
    'Edit' { [Windows.Automation.ControlType]::Edit }
    'Document' { [Windows.Automation.ControlType]::Document }
    'MenuItem' { [Windows.Automation.ControlType]::MenuItem }
  }
  $controlCondition = [Windows.Automation.AndCondition]::new(
    [Windows.Automation.Condition[]]@(
      (New-Object Windows.Automation.PropertyCondition(
        [Windows.Automation.AutomationElement]::NameProperty,
        $ControlName
      )),
      (New-Object Windows.Automation.PropertyCondition(
        [Windows.Automation.AutomationElement]::ControlTypeProperty,
        $expectedControlType
      ))
    )
  )
  $controls = @($searchRoot.FindAll(
    [Windows.Automation.TreeScope]::Descendants,
    $controlCondition
  ))
  Record-Phase 'control-searched'
  if ($controls.Count -ne 1) {
    throw "expected one exact $ControlType control named '$ControlName'; found $($controls.Count)"
  }

  $windowDescription = Element-Description $windows[0]
  $control = $controls[0]
  $description = Element-Description $control
  if ($Action -eq 'invoke') {
    if (-not $control.Current.IsEnabled -or $control.Current.IsOffscreen) {
      throw "exact $ControlType control '$ControlName' is not interactable"
    }
    $pattern = $control.GetCurrentPattern([Windows.Automation.InvokePattern]::Pattern)
    if ($null -eq $pattern) {
      throw "exact $ControlType control '$ControlName' does not support InvokePattern"
    }
    $pattern.Invoke()
  } elseif ($Action -in @('expand', 'select-menu-item')) {
    if (-not $control.Current.IsEnabled -or $control.Current.IsOffscreen) {
      throw "exact $ControlType control '$ControlName' is not interactable"
    }
    $pattern = $control.GetCurrentPattern([Windows.Automation.ExpandCollapsePattern]::Pattern)
    if ($null -eq $pattern) {
      throw "exact $ControlType control '$ControlName' does not support ExpandCollapsePattern"
    }
    if ($pattern.Current.ExpandCollapseState -ne
        [Windows.Automation.ExpandCollapseState]::Expanded) {
      $pattern.Expand()
    }
    $expanded = $false
    for ($attempt = 0; $attempt -lt 20 -and -not $expanded; $attempt += 1) {
      $expanded = $pattern.Current.ExpandCollapseState -eq
        [Windows.Automation.ExpandCollapseState]::Expanded
      if (-not $expanded) {
        Start-Sleep -Milliseconds 50
      }
    }
    if (-not $expanded) {
      throw "exact $ControlType control '$ControlName' did not expand"
    }
    $menuItemCondition = [Windows.Automation.AndCondition]::new(
      [Windows.Automation.Condition[]]@(
        $processCondition,
        (New-Object Windows.Automation.PropertyCondition(
          [Windows.Automation.AutomationElement]::ControlTypeProperty,
          [Windows.Automation.ControlType]::MenuItem
        ))
      )
    )
    $visibleMenuItems = @($root.FindAll(
      [Windows.Automation.TreeScope]::Descendants,
      $menuItemCondition
    ) | Where-Object {
      -not $_.Current.IsOffscreen
    })
    $expandedMenuItems = @($visibleMenuItems | ForEach-Object {
      Element-Description $_
    })
    if ($Action -eq 'select-menu-item') {
      if (-not $PSBoundParameters.ContainsKey('Value') -or [string]::IsNullOrEmpty($Value)) {
        throw 'select-menu-item requires the exact menu item name in Value'
      }
      $menuTargets = @($visibleMenuItems | Where-Object {
        $_.Current.Name -ceq $Value -and $_.Current.IsEnabled
      })
      if ($menuTargets.Count -ne 1) {
        throw "expected one enabled menu item named '$Value'; found $($menuTargets.Count)"
      }
      $menuPattern = $menuTargets[0].GetCurrentPattern([Windows.Automation.InvokePattern]::Pattern)
      if ($null -eq $menuPattern) {
        throw "exact menu item '$Value' does not support InvokePattern"
      }
      $menuPattern.Invoke()
    }
  } elseif ($Action -eq 'set-value') {
    if (-not $PSBoundParameters.ContainsKey('Value')) {
      throw 'set-value requires Value, which may be an empty string'
    }
    if (-not $control.Current.IsEnabled -or $control.Current.IsOffscreen) {
      throw "exact $ControlType control '$ControlName' is not interactable"
    }
    $pattern = $control.GetCurrentPattern([Windows.Automation.ValuePattern]::Pattern)
    if ($null -eq $pattern) {
      throw "exact $ControlType control '$ControlName' does not support ValuePattern"
    }
    if ($pattern.Current.IsReadOnly) {
      throw "exact $ControlType control '$ControlName' is read-only"
    }
    Record-Phase 'setting-value'
    $pattern.SetValue($Value)
    Record-Phase 'value-set'
    $retained = $false
    for ($attempt = 0; $attempt -lt 20 -and -not $retained; $attempt += 1) {
      $actualValue = Control-Text $control
      $retained = $actualValue -ceq $Value
      if (-not $retained) {
        Start-Sleep -Milliseconds 50
      }
    }
    if (-not $retained -and $Value.Length -eq 0) {
      Add-Type -AssemblyName System.Windows.Forms
      try {
        $control.SetFocus()
      } catch {
        Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class TmtkNativeInput {
  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool SetCursorPos(int x, int y);

  [DllImport("user32.dll")]
  public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extraInfo);
}
'@
        $windowHandle = [IntPtr]$windows[0].Current.NativeWindowHandle
        if ($windowHandle -eq [IntPtr]::Zero) {
          throw "exact window '$WindowTitle' has no native window handle"
        }
        [void][TmtkNativeInput]::SetForegroundWindow($windowHandle)
        $bounds = $control.Current.BoundingRectangle
        if ($bounds.IsEmpty -or $bounds.Width -le 0 -or $bounds.Height -le 0) {
          throw "exact $ControlType control '$ControlName' has no clickable bounds"
        }
        $x = [int][Math]::Round($bounds.Left + ($bounds.Width / 2))
        $y = [int][Math]::Round($bounds.Top + ($bounds.Height / 2))
        if (-not [TmtkNativeInput]::SetCursorPos($x, $y)) {
          throw "could not position the pointer over exact $ControlType control '$ControlName'"
        }
        [TmtkNativeInput]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
        [TmtkNativeInput]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
        Start-Sleep -Milliseconds 100
      }
      $focused = [Windows.Automation.AutomationElement]::FocusedElement
      if ($focused.Current.ProcessId -ne $ProcessId -or
          $focused.Current.ControlType -ne $expectedControlType -or
          $focused.Current.Name -cne $ControlName) {
        throw "exact $ControlType control '$ControlName' did not receive keyboard focus"
      }
      [Windows.Forms.SendKeys]::SendWait('^a{BACKSPACE}')
      for ($attempt = 0; $attempt -lt 20 -and -not $retained; $attempt += 1) {
        $actualValue = Control-Text $control
        $retained = $actualValue -ceq $Value
        if (-not $retained) {
          Start-Sleep -Milliseconds 50
        }
      }
    }
    if (-not $retained) {
      throw "exact $ControlType control '$ControlName' did not retain the requested value"
    }
  }
  $currentText = Control-Text $control
  $result = [ordered]@{
    ok = $true
    action = $Action
    window = $windowDescription
    document = $documentDescription
    requiredButton = $requiredButtonDescription
    control = $description
  }
  if ($null -ne $currentText) {
    $result.valueLength = $currentText.Length
    $result.valueSha256 = Text-Sha256 $currentText
  }
  if ($null -ne $expandedMenuItems) {
    $result.menuItems = $expandedMenuItems
  }
} catch {
  $exitCode = 1
  $result = [ordered]@{
    ok = $false
    action = $Action
    error = $_.Exception.Message
  }
}

$result | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $OutputPath -Encoding utf8
exit $exitCode
