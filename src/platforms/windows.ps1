param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Action,

  [Parameter(Position = 1, ValueFromRemainingArguments = $true)]
  [string[]]$ActionArguments
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Result([string]$Value) {
  [Console]::Out.WriteLine($Value)
}

function Show-ChoiceDialog(
  [string]$Message,
  [string]$PrimaryLabel,
  [string]$CancelLabel,
  [string]$PrimaryResult,
  [string]$CancelResult,
  [string]$IconPath
) {
  Add-Type -AssemblyName PresentationFramework
  Add-Type -AssemblyName PresentationCore

  $window = New-Object System.Windows.Window
  $window.Title = "The Mechanic's Toolkit"
  $window.Width = 560
  $window.SizeToContent = "Height"
  $window.WindowStartupLocation = "CenterScreen"
  $window.ResizeMode = "NoResize"
  $window.ShowInTaskbar = $true
  $window.Topmost = $true

  $root = New-Object System.Windows.Controls.StackPanel
  $root.Margin = "24"

  $body = New-Object System.Windows.Controls.DockPanel
  $body.Margin = "0,0,0,24"

  if ($IconPath -and (Test-Path -LiteralPath $IconPath -PathType Leaf)) {
    $icon = [System.Windows.Media.Imaging.BitmapFrame]::Create([Uri]$IconPath)
    $window.Icon = $icon
    $image = New-Object System.Windows.Controls.Image
    $image.Source = $icon
    $image.Width = 64
    $image.Height = 64
    $image.Margin = "0,0,18,0"
    $image.VerticalAlignment = "Top"
    [System.Windows.Controls.DockPanel]::SetDock($image, "Left")
    $null = $body.Children.Add($image)
  }

  $text = New-Object System.Windows.Controls.TextBlock
  $text.Text = $Message
  $text.FontSize = 15
  $text.LineHeight = 22
  $text.TextWrapping = "Wrap"
  $null = $body.Children.Add($text)
  $null = $root.Children.Add($body)

  $buttons = New-Object System.Windows.Controls.StackPanel
  $buttons.Orientation = "Horizontal"
  $buttons.HorizontalAlignment = "Right"

  $cancel = New-Object System.Windows.Controls.Button
  $cancel.Content = $CancelLabel
  $cancel.MinWidth = 120
  $cancel.Padding = "14,7"
  $cancel.Margin = "0,0,10,0"
  $cancel.IsCancel = $true

  $primary = New-Object System.Windows.Controls.Button
  $primary.Content = $PrimaryLabel
  $primary.MinWidth = 120
  $primary.Padding = "14,7"
  $primary.IsDefault = $true

  $script:dialogWindow = $window
  $script:dialogPrimaryResult = $PrimaryResult
  $script:dialogCancelResult = $CancelResult
  $script:dialogResult = $script:dialogCancelResult
  $cancel.Add_Click({
    $script:dialogResult = $script:dialogCancelResult
    $script:dialogWindow.Close()
  })
  $primary.Add_Click({
    $script:dialogResult = $script:dialogPrimaryResult
    $script:dialogWindow.Close()
  })
  $null = $buttons.Children.Add($cancel)
  $null = $buttons.Children.Add($primary)
  $null = $root.Children.Add($buttons)
  $window.Content = $root
  $null = $window.ShowDialog()
  Write-Result $script:dialogResult
}

function Require-Arguments([int]$Count) {
  $supplied = @($ActionArguments | Where-Object { $null -ne $_ -and $_ -ne '' })
  if ($supplied.Count -ne $Count) {
    throw "$Action requires exactly $Count argument(s)"
  }
}

function ConvertTo-PowerShellLiteral([string]$Value) {
  return "'" + $Value.Replace("'", "''") + "'"
}

function Get-RescueCloseTaskName([string]$CompletionFile) {
  $completionName = Split-Path -Leaf ([IO.Path]::GetFullPath($CompletionFile))
  if ($completionName -notmatch
      '^return-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-terminal-closed$') {
    throw "rescue closure received an invalid completion marker"
  }
  return "TMTK-RescueClose-$($Matches[1])"
}

function Start-IndependentTask([string]$TaskName, [string]$TaskScript) {
  if ($TaskName -notmatch '^TMTK-[0-9A-Za-z-]+$') {
    throw "independent task name contains unsupported characters"
  }
  $existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  if ($null -ne $existingTask) {
    if ($existingTask.State -eq 'Running') {
      throw "independent task is already running: $TaskName"
    }
  }
  $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($TaskScript))
  $taskArguments = @(
    '-NoLogo', '-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden',
    '-ExecutionPolicy', 'Bypass', '-EncodedCommand', $encoded
  ) -join ' '
  $taskAction = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $taskArguments
  $identityName = [Security.Principal.WindowsIdentity]::GetCurrent().Name
  if ([String]::IsNullOrWhiteSpace($identityName)) {
    throw "could not resolve the current Windows identity"
  }
  $principal = New-ScheduledTaskPrincipal -UserId $identityName `
    -LogonType Interactive -RunLevel Limited
  try {
    Register-ScheduledTask -TaskName $TaskName -Action $taskAction -Principal $principal -Force |
      Out-Null
    Start-ScheduledTask -TaskName $TaskName
    $running = $false
    for ($attempt = 0; $attempt -lt 100 -and -not $running; $attempt += 1) {
      Start-Sleep -Milliseconds 50
      $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
      $running = $null -ne $task -and $task.State -eq 'Running'
    }
    if (-not $running) { throw "independent task did not start: $TaskName" }
  } catch {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    throw
  }
}

function Get-ExactProcesses([string]$Executable) {
  $expected = [IO.Path]::GetFullPath($Executable)
  $name = [IO.Path]::GetFileName($expected).Replace("'", "''")
  $processes = @(Get-CimInstance Win32_Process -Filter "Name = '$name'")
  return @($processes | Where-Object {
    $_.ExecutablePath -and
      [String]::Equals([IO.Path]::GetFullPath($_.ExecutablePath), $expected,
        [StringComparison]::OrdinalIgnoreCase)
  })
}

function Get-Sha256([string]$File) {
  $stream = [IO.File]::OpenRead($File)
  $algorithm = [Security.Cryptography.SHA256]::Create()
  try {
    return ([BitConverter]::ToString($algorithm.ComputeHash($stream))).Replace('-', '')
  } finally {
    $algorithm.Dispose()
    $stream.Dispose()
  }
}

function Test-SameFile([string]$Left, [string]$Right, [string]$ExpectedHash) {
  $leftItem = Get-Item -LiteralPath $Left
  $rightItem = Get-Item -LiteralPath $Right
  if ($leftItem.Length -ne $rightItem.Length) { return $false }
  return (Get-Sha256 $Left) -eq $ExpectedHash
}

function Test-CachedCliPath([string]$Candidate, [string]$CacheRoot) {
  if ([IO.Path]::GetFileName($Candidate) -ine 'codex.exe') { return $false }
  $versionDirectory = Split-Path -Parent $Candidate
  $candidateRoot = Split-Path -Parent $versionDirectory
  return [String]::Equals($candidateRoot, $CacheRoot, [StringComparison]::OrdinalIgnoreCase) -and
    (Split-Path -Leaf $versionDirectory) -match '^[0-9a-f]{16}$'
}

function Get-ExactPackage([string]$ApplicationRoot) {
  $installLocation = [IO.Path]::GetFullPath($ApplicationRoot).TrimEnd('\')
  $packageFullName = Split-Path -Leaf $installLocation
  $match = [regex]::Match($packageFullName,
    '^OpenAI\.Codex_\d+(?:\.\d+){3}_(?:x64|x86|arm64|neutral)_[^_]*_2p2nqsd0c76g0$',
    [Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if (-not $match.Success) { throw "application directory has no exact OpenAI Codex MSIX identity" }
  $packages = @(Get-AppxPackage -Name 'OpenAI.Codex' | Where-Object {
    $_.PackageFullName -eq $packageFullName -and $_.InstallLocation -and
      [String]::Equals([IO.Path]::GetFullPath($_.InstallLocation).TrimEnd('\'), $installLocation,
        [StringComparison]::OrdinalIgnoreCase) -and
      [String]::Equals($_.PackageFamilyName, 'OpenAI.Codex_2p2nqsd0c76g0',
        [StringComparison]::OrdinalIgnoreCase)
  })
  if ($packages.Count -ne 1) { throw "exact installed MSIX package was not found" }
  return $packages[0]
}

function Get-ExactApplicationId($Package, [string]$Executable) {
  $manifestPath = Join-Path $Package.InstallLocation 'AppxManifest.xml'
  [xml]$manifest = Get-Content -LiteralPath $manifestPath
  $applications = @($manifest.Package.Applications.Application | Where-Object {
    $relativeExecutable = ([string]$_.Executable).Replace('/', '\')
    $manifestExecutable = [IO.Path]::GetFullPath((Join-Path $Package.InstallLocation $relativeExecutable))
    [String]::Equals($manifestExecutable, [IO.Path]::GetFullPath($Executable),
      [StringComparison]::OrdinalIgnoreCase) -and
      [String]::Equals([string]$_.EntryPoint, 'Windows.FullTrustApplication',
        [StringComparison]::OrdinalIgnoreCase)
  })
  if ($applications.Count -ne 1 -or -not $applications[0].Id) {
    throw "exact full-trust MSIX application identity was not found"
  }
  return "$($Package.PackageFamilyName)!$($applications[0].Id)"
}

function Get-ExactArchiveEntry($Archive, [string]$Name) {
  $matches = @($Archive.Entries | Where-Object {
    [String]::Equals($_.FullName.Replace('\', '/'), $Name,
      [StringComparison]::Ordinal)
  })
  if ($matches.Count -ne 1) { throw "MSIX archive has no unique $Name entry" }
  return $matches[0]
}

function Copy-ArchiveEntry($Entry, [string]$Destination) {
  if (Test-Path -LiteralPath $Destination) { throw "MSIX extraction destination already exists" }
  $parent = Split-Path -Parent $Destination
  if ($parent) { $null = New-Item -ItemType Directory -Path $parent -Force }
  $inputStream = $Entry.Open()
  $outputStream = New-Object IO.FileStream(
    $Destination,
    [IO.FileMode]::CreateNew,
    [IO.FileAccess]::Write,
    [IO.FileShare]::None
  )
  try {
    $inputStream.CopyTo($outputStream)
  } finally {
    $outputStream.Dispose()
    $inputStream.Dispose()
  }
}

function Initialize-ApplicationActivator {
  Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

[ComImport]
[Guid("2E941141-7F97-4756-BA1D-9DECDE894A3D")]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface ITmtkApplicationActivationManager {
  [PreserveSig]
  int ActivateApplication(
    [MarshalAs(UnmanagedType.LPWStr)] string appUserModelId,
    [MarshalAs(UnmanagedType.LPWStr)] string arguments,
    uint options,
    out uint processId);
}

public static class TmtkApplicationActivation {
  [DllImport("ole32.dll")]
  private static extern int CoCreateInstance(
    ref Guid classId,
    IntPtr outer,
    uint context,
    ref Guid interfaceId,
    out IntPtr instance);

  public static uint Activate(string appUserModelId, string arguments) {
    Guid classId = new Guid("45BA127D-10A8-46EA-8AB7-56EA9078943C");
    Guid interfaceId = new Guid("2E941141-7F97-4756-BA1D-9DECDE894A3D");
    IntPtr instance;
    int result = CoCreateInstance(ref classId, IntPtr.Zero, 1, ref interfaceId, out instance);
    Marshal.ThrowExceptionForHR(result);
    ITmtkApplicationActivationManager manager = null;
    try {
      manager = (ITmtkApplicationActivationManager)Marshal.GetObjectForIUnknown(instance);
      uint processId;
      result = manager.ActivateApplication(appUserModelId, arguments, 0, out processId);
      Marshal.ThrowExceptionForHR(result);
      return processId;
    } finally {
      Marshal.Release(instance);
      if (manager != null) Marshal.ReleaseComObject(manager);
    }
  }
}
"@
}

function Initialize-PackageTerminator {
  Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

[ComImport]
[Guid("F27C3930-8029-4AD1-94E3-3DBA417810C1")]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface ITmtkPackageDebugSettings {
  [PreserveSig]
  int EnableDebugging(
    [MarshalAs(UnmanagedType.LPWStr)] string packageFullName,
    [MarshalAs(UnmanagedType.LPWStr)] string debuggerCommandLine,
    [MarshalAs(UnmanagedType.LPWStr)] string environment);
  [PreserveSig]
  int DisableDebugging([MarshalAs(UnmanagedType.LPWStr)] string packageFullName);
  [PreserveSig]
  int Suspend([MarshalAs(UnmanagedType.LPWStr)] string packageFullName);
  [PreserveSig]
  int Resume([MarshalAs(UnmanagedType.LPWStr)] string packageFullName);
  [PreserveSig]
  int TerminateAllProcesses([MarshalAs(UnmanagedType.LPWStr)] string packageFullName);
}

public static class TmtkPackageTermination {
  [DllImport("ole32.dll")]
  private static extern int CoCreateInstance(
    ref Guid classId,
    IntPtr outer,
    uint context,
    ref Guid interfaceId,
    out IntPtr instance);

  public static void Terminate(string packageFullName) {
    Guid classId = new Guid("B1AEC16F-2383-4852-B0E9-8F0B1DC66B4D");
    Guid interfaceId = new Guid("F27C3930-8029-4AD1-94E3-3DBA417810C1");
    IntPtr instance;
    int result = CoCreateInstance(ref classId, IntPtr.Zero, 1, ref interfaceId, out instance);
    Marshal.ThrowExceptionForHR(result);
    ITmtkPackageDebugSettings settings = null;
    try {
      settings = (ITmtkPackageDebugSettings)Marshal.GetObjectForIUnknown(instance);
      result = settings.TerminateAllProcesses(packageFullName);
      Marshal.ThrowExceptionForHR(result);
    } finally {
      Marshal.Release(instance);
      if (settings != null) Marshal.ReleaseComObject(settings);
    }
  }
}
"@
}

function Initialize-PeResourceReader {
  Add-Type -TypeDefinition @"
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;

public static class TmtkPeResource {
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  private static extern IntPtr LoadLibraryEx(string fileName, IntPtr file, uint flags);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  private static extern IntPtr FindResource(IntPtr module, string name, string type);
  [DllImport("kernel32.dll", SetLastError = true)]
  private static extern IntPtr LoadResource(IntPtr module, IntPtr resource);
  [DllImport("kernel32.dll", SetLastError = true)]
  private static extern IntPtr LockResource(IntPtr resource);
  [DllImport("kernel32.dll", SetLastError = true)]
  private static extern uint SizeofResource(IntPtr module, IntPtr resource);
  [DllImport("kernel32.dll", SetLastError = true)]
  private static extern bool FreeLibrary(IntPtr module);

  public static string ReadUtf8(string executable, string type, string name) {
    IntPtr module = LoadLibraryEx(executable, IntPtr.Zero, 0x00000002);
    if (module == IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
    try {
      IntPtr resource = FindResource(module, name, type);
      if (resource == IntPtr.Zero) return null;
      uint size = SizeofResource(module, resource);
      IntPtr loaded = LoadResource(module, resource);
      IntPtr bytes = LockResource(loaded);
      if (size == 0 || loaded == IntPtr.Zero || bytes == IntPtr.Zero) {
        throw new Win32Exception(Marshal.GetLastWin32Error());
      }
      byte[] value = new byte[size];
      Marshal.Copy(bytes, value, 0, checked((int)size));
      return Encoding.UTF8.GetString(value).TrimEnd('\0');
    } finally {
      FreeLibrary(module);
    }
  }
}
"@
}

switch ($Action) {
  "confirm-restart" {
    if ($ActionArguments.Count -gt 1) { throw "confirm-restart accepts at most one icon path" }
    $iconPath = if ($ActionArguments.Count -eq 1) { $ActionArguments[0] } else { $null }
    Show-ChoiceDialog `
      "Codex restart is armed.`r`n`r`nWait for all active agents to reach a safe stopping point, then click Relaunch Codex." `
      "Relaunch Codex" "Don't Restart" "restart" "cancel" $iconPath
  }
  "confirm-repair" {
    if ($ActionArguments.Count -gt 1) { throw "confirm-repair accepts at most one icon path" }
    $iconPath = if ($ActionArguments.Count -eq 1) { $ActionArguments[0] } else { $null }
    Show-ChoiceDialog `
      "Codex could not be repaired after three attempts.`r`n`r`nRestore the last known-working version, or open a terminal line to continue troubleshooting with the agent." `
      "Restore Known-Working" "Open Terminal Line with Agent" "restore" "interactive" $iconPath
  }
  "confirm-handoff" {
    if ($ActionArguments.Count -gt 1) { throw "confirm-handoff accepts at most one icon path" }
    $iconPath = if ($ActionArguments.Count -eq 1) { $ActionArguments[0] } else { $null }
    Show-ChoiceDialog `
      "Codex closed, but the agent task that armed this restart is still active.`r`n`r`nClose its existing terminal or session, then click Continue." `
      "Continue" "Don't Relaunch" "continue" "cancel" $iconPath
  }
  "is-running" {
    Require-Arguments 1
    Write-Result $(if (@(Get-ExactProcesses $ActionArguments[0]).Count -gt 0) {"true"} else {"false"})
  }
  "is-process" {
    Require-Arguments 2
    $expected = [IO.Path]::GetFullPath($ActionArguments[0])
    $pidValue = 0
    if (-not [int]::TryParse($ActionArguments[1], [ref]$pidValue) -or $pidValue -le 0) {
      throw "is-process requires a valid PID"
    }
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $pidValue"
    $matches = $null -ne $process -and $process.ExecutablePath -and
      [String]::Equals([IO.Path]::GetFullPath($process.ExecutablePath), $expected,
        [StringComparison]::OrdinalIgnoreCase)
    Write-Result $(if ($matches) {"true"} else {"false"})
  }
  "ancestor" {
    Require-Arguments 2
    $expected = [IO.Path]::GetFullPath($ActionArguments[0])
    $pidValue = 0
    if (-not [int]::TryParse($ActionArguments[1], [ref]$pidValue) -or $pidValue -le 0) {
      throw "ancestor requires a valid starting PID"
    }
    $visited = @{}
    for ($depth = 0; $depth -lt 32 -and $pidValue -gt 0 -and -not $visited.ContainsKey($pidValue); $depth += 1) {
      $visited[$pidValue] = $true
      $process = Get-CimInstance Win32_Process -Filter "ProcessId = $pidValue"
      if ($null -eq $process) { break }
      if ($process.ExecutablePath -and
          [String]::Equals([IO.Path]::GetFullPath($process.ExecutablePath), $expected,
            [StringComparison]::OrdinalIgnoreCase)) {
        Write-Result ([string]$pidValue)
        exit 0
      }
      $pidValue = [int]$process.ParentProcessId
    }
    Write-Result ""
  }
  "resolve-cli" {
    Require-Arguments 2
    $packaged = [IO.Path]::GetFullPath($ActionArguments[0])
    $expectedHash = Get-Sha256 $packaged
    $cacheRoot = Join-Path $env:LOCALAPPDATA 'OpenAI\Codex\bin'
    $pidValue = 0
    if (-not [int]::TryParse($ActionArguments[1], [ref]$pidValue) -or $pidValue -le 0) {
      throw "resolve-cli requires a valid starting PID"
    }
    $visited = @{}
    for ($depth = 0; $depth -lt 32 -and $pidValue -gt 0 -and -not $visited.ContainsKey($pidValue); $depth += 1) {
      $visited[$pidValue] = $true
      $process = Get-CimInstance Win32_Process -Filter "ProcessId = $pidValue"
      if ($null -eq $process) { break }
      if ($process.ExecutablePath) {
        $observed = [IO.Path]::GetFullPath($process.ExecutablePath)
        if ([String]::Equals($observed, $packaged, [StringComparison]::OrdinalIgnoreCase) -or
            ((Test-CachedCliPath $observed $cacheRoot) -and
              (Test-SameFile $observed $packaged $expectedHash))) {
          Write-Result $observed
          exit 0
        }
      }
      $pidValue = [int]$process.ParentProcessId
    }
    $matches = @()
    if (Test-Path -LiteralPath $cacheRoot -PathType Container) {
      $matches = @(Get-ChildItem -LiteralPath $cacheRoot -Directory | Where-Object {
        $_.Name -match '^[0-9a-f]{16}$'
      } | ForEach-Object {
        $candidate = Join-Path $_.FullName 'codex.exe'
        if ((Test-Path -LiteralPath $candidate -PathType Leaf) -and
            (Test-SameFile $candidate $packaged $expectedHash)) { $candidate }
      })
    }
    if ($matches.Count -ne 1) {
      throw "could not identify one exact runnable cached Codex CLI"
    }
    Write-Result $matches[0]
  }
  "request-quit" {
    Require-Arguments 1
    $processes = @(Get-ExactProcesses $ActionArguments[0])
    if ($processes.Count -eq 0) {
      Write-Result "true"
      exit 0
    }
    Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class TmtkWindows {
  private delegate bool EnumWindowsProc(IntPtr window, IntPtr parameter);
  [DllImport("user32.dll")]
  private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr parameter);
  [DllImport("user32.dll")]
  private static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
  [DllImport("user32.dll", SetLastError = true)]
  private static extern bool PostMessage(IntPtr window, uint message, IntPtr wParam, IntPtr lParam);
  public static bool RequestClose(int expectedProcessId) {
    bool sent = false;
    EnumWindows(delegate(IntPtr window, IntPtr parameter) {
      uint processId;
      GetWindowThreadProcessId(window, out processId);
      if (processId == expectedProcessId && PostMessage(window, 0x0010, IntPtr.Zero, IntPtr.Zero)) {
        sent = true;
      }
      return true;
    }, IntPtr.Zero);
    return sent;
  }
}
"@
    $sent = $false
    foreach ($process in $processes | Where-Object { $_.CommandLine -notmatch '(?:^|\s)--type=' }) {
      if ([TmtkWindows]::RequestClose([int]$process.ProcessId)) { $sent = $true }
    }
    if ($sent) {
      $deadline = [DateTime]::UtcNow.AddSeconds(5)
      do {
        Start-Sleep -Milliseconds 100
        $processes = @(Get-ExactProcesses $ActionArguments[0])
      } while ($processes.Count -gt 0 -and [DateTime]::UtcNow -lt $deadline)
    }
    if ($processes.Count -gt 0) {
      $applicationRoot = Split-Path -Parent (Split-Path -Parent $ActionArguments[0])
      $package = Get-ExactPackage $applicationRoot
      Initialize-PackageTerminator
      [TmtkPackageTermination]::Terminate($package.PackageFullName)
    }
    Write-Result "true"
  }
  "inspect-package" {
    Require-Arguments 2
    $package = Get-ExactPackage $ActionArguments[0]
    $applicationId = Get-ExactApplicationId $package $ActionArguments[1]
    $signature = Get-AuthenticodeSignature -FilePath $ActionArguments[1]
    $identity = [ordered]@{
      name = $package.Name
      publisher = $package.Publisher
      packageFullName = $package.PackageFullName
      packageFamilyName = $package.PackageFamilyName
      installLocation = $package.InstallLocation
      version = $package.Version.ToString()
      architecture = $package.Architecture.ToString()
      status = $package.Status.ToString()
      signatureKind = $package.SignatureKind.ToString()
      executableSignature = $signature.Status.ToString()
      applicationId = $applicationId
    }
    Write-Result ($identity | ConvertTo-Json -Compress)
  }
  "inspect-msix" {
    Require-Arguments 3
    $packagePath = [IO.Path]::GetFullPath($ActionArguments[0])
    $asarDestination = [IO.Path]::GetFullPath($ActionArguments[1])
    $executableDestination = [IO.Path]::GetFullPath($ActionArguments[2])
    $packageSignature = Get-AuthenticodeSignature -FilePath $packagePath
    if ($null -eq $packageSignature.SignerCertificate) {
      throw "MSIX archive has no signing certificate"
    }
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::OpenRead($packagePath)
    try {
      $manifestEntry = Get-ExactArchiveEntry $archive 'AppxManifest.xml'
      $reader = New-Object IO.StreamReader($manifestEntry.Open())
      try { [xml]$manifest = $reader.ReadToEnd() } finally { $reader.Dispose() }
      $identity = $manifest.Package.Identity
      $applications = @($manifest.Package.Applications.Application | Where-Object {
        [String]::Equals(([string]$_.Executable).Replace('/', '\'), 'app\ChatGPT.exe',
          [StringComparison]::OrdinalIgnoreCase) -and
          [String]::Equals([string]$_.EntryPoint, 'Windows.FullTrustApplication',
            [StringComparison]::OrdinalIgnoreCase) -and
          [String]::Equals([string]$_.Id, 'App', [StringComparison]::Ordinal)
      })
      if ($applications.Count -ne 1) {
        throw "MSIX manifest has no unique exact Codex full-trust application"
      }
      Copy-ArchiveEntry (Get-ExactArchiveEntry $archive 'app/resources/app.asar') $asarDestination
      Copy-ArchiveEntry (Get-ExactArchiveEntry $archive 'app/ChatGPT.exe') $executableDestination
    } finally {
      $archive.Dispose()
    }
    $executableSignature = Get-AuthenticodeSignature -FilePath $executableDestination
    $result = [ordered]@{
      name = $identity.GetAttribute('Name')
      publisher = $identity.GetAttribute('Publisher')
      version = $identity.GetAttribute('Version')
      architecture = $identity.GetAttribute('ProcessorArchitecture')
      resourceId = $identity.GetAttribute('ResourceId')
      applicationId = 'OpenAI.Codex_2p2nqsd0c76g0!App'
      signature = $packageSignature.Status.ToString()
      signerSubject = $packageSignature.SignerCertificate.Subject
      executableSignature = $executableSignature.Status.ToString()
      asarSha256 = (Get-Sha256 $asarDestination).ToLowerInvariant()
    }
    Write-Result ($result | ConvertTo-Json -Compress)
  }
  "install-msix" {
    Require-Arguments 2
    $packagePath = [IO.Path]::GetFullPath($ActionArguments[0])
    $expectedFullName = $ActionArguments[1]
    Add-AppxPackage -Path $packagePath -ForceApplicationShutdown
    $packages = @(Get-AppxPackage -Name 'OpenAI.Codex' | Where-Object {
      $_.PackageFullName -ceq $expectedFullName -and
        $_.PackageFamilyName -ceq 'OpenAI.Codex_2p2nqsd0c76g0' -and
        $_.InstallLocation
    })
    if ($packages.Count -ne 1) { throw "installed MSIX did not produce the exact expected package" }
    $package = $packages[0]
    Write-Result ([ordered]@{
      packageFullName = $package.PackageFullName
      packageFamilyName = $package.PackageFamilyName
      installLocation = $package.InstallLocation
      status = $package.Status.ToString()
      signatureKind = $package.SignatureKind.ToString()
    } | ConvertTo-Json -Compress)
  }
  "inspect-asar-integrity" {
    Require-Arguments 1
    Initialize-PeResourceReader
    $resource = [TmtkPeResource]::ReadUtf8($ActionArguments[0], 'Integrity', 'ElectronAsar')
    $result = if ($null -eq $resource) {
      [ordered]@{state = 'not-present'}
    } else {
      [ordered]@{state = 'present'; resource = $resource}
    }
    Write-Result ($result | ConvertTo-Json -Compress)
  }
  "launch-supervisor" {
    Require-Arguments 4
    $nodeExecutable = [IO.Path]::GetFullPath($ActionArguments[0])
    $supervisorScript = [IO.Path]::GetFullPath($ActionArguments[1])
    $stateFile = [IO.Path]::GetFullPath($ActionArguments[2])
    $logFile = [IO.Path]::GetFullPath($ActionArguments[3])
    foreach ($requiredFile in @($nodeExecutable, $supervisorScript, $stateFile)) {
      if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
        throw "supervisor launch input does not exist: $requiredFile"
      }
    }
    $incidentDirectory = Split-Path -Parent $stateFile
    if (-not [String]::Equals((Split-Path -Parent $logFile), $incidentDirectory,
        [StringComparison]::OrdinalIgnoreCase) -or
        -not [String]::Equals((Split-Path -Leaf $stateFile), 'state.json',
          [StringComparison]::OrdinalIgnoreCase) -or
        -not [String]::Equals((Split-Path -Leaf $logFile), 'supervisor.log',
          [StringComparison]::OrdinalIgnoreCase)) {
      throw "supervisor state and log must be the exact files in one incident directory"
    }
    $incidentToken = Split-Path -Leaf $incidentDirectory
    if ($incidentToken -notmatch '^[0-9A-Za-z-]+$') {
      throw "supervisor incident token contains unsupported characters"
    }
    $taskName = 'TMTK-Supervisor'
    $nodeLiteral = ConvertTo-PowerShellLiteral $nodeExecutable
    $scriptLiteral = ConvertTo-PowerShellLiteral $supervisorScript
    $stateLiteral = ConvertTo-PowerShellLiteral $stateFile
    $logLiteral = ConvertTo-PowerShellLiteral $logFile
    $taskLiteral = ConvertTo-PowerShellLiteral $taskName
    $taskScript = @"
`$exitCode = 1
try {
  & $nodeLiteral $scriptLiteral 'supervise' $stateLiteral >> $logLiteral 2>&1
  `$exitCode = `$LASTEXITCODE
} finally {
  Unregister-ScheduledTask -TaskName $taskLiteral -Confirm:`$false -ErrorAction SilentlyContinue
}
exit `$exitCode
"@
    Start-IndependentTask $taskName $taskScript
    Write-Result "armed:$taskName"
  }
  "launch-app" {
    Require-Arguments 4
    if ($ActionArguments[2] -notmatch '^--tmtk-safe-start-marker=[A-Za-z0-9_-]+$') {
      throw "launch-app received an invalid readiness marker argument"
    }
    if ($ActionArguments[3] -notmatch '^codex://threads/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') {
      throw "launch-app received an invalid task deep link"
    }
    Initialize-ApplicationActivator
    $package = Get-ExactPackage $ActionArguments[0]
    $applicationId = Get-ExactApplicationId $package $ActionArguments[1]
    $launchArguments = $ActionArguments[2] + ' ' + $ActionArguments[3]
    $activatedPid = [TmtkApplicationActivation]::Activate($applicationId, $launchArguments)
    $deadline = [DateTime]::UtcNow.AddSeconds(10)
    $activated = $null
    while ($null -eq $activated -and [DateTime]::UtcNow -lt $deadline) {
      $activated = Get-CimInstance Win32_Process -Filter "ProcessId = $activatedPid"
      if ($null -eq $activated) { Start-Sleep -Milliseconds 100 }
    }
    if ($null -eq $activated -or -not $activated.ExecutablePath -or
        -not [String]::Equals([IO.Path]::GetFullPath($activated.ExecutablePath),
          [IO.Path]::GetFullPath($ActionArguments[1]), [StringComparison]::OrdinalIgnoreCase)) {
      throw "MSIX activation did not return the exact Codex Desktop process"
    }
    Write-Result "activated:$activatedPid"
  }
  "open-rescue" {
    Require-Arguments 2
    if ($ActionArguments[1].Contains('"')) { throw "rescue command path contains an invalid quote" }
    $quotedCommand = '"' + $ActionArguments[1] + '"'
    $process = Start-Process -FilePath $ActionArguments[0] -ArgumentList $quotedCommand -PassThru
    Write-Result "opened:$($process.Id)"
  }
  "close-rescue" {
    Require-Arguments 2
    $terminalPid = 0
    if (-not [int]::TryParse($ActionArguments[0], [ref]$terminalPid) -or $terminalPid -le 0) {
      throw "close-rescue requires a valid terminal PID"
    }
    try { Wait-Process -Id $terminalPid -Timeout 30 -ErrorAction Stop } catch {
      if (Get-Process -Id $terminalPid -ErrorAction SilentlyContinue) { throw }
    }
    $parent = Split-Path -Parent $ActionArguments[1]
    if ($parent) { $null = New-Item -ItemType Directory -Path $parent -Force }
    $null = New-Item -ItemType File -Path $ActionArguments[1] -Force
    Write-Result "closed"
  }
  "schedule-close-rescue" {
    Require-Arguments 2
    $terminalPid = 0
    if (-not [int]::TryParse($ActionArguments[0], [ref]$terminalPid) -or $terminalPid -le 0) {
      throw "schedule-close-rescue requires a valid terminal PID"
    }
    $completionFile = [IO.Path]::GetFullPath($ActionArguments[1])
    $taskName = Get-RescueCloseTaskName $completionFile
    $helperLiteral = ConvertTo-PowerShellLiteral $PSCommandPath
    $completionLiteral = ConvertTo-PowerShellLiteral $completionFile
    $taskScript = @"
& $helperLiteral 'close-rescue' '$terminalPid' $completionLiteral
exit `$LASTEXITCODE
"@
    Start-IndependentTask $taskName $taskScript
    Write-Result "scheduled:$taskName"
  }
  "finish-close-rescue" {
    Require-Arguments 1
    $taskName = Get-RescueCloseTaskName $ActionArguments[0]
    $deadline = [DateTime]::UtcNow.AddSeconds(5)
    do {
      $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
      if ($null -eq $task -or $task.State -ne 'Running') { break }
      Start-Sleep -Milliseconds 100
    } while ([DateTime]::UtcNow -lt $deadline)
    if ($null -eq $task) {
      Write-Result 'absent'
      exit 0
    }
    if ($task.State -eq 'Running') {
      throw "rescue closure task remained active: $taskName"
    }
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
      throw "rescue closure task remained registered: $taskName"
    }
    Write-Result 'removed'
  }
  default {
    throw "unknown Windows helper action: $Action"
  }
}
