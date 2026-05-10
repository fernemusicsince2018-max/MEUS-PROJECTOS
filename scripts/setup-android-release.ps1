$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $repoRoot

function Find-JavaHome {
  $candidateHomes = New-Object System.Collections.Generic.List[string]

  foreach ($envName in @('JAVA_HOME', 'JDK_HOME', 'ANDROID_STUDIO_JDK')) {
    $value = [Environment]::GetEnvironmentVariable($envName)
    if (-not [string]::IsNullOrWhiteSpace($value)) {
      $candidateHomes.Add($value)
    }
  }

  foreach ($root in @($env:ProgramFiles, ${env:ProgramFiles(x86)})) {
    if ([string]::IsNullOrWhiteSpace($root)) { continue }

    foreach ($candidate in @(
      (Join-Path $root 'Android\Android Studio\jbr'),
      (Join-Path $root 'Android\Android Studio\jre'),
      (Join-Path $root 'Android\openjdk')
    )) {
      if (Test-Path (Join-Path $candidate 'bin\java.exe')) {
        $candidateHomes.Add($candidate)
      }

      if (Test-Path $candidate) {
        Get-ChildItem $candidate -Directory -ErrorAction SilentlyContinue | ForEach-Object {
          $nested = $_.FullName
          if (Test-Path (Join-Path $nested 'bin\java.exe')) {
            $candidateHomes.Add($nested)
          }
        }
      }
    }
  }

  foreach ($candidateHome in $candidateHomes) {
    if (Test-Path (Join-Path $candidateHome 'bin\java.exe')) {
      return $candidateHome
    }
  }

  return $null
}

function ConvertTo-PlainText([Security.SecureString]$SecureValue) {
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  } finally {
    if ($pointer -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
  }
}

$javaHome = Find-JavaHome
if (-not $javaHome) {
  throw "Nao encontrei um JDK valido. Configura JAVA_HOME e volta a correr este script."
}

$keytoolPath = Join-Path $javaHome 'bin\keytool.exe'
if (-not (Test-Path $keytoolPath)) {
  throw "Nao encontrei keytool.exe em $javaHome"
}

$defaultStoreFile = 'android/app/kastrozapp-upload.jks'
$defaultAlias = 'kastrozapp-upload'
$defaultVersionCode = '1'
$defaultVersionName = '1.0.0'
$defaultDname = 'CN=KASTROZAPP Upload, OU=Mobile, O=KASTROZAPP, L=Lagos, S=Lagos, C=NG'

Write-Host "JDK detetado: $javaHome"
Write-Host "Este helper vai criar a keystore de upload e escrever android/keystore.properties."

$storeFileInput = Read-Host "Caminho da keystore [$defaultStoreFile]"
$storeFile = if ([string]::IsNullOrWhiteSpace($storeFileInput)) { $defaultStoreFile } else { $storeFileInput.Trim() }
$aliasInput = Read-Host "Alias da key [$defaultAlias]"
$alias = if ([string]::IsNullOrWhiteSpace($aliasInput)) { $defaultAlias } else { $aliasInput.Trim() }
$versionCodeInput = Read-Host "ANDROID_VERSION_CODE [$defaultVersionCode]"
$versionCode = if ([string]::IsNullOrWhiteSpace($versionCodeInput)) { $defaultVersionCode } else { $versionCodeInput.Trim() }
$versionNameInput = Read-Host "ANDROID_VERSION_NAME [$defaultVersionName]"
$versionName = if ([string]::IsNullOrWhiteSpace($versionNameInput)) { $defaultVersionName } else { $versionNameInput.Trim() }
$dnameInput = Read-Host "Distinguished name do certificado [$defaultDname]"
$dname = if ([string]::IsNullOrWhiteSpace($dnameInput)) { $defaultDname } else { $dnameInput.Trim() }

$storePasswordSecure = Read-Host 'Password da keystore' -AsSecureString
$keyPasswordSecure = Read-Host 'Password da key (Enter para reutilizar a da keystore)' -AsSecureString
$storePassword = ConvertTo-PlainText $storePasswordSecure
$keyPassword = ConvertTo-PlainText $keyPasswordSecure

if ([string]::IsNullOrWhiteSpace($storePassword)) {
  throw 'A password da keystore nao pode ficar vazia.'
}

if ([string]::IsNullOrWhiteSpace($keyPassword)) {
  $keyPassword = $storePassword
}

$absoluteStoreFile = if ([System.IO.Path]::IsPathRooted($storeFile)) {
  $storeFile
} else {
  Join-Path $repoRoot $storeFile
}

if (Test-Path $absoluteStoreFile) {
  throw "A keystore ja existe em $absoluteStoreFile. Remove-a manualmente se quiseres recriar."
}

$storeDirectory = Split-Path $absoluteStoreFile -Parent
if (-not (Test-Path $storeDirectory)) {
  New-Item -ItemType Directory -Path $storeDirectory | Out-Null
}

& $keytoolPath `
  -genkeypair `
  -v `
  -keystore $absoluteStoreFile `
  -alias $alias `
  -keyalg RSA `
  -keysize 2048 `
  -validity 10000 `
  -storetype PKCS12 `
  -storepass $storePassword `
  -keypass $keyPassword `
  -dname $dname

if ($LASTEXITCODE -ne 0) {
  throw "keytool terminou com codigo $LASTEXITCODE."
}

$relativeStoreFile = [IO.Path]::GetRelativePath((Join-Path $repoRoot 'android'), $absoluteStoreFile).Replace('\', '/')
$keystorePropertiesPath = Join-Path $repoRoot 'android\keystore.properties'

@(
  "# Gerado por scripts/setup-android-release.ps1",
  "KASTROZAPP_UPLOAD_STORE_FILE=$relativeStoreFile",
  "KASTROZAPP_UPLOAD_STORE_PASSWORD=$storePassword",
  "KASTROZAPP_UPLOAD_KEY_ALIAS=$alias",
  "KASTROZAPP_UPLOAD_KEY_PASSWORD=$keyPassword",
  "ANDROID_VERSION_CODE=$versionCode",
  "ANDROID_VERSION_NAME=$versionName"
) | Set-Content -Path $keystorePropertiesPath -Encoding UTF8

Write-Host ""
Write-Host "Keystore criada em: $absoluteStoreFile"
Write-Host "Configuracao escrita em: $keystorePropertiesPath"
Write-Host "Proximo passo:"
Write-Host "1. setx JAVA_HOME `"$javaHome`""
Write-Host "2. abrir um novo terminal"
Write-Host "3. npm run native:bundle:release"
