@echo off
title Freelance Gigs Studio - Angelo Lock To Hang
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================================
echo   FREELANCE GIGS STUDIO (ComeUp ^& Fiverr)
echo   Angelo Lock To Hang - Senior IA ^& Fullstack
echo ========================================================
echo.

:: 0. Vérification de la disponibilité de Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERREUR] Node.js n'est pas installe ou n'est pas dans le PATH.
    echo Veuillez installer Node.js (v18+) pour executer le serveur.
    pause
    exit /b 1
)

:: 1. Vérification si le serveur Express tourne déjà sur le port 3840
netstat -ano | findstr ":3840 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Serveur déjà actif et à l'écoute sur le port 3840.
) else (
    echo [INFO] Démarrage du serveur Express local (Port 3840)...
    start "Freelance Gigs Studio Server" cmd /k "node dashboard/server.js"
    echo [INFO] Attente de l'initialisation du serveur...
    timeout /t 2 /nobreak >nul
)

:: 2. Ouverture de l'interface dans le navigateur par défaut
echo [INFO] Ouverture de l'interface : http://localhost:3840
start http://localhost:3840

echo.
echo ========================================================
echo   Studio Web opérationnel dans votre navigateur !
echo   Pour fermer le serveur, fermez sa fenêtre de console.
echo ========================================================
echo.
timeout /t 3 >nul
