; Custom NSIS script for Sunrise Apartments AMS
; Ensures seamless updates without creating duplicate installations or duplicate shortcuts

!macro preInit
  ; Search 64-bit and 32-bit registry hives (HKLM and HKCU) for existing installation
  SetRegView 64
  ReadRegStr $R0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "UninstallString"
  ${If} $R0 == ""
    ReadRegStr $R0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "UninstallString"
  ${EndIf}

  ${If} $R0 == ""
    SetRegView 32
    ReadRegStr $R0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "UninstallString"
    ${If} $R0 == ""
      ReadRegStr $R0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "UninstallString"
    ${EndIf}
  ${EndIf}

  ; If a previous uninstaller exists, execute it silently before the new version installs
  ${If} $R0 != ""
    ; Strip outer quotes from path if present
    StrCpy $R1 $R0 1
    StrCmp $R1 '"' 0 +3
    StrCpy $R0 $R0 "" 1
    StrCpy $R1 $R0 "" -1
    StrCmp $R1 '"' 0 +3
    StrCpy $R0 $R0 -1

    ; Run previous uninstaller silently
    ExecWait '"$R0" /S _?=$INSTDIR'
  ${EndIf}

  SetRegView lastused
!macroend
