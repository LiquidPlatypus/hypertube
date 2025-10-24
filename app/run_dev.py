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
    print(f"{bcolors.WARNING}Launching frontend...{bcolors.ENDC}")
    script_dir = os.path.dirname(os.path.abspath(__file__))
    frontend_path = os.path.join(script_dir, 'frontend')
    os.chdir(frontend_path)
    subprocess.run(["npm run dev"], shell=True)

def run_back():
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=True)

def print_dev_url():
    time.sleep(3)
    print("\n\n Dev URL :" + bcolors.OKBLUE + " http://localhost:5173/ " + bcolors.ENDC)

if __name__ == "__main__":
    print_thread = threading.Thread(target=print_dev_url)
    front_thread = threading.Thread(target=run_front)
    front_thread.start()
    print_thread.start()
    time.sleep(1)
    print(f"{bcolors.WARNING}Launching backend...{bcolors.ENDC}")
    time.sleep(1)
    run_back()
