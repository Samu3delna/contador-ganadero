param(
  [string]$SigningDirectory = "$env:LOCALAPPDATA/ContadorGanadero/signing",
  [switch]$CreateKey,
  [switch]$SkipBuild
)
$ErrorActionPreference = 'Stop'
$mobileDirectory = Split-Path $PSScriptRoot -Parent
if (!$env:JAVA_HOME -or !$env:ANDROID_HOME) { throw 'Configura JAVA_HOME y ANDROID_HOME.' }
$keytool = Join-Path $env:JAVA_HOME 'bin/keytool.exe'
$buildTools = Join-Path $env:ANDROID_HOME 'build-tools/37.0.0'
$keyFile = Join-Path $SigningDirectory 'contador-ganadero-release.jks'
$passwordFile = Join-Path $SigningDirectory 'password.dpapi'
if ($CreateKey) {
  if ((Test-Path $keyFile) -or (Test-Path $passwordFile)) { throw 'La identidad de firma ya existe; no se sobrescribe.' }
  New-Item -ItemType Directory -Force -Path $SigningDirectory | Out-Null
  $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
  & icacls.exe $SigningDirectory /inheritance:r /grant:r "${identity}:(OI)(CI)F" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'No se pudieron restringir los permisos de firma.' }
  $random = New-Object byte[] 48
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($random)
  $rng.Dispose()
  $secret = [Convert]::ToBase64String($random)
  ConvertTo-SecureString $secret -AsPlainText -Force | ConvertFrom-SecureString | Set-Content -LiteralPath $passwordFile
  $env:CG_SIGNING_PASSWORD = $secret
  try {
    & $keytool -genkeypair -keystore $keyFile -storetype JKS -alias contador-ganadero -keyalg RSA -keysize 4096 -validity 10000 -dname 'CN=ContadorGanadero, O=ContadorGanadero, C=CR' -storepass:env CG_SIGNING_PASSWORD -keypass:env CG_SIGNING_PASSWORD
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo generar la clave.' }
  } finally { $env:CG_SIGNING_PASSWORD = $null; $secret = $null }
}
if (!(Test-Path $keyFile) -or !(Test-Path $passwordFile)) { throw 'Falta la clave o su contraseña protegida con DPAPI.' }
Push-Location $mobileDirectory
try {
  if (!$SkipBuild) {
    & npx.cmd expo prebuild --platform android --no-install
    if ($LASTEXITCODE -ne 0) { throw 'Falló Expo prebuild.' }
    Push-Location android
    try {
      & .\gradlew.bat :app:assembleRelease --no-daemon --console=plain '-PreactNativeArchitectures=arm64-v8a' '-Pandroid.cmakeVersion=3.31.6'
      if ($LASTEXITCODE -ne 0) { throw 'Falló la compilación release.' }
    } finally { Pop-Location }
  }
  $unsigned = Join-Path $mobileDirectory 'android/app/build/outputs/apk/release/app-release-unsigned.apk'
  $version = (Get-Content package.json -Raw | ConvertFrom-Json).version
  $outputDirectory = Join-Path $mobileDirectory '.expo/releases'
  New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
  $apk = Join-Path $outputDirectory "contador-ganadero-$version-android-arm64.apk"
  $secure = Get-Content -LiteralPath $passwordFile | ConvertTo-SecureString
  $credential = New-Object System.Management.Automation.PSCredential('signing', $secure)
  $env:CG_SIGNING_PASSWORD = $credential.GetNetworkCredential().Password
  try {
    & "$buildTools/apksigner.bat" sign --ks $keyFile --ks-key-alias contador-ganadero --ks-pass env:CG_SIGNING_PASSWORD --key-pass env:CG_SIGNING_PASSWORD --out $apk $unsigned
    if ($LASTEXITCODE -ne 0) { throw 'Falló la firma del APK.' }
  } finally { $env:CG_SIGNING_PASSWORD = $null; $credential = $null }
  & "$buildTools/apksigner.bat" verify --verbose --print-certs $apk
  if ($LASTEXITCODE -ne 0) { throw 'La firma no es válida.' }
  & "$buildTools/zipalign.exe" -c -P 16 -v 4 $apk | Select-Object -Last 1
  if ($LASTEXITCODE -ne 0) { throw 'La alineación del APK no es válida.' }
  $hash = (Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash.ToLowerInvariant()
  "$hash  $(Split-Path $apk -Leaf)" | Set-Content -Encoding ascii -LiteralPath "$apk.sha256"
  Write-Output "APK firmado: $apk"
  Write-Output "SHA256: $hash"
} finally { Pop-Location }
