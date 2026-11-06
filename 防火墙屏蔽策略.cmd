@echo off
chcp 65001 >nul
set MODEL=Hy/Hy4
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%~dp0orchestrator\firewall\block.ps1\" -Model %MODEL%'"
rem 新型号做全套前，指挥把第 3 行的 MODEL 改成这个型号的键；用户双击运行（会请求管理员权限），运行完告诉指挥再开测。
