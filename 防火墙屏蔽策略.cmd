@echo off
chcp 65001 >nul
set MODEL=Gemini/4Hydrogen
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%~dp0orchestrator\firewall\block.ps1\" -Model %MODEL%'"
rem 开测前，指挥把第 3 行的 MODEL 改成这次要测的新型号键（多个用逗号分隔），已测完的型号不再写；用户双击运行（会请求一次管理员权限），运行完告诉指挥再开测。
