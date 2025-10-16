import subprocess
import threading
import uvicorn
import os
import time

class bcolors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'


def run_front():
    os.chdir("./Frontend")  # change vers ton dossier frontend
    subprocess.run(["npm run dev"], shell=True)

def run_back():
    uvicorn.run("Backend.app.main:app", host="127.0.0.1", port=8000, reload=True)

def print_dev_url():
    time.sleep(3)
    print("\n\n Dev URL :" + '\033[94m' + " http://localhost:5173/ " + '\033[0m')

if __name__ == "__main__":
    print_thread = threading.Thread(target=print_dev_url)
    front_thread = threading.Thread(target=run_front)
    front_thread.start()
    print_thread.start()
    time.sleep(2)  # petit délai pour que le front démarre
    run_back()
