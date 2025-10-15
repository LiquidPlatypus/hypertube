import subprocess, uvicorn, os, time, threading
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = BASE_DIR / "Backend"
FRONTEND_DIR = BASE_DIR / "Frontend"

def  run_front():
	os.chdir(FRONTEND_DIR)
	subprocess.run(["npm", "run", "dev"])

def run_back():
	os.chdir(BACKEND_DIR)
	uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)

if __name__ == "__main__":
	threading.Thread(target=run_front).start()
	time.sleep(2)
	run_back()
