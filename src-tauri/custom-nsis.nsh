!macro customUnInstall
  MessageBox MB_YESNO|MB_ICONQUESTION "Apakah Anda ingin menghapus seluruh file konfigurasi dan data tersisa (.hermes-hub & AppData) secara bersih (Clean Slate)?" IDNO skip_purge
    RMDir /r "$PROFILE\\.hermes-hub"
    RMDir /r "$APPDATA\\com.hermeshub.gateway"
    RMDir /r "$APPDATA\\hermes-hub-gateway"
    RMDir /r "$LOCALAPPDATA\\com.hermeshub.gateway"
    RMDir /r "$LOCALAPPDATA\\hermes-hub-gateway"
  skip_purge:
!macroend
