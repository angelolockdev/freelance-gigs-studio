@echo off
chcp 65001 >nul
title Freelance Gigs Studio - Lanceur Chrome Debug (Port 9222)

echo ===============================================================================
echo        FREELANCE GIGS STUDIO - LANCEUR CHROME DEBUG (PORT 9222)
echo ===============================================================================
echo.

:: 1. Définition du profil utilisateur persistant
set "DEBUG_PROFILE=%USERPROFILE%\.chrome-debug-profile"
if not exist "%DEBUG_PROFILE%" (
    echo [INFO] Création du dossier de profil persistant : "%DEBUG_PROFILE%"
    mkdir "%DEBUG_PROFILE%"
)

:: 2. Détection automatique de l'exécutable Chrome sur la machine Windows
set "CHROME_BIN="

if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    set "CHROME_BIN=C:\Program Files\Google\Chrome\Application\chrome.exe"
    goto :CHROME_FOUND
)

if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    set "CHROME_BIN=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    goto :CHROME_FOUND
)

if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" (
    set "CHROME_BIN=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
    goto :CHROME_FOUND
)

if exist "%PROGRAMFILES%\Google\Chrome\Application\chrome.exe" (
    set "CHROME_BIN=%PROGRAMFILES%\Google\Chrome\Application\chrome.exe"
    goto :CHROME_FOUND
)

if exist "%PROGRAMFILES(X86)%\Google\Chrome\Application\chrome.exe" (
    set "CHROME_BIN=%PROGRAMFILES(X86)%\Google\Chrome\Application\chrome.exe"
    goto :CHROME_FOUND
)

:: Recherche via le PATH système
for /f "tokens=*" %%i in ('where chrome.exe 2^>nul') do (
    set "CHROME_BIN=%%i"
    goto :CHROME_FOUND
)

:CHROME_NOT_FOUND
echo [ERREUR] Impossible de localiser Google Chrome sur cette machine Windows.
echo Veuillez vérifier que Google Chrome est installé ou installer la dernière version :
echo https://www.google.com/chrome/
echo.
pause
exit /b 1

:CHROME_FOUND
echo [OK] Exécutable Chrome détecté :
echo      "%CHROME_BIN%"
echo.
echo [OK] Profil persistant dédié :
echo      "%DEBUG_PROFILE%"
echo.

:: 3. Vérification si le port 9222 est déjà actif
netstat -ano | findstr /i ":9222 " >nul
if %ERRORLEVEL% equ 0 (
    echo [ATTENTION] Le port 9222 est déjà en cours d'utilisation !
    echo Une instance de Chrome Debug semble déjà active sur cette machine.
    echo Vous pouvez vérifier son statut sur : http://localhost:9222/json/version
    echo.
    echo Si vous souhaitez relancer une session propre, fermez d'abord la fenêtre Chrome existante.
    echo.
) else (
    echo [LANCEMENT] Démarrage de Google Chrome en mode Remote Debugging...
    start "" "%CHROME_BIN%" --remote-debugging-port=9222 --user-data-dir="%DEBUG_PROFILE%" --no-first-run --no-default-browser-check "https://comeup.com/dashboard" "https://www.fiverr.com/manage_gigs"
    
    echo [OK] Chrome lancé avec succès sur le port 9222.
)

echo.
echo ===============================================================================
echo                         INSTRUCTIONS OPÉRATEUR HUMAIN
echo ===============================================================================
echo.
echo  1. Dans la fenêtre Chrome qui vient de s'ouvrir :
echo     - Connectez-vous à votre compte COMEUP (https://comeup.com)
echo     - Connectez-vous à votre compte FIVERR (https://www.fiverr.com)
echo.
echo  2. POURQUOI CETTE ÉTAPE ?
echo     - Le profil persistant conserve vos sessions et cookies réels.
echo     - Vous n'aurez plus besoin de vous reconnecter lors des prochaines sessions.
echo     - L'injecteur Playwright s'y rattachera via CDP sans déclencher de blocage
echo       anti-bot (Cloudflare, PerimeterX).
echo.
echo  3. VÉRIFICATION DE DISPONIBILITÉ :
echo     - Ouvrez dans n'importe quel navigateur : http://localhost:9222/json/version
echo     - Si vous voyez une réponse JSON, le canal CDP est 100%% prêt !
echo.
echo  4. INJECTION DES SERVICES :
echo     - Pour injecter un gig en brouillon, lancez dans le terminal :
echo         npm run inject -- --gig=ai-rag-agent --platform=all
echo     - Ou testez d'abord en simulation :
echo         npm run inject -- --gig=ai-rag-agent --platform=all --dry-run
echo.
echo ===============================================================================
echo Cette fenêtre peut rester ouverte ou être fermée. Le navigateur reste actif.
echo.
if /i "%1" neq "--no-pause" if /i "%2" neq "--no-pause" (
    pause
)

