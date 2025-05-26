@echo off
echo Dang kich hoat moi truong ao...
call .\venv\Scripts\activate.bat

echo Dang khoi dong Uvicorn server voi .env.development...
uvicorn app.main:app --reload --env-file .\.env.development

echo De dung server, nhan CTRL+C trong cua so nay.
pause