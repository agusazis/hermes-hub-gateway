!macro NSIS_HOOK_PREUNINSTALL
  ; Eksekusi pembersihan saat checkbox 'Delete the application data' dicentang
  ${If} $DeleteAppDataCheckboxState = 1
    ; 1. Putuskan seluruh NTFS Junction (.agents) di workspace terdaftar
    nsExec::ExecToLog 'powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "try { $cfgPath = Join-Path $env:USERPROFILE \".hermes-hub\config.json\"; if (Test-Path $cfgPath) { $cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json; foreach ($ws in $cfg.workspaces) { if ($ws.target_path) { $junc = Join-Path $ws.target_path \".agents\"; if (Test-Path $junc) { Write-Output \"Unlinking $junc\"; cmd /c rmdir \"\"$junc\"\" } } } } } catch {}"'

    ; 2. Hapus tuntas direktori penyimpanan konfigurasi & skills .hermes-hub
    nsExec::ExecToLog 'powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "try { $hubDir = Join-Path $env:USERPROFILE \".hermes-hub\"; if (Test-Path $hubDir) { Remove-Item -Recurse -Force $hubDir } } catch {}"'

    ; 3. Bersihkan sisa AppData dan LocalAppData
    RMDir /r "$APPDATA\com.hermeshub.gateway"
    RMDir /r "$APPDATA\com.jusufsk.hermes-hub-gateway"
    RMDir /r "$APPDATA\hermes-hub-gateway"
    RMDir /r "$LOCALAPPDATA\com.hermeshub.gateway"
    RMDir /r "$LOCALAPPDATA\com.jusufsk.hermes-hub-gateway"
    RMDir /r "$LOCALAPPDATA\hermes-hub-gateway"
  ${EndIf}
!macroend
