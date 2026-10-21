!macro customUnInstall
  MessageBox MB_YESNO|MB_ICONQUESTION "Apakah Anda ingin menghapus seluruh file konfigurasi dan data tersisa (.hermes-hub & AppData) serta memutuskan seluruh NTFS Junction (.agents) di project lokal secara bersih (Clean Slate)?" IDNO skip_purge
    ; 1. Eksekusi PowerShell uninstaller hook untuk memutuskan semua junction .agents di workspace terdaftar
    nsExec::ExecToLog 'powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "try { $cfgPath = \"$PROFILE\.hermes-hub\config.json\"; if (Test-Path $cfgPath) { $cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json; foreach ($ws in $cfg.workspaces) { if ($ws.target_path) { $junc = Join-Path $ws.target_path \".agents\"; if (Test-Path $junc) { Write-Output \"Unlinking $junc\"; cmd /c rmdir \"\"$junc\"\" } } } } } catch {}"'

    ; 2. Hapus seluruh data storage & cache HHG
    RMDir /r "$PROFILE\.hermes-hub"
    RMDir /r "$APPDATA\com.hermeshub.gateway"
    RMDir /r "$APPDATA\com.jusufsk.hermes-hub-gateway"
    RMDir /r "$APPDATA\hermes-hub-gateway"
    RMDir /r "$LOCALAPPDATA\com.hermeshub.gateway"
    RMDir /r "$LOCALAPPDATA\com.jusufsk.hermes-hub-gateway"
    RMDir /r "$LOCALAPPDATA\hermes-hub-gateway"
  skip_purge:
!macroend
