import subprocess
import threading
import uvicorn
import os
import time

def run_front():
    os.chdir("./Frontend")  # change vers ton dossier frontend
    subprocess.run(["npm", "run", "dev"], shell=True)

def run_back():
    uvicorn.run("Backend.app.main:app", host="127.0.0.1", port=8000, reload=True)

if __name__ == "__main__":
    front_thread = threading.Thread(target=run_front)
    front_thread.start()
    time.sleep(2)  # petit délai pour que le front démarre
    run_back()
