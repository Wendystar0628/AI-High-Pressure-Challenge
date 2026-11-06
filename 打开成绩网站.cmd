@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 导出最新成绩并构建网站……
python website\tools\publish.py --no-upload
if errorlevel 1 (
    echo.
    echo 构建失败，看上面的输出。
    pause
    exit /b 1
)
echo.
echo 网站已在浏览器打开。关掉这个窗口就停止网站。
cd /d "%~dp0website\site"
call npx vite preview --open
pause
