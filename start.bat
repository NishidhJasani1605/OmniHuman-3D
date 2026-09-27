@echo off
title OMNI-HUMAN 3D — Living Multiscale Digital Twin & Clinical AI Workstation
cd /d "%~dp0"
echo ==============================================================================
echo    OMNI-HUMAN 3D — Living Multiscale Digital Human Twin
echo    Powered by Authentic BodyParts3D 4.0 & Advanced Anatomy Engine
echo ==============================================================================
echo.
echo  * 2,234 Authentic Clinical Meshes Across 15 Complete Organ Systems
echo  * 3D Multiplanar MRI & CT Scanner with Real-Time Synchronized Laser Slicing
echo  * Bio-Energy Holo-Engine: Cardiac Ventricular Pulsation & Arterial Waves
echo  * Real-Time Lead II ECG Canvas Oscilloscope (STEMI Tombstone Elevation)
echo  * Clinical Diagnostic Mind with Evidence-Based Treatment Protocols
echo  * Microscopic Virtual Cell Digital Twin with 3D Organelles & CRISPR
echo  * 1-Click 3D Printable Binary STL Exporter for Any Anatomical Structure
echo.
echo Launching workstation at http://localhost:8090 in your default browser...
echo.
start http://localhost:8090
python -m http.server 8090 2>nul || py -m http.server 8090 2>nul || powershell -NoProfile -Command "Write-Host 'Starting fallback HTTP listener on 8090...'; $l = New-Object System.Net.HttpListener; $l.Prefixes.Add('http://localhost:8090/'); $l.Start(); Start-Process 'http://localhost:8090/'; while($l.IsListening){$c = $l.GetContext(); $p = Join-Path (Get-Location) ($c.Request.Url.LocalPath.TrimStart('/')); if(-not (Test-Path $p -PathType Leaf)){$p = Join-Path (Get-Location) 'index.html'}; $b = [System.IO.File]::ReadAllBytes($p); $c.Response.OutputStream.Write($b, 0, $b.Length); $c.Response.Close()}"
pause
